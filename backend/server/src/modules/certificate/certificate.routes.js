// certificate.routes.js
import { Router } from "express";
import { auth }   from "../../middleware/auth.js";
import {
  generateCertificate,
  getCertificate,
  getMyCertificates,
  reissueCert,
} from "./certificate.controller.js";

const r = Router();

// POST /certificates/generate
// optional auth — login หรือไม่ login ก็ generate ได้
r.post(
  "/generate",
  (req, _res, next) => {
    if (req.headers.authorization?.startsWith("Bearer ")) return auth(req, _res, next);
    next();
  },
  generateCertificate
);

// GET /certificates/my — ใบเซอร์ทั้งหมดของ user ← เพิ่ม
r.get("/my", auth, getMyCertificates);

// GET /certificates/donation/:donationId
// ดึงใบเซอร์ที่มีอยู่แล้ว
r.get("/donation/:donationId", getCertificate);

// POST /certificates/reissue/:donationId — admin/school reissue cert ที่หาย
r.post("/reissue/:donationId", auth, reissueCert);

export default r;