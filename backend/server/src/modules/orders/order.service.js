import { db } from "../../config/db.js";
import { sendNotification } from "../../lib/notify.js";

/* ────────────────────────────────────────────────────────
 * Auto-complete: ออเดอร์ที่สถานะ "shipping" มากกว่า 7 วัน
 * → เปลี่ยนเป็น "delivered" อัตโนมัติ
 * ──────────────────────────────────────────────────────── */
export const autoCompleteShippedOrders = async () => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // ดึงออเดอร์ที่จัดส่งแล้ว > 7 วัน และมีเลข tracking number
    // (ตาม policy: มีเลขพัสดุ + ครบ 7 วันนับจากวันจัดส่ง → อนุมัติรับของอัตโนมัติ)
    const [toComplete] = await conn.execute(
      `SELECT order_id FROM orders
       WHERE order_status = 'shipping'
         AND shipping_date IS NOT NULL
         AND tracking_number IS NOT NULL
         AND tracking_number <> ''
         AND shipping_date <= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    if (toComplete.length > 0) {
      const ids = toComplete.map(r => r.order_id);
      const ph  = ids.map(() => "?").join(",");
      await conn.execute(
        `UPDATE orders
         SET order_status = 'delivered',
             payout_status = 'pending',
             completed_at = NOW()
         WHERE order_id IN (${ph})`,
        ids
      );
    }
    await conn.commit();
    return toComplete.length;
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

/* ────────────────────────────────────────────────────────
 * ผู้ซื้อยืนยันรับสินค้า
 * ──────────────────────────────────────────────────────── */
export const confirmReceipt = async (orderId, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.execute(
      `SELECT order_id, order_status, buyer_id
       FROM orders WHERE order_id = ? AND buyer_id = ? FOR UPDATE`,
      [orderId, userId]
    );
    if (!order) throw Object.assign(new Error("ไม่พบคำสั่งซื้อ"), { status: 404 });
    if (order.order_status !== "shipping")
      throw Object.assign(new Error("ออเดอร์ยังไม่ได้อยู่ในสถานะจัดส่ง"), { status: 400 });

    await conn.execute(
      `UPDATE orders
       SET order_status = 'delivered',
           payout_status = 'pending',
           completed_at = NOW()
       WHERE order_id = ?`,
      [orderId]
    );
    await conn.commit();

    // Notify seller that buyer confirmed receipt
    try {
      const [[ord]] = await db.query(
        `SELECT seller_id FROM orders WHERE order_id = ?`, [orderId]
      );
      if (ord?.seller_id) {
        await sendNotification(ord.seller_id, {
          type:   "order_delivered",
          title:  "ผู้ซื้อยืนยันรับสินค้าแล้ว",
          body:   `ออเดอร์ #${orderId} ได้รับการยืนยันเรียบร้อย`,
          ref_id: orderId,
        });
      }
    } catch (e) { console.warn("[notify] order_delivered:", e.message); }

    return { message: "ยืนยันรับสินค้าเรียบร้อย", order_id: orderId };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

/* ────────────────────────────────────────────────────────
 * ผู้ซื้อยกเลิกออเดอร์ (เฉพาะสถานะ pending)
 * - ออเดอร์ > 7 วันที่จัดส่งแล้ว ก็ยกเลิกได้
 * ──────────────────────────────────────────────────────── */
