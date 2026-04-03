// // backend/server/src/modules/checkout/checkout.service.js
// import { db } from "../../config/db.js";
// import Omise from "omise";

// // ── Omise client ──────────────────────────────────────────
// const omise = Omise({
//   publicKey: process.env.OMISE_PUBLIC_KEY,
//   secretKey: process.env.OMISE_SECRET_KEY,
// });

// // ────────────────────────────────────────────────────────
// // ADDRESS
// // ────────────────────────────────────────────────────────
// const getAddresses = async (userId) => {
//   const [rows] = await db.execute(
//     `SELECT * FROM address WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
//     [userId]
//   );
//   return rows;
// };

// const createAddress = async (userId, data) => {
//   const { recipient_name, phone, address_line, district, province, postcode, is_default = 0 } = data;
//   if (is_default) {
//     await db.execute("UPDATE address SET is_default = 0 WHERE user_id = ?", [userId]);
//   }
//   const [[{ cnt }]] = await db.execute(
//     "SELECT COUNT(*) AS cnt FROM address WHERE user_id = ?", [userId]
//   );
//   const setDefault = is_default || Number(cnt) === 0 ? 1 : 0;
//   const [result] = await db.execute(
//     `INSERT INTO address (user_id, recipient_name, phone, address_line, district, province, postcode, is_default)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//     [userId, recipient_name, phone, address_line, district, province, postcode, setDefault]
//   );
//   const [[address]] = await db.execute("SELECT * FROM address WHERE address_id = ?", [result.insertId]);
//   return address;
// };

// const updateAddress = async (userId, addressId, data) => {
//   const { recipient_name, phone, address_line, district, province, postcode, is_default } = data;
//   if (is_default) {
//     await db.execute("UPDATE address SET is_default = 0 WHERE user_id = ?", [userId]);
//   }
//   await db.execute(
//     `UPDATE address SET recipient_name=?, phone=?, address_line=?, district=?, province=?, postcode=?, is_default=?
//      WHERE address_id = ? AND user_id = ?`,
//     [recipient_name, phone, address_line, district, province, postcode, is_default ? 1 : 0, addressId, userId]
//   );
//   const [[address]] = await db.execute("SELECT * FROM address WHERE address_id = ?", [addressId]);
//   return address;
// };

// const deleteAddress = async (userId, addressId) => {
//   await db.execute("DELETE FROM address WHERE address_id = ? AND user_id = ?", [addressId, userId]);
// };

// const setDefaultAddress = async (userId, addressId) => {
//   await db.execute("UPDATE address SET is_default = 0 WHERE user_id = ?", [userId]);
//   await db.execute("UPDATE address SET is_default = 1 WHERE address_id = ? AND user_id = ?", [addressId, userId]);
// };

// // ────────────────────────────────────────────────────────
// // SHIPPING PROVIDERS
// // ────────────────────────────────────────────────────────
// const getShippingProviders = async () => {
//   try {
//     const [rows] = await db.execute(
//       "SELECT * FROM shipping_providers WHERE is_active = 1 ORDER BY provider_id ASC"
//     );
//     return rows;
//   } catch (err) {
//     if (err.code === "ER_NO_SUCH_TABLE") return [];
//     throw err;
//   }
// };

// // ────────────────────────────────────────────────────────
// // CHECKOUT ITEMS จาก cart_item_ids
// // ────────────────────────────────────────────────────────
// const getCheckoutItems = async (userId, cartItemIds) => {
//   if (!cartItemIds.length) throw { status: 400, message: "ไม่มีรายการสินค้า" };
//   const placeholders = cartItemIds.map(() => "?").join(",");
//   const [rows] = await db.execute(
//     `SELECT
//        ci.cart_item_id, ci.product_id, ci.quantity,
//        p.product_title, p.price, p.quantity AS stock, p.status,
//        p.school_name, p.size, p.weight,
//        COALESCE(p.category_id, cat.category_id) AS category_id,
//        COALESCE(p.gender, ut.gender)             AS gender,
//        COALESCE(ut.type_name, p.custom_type_name) AS type_name,
//        p.seller_id, u.user_name AS seller_name,
//        pi.image_url AS cover_image
//      FROM cart_item ci
//      JOIN cart      c  ON c.cart_id    = ci.cart_id  AND c.user_id  = ?
//      JOIN products  p  ON p.product_id = ci.product_id
//      LEFT JOIN users          u   ON u.user_id          = p.seller_id
//      LEFT JOIN uniform_type   ut  ON ut.uniform_type_id = p.uniform_type_id
//      LEFT JOIN category_item  cat ON cat.category_id    = ut.category_id
//      LEFT JOIN product_images pi  ON pi.product_id      = p.product_id AND pi.is_cover = 1
//      WHERE ci.cart_item_id IN (${placeholders})`,
//     [userId, ...cartItemIds]
//   );
//   return rows;
// };

// // ────────────────────────────────────────────────────────
// // CHECKOUT ITEMS จาก product_ids (ซื้อเลย)
// // ────────────────────────────────────────────────────────
// const getCheckoutItemsByProduct = async (userId, productIds) => {
//   if (!productIds.length) throw { status: 400, message: "ไม่มีรายการสินค้า" };
//   const placeholders = productIds.map(() => "?").join(",");
//   const [rows] = await db.execute(
//     `SELECT
//        p.product_id AS cart_item_id,
//        p.product_id, 1 AS quantity,
//        p.product_title, p.price, p.quantity AS stock, p.status,
//        p.school_name, p.size, p.weight,
//        COALESCE(p.category_id, cat.category_id) AS category_id,
//        COALESCE(p.gender, ut.gender)             AS gender,
//        COALESCE(ut.type_name, p.custom_type_name) AS type_name,
//        p.seller_id, u.user_name AS seller_name,
//        pi.image_url AS cover_image
//      FROM products p
//      LEFT JOIN users          u   ON u.user_id          = p.seller_id
//      LEFT JOIN uniform_type   ut  ON ut.uniform_type_id = p.uniform_type_id
//      LEFT JOIN category_item  cat ON cat.category_id    = ut.category_id
//      LEFT JOIN product_images pi  ON pi.product_id      = p.product_id AND pi.is_cover = 1
//      WHERE p.product_id IN (${placeholders}) AND p.status = 'available'`,
//     [...productIds]
//   );
//   return rows;
// };

