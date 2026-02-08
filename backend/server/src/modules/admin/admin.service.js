import { db } from "../../config/db.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signJwt } from "../../utils/jwt.js";

// registerGeneral เหมือนเดิม...

export async function registerSchoolOneStep(payload) {
  // --- ข้อมูล user (admin โรงเรียนหลัก) ---
  const { user_name, user_email, password } = payload;

  // --- ข้อมูล school ---
  const {
    school_name, school_address, school_phone,
    school_doc_url, school_doc_public_id
  } = payload;

  // 1) validate
  if (!user_name || !user_email || !password) {
    throw Object.assign(new Error("Missing user fields"), { status: 400 });
  }

  // 2) กัน user ซ้ำ
  const [uExist] = await db.query("SELECT user_id FROM users WHERE user_email=?", [user_email]);
  if (uExist.length) throw Object.assign(new Error("Email already used"), { status: 409 });


  // 4) ทำเป็น transaction (สำคัญ: กันสร้างค้างครึ่งทาง)
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 4.1 create school (pending)
    const [sr] = await conn.query(
      `INSERT INTO schools
        (school_name, school_address, school_phone, school_doc_url, school_doc_public_id, verification_status)
       VALUES (?,?,?,?,?,?, 'pending')`,
      [
        school_name,
        school_address,
        school_phone || null,
        school_doc_url || null,
        school_doc_public_id || null,
      ]
    );
    const school_id = sr.insertId;

    // 4.2 create user (school_admin pending) + link school_id
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
    throw e;
  } finally {
    conn.release();
  }
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

  // ✅ school_admin: ให้เช็คผลในระบบเอง
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
        verification_note: s?.verification_note || null
      };
    }
  }

  const token = signJwt({ user_id: u.user_id, role: u.role, school_id: u.school_id });
  return { token, role: u.role, user_name: u.user_name };
}
