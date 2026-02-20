import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  adminListSchools,
  adminApproveSchool,
  adminRejectSchool,
  adminRemoveSchool,
  adminOverview,
  getSchoolDetail,
  updateSchool,
  adminUpdateSchool,  
} from "./admin.controller.js";

const r = Router();

r.get("/schools", auth, requireRole(["admin"]), adminListSchools);
r.get("/schools/:id", auth, requireRole(["admin"]), getSchoolDetail);

r.put("/schools/:id", auth, requireRole(["admin"]), updateSchool);

r.post("/schools/:id/approve", auth, requireRole(["admin"]), adminApproveSchool);
r.post("/schools/:id/reject", auth, requireRole(["admin"]), adminRejectSchool);
r.delete("/schools/:id", auth, requireRole(["admin"]), adminRemoveSchool);

r.get("/overview", auth, requireRole(["admin"]), adminOverview);

r.patch("/schools/:id", auth, requireRole(["admin"]), adminUpdateSchool);


export default r;
