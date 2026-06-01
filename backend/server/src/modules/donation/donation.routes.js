import { Router } from "express";
import multer from "multer";

import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { db } from "../../config/db.js";
import { uploadDonationPic } from "./donation.service.js";

import {
  createDonation,
  listDonationsByProject,
  getDonationDetail,
  updateDonationStatus,
  createDonationFromOrder,   // ✅ ใหม่
  updateDonationTracking,    // ✅ ใหม่
  getMyDonationHistory,
} from "./donation.controller.js";

// ✅ import schedule controller
import {
  getScheduleForDonor,
  getMySchedule,
  saveMySchedule,
} from "./donation_schedule.controller.js";

import { verifyAndIssueCertificate } from "../certificate/certificate.controller.js";
import { sendNotification } from "../../lib/notify.js";

const upload = multer({ storage: multer.memoryStorage() });
const r = Router();

// ── schedule (public) — ต้องอยู่ก่อน /:donationId ───────────────────────────
r.get("/schedule/request/:requestId", getScheduleForDonor);
r.get("/schedule/mine", auth, requireRole(["school_admin"]), getMySchedule);
r.put("/schedule/mine",  auth, requireRole(["school_admin"]), saveMySchedule);

// ── history (donor) ─────────────────────────────────────────────────────────────
r.get("/my/history", auth, getMyDonationHistory);

// ── project list ──────────────────────────────────────────────────────────────
r.get("/project/:requestId", auth, requireRole(["school_admin"]), listDonationsByProject);

// ── detail (school_admin) — ต้องอยู่ก่อน /:donationId ───────────────────────
r.get("/detail/:donationId", auth, requireRole(["school_admin"]), getDonationDetail);

// ── ✅ ซื้อเพื่อบริจาค: POST /donations/from-order ───────────────────────────
// ต้อง register ก่อน dynamic route "/:requestId" กัน conflict
r.post("/from-order", auth, createDonationFromOrder);

// ── ✅ ผู้บริจาคแก้ไขชื่อบน PaymentSuccessPage ───────────────────────────────
r.patch("/:donationId/donor-name", auth, async (req, res, next) => {
  try {
    const { donor_name } = req.body;
    if (!donor_name?.trim())
      return res.status(400).json({ message: "กรุณากรอกชื่อ" });

    const [rows] = await db.query(
      "SELECT donor_id FROM donation_record WHERE donation_id = ? LIMIT 1",
      [req.params.donationId]
    );
    if (!rows[0])
      return res.status(404).json({ message: "ไม่พบรายการบริจาค" });
    if (rows[0].donor_id && rows[0].donor_id !== req.user.user_id)
      return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไข" });

    await db.query(
      "UPDATE donation_record SET donor_name = ? WHERE donation_id = ?",
      [donor_name.trim(), req.params.donationId]
    );
    res.json({ message: "อัปเดตชื่อเรียบร้อย" });
  } catch (err) { next(err); }
});

// ── ✅ ร้านค้าอัปเดตเลขพัสดุ: PATCH /donations/:id/tracking ─────────────────
r.patch("/:donationId/tracking", auth, updateDonationTracking);

// ── ✅ ผู้บริจาคเปลี่ยนรูปหลักฐาน: PATCH /donations/:id/pic ─────────────────
r.patch("/:donationId/pic", auth, upload.single("image"), async (req, res, next) => {
  try {
    const { donationId } = req.params;
    const [rows] = await db.query(
      "SELECT donor_id, status, donation_pic_public_id FROM donation_record WHERE donation_id = ? LIMIT 1",
      [donationId]
    );
    if (!rows[0]) return res.status(404).json({ message: "ไม่พบรายการบริจาค" });
    if (rows[0].donor_id !== req.user.user_id)
      return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไข" });
    if (rows[0].status !== "pending")
      return res.status(400).json({ message: "ไม่สามารถแก้ไขได้ในสถานะนี้" });
    if (!req.file) return res.status(400).json({ message: "กรุณาเลือกรูปภาพ" });

    const uploaded = await uploadDonationPic(req.file.buffer, donationId);

    await db.query(
      "UPDATE donation_record SET donation_pic = ?, donation_pic_public_id = ? WHERE donation_id = ?",
      [uploaded.url, uploaded.public_id, donationId]
    );
    res.json({ message: "อัปโหลดรูปเรียบร้อย", donation_pic: uploaded.url });
  } catch (err) { next(err); }
});

