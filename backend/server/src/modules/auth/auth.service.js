import { db } from "../../config/db.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signJwt } from "../../utils/jwt.js";
import validator from "validator";
import crypto from "crypto";
import { Resend } from "resend";
import * as jose from "jose";

const resend = new Resend(process.env.RESEND_API_KEY);

async function verifyGoogleToken(idToken) {
  const JWKS = jose.createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs")
  );
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    audience: process.env.GOOGLE_CLIENT_ID,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  return payload;
}

/* ─────────────────────── helpers ─────────────────────── */

function normalizeThaiPhone(input) {
  if (!input) return null;
  let raw = String(input).replace(/\D/g, "");
  if (!raw) return null;
  if (raw.startsWith("66") && raw.length === 11) raw = "0" + raw.slice(2);
  if (raw.length === 9) raw = "0" + raw;
  return raw;
}

function normalizeDigits(input) {
  return String(input || "").replace(/\D/g, "");
}

function cleanEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* ─────────────────────── email senders ─────────────────────── */

async function sendVerificationEmail(email, token) {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: "ยืนยันอีเมลของคุณ",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#1a1a1a">ยืนยันอีเมลของคุณ</h2>
        <p style="color:#555">กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมลและเริ่มใช้งานบัญชี</p>
        <a href="${url}"
          style="display:inline-block;margin-top:16px;padding:12px 28px;background:#4f46e5;
                 color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          ยืนยันอีเมล
        </a>
        <p style="margin-top:24px;color:#999;font-size:13px">
          ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง<br/>
          หากคุณไม่ได้สมัครสมาชิก ไม่ต้องทำอะไร
        </p>
      </div>
    `,
  });
}

async function sendResetPasswordEmail(email, token) {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: "รีเซ็ตรหัสผ่านของคุณ",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#1a1a1a">รีเซ็ตรหัสผ่าน</h2>
        <p style="color:#555">เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้</p>
        <a href="${url}"
          style="display:inline-block;margin-top:16px;padding:12px 28px;background:#4f46e5;
                 color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          รีเซ็ตรหัสผ่าน
        </a>
        <p style="margin-top:24px;color:#999;font-size:13px">
          ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง<br/>
          หากคุณไม่ได้ขอรีเซ็ต ไม่ต้องทำอะไร
        </p>
      </div>
    `,
  });
}

/* ─────────────────────── register (general) ─────────────────────── */

