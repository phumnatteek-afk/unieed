import { Router } from "express";
import multer from "multer";

import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";

import {
  createDonation,
  listDonationsByProject,
  getDonationDetail,
  updateDonationStatus,
//   verifyDonation,
} from "./donation.controller.js";

// ✅ import schedule controller เพิ่ม
import {
  getScheduleForDonor,
  getMySchedule,
  saveMySchedule,
} from "./donation_schedule.controller.js";

import { verifyAndIssueCertificate } from "../certificate/certificate.controller.js";

const upload = multer({ storage: multer.memoryStorage() });
const r = Router();

// schedule (public) — ต้องอยู่ก่อน /:donationId
r.get("/schedule/request/:requestId", getScheduleForDonor);
r.get("/schedule/mine", auth, requireRole(["school_admin"]), getMySchedule);
r.put("/schedule/mine", auth, requireRole(["school_admin"]), saveMySchedule);

// project list
r.get("/project/:requestId", auth, requireRole(["school_admin"]), listDonationsByProject);

// detail (school_admin) — ต้องอยู่ก่อน /:donationId
r.get("/detail/:donationId", auth, requireRole(["school_admin"]), getDonationDetail);

// ─── dynamic routes ────────────────────────────────────
r.post("/:requestId", (req, _res, next) => {
  if (req.headers.authorization?.startsWith("Bearer ")) return auth(req, _res, next);
  next();
}, upload.single("image"), createDonation);

r.get("/:donationId", auth, getDonationDetail);
r.patch("/:donationId/status", auth, requireRole(["school_admin"]), updateDonationStatus);
r.patch("/:donationId/verify", auth, requireRole(["school_admin"]), verifyAndIssueCertificate);

// 

export default r;