// ── ✅ ผู้บริจาคยกเลิกรายการ: PATCH /donations/:id/cancel ────────────────────
r.patch("/:donationId/cancel", auth, async (req, res, next) => {
  try {
    const { donationId } = req.params;
    const [rows] = await db.query(
      "SELECT donor_id, status, tracking_number FROM donation_record WHERE donation_id = ? LIMIT 1",
      [donationId]
    );
    if (!rows[0]) return res.status(404).json({ message: "ไม่พบรายการบริจาค" });
    if (rows[0].donor_id !== req.user.user_id)
      return res.status(403).json({ message: "ไม่มีสิทธิ์ยกเลิก" });
    if (rows[0].tracking_number)
      return res.status(400).json({ message: "ไม่สามารถยกเลิกได้ เนื่องจากมีการจัดส่งพัสดุแล้ว หากมีปัญหากรุณาติดต่อทีมงาน" });
    if (rows[0].status !== "pending")
      return res.status(400).json({ message: "ไม่สามารถยกเลิกได้ในสถานะนี้" });
    await db.query(
      "UPDATE donation_record SET status = 'cancelled' WHERE donation_id = ?",
      [donationId]
    );
    res.json({ message: "ยกเลิกรายการเรียบร้อย" });
  } catch (err) { next(err); }
});

