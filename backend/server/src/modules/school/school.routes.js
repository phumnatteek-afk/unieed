import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });
import { getProjectById, updateProject, uploadProjectImage } from "./school.controller.js";


import {
  schoolMe,
  getUniformTypes,
  listProjectStudents,
  createStudentWithNeeds,
  updateStudentWithNeeds,
  deleteStudent,
  createProject,
  listSchoolProjects,
  getLatestProject,
//   getProjectById,
//   updateProject,
//   uploadProjectImage,
} from "./school.controller.js";


const r = Router();

r.get("/me", auth, requireRole(["school_admin"]), schoolMe);

// ✅ แนะนำให้มี auth ด้วย (กันคนอื่นยิง API ได้)
// (ถ้าไม่อยาก auth ก็ได้ แต่ต้องแน่ใจว่า controller ไม่ใช้ req.user)
r.get("/uniform-types", auth, requireRole(["school_admin"]), getUniformTypes);

// ✅ ทุกอันนี้ใช้ req.user.school_id → ต้องมี auth
r.get("/projects/:request_id/students", auth, requireRole(["school_admin"]), listProjectStudents);
r.post("/projects/:request_id/students", auth, requireRole(["school_admin"]), createStudentWithNeeds);
r.put("/projects/:request_id/students/:student_id", auth, requireRole(["school_admin"]), updateStudentWithNeeds);
r.delete("/projects/:request_id/students/:student_id", auth, requireRole(["school_admin"]), deleteStudent);

r.post("/projects", auth, requireRole(["school_admin"]), createProject);
r.get("/projects", auth, requireRole(["school_admin"]), listSchoolProjects);
r.get("/projects/latest", auth, requireRole(["school_admin"]), getLatestProject);
r.get("/projects/:request_id", auth, requireRole(["school_admin"]), getProjectById);
r.put("/projects/:request_id", auth, requireRole(["school_admin"]), updateProject);

r.post(
  "/projects/:request_id/image",
  auth,
  requireRole(["school_admin"]),
  upload.single("image"),
  uploadProjectImage
);

export default r;
