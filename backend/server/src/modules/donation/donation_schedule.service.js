// donation_schedule.service.js
// บริการจัดการตารางรับ Drop-off ของโรงเรียน
import { db } from "../../config/db.js";

// ─────────────────────────────────────────────────────────────────
// ดึงตารางรับของของโรงเรียน ผ่าน request_id
// ─────────────────────────────────────────────────────────────────
export async function getScheduleByRequest(request_id) {
  const [rows] = await db.query(
    `SELECT s.*
     FROM dropoff_schedule s
     JOIN donation_request r ON r.school_id = s.school_id
     WHERE r.request_id = ?
     LIMIT 1`,
    [request_id]
  );
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────
// ดึงตารางรับของของโรงเรียน ผ่าน school_id (สำหรับ school_admin)
// ─────────────────────────────────────────────────────────────────
export async function getScheduleBySchool(school_id) {
  const [rows] = await db.query(
    "SELECT * FROM dropoff_schedule WHERE school_id = ? LIMIT 1",
    [school_id]
  );
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────
// สร้างหรืออัปเดตตาราง (UPSERT)
// open_days  : JSON array เช่น ["monday","tuesday","friday"]
// time_start : "08:00"
// time_end   : "15:30"
// note       : string | null
// ─────────────────────────────────────────────────────────────────
export async function upsertSchedule(school_id, { open_days, time_start, time_end, note }) {
  const existing = await getScheduleBySchool(school_id);
  if (existing) {
    await db.query(
      `UPDATE dropoff_schedule
       SET open_days = ?, time_start = ?, time_end = ?, note = ?, updated_at = NOW()
       WHERE school_id = ?`,
      [JSON.stringify(open_days), time_start, time_end, note ?? null, school_id]
    );
  } else {
    await db.query(
      `INSERT INTO dropoff_schedule (school_id, open_days, time_start, time_end, note, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [school_id, JSON.stringify(open_days), time_start, time_end, note ?? null]
    );
  }
  return getScheduleBySchool(school_id);
}