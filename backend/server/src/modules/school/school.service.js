import { db } from "../../config/db.js";


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