// // ────────────────────────────────────────────────────────
// // SHIPPING OPTIONS — คำนวณค่าส่งแยกตาม seller + provider
// //
// // กฎการคำนวณ:
// //   price = base_price + (price_per_item × qty)
// //   ถ้า price > max_price → ใช้ max_price
// //   ถ้า subtotal >= free_threshold → price = 0 (ฟรี)
// // ────────────────────────────────────────────────────────
// const getShippingOptions = async (cartItemIds) => {
//   if (!cartItemIds.length) return {};

//   try {
//     const placeholders = cartItemIds.map(() => "?").join(",");

//     // ดึงสินค้าพร้อม seller_id
//     const [itemRows] = await db.execute(
//       `SELECT ci.cart_item_id, ci.quantity, p.product_id, p.seller_id, p.price, p.weight
//        FROM cart_item ci
//        JOIN products p ON p.product_id = ci.product_id
//        WHERE ci.cart_item_id IN (${placeholders})`,
//       cartItemIds
//     );

//     // ถ้าไม่มี cart_item (ซื้อเลยจาก product_id) ให้ดึงจาก products โดยตรง
//     const effectiveItems = itemRows.length > 0 ? itemRows : await (async () => {
//       const [rows] = await db.execute(
//         `SELECT product_id AS cart_item_id, 1 AS quantity, product_id, seller_id, price, weight
//          FROM products WHERE product_id IN (${placeholders})`,
//         cartItemIds
//       );
//       return rows;
//     })();

//     if (!effectiveItems.length) return {};

//     // ดึง provider ที่แต่ละ seller รองรับ (จาก product_shipping)
//     const sellerIds = [...new Set(effectiveItems.map(i => i.seller_id))];
//     const productIds = [...new Set(effectiveItems.map(i => i.product_id))];

//     const providerPH = productIds.map(() => "?").join(",");
//     let providerRows = [];
//     try {
//       [providerRows] = await db.execute(
//         `SELECT
//            ps.product_id, ps.provider_id,
//            sp.name, sp.code, sp.is_active,
//            p.seller_id
//          FROM product_shipping ps
//          JOIN shipping_providers sp ON sp.provider_id = ps.provider_id
//          JOIN products           p  ON p.product_id   = ps.product_id
//          WHERE ps.product_id IN (${providerPH}) AND sp.is_active = 1`,
//         productIds
//       );
//     } catch (e) {
//       if (e.code !== "ER_NO_SUCH_TABLE") throw e;
//       // ยังไม่มีตาราง → return empty (จะ migrate ทีหลัง)
//       return {};
//     }

//     // จัดกลุ่ม provider ต่อ seller
//     // ถ้า seller มีหลาย product ให้ใช้เฉพาะ provider ที่ทุก product รองรับ (intersection)
//     const sellerProductMap = {}; // seller_id → Set<product_id>
//     for (const item of effectiveItems) {
//       if (!sellerProductMap[item.seller_id]) sellerProductMap[item.seller_id] = new Set();
//       sellerProductMap[item.seller_id].add(item.product_id);
//     }

//     const productProviderMap = {}; // product_id → Set<provider_id>
//     for (const row of providerRows) {
//       if (!productProviderMap[row.product_id]) productProviderMap[row.product_id] = new Set();
//       productProviderMap[row.product_id].add(row.provider_id);
//     }

//     // หา provider_id ที่รองรับทุก product ของ seller (intersection)
//     const sellerCommonProviders = {}; // seller_id → Set<provider_id>
//     for (const [sellerId, pids] of Object.entries(sellerProductMap)) {
//       let common = null;
//       for (const pid of pids) {
//         const providers = productProviderMap[pid] || new Set();
//         if (common === null) {
//           common = new Set(providers);
//         } else {
//           for (const p of [...common]) {
//             if (!providers.has(p)) common.delete(p);
//           }
//         }
//       }
//       sellerCommonProviders[sellerId] = common || new Set();
//     }

//     // คำนวณราคา + สร้าง result
//     const result = {};

//     for (const sellerId of sellerIds) {
//       const sellerItems = effectiveItems.filter(i => i.seller_id === sellerId);
//       const qty = sellerItems.reduce((s, i) => s + Number(i.quantity), 0);
//       const totalWeight = sellerItems.reduce((s, i) => s + (Number(i.weight) || 0) * Number(i.quantity), 0);
//       const subtotal = sellerItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);

//       const validProviders = sellerCommonProviders[sellerId] || new Set();
//       const providerDetails = providerRows
//         .filter(r => r.seller_id === sellerId && validProviders.has(r.provider_id));

//       // dedupe providers
//       const seen = new Set();
//       const uniqueProviders = providerDetails.filter(r => {
//         if (seen.has(r.provider_id)) return false;
//         seen.add(r.provider_id); return true;
//       });

//       result[sellerId] = uniqueProviders.map(p => {
//         // ราคาค่าส่ง: ใช้น้ำหนักเป็นหลักถ้ามี ไม่งั้นใช้จำนวนชิ้น
//         // Simplified rate (ปรับได้ตาม schema จริง):
//         // base_rate = 30 บาท, +10 ต่อ kg (หรือต่อชิ้นถ้าไม่มี weight), max 150 บาท
//         const BASE_RATE = 30;
//         const RATE_PER_KG = 10;
//         const RATE_PER_ITEM = 10;
//         const MAX_PRICE = 150;
//         const FREE_THRESHOLD = 500;

