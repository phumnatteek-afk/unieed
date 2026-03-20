// certificate.routes.js
import { Router } from "express";
import { auth }   from "../../middleware/auth.js";
import {
  generateCertificate,
  getCertificate,
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

// GET /certificates/donation/:donationId
// ดึงใบเซอร์ที่มีอยู่แล้ว
r.get("/donation/:donationId", getCertificate);

export default r;