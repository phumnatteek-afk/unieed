import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { registerGeneral, registerSchoolOneStep, login, mySchoolStatus } from "./auth.controller.js";

const r = Router();

r.post("/register/general", registerGeneral);
r.post("/register/school", registerSchoolOneStep);
r.post("/login", login);

// ✅ โรงเรียนเช็คสถานะเองหลัง login
r.get("/school/status", auth, mySchoolStatus);

export default r;