export async function registerGeneral(payload) {
  const { user_name, user_email, password } = payload;

  if (!user_email || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  const email = cleanEmail(user_email);
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error("รูปแบบอีเมลไม่ถูกต้อง"), { status: 400 });
  }

  const [uExist] = await db.query(
    "SELECT user_id FROM users WHERE user_email=?",
    [email]
  );
  if (uExist.length) {
    throw Object.assign(new Error("Email already used"), { status: 409 });
  }

  const password_hash = await hashPassword(password);
  const verificationToken = generateToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO users
      (user_name, user_email, password_hash, role, status,
       verification_token, verification_expired_at, email_verified)
     VALUES (?, ?, ?, 'user', 'active', ?, ?, 0)`,
    [
      user_name ? String(user_name).trim() : null,
      email,
      password_hash,
      verificationToken,
      verificationExpires,
    ]
  );

  sendVerificationEmail(email, verificationToken).catch((err) => {
    console.error("sendVerificationEmail failed:", err);
  });

  return { message: "Register success. กรุณายืนยันอีเมลของคุณ" };
}

/* ─────────────────────── register (school) ─────────────────────── */

export async function registerSchoolOneStep(payload) {
  const {
    user_name, user_email, password,
    school_name, school_address, school_phone,
    school_doc_url, school_doc_public_id,
    school_logo_url, school_logo_public_id,
    school_code, school_intent,
  } = payload;

  if (!user_name || !user_email || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }
  if (!school_name || !school_address) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  const cleanUserName = String(user_name).trim();
  const email = cleanEmail(user_email);
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error("รูปแบบอีเมลไม่ถูกต้อง"), { status: 400 });
  }

  const phoneDigits = normalizeThaiPhone(school_phone);
  if (!phoneDigits || !/^(02\d{7}|0[3-9]\d{8})$/.test(phoneDigits)) {
    throw Object.assign(
      new Error("เบอร์โทรไม่ถูกต้อง (02xxxxxxx หรือ 08xxxxxxxx)"),
      { status: 400 }
    );
  }

  const normalizedSchoolCode = normalizeDigits(school_code);
  if (!/^\d{10}$/.test(normalizedSchoolCode)) {
    throw Object.assign(
      new Error("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี"),
      { status: 400 }
    );
  }

  const [uExist] = await db.query(
    "SELECT user_id FROM users WHERE user_email=?",
    [email]
  );
  if (uExist.length) {
    throw Object.assign(new Error("Email already used"), { status: 409 });
  }

  const conn = await db.getConnection();
  let school_id;
  let verificationToken;

  try {
    await conn.beginTransaction();

    const [sr] = await conn.query(
      `INSERT INTO schools
        (school_name, school_address, school_phone,
         school_doc_url, school_doc_public_id,
         school_logo_url, school_logo_public_id,
         school_code, school_intent, verification_status)
       VALUES (?,?,?,?,?,?,?,?,?, 'pending')`,
      [
        String(school_name).trim(), String(school_address).trim(), phoneDigits,
        school_doc_url || null, school_doc_public_id || null,
        school_logo_url || null, school_logo_public_id || null,
        normalizedSchoolCode, school_intent || null,
      ]
    );

    school_id = sr.insertId;

    const password_hash = await hashPassword(password);
    verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await conn.query(
      `INSERT INTO users
    (user_name, user_email, password_hash, role, school_id, status,
     verification_token, verification_expired_at, email_verified, is_primary)
   VALUES (?,?,?,?,?, 'pending', ?, ?, 0, 1)`,
      [cleanUserName, email, password_hash, "school_admin", school_id,
       verificationToken, verificationExpires]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e?.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("รหัสสถานศึกษาถูกใช้แล้ว"), { status: 409 });
    }
    throw e;
  } finally {
    conn.release();
  }

  sendVerificationEmail(email, verificationToken).catch((err) => {
    console.error("sendVerificationEmail failed:", err);
  });

  return { message: "School registered", school_id, verification_status: "pending" };
}

/* ─────────────────────── login ─────────────────────── */

export async function login({ user_email, password }) {
  if (!user_email || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  const email = cleanEmail(user_email);
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error("รูปแบบอีเมลไม่ถูกต้อง"), { status: 400 });
  }

  const [rows] = await db.query(
    `SELECT user_id, user_name, user_email, password_hash,
            role, school_id, status, email_verified
     FROM users WHERE user_email=? AND google_id IS NULL`,
    [email]
  );

  const u = rows[0];
  if (!u) throw Object.assign(new Error("ข้อมูลไม่ถูกต้อง"), { status: 401 });

  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) throw Object.assign(new Error("ข้อมูลไม่ถูกต้อง"), { status: 401 });

  if (u.status === "banned") {
    throw Object.assign(new Error("Account banned"), { status: 403 });
  }
  if (u.status === "suspended") {
    throw Object.assign(
      new Error("บัญชีถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ"),
      { status: 403, code: "ACCOUNT_SUSPENDED" }
    );
  }

  if (u.role !== "admin" && !u.email_verified) {
    throw Object.assign(
      new Error("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"),
      { status: 403, code: "EMAIL_NOT_VERIFIED" }
    );
  }

  if (u.role === "school_admin" && u.school_id) {
    const [srows] = await db.query(
      "SELECT verification_status, verification_note FROM schools WHERE school_id=?",
      [u.school_id]
    );
    const s = srows[0];
    if (!s || s.verification_status !== "approved") {
      return {
        requires_school_check: true,
        verification_status: s?.verification_status || "pending",
        verification_note: s?.verification_note || null,
      };
    }
  }

  const token = signJwt({ user_id: u.user_id, role: u.role, school_id: u.school_id });
  return { token, role: u.role, user_name: u.user_name, user_email: u.user_email };
}

/* ─────────────────────── verify email ─────────────────────── */

export async function verifyEmail({ token }) {
  if (!token) {
    throw Object.assign(new Error("Token ไม่ถูกต้อง"), { status: 400 });
  }

  const [rows] = await db.query(
    `SELECT user_id, verification_expired_at
     FROM users WHERE verification_token=?
     AND (email_verified=0 OR email_verified IS NULL)`,
    [token]
  );

  const u = rows[0];
  if (!u) {
    throw Object.assign(new Error("Token ไม่ถูกต้องหรือถูกใช้ไปแล้ว"), { status: 400 });
  }

  if (new Date(u.verification_expired_at) < new Date()) {
    throw Object.assign(new Error("Token หมดอายุแล้ว กรุณาขอส่งอีเมลใหม่"), { status: 400 });
  }

  await db.query(
    `UPDATE users
     SET email_verified=1, verification_token=NULL, verification_expired_at=NULL
     WHERE user_id=?`,
    [u.user_id]
  );

  return { message: "ยืนยันอีเมลสำเร็จ" };
}

/* ─────────────────────── resend verification ─────────────────────── */

export async function resendVerification({ user_email }) {
  const email = cleanEmail(user_email);
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error("รูปแบบอีเมลไม่ถูกต้อง"), { status: 400 });
  }

  const [rows] = await db.query(
    "SELECT user_id, email_verified FROM users WHERE user_email=?",
    [email]
  );

  if (!rows[0] || rows[0].email_verified) {
    return { message: "หากอีเมลนี้ถูกต้อง คุณจะได้รับอีเมลยืนยันใหม่" };
  }

  const newToken = generateToken();
  const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE users SET verification_token=?, verification_expired_at=?
     WHERE user_id=?`,
    [newToken, newExpires, rows[0].user_id]
  );

  sendVerificationEmail(email, newToken).catch((err) => {
    console.error("resendVerification email failed:", err);
  });

  return { message: "หากอีเมลนี้ถูกต้อง คุณจะได้รับอีเมลยืนยันใหม่" };
}

