// backend/server/src/modules/Market/Market.controller.js
import {
  batchCreateProducts as svcBatch,
  getProducts         as svcGetProducts,
  getProductById      as svcGetById,
  deleteProduct       as svcDelete,
  updateProduct       as svcUpdate,
  searchSchools       as svcSearchSchools,
  getUniformTypes     as svcGetTypes,
  getUniformTypesBySchool as svcGetTypesBySchool,
  getRelatedProducts  as svcGetRelated,
  getMatchedProducts  as svcGetMatched,
  getRecommendedProjectsByProduct as svcGetRecommendedProjectsByProduct,
  
} from "./Market.service.js";

// ─────────────────────────────────────────────────────────
// POST /api/market/batch
// multipart/form-data:
//   items        : JSON string []  (แต่ละ item มี school_name แทน global school_id)
//   item0_images : File[] (max 4)
//   item1_images : ...
// ─────────────────────────────────────────────────────────
const batchCreateProducts = async (req, res) => {
  let items;
  try {
    items = JSON.parse(req.body.items || '[]');
  } catch {
    return res.status(400).json({ message: 'รูปแบบ items ไม่ถูกต้อง' });
  }

  if (!items.length)
    return res.status(400).json({ message: 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ' });

  try {
    const result = await svcBatch({
      items,
      files:    req.files,
      sellerId: req.user.user_id,
    });
    res.status(201).json({
      message:  `ลงขายสำเร็จ ${result.created.length} รายการ`,
      products: result.created,
      newRole:  result.newRole,
    });
  } catch (err) {
    console.error('[Market.batchCreate]', err);
    res.status(err.status || 500).json({ message: err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
};

// ─────────────────────────────────────────────────────────
// GET /api/market
// Query: search, uniform_type_id, level, min_price, max_price,
//        school_id, sort, page, limit
// ─────────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const {
  search = '', ids: idsRaw, uniform_type_id, category_id, gender, level,
  min_price, max_price, school_id,
  sort = 'newest', page = 1, limit = 12,
} = req.query;

// ids=1,2,3 — from Meilisearch hits; skip MySQL text search when provided
const ids = idsRaw
  ? idsRaw.split(',').map(Number).filter(n => n > 0)
  : undefined;

const data = await svcGetProducts({
  search: ids?.length ? '' : search,
  ids, category_id, gender, uniform_type_id, level, min_price, max_price, school_id, sort, page, limit,
});
    res.json(data);
  } catch (err) {
    console.error('[Market.getProducts]', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};

// ─────────────────────────────────────────────────────────
// GET /api/market/:id
// ─────────────────────────────────────────────────────────
const getProductById = async (req, res) => {
  try {
    const product = await svcGetById(req.params.id);
    if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    res.json(product);
  } catch (err) {
    console.error('[Market.getProductById]', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};

const getRelatedProducts = async (req, res) => {
  try {
    const { category_id, gender, level, limit = 6 } = req.query;
    const rows = await svcGetRelated({
      productId:  req.params.id,
      categoryId: category_id,
      gender,
      level,
      limit,
    });
    res.json(rows);
  } catch (err) {
    console.error("[Market.getRelated]", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
};
 

// ─────────────────────────────────────────────────────────
// DELETE /api/market/:id
// ─────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    await svcDelete(req.params.id, req.user.user_id, req.user.role);
    res.json({ message: 'ลบสินค้าสำเร็จ' });
  } catch (err) {
    console.error('[Market.deleteProduct]', err);
    res.status(err.status || 500).json({ message: err.message || 'เกิดข้อผิดพลาด' });
  }
};

// ─────────────────────────────────────────────────────────
// PATCH /api/market/:id
// ─────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    let payload = {};
    if (typeof req.body?.patch === "string") {
      try {
        payload = JSON.parse(req.body.patch);
      } catch {
        return res.status(400).json({ message: "รูปแบบข้อมูลไม่ถูกต้อง" });
      }
    } else if (req.body && typeof req.body === "object") {
      payload = { ...req.body };
    }
    const files = Array.isArray(req.files) ? req.files : [];
    const updated = await svcUpdate(req.params.id, req.user.user_id, req.user.role, payload, files);
    res.json({ message: "อัปเดตสินค้าสำเร็จ", product: updated });
  } catch (err) {
    console.error("[Market.updateProduct]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};

// ─────────────────────────────────────────────────────────
// GET /api/market/schools/search?search=xx
// ─────────────────────────────────────────────────────────
const searchSchools = async (req, res) => {
  try {
    const rows = await svcSearchSchools(req.query.search || '');
    res.json(rows);
  } catch (err) {
    console.error('[Market.searchSchools]', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};

// ─────────────────────────────────────────────────────────
// GET /api/market/uniform-types
// ส่ง category_id + gender ครบ ให้ frontend filter ได้
// ─────────────────────────────────────────────────────────
const getUniformTypes = async (req, res) => {
  try {
    const rows = await svcGetTypes();
    res.json(rows);
  } catch (err) {
    console.error('[Market.getUniformTypes]', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};

const getUniformTypesBySchool = async (req, res) => {
  try {
    const schoolId = Number(req.params.school_id);
    if (!schoolId) {
      return res.status(400).json({ message: "school_id required" });
    }

    const rows = await svcGetTypesBySchool(schoolId);
    res.json(rows);
  } catch (err) {
    console.error("[Market.getUniformTypesBySchool]", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
};
const getMatchedProducts = async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ message: 'กรุณาระบุ project_id' });
    const result = await svcGetMatched(project_id);
    res.json(result); // ← ส่ง { products, school_info } ไปเลย
  } catch (err) {
    console.error('[Market.getMatched]', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
};

const getRecommendedProjectsByProduct = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!productId) return res.status(400).json({ message: "product id ไม่ถูกต้อง" });
    const result = await svcGetRecommendedProjectsByProduct(productId);
    res.json(result);
  } catch (err) {
    console.error("[Market.getRecommendedProjectsByProduct]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};

export {
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
};