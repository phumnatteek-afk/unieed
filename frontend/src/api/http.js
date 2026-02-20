
const BASE_URL = "http://localhost:3000";

export async function request(path, options = {}) {
  const { method = "GET", body, auth = true, headers: extraHeaders = {} } = options;
  const headers = { ...extraHeaders };

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { message: text }; }

  if (!res.ok) {
    const err = new Error(data?.message || "Request failed");
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export function getJson(path, auth = true) {
  return request(path, { method: "GET", auth });
}

export function postJson(path, body, auth = true) {
  return request(path, { method: "POST", body, auth });
}