/* ─────────────────────── forgot password ─────────────────────── */

export async function forgotPassword({ user_email }) {
  const email = cleanEmail(user_email);
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error("รูปแบบอีเมลไม่ถูกต้อง"), { status: 400 });
  }

  const [rows] = await db.query(
    "SELECT user_id FROM users WHERE user_email=? AND google_id IS NULL",
    [email]
  );

  if (!rows[0]) {
    return { message: "หากอีเมลนี้ถูกต้อง คุณจะได้รับอีเมลรีเซ็ตรหัสผ่าน" };
  }

  const resetToken = generateToken();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await db.query(
    `UPDATE users SET reset_token=?, reset_token_expires=? WHERE user_id=?`,
    [resetToken, resetExpires, rows[0].user_id]
  );

  sendResetPasswordEmail(email, resetToken).catch((err) => {
    console.error("sendResetPasswordEmail failed:", err);
  });

  return { message: "หากอีเมลนี้ถูกต้อง คุณจะได้รับอีเมลรีเซ็ตรหัสผ่าน" };
}

/* ─────────────────────── reset password ─────────────────────── */

export async function resetPassword({ token, newPassword }) {
  if (!token || !newPassword) {
    throw Object.assign(new Error("ข้อมูลไม่ครบ"), { status: 400 });
  }

  if (newPassword.length < 6) {
    throw Object.assign(new Error("รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร"), { status: 400 });
  }

  const [rows] = await db.query(
    `SELECT user_id, reset_token_expires FROM users WHERE reset_token=?`,
    [token]
  );

  const u = rows[0];
  if (!u) {
    throw Object.assign(new Error("Token ไม่ถูกต้องหรือถูกใช้ไปแล้ว"), { status: 400 });
  }

  if (new Date(u.reset_token_expires) < new Date()) {
    throw Object.assign(new Error("Token หมดอายุแล้ว กรุณาขอรีเซ็ตใหม่"), { status: 400 });
  }

  const password_hash = await hashPassword(newPassword);

  await db.query(
    `UPDATE users
     SET password_hash=?, reset_token=NULL, reset_token_expires=NULL
     WHERE user_id=?`,
    [password_hash, u.user_id]
  );

  return { message: "เปลี่ยนรหัสผ่านสำเร็จ" };
}

/* ─────────────────────── google login ─────────────────────── */

