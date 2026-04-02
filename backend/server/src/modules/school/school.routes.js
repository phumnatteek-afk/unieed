import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

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
  exportStudentsExcel,
  getProjectById,
  getProjectByIdPublic,
  updateProject,
  uploadProjectImage,
  uploadUniformImage,
  deleteUniformImage,
} from "./school.controller.js";

import { getTestimonials, createTestimonial, updateTestimonial, patchTestimonial, deleteTestimonial } from "./school.controller.js";

const r = Router();

// ── School profile ────────────────────────────────────────────────────────────
r.get("/me", auth, requireRole(["school_admin"]), schoolMe);

// ── Uniform types ─────────────────────────────────────────────────────────────
r.get("/uniform-types", auth, requireRole(["school_admin"]), getUniformTypes);

// ── Students ──────────────────────────────────────────────────────────────────
r.get("/projects/:request_id/students",                auth, requireRole(["school_admin"]), listProjectStudents);
r.get("/projects/:request_id/students/export",         auth, requireRole(["school_admin"]), exportStudentsExcel);
r.post("/projects/:request_id/students",               auth, requireRole(["school_admin"]), createStudentWithNeeds);
r.put("/projects/:request_id/students/:student_id",    auth, requireRole(["school_admin"]), updateStudentWithNeeds);
r.delete("/projects/:request_id/students/:student_id", auth, requireRole(["school_admin"]), deleteStudent);

// ── Projects (static routes ก่อน dynamic เสมอ) ───────────────────────────────
r.get("/projects/public/:request_id", getProjectByIdPublic);                              // ✅ public — ไม่ต้อง auth
r.get("/projects/latest",  auth, requireRole(["school_admin"]), getLatestProject);
r.post("/projects",        auth, requireRole(["school_admin"]), createProject);
r.get("/projects",         auth, requireRole(["school_admin"]), listSchoolProjects);

// dynamic routes — ต้องอยู่หลัง static ทั้งหมด
r.get("/projects/:request_id", auth, requireRole(["school_admin"]), getProjectById);
r.put("/projects/:request_id", auth, requireRole(["school_admin"]), updateProject);

// ── Project image ─────────────────────────────────────────────────────────────
r.post(
  "/projects/:request_id/image",
  auth,
  requireRole(["school_admin"]),
  upload.single("image"),
  uploadProjectImage
);

// ── Uniform images ────────────────────────────────────────────────────────────
r.post(
  "/projects/:request_id/uniform-images/:uniform_type_id",
  auth,
  requireRole(["school_admin"]),
  upload.single("image"),
  uploadUniformImage
);

r.delete(
  "/projects/:request_id/uniform-images/:uniform_type_id",
  auth,
  requireRole(["school_admin"]),
  deleteUniformImage
);

// ── Testimonials ──────────────────────────────────────────────────────────────
r.get("/testimonials",       auth, requireRole(["school_admin"]), getTestimonials);
r.post("/testimonials",      auth, requireRole(["school_admin"]), upload.single("image"), createTestimonial);
r.put("/testimonials/:id",   auth, requireRole(["school_admin"]), upload.single("image"), updateTestimonial);
r.patch("/testimonials/:id", auth, requireRole(["school_admin"]), patchTestimonial);
r.delete("/testimonials/:id",auth, requireRole(["school_admin"]), deleteTestimonial);

export default r;