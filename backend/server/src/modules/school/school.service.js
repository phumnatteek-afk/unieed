import { db } from "../../config/db.js";

export async function getMySchool(user) {
  if (!user.school_id) return null;

  const [rows] = await db.query(
    "SELECT school_id, school_name, verification_status, verification_note FROM schools WHERE school_id=?",
    [user.school_id]
  );
  return rows[0] || null;
}

