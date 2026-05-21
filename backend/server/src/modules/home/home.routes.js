import { Router } from "express";
import { home, projectsByProvince, highDemandProvinces } from "./home.controller.js";

const router = Router();

router.get("/home", home);
router.get("/projects/by-province", projectsByProvince);   // ?province=เชียงใหม่
router.get("/projects/high-demand", highDemandProvinces);  // ?exclude=ชลบุรี&limit=3

export default router;
