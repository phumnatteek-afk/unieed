import { request } from "./http.js";


export async function uploadImage({ file, type }) {
  const fd = new FormData();
  fd.append("file", file);

  return request(`/upload/image?type=${encodeURIComponent(type)}`, {
    method: "POST",
    body: fd,
    auth: true,
  });
}

// ✅ เอกสารยืนยันโรงเรียน (ไม่ต้อง auth)
export async function uploadSchoolDoc(file) {
  const fd = new FormData();
  fd.append("file", file);

  return request("/upload/school-doc", {
    method: "POST",
    body: fd,
    auth: false,
  });
}

// ✅ โลโก้โรงเรียน (ไม่ต้อง auth ตอนสมัคร)
export async function uploadSchoolLogo(file) {
  const fd = new FormData();
  fd.append("file", file);

  return request("/upload/school-logo", {
    method: "POST",
    body: fd,
    auth: false,
  });
}