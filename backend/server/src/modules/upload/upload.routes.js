import { Router } from "express";
import multer from "multer";
import { auth } from "../../middleware/auth.js";
import { uploadImage } from "./upload.controller.js";

const r = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ใส่ auth ได้ (แนะนำ) กันคนทั่วไปยิงมั่ว
r.post("/image", auth, upload.single("file"), uploadImage);

export default r;