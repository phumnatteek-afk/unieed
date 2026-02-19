const BASE_URL = "http://localhost:3000";

export async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    headers: extraHeaders = {},
  } = options;

  const headers = { ...extraHeaders };

  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // กันกรณี backend ไม่ได้ส่ง json
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

  if (!res.ok) {
    const err = new Error(data?.message || "Request failed");
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ✅ เพื่อไม่ให้ไฟล์อื่นพัง (ที่เคย import getJson/postJson)
export function getJson(path, auth = true) {
  return request(path, { method: "GET", auth });
}

export function postJson(path, body, auth = true) {
  return request(path, { method: "POST", body, auth });
}

export function getOverview() {
  return request("/admin/overview", { method: "GET", auth: true });
}

const uploadImage = async (file) => {
  const fd = new FormData();
  fd.append("image", file);

  setUploading(true);
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`http://localhost:3000/school/projects/${id}/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Upload failed");

    setImage(data.url); // ✅ เอา url จาก backend มาใส่ preview ทันที
  } finally {
    setUploading(false);
  }
};