export async function googleLogin({ idToken }) {
  if (!idToken) {
    throw Object.assign(new Error("ไม่พบ ID Token"), { status: 400 });
  }

  let payload;
  try {
    payload = await verifyGoogleToken(idToken);
  } catch (err) {
    console.error("❌ verifyGoogleToken failed:", err.message);
    throw Object.assign(new Error("Google token ไม่ถูกต้อง"), { status: 401 });
  }

  const { sub: google_id, email, name, picture } = payload;

  const [byGoogle] = await db.query(
    `SELECT user_id, user_name, role, school_id, status
     FROM users WHERE google_id=?`,
    [google_id]
  );

  if (byGoogle[0]) {
    const u = byGoogle[0];
    if (u.status === "banned") {
      throw Object.assign(new Error("Account banned"), { status: 403 });
    }
    const token = signJwt({ user_id: u.user_id, role: u.role, school_id: u.school_id });
    return { token, role: u.role, user_name: u.user_name, user_email: email };
  }

  const [byEmail] = await db.query(
    "SELECT user_id FROM users WHERE user_email=? AND google_id IS NULL",
    [cleanEmail(email)]
  );
  if (byEmail[0]) {
    throw Object.assign(
      new Error("อีเมลนี้ถูกใช้งานแล้ว กรุณา login ด้วยรหัสผ่าน"),
      { status: 409, code: "EMAIL_EXISTS" }
    );
  }

  const [result] = await db.query(
    `INSERT INTO users
      (user_name, user_email, google_id, google_picture, role, status, email_verified)
     VALUES (?, ?, ?, ?, 'user', 'active', 1)`,
    [name, cleanEmail(email), google_id, picture || null]
  );

  const token = signJwt({ user_id: result.insertId, role: "user", school_id: null });
  return { token, role: "user", user_name: name, user_email: cleanEmail(email) };
}

/* ─────────────────────── update profile ─────────────────────── */

export async function updateProfile(userId, { user_name }) {
  if (!user_name?.trim()) {
    throw Object.assign(new Error("กรุณากรอกชื่อ"), { status: 400 });
  }
  await db.query(
    "UPDATE users SET user_name = ? WHERE user_id = ?",
    [user_name.trim(), userId]
  );
  return { message: "อัปเดตข้อมูลสำเร็จ", user_name: user_name.trim() };
}

/* ─────────────────────── school admins ─────────────────────── */

// ดึงรายชื่อแอดมินทั้งหมดของโรงเรียนนี้
export async function getSchoolAdmins(schoolId) {
  const [rows] = await db.query(
    `SELECT user_id, user_name, user_email, is_primary, joined_school_at, created_at
     FROM users
     WHERE school_id = ? AND role = 'school_admin'
     ORDER BY is_primary DESC, joined_school_at ASC`,
    [schoolId]
  );
  return rows;
}

export async function setPrimaryAdmin(schoolId, targetUserId, requesterId) {
  const [[requester]] = await db.query(
    `SELECT is_primary FROM users WHERE user_id = ? AND school_id = ? AND role = 'school_admin'`,
    [requesterId, schoolId]
  );
  if (!requester?.is_primary) {
    throw Object.assign(new Error("เฉพาะแอดมินหลักเท่านั้นที่โอนตำแหน่งได้"), { status: 403 });
  }
  if (Number(targetUserId) === Number(requesterId)) {
    throw Object.assign(new Error("คุณเป็นแอดมินหลักอยู่แล้ว"), { status: 400 });
  }
  const [[target]] = await db.query(
    `SELECT user_id FROM users WHERE user_id = ? AND school_id = ? AND role = 'school_admin'`,
    [targetUserId, schoolId]
  );
  if (!target) {
    throw Object.assign(new Error("ไม่พบผู้ดูแลคนนี้"), { status: 404 });
  }
  await db.query(
    `UPDATE users SET is_primary = 0 WHERE school_id = ? AND role = 'school_admin'`,
    [schoolId]
  );
  await db.query(
    `UPDATE users SET is_primary = 1 WHERE user_id = ?`,
    [targetUserId]
  );
  return { success: true };
}

