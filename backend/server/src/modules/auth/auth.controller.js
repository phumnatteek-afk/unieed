import * as svc from "./auth.service.js";
import validator from "validator";

function cleanEmail(raw) {
  return (raw || "").trim().toLowerCase();
}

export async function registerGeneral(req, res, next) {
  try {
    const user_email = cleanEmail(req.body?.user_email);
    if (!validator.isEmail(user_email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    const result = await svc.registerGeneral({ ...req.body, user_email });
    res.status(201).json(result);
  } catch (e) { next(e); }
}

export async function registerSchoolOneStep(req, res, next) {
  try {
    const user_email = cleanEmail(req.body?.user_email);
    if (!validator.isEmail(user_email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    const result = await svc.registerSchoolOneStep({ ...req.body, user_email });
    res.status(201).json(result);
  } catch (e) { next(e); }
}

export async function login(req, res, next) {
  try {
    const user_email = cleanEmail(req.body?.user_email);
    const result = await svc.login({ ...req.body, user_email });
    res.json(result);
  } catch (e) { next(e); }
}

export async function mySchoolStatus(req, res, next) {
  try {
    const result = await svc.getMySchoolStatus(req.user);
    res.json(result);
  } catch (e) { next(e); }
}

// ─── Email Verification ───────────────────────────────────────

export async function verifyEmail(req, res, next) {
  try {
    const result = await svc.verifyEmail({ token: req.query.token });
    res.json(result);
  } catch (e) { next(e); }
}

export async function resendVerification(req, res, next) {
  try {
    const user_email = cleanEmail(req.body?.user_email);
    const result = await svc.resendVerification({ user_email });
    res.json(result);
  } catch (e) { next(e); }
}

// ─── Forgot / Reset Password ──────────────────────────────────

export async function forgotPassword(req, res, next) {
  try {
    const user_email = cleanEmail(req.body?.user_email);
    const result = await svc.forgotPassword({ user_email });
    res.json(result);
  } catch (e) { next(e); }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const result = await svc.resetPassword({ token, newPassword });
    res.json(result);
  } catch (e) { next(e); }
}

// ─── Google Login ─────────────────────────────────────────────

export async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    const result = await svc.googleLogin({ idToken });
    res.json(result);
  } catch (e) { next(e); }
}

// ─── User Profile ─────────────────────────────────────────────

export async function updateProfile(req, res, next) {
  try {
    const result = await svc.updateProfile(req.user.user_id, req.body);
    res.json(result);
  } catch (err) { next(err); }
}

// ─── School Admins ────────────────────────────────────────────

// GET /auth/school-admins — ดึงรายชื่อแอดมินทั้งหมดของโรงเรียน
export async function getSchoolAdmins(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) {
      return res.status(400).json({ message: "ไม่พบข้อมูลโรงเรียน" });
    }
    const admins = await svc.getSchoolAdmins(schoolId);
    res.json(admins);
  } catch (e) { next(e); }
}

// POST /auth/school-admins — เพิ่มแอดมินใหม่
export async function addSchoolAdmin(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) {
      return res.status(400).json({ message: "ไม่พบข้อมูลโรงเรียน" });
    }
    const result = await svc.addSchoolAdmin(schoolId, req.body);
    res.status(201).json(result);
  } catch (e) { next(e); }
}

// DELETE /auth/school-admins/:userId — ลบแอดมิน
export async function removeSchoolAdmin(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    const targetUserId = req.params.userId;
    const requesterId = req.user.user_id;

    if (!schoolId) {
      return res.status(400).json({ message: "ไม่พบข้อมูลโรงเรียน" });
    }
    const result = await svc.removeSchoolAdmin(schoolId, targetUserId, requesterId);
    res.json(result);
  } catch (e) { next(e); }
}

export async function setSchoolAdminPrimary(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    const targetUserId = req.params.userId;
    const requesterId = req.user.user_id;
    if (!schoolId) return res.status(400).json({ message: "ไม่พบข้อมูลโรงเรียน" });
    res.json(await svc.setPrimaryAdmin(schoolId, targetUserId, requesterId));
  } catch (e) { next(e); }
}

export async function inviteSchoolAdmin(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) return res.status(400).json({ message: "ไม่พบข้อมูลโรงเรียน" });
    const result = await svc.inviteSchoolAdmin(schoolId, req.user.user_id, req.body);
    res.status(201).json(result);
  } catch (e) { next(e); }
}

export async function acceptSchoolAdminInvite(req, res, next) {
  try {
    const result = await svc.acceptSchoolAdminInvite(req.body);
    res.json(result);
  } catch (e) { next(e); }
}

export async function checkInviteToken(req, res, next) {
  try {
    const result = await svc.checkInviteToken(req.query.token);
    res.json(result);
  } catch (e) { next(e); }
}