// ── Donor ดูสถานะ suspend ของตัวเอง ──────────────────────────────────────────
r.get("/my-suspension", auth, async (req, res, next) => {
  try {
    const [[donor]] = await db.query(
      `SELECT strike_count, suspended_until FROM users WHERE user_id = ?`,
      [req.user.user_id]
    );
    const now = new Date();

    // ถ้า strike_count >= 3 แต่ suspended_until ยังไม่ได้ set (เช่น crash ก่อนหน้า)
    // ให้ apply suspension ตอนนี้เลย
    if (donor?.strike_count >= 3 && !donor.suspended_until) {
      await db.query(
        `UPDATE users SET suspended_until = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE user_id = ?`,
        [req.user.user_id]
      );
      const [[updated]] = await db.query(
        `SELECT suspended_until FROM users WHERE user_id = ?`,
        [req.user.user_id]
      );
      donor.suspended_until = updated?.suspended_until;
    }

    const isSuspended = donor?.suspended_until && new Date(donor.suspended_until) > now && donor.strike_count >= 3;
    // pending = admin ยังไม่ได้อ่าน (is_read = 0) — เมื่อ admin เปิดดูจะ mark read = processed
    const [[appealRow]] = await db.query(
      `SELECT body FROM notifications
       WHERE ref_id = ? AND type = 'strike_appeal' AND is_read = 0
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.user_id]
    );
    let appealReason = null;
    if (appealRow?.body) {
      try { appealReason = JSON.parse(appealRow.body)?.reason || null; } catch (_) {}
    }

    const [caseRows] = await db.query(
      `SELECT dr.donation_id,
              s.school_name,
              dr.items_snapshot,
              dr.items_condition_snapshot,
              DATE_FORMAT(dr.updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updated_at
       FROM donation_record dr
       LEFT JOIN donation_request req ON req.request_id = dr.request_id
       LEFT JOIN schools s ON s.school_id = req.school_id
       WHERE dr.donor_id = ? AND dr.strike_issued = 1
       ORDER BY dr.updated_at ASC`,
      [req.user.user_id]
    );
    const wrong_item_cases = caseRows.map((c, i) => {
      let wrongItems = [];
      try {
        const condSnap = typeof c.items_condition_snapshot === "string"
          ? JSON.parse(c.items_condition_snapshot) : (c.items_condition_snapshot || []);
        const itemSnap = typeof c.items_snapshot === "string"
          ? JSON.parse(c.items_snapshot) : (c.items_snapshot || []);
        const condMap = {};
        for (const x of condSnap) condMap[x.uniform_type_id] = x.item_condition;
        wrongItems = itemSnap
          .filter(it => condMap[it.uniform_type_id] === "wrong_item")
          .map(it => it.item_name || it.name || "รายการไม่ระบุ");
      } catch (_) {}
      return {
        round:        i + 1,
        school_name:  c.school_name || "ไม่ระบุโรงเรียน",
        wrong_items:  wrongItems,
        updated_at:   c.updated_at,
      };
    });

    res.json({
      strike_count:       donor?.strike_count || 0,
      suspended_until:    donor?.suspended_until || null,
      is_suspended:       !!isSuspended,
      has_pending_appeal: !!appealRow,
      appeal_reason:      appealReason,
      wrong_item_cases,
    });
  } catch (err) { next(err); }
});

// ── Donor appeal strike ───────────────────────────────────────────────────────
r.post("/appeal-strike", auth, async (req, res, next) => {
  try {
    const user_id = req.user.user_id;
    const { reason } = req.body;
    const [[donor]] = await db.query(
      `SELECT strike_count, suspended_until FROM users WHERE user_id = ?`,
      [user_id]
    );
    if (!donor) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    if (!donor.suspended_until || new Date(donor.suspended_until) < new Date())
      return res.status(400).json({ message: "ไม่ได้ถูกระงับการบริจาค" });

    const [admins] = await db.query(`SELECT user_id FROM users WHERE role = 'admin'`);
    const [[user]] = await db.query(`SELECT user_name FROM users WHERE user_id = ?`, [user_id]);
    for (const admin of admins) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
         VALUES (?, 'strike_appeal', ?, ?, ?, 0, NOW())`,
        [
          admin.user_id,
          `${user?.user_name || "ผู้บริจาค"} ขอ appeal การระงับบัญชี`,
          JSON.stringify({ donor_id: user_id, donor_name: user?.user_name, strike_count: donor.strike_count, suspended_until: donor.suspended_until, reason: reason || "" }),
          user_id,
        ]
      );
    }
    res.json({ message: "ส่งคำร้องเรียบร้อย ทีมงานจะตรวจสอบและติดต่อกลับ" });
  } catch (err) { next(err); }
});

