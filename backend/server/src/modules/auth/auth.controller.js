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

// ─── OTP (existing) ───────────────────────────────────────────

export async function requestOtp(req, res, next) {
  try {
    const result = await svc.requestOtp(req.body);
    res.json(result);
  } catch (e) { next(e); }
}

export async function verifyOtp(req, res, next) {
  try {
    const result = await svc.verifyOtp(req.body);
    res.json(result);
  } catch (e) { next(e); }
}