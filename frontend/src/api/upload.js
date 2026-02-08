import { request } from "./http.js";

export async function uploadImage({ file, type }) {
  const fd = new FormData();
  fd.append("file", file);

  // type: "product" | "project" | "school_doc"
  return request(`/upload/image?type=${encodeURIComponent(type)}`, {
    method: "POST",
    body: fd,
    auth: true,
    isFormData: true,
  });
  // return { url, public_id, folder }
}
