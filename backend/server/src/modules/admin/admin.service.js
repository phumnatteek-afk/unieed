import { db } from "../../config/db.js";

/* ---------------- helpers ---------------- */

function normalizeThaiPhone(input) {
  if (!input) return null;

  let raw = String(input).replace(/\D/g, "");
  if (!raw) return null;

  // 66xxxxxxxxx (11 หลัก) -> 0xxxxxxxxx
  if (raw.startsWith("66") && raw.length === 11) raw = "0" + raw.slice(2);

  // 9 หลัก (ลืม 0) -> เติม 0
  if (raw.length === 9) raw = "0" + raw;

  return raw;
}

/* ---------------- list + stats ---------------- */

export async function listSchools({ status = "", q = "", sort = "latest" } = {}) {
  const where = [];
  const params = [];

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.push("s.verification_status = ?");
    params.push(status);
  }

  if (q) {
    where.push(
      "(s.school_name LIKE ? OR s.school_address LIKE ? OR u.user_name LIKE ? OR u.user_email LIKE ?)"
    );
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    sort === "oldest" ? "ORDER BY s.created_at ASC" : "ORDER BY s.created_at DESC";

  const [rows] = await db.query(
    `
    SELECT
      s.school_id,
      s.school_name,
      s.school_address,
      s.school_phone,
      s.school_doc_url,
      s.school_doc_public_id,
      s.school_logo_url,
      s.school_logo_public_id,
      s.school_code,
      s.school_intent,
      s.verification_status,
      s.verification_note,
      s.created_at,

      u.user_name  AS coordinator_name,
      u.user_email AS coordinator_email
    FROM schools s
    LEFT JOIN users u
      ON u.school_id = s.school_id
     AND u.role = 'school_admin'
    ${whereSql}
    ${orderSql}
    `,
    params
  );

  const [[totalRow]] = await db.query(`SELECT COUNT(*) AS c FROM schools`);
  const [[pendingRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM schools WHERE verification_status='pending'`
  );
  const [[approvedRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM schools WHERE verification_status='approved'`
  );

  return {
    stats: {
      total: Number(totalRow?.c || 0),
      pending: Number(pendingRow?.c || 0),
      approved: Number(approvedRow?.c || 0),
    },
    rows,
  };
}

/* ---------------- actions ---------------- */

export async function approveSchool(school_id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [r] = await conn.query(
      `UPDATE schools
       SET verification_status='approved',
           verification_note=NULL
       WHERE school_id=?`,
      [school_id]
    );

    if (r.affectedRows === 0) {
      throw Object.assign(new Error("School not found"), { status: 404 });
    }

    await conn.query(
      `UPDATE users
       SET status='active'
       WHERE role='school_admin' AND school_id=?`,
      [school_id]
    );

    await conn.commit();
    return { message: "Approved" };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function rejectSchool(school_id, note) {
  if (!note) throw Object.assign(new Error("กรุณากรอกเหตุผลการปฏิเสธ"), { status: 400 });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [sr] = await conn.query(
      `UPDATE schools
       SET verification_status='rejected', verification_note=?
       WHERE school_id=?`,
      [note, school_id]
    );
    if (sr.affectedRows === 0) {
      throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
    }

    await conn.query(
      `UPDATE users
       SET status='rejected'
       WHERE role='school_admin' AND school_id=?`,
      [school_id]
    );

    await conn.commit();
    return { message: "Rejected", school_id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function removeSchool(school_id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM users WHERE school_id=? AND role='school_admin'`, [school_id]);
    const [r] = await conn.query(`DELETE FROM schools WHERE school_id=?`, [school_id]);

    if (r.affectedRows === 0) {
      throw Object.assign(new Error("School not found"), { status: 404 });
    }

    await conn.commit();
    return { message: "Removed" };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/* ---------------- overview ---------------- */

export async function getOverviewStats() {
  const [[usersRow]] = await db.query(`SELECT COUNT(*) AS total_users FROM users WHERE role='user'`);

  const [[schoolsRow]] = await db.query(`
    SELECT COUNT(*) AS total_schools
    FROM schools
    WHERE verification_status='approved'
  `);

  const [[productsRow]] = await db.query(`SELECT COUNT(*) AS total_products FROM products`);
  const [[ordersRow]] = await db.query(`SELECT COUNT(*) AS total_orders FROM orders`);

  return {
    total_users: Number(usersRow?.total_users || 0),
    total_schools: Number(schoolsRow?.total_schools || 0),
    total_products: Number(productsRow?.total_products || 0),
    total_orders: Number(ordersRow?.total_orders || 0),
  };
}

/* ---------------- detail + update ---------------- */

// ✅ ดูรายละเอียดโรงเรียน 1 แห่ง (ใช้กับปุ่ม "ดูเพิ่มเติม")
export async function getSchoolDetail(school_id) {
  const id = Number(school_id);
  if (!Number.isFinite(id)) {
    throw Object.assign(new Error("school_id ไม่ถูกต้อง"), { status: 400 });
  }

  const [rows] = await db.query(
    `
    SELECT
      s.school_id,
      s.school_name,
      s.school_address,
      s.school_phone,
      s.school_phone_verified,
      s.school_code,
      s.school_intent,

      s.school_doc_url,
      s.school_doc_public_id,

      s.school_logo_url,
      s.school_logo_public_id,

      s.verification_status,
      s.verification_note,
      s.created_at,

      u.user_name  AS coordinator_name,
      u.user_email AS coordinator_email
    FROM schools s
    LEFT JOIN users u
      ON u.school_id = s.school_id
     AND u.role = 'school_admin'
    WHERE s.school_id = ?
    LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
  }
  return rows[0];
}

// ✅ แก้ไขข้อมูลโรงเรียน (ใช้กับปุ่ม "บันทึก" ใน modal)
export async function updateSchool(school_id, payload = {}) {
  const id = Number(school_id);
  if (!Number.isFinite(id)) {
    throw Object.assign(new Error("school_id ไม่ถูกต้อง"), { status: 400 });
  }

  const {
    school_name,
    school_address,
    school_phone,
    school_code,
    school_intent,
    school_logo_url,
    school_logo_public_id,
  } = payload;

  // school_code ต้องเป็นตัวเลข 10 หลักพอดี
  const codeDigits = String(school_code ?? "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(codeDigits)) {
    throw Object.assign(new Error("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี"), { status: 400 });
  }

  // phone ต้องเป็นเบอร์ไทย 10 หลักขึ้นต้น 0
  const phoneDigits = normalizeThaiPhone(school_phone);
  if (!phoneDigits || !/^0\d{9}$/.test(phoneDigits)) {
    throw Object.assign(new Error("เบอร์โทรต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0"), { status: 400 });
  }

  if (!String(school_name || "").trim() || !String(school_address || "").trim()) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  }

  const [r] = await db.query(
    `UPDATE schools
     SET
       school_name=?,
       school_address=?,
       school_phone=?,
       school_code=?,
       school_intent=?,
       school_logo_url=?,
       school_logo_public_id=?
     WHERE school_id=?`,
    [
      String(school_name).trim(),
      String(school_address).trim(),
      phoneDigits,
      codeDigits,
      school_intent || null,
      school_logo_url || null,
      school_logo_public_id || null,
      id,
    ]
  );

  if (r.affectedRows === 0) {
    throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
  }

  return { message: "Updated", school_id: id };
}


export async function adminUpdateSchool(school_id, payload = {}) {
  const id = Number(school_id);
  if (!Number.isFinite(id)) {
    throw Object.assign(new Error("school_id ไม่ถูกต้อง"), { status: 400 });
  }

  const {
    // schools
    school_name,
    school_address,
    school_phone,
    school_code, // optional
    school_intent,
    school_logo_url,
    school_logo_public_id,

    // coordinator (users)
    coordinator_name,
    coordinator_email,
    coordinator_phone, // ถ้ามีใน users
  } = payload;

  // ===== validate โรงเรียน =====
  const name = String(school_name || "").trim();
  const addr = String(school_address || "").trim();
  if (!name || !addr) {
    throw Object.assign(new Error("กรุณากรอกข้อมูลโรงเรียนให้ครบ"), { status: 400 });
  }

  const phoneDigits = normalizeThaiPhone ? normalizeThaiPhone(school_phone) : String(school_phone || "").replace(/\D/g, "");
  if (!phoneDigits || !/^0\d{9}$/.test(phoneDigits)) {
    throw Object.assign(new Error("เบอร์โทรโรงเรียนต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0"), { status: 400 });
  }

  // school_code: optional สำหรับแอดมิน
  let codeDigits = null;
  if (school_code !== undefined) {
    const raw = String(school_code || "").trim();
    if (raw !== "") {
      const d = raw.replace(/\D/g, "");
      if (!/^\d{10}$/.test(d)) {
        throw Object.assign(new Error("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี"), { status: 400 });
      }
      codeDigits = d;
    }
  }

  // ===== หา coordinator user_id จากโรงเรียน =====
  // ✅ เปลี่ยนคอลัมน์นี้ให้ตรงของคุณ:
  // ถ้าโรงเรียนผูกกับ user โดย s.user_id ก็เปลี่ยน SELECT เป็น s.user_id
  const [[row]] = await db.query(
    `SELECT s.school_id, s.coordinator_user_id AS coordinator_user_id
     FROM schools s
     WHERE s.school_id = ?
     LIMIT 1`,
    [id]
  );

  if (!row) {
    throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
  }

  const coordinatorUserId = row.coordinator_user_id; // <-- ถ้าของคุณไม่ใช่ชื่อคอลัมน์นี้ ให้เปลี่ยนด้านบน

  // ===== validate coordinator (optional แต่ถ้าส่งมาให้เช็ก) =====
  const cName = String(coordinator_name ?? "").trim();
  const cEmail = String(coordinator_email ?? "").trim();
  const cPhoneRaw = String(coordinator_phone ?? "").trim();
  const cPhoneDigits = cPhoneRaw ? (normalizeThaiPhone ? normalizeThaiPhone(cPhoneRaw) : cPhoneRaw.replace(/\D/g, "")) : "";

  if (cEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail)) {
    throw Object.assign(new Error("อีเมลผู้ประสานงานไม่ถูกต้อง"), { status: 400 });
  }
  if (cPhoneRaw && !/^0\d{9}$/.test(cPhoneDigits)) {
    throw Object.assign(new Error("เบอร์ผู้ประสานงานต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0"), { status: 400 });
  }

  // ===== ทำ transaction (อัปเดต 2 ตารางพร้อมกัน) =====
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // --- update schools (dynamic) ---
    const sFields = [];
    const sVals = [];

    sFields.push("school_name=?"); sVals.push(name);
    sFields.push("school_address=?"); sVals.push(addr);
    sFields.push("school_phone=?"); sVals.push(phoneDigits);
    sFields.push("school_intent=?"); sVals.push(school_intent || null);
    sFields.push("school_logo_url=?"); sVals.push(school_logo_url || null);
    sFields.push("school_logo_public_id=?"); sVals.push(school_logo_public_id || null);

    if (codeDigits) {
      sFields.push("school_code=?");
      sVals.push(codeDigits);
    }

    sVals.push(id);

    const [r1] = await conn.query(
      `UPDATE schools SET ${sFields.join(", ")} WHERE school_id=?`,
      sVals
    );

    if (r1.affectedRows === 0) {
      throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
    }

    // --- update users (coordinator) ---
    // อัปเดตเฉพาะถ้ามี coordinatorUserId และมี field ส่งมาอย่างน้อย 1 ตัว
    const hasCoordPayload =
      coordinator_name !== undefined ||
      coordinator_email !== undefined ||
      coordinator_phone !== undefined;

    if (coordinatorUserId && hasCoordPayload) {
      const uFields = [];
      const uVals = [];

      // ⚠️ ชื่อคอลัมน์ใน users ของคุณอาจเป็น user_name/user_email/user_phone
      if (coordinator_name !== undefined) { uFields.push("user_name=?"); uVals.push(cName); }
      if (coordinator_email !== undefined) { uFields.push("user_email=?"); uVals.push(cEmail || null); }

      // ถ้าตาราง users ไม่มี phone ให้ลบบล็อคนี้ออก
      if (coordinator_phone !== undefined) { uFields.push("user_phone=?"); uVals.push(cPhoneDigits || null); }

      if (uFields.length) {
        uVals.push(coordinatorUserId);
        await conn.query(
          `UPDATE users SET ${uFields.join(", ")} WHERE user_id=?`,
          uVals
        );
      }
    }

    await conn.commit();
    return { message: "Updated", school_id: id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
