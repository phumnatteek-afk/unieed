// donation.routes.js
import { Router } from "express";
import multer     from "multer";
import { auth }        from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  createDonation,
  listDonationsByProject,
  getDonationDetail,
  updateDonationStatus,
} from "./donation.controller.js";

const upload = multer({ storage: multer.memoryStorage() });
const r = Router();

// ── POST /donations/:requestId  (login optional) ──────────────────
r.post(
  "/:requestId",
  (req, _res, next) => {
    if (req.headers.authorization?.startsWith("Bearer ")) return auth(req, _res, next);
    next();
  },
  upload.single("image"),
  createDonation
);

// ── GET /donations/project/:requestId  (school_admin) ─────────────
r.get(
  "/project/:requestId",
  auth,
  requireRole(["school_admin"]),
  listDonationsByProject
);

// ── GET /donations/:donationId  (school_admin) ────────────────────
// r.get(
//   "/:donationId",
//   auth,
//   requireRole(["school_admin"]),
//   getDonationDetail
// );

// ----------------------
// ✅ แก้เป็น — ทุกคนที่ login ได้ดู (controller จัดการสิทธิ์เอง)
r.get("/:donationId", auth, getDonationDetail);
// ── PATCH /donations/:donationId/status  (school_admin) ───────────
r.patch(
  "/:donationId/status",
  auth,
  requireRole(["school_admin"]),
  updateDonationStatus
);

export default r;