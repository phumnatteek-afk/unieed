import { db } from "../../config/db.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signJwt } from "../../utils/jwt.js";


export async function registerSchoolOneStep(payload) {
  const { user_name, user_email, password } = payload;
  const {
    school_name, school_address, school_phone,
    school_doc_url, school_doc_public_id
  } = payload;

  if (!user_name || !user_email || !password) {
    throw Object.assign(new Error("Missing user fields"), { status: 400 });
  }
  if (!school_name || !school_address) {
    throw Object.assign(new Error("Missing school fields"), { status: 400 });
  }

  const [uExist] = await db.query("SELECT user_id FROM users WHERE user_email=?", [user_email]);
  if (uExist.length) throw Object.assign(new Error("Email already used"), { status: 409 });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [sr] = await conn.query(
      `INSERT INTO schools
        (school_name, school_address, school_phone, school_doc_url, school_doc_public_id, verification_status)
       VALUES (?,?,?,?,?, 'pending')`,
      [
        school_name,
        school_address,
        school_phone || null,
        school_doc_url || null,
        school_doc_public_id || null,
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
