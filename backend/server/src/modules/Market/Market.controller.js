// backend/server/src/modules/Market/Market.controller.js
import {
  batchCreateProducts as svcBatch,
  getProducts         as svcGetProducts,
  getProductById      as svcGetById,
  deleteProduct       as svcDelete,
  searchSchools       as svcSearchSchools,
  getUniformTypes     as svcGetTypes,
  getUniformTypesBySchool as svcGetTypesBySchool,
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
  search = '', uniform_type_id, category_id, gender, level,
  min_price, max_price, school_id,
  sort = 'newest', page = 1, limit = 12,
} = req.query;

const data = await svcGetProducts({
  search, category_id, gender, uniform_type_id, level, min_price, max_price, school_id, sort, page, limit,
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

export {
  batchCreateProducts,
  getProducts,
  getProductById,
  deleteProduct,
  searchSchools,
  getUniformTypes,
  getUniformTypesBySchool,
};