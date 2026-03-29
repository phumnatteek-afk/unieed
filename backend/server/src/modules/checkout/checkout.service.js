// backend/server/src/modules/checkout/checkout.service.js
import { db } from "../../config/db.js";

// ────────────────────────────────────────────────────────
// ADDRESS
// ────────────────────────────────────────────────────────
const getAddresses = async (userId) => {
  const [rows] = await db.execute(
    `SELECT * FROM address WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return rows;
};

const createAddress = async (userId, data) => {
  const { recipient_name, phone, address_line, district, province, postcode, is_default = 0 } = data;

  if (is_default) {
    await db.execute("UPDATE address SET is_default = 0 WHERE user_id = ?", [userId]);
  }

  // ถ้าเป็นที่อยู่แรก ให้ set เป็น default อัตโนมัติ
  const [[{ cnt }]] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM address WHERE user_id = ?", [userId]
  );
  const setDefault = is_default || Number(cnt) === 0 ? 1 : 0;

  const [result] = await db.execute(
    `INSERT INTO address (user_id, recipient_name, phone, address_line, district, province, postcode, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, recipient_name, phone, address_line, district, province, postcode, setDefault]
  );
  const [[address]] = await db.execute(
    "SELECT * FROM address WHERE address_id = ?", [result.insertId]
  );
  return address;
};

const updateAddress = async (userId, addressId, data) => {
  const { recipient_name, phone, address_line, district, province, postcode, is_default } = data;

  if (is_default) {
    await db.execute("UPDATE address SET is_default = 0 WHERE user_id = ?", [userId]);
  }

  await db.execute(
    `UPDATE address SET recipient_name=?, phone=?, address_line=?, district=?, province=?, postcode=?, is_default=?
     WHERE address_id = ? AND user_id = ?`,
    [recipient_name, phone, address_line, district, province, postcode, is_default ? 1 : 0, addressId, userId]
  );
  const [[address]] = await db.execute(
    "SELECT * FROM address WHERE address_id = ?", [addressId]
  );
  return address;
};

const deleteAddress = async (userId, addressId) => {
  await db.execute(
    "DELETE FROM address WHERE address_id = ? AND user_id = ?",
    [addressId, userId]
  );
};

const setDefaultAddress = async (userId, addressId) => {
  await db.execute("UPDATE address SET is_default = 0 WHERE user_id = ?", [userId]);
  await db.execute(
    "UPDATE address SET is_default = 1 WHERE address_id = ? AND user_id = ?",
    [addressId, userId]
  );
};

// ────────────────────────────────────────────────────────
// SHIPPING PROVIDERS
// ────────────────────────────────────────────────────────
const getShippingProviders = async () => {
  const [rows] = await db.execute(
    "SELECT * FROM shipping_provider WHERE is_active = 1 ORDER BY base_price ASC"
  );
  return rows;
};

// ────────────────────────────────────────────────────────
// CHECKOUT — ดึงรายการสินค้าจาก cart_item_ids
// ────────────────────────────────────────────────────────
const getCheckoutItems = async (userId, cartItemIds) => {
  if (!cartItemIds.length) throw { status: 400, message: "ไม่มีรายการสินค้า" };

  const placeholders = cartItemIds.map(() => "?").join(",");
  const [rows] = await db.execute(
    `SELECT
       ci.cart_item_id, ci.product_id, ci.quantity,
       p.product_title, p.price, p.quantity AS stock, p.status,
       p.school_name, p.size, p.shipping_name,   
   p.shipping_price,
       COALESCE(p.category_id, cat.category_id) AS category_id,
       COALESCE(p.gender, ut.gender) AS gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       p.seller_id, u.user_name AS seller_name,
       pi.image_url AS cover_image
     FROM cart_item ci
     JOIN cart c ON c.cart_id = ci.cart_id AND c.user_id = ?
     JOIN products p ON p.product_id = ci.product_id
     LEFT JOIN users u ON u.user_id = p.seller_id
     LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item cat ON cat.category_id = ut.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
     WHERE ci.cart_item_id IN (${placeholders})`,
    [userId, ...cartItemIds]
  );
  return rows;
};

// ────────────────────────────────────────────────────────
// CHECKOUT — ดึงรายการสินค้าจาก product_ids (ซื้อเลย)
// ────────────────────────────────────────────────────────
const getCheckoutItemsByProduct = async (userId, productIds) => {
  if (!productIds.length) throw { status: 400, message: "ไม่มีรายการสินค้า" };

  const placeholders = productIds.map(() => "?").join(",");
  const [rows] = await db.execute(
    `SELECT
       p.product_id AS cart_item_id,   -- ใช้ product_id แทน cart_item_id เพื่อให้ frontend ทำงานได้เหมือนเดิม
       p.product_id, 1 AS quantity,
       p.product_title, p.price, p.quantity AS stock, p.status,p.shipping_name,
       p.shipping_price,
       p.school_name, p.size,
       COALESCE(p.category_id, cat.category_id) AS category_id,
       COALESCE(p.gender, ut.gender) AS gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       p.seller_id, u.user_name AS seller_name,
       pi.image_url AS cover_image
     FROM products p
     LEFT JOIN users u ON u.user_id = p.seller_id
     LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item cat ON cat.category_id = ut.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
     WHERE p.product_id IN (${placeholders})
       AND p.status = 'available'`,
    [...productIds]
  );
  return rows;
};

export {
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getShippingProviders, getCheckoutItems,
  getCheckoutItemsByProduct,
};