// certificate.controller.js
import { db } from "../../config/db.js";
import {
    genCertCode,
    buildCertHtml,
    renderCert,
    uploadBuffer,
    getCertByDonation,
    insertCert,

} from "./certificate.service.js";

// ── POST /certificates/generate ───────────────────────────────────
// body: { donation_id }
export async function generateCertificate(req, res, next) {
    try {
        const { donation_id } = req.body;
        const user_id = req.user?.user_id ?? null;

        if (!donation_id)
            return res.status(400).json({ message: "donation_id required" });

        // เช็คว่ามีใบเซอร์แล้วหรือยัง
        const existing = await getCertByDonation(donation_id);
        if (existing) return res.json(existing);

        // ดึงข้อมูลบริจาค + โครงการ
        const [rows] = await db.query(
            `SELECT dr.*, req.request_title, s.school_name
   FROM donation_record dr
   JOIN donation_request req ON req.request_id = dr.request_id
   JOIN schools s ON s.school_id = req.school_id
   WHERE dr.donation_id = ?
   LIMIT 1`,
            [donation_id]
        );
        if (!rows[0])
            return res.status(404).json({ message: "ไม่พบรายการบริจาค" });

        const donation = rows[0];

        // parse items
        let items = [];
        try {
            items = typeof donation.items_snapshot === "string"
                ? JSON.parse(donation.items_snapshot)
                : (donation.items_snapshot || []);
        } catch { items = []; }

        const items_summary = items.length > 0
            ? items.map(i => {
                // ตัดวงเล็บ (ไซส์) ออกจากชื่อ เช่น "เสื้อนักเรียนหญิง (อก 32")" → "เสื้อนักเรียนหญิง"
                const name = String(i.name || "").replace(/\s*\(.*?\)\s*/g, "").trim();
                return `${name} จำนวน ${i.quantity} ตัว`;
            }).join(", ")
            : `ชุดนักเรียน จำนวน ${donation.quantity} ชิ้น`;

        const certificate_code = genCertCode();
        const issued_at = new Date().toISOString().split("T")[0];

        // render
        const html = await buildCertHtml({
            donor_name: donation.donor_name,
            items_summary,
            project_title: donation.request_title,
            issued_at,
            certificate_code,
        });

        const { png, pdf } = await renderCert(html);

        // upload
        const pngResult = await uploadBuffer(png, {
            folder: "unieed/certificates",
            public_id: `cert_${certificate_code}`,
            resource_type: "image",
        });

        const pdfResult = await uploadBuffer(pdf, {
            folder: "unieed/certificates",
            public_id: `cert_${certificate_code}_pdf`,
            resource_type: "raw",
        });

        // insert DB
        const certificate_id = await insertCert({
            donation_id,
            user_id,
            donor_name: donation.donor_name,
            certificate_code,
            items_summary,
            project_title: donation.request_title,
            school_name: donation.school_name,
            issued_at,
            certificate_url: pngResult.secure_url,
            certificate_public_id: pngResult.public_id,
            pdf_url: pdfResult.secure_url,
            pdf_public_id: pdfResult.public_id,
        });

        res.status(201).json({
            certificate_id,
            donation_id,
            donor_name: donation.donor_name,
            certificate_code,
            items_summary,
            project_title: donation.request_title,
            school_name: donation.school_name,
            issued_at,
            certificate_url: pngResult.secure_url,
            pdf_url: pdfResult.secure_url,
        });

    } catch (err) {
        next(err);
    }
}

// ── GET /certificates/donation/:donationId ────────────────────────
// ดึงใบเซอร์ของ donation นั้น
export async function getCertificate(req, res, next) {
    try {
        const donation_id = Number(req.params.donationId);
        const cert = await getCertByDonation(donation_id);
        if (!cert)
            return res.status(404).json({ message: "ยังไม่มีใบประกาศนียบัตร" });
        res.json(cert);
    } catch (err) {
        next(err);
    }
}

