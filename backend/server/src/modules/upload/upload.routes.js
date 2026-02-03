import { Router } from "express";
import multer from "multer";
import { uploadSchoolDoc } from "./upload.controller.js";

const r = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ สมัครโรงเรียนยังไม่ login ได้ -> ไม่ต้อง auth
r.post("/school-doc", upload.single("file"), uploadSchoolDoc);

export default r;