// เพิ่มแอดมินใหม่
export async function addSchoolAdmin(schoolId, { user_name, user_email, password }) {
  if (!user_name?.trim() || !user_email?.trim() || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  const email = cleanEmail(user_email);
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error("รูปแบบอีเมลไม่ถูกต้อง"), { status: 400 });
  }

  if (password.length < 6) {
    throw Object.assign(new Error("รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร"), { status: 400 });
  }

  // เช็คว่า email ซ้ำไหม
  const [exist] = await db.query(
    "SELECT user_id FROM users WHERE user_email = ?",
    [email]
  );
  if (exist.length) {
    throw Object.assign(new Error("อีเมลนี้ถูกใช้งานแล้ว"), { status: 409 });
  }

  const password_hash = await hashPassword(password);

  const [result] = await db.query(
    `INSERT INTO users
      (user_name, user_email, password_hash, role, school_id, status, email_verified)
     VALUES (?, ?, ?, 'school_admin', ?, 'active', 1)`,
    [user_name.trim(), email, password_hash, schoolId]
  );

  return {
    user_id: result.insertId,
    user_name: user_name.trim(),
    user_email: email,
  };
}

// ลบแอดมิน (ป้องกันลบตัวเอง)
export async function removeSchoolAdmin(schoolId, targetUserId, requesterId) {
  console.log("🔔 removeSchoolAdmin called", { schoolId, targetUserId, requesterId });
  if (Number(targetUserId) === Number(requesterId)) {
    throw Object.assign(new Error("ไม่สามารถลบบัญชีตัวเองได้"), { status: 400 });
  }

  const [rows] = await db.query(
    `SELECT user_id, user_email FROM users
     WHERE user_id = ? AND school_id = ? AND role = 'school_admin'`,
    [targetUserId, schoolId]
  );

  if (!rows.length) {
    throw Object.assign(new Error("ไม่พบผู้ดูแลคนนี้"), { status: 404 });
  }

  // ลบ invite ของอีเมลนี้ออกด้วย
  console.log("🔔 ลบ invite ของ email:", rows[0].user_email);
  await db.query(
    "DELETE FROM school_admin_invites WHERE email = ? AND school_id = ?",
    [rows[0].user_email, schoolId]
  );

  console.log("🔔 ลบ user สำเร็จ");
  await db.query(
    "DELETE FROM users WHERE user_id = ? AND school_id = ? AND role = 'school_admin'",
    [targetUserId, schoolId]
  );

  return { message: "ลบผู้ดูแลสำเร็จ" };
}

export async function getMySchoolStatus(user) {
  // existing logic...
}

