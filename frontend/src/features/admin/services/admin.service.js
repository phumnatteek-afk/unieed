import { request } from "../../../api/http.js";

/** GET /admin/schools?q=&status=&sort= */
export function listSchools({ q = "", status = "", sort = "latest" } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);

  const qs = params.toString();
  return request(`/admin/schools${qs ? `?${qs}` : ""}`, { method: "GET", auth: true });
}

/** POST /admin/schools/:id/approve */
export function approveSchool(id) {
  return request(`/admin/schools/${id}/approve`, { method: "POST", auth: true });
}

/** POST /admin/schools/:id/reject */
export function rejectSchool(id, note) {
  return request(`/admin/schools/${id}/reject`, {
    method: "POST",
    body: { note },
    auth: true,
  });
}

/** DELETE /admin/schools/:id */
export function removeSchool(id) {
  return request(`/admin/schools/${id}`, { method: "DELETE", auth: true });
}

/** GET /admin/overview */
export function getOverview() {
  return request("/admin/overview", { method: "GET", auth: true });
}

/** GET /admin/schools/:id */
export function getSchoolDetail(id) {
  return request(`/admin/schools/${id}`, { method: "GET", auth: true });
}

/** PUT /admin/schools/:id */
export function updateSchool(id, payload) {
  return request(`/admin/schools/${id}`, {
    method: "PUT",
    body: payload,
    auth: true,
  });
}

export function updateSchoolAdmin(id, payload) {
  return request(`/admin/schools/${id}`, {
    method: "PATCH",
    body: payload,
    auth: true,
  });
}

