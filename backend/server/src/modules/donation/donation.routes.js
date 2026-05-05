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
    const isSuspended = donor?.suspended_until && new Date(donor.suspended_until) > now;
    res.json({
      strike_count: donor?.strike_count || 0,
      suspended_until: donor?.suspended_until || null,
      is_suspended: !!isSuspended,
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
    await db.query(
      `UPDATE users SET strike_count = 0, suspended_until = NULL WHERE user_id = ?`,
      [userId]
    );
    // แจ้ง donor ว่าถูก reset แล้ว
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
       VALUES (?, 'strike_reset', 'ทีมงานได้ตรวจสอบและปลดล็อคการบริจาคของท่านแล้ว', ?, ?, 0, NOW())`,
      [userId, JSON.stringify({ message: "ท่านสามารถบริจาคผ่านช่องทางจัดส่งพัสดุและ Drop-off ได้ตามปกติ" }), userId]
    );
    res.json({ message: "reset strike เรียบร้อย" });
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
         COUNT(dr.donation_id) AS total_cases,
         JSON_ARRAYAGG(JSON_OBJECT(
           'donation_id',              dr.donation_id,
           'items_snapshot',           dr.items_snapshot,
           'items_condition_snapshot', dr.items_condition_snapshot,
           'updated_at',               dr.updated_at,
           'request_title',            req.request_title,
           'school_name',              s.school_name
         ) ORDER BY dr.updated_at ASC) AS cases
       FROM users u
       JOIN donation_record dr
         ON dr.donor_id = u.user_id AND dr.condition_status = 'wrong_item'
       JOIN donation_request req ON req.request_id = dr.request_id
       JOIN schools s ON s.school_id = req.school_id
       WHERE u.strike_count > 0
       GROUP BY u.user_id, u.user_name, u.strike_count, u.suspended_until
       ORDER BY u.strike_count DESC, u.suspended_until DESC`
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

export default r;