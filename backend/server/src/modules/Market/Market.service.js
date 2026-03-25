// backend/server/src/modules/Market/Market.service.js
import { db } from "../../config/db.js";
import { cloudinary, uploadToCloudinary } from "../../config/cloudinary.js";

// ─────────────────────────────────────────────────────────
// Batch create products (one post → many products)
// items      : parsed array from JSON body field
// files      : req.files  (item0_images … item9_images)
// sellerId   : req.user.user_id
// schoolId   : req.body.school_id (optional)
// ─────────────────────────────────────────────────────────
const batchCreateProducts = async ({ items, files, sellerId, schoolId }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const created          = [];
    const uploadedPublicIds = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.uniform_type_id) throw new Error(`รายการที่ ${i + 1}: กรุณาเลือกประเภทชุด`);
      if (!item.price || isNaN(item.price)) throw new Error(`รายการที่ ${i + 1}: กรุณากรอกราคา`);

      // Build size string: "อก32" / "เอว26/ยาว22"
      let sizeStr = '';
      if (item.sizes) {
        const parts = [];
        if (item.sizes.chest)  parts.push(`อก${item.sizes.chest}`);
        if (item.sizes.waist)  parts.push(`เอว${item.sizes.waist}`);
        if (item.sizes.length) parts.push(`ยาว${item.sizes.length}`);
        sizeStr = parts.join('/');
      }

      const title = item.product_title || `${item.type_name || 'ชุดนักเรียน'} ${sizeStr}`.trim();

      const [result] = await conn.execute(
        `INSERT INTO products
          (seller_id, uniform_type_id, school_id, product_title, product_description,
           size, level, condition_percent, condition_label, price, quantity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
        [
          sellerId,
          item.uniform_type_id,
          schoolId || null,
          title,
          item.description || '',
          sizeStr,
          item.level || '',
          parseInt(item.condition) || 80,
          item.conditionLabel || '',
          parseFloat(item.price),
          parseInt(item.quantity) || 1,
        ]
      );

      const productId = result.insertId;

      // Insert images (max 4, first = cover)
      const fileArray = (files && files[`item${i}_images`]) || [];
      for (let j = 0; j < fileArray.length; j++) {
        const file     = fileArray[j];
        const filename = `product_${productId}_${j}_${Date.now()}`;
        const uploaded = await uploadToCloudinary(file.buffer, filename);
        uploadedPublicIds.push(uploaded.public_id);
        await conn.execute(
          `INSERT INTO product_images
            (product_id, image_url, public_id, is_cover, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [productId, uploaded.secure_url, uploaded.public_id, j === 0 ? 1 : 0, j]
        );
      }

      created.push({ product_id: productId, title });
    }

    await conn.commit();

    // Get updated role after trigger
    const [[userRow]] = await conn.execute(
      'SELECT role FROM users WHERE user_id = ?', [sellerId]
    );

    return { created, newRole: userRow.role };
  } catch (err) {
    await conn.rollback();

    // Rollback Cloudinary uploads on error — ดึง public_id จาก DB
    await Promise.allSettled(
      uploadedPublicIds.map(pid => cloudinary.uploader.destroy(pid))
    );
    throw err;
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────
// Get product listing with filters
// ─────────────────────────────────────────────────────────
const getProducts = async ({ search, uniform_type_id, level, min_price, max_price, school_id, sort, page, limit }) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where  = [`p.status = 'available'`];
  const params = [];

  if (search)          { where.push(`(p.product_title LIKE ? OR s.school_name LIKE ?)`); params.push(`%${search}%`, `%${search}%`); }
  if (uniform_type_id) { where.push(`p.uniform_type_id = ?`); params.push(uniform_type_id); }
  if (level)           { where.push(`p.level = ?`);           params.push(level); }
  if (min_price)       { where.push(`p.price >= ?`);          params.push(min_price); }
  if (max_price)       { where.push(`p.price <= ?`);          params.push(max_price); }
  if (school_id)       { where.push(`p.school_id = ?`);       params.push(school_id); }

  const ORDER_MAP = {
    newest:     'p.created_at DESC',
    price_asc:  'p.price ASC',
    price_desc: 'p.price DESC',
  };
  const orderBy  = ORDER_MAP[sort] || 'p.created_at DESC';
  const whereSQL = `WHERE ${where.join(' AND ')}`;

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM products p LEFT JOIN schools s ON s.school_id = p.school_id ${whereSQL}`,
    params
  );

  const [rows] = await db.execute(
    `SELECT
       p.product_id, p.product_title, p.size, p.level,
       p.condition_percent, p.condition_label, p.price, p.status, p.created_at,
       ut.type_name, ut.uniform_type_id,
       ci.category_name,
       s.school_name,
       u.user_name AS seller_name,
       pi.image_url AS cover_image
     FROM products p
     JOIN users         u  ON u.user_id          = p.seller_id
     JOIN uniform_type  ut ON ut.uniform_type_id  = p.uniform_type_id
     JOIN category_item ci ON ci.category_id      = ut.category_id
     LEFT JOIN schools  s  ON s.school_id         = p.school_id
     LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
     ${whereSQL}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return {
    products: rows,
    pagination: {
      total: parseInt(total),
      page:  parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

// ─────────────────────────────────────────────────────────
// Get single product + all images
// ─────────────────────────────────────────────────────────
const getProductById = async (id) => {
  const [[product]] = await db.execute(
    `SELECT p.*, ut.type_name, ut.uniform_type_id, ci.category_name,
            s.school_name, u.user_name AS seller_name, u.user_phone AS seller_phone
     FROM products p
     JOIN users         u  ON u.user_id          = p.seller_id
     JOIN uniform_type  ut ON ut.uniform_type_id  = p.uniform_type_id
     JOIN category_item ci ON ci.category_id      = ut.category_id
     LEFT JOIN schools  s  ON s.school_id         = p.school_id
     WHERE p.product_id = ?`,
    [id]
  );

  if (!product) return null;

  const [images] = await db.execute(
    `SELECT image_id, image_url, is_cover, sort_order
     FROM product_images WHERE product_id = ? ORDER BY sort_order ASC`,
    [id]
  );

  return { ...product, images };
};

// ─────────────────────────────────────────────────────────
// Delete product + Cloudinary cleanup
// ─────────────────────────────────────────────────────────
const deleteProduct = async (productId, requesterId, requesterRole) => {
  const [[product]] = await db.execute(
    'SELECT seller_id FROM products WHERE product_id = ?', [productId]
  );

  if (!product) throw { status: 404, message: 'ไม่พบสินค้า' };
  if (product.seller_id !== requesterId && requesterRole !== 'admin')
    throw { status: 403, message: 'ไม่มีสิทธิ์ลบสินค้านี้' };

  const [images] = await db.execute(
    'SELECT public_id FROM product_images WHERE product_id = ?', [productId]
  );

  await Promise.allSettled(
    images.map(img => cloudinary.uploader.destroy(img.public_id))
  );

  await db.execute('DELETE FROM products WHERE product_id = ?', [productId]);
};

// ─────────────────────────────────────────────────────────
// Search schools for autocomplete
// ─────────────────────────────────────────────────────────
const searchSchools = async (search = '') => {
  const [rows] = await db.execute(
    `SELECT school_id, school_name, province FROM schools WHERE school_name LIKE ? LIMIT 20`,
    [`%${search}%`]
  );
  return rows;
};

// ─────────────────────────────────────────────────────────
// Get all uniform types (for dropdowns / filters)
// ─────────────────────────────────────────────────────────
const getUniformTypes = async () => {
  const [rows] = await db.execute(
    `SELECT ut.uniform_type_id, ut.type_name, ut.gender,
            ci.category_id, ci.category_name
     FROM uniform_type  ut
     JOIN category_item ci ON ci.category_id = ut.category_id
     ORDER BY ci.category_id, ut.uniform_type_id`
  );
  return rows;
};

export {
  batchCreateProducts,
  getProducts,
  getProductById,
  deleteProduct,
  searchSchools,
  getUniformTypes,
};