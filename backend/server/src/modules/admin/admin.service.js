import { db } from "../../config/db.js";

export async function listSchools({ status = "", q = "", sort = "latest" } = {}) {
  const where = [];
  const params = [];

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.push("s.verification_status = ?");
    params.push(status);
  }

  if (q) {
    where.push("(s.school_name LIKE ? OR s.school_address LIKE ? OR u.user_name LIKE ? OR u.user_email LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql = sort === "oldest" ? "ORDER BY s.created_at ASC" : "ORDER BY s.created_at DESC";

  const [rows] = await db.query(
    `
    SELECT
      s.school_id,
      s.school_name,
      s.school_address,
      s.school_phone,
      s.school_doc_url,
      s.school_doc_public_id,
      s.verification_status,
      s.verification_note,
      s.created_at,

      u.user_name AS coordinator_name,
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
  const [[pendingRow]] = await db.query(`SELECT COUNT(*) AS c FROM schools WHERE verification_status='pending'`);
  const [[approvedRow]] = await db.query(`SELECT COUNT(*) AS c FROM schools WHERE verification_status='approved'`);

  return {
    stats: {
      total: Number(totalRow?.c || 0),
      pending: Number(pendingRow?.c || 0),
      approved: Number(approvedRow?.c || 0),
    },
    rows,
  };
}

// export async function approveSchool(school_id) {
//   const [r] = await db.query(
//     `UPDATE schools
//      SET verification_status='approved', verification_note=NULL
//      WHERE school_id=?`,
//     [school_id]
//   );
//   if (r.affectedRows === 0) throw Object.assign(new Error("School not found"), { status: 404 });
//   return { message: "Approved" };
// }

export async function approveSchool(school_id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) อัปเดตสถานะโรงเรียน
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

    // 2) อัปเดตสถานะผู้ประสานงานให้ active
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
    if (r.affectedRows === 0) throw Object.assign(new Error("School not found"), { status: 404 });
    await conn.commit();
    return { message: "Removed" };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getOverviewStats() {
  const [[usersRow]] = await db.query(
    `SELECT COUNT(*) AS total_users FROM users WHERE role='user'`
  );

  const [[schoolsRow]] = await db.query(
    `SELECT COUNT(*) AS total_schools
     FROM schools
     WHERE verification_status='approved'`
  );

  const [[productsRow]] = await db.query(
    `SELECT COUNT(*) AS total_products FROM products`
  );

  const [[ordersRow]] = await db.query(
    `SELECT COUNT(*) AS total_orders FROM orders`
  );

  return {
    total_users: Number(usersRow?.total_users || 0),
    total_schools: Number(schoolsRow?.total_schools || 0),
    total_products: Number(productsRow?.total_products || 0),
    total_orders: Number(ordersRow?.total_orders || 0),
  };
}

