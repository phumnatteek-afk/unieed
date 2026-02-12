import { Router } from "express";
import multer from "multer";
import { auth } from "../../middleware/auth.js";
import { uploadImage, uploadSchoolDoc } from "./upload.controller.js";

const r = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ ของเดิม (ถ้าคุณใช้กับหน้าอื่น และอยากให้ต้อง login ก็เก็บ auth ไว้)
r.post("/image", auth, upload.single("file"), uploadImage);

// ✅ ใหม่สำหรับสมัครโรงเรียน: ไม่ต้อง auth
r.post("/school-doc", upload.single("file"), uploadSchoolDoc);

export default r;
