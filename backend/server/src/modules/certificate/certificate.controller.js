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
        const { condition_status, thank_message } = req.body;

        if (!condition_status)
            return res.status(400).json({ message: "condition_status required" });
        const [[current]] = await db.query(
            `SELECT status FROM donation_record WHERE donation_id = ?`,
            [donation_id]
        );
        if (!current)
            return res.status(404).json({ message: "ไม่พบรายการบริจาค" });
        if (current.status !== "pending")
            return res.status(400).json({ message: "รายการนี้ถูกอัปเดตแล้ว" });
        // 1. อัปเดต donation_record
        await db.query(
            `UPDATE donation_record
   SET condition_status = ?, status = 'approved', updated_at = NOW()
   WHERE donation_id = ?`,
            [condition_status, donation_id]
        );
        // ✅ เพิ่ม step 1.5: INSERT fulfillment เมื่อ condition_status = 'usable'
        if (condition_status === "usable") {
            // ดึง items_snapshot และ request_id ก่อน (ยังไม่มี donation object ตอนนี้)
            const [[snap]] = await db.query(
                `SELECT request_id, items_snapshot FROM donation_record WHERE donation_id = ?`,
                [donation_id]
            );

            if (snap) {
                let items = [];
                try {
                    items = typeof snap.items_snapshot === "string"
                        ? JSON.parse(snap.items_snapshot)
                        : (snap.items_snapshot || []);
                } catch { items = []; }

                for (const item of items) {
                    // lookup student_need_id จาก uniform_type_id
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
                            item.quantity,
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

        // 3. ออก certificate (ถ้ายังไม่มี)
        let cert = await getCertByDonation(donation_id);
        if (!cert) {
            let items = [];
            try {
                items = typeof donation.items_snapshot === "string"
                    ? JSON.parse(donation.items_snapshot)
                    : donation.items_snapshot || [];
            } catch { items = []; }

            const items_summary = items.length > 0
                ? items.map(i => {
                    const name = String(i.name || "").replace(/\s*\(.*?\)\s*/g, "").trim();
                    return `${name} จำนวน ${i.quantity} ตัว`;
                }).join(", ")
                : `ชุดนักเรียน จำนวน ${donation.quantity} ชิ้น`;

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

        // 4. Insert notification
        if (donation.donor_id) {
            console.log("📨 inserting notification for user:", donation.donor_id);
            const notifTitle = `${donation.school_name} ยืนยันการรับบริจาคแล้ว`;
            const notifBody = JSON.stringify({
                message: thank_message || "",
                certificate_url: cert.certificate_url,
                pdf_url: cert.pdf_url,
                certificate_code: cert.certificate_code,
                items_summary: cert.items_summary,
                project_title: donation.request_title,
                school_name: donation.school_name,
                issued_at: cert.issued_at,
            });

            await db.query(
                `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
         VALUES (?, 'certificate', ?, ?, ?, 0, NOW())`,
                [donation.donor_id, notifTitle, notifBody, donation_id]
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