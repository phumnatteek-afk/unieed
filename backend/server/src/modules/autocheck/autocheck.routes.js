// autocheck.routes.js
// เพิ่ม route นี้ใน app.js/server.js:
//   import autocheckRoutes from "./routes/autocheck.routes.js";
//   app.use("/admin/autocheck", autocheckRoutes);
// และเรียก initAutoCheckScheduler() ตอน startup:
//   import { initAutoCheckScheduler } from "./features/autocheck/autocheck.controller.js";
//   initAutoCheckScheduler();

import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  triggerAutoCheck,
  listOverdueDonations,
  listOverdueBySchool,
} from "./autocheck.controller.js";

const r = Router();

// ทุก route ต้องเป็น admin เท่านั้น
r.use(auth, requireRole(["admin"]));

// Manual trigger
r.post("/run", triggerAutoCheck);

// ดูรายการ overdue ทั้งหมด
r.get("/overdue", listOverdueDonations);

// ดูรายการจัดกลุ่มตามโรงเรียน
r.get("/overdue/by-school", listOverdueBySchool);

export default r;