// ส่ง invite ไปยังอีเมล
export async function inviteSchoolAdmin(schoolId, invitedBy, { user_email }) {
  if (!user_email?.trim()) {
    throw Object.assign(new Error("กรุณากรอกอีเมล"), { status: 400 });
  }

  const email = cleanEmail(user_email);
  if (!validator.isEmail(email)) {
    throw Object.assign(new Error("รูปแบบอีเมลไม่ถูกต้อง"), { status: 400 });
  }

  // เช็คว่าเป็นสมาชิกในระบบอยู่แล้วและเป็น school_admin ของโรงเรียนนี้ไหม
  const [exist] = await db.query(
    "SELECT user_id, role, school_id FROM users WHERE user_email = ?",
    [email]
  );
  if (exist.length && exist[0].role === "school_admin" && exist[0].school_id === schoolId) {
    throw Object.assign(new Error("อีเมลนี้เป็นผู้ดูแลโรงเรียนนี้อยู่แล้ว"), { status: 409 });
  }
  if (exist.length && exist[0].role === "school_admin") {
  throw Object.assign(new Error("อีเมลนี้เป็นผู้ดูแลโรงเรียนอื่นอยู่แล้ว"), { status: 409 });
  }

  // เช็ค invite ที่ยังไม่หมดอายุ
  const [pending] = await db.query(
    `SELECT invite_id FROM school_admin_invites
     WHERE email = ? AND school_id = ? AND used_at IS NULL AND expires_at > NOW()`,
    [email, schoolId]
  );
  if (pending.length) {
    throw Object.assign(new Error("ได้ส่งคำเชิญไปยังอีเมลนี้แล้ว"), { status: 409 });
  }

  const token = generateToken();
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 ชั่วโมง

  await db.query(
    `INSERT INTO school_admin_invites (school_id, email, token, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [schoolId, email, token, invitedBy, expires]
  );

  // ดึงชื่อโรงเรียน
  const [[school]] = await db.query(
    "SELECT school_name FROM schools WHERE school_id = ?",
    [schoolId]
  );

  const url = `${process.env.FRONTEND_URL}/school/accept-invite?token=${token}`;
  console.log("🔔 กำลังส่งอีเมลไปที่:", email);
console.log("🔔 RESEND_FROM_EMAIL:", process.env.RESEND_FROM_EMAIL);
console.log("🔔 FRONTEND_URL:", process.env.FRONTEND_URL);
  try {
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: `คุณได้รับเชิญให้เป็นผู้ดูแล ${school?.school_name || "โรงเรียน"}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#1a1a1a">คุณได้รับคำเชิญ</h2>
        <p style="color:#555">คุณได้รับเชิญให้เป็นผู้ดูแลโรงเรียน <strong>${school?.school_name || ""}</strong> บนแพลตฟอร์ม Unieed</p>
        <a href="${url}"
          style="display:inline-block;margin-top:16px;padding:12px 28px;background:#5285e8;
                 color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          รับคำเชิญ
        </a>
        <p style="margin-top:24px;color:#999;font-size:13px">
          ลิงก์นี้จะหมดอายุใน 48 ชั่วโมง<br/>
          หากคุณไม่ได้รับคำเชิญนี้ ไม่ต้องทำอะไร
        </p>
      </div>
    `,
  });
  console.log("Resend result:", result);
} catch (emailErr) {
  console.error("Resend error:", emailErr);
}

  return { message: "ส่งคำเชิญสำเร็จ" };
}

// รับ invite และตั้งชื่อ + รหัสผ่าน
export async function acceptSchoolAdminInvite({ token, user_name, password }) {
  if (!token || !user_name?.trim() || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }
  if (password.length < 6) {
    throw Object.assign(new Error("รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร"), { status: 400 });
  }

  const [rows] = await db.query(
    `SELECT * FROM school_admin_invites
     WHERE token = ? AND used_at IS NULL AND expires_at > NOW()`,
    [token]
  );

  const invite = rows[0];
  if (!invite) {
    throw Object.assign(new Error("ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว"), { status: 400 });
  }

  // เช็คว่ามีบัญชีอยู่แล้วไหม
  const [exist] = await db.query(
    "SELECT user_id FROM users WHERE user_email = ?",
    [invite.email]
  );

  const password_hash = await hashPassword(password);

  if (exist.length) {
  await db.query(
    `UPDATE users SET role = 'school_admin', school_id = ?, joined_school_at = NOW()
     WHERE user_id = ?`,
    [invite.school_id, exist[0].user_id]
  );
  } else {
    // ยังไม่มีบัญชี → สร้างใหม่
    console.log("🔔 กำลัง INSERT บัญชีใหม่ joined_school_at = NOW()");
    await db.query(
    `INSERT INTO users
      (user_name, user_email, password_hash, role, school_id, status, email_verified, joined_school_at)
    VALUES (?, ?, ?, 'school_admin', ?, 'active', 1, NOW())`,
    [user_name.trim(), invite.email, password_hash, invite.school_id]
    );
  }

  // mark invite ว่าใช้แล้ว
  await db.query(
    "UPDATE school_admin_invites SET used_at = NOW() WHERE invite_id = ?",
    [invite.invite_id]
  );

  return { message: "รับคำเชิญสำเร็จ กรุณาเข้าสู่ระบบ", email: invite.email };
}

export async function checkInviteToken(token) {
  const [rows] = await db.query(
    `SELECT i.email, i.school_id, s.school_name,
            u.user_id, u.user_name
     FROM school_admin_invites i
     LEFT JOIN schools s ON s.school_id = i.school_id
     LEFT JOIN users u ON u.user_email = i.email
     WHERE i.token = ? AND i.used_at IS NULL AND i.expires_at > NOW()`,
    [token]
  );
  if (!rows[0]) {
    throw Object.assign(new Error("ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว"), { status: 400 });
  }
  return {
    email: rows[0].email,
    school_name: rows[0].school_name,
    has_account: !!rows[0].user_id,
    user_name: rows[0].user_name,
  };
}
