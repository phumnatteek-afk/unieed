import { request } from "../../../api/http.js";

/** GET /admin/schools/:id/admins */
export function getSchoolAdmins(id) {
  return request(`/admin/schools/${id}/admins`, { method: "GET", auth: true });
}

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

/** POST /admin/schools/:id/suspend */
export function suspendSchool(id) {
  return request(`/admin/schools/${id}/suspend`, { method: "POST", auth: true });
}

/** POST /admin/schools/:id/unsuspend */
export function unsuspendSchool(id) {
  return request(`/admin/schools/${id}/unsuspend`, { method: "POST", auth: true });
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

/* ─────────────────────────── Dashboard ─────────────────────────── */

/** GET /admin/revenue?period=today|month|3months|6months|year|custom&start_date=&end_date= */
export function getRevenue({ period = "month", start_date = null, end_date = null } = {}) {
  const params = new URLSearchParams();
  params.set("period", period);
  if (start_date) params.set("start_date", start_date);
  if (end_date)   params.set("end_date", end_date);
  return request(`/admin/revenue?${params.toString()}`, { method: "GET", auth: true });
}

/** GET /admin/chart?period=today|month|3months|6months|year|custom&start_date=&end_date= */
export function getChart({ period = "month", start_date = null, end_date = null } = {}) {
  const params = new URLSearchParams();
  params.set("period", period);
  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);
  return request(`/admin/chart?${params.toString()}`, { method: "GET", auth: true });
}

/** GET /admin/pending-tasks */
export function getPendingTasks() {
  return request(`/admin/pending-tasks`, { method: "GET", auth: true });
}

/* ─────────────────────────── Orders ────────────────────────────── */

/** GET /admin/orders?status=&q=&page=&limit= */
export function listOrders({ status = "", q = "", page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return request(`/admin/orders?${params.toString()}`, { method: "GET", auth: true });
}

/** PATCH /admin/orders/:id/ship */
export function shipOrder(id) {
  return request(`/admin/orders/${id}/ship`, { method: "PATCH", auth: true });
}

/** PATCH /admin/orders/:id/cancel */
export function cancelOrder(id) {
  return request(`/admin/orders/${id}/cancel`, { method: "PATCH", auth: true });
}

/* ─────────────────────────── Payouts ───────────────────────────── */

/** GET /admin/payouts?period=&page=&limit= */
export function listPayouts({ period = "week", page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  params.set("period", period);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return request(`/admin/payouts?${params.toString()}`, { method: "GET", auth: true });
}

/** POST /admin/payouts/:seller_id/pay  body: { net_amount } */
export function paySeller(sellerId, netAmount) {
  return request(`/admin/payouts/${sellerId}/pay`, {
    method: "POST",
    body: { net_amount: netAmount },
    auth: true,
  });
}

/** GET /admin/demand-insight */
export function getDemandInsight() {
  return request("/admin/demand-insight", { method: "GET", auth: true });
}

/** GET /admin/project-status?status=open|closed */
export function listProjectStatusProjects(status = "open") {
  const params = new URLSearchParams();
  params.set("status", status);
  return request(`/admin/project-status?${params.toString()}`, { method: "GET", auth: true });
}

/** POST /admin/payouts/pay-all */
export function payAll() {
  return request(`/admin/payouts/pay-all`, { method: "POST", auth: true });
}
