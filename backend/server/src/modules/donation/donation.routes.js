import { Router } from "express";
import multer from "multer";

import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { db } from "../../config/db.js";

import {
  createDonation,
  listDonationsByProject,
  getDonationDetail,
  updateDonationStatus,
  createDonationFromOrder,   // ✅ ใหม่
  updateDonationTracking,    // ✅ ใหม่
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

// ── dynamic routes (ต้องอยู่ท้ายสุด) ─────────────────────────────────────────
r.post("/:requestId", (req, _res, next) => {
  if (req.headers.authorization?.startsWith("Bearer ")) return auth(req, _res, next);
  next();
}, upload.single("image"), createDonation);

r.get("/:donationId",  auth, getDonationDetail);
r.patch("/:donationId/status", auth, requireRole(["school_admin"]), updateDonationStatus);
r.patch("/:donationId/verify", auth, requireRole(["school_admin"]), verifyAndIssueCertificate);

export default r;