// ── PATCH /donations/:donationId/verify ───────────────────────────
export async function verifyAndIssueCertificate(req, res, next) {
    try {
        console.log("🔔 verifyAndIssueCertificate called", req.params, req.body);

        const donation_id = Number(req.params.donationId);
        const { condition_status, thank_message, items_received } = req.body;
        // items_received: [{ uniform_type_id, qty_received, reason? }] — optional partial list

        const isAdmin = req.user?.role === "admin";

            if (!condition_status && !isAdmin)
            return res.status(400).json({ message: "condition_status required" });
        const [[current]] = await db.query(
            `SELECT status FROM donation_record WHERE donation_id = ?`,
            [donation_id]
        );
        if (!current)
            return res.status(404).json({ message: "ไม่พบรายการบริจาค" });
        if (current.status !== "pending" && current.status !== "approved")
            return res.status(400).json({ message: "รายการนี้ถูกอัปเดตแล้ว" });
        if (current.status === "approved" && current.condition_status)
            return res.status(400).json({ message: "รายการนี้ตรวจสอบแล้ว" });


            if (isAdmin) {
            // Admin approve — set condition_status = 'usable' เป็น default
            await db.query(
                `UPDATE donation_record
                SET status = 'approved', condition_status = 'usable', updated_at = NOW(),
                    admin_approved = 1, admin_approved_at = NOW()
                WHERE donation_id = ?`,
                [donation_id]
            );
            } else {
            // โรงเรียน approve — set condition_status ด้วย
            await db.query(
                `UPDATE donation_record
                SET condition_status = ?, status = 'approved', updated_at = NOW(),
                    items_condition_snapshot = ?
                WHERE donation_id = ?`,
                [
                    condition_status,
                    Array.isArray(items_received) && items_received.length > 0
                        ? JSON.stringify(items_received)
                        : null,
                    donation_id,
                ]
            );
            }
        // ✅ INSERT fulfillment — นับเฉพาะ item ที่ item_condition === "usable"
        {
            const [[snap]] = await db.query(
                `SELECT request_id, items_snapshot FROM donation_record WHERE donation_id = ?`,
                [donation_id]
            );

            if (snap) {
                let snapItems = [];
                try {
                    snapItems = typeof snap.items_snapshot === "string"
                        ? JSON.parse(snap.items_snapshot)
                        : (snap.items_snapshot || []);
                } catch { snapItems = []; }

                const receivedMap = {};
                const conditionMap = {};
                if (Array.isArray(items_received) && items_received.length > 0) {
                    for (const r of items_received) {
                        receivedMap[r.uniform_type_id] = Number(r.qty_received ?? 0);
                        conditionMap[r.uniform_type_id] = r.item_condition ?? null;
                    }
                }
                const usePerItem = Object.keys(receivedMap).length > 0;

                for (const item of snapItems) {
                    // ถ้ามี per-item condition → นับเฉพาะ usable
                    // ถ้าไม่มี (backward compat) → นับเฉพาะถ้า overall เป็น usable
                    const itemCond = usePerItem
                        ? (conditionMap[item.uniform_type_id] ?? null)
                        : (condition_status === "usable" ? "usable" : null);
                    if (itemCond !== "usable") continue;

                    const qty = usePerItem
                        ? (receivedMap[item.uniform_type_id] ?? 0)
                        : item.quantity;
                    if (qty <= 0) continue;

                    const [snRows] = await db.query(
                        `SELECT sn.student_need_id
         FROM student_need sn
         JOIN students st ON st.student_id = sn.student_id
         WHERE st.request_id = ? AND sn.uniform_type_id = ?
         LIMIT 1`,
                        [snap.request_id, item.uniform_type_id]
                    );

                    await db.query(
                        `INSERT INTO fulfillment
           (donation_id, request_id, request_item_id, quantity_fulfilled, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
                        [
                            donation_id,
                            snap.request_id,
                            snRows[0]?.student_need_id ?? null,
                            qty,
                        ]
                    );
                }
            }
        }

        // 2. ดึงข้อมูลบริจาค
        const [rows] = await db.query(
            `SELECT dr.*, req.request_title, s.school_name
       FROM donation_record dr
       JOIN donation_request req ON req.request_id = dr.request_id
       JOIN schools s ON s.school_id = req.school_id
       WHERE dr.donation_id = ? LIMIT 1`,
            [donation_id]
        );
        if (!rows[0])
            return res.status(404).json({ message: "ไม่พบรายการบริจาค" });

        const donation = rows[0];
        console.log("donor_id:", donation.donor_id);

        // 3. ออก certificate — ออกถ้ามี item usable อย่างน้อย 1 อัน
        let cert = null;
        {
            let snapItems = [];
            try {
                snapItems = typeof donation.items_snapshot === "string"
                    ? JSON.parse(donation.items_snapshot)
                    : donation.items_snapshot || [];
            } catch { snapItems = []; }

            // หา item ที่ usable เท่านั้น
            let usableItems = [];
            const CERT_ELIGIBLE = ["usable", "damaged"];
            if (Array.isArray(items_received) && items_received.length > 0) {
                const condMap = {};
                for (const r of items_received) condMap[r.uniform_type_id] = r.item_condition ?? null;
                usableItems = snapItems.filter(it => CERT_ELIGIBLE.includes(condMap[it.uniform_type_id]));
            } else {
                // backward compat — ไม่มี per-item → ใช้ overall
                if (condition_status !== "wrong_item") usableItems = snapItems;
            }

            if (usableItems.length > 0) {
                cert = await getCertByDonation(donation_id);
                if (!cert) {
                    const items_summary = usableItems.map(i => {
                        const name = String(i.name || "").replace(/\s*\(.*?\)\s*/g, "").trim();
                        return `${name} จำนวน ${i.quantity} ตัว`;
                    }).join(", ");

                    const certificate_code = genCertCode();
                    const issued_at = new Date().toISOString().split("T")[0];

                    const html = await buildCertHtml({
                        donor_name: donation.donor_name,
                        items_summary,
                        project_title: donation.request_title,
                        issued_at,
                        certificate_code,
                    });

                    const { png, pdf } = await renderCert(html);

                    const pngResult = await uploadBuffer(png, {
                        folder: "unieed/certificates",
                        public_id: `cert_${certificate_code}`,
                        resource_type: "image",
                    });
                    const pdfResult = await uploadBuffer(pdf, {
                        folder: "unieed/certificates",
                        public_id: `cert_${certificate_code}_pdf`,
                        resource_type: "raw",
                    });

                    const certificate_id = await insertCert({
                        donation_id,
                        user_id: donation.donor_id ?? null,
                        donor_name: donation.donor_name,
                        certificate_code,
                        items_summary,
                        project_title: donation.request_title,
                        school_name: donation.school_name,
                        issued_at,
                        certificate_url: pngResult.secure_url,
                        certificate_public_id: pngResult.public_id,
                        pdf_url: pdfResult.secure_url,
                        pdf_public_id: pdfResult.public_id,
                    });

                    cert = {
                        certificate_id,
                        certificate_url: pngResult.secure_url,
                        pdf_url: pdfResult.secure_url,
                        certificate_code,
                        items_summary,
                        issued_at,
                    };
                }
            }
        }

        // 4. Strike logic — เพิ่ม strike เฉพาะ wrong_item และยังไม่เคย issue ของ donation นี้
        let justSuspended = false;
        let suspendedUntilDate = null;
        if (!isAdmin && donation.donor_id && condition_status === "wrong_item") {
            const [[dr]] = await db.query(
                `SELECT strike_issued FROM donation_record WHERE donation_id = ?`, [donation_id]
            );
            if (dr?.strike_issued) {
                // เคย increment แล้ว ข้ามไป (กรณี retry หลัง partial failure)
            } else {
            await db.query(
                `UPDATE users SET strike_count = strike_count + 1 WHERE user_id = ?`,
                [donation.donor_id]
            );
            await db.query(
                `UPDATE donation_record SET strike_issued = 1 WHERE donation_id = ?`, [donation_id]
            );
            const [[donor]] = await db.query(
                `SELECT strike_count, user_name FROM users WHERE user_id = ?`,
                [donation.donor_id]
            );
            if (donor && donor.strike_count >= 3) {
                const [[alreadySuspended]] = await db.query(
                    `SELECT suspended_until FROM users WHERE user_id = ? AND suspended_until > NOW()`,
                    [donation.donor_id]
                );
                if (!alreadySuspended) {
                    await db.query(
                        `UPDATE users SET suspended_until = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE user_id = ?`,
                        [donation.donor_id]
                    );
                    const [[updated]] = await db.query(
                        `SELECT suspended_until FROM users WHERE user_id = ?`,
                        [donation.donor_id]
                    );
                    justSuspended = true;
                    suspendedUntilDate = updated?.suspended_until;

                    // แจ้ง donor ว่าถูกระงับ
                    await db.query(
                        `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
                         VALUES (?, 'suspension', ?, ?, ?, 0, NOW())`,
                        [
                            donation.donor_id,
                            "คุณถูกระงับการบริจาคชั่วคราว 30 วัน",
                            JSON.stringify({
                                message: "เนื่องจากมีประวัติส่งรายการบริจาคไม่ตรง 3 ครั้ง คุณถูกระงับการบริจาคผ่านพัสดุและ drop-off เป็นเวลา 30 วัน",
                                suspended_until: suspendedUntilDate,
                                strike_count: donor.strike_count,
                                donor_name: donor.user_name,
                            }),
                            donation_id,
                        ]
                    );

                    // แจ้ง admin ทุกคน
                    const [admins] = await db.query(
                        `SELECT user_id FROM users WHERE role = 'admin'`
                    );
                    await Promise.all(admins.map(admin =>
                        db.query(
                            `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
                             VALUES (?, 'suspension', ?, ?, ?, 0, NOW())`,
                            [
                                admin.user_id,
                                `ผู้บริจาค ${donor.user_name || "ไม่ระบุชื่อ"} ถูกระงับอัตโนมัติ (คำเตือน 3/3)`,
                                JSON.stringify({
                                    message: `ผู้บริจาคถูกระงับการส่งพัสดุและ drop-off เป็นเวลา 30 วัน เนื่องจากมีประวัติส่งรายการบริจาคไม่ตรง 3 ครั้ง`,
                                    suspended_until: suspendedUntilDate,
                                    donor_id: donation.donor_id,
                                    donor_name: donor.user_name,
                                }),
                                donation_id,
                            ]
                        )
                    ));
                }
            }
            } // end else (strike not yet issued)
        }

        // 5. Insert notification (ทุก condition แต่ข้อความต่างกัน)
        // build wrong_items list สำหรับแจ้ง donor ว่ารายการไหนไม่ตรง
        let wrong_items = [];
        if (condition_status === "wrong_item" && Array.isArray(items_received) && items_received.length > 0) {
            let snapForNotif = [];
            try {
                snapForNotif = typeof donation.items_snapshot === "string"
                    ? JSON.parse(donation.items_snapshot)
                    : donation.items_snapshot || [];
            } catch { snapForNotif = []; }
            const condMapNotif = {};
            for (const r of items_received) condMapNotif[r.uniform_type_id] = r.item_condition ?? null;
            wrong_items = snapForNotif
                .filter(it => condMapNotif[it.uniform_type_id] === "wrong_item")
                .map(it => String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim())
                .filter(Boolean);
        }

        if (donation.donor_id) {
            console.log("📨 inserting notification for user:", donation.donor_id);

            let notifType, notifTitle, notifBody;

            if (condition_status === "wrong_item") {
                notifType  = cert ? "certificate" : "donation_issue";
                notifTitle = cert
                    ? `${donation.school_name} รับของบริจาคบางส่วน (มีรายการไม่ตรง)`
                    : `${donation.school_name} แจ้งว่ารายการบริจาคไม่ตรง`;
                notifBody  = JSON.stringify({
                    message: thank_message || `โรงเรียน ${donation.school_name} แจ้งว่ามีรายการที่บริจาคไม่ตรงกับที่ขอ`,
                    condition_status: "wrong_item",
                    wrong_items,
                    certificate_url: cert?.certificate_url,
                    pdf_url: cert?.pdf_url,
                    certificate_code: cert?.certificate_code,
                    items_summary: cert?.items_summary,
                    project_title: donation.request_title,
                    school_name: donation.school_name,
                    issued_at: cert?.issued_at,
                });
            } else if (condition_status === "damaged") {
                notifType  = "certificate";
                notifTitle = `${donation.school_name} ได้รับพัสดุแล้ว`;
                notifBody  = JSON.stringify({
                    message: thank_message || `โรงเรียน ${donation.school_name} ได้รับพัสดุแล้ว แต่ชุดมีสภาพเสียหาย ขอบคุณสำหรับน้ำใจของคุณ`,
                    certificate_url: cert?.certificate_url,
                    pdf_url: cert?.pdf_url,
                    certificate_code: cert?.certificate_code,
                    items_summary: cert?.items_summary,
                    condition_status: "damaged",
                    project_title: donation.request_title,
                    school_name: donation.school_name,
                    issued_at: cert?.issued_at,
                });
            } else {
                notifType  = "certificate";
                notifTitle = `${donation.school_name} ยืนยันการรับบริจาคแล้ว`;
                notifBody  = JSON.stringify({
                    message: thank_message || "",
                    certificate_url: cert?.certificate_url,
                    pdf_url: cert?.pdf_url,
                    certificate_code: cert?.certificate_code,
                    items_summary: cert?.items_summary,
                    condition_status: "usable",
                    project_title: donation.request_title,
                    school_name: donation.school_name,
                    issued_at: cert?.issued_at,
                });
            }

            await db.query(
                `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`,
                [donation.donor_id, notifType, notifTitle, notifBody, donation_id]
            );
            console.log("✅ notification inserted");
        } else {
            console.log("⚠️ donor_id is null, skip notification");
        }

        res.json({ success: true, certificate: cert });
    } catch (err) {
        console.error("❌ verifyAndIssueCertificate error:", err);
        next(err);
    }
}

// ── POST /certificates/reissue/:donationId ────────────────────────
// สำหรับ admin/school — regenerate cert + notification สำหรับ donation ที่ approved แต่ไม่มี cert
export async function reissueCert(req, res, next) {
  try {
    const donation_id = Number(req.params.donationId);

    const [[current]] = await db.query(
      `SELECT dr.*, req.request_title, s.school_name
       FROM donation_record dr
       JOIN donation_request req ON req.request_id = dr.request_id
       JOIN schools s ON s.school_id = req.school_id
       WHERE dr.donation_id = ? LIMIT 1`,
      [donation_id]
    );
    if (!current) return res.status(404).json({ message: "ไม่พบรายการบริจาค" });
    if (current.status !== "approved") return res.status(400).json({ message: "รายการยังไม่ถูก approve" });

    let cert = await getCertByDonation(donation_id);
    if (!cert) {
      let items = [];
      try {
        items = typeof current.items_snapshot === "string"
          ? JSON.parse(current.items_snapshot) : (current.items_snapshot || []);
      } catch { items = []; }

      const items_summary = items.length > 0
        ? items.map(i => `${String(i.name || "").replace(/\s*\(.*?\)\s*/g, "").trim()} จำนวน ${i.quantity} ตัว`).join(", ")
        : `ชุดนักเรียน จำนวน ${current.quantity} ชิ้น`;

      const certificate_code = genCertCode();
      const issued_at = new Date().toISOString().split("T")[0];
      const html = await buildCertHtml({ donor_name: current.donor_name, items_summary, project_title: current.request_title, issued_at, certificate_code });
      const { png, pdf } = await renderCert(html);

      const [pngResult, pdfResult] = await Promise.all([
        uploadBuffer(png, { folder: "unieed/certificates", public_id: `cert_${certificate_code}`, resource_type: "image" }),
        uploadBuffer(pdf, { folder: "unieed/certificates", public_id: `cert_${certificate_code}_pdf`, resource_type: "raw" }),
      ]);

      await insertCert({
        donation_id, user_id: current.donor_id ?? null,
        donor_name: current.donor_name, certificate_code, items_summary,
        project_title: current.request_title, school_name: current.school_name, issued_at,
        certificate_url: pngResult.secure_url, certificate_public_id: pngResult.public_id,
        pdf_url: pdfResult.secure_url, pdf_public_id: pdfResult.public_id,
      });

      cert = { certificate_url: pngResult.secure_url, pdf_url: pdfResult.secure_url, certificate_code, items_summary, issued_at };
    }

    if (current.donor_id) {
      const [existing] = await db.query(
        `SELECT notification_id FROM notifications WHERE ref_id = ? AND type = 'certificate' LIMIT 1`,
        [donation_id]
      );
      if (!existing[0]) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
           VALUES (?, 'certificate', ?, ?, ?, 0, NOW())`,
          [
            current.donor_id,
            `${current.school_name} ยืนยันการรับบริจาคแล้ว`,
            JSON.stringify({ message: "", certificate_url: cert.certificate_url, pdf_url: cert.pdf_url, certificate_code: cert.certificate_code, items_summary: cert.items_summary, project_title: current.request_title, school_name: current.school_name, issued_at: cert.issued_at }),
            donation_id,
          ]
        );
      }
    }

    res.json({ success: true, certificate: cert });
  } catch (err) { next(err); }
}

export async function getMyCertificates(req, res, next) {
  try {
    const user_id = req.user.user_id;

    const [rows] = await db.query(
      `SELECT 
        c.certificate_id, c.certificate_code,
        c.donor_name, c.items_summary,
        c.project_title, c.school_name,
        c.issued_at, c.certificate_url, c.pdf_url,
        dr.request_image_url
       FROM certificate c
       LEFT JOIN donation_record d ON d.donation_id = c.donation_id
       LEFT JOIN donation_request dr ON dr.request_id = d.request_id
       WHERE c.user_id = ?
       ORDER BY c.issued_at DESC`,
      [user_id]
    );

    res.json(rows);
  } catch (err) { next(err); }
}