//         let price;
//         if (totalWeight > 0) {
//           price = BASE_RATE + Math.ceil(totalWeight) * RATE_PER_KG;
//         } else {
//           price = BASE_RATE + qty * RATE_PER_ITEM;
//         }
//         if (price > MAX_PRICE) price = MAX_PRICE;
//         if (subtotal >= FREE_THRESHOLD) price = 0;

//         return {
//           provider_id: p.provider_id,
//           name: p.name,
//           code: p.code,
//           price,
//           est_days: "2-5 วัน",
//           free_threshold: FREE_THRESHOLD,
//         };
//       });
//     }

//     return result;
//   } catch (err) {
//     console.error("[getShippingOptions]", err);
//     return {};
//   }
// };

// // ────────────────────────────────────────────────────────
// // PLACE ORDER + Omise Charge
// //
// // flow:
// //  1. ตรวจ stock
// //  2. INSERT orders (status = pending)
// //  3. INSERT order_items, ลด stock
// //  4. INSERT order_shipping
// //  5. ถ้ามี omise_token → charge card → update payment_status
// //  6. ถ้า promptpay → สร้าง source → สร้าง charge → คืน QR
// //  7. ถ้า donation → ไม่ต้องชำระทันที
// // ────────────────────────────────────────────────────────
// const placeOrder = async ({
//   userId,
//   cartItemIds,
//   productIds,
//   addressId,
//   orderType,
//   requestId,
//   donationAddress,
//   shippingSelections,
//   omiseToken,      // card token จาก OmiseJS
//   paymentMethod,   // "card" | "promptpay" | null
// }) => {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     // ── ดึงรายการสินค้า ──────────────────────────────────
//     let items;
//     if (productIds?.length) {
//       const ph = productIds.map(() => "?").join(",");
//       const [rows] = await conn.execute(
//         `SELECT p.product_id, 1 AS quantity, p.price, p.seller_id, p.quantity AS stock
//          FROM products p WHERE p.product_id IN (${ph}) AND p.status = 'available'`,
//         productIds
//       );
//       items = rows;
//     } else {
//       const ph = cartItemIds.map(() => "?").join(",");
//       const [rows] = await conn.execute(
//         `SELECT ci.product_id, ci.quantity, p.price, p.seller_id, p.quantity AS stock
//          FROM cart_item ci
//          JOIN cart c ON c.cart_id = ci.cart_id AND c.user_id = ?
//          JOIN products p ON p.product_id = ci.product_id
//          WHERE ci.cart_item_id IN (${ph})`,
//         [userId, ...cartItemIds]
//       );
//       items = rows;
//     }

//     if (!items.length) throw { status: 400, message: "ไม่พบสินค้า" };
//     for (const item of items) {
//       if (item.stock < item.quantity)
//         throw { status: 400, message: "สินค้าบางรายการมีไม่เพียงพอ" };
//     }

//     // ── คำนวณยอด ──────────────────────────────────────────
//     const itemsTotal = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
//     const shippingTotal = (shippingSelections || []).reduce((s, v) => s + Number(v.price || 0), 0);
//     const totalPrice = itemsTotal + shippingTotal;

//     // ── ดึงที่อยู่จัดส่ง ──────────────────────────────────
//     let recipientName, shippingAddress, shippingProvince, shippingPostcode, shippingPhone;
//     if (orderType === "donation" && donationAddress) {
//       recipientName = donationAddress.name;
//       shippingAddress = [donationAddress.address, donationAddress.district].filter(Boolean).join(" ");
//       shippingProvince = donationAddress.province;
//       shippingPostcode = donationAddress.postal_code;
//       shippingPhone = donationAddress.phone;
//     } else {
//       const [[addr]] = await conn.execute(
//         "SELECT * FROM address WHERE address_id = ? AND user_id = ?", [addressId, userId]
//       );
//       if (!addr) throw { status: 400, message: "ไม่พบที่อยู่จัดส่ง" };
//       recipientName = addr.recipient_name;
//       shippingAddress = addr.address_line;
//       shippingProvince = addr.province;
//       shippingPostcode = addr.postcode;
//       shippingPhone = addr.phone;
//     }

//     // ── INSERT orders ─────────────────────────────────────
//     const firstSellerId = items[0]?.seller_id || null;

//     const [orderResult] = await conn.execute(
//       `INSERT INTO orders
//     (buyer_id, seller_id, total_price, order_status, payment_status, payment_method,
//      shipping_address, shipping_province, shipping_postcode,
//      recipient_name, shipping_phone, order_type, request_id)
//    VALUES (?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         userId, firstSellerId, totalPrice,
//         paymentMethod || "none",
//         shippingAddress, shippingProvince, shippingPostcode,
//         recipientName, shippingPhone,
//         orderType || "purchase",
//         requestId || null,
//       ]
//     );
//     const orderId = orderResult.insertId;

//     // ── INSERT order_items + ลด stock ────────────────────
//     for (const item of items) {
//       await conn.execute(
//         `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
//          VALUES (?, ?, ?, ?)`,
//         [orderId, item.product_id, item.quantity, item.price]
//       );
//       await conn.execute(
//         `UPDATE products SET quantity = quantity - ? WHERE product_id = ?`,
//         [item.quantity, item.product_id]
//       );
//       await conn.execute(
//         `UPDATE products SET status = 'sold' WHERE product_id = ? AND quantity <= 0`,
//         [item.product_id]
//       );
//     }

