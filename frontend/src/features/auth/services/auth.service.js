import { request } from "../../../api/http.js";

// ── มีอยู่แล้ว ────────────────────────────────────────────
export function registerGeneral(payload) {
  return request("/auth/register/general", { method: "POST", body: payload, auth: false });
}

export function registerSchoolOneStep(payload) {
  return request("/auth/register/school", { method: "POST", body: payload, auth: false });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", body: payload, auth: false });
}

// ── เพิ่มใหม่ ─────────────────────────────────────────────

// Google Login
export function googleLogin(payload) {
  return request("/auth/login/google", { method: "POST", body: payload, auth: false });
}

// Email Verification
export function verifyEmail(token) {
  const t = typeof token === "object" ? token?.token : token;
  return request(`/auth/verify-email?token=${encodeURIComponent(t)}`, { method: "GET", auth: false });
}

export function resendVerification(payload) {
  return request("/auth/resend-verification", { method: "POST", body: payload, auth: false });
}

// Password Reset
export function forgotPassword(payload) {
  return request("/auth/forgot-password", { method: "POST", body: payload, auth: false });
}

export function resetPassword(payload) {
  return request("/auth/reset-password", { method: "POST", body: payload, auth: false });
}
