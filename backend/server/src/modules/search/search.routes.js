// src/modules/search/search.routes.js
import { Router } from "express";
import { searchProjects, searchProducts } from "./search.service.js";

const r = Router();

/**
 * GET /api/search/projects?q=...&province=...&status=open&limit=30
 */
r.get("/projects", async (req, res, next) => {
  try {
    const { q = "", province, status, limit } = req.query;
    const result = await searchProjects(q, {
      province,
      status:  status || "open",
      limit:   Math.min(Number(limit) || 30, 100),
    });
    res.json(result);
  } catch (err) {
    // If Meilisearch is not running, return empty gracefully
    console.warn("[search] Meilisearch unavailable:", err.message);
    res.json({ hits: [], estimatedTotalHits: 0 });
  }
});

/**
 * GET /api/search/products?q=...&gender=...&uniform_type_id=...&limit=40
 */
r.get("/products", async (req, res, next) => {
  try {
    const { q = "", gender, uniform_type_id, school_id, limit } = req.query;
    const result = await searchProducts(q, {
      gender,
      uniform_type_id: uniform_type_id ? Number(uniform_type_id) : undefined,
      school_id:       school_id       ? Number(school_id)       : undefined,
      limit:           Math.min(Number(limit) || 40, 200),
    });
    res.json(result);
  } catch (err) {
    console.warn("[search] Meilisearch unavailable:", err.message);
    res.json({ hits: [], estimatedTotalHits: 0 });
  }
});

export default r;
