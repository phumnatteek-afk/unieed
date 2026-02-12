import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { adminListSchools, adminApproveSchool, adminRemoveSchool } from "./admin.controller.js";
import { adminOverview } from "./admin.controller.js";
import { adminRejectSchool } from "./admin.controller.js";

const r = Router();

r.get("/schools", auth, requireRole(["admin"]), adminListSchools);
r.post("/schools/:id/approve", auth, requireRole(["admin"]), adminApproveSchool);
r.delete("/schools/:id", auth, requireRole(["admin"]), adminRemoveSchool);
r.get("/overview", auth, requireRole(["admin"]), adminOverview);
r.post("/schools/:id/reject", auth, requireRole(["admin"]), adminRejectSchool);


export default r;


