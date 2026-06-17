import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import {
  registerGeneral,
  registerSchoolOneStep,
  login,
  mySchoolStatus,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  googleLogin,
  updateProfile,
  getSchoolAdmins,
  addSchoolAdmin,
  removeSchoolAdmin,
  setSchoolAdminPrimary,
  inviteSchoolAdmin,
  acceptSchoolAdminInvite,
  checkInviteToken,
} from "./auth.controller.js";

const r = Router();

// ─── Register ────────────────────────────────────────────────
r.post("/register/general", registerGeneral);
r.post("/register/school", registerSchoolOneStep);

// ─── Login ───────────────────────────────────────────────────
r.post("/login", login);
r.post("/login/google", googleLogin);

// ─── Email Verification ──────────────────────────────────────
r.get("/verify-email", verifyEmail);
r.post("/resend-verification", resendVerification);

// ─── Password Reset ──────────────────────────────────────────
r.post("/forgot-password", forgotPassword);
r.post("/reset-password", resetPassword);

// ─── School ──────────────────────────────────────────────────
r.get("/school/status", auth, mySchoolStatus);

// ─── User Profile ────────────────────────────────────────────
r.patch("/profile", auth, updateProfile);

// ─── School Admins (school_admin only) ───────────────────────
r.get("/school-admins", auth, getSchoolAdmins);
r.post("/school-admins", auth, addSchoolAdmin);
r.delete("/school-admins/:userId", auth, removeSchoolAdmin);
r.patch("/school-admins/:userId/set-primary", auth, setSchoolAdminPrimary);

//invite school admin flow:
r.post("/school-admins/invite", auth, inviteSchoolAdmin);
r.post("/school-admins/accept-invite", acceptSchoolAdminInvite); // ไม่ต้อง auth

r.get("/school-admins/check-invite", checkInviteToken);

export default r;
