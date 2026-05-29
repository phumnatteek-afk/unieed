// backend/server/src/modules/Market/Market.service.js
import { db } from "../../config/db.js";
import { cloudinary, uploadToCloudinary } from "../../config/cloudinary.js";

// ─────────────────────────────────────────────────────────
// Batch create products
// items: each item มี school_name (string, ไม่บังคับ)
// ─────────────────────────────────────────────────────────
const batchCreateProducts = async ({ items, files, sellerId }) => {
  const conn = await db.getConnection();
  const uploadedPublicIds = [];
  try {
    await conn.beginTransaction();

    const created = [];

    const [[{ productCount }]] = await conn.execute(
      'SELECT COUNT(*) AS productCount FROM products WHERE seller_id = ?',
      [sellerId]
    );
    const isFirstTimeSeller = parseInt(productCount) === 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.uniform_type_id && !item.type_name?.trim())
        throw new Error(`รายการที่ ${i + 1}: กรุณาเลือกหรือกรอกประเภทชุด`);
      if (!item.price || isNaN(item.price))
        throw new Error(`รายการที่ ${i + 1}: กรุณากรอกราคา`);

      // แทนที่โค้ดเดิมตั้งแต่ let sizeStr ถึง const title
      const CATEGORY_PREFIX = { 1: 'เสื้อนักเรียน', 2: 'กางเกงนักเรียน', 3: 'กระโปรงนักเรียน', 4: '' };
      const GENDER_SUFFIX = { male: 'ชาย', female: 'หญิง' };

      const prefix = CATEGORY_PREFIX[item.category_id] || '';
      const gender = GENDER_SUFFIX[item.gender] || '';
      const typePart = item.type_name?.trim() || '';
      const title = `${prefix}${gender}${typePart ? ' ' + typePart : ''}`.trim();

      // size เป็น JSON
      const sizeObj = {};
      if (item.sizes?.chest) sizeObj.chest = item.sizes.chest;
      if (item.sizes?.waist) sizeObj.waist = item.sizes.waist;
      if (item.sizes?.length) sizeObj.length = item.sizes.length;
      const sizeStr = Object.keys(sizeObj).length > 0
        ? JSON.stringify(sizeObj)
        : null;


      // ถ้ากรอกชื่อโรงเรียนแต่ไม่เจอใน DB เพิ่มลงใน description
      let description = item.description || '';

      const [result] = await conn.execute(
        `INSERT INTO products
    (seller_id, uniform_type_id, category_id, gender, custom_type_name, product_title,
     product_description, size, level, school_name, condition_percent, condition_label,
     price, quantity, weight, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
        [
          sellerId,
          item.uniform_type_id || null,
          item.category_id || null,   // ← เพิ่ม
          item.gender || null,   // ← เพิ่ม
          item.type_name?.trim() || null,
          title,
          description,
          sizeStr,
          item.level || '',
          item.school_name?.trim() || null,
          parseInt(item.condition) || 80,
          item.conditionLabel || '',
          parseFloat(item.price),
          parseInt(item.quantity) || 1,
          parseFloat(item.weight) || 0, 
        ]
      );

      const productId = result.insertId;
      // ✅ INSERT product_shipping (ถ้าตารางยังไม่มีจะ skip ไม่ crash)
if (item.shipping_provider_ids?.length) {
  try {
    for (const pid of item.shipping_provider_ids) {
      await conn.execute(
        `INSERT INTO product_shipping (product_id, provider_id) VALUES (?, ?)`,
        [productId, pid]
      );
    }
  } catch (shippingErr) {
    if (shippingErr.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[batchCreate] product_shipping table not found — run create_shipping_tables.sql migration');
    } else {
      throw shippingErr;
    }
  }
} else {
  console.warn(`[batchCreate] item ${i} has no shipping_provider_ids — user did not select any`);
}

      const fileArray = (files && files[`item${i}_images`]) || [];
      for (let j = 0; j < fileArray.length; j++) {
        const file = fileArray[j];
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

    // เปลี่ยน role เป็น seller ถ้าเป็นครั้งแรก
    if (isFirstTimeSeller) {
      await conn.execute(
        `UPDATE users SET role = 'seller' WHERE user_id = ? AND role = 'user'`,
        [sellerId]
      );
    }

    await conn.commit();

    const [[userRow]] = await conn.execute(
      'SELECT role FROM users WHERE user_id = ?', [sellerId]
    );

    return { created, newRole: userRow.role };
  } catch (err) {
    await conn.rollback();
    await Promise.allSettled(
      uploadedPublicIds.map(pid => cloudinary.uploader.destroy(pid))
    );
    throw err;
  } finally {
    conn.release();
  }
};

const getProducts = async ({ search, ids, category_id, gender, uniform_type_id, level, min_price, max_price, school_id, sort, page, limit }) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 12;
  const offset = (pageNum - 1) * limitNum;

  const where = [`p.status = 'available'`];
  const params = [];

  console.log('query params:', { search, ids: ids?.length, category_id, gender, level, sort, page });

  // Meilisearch hit IDs — filter directly by product_id (skip LIKE search)
  if (ids && ids.length) {
    where.push(`p.product_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }

  if (search) {
    const keywords = search.trim().split(/\s+/).filter(Boolean);
    keywords.forEach(kw => {
      where.push(`(
      p.product_title       LIKE ? OR
      p.product_description LIKE ? OR
      p.school_name         LIKE ? OR
      p.level               LIKE ? OR
      p.condition_label     LIKE ? OR
      p.custom_type_name    LIKE ? OR
      ut.type_name          LIKE ?
    )`);
      const like = `%${kw}%`;
      params.push(like, like, like, like, like, like, like);
    });
  }
  if (uniform_type_id) { where.push(`p.uniform_type_id = ?`); params.push(Number(uniform_type_id)); }
  if (category_id) { where.push(`p.category_id = ?`); params.push(Number(category_id)); }
  if (gender) {
    where.push(`(p.gender = ? OR (p.gender IS NULL AND ut.gender = ?))`);
    params.push(gender, gender);
  }
  if (level) { where.push(`p.level = ?`); params.push(level); }
  if (min_price) { where.push(`p.price >= ?`); params.push(Number(min_price)); }
  if (max_price) { where.push(`p.price <= ?`); params.push(Number(max_price)); }
  if (school_id) { where.push(`p.school_name IN (SELECT school_name FROM schools WHERE school_id = ?)`); params.push(Number(school_id)); }

  const ORDER_MAP = {
    newest: 'p.created_at DESC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
  };
  const orderBy = ORDER_MAP[sort] || 'p.created_at DESC';
  const whereSQL = `WHERE ${where.join(' AND ')}`;

  // Clone params เพราะต้องใช้ 2 ครั้ง (COUNT + SELECT)
  const countParams = [...params];

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total 
   FROM products p
   LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
   ${whereSQL}`,
    countParams
  );

  const [rows] = await db.execute(
    `SELECT
       p.product_id, p.product_title, p.size, p.level,
       p.condition_percent, p.condition_label, p.price, p.status, p.created_at,
       p.quantity, p.school_name, p.custom_type_name, p.weight,
       COALESCE(p.category_id, ci.category_id) AS category_id,
       p.gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       ut.uniform_type_id,
       ci.category_name,
       u.user_name AS seller_name,
       GROUP_CONCAT(pi.image_url ORDER BY pi.sort_order SEPARATOR '|||') AS image_urls
     FROM products p
     LEFT JOIN users          u  ON u.user_id          = p.seller_id
     LEFT JOIN uniform_type   ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item  ci ON ci.category_id     = ut.category_id
     LEFT JOIN product_images pi ON pi.product_id      = p.product_id
     ${whereSQL}
     GROUP BY p.product_id, p.product_title, p.size, p.level,
              p.condition_percent, p.condition_label, p.price, p.status, p.created_at,
              p.quantity, p.category_id, p.gender, p.school_name, p.custom_type_name,
              p.weight, ut.type_name, ut.uniform_type_id, ut.category_id,
              ci.category_name, ci.category_id, u.user_name
     ORDER BY ${orderBy}
     LIMIT ${limitNum} OFFSET ${offset}`,
    params
  );

  return {
    products: rows.map(row => ({
      ...row,
      shipping_providers: [],
      images: row.image_urls
        ? row.image_urls.split('|||').map(url => ({ image_url: url }))
        : [],
    })),
    pagination: {
      total: Number(total),
      page: Number(page),
      limit: limitNum,
      pages: Math.ceil(Number(total) / limitNum),
    },
  };
};
// ─────────────────────────────────────────────────────────
// Get single product + all images
// ─────────────────────────────────────────────────────────
const getProductById = async (id) => {
  const [[product]] = await db.execute(
    `SELECT p.*,
            COALESCE(ut.type_name, p.custom_type_name) AS type_name,
            ci.category_name,
            u.user_name AS seller_name,
            u.user_phone AS seller_phone
     FROM products p
     LEFT JOIN users        u  ON u.user_id         = p.seller_id
     LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item ci ON ci.category_id = COALESCE(p.category_id, ut.category_id)
     WHERE p.product_id = ?`,
    [id]
  );

  if (!product) return null;

  const [images] = await db.execute(
    `SELECT image_id, image_url, is_cover, sort_order
     FROM product_images WHERE product_id = ? ORDER BY sort_order ASC`,
    [id]
  );

  // ดึง shipping providers ที่ผู้ขายรองรับ
  const [shippingRows] = await db.execute(
    `SELECT sp.provider_id, sp.name, sp.code
     FROM product_shipping ps
     JOIN shipping_provider sp ON sp.provider_id = ps.provider_id
     WHERE ps.product_id = ?
     ORDER BY sp.name`,
    [id]
  );

  return { ...product, images, shipping_providers: shippingRows };
};
const getRelatedProducts = async ({ productId, categoryId, gender, level, limit = 6 }) => {
  const where = [`p.status = 'available'`, `p.product_id != ?`];
  const params = [Number(productId)];

  // ✅ ต้องมี category เดียวกันเสมอ
  if (categoryId) {
    where.push(`COALESCE(p.category_id, ci.category_id) = ?`);
    params.push(Number(categoryId));
  }

  // ✅ filter เพศเสมอ (ไม่จำกัดแค่ category 1)
  if (gender) {
    where.push(`COALESCE(p.gender, ut.gender) = ?`);
    params.push(gender);
  }

  // ✅ filter ระดับชั้น strict — ต้องตรงกันเท่านั้น ไม่รับ null/ว่าง
  if (level) {
    where.push(`p.level = ?`);
    params.push(level);
  }

  const whereSQL = `WHERE ${where.join(" AND ")}`;

  const [rows] = await db.execute(
    `SELECT
       p.product_id, p.product_title, p.size, p.level,
       p.condition_percent, p.condition_label, p.price, p.status, p.quantity,
       p.school_name, p.custom_type_name,
       COALESCE(p.category_id, ci.category_id) AS category_id,
       COALESCE(p.gender, ut.gender) AS gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       ut.uniform_type_id,
       ci.category_name,
       u.user_name AS seller_name,
       pi.image_url AS cover_image
     FROM products p
     LEFT JOIN users u ON u.user_id = p.seller_id
     LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item ci ON ci.category_id = ut.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
     ${whereSQL}
     ORDER BY RAND()
     LIMIT ${Number(limit)}`,
    params
  );
  return rows;
};
// ─────────────────────────────────────────────────────────
// Delete product + Cloudinary cleanup
// ─────────────────────────────────────────────────────────
const deleteProduct = async (productId, requesterId, requesterRole) => {
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) throw { status: 400, message: 'product_id ไม่ถูกต้อง' };

  const conn = await db.getConnection();
  let images = [];
  try {
    await conn.beginTransaction();

    const [[product]] = await conn.execute(
      'SELECT seller_id FROM products WHERE product_id = ? FOR UPDATE',
      [id]
    );

    if (!product) throw { status: 404, message: 'ไม่พบสินค้า' };
    if (Number(product.seller_id) !== Number(requesterId) && requesterRole !== 'admin')
      throw { status: 403, message: 'ไม่มีสิทธิ์ลบสินค้านี้' };

    const [imageRows] = await conn.execute(
      'SELECT public_id FROM product_images WHERE product_id = ?',
      [id]
    );
    images = imageRows;

    await conn.execute('DELETE FROM product_shipping WHERE product_id = ?', [id]);
    await conn.execute('DELETE FROM product_images WHERE product_id = ?', [id]);
    await conn.execute('DELETE FROM products WHERE product_id = ?', [id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await Promise.allSettled(
    images
      .map((img) => img.public_id)
      .filter(Boolean)
      .map((publicId) => cloudinary.uploader.destroy(publicId))
  );
};

const MAX_PRODUCT_IMAGES = 4;

/** ลบ/เพิ่มรูป จำกัดรวม 4 รูป ต้องเหลืออย่างน้อย 1 รูป */
async function applyProductImageUpdates(productId, removeImageIds, newFiles) {
  const ids = Array.isArray(removeImageIds)
    ? [...new Set(removeImageIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  const [[countRow]] = await db.execute(
    `SELECT COUNT(*) AS c FROM product_images WHERE product_id = ?`,
    [productId]
  );
  const startCount = Number(countRow.c);

  let removeIdsConfirmed = [];
  if (ids.length) {
    const [rows] = await db.execute(
      `SELECT image_id FROM product_images WHERE product_id = ? AND image_id IN (${ids.map(() => "?").join(",")})`,
      [productId, ...ids]
    );
    removeIdsConfirmed = rows.map((r) => r.image_id);
  }

  const uploadBuffers = (newFiles || []).filter((f) => f?.buffer && f.buffer.length);
  const finalCount = startCount - removeIdsConfirmed.length + uploadBuffers.length;

  if (finalCount > MAX_PRODUCT_IMAGES) {
    throw { status: 400, message: `รูปสินค้าได้ไม่เกิน ${MAX_PRODUCT_IMAGES} รูป` };
  }
  if (finalCount < 1) {
    throw { status: 400, message: "ต้องมีรูปสินค้าอย่างน้อย 1 รูป" };
  }

  if (removeIdsConfirmed.length) {
    const [toDestroy] = await db.execute(
      `SELECT public_id FROM product_images WHERE product_id = ? AND image_id IN (${removeIdsConfirmed.map(() => "?").join(",")})`,
      [productId, ...removeIdsConfirmed]
    );
    await Promise.allSettled(toDestroy.map((r) => cloudinary.uploader.destroy(r.public_id)));
    await db.execute(
      `DELETE FROM product_images WHERE product_id = ? AND image_id IN (${removeIdsConfirmed.map(() => "?").join(",")})`,
      [productId, ...removeIdsConfirmed]
    );
  }

  const [[afterRow]] = await db.execute(
    `SELECT COUNT(*) AS c FROM product_images WHERE product_id = ?`,
    [productId]
  );
  const room = MAX_PRODUCT_IMAGES - Number(afterRow.c);
  if (uploadBuffers.length > room) {
    throw { status: 400, message: `เพิ่มรูปได้อีกไม่เกิน ${room} รูป` };
  }

  const [[mxRow]] = await db.execute(
    `SELECT COALESCE(MAX(sort_order), -1) AS mx FROM product_images WHERE product_id = ?`,
    [productId]
  );
  let nextSort = Number(mxRow.mx) + 1;

  for (let j = 0; j < uploadBuffers.length; j++) {
    const file = uploadBuffers[j];
    const filename = `product_${productId}_${Date.now()}_${j}`;
    const uploaded = await uploadToCloudinary(file.buffer, filename);
    await db.execute(
      `INSERT INTO product_images (product_id, image_url, public_id, is_cover, sort_order) VALUES (?, ?, ?, 0, ?)`,
      [productId, uploaded.secure_url, uploaded.public_id, nextSort++]
    );
  }

  const [all] = await db.execute(
    `SELECT image_id FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, image_id ASC`,
    [productId]
  );
  for (let i = 0; i < all.length; i++) {
    await db.execute(
      `UPDATE product_images SET sort_order = ?, is_cover = ? WHERE image_id = ?`,
      [i, i === 0 ? 1 : 0, all[i].image_id]
    );
  }
}

const updateProduct = async (productId, requesterId, requesterRole, rawPayload = {}, newImageFiles = []) => {
  const id = Number(productId);
  if (!Number.isFinite(id)) throw { status: 400, message: "product_id ไม่ถูกต้อง" };

  const [[product]] = await db.execute(
    `SELECT product_id, seller_id, status FROM products WHERE product_id = ? LIMIT 1`,
    [id]
  );
  if (!product) throw { status: 404, message: "ไม่พบสินค้า" };
  if (Number(product.seller_id) !== Number(requesterId) && requesterRole !== "admin") {
    throw { status: 403, message: "ไม่มีสิทธิ์แก้ไขสินค้านี้" };
  }

  const remove_image_ids = Array.isArray(rawPayload.remove_image_ids) ? rawPayload.remove_image_ids : [];
  const payload = { ...rawPayload };
  delete payload.remove_image_ids;

  const newFiles = Array.isArray(newImageFiles) ? newImageFiles : [];
  const hasImageWork = remove_image_ids.length > 0 || newFiles.length > 0;

  const updates = [];
  const values = [];

  if (payload.product_title !== undefined) {
    const v = String(payload.product_title || "").trim();
    if (!v) throw { status: 400, message: "กรุณากรอกชื่อสินค้า" };
    updates.push("product_title = ?"); values.push(v);
  }
  if (payload.product_description !== undefined) {
    updates.push("product_description = ?"); values.push(String(payload.product_description || "").trim());
  }
  if (payload.price !== undefined) {
    const v = Number(payload.price);
    if (!Number.isFinite(v) || v < 0) throw { status: 400, message: "ราคาสินค้าไม่ถูกต้อง" };
    updates.push("price = ?"); values.push(v);
  }
  if (payload.quantity !== undefined) {
    const v = Number(payload.quantity);
    if (!Number.isFinite(v) || v < 0) throw { status: 400, message: "จำนวนสินค้าไม่ถูกต้อง" };
    updates.push("quantity = ?"); values.push(v);
  }
  if (payload.size !== undefined) {
    const normalized = typeof payload.size === "string" ? payload.size : JSON.stringify(payload.size || {});
    updates.push("size = ?"); values.push(normalized);
  }
  if (payload.category_id !== undefined) {
    const c = Number(payload.category_id);
    if (![1, 2, 3, 4].includes(c)) throw { status: 400, message: "หมวดสินค้าไม่ถูกต้อง" };
    updates.push("category_id = ?"); values.push(c);
  }
  if (payload.gender !== undefined) {
    const g = payload.gender;
    if (g === null || g === "") {
      updates.push("gender = ?"); values.push(null);
    } else if (!["male", "female"].includes(g)) {
      throw { status: 400, message: "เพศไม่ถูกต้อง" };
    } else {
      updates.push("gender = ?"); values.push(g);
    }
  }
  if (payload.uniform_type_id !== undefined) {
    const v = payload.uniform_type_id;
    if (v === null || v === "") {
      updates.push("uniform_type_id = ?"); values.push(null);
    } else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1) throw { status: 400, message: "ประเภทชุดไม่ถูกต้อง" };
      updates.push("uniform_type_id = ?"); values.push(n);
    }
  }
  if (payload.custom_type_name !== undefined) {
    const s = payload.custom_type_name === null ? "" : String(payload.custom_type_name).trim();
    updates.push("custom_type_name = ?"); values.push(s || null);
  }
  if (payload.level !== undefined) {
    updates.push("level = ?"); values.push(String(payload.level ?? "").trim());
  }
  if (payload.school_name !== undefined) {
    const s = payload.school_name === null ? "" : String(payload.school_name).trim();
    updates.push("school_name = ?"); values.push(s || null);
  }
  if (payload.condition_percent !== undefined) {
    const v = parseInt(payload.condition_percent, 10);
    if (!Number.isFinite(v) || v < 10 || v > 100) throw { status: 400, message: "สภาพสินค้า (%) ไม่ถูกต้อง" };
    updates.push("condition_percent = ?"); values.push(v);
  }
  if (payload.condition_label !== undefined) {
    updates.push("condition_label = ?"); values.push(String(payload.condition_label ?? "").trim());
  }
  if (payload.status !== undefined) {
    const allowed = ["available", "sold", "hidden"];
    if (!allowed.includes(payload.status)) throw { status: 400, message: "สถานะสินค้าไม่ถูกต้อง" };
    updates.push("status = ?"); values.push(payload.status);
  }

  if (!updates.length && !hasImageWork) {
    throw { status: 400, message: "ไม่มีข้อมูลที่ต้องการอัปเดต" };
  }

  if (updates.length) {
    values.push(id);
    await db.execute(`UPDATE products SET ${updates.join(", ")} WHERE product_id = ?`, values);
  }

  if (hasImageWork) {
    await applyProductImageUpdates(id, remove_image_ids, newFiles);
  }

  return await getProductById(id);
};

// ─────────────────────────────────────────────────────────
// Search schools (autocomplete — สำหรับ admin/future use)
// ─────────────────────────────────────────────────────────
const searchSchools = async (search = '') => {
  const [rows] = await db.execute(
    `SELECT school_id, school_name, province FROM schools WHERE school_name LIKE ? LIMIT 20`,
    [`%${search}%`]
  );
  return rows;
};

// ─────────────────────────────────────────────────────────
// Get all uniform types — ส่ง category_id + category_name ให้ frontend filter ได้
// ─────────────────────────────────────────────────────────
const getUniformTypes = async () => {
  const [rows] = await db.execute(
    `SELECT 
        ut.uniform_type_id,
        ut.type_name,
        ut.gender,
        ut.category_id,
        ut.is_default   -- ⭐ เพิ่มตรงนี้
     FROM uniform_type ut
     ORDER BY ut.category_id, ut.type_name`
  );
  return rows;
};

// ─────────────────────────────────────────────────────────
// Get uniform types สำหรับโรงเรียนเฉพาะ
// ใช้ uniform_subtype_name จาก uniform_type_images ถ้ามี (เหมือน EditProjectPage)
// ─────────────────────────────────────────────────────────
const getUniformTypesBySchool = async (schoolId) => {
  const [rows] = await db.execute(
    `SELECT
       ut.uniform_type_id,
       ut.gender,
       ci.category_id,
       ci.category_name,
       COALESCE(uti.uniform_subtype_name, ut.type_name) AS type_name,
       uti.image_url AS school_image_url
     FROM uniform_type ut
     JOIN category_item ci ON ci.category_id = ut.category_id
     LEFT JOIN uniform_type_images uti
       ON uti.uniform_type_id = ut.uniform_type_id
       AND uti.school_id = ?
     GROUP BY ut.uniform_type_id, ut.gender, ci.category_id, ci.category_name
     ORDER BY ci.category_id, ut.uniform_type_id`,
    [schoolId]
  );
  return rows;
};

// ─────────────────────────────────────────────────────────
// Parse Thai school address string → structured fields
// รองรับ: "48/169 หมู่ 5 ตำบลกระทุ่มล้ม อำเภอสามพราน จังหวัดนครปฐม 73210"
//          "140 ม.10 ต.วังม่วง อ.วังม่วง จ.สระบุรี"
//          "นครปฐม"  (จังหวัดอย่างเดียว)
// ─────────────────────────────────────────────────────────
const parseThaiAddress = (addr = "") => {
  if (!addr) return { address_line: "", district: "", province: "", postal_code: "" };

  let rest = addr.trim();

  // postal code (5 หลัก)
  let postal_code = "";
  const postalM = rest.match(/\b(\d{5})\b/);
  if (postalM) {
    postal_code = postalM[1];
    rest = rest.slice(0, postalM.index).trim();
  }

  // province: จังหวัด / จ.
  let province = "";
  const provM = rest.match(/(?:จังหวัด|จ\.)\s*([\u0E00-\u0E7F]+)/);
  if (provM) { province = provM[1]; rest = rest.slice(0, provM.index).trim(); }

  // district (อำเภอ / เขต / อ.)
  let district = "";
  const distM = rest.match(/(?:อำเภอ|เขต|อ\.)\s*([\u0E00-\u0E7F]+)/);
  if (distM) { district = distM[1]; rest = rest.slice(0, distM.index).trim(); }

  // sub-district (ตำบล / แขวง / ต.) — เก็บรวมกับ address_line
  const subM = rest.match(/(?:ตำบล|แขวง|ต\.)\s*([\u0E00-\u0E7F]+)/);
  if (subM) { rest = rest.slice(0, subM.index).trim(); }

  // ถ้าไม่พบอะไรเลย (เช่น "นครปฐม") ให้ใช้เป็น province
  if (!province && !district && rest) {
    province = rest;
    rest = "";
  }

  return {
    address_line: rest,
    district,
    province,
    postal_code,
  };
};

const getMatchedProducts = async (project_id) => {
  // ─── 1. ดึง project + school ───────────────────────────────────────────────
  const [[project]] = await db.execute(
    `SELECT dr.request_id, dr.school_id,
            s.school_name, s.school_address, s.school_phone
     FROM donation_request dr
     JOIN schools s ON s.school_id = dr.school_id
     WHERE dr.request_id = ?`,
    [project_id]
  );
  if (!project) return { products: [], school_info: null };

  // ─── 2. ดึง needs เฉพาะ request นี้ พร้อม category_id + gender + level ───
  // ── 2. ดึง needs พร้อม type_name ──────────────────────────
  const [needs] = await db.execute(
    `SELECT
       sn.student_need_id,
       sn.uniform_type_id,
       sn.size,
       sn.quantity_needed,
       ut.category_id,
       ut.gender,
       ut.type_name,
       st.education_level_group AS level,
       -- uniform_subtype_name จาก uniform_type_images ของโรงเรียนนี้
       -- เช่น "ถักรังดุม สีแดง" ที่โรงเรียนกำหนดสำหรับ uniform_type_id=4
       uti.uniform_subtype_name
     FROM student_need sn
     JOIN students     st  ON st.student_id      = sn.student_id
     JOIN uniform_type ut  ON ut.uniform_type_id  = sn.uniform_type_id
     LEFT JOIN uniform_type_images uti
           ON  uti.uniform_type_id = sn.uniform_type_id
           AND uti.school_id       = ?
           AND (uti.request_id     = ? OR uti.request_id IS NULL)
     WHERE st.request_id = ?
       AND sn.status = 'pending'
       AND sn.quantity_needed > sn.quantity_received`,
    [project.school_id, project_id, project_id]
  );
  if (!needs.length) return { products: [], school_info: null };

  // ─── 3. ดึงสินค้าทั้งหมดพร้อม fields ครบ (เหมือน getProducts) ────────────
  const [products] = await db.execute(
    `SELECT
       p.product_id, p.seller_id, p.uniform_type_id,
       p.custom_type_name, p.product_title, p.product_description,
       p.size, p.level, p.school_name,
       p.condition_percent, p.condition_label,
       p.price, p.quantity, p.status, p.created_at,
       p.weight,
       COALESCE(p.category_id, ci.category_id) AS category_id,
       COALESCE(p.gender, ut.gender)            AS gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       ut.uniform_type_id AS ut_type_id,
       ci.category_name,
       u.user_name  AS seller_name,
       u.user_phone AS seller_phone,
       GROUP_CONCAT(DISTINCT sp.name ORDER BY sp.name SEPARATOR '|||') AS shipping_providers,
       GROUP_CONCAT(pi.image_url ORDER BY pi.sort_order SEPARATOR '|||') AS image_urls,
       MAX(CASE WHEN pi.is_cover = 1 THEN pi.image_url END) AS cover_image
     FROM products p
     LEFT JOIN users          u  ON u.user_id          = p.seller_id
     LEFT JOIN uniform_type   ut ON ut.uniform_type_id  = p.uniform_type_id
     LEFT JOIN category_item  ci ON ci.category_id      = ut.category_id
     LEFT JOIN product_images pi ON pi.product_id       = p.product_id
     LEFT JOIN product_shipping ps ON ps.product_id     = p.product_id
     LEFT JOIN shipping_provider sp ON sp.provider_id  = ps.provider_id
     WHERE p.status = 'available' AND p.quantity > 0
     GROUP BY p.product_id`
  );

  // ─── 4. helper: แปลง level ภาษาไทย → กลุ่ม ─────────────────────────────
  const LEVEL_MAP = {
  อนุบาล:       ["อนุบาล", "kg", "kindergarten"],
  ประถมศึกษา:   ["ประถมศึกษา", "ประถม", "ป.", "primary"],
  มัธยมต้น:     ["มัธยมตอนต้น", "มัธยมต้น", "มัธยมศึกษาตอนต้น", "ม.1", "ม.2", "ม.3"],
  มัธยมปลาย:   ["มัธยมตอนปลาย", "มัธยมปลาย", "มัธยมศึกษาตอนปลาย", "ม.4", "ม.5", "ม.6"],
};
  const normalizeLevel = (lv = "") => {
    const l = lv.toLowerCase().trim();
    for (const [group, patterns] of Object.entries(LEVEL_MAP)) {
      if (patterns.some(p => l.includes(p.toLowerCase()))) return group;
    }
    return lv.trim() || null;
  };

  // ─── 5. helper: เปรียบขนาด (ต้องตรงเป๊ะ ไม่มี tolerance) ──────────────
  const matchSize = (pSizeRaw, nSizeRaw) => {
    try {
      const p = typeof pSizeRaw === "string" ? JSON.parse(pSizeRaw) : (pSizeRaw || {});
      const n = typeof nSizeRaw === "string" ? JSON.parse(nSizeRaw) : (nSizeRaw || {});
      if (!n || Object.keys(n).length === 0) return true; // need ไม่ระบุ size → match ทุก size
      for (const key of ["chest", "waist"]) {
        if (n[key] !== undefined && n[key] !== null && n[key] !== "") {
          // exact match เท่านั้น: ค่าต้องเท่ากัน (แปลงเป็น number เพื่อเทียบ)
          const nVal = Number(n[key]);
          const pVal = Number(p[key]);
          if (isNaN(pVal) || pVal !== nVal) return false;
        }
      }
      return true;
    } catch { return false; }
  };

  // ─── 6. helper: keyword overlap score ระหว่าง type name สองข้าง ──────────
  // แยกคำออกจากชื่อ (ตัดคำไทยโดย split ช่องว่าง + dedupe)
  // คืน 0–1 (สัดส่วน keyword ของ need ที่เจอใน product name)
  const keywordScore = (needTypeName = "", productTypeName = "") => {
    if (!needTypeName || !productTypeName) return 0;
    const tokenize = (s) =>
      s.trim().split(/\s+/).map(w => w.replace(/[^฀-๿a-zA-Z0-9]/g, "").toLowerCase()).filter(Boolean);
    const nTokens = tokenize(needTypeName);
    const pTokens = new Set(tokenize(productTypeName));
    if (!nTokens.length) return 0;
    const matched = nTokens.filter(t => pTokens.has(t)).length;
    return matched / nTokens.length;
  };

  const KEYWORD_THRESHOLD = 0.5;

  const productScore = new Map(); // product_id → { score, need_id, type_name }

  for (const need of needs) {
    const nCat = Number(need.category_id);
    const nGender = need.gender || null;
    const nLevel = normalizeLevel(need.level);
    const nTypeId = Number(need.uniform_type_id);
    // ใช้ uniform_subtype_name (ชื่อที่โรงเรียนกำหนด เช่น "ถักรังดุม สีแดง") เป็น primary
    // ถ้าไม่มีค่อยใช้ type_name ทั่วไป (เช่น "กระโปรงนักเรียนหญิง")
    const nTypeName = (need.uniform_subtype_name || need.type_name || "").trim();
    // เก็บทั้งสองชื่อเพื่อ match ได้ทั้งคู่
    const nTypeNameGeneral = (need.type_name || "").trim();
    const nSubtypeName = (need.uniform_subtype_name || "").trim();

    for (const p of products) {
      const pCat = Number(p.category_id);
      const pGender = p.gender || null;

      // ── HARD filters ──────────────────────────────────────────
      if (pCat && nCat && pCat !== nCat) continue;
      if (nGender && pGender && nGender !== pGender) continue;
      const sizeOk = matchSize(p.size, need.size);
      if (!sizeOk) continue;

      // ── type matching ────────────────────────────────────────
      // ระดับ 1: uniform_type_id ตรงเป๊ะ → score = 3
      // ระดับ 2: uniform_subtype_name ของโรงเรียน match กับ custom_type_name ของสินค้า
      //          เช่น need.subtype="ถักรังดุม สีแดง" == product.custom_type_name="ถักรังดุม สีแดง"
      // ระดับ 3: keyword ของ type_name ตรงกัน ≥ 50%
      // ไม่มี fallback — ต้องตรงจริงเท่านั้น
      const pTypeId = Number(p.uniform_type_id);
      // ชื่อ type ของ product: custom_type_name (ที่ seller กรอก) หรือ type_name จาก uniform_type
      const pCustomName = (p.custom_type_name || "").trim();
      const pTypeName   = (p.type_name || p.custom_type_name || "").trim();

      let typeScore = 0;
      if (pTypeId && pTypeId === nTypeId) {
        // ระดับ 1: type_id ตรงกัน
        typeScore = 3;
      } else if (
        nSubtypeName &&
        pCustomName &&
        nSubtypeName.toLowerCase() === pCustomName.toLowerCase()
      ) {
        // ระดับ 2: uniform_subtype_name ของโรงเรียน == custom_type_name ของ product (exact string)
        typeScore = 3;
      } else if (
        nSubtypeName &&
        pCustomName &&
        keywordScore(nSubtypeName, pCustomName) >= KEYWORD_THRESHOLD
      ) {
        // ระดับ 2b: keyword match ระหว่าง subtype_name และ custom_type_name
        typeScore = 2;
      } else {
        // ระดับ 3: keyword match ระหว่าง type_name ทั่วไป
        const kw = keywordScore(nTypeNameGeneral, pTypeName);
        if (kw >= KEYWORD_THRESHOLD) {
          typeScore = Math.round(kw * 2);
        }
      }
      if (typeScore === 0) continue;

      const pLevel = normalizeLevel(p.level);

      // HARD filter: ถ้าทั้งสองฝั่งมี level และไม่ตรงกัน → ข้ามเลย
      if (nLevel && pLevel && nLevel !== pLevel) continue;

      const levelMatch = nLevel && pLevel && nLevel === pLevel;

      // total score
      let score = 1;
      score += typeScore;
      if (levelMatch) score++;
      const prev = productScore.get(p.product_id);
      if (!prev || score > prev.score) {
        productScore.set(p.product_id, {
          score,
          need_id: need.student_need_id,
          type_name: need.type_name,
        });
      }
    }
  }

  // ─── 7. format + เรียงตาม score ─────────────────────────────────────────
  const matched = products
    .filter(p => productScore.has(p.product_id))
    .map(p => ({
      ...p,
      match_score: productScore.get(p.product_id).score,
      matched_type_name: productScore.get(p.product_id).type_name,
      // แปลง shipping_providers string → array
      shipping_providers: p.shipping_providers
        ? p.shipping_providers.split("|||").filter(Boolean)
        : [],
      images: p.image_urls
        ? p.image_urls.split("|||").map(url => ({ image_url: url }))
        : [],
    }))
    .sort((a, b) => b.match_score - a.match_score);

  // ─── 8. parse ที่อยู่โรงเรียน ────────────────────────────────────────────
  const parsed = parseThaiAddress(project.school_address);
  const school_info = {
    school_name: project.school_name,
    school_address: project.school_address,
    school_phone: project.school_phone,
    address_line: parsed.address_line || project.school_address || "",
    district: parsed.district,
    province: parsed.province,
    postal_code: parsed.postal_code,
    phone: project.school_phone || "",
  };

  console.log(
    `[getMatchedProducts] project=${project_id} needs=${needs.length} matched=${matched.length}`,
    matched.map(p => ({ id: p.product_id, score: p.match_score, cat: p.category_id, gender: p.gender, size: p.size }))
  );

  return {
    products: matched,
    school_info,
    needs_summary: needs,   // ← ส่งกลับ needs array ให้ frontend ใช้แสดง hero
  };
};

const getRecommendedProjectsByProduct = async (productId) => {
  const [[product]] = await db.execute(
    `SELECT product_id, status
     FROM products
     WHERE product_id = ?`,
    [productId]
  );
  if (!product) throw { status: 404, message: "ไม่พบสินค้า" };
  if (product.status !== "available") return { projects: [] };

  const [openProjects] = await db.execute(
    `SELECT
       dr.request_id,
       dr.request_title,
       dr.request_image_url,
       dr.created_at,
       s.school_name,
       s.school_address,
       s.school_phone,
       COALESCE((
         SELECT SUM(ri.quantity) FROM request_item ri WHERE ri.request_id = dr.request_id
       ), 0) AS total_needed,
       COALESCE((
         SELECT SUM(f.quantity_fulfilled) FROM fulfillment f WHERE f.request_id = dr.request_id
       ), 0) AS total_fulfilled,
       (SELECT COUNT(*) FROM students st WHERE st.request_id = dr.request_id AND st.urgency = 'very_urgent') AS very_urgent_count,
       (SELECT COUNT(*) FROM students st WHERE st.request_id = dr.request_id AND st.urgency = 'urgent') AS urgent_count
     FROM donation_request dr
     JOIN schools s ON s.school_id = dr.school_id
     WHERE dr.status = 'open'
       AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
     ORDER BY dr.created_at DESC`
  );

  const matchedProjects = [];
  for (const projectRow of openProjects) {
    const matched = await getMatchedProducts(projectRow.request_id);
    const hasProduct = (matched.products || []).some(
      (p) => Number(p.product_id) === Number(productId)
    );
    if (!hasProduct) continue;

    const remaining = Math.max(
      Number(projectRow.total_needed || 0) - Number(projectRow.total_fulfilled || 0),
      0
    );
    const recommendedTag =
      Number(projectRow.very_urgent_count || 0) > 0 || Number(projectRow.urgent_count || 0) > 0
        ? "urgent"
        : "most_needed";
    const parsed = parseThaiAddress(projectRow.school_address);

    matchedProjects.push({
      request_id: projectRow.request_id,
      request_title: projectRow.request_title,
      request_image_url: projectRow.request_image_url,
      school_name: projectRow.school_name,
      school_address: projectRow.school_address,
      school_phone: projectRow.school_phone,
      total_needed: Number(projectRow.total_needed || 0),
      total_fulfilled: Number(projectRow.total_fulfilled || 0),
      remaining_needed: remaining,
      very_urgent_count: Number(projectRow.very_urgent_count || 0),
      urgent_count: Number(projectRow.urgent_count || 0),
      recommended_tag: recommendedTag,
      shipping_address: {
        name: projectRow.school_name || "",
        address: parsed.address_line || projectRow.school_address || "",
        district: parsed.district || "",
        province: parsed.province || "",
        postal_code: parsed.postal_code || "",
        phone: projectRow.school_phone || "",
      },
    });
  }

  matchedProjects.sort((a, b) => {
    const aUrgent = a.recommended_tag === "urgent" ? 1 : 0;
    const bUrgent = b.recommended_tag === "urgent" ? 1 : 0;
    if (bUrgent !== aUrgent) return bUrgent - aUrgent;
    return Number(b.remaining_needed || 0) - Number(a.remaining_needed || 0);
  });

  return { projects: matchedProjects };
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