export const cancelBuyerOrder = async (orderId, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.execute(
      `SELECT order_id, order_status, payment_status, buyer_id
       FROM orders WHERE order_id = ? AND buyer_id = ? FOR UPDATE`,
      [orderId, userId]
    );
    if (!order) throw Object.assign(new Error("ไม่พบคำสั่งซื้อ"), { status: 404 });

    // ยกเลิกได้เฉพาะ pending หรือ shipping ที่เกิน 7 วัน
    const canCancel =
      order.order_status === "pending" ||
      (order.order_status === "shipping" && (() => {
        // ตรวจสอบเวลาจัดส่งต้องเกิน 7 วัน — ใช้ DB ตอน query แทน
        return true; // จะ validate ด้วย shipping_date ด้านล่าง
      })());

    if (!canCancel) {
      throw Object.assign(new Error("ไม่สามารถยกเลิกออเดอร์ในสถานะนี้ได้"), { status: 400 });
    }

    // ถ้า shipping: ต้องเกิน 7 วันจาก shipping_date
    if (order.order_status === "shipping") {
      const [[shippedCheck]] = await conn.execute(
        `SELECT 1 FROM orders
         WHERE order_id = ? AND shipping_date <= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [orderId]
      );
      if (!shippedCheck) {
        throw Object.assign(
          new Error("สามารถยกเลิกได้หลังจากผู้ขายไม่ดำเนินการเกิน 7 วัน"),
          { status: 400 }
        );
      }
    }

    // อัปเดต order → cancelled
    await conn.execute(
      `UPDATE orders SET order_status = 'cancelled' WHERE order_id = ?`,
      [orderId]
    );

    // คืนสถานะสินค้ากลับเป็น available
    const [items] = await conn.execute(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
      [orderId]
    );
    for (const item of items) {
      await conn.execute(
        `UPDATE products
         SET quantity = quantity + ?,
             status = 'available'
         WHERE product_id = ? AND status IN ('sold','available')`,
        [item.quantity, item.product_id]
      );
    }

    await conn.commit();
    return { message: "ยกเลิกคำสั่งซื้อเรียบร้อย", order_id: orderId };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

export const getOrderDetail = async (orderId, userId) => {
  const [[order]] = await db.execute(
    `SELECT o.*,
            CASE WHEN o.order_type = 'donation' THEN 'ซื้อเพื่อส่งต่อ' ELSE 'ซื้อปกติ' END AS order_type_label
     FROM orders o
     WHERE o.order_id = ? AND o.buyer_id = ?`,
    [orderId, userId]
  );
  if (!order) throw { status: 404, message: "ไม่พบคำสั่งซื้อ" };

  const [items] = await db.execute(
    `SELECT oi.*,
            p.product_title, p.school_name, p.size, p.category_id,
            pi.image_url   AS cover_image,
            u.user_name    AS seller_name,
            u.user_phone   AS seller_phone
     FROM order_items oi
     JOIN products p ON p.product_id = oi.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
     LEFT JOIN users u ON u.user_id = p.seller_id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  let shipping = [];
  try {
    [shipping] = await db.execute(
      `SELECT os.*, sp.name AS provider_name, sp.code
       FROM order_shipping os
       LEFT JOIN shipping_provider sp ON sp.provider_id = os.provider_id
       WHERE os.order_id = ?`,
      [orderId]
    );
  } catch { /* table ยังไม่มี */ }

  return { ...order, items, shipping };
};

export const getMyOrders = async (userId) => {
  // auto-complete ออเดอร์ที่จัดส่งครบ 7 วันก่อน return
  await autoCompleteShippedOrders().catch(() => {});

  const [orders] = await db.execute(
    `SELECT
       o.order_id, o.total_price, o.order_status, o.payment_status,
       o.order_type, o.created_at, o.tracking_number, o.shipping_date,
       o.completed_at,
       COUNT(DISTINCT oi.order_item_id) AS item_count,
       GROUP_CONCAT(DISTINCT p.product_title SEPARATOR ', ') AS product_names,
       (
         SELECT sp.name FROM order_shipping os
         LEFT JOIN shipping_provider sp ON sp.provider_id = os.provider_id
         WHERE os.order_id = o.order_id LIMIT 1
       ) AS shipping_provider_name,
       COALESCE((
         SELECT SUM(os2.shipping_price)
         FROM order_shipping os2
         WHERE os2.order_id = o.order_id
       ), 0) AS shipping_total,
       (
         SELECT JSON_ARRAYAGG(JSON_OBJECT(
           'product_id',  oi2.product_id,
           'title',       p2.product_title,
           'qty',         oi2.quantity,
           'price',       oi2.price_at_purchase,
           'size',        p2.size,
           'category_id', p2.category_id,
           'cover_image', (
             SELECT pi2.image_url FROM product_images pi2
             WHERE pi2.product_id = p2.product_id
             ORDER BY pi2.is_cover DESC, pi2.sort_order ASC
             LIMIT 1
           )
         ))
         FROM order_items oi2
         JOIN products p2 ON p2.product_id = oi2.product_id
         WHERE oi2.order_id = o.order_id
       ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.order_id
     LEFT JOIN products p ON p.product_id = oi.product_id
     WHERE o.buyer_id = ?
     GROUP BY o.order_id
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return orders;
};