//     // ── INSERT order_shipping ─────────────────────────────
//     if (shippingSelections?.length) {
//       try {
//         for (const s of shippingSelections) {
//           await conn.execute(
//             `INSERT INTO order_shipping (order_id, seller_id, provider_id, shipping_price)
//              VALUES (?, ?, ?, ?)`,
//             [orderId, s.seller_id, s.provider_id, s.price || 0]
//           );
//         }
//       } catch (e) {
//         if (e.code !== "ER_NO_SUCH_TABLE") throw e;
//         console.warn("[placeOrder] order_shipping table not found — skipping");
//       }
//     }

//     // ── ลบออกจาก cart ─────────────────────────────────────
//     if (cartItemIds?.length) {
//       const ph = cartItemIds.map(() => "?").join(",");
//       await conn.execute(`DELETE FROM cart_item WHERE cart_item_id IN (${ph})`, cartItemIds);
//     }

//     // ── Omise: Card Payment ───────────────────────────────
//     let chargeId = null;
//     let qrBase64 = null;

//     if (omiseToken && paymentMethod === "card") {
//       // สร้าง charge ด้วย token (บาท → สตางค์ × 100)
//       const charge = await omise.charges.create({
//         amount: Math.round(totalPrice * 100),
//         currency: "thb",
//         card: omiseToken,
//         description: `Order #${orderId}`,
//         metadata: { order_id: orderId, user_id: userId },
//       });

//       chargeId = charge.id;

//       if (charge.status === "successful") {
//         await conn.execute(
//           `UPDATE orders SET payment_status = 'paid', omise_charge_id = ?, order_status = 'confirmed'
//            WHERE order_id = ?`,
//           [chargeId, orderId]
//         );
//       } else {
//         // charge failed → rollback
//         await conn.rollback();
//         conn.release();
//         throw { status: 402, message: `ชำระเงินไม่สำเร็จ: ${charge.failure_message || charge.status}` };
//       }
//     }

//     // ── Omise: PromptPay ──────────────────────────────────
//     if (paymentMethod === "promptpay") {
//       // สร้าง source ประเภท promptpay
//       const source = await omise.sources.create({
//         type: "promptpay",
//         amount: Math.round(totalPrice * 100),
//         currency: "thb",
//       });

//       const charge = await omise.charges.create({
//         amount: Math.round(totalPrice * 100),
//         currency: "thb",
//         source: source.id,
//         description: `Order #${orderId}`,
//         metadata: { order_id: orderId, user_id: userId },
//         return_uri: `${process.env.FRONTEND_URL}/orders/${orderId}?payment=success`,
//       });

//       chargeId = charge.id;
//       // เก็บ charge_id ไว้ poll ทีหลัง
//       await conn.execute(
//         `UPDATE orders SET omise_charge_id = ? WHERE order_id = ?`,
//         [chargeId, orderId]
//       );

//       // QR image จาก Omise (base64)
//       if (charge.source?.scannable_code?.image?.download_uri) {
//         try {
//           const imgRes = await fetch(charge.source.scannable_code.image.download_uri);
//           const imgBuf = await imgRes.arrayBuffer();
//           qrBase64 = Buffer.from(imgBuf).toString("base64");
//         } catch { /* ถ้า fetch QR ไม่ได้ก็ส่ง charge_id ไปแทน */ }
//       }
//     }

//     // ── Donation record ───────────────────────────────────
//     if (orderType === "donation" && requestId) {
//       const [[buyer]] = await conn.execute(
//         "SELECT user_name, user_phone FROM users WHERE user_id = ?", [userId]
//       );
//       const totalQty = items.reduce((s, i) => s + i.quantity, 0);
//       const [donResult] = await conn.execute(
//         `INSERT INTO donation_record
//     (request_id, donor_id, donor_name, donor_phone, delivery_method, donation_date, quantity, status, order_id)
//    VALUES (?, ?, ?, ?, 'parcel', CURDATE(), ?, 'pending', ?)`,  // ← เปลี่ยน 'รอตรวจสอบ' → 'pending'
//         [requestId, userId, buyer.user_name, buyer.user_phone || shippingPhone, totalQty, orderId]
//       );

//       await conn.execute(
//         `UPDATE donation_record SET items_snapshot = ? WHERE donation_id = ?`,
//         [JSON.stringify(items.map(i => ({ product_id: i.product_id, quantity: i.quantity, price: i.price }))), donResult.insertId]
//       );
//       // Notification โรงเรียน
//       await conn.execute(
//         `INSERT INTO notifications (user_id, type, title, body, ref_id)
//          SELECT u.user_id, 'donation',
//                 'มีการซื้อชุดเพื่อส่งต่อให้โรงเรียน',
//                 CONCAT(?, ' ซื้อสินค้าจำนวน ', ?, ' ชิ้น เพื่อส่งต่อให้โรงเรียน'),
//                 ?
//          FROM users u
//          WHERE u.school_id = (SELECT school_id FROM donation_request WHERE request_id = ?)
//            AND u.role IN ('school', 'admin')
//          LIMIT 5`,
//         [buyer.user_name, totalQty, orderId, requestId]
//       );
//     }

//     await conn.commit();
//     return { order_id: orderId, charge_id: chargeId, qr_base64: qrBase64 };

//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// };

// // ────────────────────────────────────────────────────────
// // CHECK PAYMENT STATUS (PromptPay polling)
// // ────────────────────────────────────────────────────────
// const checkPaymentStatus = async (orderId, userId) => {
//   const [[order]] = await db.execute(
//     "SELECT order_id, omise_charge_id, payment_status FROM orders WHERE order_id = ? AND buyer_id = ?",
//     [orderId, userId]
//   );
//   if (!order) throw { status: 404, message: "ไม่พบ order" };
//   if (order.payment_status === "paid") return { paid: true };
//   if (!order.omise_charge_id) return { paid: false };

