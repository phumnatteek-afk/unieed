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

// ─────────────────────────────────────────
// 🟢 CREATE DONATION
// POST /donations/:requestId
// ─────────────────────────────────────────
r.post(
  "/:requestId",
  (req, _res, next) => {
    if (req.headers.authorization?.startsWith("Bearer ")) {
      return auth(req, _res, next);
    }
    next();
  },
  upload.single("image"),
  createDonation
);

// ─────────────────────────────────────────
// 🟢 LIST DONATIONS (school_admin)
// GET /donations/project/:requestId
// ─────────────────────────────────────────
r.get(
  "/project/:requestId",
  auth,
  requireRole(["school_admin"]),
  listDonationsByProject
);

// ─────────────────────────────────────────
// 🟢 GET DONATION DETAIL (login required)
// GET /donations/:donationId
// ─────────────────────────────────────────
r.get("/:donationId", auth, getDonationDetail);

// ─────────────────────────────────────────
// 🟢 UPDATE STATUS (school_admin)
// PATCH /donations/:donationId/status
// ─────────────────────────────────────────
r.patch(
  "/:donationId/status",
  auth,
  requireRole(["school_admin"]),
  updateDonationStatus
);

// 🟢 VERIFY DONATION (school_admin)
// PATCH /donations/:donationId/verify
// ─────────────────────────────────────────
r.patch(
  "/:donationId/verify",
  auth,
  requireRole(["school_admin"]),
  verifyAndIssueCertificate 
);


// public
// GET /donations/schedule/request/:requestId
r.get("/schedule/request/:requestId", getScheduleForDonor);

// school_admin
// GET /donations/schedule/mine
r.get(
  "/schedule/mine",
  auth,
  requireRole(["school_admin"]),
  getMySchedule
);

// PUT /donations/schedule/mine
r.put(
  "/schedule/mine",
  auth,
  requireRole(["school_admin"]),
  saveMySchedule
);

// 

export default r;