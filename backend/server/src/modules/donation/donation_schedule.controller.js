// donation_schedule.controller.js
import {
  getScheduleBySchool,
  getScheduleByRequest,
  upsertSchedule,
} from "./donation_schedule.service.js";

const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

// ─────────────────────────────────────────────────────────────────
// GET /donations/schedule/request/:requestId   (public — ฝั่งผู้บริจาค)
// ─────────────────────────────────────────────────────────────────
export async function getScheduleForDonor(req, res, next) {
  try {
    const schedule = await getScheduleByRequest(Number(req.params.requestId));
    if (!schedule) return res.json(null);

    // parse open_days ถ้าเป็น string
    if (typeof schedule.open_days === "string") {
      try { schedule.open_days = JSON.parse(schedule.open_days); } catch { schedule.open_days = []; }
    }
    res.json(schedule);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /donations/schedule/mine   (school_admin)
// ─────────────────────────────────────────────────────────────────
export async function getMySchedule(req, res, next) {
  try {
    const schedule = await getScheduleBySchool(req.user.school_id);
    if (!schedule) return res.json(null);

    if (typeof schedule.open_days === "string") {
      try { schedule.open_days = JSON.parse(schedule.open_days); } catch { schedule.open_days = []; }
    }
    res.json(schedule);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// PUT /donations/schedule/mine   (school_admin)
// body: { open_days: string[], time_start: "HH:MM", time_end: "HH:MM", note?: string }
// ─────────────────────────────────────────────────────────────────
export async function saveMySchedule(req, res, next) {
  try {
    const { open_days, time_start, time_end, note } = req.body;

    // validate
    if (!Array.isArray(open_days) || open_days.length === 0)
      return res.status(400).json({ message: "กรุณาเลือกวันเปิดรับอย่างน้อย 1 วัน" });

    const invalidDays = open_days.filter(d => !DAY_KEYS.includes(d));
    if (invalidDays.length > 0)
      return res.status(400).json({ message: `วันที่ไม่ถูกต้อง: ${invalidDays.join(", ")}` });

    if (!time_start || !/^\d{2}:\d{2}$/.test(time_start))
      return res.status(400).json({ message: "รูปแบบ time_start ต้องเป็น HH:MM" });

    if (!time_end || !/^\d{2}:\d{2}$/.test(time_end))
      return res.status(400).json({ message: "รูปแบบ time_end ต้องเป็น HH:MM" });

    if (time_start >= time_end)
      return res.status(400).json({ message: "เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด" });

    const saved = await upsertSchedule(req.user.school_id, {
      open_days,
      time_start,
      time_end,
      note: note?.trim() || null,
    });

    if (typeof saved.open_days === "string") {
      try { saved.open_days = JSON.parse(saved.open_days); } catch { saved.open_days = []; }
    }

    res.json({ message: "บันทึกตารางเรียบร้อย", schedule: saved });
  } catch (err) {
    next(err);
  }
}