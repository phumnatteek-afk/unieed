import { db } from "../../config/db.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signJwt } from "../../utils/jwt.js";
import validator from "validator";
import crypto from "crypto";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";

const resend = new Resend(process.env.RESEND_API_KEY);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

  // ✅ แก้: ส่ง email แบบ fire-and-forget — INSERT สำเร็จแน่นอน ไม่ว่า email จะ fail หรือไม่
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
  if (!phoneDigits || !/^0\d{9}$/.test(phoneDigits)) {
    throw Object.assign(
      new Error("เบอร์โทรต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0"),
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

  if (process.env.REQUIRE_OTP === "true") {
    const [rows] = await db.query(
      `SELECT verified_at FROM phone_otps
       WHERE phone=? AND purpose='register_school'
       ORDER BY otp_id DESC LIMIT 1`,
      [phoneDigits]
    );
    if (!rows[0]?.verified_at) {
      throw Object.assign(new Error("กรุณายืนยัน OTP ก่อนส่งคำขอ"), { status: 400 });
    }
  }

  const conn = await db.getConnection();

  // ✅ แก้: declare ข้างนอก try เพื่อให้ใช้ได้หลัง finally
  let school_id;
  let verificationToken;

  try {
    await conn.beginTransaction();

    // ✅ แก้: query ก่อน แล้วค่อยเอา insertId — ไม่ใช้ const (ใช้ assignment ให้ตัวแปรข้างนอก)
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

    school_id = sr.insertId; // ✅ assign ให้ตัวแปรข้างนอก ไม่ใช้ const

    const password_hash = await hashPassword(password);
    verificationToken = generateToken(); // ✅ assign ให้ตัวแปรข้างนอก ไม่ใช้ const
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await conn.query(
      `INSERT INTO users
        (user_name, user_email, password_hash, role, school_id, status,
         verification_token, verification_expired_at, email_verified)
       VALUES (?,?,?,?,?, 'pending', ?, ?, 0)`,
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

  // ✅ ส่ง email หลัง release แล้ว — ถ้า fail ไม่กระทบ transaction
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

  // ✅ แก้: เช็ค email_verified ครั้งเดียว (เอาที่ซ้ำออก)
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
  return { token, role: u.role, user_name: u.user_name };
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

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw Object.assign(new Error("Google token ไม่ถูกต้อง"), { status: 401 });
  }

  const { sub: google_id, email, name, picture } = ticket.getPayload();

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
    return { token, role: u.role, user_name: u.user_name };
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
  return { token, role: "user", user_name: name };
}

/* ─────────────────────── OTP / School Status (existing) ─────────────────────── */

export async function requestOtp(body) {
  // existing OTP logic...
}

export async function verifyOtp(body) {
  // existing OTP logic...
}

export async function getMySchoolStatus(user) {
  // existing logic...
}