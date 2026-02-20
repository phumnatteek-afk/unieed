import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { registerGeneral, registerSchoolOneStep, login, mySchoolStatus,
  requestOtp,
  verifyOtp } from "./auth.controller.js";

const r = Router();

r.post("/register/general", registerGeneral);
r.post("/register/school", registerSchoolOneStep);
r.post("/login", login);

// ✅ โรงเรียนเช็คสถานะเองหลัง login
r.get("/school/status", auth, mySchoolStatus);

r.post("/otp/request", requestOtp);
r.post("/otp/verify", verifyOtp);

export default r;
