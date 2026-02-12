import { request } from "./http.js";

const BASE_URL = "http://localhost:3000";

export async function uploadImage({ file, type }) {
  const fd = new FormData();
  fd.append("file", file);

  // ของเดิม: ใช้กับ product/project/อื่นๆ (ต้อง auth)
  return request(`/upload/image?type=${encodeURIComponent(type)}`, {
    method: "POST",
    body: fd,
    auth: true,
    isFormData: true,
  });
}

// ✅ ใหม่: ใช้กับเอกสารยืนยันโรงเรียน (ไม่ต้อง auth)
export async function uploadSchoolDoc(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${BASE_URL}/upload/school-doc`, {
    method: "POST",
    body: fd,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

  if (!res.ok) {
    const err = new Error(data?.message || "Upload failed");
    err.data = data;
    err.status = res.status;
    throw err;
  }

  return data; 
}
