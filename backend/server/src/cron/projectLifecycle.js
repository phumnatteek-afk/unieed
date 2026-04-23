import { db } from "../config/db.js";

// รันทุกวัน: auto-close โครงการที่ถึง end_date แล้ว + auto-archive หลัง closed 14 วัน
export async function runProjectLifecycleCron() {
  try {
    // 1. open → closed เมื่อถึง end_date
    const [closeResult] = await db.query(
      `UPDATE donation_request
       SET status = 'closed'
       WHERE status = 'open'
         AND end_date IS NOT NULL
         AND end_date <= CURDATE()`
    );

    // 2. closed → archived เมื่อผ่าน end_date ไปแล้ว 14 วัน
    const [archiveResult] = await db.query(
      `UPDATE donation_request
       SET status = 'archived'
       WHERE status = 'closed'
         AND end_date IS NOT NULL
         AND end_date <= DATE_SUB(CURDATE(), INTERVAL 14 DAY)`
    );

    if (closeResult.affectedRows > 0)
      console.log(`[Cron] auto-closed ${closeResult.affectedRows} project(s)`);
    if (archiveResult.affectedRows > 0)
      console.log(`[Cron] auto-archived ${archiveResult.affectedRows} project(s)`);
  } catch (err) {
    console.error("[Cron] projectLifecycle error:", err.message);
  }
}
