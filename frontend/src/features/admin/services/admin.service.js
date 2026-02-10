import { request } from "../../../api/http.js";

export function listSchools({ q = "", status = "", sort = "latest" } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (status) qs.set("status", status);
  if (sort) qs.set("sort", sort);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/admin/schools${suffix}`, { method: "GET", auth: true });
}

export function approveSchool(school_id) {
  return request(`/admin/schools/${school_id}/approve`, { method: "POST", auth: true });
}

export function removeSchool(school_id) {
  return request(`/admin/schools/${school_id}`, { method: "DELETE", auth: true });
}
export function getOverview() {
  return request("/admin/overview", { method: "GET", auth: true });
}

