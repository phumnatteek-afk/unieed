import { db } from "../../config/db.js";

// ── ซิงค์สถานะโครงการให้ตรงกับความครบของการบริจาค ────────────────────────
// paused = ครบแล้ว ซ่อนจากฟีด / open = ยังไม่ครบ กลับสู่ฟีด
export async function syncProjectFeedStatus(request_id) {
  // เช็ค per uniform_type — ทุก type ต้องครบถึงจะ pause
  const [typeRows] = await db.query(
    `SELECT
       sn.uniform_type_id,
       SUM(sn.quantity_needed) AS needed,
       COALESCE(SUM(f.quantity_fulfilled), 0) AS fulfilled
     FROM student_need sn
     JOIN students st ON st.student_id = sn.student_id
     LEFT JOIN fulfillment f
       ON f.request_item_id = sn.student_need_id AND f.request_id = ?
     WHERE st.request_id = ?
     GROUP BY sn.uniform_type_id
     HAVING SUM(sn.quantity_needed) > 0`,
    [request_id, request_id]
  );

  if (typeRows.length === 0) return null; // ไม่มีข้อมูลนักเรียน ไม่แตะ status

  const allFulfilled = typeRows.every(r => Number(r.fulfilled) >= Number(r.needed));

  if (allFulfilled) {
    await db.query(
      `UPDATE donation_request SET status = 'paused' WHERE request_id = ? AND status = 'open'`,
      [request_id]
    );
    return "paused";
  } else {
    await db.query(
      `UPDATE donation_request SET status = 'open' WHERE request_id = ? AND status = 'paused'`,
      [request_id]
    );
    return "open";
  }
}

export async function getSchoolMe(user_id) {
  const [rows] = await db.query(
    `
    SELECT
      u.user_id,
      u.user_name,
      u.user_email,
      u.user_phone,
      u.role,
      u.school_id,
      u.status AS user_status,

      s.school_name,
      s.school_logo_url,
      s.school_address,
      s.school_phone,
      s.school_doc_url,
      s.school_doc_public_id,
      s.verification_status,
      s.verification_note
    FROM users u
    LEFT JOIN schools s ON s.school_id = u.school_id
    WHERE u.user_id = ?
    LIMIT 1
    `,
    [user_id]
  );

  const me = rows?.[0];
  if (!me) throw Object.assign(new Error("User not found"), { status: 404 });
  if (!me.school_id) throw Object.assign(new Error("No school linked"), { status: 400 });

  return me;
}
