// autocheck.controller.js
// ─────────────────────────────────────────────────────────────────────────────
// Controller + Cron Scheduler สำหรับ Auto-check system
// ─────────────────────────────────────────────────────────────────────────────

import {
  runAutoCheck,
  getOverdueDonations,
  getOverdueDonationsBySchool,
} from "./autocheck.service.js";

// ── Cron Scheduler ───────────────────────────────────────────────────────────
// ใช้ node-cron (npm install node-cron)
// เรียก initAutoCheckScheduler() ใน app.js / server.js ตอน startup

let _cronJob = null;

export function initAutoCheckScheduler() {
  // Lazy import เพื่อ optional dependency
  import("node-cron")
    .then(({ default: cron }) => {
      // รันทุก 1 ชั่วโมง: "0 * * * *"
      // ทดสอบ: ทุก 5 นาที → "*/5 * * * *"
      _cronJob = cron.schedule("0 * * * *", async () => {
        try {
          await runAutoCheck();
        } catch (err) {
          console.error("[AutoCheck Cron] Unhandled error:", err);
        }
      });
      console.log("[AutoCheck] ✅ Cron scheduler started (every hour)");
    })
    .catch(() => {
      console.warn(
        "[AutoCheck] ⚠️  node-cron not installed. Run: npm install node-cron\n" +
          "             Auto-check will only run via manual API trigger."
      );
    });
}

export function stopAutoCheckScheduler() {
  _cronJob?.stop();
  _cronJob = null;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /admin/autocheck/run
 * Manual trigger — Admin กด "รันทันที" จาก dashboard
 */
export async function triggerAutoCheck(req, res) {
  try {
    const summary = await runAutoCheck();
    res.json({ success: true, summary });
  } catch (err) {
    console.error("[AutoCheck] Manual trigger error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /admin/autocheck/overdue
 * ดึงรายการทั้งหมดที่เกิน 7 วัน (flat list)
 */
export async function listOverdueDonations(req, res) {
  try {
    const donations = await getOverdueDonations();
    res.json({ success: true, donations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /admin/autocheck/overdue/by-school
 * ดึงรายการจัดกลุ่มตามโรงเรียน สำหรับ Admin Donation Management page
 */
export async function listOverdueBySchool(req, res) {
  try {
    const schools = await getOverdueDonationsBySchool();
    res.json({ success: true, schools });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}