//   // ดึงสถานะจาก Omise
//   const charge = await omise.charges.retrieve(order.omise_charge_id);
//   if (charge.status === "successful") {
//     await db.execute(
//       "UPDATE orders SET payment_status = 'paid', order_status = 'confirmed' WHERE order_id = ?",
//       [orderId]
//     );
//     return { paid: true };
//   }
//   return { paid: false, omise_status: charge.status };
// };

// export {
//   getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
//   getShippingProviders,
//   getCheckoutItems, getCheckoutItemsByProduct,
//   getShippingOptions,
//   placeOrder,
//   checkPaymentStatus,
// };
// backend/server/src/modules/checkout/checkout.service.js
// backend/server/src/modules/checkout/checkout.service.js
// backend/server/src/modules/checkout/checkout.service.js
import { db } from "../../config/db.js";
import Omise from "omise";

// ── Omise client ──────────────────────────────────────────
const omise = Omise({
  publicKey:  process.env.OMISE_PUBLIC_KEY,
  secretKey:  process.env.OMISE_SECRET_KEY,
});

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
  const [[{ cnt }]] = await db.execute(
    "SELECT COUNT(*) AS cnt FROM address WHERE user_id = ?", [userId]
  );
  const setDefault = is_default || Number(cnt) === 0 ? 1 : 0;
  const [result] = await db.execute(
    `INSERT INTO address (user_id, recipient_name, phone, address_line, district, province, postcode, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, recipient_name, phone, address_line, district, province, postcode, setDefault]
  );
  const [[address]] = await db.execute("SELECT * FROM address WHERE address_id = ?", [result.insertId]);
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
  const [[address]] = await db.execute("SELECT * FROM address WHERE address_id = ?", [addressId]);
  return address;
};

const deleteAddress = async (userId, addressId) => {
  await db.execute("DELETE FROM address WHERE address_id = ? AND user_id = ?", [addressId, userId]);
};

const setDefaultAddress = async (userId, addressId) => {
  await db.execute("UPDATE address SET is_default = 0 WHERE user_id = ?", [userId]);
  await db.execute("UPDATE address SET is_default = 1 WHERE address_id = ? AND user_id = ?", [addressId, userId]);
};

// ────────────────────────────────────────────────────────
// SHIPPING PROVIDERS
// ────────────────────────────────────────────────────────
const getShippingProviders = async () => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM shipping_provider WHERE is_active = 1 ORDER BY provider_id ASC"
    );
    return rows;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return [];
    throw err;
  }
};

// ────────────────────────────────────────────────────────
// CHECKOUT ITEMS จาก cart_item_ids
// ────────────────────────────────────────────────────────
const getCheckoutItems = async (userId, cartItemIds) => {
  if (!cartItemIds.length) throw { status: 400, message: "ไม่มีรายการสินค้า" };
  const placeholders = cartItemIds.map(() => "?").join(",");
  const [rows] = await db.execute(
    `SELECT
       ci.cart_item_id, ci.product_id, ci.quantity,
       p.product_title, p.price, p.quantity AS stock, p.status,
       p.school_name, p.size, p.weight,
       COALESCE(p.category_id, cat.category_id) AS category_id,
       COALESCE(p.gender, ut.gender)             AS gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       p.seller_id, u.user_name AS seller_name,
       pi.image_url AS cover_image
     FROM cart_item ci
     JOIN cart      c  ON c.cart_id    = ci.cart_id  AND c.user_id  = ?
     JOIN products  p  ON p.product_id = ci.product_id
     LEFT JOIN users          u   ON u.user_id          = p.seller_id
     LEFT JOIN uniform_type   ut  ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item  cat ON cat.category_id    = ut.category_id
     LEFT JOIN product_images pi  ON pi.product_id      = p.product_id AND pi.is_cover = 1
     WHERE ci.cart_item_id IN (${placeholders})`,
    [userId, ...cartItemIds]
  );
  return rows;
};

// ────────────────────────────────────────────────────────
// CHECKOUT ITEMS จาก product_ids (ซื้อเลย)
// ────────────────────────────────────────────────────────
const getCheckoutItemsByProduct = async (userId, productIds) => {
  if (!productIds.length) throw { status: 400, message: "ไม่มีรายการสินค้า" };
  const placeholders = productIds.map(() => "?").join(",");
  const [rows] = await db.execute(
    `SELECT
       p.product_id AS cart_item_id,
       p.product_id, 1 AS quantity,
       p.product_title, p.price, p.quantity AS stock, p.status,
       p.school_name, p.size, p.weight,
       COALESCE(p.category_id, cat.category_id) AS category_id,
       COALESCE(p.gender, ut.gender)             AS gender,
       COALESCE(ut.type_name, p.custom_type_name) AS type_name,
       p.seller_id, u.user_name AS seller_name,
       pi.image_url AS cover_image
     FROM products p
     LEFT JOIN users          u   ON u.user_id          = p.seller_id
     LEFT JOIN uniform_type   ut  ON ut.uniform_type_id = p.uniform_type_id
     LEFT JOIN category_item  cat ON cat.category_id    = ut.category_id
     LEFT JOIN product_images pi  ON pi.product_id      = p.product_id AND pi.is_cover = 1
     WHERE p.product_id IN (${placeholders}) AND p.status = 'available'`,
    [...productIds]
  );
  return rows;
};

// ────────────────────────────────────────────────────────
// SHIPPING OPTIONS — คำนวณค่าส่งแยกตาม seller + provider
//
// กฎการคำนวณ:
//   price = base_price + (price_per_item × qty)
//   ถ้า price > max_price → ใช้ max_price
//   ถ้า subtotal >= free_threshold → price = 0 (ฟรี)
// ────────────────────────────────────────────────────────
const getShippingOptions = async (cartItemIds) => {
  if (!cartItemIds.length) return {};

  try {
    const placeholders = cartItemIds.map(() => "?").join(",");

    // ดึงสินค้าพร้อม seller_id
    const [itemRows] = await db.execute(
      `SELECT ci.cart_item_id, ci.quantity, p.product_id, p.seller_id, p.price, p.weight
       FROM cart_item ci
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_item_id IN (${placeholders})`,
      cartItemIds
    );

    // ถ้าไม่มี cart_item (ซื้อเลยจาก product_id) ให้ดึงจาก products โดยตรง
    const effectiveItems = itemRows.length > 0 ? itemRows : await (async () => {
      const [rows] = await db.execute(
        `SELECT product_id AS cart_item_id, 1 AS quantity, product_id, seller_id, price, weight
         FROM products WHERE product_id IN (${placeholders})`,
        cartItemIds
      );
      return rows;
    })();

    if (!effectiveItems.length) return {};

    // ดึง provider ที่แต่ละ seller รองรับ (จาก product_shipping)
    const sellerIds = [...new Set(effectiveItems.map(i => i.seller_id))];
    const productIds = [...new Set(effectiveItems.map(i => i.product_id))];

    const providerPH  = productIds.map(() => "?").join(",");
    let providerRows = [];
    try {
      // ดึง provider พร้อมค่าทุก field จาก DB จริง (base_price, price_per_item ฯลฯ)
      [providerRows] = await db.execute(
        `SELECT
           ps.product_id, ps.provider_id,
           sp.name, sp.code, sp.is_active,
           sp.base_price, sp.price_per_item, sp.max_price,
           sp.free_threshold, sp.est_days_min, sp.est_days_max,
           p.seller_id
         FROM product_shipping ps
         JOIN shipping_provider sp ON sp.provider_id = ps.provider_id
         JOIN products           p  ON p.product_id   = ps.product_id
         WHERE ps.product_id IN (${providerPH}) AND sp.is_active = 1`,
        productIds
      );
    } catch (e) {
      if (e.code !== "ER_NO_SUCH_TABLE") throw e;
      return {};
    }

    // จัดกลุ่ม provider ต่อ seller
    // ถ้า seller มีหลาย product ให้ใช้เฉพาะ provider ที่ทุก product รองรับ (intersection)
    const sellerProductMap = {}; // seller_id → Set<product_id>
    for (const item of effectiveItems) {
      if (!sellerProductMap[item.seller_id]) sellerProductMap[item.seller_id] = new Set();
      sellerProductMap[item.seller_id].add(item.product_id);
    }

    const productProviderMap = {}; // product_id → Set<provider_id>
    for (const row of providerRows) {
      if (!productProviderMap[row.product_id]) productProviderMap[row.product_id] = new Set();
      productProviderMap[row.product_id].add(row.provider_id);
    }

    // หา provider_id ที่รองรับทุก product ของ seller (intersection)
    const sellerCommonProviders = {}; // seller_id → Set<provider_id>
    for (const [sellerId, pids] of Object.entries(sellerProductMap)) {
      let common = null;
      for (const pid of pids) {
        const providers = productProviderMap[pid] || new Set();
        if (common === null) {
          common = new Set(providers);
        } else {
          for (const p of [...common]) {
            if (!providers.has(p)) common.delete(p);
          }
        }
      }
      sellerCommonProviders[sellerId] = common || new Set();
    }

    // คำนวณราคา + สร้าง result
    const result = {};

    for (const sellerId of sellerIds) {
      const sellerItems = effectiveItems.filter(i => i.seller_id === sellerId);
      const qty         = sellerItems.reduce((s, i) => s + Number(i.quantity), 0);
      const totalWeight = sellerItems.reduce((s, i) => s + (Number(i.weight) || 0) * Number(i.quantity), 0);
      const subtotal    = sellerItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);

      const validProviders = sellerCommonProviders[sellerId] || new Set();
      const providerDetails = providerRows
        .filter(r => r.seller_id === sellerId && validProviders.has(r.provider_id));

      // dedupe providers
      const seen = new Set();
      const uniqueProviders = providerDetails.filter(r => {
        if (seen.has(r.provider_id)) return false;
        seen.add(r.provider_id); return true;
      });

      result[sellerId] = uniqueProviders.map(p => {
        // ─── คำนวณค่าส่งจากค่าจริงใน DB ───────────────────────
        // price = base_price + (price_per_item × qty)
        // ถ้า max_price มีค่า และ price > max_price → ใช้ max_price
        // ถ้า subtotal >= free_threshold → ส่งฟรี (price = 0)
        const basePrice      = Number(p.base_price    || 0);
        const perItem        = Number(p.price_per_item || 0);
        const maxPrice       = p.max_price      ? Number(p.max_price)      : null;
        const freeThreshold  = p.free_threshold ? Number(p.free_threshold) : null;

        let price = basePrice + (perItem * qty);
        if (maxPrice !== null && price > maxPrice) price = maxPrice;
        if (freeThreshold !== null && subtotal >= freeThreshold) price = 0;

        const estMin = p.est_days_min || 2;
        const estMax = p.est_days_max || 5;

        return {
          provider_id:    p.provider_id,
          name:           p.name,
          code:           p.code,
          price:          Math.round(price * 100) / 100,
          est_days:       `${estMin}-${estMax} วัน`,
          free_threshold: freeThreshold,
        };
      });
    }

    return result;
  } catch (err) {
    console.error("[getShippingOptions]", err);
    return {};
  }
};

// ────────────────────────────────────────────────────────
// PLACE ORDER + Omise Charge
//
// flow:
//  1. ตรวจ stock
//  2. INSERT orders (status = pending)
//  3. INSERT order_items, ลด stock
//  4. INSERT order_shipping
//  5. ถ้ามี omise_token → charge card → update payment_status
//  6. ถ้า promptpay → สร้าง source → สร้าง charge → คืน QR
//  7. ถ้า donation → ไม่ต้องชำระทันที
// ────────────────────────────────────────────────────────
const placeOrder = async ({
  userId,
  cartItemIds,
  productIds,
  addressId,
  orderType,
  requestId,
  donationAddress,
  shippingSelections,
  omiseToken,      // card token จาก OmiseJS
  paymentMethod,   // "card" | "promptpay" | null
}) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── ดึงรายการสินค้า ──────────────────────────────────
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
    for (const item of items) {
      if (item.stock < item.quantity)
        throw { status: 400, message: "สินค้าบางรายการมีไม่เพียงพอ" };
    }

    // ── คำนวณยอด ──────────────────────────────────────────
    const itemsTotal    = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const shippingTotal = (shippingSelections || []).reduce((s, v) => s + Number(v.price || 0), 0);
    const totalPrice    = itemsTotal + shippingTotal;

    // ── ดึงที่อยู่จัดส่ง ──────────────────────────────────
    let recipientName, shippingAddress, shippingProvince, shippingPostcode, shippingPhone;
    if (orderType === "donation" && donationAddress) {
      recipientName    = donationAddress.name;
      shippingAddress  = [donationAddress.address, donationAddress.district].filter(Boolean).join(" ");
      shippingProvince = donationAddress.province;
      shippingPostcode = donationAddress.postal_code;
      shippingPhone    = donationAddress.phone;
    } else {
      const [[addr]] = await conn.execute(
        "SELECT * FROM address WHERE address_id = ? AND user_id = ?", [addressId, userId]
      );
      if (!addr) throw { status: 400, message: "ไม่พบที่อยู่จัดส่ง" };
      recipientName    = addr.recipient_name;
      shippingAddress  = addr.address_line;
      shippingProvince = addr.province;
      shippingPostcode = addr.postcode;
      shippingPhone    = addr.phone;
    }

    // ── INSERT orders ─────────────────────────────────────
    const [orderResult] = await conn.execute(
      `INSERT INTO orders
        (buyer_id, total_price, order_status, payment_status, payment_method,
         shipping_address, shipping_province, shipping_postcode,
         recipient_name, shipping_phone, order_type, request_id)
       VALUES (?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, totalPrice,
        paymentMethod || null,          // payment_method: "card" | "promptpay" | null
        shippingAddress, shippingProvince, shippingPostcode,
        recipientName, shippingPhone,
        orderType || "purchase",
        requestId || null,
      ]
    );
    const orderId = orderResult.insertId;

    // ── INSERT order_items + ลด stock ────────────────────
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
      await conn.execute(
        `UPDATE products SET status = 'sold' WHERE product_id = ? AND quantity <= 0`,
        [item.product_id]
      );
    }

    // ── INSERT order_shipping ─────────────────────────────
    if (shippingSelections?.length) {
      try {
        for (const s of shippingSelections) {
          await conn.execute(
            `INSERT INTO order_shipping (order_id, seller_id, provider_id, shipping_price)
             VALUES (?, ?, ?, ?)`,
            [orderId, s.seller_id, s.provider_id, s.price || 0]
          );
        }
      } catch (e) {
        if (e.code !== "ER_NO_SUCH_TABLE") throw e;
        console.warn("[placeOrder] order_shipping table not found — skipping");
      }
    }

    // ── ลบออกจาก cart ─────────────────────────────────────
    if (cartItemIds?.length) {
      const ph = cartItemIds.map(() => "?").join(",");
      await conn.execute(`DELETE FROM cart_item WHERE cart_item_id IN (${ph})`, cartItemIds);
    }

    // ── Omise: Card Payment ───────────────────────────────
    let chargeId = null;
    let qrBase64 = null;
    let authorizeUri = null; 

    if (omiseToken && paymentMethod === "card") {
      // สร้าง charge ด้วย token (บาท → สตางค์ × 100)
      const charge = await omise.charges.create({
        amount:      Math.round(totalPrice * 100),
        currency:    "thb",
        card:        omiseToken,
        description: `Order #${orderId}`,
        metadata:    { order_id: orderId, user_id: userId },
      });

      chargeId = charge.id;

      if (charge.status === "successful") {
        await conn.execute(
          `UPDATE orders SET payment_status = 'paid', omise_charge_id = ?, order_status = 'confirmed'
           WHERE order_id = ?`,
          [chargeId, orderId]
        );
      } else {
        // charge failed → rollback
        await conn.rollback();
        conn.release();
        throw { status: 402, message: `ชำระเงินไม่สำเร็จ: ${charge.failure_message || charge.status}` };
      }
    }

    // ── Omise: PromptPay ──────────────────────────────────
    // Omise PromptPay flow:
    // 1. สร้าง charge พร้อม source.type = "promptpay" ในครั้งเดียว
    // 2. QR image อยู่ที่ charge.source.scannable_code.image.download_uri
    //    หรือ references.reference_1 (PromptPay ID), references.reference_2 (amount)
    // 3. frontend poll /orders/:id/payment-status จนกว่า charge.status = "successful"
    if (paymentMethod === "promptpay") {
      const amountSatang = Math.round(totalPrice * 100); // บาท → สตางค์

      // สร้าง charge พร้อม source PromptPay ในครั้งเดียว
      const charge = await omise.charges.create({
        amount:     amountSatang,
        currency:   "thb",
        source:     { type: "promptpay" },
        description: `Order #${orderId} — Unieed`,
        metadata:   { order_id: String(orderId), user_id: String(userId) },
        return_uri: `${process.env.FRONTEND_URL || "http://localhost:5173"}/orders/${orderId}?payment=success`,
      });

      chargeId = charge.id;

      // บันทึก charge_id ไว้ poll สถานะ
      await conn.execute(
        `UPDATE orders SET omise_charge_id = ? WHERE order_id = ?`,
        [chargeId, orderId]
      );

      // ── ดึง QR image ──
      // Omise ส่ง download_uri ของ QR PNG มาใน charge.source.scannable_code.image
      const dlUri = charge.source?.scannable_code?.image?.download_uri;
      if (dlUri) {
        try {
          // fetch QR PNG แล้วแปลงเป็น base64 ส่งกลับ frontend
          const imgRes = await fetch(dlUri, {
            headers: {
              // Basic auth ด้วย secret key (Omise ต้องการ auth สำหรับ download)
              Authorization: "Basic " + Buffer.from(process.env.OMISE_SECRET_KEY + ":").toString("base64"),
            },
          });
          if (imgRes.ok) {
            const imgBuf = await imgRes.arrayBuffer();
            qrBase64 = Buffer.from(imgBuf).toString("base64");
          }
        } catch (qrErr) {
          console.warn("[PromptPay] QR fetch failed:", qrErr.message);
        }
      }

      // fallback: ถ้าไม่ได้ QR base64 → บันทึก authorize_uri ไว้ให้ frontend ใช้
      if (!qrBase64 && charge.authorize_uri) {
  authorizeUri = charge.authorize_uri;   // ← เก็บไว้ใช้ที่ return
  await conn.execute(
    `UPDATE orders SET authorize_uri = ? WHERE order_id = ?`,
    [charge.authorize_uri, orderId]
  );
        console.warn("[PromptPay] QR not available — using authorize_uri:", charge.authorize_uri);
      }
    }

    // ── Donation record ───────────────────────────────────
    if (orderType === "donation" && requestId) {
      const [[buyer]] = await conn.execute(
        "SELECT user_name, user_phone FROM users WHERE user_id = ?", [userId]
      );

      // ✅ ดึงชื่อสินค้า + uniform_type_id + education_level จาก products
      const productIdList = items.map(i => i.product_id);
      const ph2 = productIdList.map(() => "?").join(",");
      const [productDetails] = await conn.execute(
        `SELECT p.product_id,
                COALESCE(ut.type_name, p.custom_type_name, p.product_title) AS name,
                p.uniform_type_id,
                p.education_level
         FROM products p
         LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
         WHERE p.product_id IN (${ph2})`,
        productIdList
      );
      const productMap = Object.fromEntries(
        productDetails.map(p => [p.product_id, p])
      );

      // ✅ สร้าง items_snapshot ในรูปแบบเดียวกับ donation ปกติ
      const donationItems = items.map(i => {
        const d = productMap[i.product_id] || {};
        return {
          product_id:      i.product_id,
          name:            d.name || `สินค้า #${i.product_id}`,
          uniform_type_id: d.uniform_type_id || null,
          education_level: d.education_level || null,
          quantity:        i.quantity,
          price:           i.price,
        };
      });

      const totalQty = items.reduce((s, i) => s + i.quantity, 0);

      // ✅ แก้ delivery_method → 'market_purchase', เพิ่ม market_order_id + donation_time
      const [donResult] = await conn.execute(
        `INSERT INTO donation_record
           (request_id, donor_id, donor_name, donor_phone,
            delivery_method, donation_date, donation_time,
            quantity, status,
            market_order_id, items_snapshot)
         VALUES (?, ?, ?, ?, 'market_purchase', CURDATE(), NOW(), ?, 'pending', ?, ?)`,
        [
          requestId,
          userId,
          buyer.user_name,
          buyer.user_phone || shippingPhone,
          totalQty,
          String(orderId),
          JSON.stringify(donationItems),
        ]
      );

      // ✅ Notification โรงเรียน — ใช้ column 'message' (ไม่ใช่ 'body')
      try {
        const [projInfo] = await conn.execute(
          `SELECT school_id FROM donation_request WHERE request_id = ? LIMIT 1`,
          [requestId]
        );
        if (projInfo[0]) {
          const [admins] = await conn.execute(
            `SELECT user_id FROM users WHERE school_id = ? AND role = 'school_admin'`,
            [projInfo[0].school_id]
          );
          for (const admin of admins) {
            await conn.execute(
              `INSERT INTO notifications
                 (user_id, type, title, message, ref_id, ref_type, created_at)
               VALUES (?, 'donation_received', 'มีการบริจาคผ่านการซื้อสินค้า', ?, ?, 'donation', NOW())`,
              [
                admin.user_id,
                `${buyer.user_name} ซื้อสินค้าเพื่อบริจาคให้โรงเรียน (คำสั่งซื้อ #${orderId})`,
                donResult.insertId,
              ]
            );
          }
        }
      } catch (notifErr) {
        console.error("[placeOrder] notification error:", notifErr.message);
      }
    }

    await conn.commit();
    return {
  order_id:      orderId,
  charge_id:     chargeId,
  qr_base64:     qrBase64,
  authorize_uri: authorizeUri || null,
};

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ────────────────────────────────────────────────────────
// CHECK PAYMENT STATUS (PromptPay polling)
// ────────────────────────────────────────────────────────
const checkPaymentStatus = async (orderId, userId) => {
  const [[order]] = await db.execute(
    "SELECT order_id, omise_charge_id, payment_status FROM orders WHERE order_id = ? AND buyer_id = ?",
    [orderId, userId]
  );
  if (!order) throw { status: 404, message: "ไม่พบ order" };
  if (order.payment_status === "paid") return { paid: true };
  if (!order.omise_charge_id) return { paid: false };

  // ดึงสถานะจาก Omise
  const charge = await omise.charges.retrieve(order.omise_charge_id);
  if (charge.status === "successful") {
    await db.execute(
      "UPDATE orders SET payment_status = 'paid', order_status = 'confirmed' WHERE order_id = ?",
      [orderId]
    );
    return { paid: true };
  }
  return { paid: false, omise_status: charge.status };
};

export {
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getShippingProviders,
  getCheckoutItems, getCheckoutItemsByProduct,
  getShippingOptions,
  placeOrder,
  checkPaymentStatus,
};