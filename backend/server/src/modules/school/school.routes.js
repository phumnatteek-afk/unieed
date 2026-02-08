import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { getMySchool } from "./school.controller.js";

const r = Router();
r.get("/me", auth, getMySchool);
export default r;
