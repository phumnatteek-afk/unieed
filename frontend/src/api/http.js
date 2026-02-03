const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

function getToken() {
  return localStorage.getItem("token");
}

export async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  // รองรับ backend ส่ง error แบบ {message:"..."}
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();
  else data = await res.text();

  if (!res.ok) {
    const msg = (data && data.message) ? data.message : "Request failed";
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function postJson(path, body, options = {}) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export function getJson(path, options = {}) {
  return request(path, { method: "GET", ...options });
}

export async function uploadFile(path, file, fieldName = "file", extraFields = {}) {
  const fd = new FormData();
  fd.append(fieldName, file);
  Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v));

  return request(path, { method: "POST", body: fd });
}
