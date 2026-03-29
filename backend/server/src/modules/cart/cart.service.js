// backend/server/src/modules/cart/cart.service.js
import { db } from "../../config/db.js";

// ── ดึงหรือสร้าง cart ของ user ──────────────────────────
const getOrCreateCart = async (userId) => {
  const [[cart]] = await db.execute(
    "SELECT cart_id FROM cart WHERE user_id = ?", [userId]
  );
  if (cart) return cart.cart_id;

  const [result] = await db.execute(
    "INSERT INTO cart (user_id) VALUES (?)", [userId]
  );
  return result.insertId;
};

// ── ดึงรายการในตะกร้า ────────────────────────────────────
const getCart = async (userId) => {
  const cartId = await getOrCreateCart(userId);

  const [rows] = await db.execute(
    `SELECT
       ci.cart_item_id,
       ci.product_id,
       ci.quantity,
       p.product_title,
       p.price,
       p.quantity AS stock,
       p.status,
       COALESCE(p.category_id, cat.category_id) AS category_id,
       COALESCE(p.gender, ut.gender)             AS gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       p.size,
       p.school_name,
       p.seller_id,
       u.user_name AS seller_name,
       pi.image_url AS cover_image, 
       p.shipping_name,   
        p.shipping_price 

       
     FROM cart_item ci
     JOIN products p ON p.product_id = ci.product_id
     LEFT JOIN users u ON u.user_id = p.seller_id
     LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item cat ON cat.category_id = ut.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
     WHERE ci.cart_id = ?
     ORDER BY ci.added_at DESC`,
    [cartId]
  );
  return { cart_id: cartId, items: rows };
};

// ── เพิ่มสินค้าลงตะกร้า ──────────────────────────────────
const addToCart = async (userId, productId, quantity = 1) => {
  const cartId = await getOrCreateCart(userId);

  // เช็คว่าสินค้ามีอยู่และมีสต็อก
  const [[product]] = await db.execute(
    "SELECT product_id, quantity, status FROM products WHERE product_id = ?",
    [productId]
  );
  if (!product)                    throw { status: 404, message: "ไม่พบสินค้า" };
  if (product.status !== "available") throw { status: 400, message: "สินค้าไม่พร้อมขาย" };
  if (product.quantity < 1)        throw { status: 400, message: "สินค้าหมด" };

  // ถ้ามีอยู่แล้วในตะกร้า → update quantity
  const [[existing]] = await db.execute(
    "SELECT cart_item_id, quantity FROM cart_item WHERE cart_id = ? AND product_id = ?",
    [cartId, productId]
  );

  if (existing) {
    const newQty = Math.min(existing.quantity + quantity, product.quantity);
    await db.execute(
      "UPDATE cart_item SET quantity = ? WHERE cart_item_id = ?",
      [newQty, existing.cart_item_id]
    );
  } else {
    await db.execute(
      "INSERT INTO cart_item (cart_id, product_id, quantity) VALUES (?, ?, ?)",
      [cartId, productId, Math.min(quantity, product.quantity)]
    );
  }

  return getCart(userId);
};

// ── อัปเดตจำนวน ──────────────────────────────────────────
const updateCartItem = async (userId, cartItemId, quantity) => {
  const cartId = await getOrCreateCart(userId);

  if (quantity < 1) {
    await db.execute(
      "DELETE FROM cart_item WHERE cart_item_id = ? AND cart_id = ?",
      [cartItemId, cartId]
    );
  } else {
    await db.execute(
      "UPDATE cart_item SET quantity = ? WHERE cart_item_id = ? AND cart_id = ?",
      [quantity, cartItemId, cartId]
    );
  }
  return getCart(userId);
};

// ── ลบรายการ ─────────────────────────────────────────────
const removeCartItem = async (userId, cartItemId) => {
  const cartId = await getOrCreateCart(userId);
  await db.execute(
    "DELETE FROM cart_item WHERE cart_item_id = ? AND cart_id = ?",
    [cartItemId, cartId]
  );
  return getCart(userId);
};

// ── ลบทั้งหมด ─────────────────────────────────────────────
const clearCart = async (userId) => {
  const cartId = await getOrCreateCart(userId);
  await db.execute("DELETE FROM cart_item WHERE cart_id = ?", [cartId]);
};

// ── นับจำนวน items ────────────────────────────────────────
const getCartCount = async (userId) => {
  const cartId = await getOrCreateCart(userId);
  const [[{ count }]] = await db.execute(
    "SELECT COUNT(*) AS count FROM cart_item WHERE cart_id = ?",
    [cartId]
  );
  return Number(count);
};

export { getCart, addToCart, updateCartItem, removeCartItem, clearCart, getCartCount };