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

const placeOrder = async ({ userId, cartItemIds, productIds, addressId, orderType, requestId, donationAddress }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── ดึงรายการสินค้า ──
    let items;
    if (productIds?.length) {
      const ph = productIds.map(() => "?").join(",");
      const [rows] = await conn.execute(
        `SELECT p.product_id, 1 AS quantity, p.price, p.seller_id, p.quantity AS stock
         FROM products p WHERE p.product_id IN (${ph}) AND p.status = 'available'`,
        productIds
      );
      items = rows;
    } else {
      const ph = cartItemIds.map(() => "?").join(",");
      const [rows] = await conn.execute(
        `SELECT ci.product_id, ci.quantity, p.price, p.seller_id, p.quantity AS stock
         FROM cart_item ci
         JOIN cart c ON c.cart_id = ci.cart_id AND c.user_id = ?
         JOIN products p ON p.product_id = ci.product_id
         WHERE ci.cart_item_id IN (${ph})`,
        [userId, ...cartItemIds]
      );
      items = rows;
    }

    if (!items.length) throw { status: 400, message: "ไม่พบสินค้า" };

    // ── ตรวจ stock ──
    for (const item of items) {
      if (item.stock < item.quantity)
        throw { status: 400, message: "สินค้าบางรายการมีไม่เพียงพอ" };
    }

    const totalPrice = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

    // ── ดึง shipping address ──
    let recipientName, shippingAddress, shippingProvince, shippingPostcode, shippingPhone;

    if (orderType === "donation" && donationAddress) {
      // ใช้ที่อยู่โรงเรียนที่ส่งมาจาก frontend
      recipientName    = donationAddress.name;
      shippingAddress  = [donationAddress.address, donationAddress.district].filter(Boolean).join(" ");
      shippingProvince = donationAddress.province;
      shippingPostcode = donationAddress.postal_code;
      shippingPhone    = donationAddress.phone;
    } else {
      const [[addr]] = await conn.execute(
        "SELECT * FROM address WHERE address_id = ? AND user_id = ?",
        [addressId, userId]
      );
      if (!addr) throw { status: 400, message: "ไม่พบที่อยู่จัดส่ง" };
      recipientName    = addr.recipient_name;
      shippingAddress  = addr.address_line;
      shippingProvince = addr.province;
      shippingPostcode = addr.postcode;
      shippingPhone    = addr.phone;
    }

    // ── INSERT orders ──
    const [orderResult] = await conn.execute(
      `INSERT INTO orders
        (buyer_id, total_price, order_status, shipping_address, shipping_province,
         shipping_postcode, recipient_name, shipping_phone, order_type, request_id)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
      [userId, totalPrice, shippingAddress, shippingProvince,
       shippingPostcode, recipientName, shippingPhone,
       orderType || "purchase", requestId || null]
    );
    const orderId = orderResult.insertId;

    // ── INSERT order_items + ลด stock + mark product sold ──
    for (const item of items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
      await conn.execute(
        `UPDATE products SET quantity = quantity - ? WHERE product_id = ?`,
        [item.quantity, item.product_id]
      );
      // ถ้าหมด → เปลี่ยน status เป็น sold
      await conn.execute(
        `UPDATE products SET status = 'sold'
         WHERE product_id = ? AND quantity <= 0`,
        [item.product_id]
      );
    }

    // ── ลบออกจาก cart (กรณีซื้อจาก cart) ──
    if (cartItemIds?.length) {
      const ph = cartItemIds.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM cart_item WHERE cart_item_id IN (${ph})`,
        cartItemIds
      );
    }

    // ── ถ้าเป็น donation → สร้าง donation_record ──
    if (orderType === "donation" && requestId) {
      // ดึงชื่อผู้ซื้อ
      const [[buyer]] = await conn.execute(
        "SELECT user_name, user_phone FROM users WHERE user_id = ?", [userId]
      );

      const totalQty = items.reduce((s, i) => s + i.quantity, 0);

      const [donResult] = await conn.execute(
        `INSERT INTO donation_record
          (request_id, donor_id, donor_name, donor_phone, delivery_method,
           donation_date, quantity, status, order_id)
         VALUES (?, ?, ?, ?, 'parcel', CURDATE(), ?, 'รอตรวจสอบ', ?)`,
        [requestId, userId, buyer.user_name, buyer.user_phone || shippingPhone,
         totalQty, orderId]
      );

      // ── snapshot รายการสินค้าลงใน items_snapshot (JSON) ──
      await conn.execute(
        `UPDATE donation_record
         SET items_snapshot = ?
         WHERE donation_id = ?`,
        [JSON.stringify(items.map(i => ({
          product_id: i.product_id,
          quantity:   i.quantity,
          price:      i.price,
        }))), donResult.insertId]
      );

      // ── Notification โรงเรียน ──
      await conn.execute(
        `INSERT INTO notifications (user_id, type, title, body, ref_id)
         SELECT u.user_id,
                'donation',
                'มีการซื้อชุดเพื่อส่งต่อให้โรงเรียน',
                CONCAT(?, ' ซื้อสินค้าจำนวน ', ?, ' ชิ้น เพื่อส่งต่อให้โรงเรียน'),
                ?
         FROM users u
         WHERE u.school_id = (
           SELECT school_id FROM donation_request WHERE request_id = ?
         ) AND u.role IN ('school','admin')
         LIMIT 5`,
        [buyer.user_name, totalQty, orderId, requestId]
      );
    }

    await conn.commit();
    return { order_id: orderId };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export {
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getShippingProviders, getCheckoutItems,
  getCheckoutItemsByProduct,
  placeOrder,
};