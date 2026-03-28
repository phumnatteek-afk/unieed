// backend/server/src/modules/Market/Market.routes.js
import express from "express";
import {
  batchCreateProducts,
  getProducts,
  getProductById,
  deleteProduct,
  searchSchools,
  getUniformTypes,
  getUniformTypesBySchool,
} from "./Market.controller.js";
import { auth }                from "../../middleware/auth.js";
import { uploadProductImages } from "../../config/cloudinary.js";

const router = express.Router();

// ── Static routes ก่อน dynamic (:id) เสมอ ──────────────

// GET  /api/market/schools/search?search=xx
router.get("/schools/search", searchSchools);

// GET  /api/market/uniform-types
router.get("/uniform-types", getUniformTypes);

// GET  /api/market/uniform-types/by-school/:school_id
router.get("/uniform-types/by-school/:school_id", getUniformTypesBySchool);

// POST /api/market/batch
router.post("/batch", auth, uploadProductImages, batchCreateProducts);

// ── Generic / dynamic routes ────────────────────────────

// GET  /api/market
router.get("/", getProducts);

// GET  /api/market/:id
router.get("/:id", getProductById);

// DELETE /api/market/:id
router.delete("/:id", auth, deleteProduct);

export default router;