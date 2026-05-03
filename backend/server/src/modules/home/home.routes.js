import { Router } from "express";
import { home, projectsByProvince } from "./home.controller.js";

const router = Router();

router.get("/home", home);
router.get("/projects/by-province", projectsByProvince);  // ?province=เชียงใหม่

export default router;
