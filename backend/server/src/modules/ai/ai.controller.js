// ai.controller.js — handles /api/ai/analyze and /api/ai/match
import { analyzeUniform, matchProjects, buildMatchMatrix } from "./ai.service.js";

// ── POST /api/ai/analyze ──────────────────────────────────────────────────────
// Body: { image: "<base64>", mimeType?: "image/jpeg" | "image/png" | "image/webp" }
export async function analyzeUniformHandler(req, res, next) {
  try {
    const { image, mimeType = "image/jpeg" } = req.body;

    if (!image) {
      return res.status(400).json({ message: "กรุณาส่งรูปภาพ (base64) ใน field 'image'" });
    }

    // Strip data-URL prefix if present (data:image/jpeg;base64,XXXX)
    const base64 = image.replace(/^data:[^;]+;base64,/, "");

    const result = await analyzeUniform(base64, mimeType);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/ai/match ────────────────────────────────────────────────────────
// Body: { uniforms: [ { uniform_type, type_name, gender, condition, measurements, level, ... } ] }
// Returns: { matchResults, matrix, projects, bundles }
export async function matchProjectsHandler(req, res, next) {
  try {
    const { uniforms } = req.body;

    if (!Array.isArray(uniforms) || uniforms.length === 0) {
      return res.status(400).json({ message: "กรุณาส่งข้อมูลชุดอย่างน้อย 1 รายการ" });
    }

    const matchResults = await matchProjects(uniforms);
    const { matrix, projects, bundles } = buildMatchMatrix(matchResults);

    res.json({ matchResults, matrix, projects, bundles });
  } catch (err) {
    next(err);
  }
}
