import { Router } from "express";
import { home } from "./home.controller.js";

const router = Router();

router.get("/home", home);

export default router;
