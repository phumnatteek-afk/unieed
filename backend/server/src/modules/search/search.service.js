// src/modules/search/search.service.js — Meilisearch indexing + search
import { meili } from "../../config/meilisearch.js";
import { db }    from "../../config/db.js";

// ── Index names ────────────────────────────────────────────────────────────────
const IDX_PROJECTS = "projects";
const IDX_PRODUCTS = "products";

// ── Size JSON → human-readable label ─────────────────────────────────────────
function buildSizeLabel(sizeRaw) {
  try {
    const s = typeof sizeRaw === "string" ? JSON.parse(sizeRaw) : (sizeRaw || {});
    const parts = [];
    if (s.chest)  parts.push(`อก ${s.chest}`);
    if (s.waist)  parts.push(`เอว ${s.waist}`);
    if (s.length) parts.push(`ยาว ${s.length}`);
    if (s.hip)    parts.push(`สะโพก ${s.hip}`);
    const nums = [...new Set(Object.values(s).map(String))].join(" ");
    return parts.length ? `${parts.join(" ")} ${nums}` : nums;
  } catch {
    return typeof sizeRaw === "string" ? sizeRaw : "";
  }
}

// ── Get product IDs matched to active donation projects (type+gender match) ──
async function getDonationMatchedProductIds() {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT p.product_id
      FROM products p
      JOIN uniform_type ut_p ON ut_p.uniform_type_id = p.uniform_type_id
      JOIN student_need sn   ON sn.uniform_type_id   = p.uniform_type_id
      JOIN students st        ON st.student_id        = sn.student_id
      JOIN donation_request dr ON dr.request_id      = st.request_id
      WHERE dr.status   = 'open'
        AND p.status    = 'available'
        AND (p.gender   = ut_p.gender OR p.gender IS NULL OR ut_p.gender IS NULL)
    `);
    return new Set(rows.map(r => r.product_id));
  } catch {
    return new Set();
  }
}

// ── Configure indexes (searchable + filterable attributes) ────────────────────
async function configureIndexes() {
  // Projects index — createIndex is idempotent (ignores error if already exists)
  try { await meili.createIndex(IDX_PROJECTS, { primaryKey: "request_id" }); } catch { /* already exists */ }
  await meili.index(IDX_PROJECTS).updateSettings({
    searchableAttributes: [
      "request_title", "school_name", "school_province",
      "school_address", "uniform_types", "description",
    ],
    filterableAttributes: ["status", "school_province", "uniform_category"],
    sortableAttributes:   ["created_at", "total_needed"],
    rankingRules: [
      "words", "typo", "proximity", "attribute", "sort", "exactness",
    ],
  });

  // Products index
  try { await meili.createIndex(IDX_PRODUCTS, { primaryKey: "product_id" }); } catch { /* already exists */ }
  await meili.index(IDX_PRODUCTS).updateSettings({
    searchableAttributes: [
      "product_title", "school_name",
      "type_name", "custom_type_name",
      "condition_label", "level",
      "size_label",   // "อก 30 ยาว 27" etc.
      "tags",         // ["ซื้อเพื่อบริจาค","บริจาค","ส่งต่อ"] for donation-matched products
    ],
    filterableAttributes: ["status", "gender", "uniform_type_id", "condition_label", "is_donation"],
    sortableAttributes:   ["created_at", "price", "is_donation"],
  });
}

// ── Seed helpers ────────────────────────────────────────────────────────────────

async function loadProjects() {
  const [rows] = await db.query(`
    SELECT
      dr.request_id,
      dr.request_title,
      dr.status,
      dr.request_description AS description,
      dr.created_at,
      s.school_name,
      s.province   AS school_province,
      s.school_address,
      GROUP_CONCAT(DISTINCT ut.type_name   ORDER BY ut.type_name SEPARATOR ', ')        AS uniform_types,
      GROUP_CONCAT(DISTINCT ut.uniform_category ORDER BY ut.uniform_category SEPARATOR ',') AS uniform_category,
      COALESCE(SUM(sn.quantity_needed - COALESCE(sn.quantity_received,0)), 0)            AS total_needed
    FROM donation_request dr
    JOIN schools      s  ON s.school_id       = dr.school_id
    LEFT JOIN students   st ON st.request_id  = dr.request_id
    LEFT JOIN student_need sn ON sn.student_id = st.student_id
    LEFT JOIN uniform_type ut ON ut.uniform_type_id = sn.uniform_type_id
    WHERE s.verification_status = 'approved'
    GROUP BY dr.request_id
    ORDER BY dr.created_at DESC
    LIMIT 500
  `);
  return rows.map(r => ({
    ...r,
    created_at:  r.created_at ? new Date(r.created_at).getTime() : 0,
    total_needed: Number(r.total_needed || 0),
  }));
}

async function loadProducts() {
  const [rows] = await db.query(`
    SELECT
      p.product_id,
      p.product_title,
      p.price,
      p.status,
      p.gender,
      p.uniform_type_id,
      p.school_name,
      p.level,
      p.condition_label,
      p.custom_type_name,
      p.size,
      p.created_at,
      ut.type_name
    FROM products p
    LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
    WHERE p.status = 'available'
    ORDER BY p.created_at DESC
    LIMIT 2000
  `);

  const donationIds = await getDonationMatchedProductIds();

  return rows.map(r => {
    const isDonation = donationIds.has(r.product_id);
    return {
      ...r,
      created_at:  r.created_at ? new Date(r.created_at).getTime() : 0,
      price:       Number(r.price || 0),
      size_label:  buildSizeLabel(r.size),
      is_donation: isDonation ? 1 : 0,
      tags:        isDonation ? ["ซื้อเพื่อบริจาค", "บริจาค", "ส่งต่อ", "โรงเรียน"] : [],
    };
  });
}

// ── Public: seed all indexes (called on server start) ─────────────────────────
export async function seedIndexes() {
  await configureIndexes();

  const [projects, products] = await Promise.all([loadProjects(), loadProducts()]);

  if (projects.length) {
    await meili.index(IDX_PROJECTS).addDocuments(projects);
    console.log(`[meilisearch] seeded ${projects.length} projects`);
  }
  if (products.length) {
    await meili.index(IDX_PRODUCTS).addDocuments(products);
    console.log(`[meilisearch] seeded ${products.length} products`);
  }
}

// ── Public: search functions ──────────────────────────────────────────────────

/**
 * searchProjects(q, { province, status, limit })
 * Returns ranked project results from Meilisearch
 */
export async function searchProjects(q, { province, status = "open", limit = 30 } = {}) {
  const filter = [];
  if (status)   filter.push(`status = "${status}"`);
  if (province) filter.push(`school_province = "${province}"`);

  const result = await meili.index(IDX_PROJECTS).search(q || "", {
    limit,
    filter: filter.length ? filter.join(" AND ") : undefined,
    attributesToHighlight: ["request_title", "school_name"],
    highlightPreTag:  "<mark>",
    highlightPostTag: "</mark>",
  });
  return result;
}

/**
 * searchProducts(q, { gender, uniform_type_id, school_id, limit })
 */
export async function searchProducts(q, { gender, uniform_type_id, school_id, limit = 40 } = {}) {
  const filter = [`status = "available"`];
  if (gender)          filter.push(`gender = "${gender}"`);
  if (uniform_type_id) filter.push(`uniform_type_id = ${Number(uniform_type_id)}`);

  const result = await meili.index(IDX_PRODUCTS).search(q || "", {
    limit,
    filter: filter.join(" AND "),
    attributesToHighlight: ["product_title", "school_name", "type_name"],
    highlightPreTag:  "<mark>",
    highlightPostTag: "</mark>",
  });
  return result;
}

// ── Sync helpers (call after DB mutations) ────────────────────────────────────

export async function syncProject(requestId) {
  try {
    const [rows] = await db.query(`
      SELECT
        dr.request_id, dr.request_title, dr.status, dr.request_description AS description, dr.created_at,
        s.school_name, s.province AS school_province, s.school_address,
        GROUP_CONCAT(DISTINCT ut.type_name SEPARATOR ', ')           AS uniform_types,
        GROUP_CONCAT(DISTINCT ut.uniform_category SEPARATOR ',')     AS uniform_category,
        COALESCE(SUM(sn.quantity_needed - COALESCE(sn.quantity_received,0)), 0) AS total_needed
      FROM donation_request dr
      JOIN schools s ON s.school_id = dr.school_id
      LEFT JOIN students st ON st.request_id = dr.request_id
      LEFT JOIN student_need sn ON sn.student_id = st.student_id
      LEFT JOIN uniform_type ut ON ut.uniform_type_id = sn.uniform_type_id
      WHERE dr.request_id = ?
      GROUP BY dr.request_id
    `, [requestId]);
    if (rows[0]) {
      const doc = { ...rows[0], created_at: new Date(rows[0].created_at).getTime(), total_needed: Number(rows[0].total_needed || 0) };
      await meili.index(IDX_PROJECTS).addDocuments([doc]);
    }
  } catch (e) { console.warn("[meilisearch] syncProject:", e.message); }
}

export async function syncProduct(productId) {
  try {
    const [rows] = await db.query(`
      SELECT p.*, ut.type_name FROM products p
      LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
      WHERE p.product_id = ?
    `, [productId]);
    if (rows[0]) {
      const r = rows[0];
      const donationIds = await getDonationMatchedProductIds();
      const isDonation  = donationIds.has(r.product_id);
      await meili.index(IDX_PRODUCTS).addDocuments([{
        ...r,
        created_at:  new Date(r.created_at).getTime(),
        price:       Number(r.price || 0),
        size_label:  buildSizeLabel(r.size),
        is_donation: isDonation ? 1 : 0,
        tags:        isDonation ? ["ซื้อเพื่อบริจาค", "บริจาค", "ส่งต่อ", "โรงเรียน"] : [],
      }]);
    }
  } catch (e) { console.warn("[meilisearch] syncProduct:", e.message); }
}

export async function deleteProjectFromIndex(requestId) {
  try { await meili.index(IDX_PROJECTS).deleteDocument(requestId); } catch { /* ignore */ }
}

export async function deleteProductFromIndex(productId) {
  try { await meili.index(IDX_PRODUCTS).deleteDocument(productId); } catch { /* ignore */ }
}
