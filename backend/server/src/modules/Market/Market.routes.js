// backend/server/src/modules/Market/Market.routes.js
import express from "express";
import {
  batchCreateProducts,
  getProducts,
  getProductById,
  deleteProduct,
  updateProduct,
  searchSchools,
  getUniformTypes,
  getUniformTypesBySchool,
  getRelatedProducts,
  getMatchedProducts,
  getRecommendedProjectsByProduct,
} from "./Market.controller.js";
import { auth }                from "../../middleware/auth.js";
import { uploadProductImages, uploadMarketPatchImages } from "../../config/cloudinary.js";

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

router.get("/matched", getMatchedProducts);

// GET  /api/market/:id/related
router.get("/:id/related", getRelatedProducts);

// GET /api/market/:id/recommended-projects
router.get("/:id/recommended-projects", getRecommendedProjectsByProduct);

// GET  /api/market/:id
router.get("/:id", getProductById);


// DELETE /api/market/:id
router.delete("/:id", auth, deleteProduct);
router.patch("/:id", auth, uploadMarketPatchImages, updateProduct);

export default router;