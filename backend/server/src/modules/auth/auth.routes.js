import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import {
  registerGeneral,
  registerSchoolOneStep,
  login,
  mySchoolStatus,
  requestOtp,
  verifyOtp,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  googleLogin,
} from "./auth.controller.js";

const r = Router();

// ─── Register ────────────────────────────────────────────────
r.post("/register/general", registerGeneral);
r.post("/register/school", registerSchoolOneStep);

// ─── Login ───────────────────────────────────────────────────
r.post("/login", login);
r.post("/login/google", googleLogin);            // ✅ Google OAuth

// ─── Email Verification ──────────────────────────────────────
r.get("/verify-email", verifyEmail);             // ?token=xxx
r.post("/resend-verification", resendVerification);

// ─── Password Reset ──────────────────────────────────────────
r.post("/forgot-password", forgotPassword);
r.post("/reset-password", resetPassword);

// ─── School ──────────────────────────────────────────────────
r.get("/school/status", auth, mySchoolStatus);

// ─── OTP ─────────────────────────────────────────────────────
r.post("/otp/request", requestOtp);
r.post("/otp/verify", verifyOtp);

export default r;
