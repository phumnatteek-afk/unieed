import { db } from "../../config/db.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signJwt } from "../../utils/jwt.js";

export async function registerGeneral({ user_name, user_email, password }) {
  if (!user_name || !user_email || !password) {
    throw Object.assign(new Error("Missing fields"), { status: 400 });
  }

  const [exist] = await db.query("SELECT user_id FROM users WHERE user_email=?", [user_email]);
  if (exist.length) throw Object.assign(new Error("Email already used"), { status: 409 });

  const password_hash = await hashPassword(password);

  await db.query(
    "INSERT INTO users(user_name, user_email, password_hash, role, status) VALUES (?,?,?, 'user','active')",
    [user_name, user_email, password_hash]
  );

  return { message: "Registered" };
}

/**
 * ✅ สมัครโรงเรียนครั้งเดียวจบ (ไม่ต้อง login)
 * สร้าง schools(pending) + สร้าง users(school_admin,pending, school_id)
 */
export async function registerSchoolOneStep(payload) {
  const {
    admin_name,
    admin_email,
    password,

    school_name,
    school_address,
    school_phone,

    school_doc_url,
    school_doc_public_id,
  } = payload;

  if (!admin_name || !admin_email || !password || !school_name || !school_address) {
    throw Object.assign(new Error("Missing required fields"), { status: 400 });
  }

  const [exist] = await db.query("SELECT user_id FROM users WHERE user_email=?", [admin_email]);
  if (exist.length) throw Object.assign(new Error("Email already used"), { status: 409 });

  // 1) create school pending
  const [r] = await db.query(
    `INSERT INTO schools
      (school_name, school_address, school_phone, school_doc_url, school_doc_public_id, verification_status)
     VALUES (?,?,?,?,?, 'pending')`,
    [school_name, school_address, school_phone || null, school_doc_url || null, school_doc_public_id || null]
  );
  const school_id = r.insertId;

  // 2) create user school_admin pending
  const password_hash = await hashPassword(password);

  await db.query(
    `INSERT INTO users(user_name, user_email, password_hash, role, school_id, status)
     VALUES (?,?,?,?,?, 'pending')`,
    [admin_name, admin_email, password_hash, "school_admin", school_id]
  );

  return { message: "School applied", school_id, verification_status: "pending" };
}

export async function login({ user_email, password }) {
  if (!user_email || !password) {
    throw Object.assign(new Error("Missing fields"), { status: 400 });
  }

  const [rows] = await db.query(
    "SELECT user_id, user_name, user_email, password_hash, role, school_id, status FROM users WHERE user_email=?",
    [user_email]
  );
  const u = rows[0];
  if (!u) throw Object.assign(new Error("Invalid credentials"), { status: 401 });

  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) throw Object.assign(new Error("Invalid credentials"), { status: 401 });

  if (u.status === "banned") throw Object.assign(new Error("Account banned"), { status: 403 });

  // ✅ school_admin ต้องเช็คสถานะโรงเรียนด้วย
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

// ✅ ให้โรงเรียนเช็คสถานะเองหลัง login
export async function getMySchoolStatus(authUser) {
  if (!authUser?.school_id) {
    throw Object.assign(new Error("No school linked"), { status: 400 });
  }
  const [rows] = await db.query(
    "SELECT verification_status, verification_note FROM schools WHERE school_id=?",
    [authUser.school_id]
  );
  const s = rows[0];
  return {
    school_id: authUser.school_id,
    verification_status: s?.verification_status || "pending",
    verification_note: s?.verification_note || null,
  };
}