// ── Admin reset strike ────────────────────────────────────────────────────────
r.patch("/users/:userId/reset-strike", auth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const { userId } = req.params;

    // ดึงสถานะก่อน reset เพื่อเลือก message ที่เหมาะสม
    const [[before]] = await db.query(
      `SELECT strike_count, suspended_until FROM users WHERE user_id = ?`,
      [userId]
    );
    const wasSuspended = before?.suspended_until && new Date(before.suspended_until) > new Date();
    const [[adminUser]] = await db.query(`SELECT user_name FROM users WHERE user_id = ?`, [req.user.user_id]);
    const adminName = adminUser?.user_name || "-";

    // ดึง active cases ก่อน reset เพื่อเก็บประวัติ
    const [activeCases] = await db.query(
      `SELECT dr.donation_id, dr.items_snapshot, dr.items_condition_snapshot,
              req.request_title, s.school_name
       FROM donation_record dr
       LEFT JOIN donation_request req ON req.request_id = dr.request_id
       LEFT JOIN schools s ON s.school_id = req.school_id
       WHERE dr.donor_id = ? AND dr.strike_issued = 1`,
      [userId]
    );
    const casesSummary = activeCases.map(c => ({
      school_name:   c.school_name   || null,
      request_title: c.request_title || null,
    }));

    await db.query(
      `UPDATE users SET strike_count = 0, suspended_until = NULL, strike_reset_count = strike_reset_count + 1 WHERE user_id = ?`,
      [userId]
    );
    await db.query(
      `UPDATE donation_record SET strike_issued = 0 WHERE donor_id = ? AND strike_issued = 1`,
      [userId]
    );
    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE ref_id = ? AND type = 'strike_appeal' AND is_read = 0`,
      [userId]
    );

    const title   = wasSuspended
      ? "ทีมงานได้ตรวจสอบและปลดล็อคการบริจาคของท่านแล้ว"
      : "ทีมงานได้ล้างประวัติคำเตือนของท่านแล้ว";
    const message = wasSuspended
      ? "ท่านสามารถบริจาคผ่านช่องทางจัดส่งพัสดุและ Drop-off ได้ตามปกติ"
      : "ประวัติคำเตือนของท่านถูกรีเซ็ตเป็น 0 แล้ว ท่านสามารถบริจาคได้ตามปกติ";

    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
       VALUES (?, 'strike_reset', ?, ?, ?, 0, NOW())`,
      [userId, title, JSON.stringify({
        message,
        reset_by_admin_id:   req.user.user_id,
        reset_by_admin_name: adminName,
        previous_strike:     before?.strike_count ?? 0,
        was_suspended:       wasSuspended,
        donor_id:            Number(userId),
        action:              "full_reset",
        cases_summary:       casesSummary,
      }), userId]
    );
    res.json({ message: "reset เรียบร้อย" });
  } catch (err) { next(err); }
});

