// frontend/src/features/ai/services/ai.service.js
import { postJson } from "../../../api/http.js";

/**
 * ส่งรูปภาพ (base64) ไปวิเคราะห์กับ Gemini
 * @param {string} base64   - base64 ของรูปภาพ (ไม่รวม data URL prefix)
 * @param {string} mimeType - เช่น "image/jpeg"
 */
export async function analyzeUniform(base64, mimeType = "image/jpeg") {
  return postJson("/api/ai/analyze", { image: base64, mimeType }, false);
}

/**
 * แมชชุดที่วิเคราะห์แล้วกับโครงการที่เปิดรับอยู่
 * @param {Array} uniforms - array ของผลลัพธ์จาก analyzeUniform
 */
export async function matchProjects(uniforms) {
  return postJson("/api/ai/match", { uniforms }, false);
}

/**
 * แปลงไฟล์รูปภาพเป็น base64 string
 * @param {File} file
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result = "data:image/jpeg;base64,XXXX..."
      const full = reader.result;
      const comma = full.indexOf(",");
      const base64 = comma >= 0 ? full.slice(comma + 1) : full;
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
