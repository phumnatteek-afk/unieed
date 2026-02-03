import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { listSchools, getSchool, approveSchool, rejectSchool } from "./admin.controller.js";

const r = Router();
r.use(auth, requireRole("admin"));

r.get("/schools", listSchools);
r.get("/schools/:id", getSchool);
r.post("/schools/:id/approve", approveSchool);
r.post("/schools/:id/reject", rejectSchool);

export default r;