// ── Admin: ประวัติการปลดระงับบัญชีทั้งหมด ──────────────────────────────────────
r.get("/wrong-items/reset-history", auth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT n.notification_id, n.user_id AS donor_id, u.user_name AS donor_name,
              n.body, n.created_at
       FROM notifications n
       LEFT JOIN users u ON u.user_id = n.user_id
       WHERE n.type = 'strike_reset'
       ORDER BY n.created_at DESC
       LIMIT 200`
    );
    const result = rows.map(r => {
      let body = {};
      try { body = typeof r.body === "string" ? JSON.parse(r.body) : r.body; } catch { /* noop */ }
      return {
        notification_id:     r.notification_id,
        donor_id:            r.donor_id,
        donor_name:          r.donor_name,
        reset_by_admin_name: body.reset_by_admin_name || null,
        previous_strike:     body.previous_strike ?? null,
        was_suspended:       !!body.was_suspended,
        request_title:       body.request_title  || null,
        school_name:         body.school_name    || null,
        action:              body.action         || "full_reset",
        wrong_items:         body.wrong_items    || [],
        cases_summary:       body.cases_summary  || [],
        created_at:          r.created_at,
      };
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ── Admin: ยกเว้น strike รายการเดียว ─────────────────────────────────────────
r.patch("/:donationId/remove-strike", auth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const { donationId } = req.params;

    const [[dr]] = await db.query(
      `SELECT dr.donation_id, dr.donor_id, dr.strike_issued,
              dr.items_snapshot, dr.items_condition_snapshot,
              req.request_title, s.school_name
       FROM donation_record dr
       LEFT JOIN donation_request req ON req.request_id = dr.request_id
       LEFT JOIN schools s ON s.school_id = req.school_id
       WHERE dr.donation_id = ? LIMIT 1`,
      [donationId]
    );
    if (!dr)              return res.status(404).json({ message: "ไม่พบรายการ" });
    if (!dr.strike_issued) return res.status(400).json({ message: "รายการนี้ยังไม่ได้ออก strike" });
    if (!dr.donor_id)     return res.status(400).json({ message: "ไม่มีข้อมูลผู้บริจาค" });

    await db.query(
      `UPDATE donation_record SET strike_issued = 0 WHERE donation_id = ?`, [donationId]
    );
    await db.query(
      `UPDATE users SET strike_count = GREATEST(strike_count - 1, 0) WHERE user_id = ?`,
      [dr.donor_id]
    );
    const [[donor]] = await db.query(
      `SELECT strike_count, suspended_until FROM users WHERE user_id = ?`, [dr.donor_id]
    );
    if (donor.strike_count < 3 && donor.suspended_until) {
      await db.query(`UPDATE users SET suspended_until = NULL WHERE user_id = ?`, [dr.donor_id]);
    }
    const [[adminUser2]] = await db.query(`SELECT user_name FROM users WHERE user_id = ?`, [req.user.user_id]);
    const adminName = adminUser2?.user_name || "-";

    // สรุป wrong items จาก snapshot
    let wrongItemsSummary = [];
    try {
      const snap = typeof dr.items_snapshot === "string" ? JSON.parse(dr.items_snapshot) : (dr.items_snapshot || []);
      const condSnap = typeof dr.items_condition_snapshot === "string" ? JSON.parse(dr.items_condition_snapshot) : (dr.items_condition_snapshot || []);
      const condMap = {};
      for (const c of condSnap) {
        const k = `${c.uniform_type_id}__${JSON.stringify(c.size ?? "")}`;
        condMap[k] = c;
      }
      wrongItemsSummary = snap
        .filter(it => {
          const k = `${it.uniform_type_id}__${JSON.stringify(it.size ?? "")}`;
          return (condMap[k]?.item_condition || "usable") === "wrong_item";
        })
        .map(it => {
          const k = `${it.uniform_type_id}__${JSON.stringify(it.size ?? "")}`;
          const cond = condMap[k];
          const base = String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim();
          let sizeSuffix = "";
          try {
            const s = typeof it.size === "string" ? JSON.parse(it.size) : it.size;
            if (s?.chest) sizeSuffix = ` (อก ${s.chest}")`;
            else if (s?.waist) sizeSuffix = ` (เอว ${s.waist}")`;
          } catch { /* noop */ }
          return { name: `${base}${sizeSuffix}`, reason: cond?.reason || null, note: cond?.note || null };
        });
    } catch { /* noop */ }

    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
       VALUES (?, 'strike_reset', ?, ?, ?, 0, NOW())`,
      [
        dr.donor_id,
        "ทีมงานได้ยกเว้นคำเตือนจากรายการบริจาคของท่าน",
        JSON.stringify({
          message: `ทีมงานตรวจสอบและยกเว้นคำเตือนจากโครงการ "${dr.request_title}" ของ ${dr.school_name} คำเตือนปัจจุบันของท่านคือ ${donor.strike_count}/3`,
          reset_by_admin_id:   req.user.user_id,
          reset_by_admin_name: adminName,
          previous_strike:     donor.strike_count + 1,
          was_suspended:       false,
          donor_id:            dr.donor_id,
          action:              "remove_single",
          request_title:       dr.request_title  || null,
          school_name:         dr.school_name    || null,
          donation_id:         dr.donation_id,
          wrong_items:         wrongItemsSummary,
        }),
        donationId,
      ]
    );

    res.json({ message: "ยกเว้นคำเตือนเรียบร้อย", strike_count: donor.strike_count });
  } catch (err) { next(err); }
});

// ── Admin: รายการบริจาคที่โรงเรียนแจ้งว่ารายการไม่ตรง ────────────────────────
r.get("/wrong-items", auth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT
         u.user_id AS donor_id,
         u.user_name AS donor_name,
         u.strike_count,
         u.suspended_until,
         u.strike_reset_count,
         EXISTS(
           SELECT 1 FROM notifications n
           WHERE n.ref_id = u.user_id
             AND n.type = 'strike_appeal'
             AND n.is_read = 0
         ) AS has_pending_appeal,
         (SELECT n.body FROM notifications n
           WHERE n.ref_id = u.user_id
             AND n.type = 'strike_appeal'
             AND n.is_read = 0
           ORDER BY n.created_at DESC LIMIT 1
         ) AS appeal_body,
         COUNT(dr.donation_id) AS total_cases,
         JSON_ARRAYAGG(
           CASE WHEN dr.donation_id IS NOT NULL
           THEN JSON_OBJECT(
             'donation_id',              dr.donation_id,
             'condition_status',         dr.condition_status,
             'items_snapshot',           dr.items_snapshot,
             'items_condition_snapshot', dr.items_condition_snapshot,
             'donation_pic',             dr.donation_pic,
             'shipping_carrier',         dr.shipping_carrier,
             'tracking_number',          dr.tracking_number,
             'delivery_method',          dr.delivery_method,
             'donor_phone',              dr.donor_phone,
             'updated_at',               dr.updated_at,
             'request_title',            req.request_title,
             'school_name',              s.school_name,
             'clarification_text',       dr.clarification_text,
             'clarified_at',             dr.clarified_at,
             'strike_issued',            dr.strike_issued
           )
           ELSE NULL END
         ) AS cases
       FROM users u
       LEFT JOIN donation_record dr
         ON dr.donor_id = u.user_id AND dr.strike_issued = 1
       LEFT JOIN donation_request req ON req.request_id = dr.request_id
       LEFT JOIN schools s ON s.school_id = req.school_id
       WHERE u.strike_count > 0
       GROUP BY u.user_id, u.user_name, u.strike_count, u.suspended_until, u.strike_reset_count
       ORDER BY has_pending_appeal DESC, u.strike_count DESC, u.suspended_until DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── dynamic routes (ต้องอยู่ท้ายสุด) ─────────────────────────────────────────
r.post("/:requestId", (req, _res, next) => {
  if (req.headers.authorization?.startsWith("Bearer ")) return auth(req, _res, next);
  next();
}, upload.single("image"), createDonation);

r.get("/:donationId",  auth, getDonationDetail);
r.patch("/:donationId/status", auth, requireRole(["school_admin", "admin"]), updateDonationStatus);
r.patch("/:donationId/verify", auth, requireRole(["school_admin", "admin"]), verifyAndIssueCertificate);

// POST /donations/:donationId/clarify — donor ชี้แจงรายการไม่ตรง
r.post("/:donationId/clarify", auth, async (req, res, next) => {
  try {
    const donationId = Number(req.params.donationId);
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "กรุณาระบุข้อความชี้แจง" });

    const [[dr]] = await db.query(
      `SELECT donor_id, donor_name, condition_status, clarified_at FROM donation_record WHERE donation_id = ?`,
      [donationId]
    );
    if (!dr) return res.status(404).json({ message: "ไม่พบรายการบริจาค" });
    if (dr.donor_id && dr.donor_id !== req.user.user_id)
      return res.status(403).json({ message: "ไม่มีสิทธิ์" });
    if (dr.clarified_at)
      return res.status(400).json({ message: "ชี้แจงไปแล้ว" });

    await db.query(
      `UPDATE donation_record SET clarification_text = ?, clarified_at = NOW() WHERE donation_id = ?`,
      [text.trim(), donationId]
    );

    // แจ้ง admin ทุกคน
    const [[donorUser]] = await db.query(`SELECT user_name FROM users WHERE user_id = ?`, [dr.donor_id]);
    const [admins] = await db.query(`SELECT user_id FROM users WHERE role = 'admin'`);
    await Promise.all(admins.map(admin =>
      sendNotification(admin.user_id, {
        type:   "donation_clarify",
        title:  `${donorUser?.user_name || dr.donor_name || "ผู้บริจาค"} ชี้แจงรายการไม่ตรง`,
        body:   { message: text.trim(), donation_id: donationId, donor_name: dr.donor_name, user_name: donorUser?.user_name },
        ref_id: donationId,
      })
    ));

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default r;