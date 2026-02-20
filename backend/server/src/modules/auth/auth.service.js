import { db } from "../../config/db.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signJwt } from "../../utils/jwt.js";

/* ---------------- helpers ---------------- */

function normalizeThaiPhone(input) {
  if (!input) return null;

  let raw = String(input).replace(/\D/g, "");
  if (!raw) return null;

  // 66XXXXXXXXX (รวม 11 หลัก) -> 0XXXXXXXXX
  // รองรับกรอก +66 หรือ 66 (เพราะเราเอา non-digit ออกแล้ว)
  if (raw.startsWith("66") && raw.length === 11) {
    raw = "0" + raw.slice(2);
  }

  // ผู้ใช้พิมพ์ 9 หลัก (ลืม 0 นำหน้า) -> เติม 0
  if (raw.length === 9) {
    raw = "0" + raw;
  }

  return raw;
}

function normalizeDigits(input) {
  return String(input || "").replace(/\D/g, "");
}

/* ---------------- auth ---------------- */

export async function registerSchoolOneStep(payload) {
  const {
    user_name,
    user_email,
    password,

    school_name,
    school_address,
    school_phone,

    school_doc_url,
    school_doc_public_id,

    school_logo_url,
    school_logo_public_id,

    school_code,
    school_intent,
  } = payload;

  // ---- required basic fields ----
  if (!user_name || !user_email || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }
  if (!school_name || !school_address) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  // ---- phone: normalize + required + validate ----
  const phoneDigits = normalizeThaiPhone(school_phone);
  if (!phoneDigits || !/^0\d{9}$/.test(phoneDigits)) {
    throw Object.assign(
      new Error("เบอร์โทรต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0"),
      { status: 400 }
    );
  }

  // ---- school_code: required + validate 10 digits exactly ----
  const normalizedSchoolCode = normalizeDigits(school_code);
  if (!/^\d{10}$/.test(normalizedSchoolCode)) {
    throw Object.assign(
      new Error("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี"),
      { status: 400 }
    );
  }

  // ---- email unique ----
  const [uExist] = await db.query(
    "SELECT user_id FROM users WHERE user_email=?",
    [user_email]
  );
  if (uExist.length) {
    throw Object.assign(new Error("Email already used"), { status: 409 });
  }

  // ---- OTP gate (optional by flag) ----
  if (process.env.REQUIRE_OTP === "true") {
    const [rows] = await db.query(
      `SELECT verified_at
       FROM phone_otps
       WHERE phone=? AND purpose='register_school'
       ORDER BY otp_id DESC LIMIT 1`,
      [phoneDigits]
    );

    if (!rows[0]?.verified_at) {
      throw Object.assign(new Error("กรุณายืนยัน OTP ก่อนส่งคำขอ"), { status: 400 });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [sr] = await conn.query(
      `INSERT INTO schools
        (
          school_name,
          school_address,
          school_phone,
          school_doc_url,
          school_doc_public_id,
          school_logo_url,
          school_logo_public_id,
          school_code,
          school_intent,
          verification_status
        )
       VALUES (?,?,?,?,?,?,?,?,?, 'pending')`,
      [
        school_name,
        school_address,
        phoneDigits,
        school_doc_url || null,
        school_doc_public_id || null,
        school_logo_url || null,
        school_logo_public_id || null,
        normalizedSchoolCode,
        school_intent || null,
      ]
    );

    const school_id = sr.insertId;

    const password_hash = await hashPassword(password);
    await conn.query(
      `INSERT INTO users
        (user_name, user_email, password_hash, role, school_id, status)
       VALUES (?,?,?,?,?, 'pending')`,
      [user_name, user_email, password_hash, "school_admin", school_id]
    );

    await conn.commit();
    return { message: "School registered", school_id, verification_status: "pending" };
  } catch (e) {
    await conn.rollback();

    // ถ้าทำ UNIQUE school_code แล้ว อยากให้ error สวยขึ้น
    if (e?.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("รหัสสถานศึกษาถูกใช้แล้ว"), { status: 409 });
    }

    throw e;
  } finally {
    conn.release();
  }
}


export async function registerGeneral(payload) {
  const { user_name, user_email, password } = payload;

  if (!user_email || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  const [uExist] = await db.query(
    "SELECT user_id FROM users WHERE user_email=?",
    [user_email]
  );
  if (uExist.length) {
    throw Object.assign(new Error("Email already used"), { status: 409 });
  }

  const password_hash = await hashPassword(password);

  await db.query(
    `INSERT INTO users
      (user_name, user_email, password_hash, role, status)
     VALUES (?, ?, ?, 'user', 'active')`,
    [user_name || null, user_email, password_hash]
  );

  return { message: "Register success" };
}

export async function login({ user_email, password }) {
  if (!user_email || !password) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  const [rows] = await db.query(
    "SELECT user_id, user_name, user_email, password_hash, role, school_id, status FROM users WHERE user_email=?",
    [user_email]
  );

  const u = rows[0];
  if (!u) throw Object.assign(new Error("ข้อมูลไม่ถูกต้อง"), { status: 401 });

  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) throw Object.assign(new Error("ข้อมูลไม่ถูกต้อง"), { status: 401 });

  if (u.status === "banned") {
    throw Object.assign(new Error("Account banned"), { status: 403 });
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
