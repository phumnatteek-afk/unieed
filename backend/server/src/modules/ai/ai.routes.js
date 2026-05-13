// ai.routes.js
import { Router } from "express";
import { analyzeUniformHandler, matchProjectsHandler } from "./ai.controller.js";

const r = Router();

// POST /api/ai/analyze  — ส่ง base64 รูปภาพ → รับผลวิเคราะห์จาก Gemini
r.post("/analyze", analyzeUniformHandler);

// POST /api/ai/match   — ส่ง array ของผลวิเคราะห์ → รับรายการโครงการที่แมช
r.post("/match", matchProjectsHandler);

export default r;
