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

    const created           = [];

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
const GENDER_SUFFIX   = { male: 'ชาย', female: 'หญิง' };

const prefix   = CATEGORY_PREFIX[item.category_id] || '';
const gender   = GENDER_SUFFIX[item.gender] || '';
const typePart = item.type_name?.trim() || '';
const title    = `${prefix}${gender}${typePart ? ' ' + typePart : ''}`.trim();

// size เป็น JSON
const sizeObj = {};
if (item.sizes?.chest)  sizeObj.chest  = item.sizes.chest;
if (item.sizes?.waist)  sizeObj.waist  = item.sizes.waist;
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
     price, quantity,shipping_name, shipping_price, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
  [
    sellerId,
    item.uniform_type_id || null,
    item.category_id     || null,   // ← เพิ่ม
    item.gender          || null,   // ← เพิ่ม
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
    item.shipping_name  || null,   // ✅
    parseFloat(item.shipping_price) || 0, // ✅
  ]
);

      const productId = result.insertId;

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

const getProducts = async ({ search, category_id, gender, uniform_type_id, level, min_price, max_price, sort, page, limit }) => {  const pageNum  = parseInt(page)  || 1;
  const limitNum = parseInt(limit) || 12;
  const offset   = (pageNum - 1) * limitNum;

  const where  = [`p.status = 'available'`];
  const params = [];

    console.log('query params:', { search, category_id, gender, level, sort, page });

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
if (category_id)     { where.push(`p.category_id = ?`);     params.push(Number(category_id)); }
if (gender) {
  where.push(`(p.gender = ? OR (p.gender IS NULL AND ut.gender = ?))`);
  params.push(gender, gender);
}
if (level)           { where.push(`p.level = ?`);           params.push(level); }
  if (min_price)       { where.push(`p.price >= ?`);          params.push(Number(min_price)); }
  if (max_price)       { where.push(`p.price <= ?`);          params.push(Number(max_price)); }

  const ORDER_MAP = {
    newest:     'p.created_at DESC',
    price_asc:  'p.price ASC',
    price_desc: 'p.price DESC',
  };
  const orderBy  = ORDER_MAP[sort] || 'p.created_at DESC';
  const whereSQL = `WHERE ${where.join(' AND ')}`;

  const [[{ total }]] = await db.execute(
  `SELECT COUNT(*) AS total 
   FROM products p
   LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
   ${whereSQL}`,
  params
);

  const [rows] = await db.execute(
    `SELECT
       p.product_id, p.product_title, p.size, p.level,
       p.condition_percent, p.condition_label, p.price, p.status, p.created_at,
       p.quantity, p.school_name, p.custom_type_name,
       COALESCE(p.category_id, ci.category_id) AS category_id,
       p.gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       ut.uniform_type_id,
       ci.category_name,
       u.user_name AS seller_name,
       GROUP_CONCAT(pi.image_url ORDER BY pi.sort_order SEPARATOR '|||') AS image_urls
     FROM products p
     LEFT JOIN users         u  ON u.user_id         = p.seller_id
     LEFT JOIN uniform_type  ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item ci ON ci.category_id     = ut.category_id
     LEFT JOIN product_images pi ON pi.product_id     = p.product_id
     ${whereSQL}
     GROUP BY p.product_id, p.product_title, p.size, p.level,
              p.condition_percent, p.condition_label, p.price, p.status, p.created_at,
              p.quantity, p.category_id, p.gender, p.school_name, p.custom_type_name,
              ut.type_name, ut.uniform_type_id,
              ci.category_name, ci.category_id, u.user_name
     ORDER BY ${orderBy}
     LIMIT ${limitNum} OFFSET ${offset}`,
    params
  );

  return {
    products: rows.map(row => ({
      ...row,
      images: row.image_urls
        ? row.image_urls.split('|||').map(url => ({ image_url: url }))
        : [],
    })),
    pagination: {
      total: Number(total),
      page:  Number(page),
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
            ut.uniform_type_id,
            ut.gender,
            ci.category_name,
            COALESCE(p.category_id, ci.category_id) AS category_id,
            u.user_name AS seller_name,
            u.user_phone AS seller_phone
     FROM products p
     LEFT JOIN users        u  ON u.user_id         = p.seller_id
     LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item ci ON ci.category_id   = ut.category_id
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
const getRelatedProducts = async ({ productId, categoryId, gender, level, limit = 6 }) => {
  const where  = [`p.status = 'available'`, `p.product_id != ?`];
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

const getMatchedProducts = async (projectId) => {
  // 1️⃣ ดึง request + school info (JOIN schools เพื่อเอาที่อยู่โรงเรียน)
  const [[req]] = await db.execute(
    `SELECT r.school_id, r.request_id,
            s.school_name, s.school_address, s.school_phone
     FROM donation_request r
JOIN schools s ON s.school_id = r.school_id
WHERE r.request_id = ?`,
    [projectId]
  );
  if (!req) return [];

  // parse ที่อยู่โรงเรียนจาก string เดียว → structured fields
  const schoolAddr = parseThaiAddress(req.school_address);

  // 2️⃣ ดึง needs จาก request_items (uniform_items ของ request โดยตรง)
  //    รองรับทั้งตาราง request_items และ student_need
  let needs = [];

  // ลอง request_items ก่อน (ตาราง uniform_items ของ request)
  try {
    const [rows] = await db.execute(
      `SELECT ri.uniform_type_id, ri.size, ri.quantity_needed
       FROM request_items ri
       WHERE ri.request_id = ?`,
      [projectId]
    );
    needs = rows;
  } catch { /* ตารางอาจชื่อต่างกัน */ }

  // fallback → student_need ถ้า request_items ไม่มีหรือว่าง
  if (!needs.length) {
    try {
      const [rows] = await db.execute(
        `SELECT uniform_type_id, size, quantity_needed
         FROM student_need
         WHERE school_id = ?`,
        [req.school_id]
      );
      needs = rows;
    } catch { /* student_need อาจไม่มี */ }
  }

  if (!needs.length) return [];

  // 3️⃣ ดึงสินค้าทั้งหมดที่ available
  const [products] = await db.execute(`
    SELECT p.product_id, p.product_title, p.size, p.level,
           p.condition_percent, p.condition_label, p.price, p.quantity,
           ut.type_name, ut.uniform_type_id, ut.gender,
           ci.category_id, ci.category_name,
           p.school_name,
           pi.image_url AS cover_image
    FROM products p
    JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
    JOIN category_item ci ON ci.category_id = ut.category_id
    LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
    WHERE p.status = 'available'
      AND p.quantity > 0
  `);

  // 4️⃣ parse JSON size
  const parseSize = (str) => {
    try { return str ? JSON.parse(str) : {}; }
    catch { return {}; }
  };

  // 5️⃣ match uniform_type + size ±1
  const sizeMatches = (pSize, nSize) => {
    const ps = parseSize(pSize);
    const ns = parseSize(nSize);
    const chestOk = !ps.chest || !ns.chest ||
      Math.abs(Number(ps.chest) - Number(ns.chest)) <= 1;
    const waistOk = !ps.waist || !ns.waist ||
      Math.abs(Number(ps.waist) - Number(ns.waist)) <= 1;
    return chestOk && waistOk;
  };

  const matched = products.filter(p =>
    needs.some(n =>
      Number(p.uniform_type_id) === Number(n.uniform_type_id) &&
      sizeMatches(p.size, n.size)
    )
  );

  // แนบ school_info ออกไปพร้อมสินค้า เพื่อให้ frontend ใช้เป็น shippingAddress
  return {
    products: matched,
    school_info: {
      school_name:    req.school_name,
      school_address: req.school_address,   // string เต็ม
      address_line:   schoolAddr.address_line,
      district:       schoolAddr.district,
      province:       schoolAddr.province,
      postal_code:    schoolAddr.postal_code,
      phone:          req.school_phone || "",
    },
  };
};


export {
  batchCreateProducts,
  getProducts,
  getProductById,
  deleteProduct,
  searchSchools,
  getUniformTypes,
  getUniformTypesBySchool,
  getRelatedProducts,
  getMatchedProducts,
};