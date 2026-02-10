import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { schoolMe } from "./school.controller.js";

const r = Router();

r.get("/me", auth, requireRole(["school_admin"]), schoolMe);

export default r;

