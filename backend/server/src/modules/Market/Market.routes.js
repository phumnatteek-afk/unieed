// backend/server/src/modules/Market/Market.routes.js
import express from "express";
import {
  batchCreateProducts,
  getProducts,
  getProductById,
  deleteProduct,
  searchSchools,
  getUniformTypes,
} from "./Market.controller.js";
import { auth }                from "../../middleware/auth.js";
import { uploadProductImages } from "../../config/cloudinary.js";

const router = express.Router();

// ── Static routes ก่อน dynamic (:id) เสมอ ──────────────

// GET  /api/market/schools/search?search=xx   — school autocomplete
router.get("/schools/search", searchSchools);

// GET  /api/market/uniform-types              — dropdown data
router.get("/uniform-types", getUniformTypes);

// POST /api/market/batch                      — batch create (protected)
router.post(
  "/batch",
  auth,
  uploadProductImages,    // multer: item0_images … item9_images
  batchCreateProducts
);

// ── Generic / dynamic routes ────────────────────────────

// GET  /api/market                            — listing (MarketPage)
router.get("/", getProducts);

// GET  /api/market/:id                        — product detail
router.get("/:id", getProductById);

// DELETE /api/market/:id                      — delete (protected)
router.delete("/:id", auth, deleteProduct);

export default router;