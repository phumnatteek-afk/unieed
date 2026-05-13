// backend/server/src/modules/seller/seller.service.js
//
// Service สำหรับหน้า "ผู้ขาย" (Seller dashboard / orders / payouts / products / bank)
// ใช้คอลัมน์ที่ migration เพิ่มไว้:
//   - orders.platform_fee, orders.seller_payout_amount, orders.payout_status, orders.payout_id
//   - users.bank_account_number, users.bank_account_name, users.bank_code
//   - payouts (net_amount, fee_amount, order_count, status, completed_at)
import { sendNotification } from "../../lib/notify.js";

import { db } from "../../config/db.js";
import {
  decryptBankAccountNumber,
  encryptBankAccountNumber,
  formatBankAccountNumber,
  isValidBankName,
  isValidBankNumber,
  maskBankAccountNumber,
  sanitizeBankName,
  sanitizeBankNumber,
} from "../../utils/bankAccountSecurity.js";

/* ────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────── */

/**
 * เช็คว่า user เป็น "ผู้ขาย" หรือยัง — นิยาม: เคยมีสินค้าใน products หรือเคยมี order อย่างน้อย 1 ใบ
 * คืน true ถ้าเป็นผู้ขาย, false ถ้ายังไม่ใช่
 */
export async function isSeller(userId) {
  const [[r1]] = await db.query(
    `SELECT COUNT(*) AS c FROM products WHERE seller_id = ?`, [userId]
  );
  if (Number(r1.c) > 0) return true;
  const [[r2]] = await db.query(
    `SELECT COUNT(*) AS c FROM orders WHERE seller_id = ?`, [userId]
  );
  return Number(r2.c) > 0;
}

/** กันค่าจาก query ให้ปลอดภัย */
function safeLimit(limit, def = 10, max = 100) {
  return Math.min(max, Math.max(1, Number(limit) || def));
}
function safePage(page) {
  return Math.max(1, Number(page) || 1);
}

const BANK_UPDATE_COOLDOWN_MS = 2000;
const bankUpdateLastAt = new Map();
let usersHasBankVerifiedColumn = null;

async function hasUsersColumn(columnName) {
  if (columnName === "bank_account_verified" && usersHasBankVerifiedColumn !== null) {
    return usersHasBankVerifiedColumn;
  }
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );
  const exists = rows.length > 0;
  if (columnName === "bank_account_verified") usersHasBankVerifiedColumn = exists;
  return exists;
}

/* ────────────────────────────────────────────────────────
 * Dashboard ร้านค้า
 * ──────────────────────────────────────────────────────── */

/**
 * Stats 4 การ์ดด้านบนของ Dashboard ร้านค้า
 *  - orders_today        : ออเดอร์ที่สร้างวันนี้
 *  - orders_pending      : รอยืนยัน/รอจัดส่ง
 *  - revenue_this_month  : รายได้ (paid orders) เดือนนี้
 *  - payout_pending_total: ยอดที่รอระบบโอน
 *  - products_total      : สินค้าทั้งหมด
 *  - products_sold       : สินค้าที่ขายไปแล้ว
 */
export async function getDashboardStats(sellerId) {
  // 1) ออเดอร์วันนี้ + ที่รอยืนยัน
  const [[ordersToday]] = await db.query(`
    SELECT COUNT(*) AS c
    FROM orders
    WHERE seller_id = ? AND DATE(created_at) = CURDATE()
  `, [sellerId]);

  const [[ordersPending]] = await db.query(`
    SELECT COUNT(*) AS c
    FROM orders
    WHERE seller_id = ?
      AND payment_status = 'paid'
      AND order_status IN ('pending','confirmed')
  `, [sellerId]);

  // 2) รายได้สุทธิเดือนนี้
  const [[revenue]] = await db.query(`
    SELECT
      COALESCE(SUM(seller_payout_amount), 0) AS this_month_net,
      COALESCE(SUM(total_price), 0)          AS this_month_gross,
      COUNT(*)                               AS count_paid
    FROM orders
    WHERE seller_id = ?
      AND payment_status = 'paid'
      AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `, [sellerId]);

  // 3) ยอดรอระบบโอน
  const [[payoutPending]] = await db.query(`
    SELECT
      COALESCE(SUM(seller_payout_amount), 0) AS amount,
      COUNT(*)                               AS count
    FROM orders
    WHERE seller_id = ?
      AND order_status = 'delivered'
      AND payout_status = 'pending'
  `, [sellerId]);

  // 4) สินค้า
  const [[products]] = await db.query(`
    SELECT
      COUNT(*)                            AS total,
      SUM(status = 'sold')                AS sold,
      SUM(status = 'available')           AS available
    FROM products
    WHERE seller_id = ?
  `, [sellerId]);

  return {
    orders_today:         Number(ordersToday.c),
    orders_pending:       Number(ordersPending.c),
    revenue_this_month:   Math.round(Number(revenue.this_month_net)),
    revenue_this_gross:   Math.round(Number(revenue.this_month_gross)),
    payout_pending_total: Math.round(Number(payoutPending.amount)),
    payout_pending_count: Number(payoutPending.count),
    products_total:       Number(products.total),
    products_sold:        Number(products.sold || 0),
    products_available:   Number(products.available || 0),
  };
}

/**
 * Chart ยอดขายรายเดือน 12 เดือนย้อนหลัง
 */
export async function getDashboardChart(sellerId) {
  const [rows] = await db.query(`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m') AS ym,
      COALESCE(SUM(seller_payout_amount), 0) AS net,
      COALESCE(SUM(total_price), 0)          AS gross
    FROM orders
    WHERE seller_id = ?
      AND payment_status = 'paid'
      AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')
    GROUP BY ym
  `, [sellerId]);
  const byYm = Object.fromEntries(rows.map(r => [r.ym, r]));

  const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const months = [];
  const net    = [];
  const gross  = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const r  = byYm[ym] || { net: 0, gross: 0 };
    months.push(MONTHS[d.getMonth()]);
    net.push(Math.round(Number(r.net   || 0)));
    gross.push(Math.round(Number(r.gross || 0)));
  }
  return { months, net, gross };
}

/**
 * รายการรอดำเนินงาน — ส่งคืนเฉพาะที่มี > 0
 */
export async function getDashboardPendingTasks(sellerId) {
  const [[need]] = await db.query(`
    SELECT COUNT(*) AS c FROM orders
    WHERE seller_id = ?
      AND payment_status = 'paid'
      AND order_status IN ('pending','confirmed')
  `, [sellerId]);

  const tasks = [];
  if (Number(need.c) > 0) {
    tasks.push({
      key: "to_ship",
      label: `มี ${need.c} รายการรอยืนยันการจัดส่ง`,
      url: "/seller/orders?tab=to_ship",
    });
  }
  return tasks;
}

/**
 * สรุปค่าธรรมเนียมเดือนนี้ — ใช้ทั้งหน้า Dashboard และหน้า "รายได้และการโอนเงิน"
 */
export async function getMonthFeeSummary(sellerId) {
  const [[r]] = await db.query(`
    SELECT
      COALESCE(SUM(o.total_price), 0)                                 AS gross,
      COALESCE(SUM(o.platform_fee), 0)                                AS fee_total,
      -- แยกเฉพาะค่าธรรมเนียม "ขั้นต่ำ 20 บาท" (เกิดเมื่อ items_subtotal <= 100)
      COALESCE(SUM(CASE WHEN items_sub.items_subtotal <= 100 THEN o.platform_fee ELSE 0 END), 0)  AS fee_min,
      -- ค่าธรรมเนียม 15% (เกิดเมื่อ items_subtotal > 100)
      COALESCE(SUM(CASE WHEN items_sub.items_subtotal >  100 THEN o.platform_fee ELSE 0 END), 0)  AS fee_pct,
      COALESCE(SUM(items_sub.shipping_total), 0)                      AS shipping_total,
      COALESCE(SUM(o.seller_payout_amount), 0)                        AS net
    FROM orders o
    LEFT JOIN (
      SELECT
        oi.order_id,
        SUM(oi.price_at_purchase * oi.quantity) AS items_subtotal,
        0 AS shipping_total
      FROM order_items oi
      GROUP BY oi.order_id
    ) items_sub ON items_sub.order_id = o.order_id
    WHERE o.seller_id = ?
      AND o.payment_status = 'paid'
      AND o.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `, [sellerId]);

  // shipping_total: รวมจาก order_shipping (ค่าส่งคืนผู้ขายเต็มจำนวน)
  const [[shipRow]] = await db.query(`
    SELECT COALESCE(SUM(os.shipping_price), 0) AS shipping_total
    FROM order_shipping os
    JOIN orders o ON o.order_id = os.order_id
    WHERE os.seller_id = ?
      AND o.payment_status = 'paid'
      AND o.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `, [sellerId]).catch(() => [[{ shipping_total: 0 }]]);

  return {
    gross:           Math.round(Number(r.gross || 0)),
    fee_min:         Math.round(Number(r.fee_min || 0)),
    fee_pct:         Math.round(Number(r.fee_pct || 0)),
    fee_total:       Math.round(Number(r.fee_total || 0)),
    shipping_total:  Math.round(Number(shipRow?.shipping_total || 0)),
    net:             Math.round(Number(r.net || 0)),
  };
}

/* ────────────────────────────────────────────────────────
 * Orders (รอจัดส่ง / จัดส่งแล้ว / สำเร็จ / ยกเลิก)
 * ──────────────────────────────────────────────────────── */

/**
 * GET /seller/orders?tab=to_ship|shipped|delivered|cancelled&q=&page=&limit=
 *  - to_ship   : payment_status=paid & order_status IN (pending, confirmed)
 *  - shipped   : order_status = shipping
 *  - delivered : order_status = delivered
 *  - cancelled : order_status = cancelled
 */
export async function listSellerOrders(sellerId, { tab = "to_ship", q = "", page = 1, limit = 10, sort = "latest" } = {}) {
  const limitN = safeLimit(limit);
  const offset = (safePage(page) - 1) * limitN;

  const filterMap = {
    to_ship:   `o.payment_status = 'paid' AND o.order_status IN ('pending','confirmed')`,
    shipped:   `o.order_status = 'shipping'`,
    delivered: `o.order_status = 'delivered'`,
    cancelled: `o.order_status = 'cancelled'`,
  };
  const where = filterMap[tab] || filterMap.to_ship;
  const params = [sellerId];

  let qSql = "";
  if (q) {
    qSql = ` AND (o.order_id LIKE ? OR p.product_title LIKE ? OR buyer.user_name LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  // counters ของแต่ละ tab
  const [[counts]] = await db.query(`
    SELECT
      SUM(payment_status='paid' AND order_status IN ('pending','confirmed')) AS to_ship,
      SUM(order_status='shipping')                                           AS shipped,
      SUM(order_status='delivered')                                          AS delivered,
      SUM(order_status='cancelled')                                          AS cancelled
    FROM orders WHERE seller_id = ?
  `, [sellerId]);

  // รายการ
  const [rows] = await db.query(`
    SELECT
      o.order_id,
      o.created_at,
      o.order_status,
      o.payment_status,
      o.payout_status,
      o.total_price,
      o.platform_fee,
      o.seller_payout_amount,
      o.tracking_number,
      o.shipping_address,
      o.shipping_province,
      o.shipping_postcode,
      o.recipient_name,
      o.shipping_phone,
      buyer.user_name  AS buyer_name,
      COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'product_id',  oi2.product_id,
          'title',       p2.product_title,
          'qty',         oi2.quantity,
          'price',       oi2.price_at_purchase,
          'size',        p2.size,
          'category_id', p2.category_id,
          'cover_image', (
            SELECT pi2.image_url FROM product_images pi2
            WHERE pi2.product_id = oi2.product_id
            ORDER BY pi2.is_cover DESC, pi2.sort_order ASC
            LIMIT 1
          )
        ))
        FROM order_items oi2
        LEFT JOIN products p2 ON p2.product_id = oi2.product_id
        WHERE oi2.order_id = o.order_id
      ), JSON_ARRAY()) AS items,
      COALESCE((
        SELECT SUM(os.shipping_price)
        FROM order_shipping os
        WHERE os.order_id = o.order_id AND os.seller_id = o.seller_id
      ), 0) AS shipping_price,
      (
        SELECT sp.name FROM order_shipping os
        LEFT JOIN shipping_provider sp ON sp.provider_id = os.provider_id
        WHERE os.order_id = o.order_id AND os.seller_id = o.seller_id
        LIMIT 1
      ) AS shipping_provider_name,
      (
        SELECT os.provider_id FROM order_shipping os
        WHERE os.order_id = o.order_id AND os.seller_id = o.seller_id
        LIMIT 1
      ) AS shipping_provider_id
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id  = o.order_id
    LEFT JOIN products    p  ON p.product_id = oi.product_id
    LEFT JOIN users   buyer  ON buyer.user_id = o.buyer_id
    WHERE o.seller_id = ? AND ${where} ${qSql}
    GROUP BY o.order_id
    ORDER BY o.created_at ${sort === "oldest" ? "ASC" : "DESC"}
    LIMIT ? OFFSET ?
  `, [...params, limitN, offset]);

  // total
  const [[totalRow]] = await db.query(`
    SELECT COUNT(DISTINCT o.order_id) AS c
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id  = o.order_id
    LEFT JOIN products    p  ON p.product_id = oi.product_id
    LEFT JOIN users   buyer  ON buyer.user_id = o.buyer_id
    WHERE o.seller_id = ? AND ${where} ${qSql}
  `, params);

  return {
    counts: {
      to_ship:   Number(counts.to_ship   || 0),
      shipped:   Number(counts.shipped   || 0),
      delivered: Number(counts.delivered || 0),
      cancelled: Number(counts.cancelled || 0),
    },
    rows,
    total_pages: Math.max(1, Math.ceil(Number(totalRow.c) / limitN)),
  };
}

/**
 * ผู้ขายยืนยันการจัดส่ง (กรอก tracking + provider แล้วเปลี่ยนเป็น shipping)
 */
export async function confirmShipOrder(sellerId, orderId, { tracking_number, provider_id } = {}) {
  if (!tracking_number || !String(tracking_number).trim()) {
    throw Object.assign(new Error("กรุณากรอก tracking number"), { status: 400 });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(
      `SELECT order_id, order_status, payment_status FROM orders
        WHERE order_id = ? AND seller_id = ? FOR UPDATE`,
      [orderId, sellerId]
    );
    if (!order) throw Object.assign(new Error("ไม่พบออเดอร์"), { status: 404 });
    if (order.payment_status !== "paid")
      throw Object.assign(new Error("ออเดอร์ยังไม่ชำระเงิน"), { status: 400 });
    if (!["pending","confirmed"].includes(order.order_status))
      throw Object.assign(new Error("ออเดอร์อยู่ในสถานะที่จัดส่งไม่ได้"), { status: 400 });

    const [[shipOpt]] = await conn.query(
      `SELECT provider_id FROM order_shipping WHERE order_id = ? AND seller_id = ? LIMIT 1`,
      [orderId, sellerId]
    ).catch(() => [[null]]);
    if (shipOpt?.provider_id && provider_id && Number(provider_id) !== Number(shipOpt.provider_id)) {
      throw Object.assign(new Error("กรุณาเลือกขนส่งตามที่ผู้ซื้อเลือกไว้"), { status: 400 });
    }

    await conn.query(
      `UPDATE orders SET order_status='shipping', tracking_number=?, shipping_date=NOW() WHERE order_id=?`,
      [String(tracking_number).trim(), orderId]
    );

    if (provider_id) {
      await conn.query(
        `UPDATE order_shipping SET provider_id=? WHERE order_id=? AND seller_id=?`,
        [provider_id, orderId, sellerId]
      ).catch(() => {});
    }
    await conn.commit();

    // Notify buyer that their order has shipped
    try {
      const [[ord]] = await db.query(
        `SELECT buyer_id, tracking_number FROM orders WHERE order_id = ?`, [orderId]
      );
      if (ord?.buyer_id) {
        await sendNotification(ord.buyer_id, {
          type:   "order_shipped",
          title:  "สินค้าของคุณถูกจัดส่งแล้ว",
          body:   `เลขพัสดุ: ${String(tracking_number).trim()}`,
          ref_id: orderId,
        });
      }
    } catch (e) { console.warn("[notify] order_shipped:", e.message); }

    return { message: "Shipped", order_id: orderId };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

/* ────────────────────────────────────────────────────────
 * Payouts: รายได้และการโอนเงิน
 * ──────────────────────────────────────────────────────── */

export async function getSellerPayouts(sellerId, { page = 1, limit = 10 } = {}) {
  const limitN = safeLimit(limit);
  const offset = (safePage(page) - 1) * limitN;

  // รวมยอดจาก orders + payouts
  const [[summary]] = await db.query(`
    SELECT
      -- รายได้สุทธิเดือนนี้ (orders ที่ paid + เดือนนี้)
      COALESCE((SELECT SUM(seller_payout_amount) FROM orders
                WHERE seller_id=? AND payment_status='paid'
                  AND created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')), 0) AS this_month_net,
      -- รอระบบโอน
      COALESCE((SELECT SUM(seller_payout_amount) FROM orders
                WHERE seller_id=? AND order_status='delivered' AND payout_status='pending'), 0) AS pending_total,
      (SELECT COUNT(*) FROM orders
        WHERE seller_id=? AND order_status='delivered' AND payout_status='pending')             AS pending_count,
      -- ที่โอนเข้าบัญชีแล้ว
      COALESCE((SELECT SUM(net_amount) FROM payouts WHERE seller_id=? AND status='completed'), 0) AS paid_total,
      (SELECT COUNT(*) FROM payouts WHERE seller_id=? AND status='completed')                     AS paid_count
  `, [sellerId, sellerId, sellerId, sellerId, sellerId]).catch(() => [[{}]]);

  // ประวัติการโอน (จาก payouts)
  const [history] = await db.query(`
    SELECT payout_id, net_amount, fee_amount, order_count,
           status, omise_transfer_id, slip_url, created_at, completed_at
    FROM payouts
    WHERE seller_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [sellerId, limitN, offset]).catch(() => [[]]);

  // info บัญชีธนาคารผู้ขาย
  const [[bank]] = await db.query(`
    SELECT bank_code, bank_account_number, bank_account_name
    FROM users WHERE user_id = ?
  `, [sellerId]);

  const decryptedNumber = decryptBankAccountNumber(bank?.bank_account_number);
  const verifiedColExists = await hasUsersColumn("bank_account_verified");
  let verified = false;
  if (verifiedColExists) {
    const [[v]] = await db.query(`SELECT bank_account_verified FROM users WHERE user_id = ?`, [sellerId]);
    verified = !!v?.bank_account_verified;
  }

  return {
    stats: {
      this_month_net: Math.round(Number(summary?.this_month_net || 0)),
      pending_total:  Math.round(Number(summary?.pending_total  || 0)),
      pending_count:  Number(summary?.pending_count  || 0),
      paid_total:     Math.round(Number(summary?.paid_total     || 0)),
      paid_count:     Number(summary?.paid_count     || 0),
    },
    history: history || [],
    bank: bank
      ? {
          bank_code: bank.bank_code,
          bank_account_number: decryptedNumber,
          bank_account_number_masked: maskBankAccountNumber(decryptedNumber),
          bank_account_number_formatted: formatBankAccountNumber(decryptedNumber),
          bank_account_name: bank.bank_account_name,
          is_verified: verified,
        }
      : {
          bank_code: null,
          bank_account_number: null,
          bank_account_number_masked: null,
          bank_account_number_formatted: null,
          bank_account_name: null,
          is_verified: false,
        },
  };
}

/**
 * อัปเดตบัญชีธนาคารผู้ขาย (ฟอร์ม "บัญชีรับเงิน → แก้ไข")
 */
export async function updateSellerBank(sellerId, { bank_code, bank_account_number, bank_account_name }) {
  const now = Date.now();
  const last = bankUpdateLastAt.get(sellerId) || 0;
  if (now - last < BANK_UPDATE_COOLDOWN_MS) {
    throw Object.assign(new Error("กรุณารอสักครู่ก่อนส่งข้อมูลอีกครั้ง"), { status: 429 });
  }
  bankUpdateLastAt.set(sellerId, now);

  const code = String(bank_code || "").trim();
  const num = sanitizeBankNumber(bank_account_number);
  const name = sanitizeBankName(bank_account_name);

  if (!code) throw Object.assign(new Error("กรุณาเลือกธนาคาร"), { status: 400 });
  if (!isValidBankNumber(num)) throw Object.assign(new Error("เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก"), { status: 400 });
  if (!isValidBankName(name)) throw Object.assign(new Error("ชื่อบัญชีรับเฉพาะภาษาไทย/อังกฤษ และเว้นวรรคเท่านั้น"), { status: 400 });
  if (!name) throw Object.assign(new Error("กรุณากรอกชื่อบัญชี"), { status: 400 });

  const [users] = await db.query(
    `SELECT user_id, bank_account_number FROM users
     WHERE user_id <> ? AND bank_account_number IS NOT NULL AND bank_account_number <> ''`,
    [sellerId]
  );
  const dup = (users || []).some((u) => sanitizeBankNumber(decryptBankAccountNumber(u.bank_account_number)) === num);
  if (dup) throw Object.assign(new Error("เลขบัญชีนี้ถูกใช้งานแล้วในระบบ"), { status: 409 });

  const encrypted = encryptBankAccountNumber(num);
  const verifiedColExists = await hasUsersColumn("bank_account_verified");

  if (verifiedColExists) {
    await db.query(
      `UPDATE users
          SET bank_code=?, bank_account_number=?, bank_account_name=?, bank_account_verified=0
        WHERE user_id=?`,
      [code, encrypted, name, sellerId]
    );
  } else {
    await db.query(
      `UPDATE users SET bank_code=?, bank_account_number=?, bank_account_name=? WHERE user_id=?`,
      [code, encrypted, name, sellerId]
    );
  }
  return { message: "Updated" };
}

/* ────────────────────────────────────────────────────────
 * Notifications: badge counts สำหรับ Sidebar
 * ──────────────────────────────────────────────────────── */

/**
 * คืนจำนวน pending orders สำหรับแสดง badge ใน sidebar
 * - orders_to_ship: ออเดอร์ที่ payment_status=paid & order_status IN (pending,confirmed)
 */
export async function getSellerNotifications(sellerId) {
  const [[r]] = await db.query(`
    SELECT
      SUM(payment_status='paid' AND order_status IN ('pending','confirmed')) AS orders_to_ship
    FROM orders
    WHERE seller_id = ?
  `, [sellerId]);
  return {
    orders_to_ship: Number(r.orders_to_ship || 0),
  };
}

/* ────────────────────────────────────────────────────────
 * Products: รายการสินค้า
 * ──────────────────────────────────────────────────────── */

export async function listSellerProducts(
  sellerId,
  { status = "", category = "", gender = "", q = "", page = 1, limit = 10, sort = "latest" } = {}
) {
  const limitN = safeLimit(limit);
  const offset = (safePage(page) - 1) * limitN;

  const where  = ["p.seller_id = ?"];
  const params = [sellerId];

  if (status && ["available","sold","hidden"].includes(status)) {
    where.push("p.status = ?"); params.push(status);
  }
  if (category) {
    where.push("p.category_id = ?"); params.push(Number(category));
  }
  if (gender && ["male", "female"].includes(gender)) {
    where.push("p.gender = ?"); params.push(gender);
  }
  if (q) {
    where.push("(p.product_title LIKE ? OR p.product_description LIKE ?)");
    const like = `%${q}%`; params.push(like, like);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const orderSql = sort === "oldest" ? "ORDER BY p.created_at ASC" : "ORDER BY p.created_at DESC";

  // Counters
  const [[counts]] = await db.query(`
    SELECT
      COUNT(*)                       AS total,
      SUM(status='available')        AS available,
      SUM(status='sold')             AS sold
    FROM products WHERE seller_id = ?
  `, [sellerId]);

  // รายการ + cover image
  const [rows] = await db.query(`
    SELECT
      p.product_id, p.product_title, p.size, p.level, p.price, p.quantity, p.status,
      p.created_at, p.category_id, p.gender,
      (SELECT pi.image_url FROM product_images pi
        WHERE pi.product_id = p.product_id ORDER BY pi.is_cover DESC, pi.sort_order ASC LIMIT 1)
        AS cover_image
    FROM products p
    ${whereSql}
    ${orderSql}
    LIMIT ? OFFSET ?
  `, [...params, limitN, offset]);

  const [[totalRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM products p ${whereSql}`, params
  );

  return {
    counts: {
      total:     Number(counts?.total     || 0),
      available: Number(counts?.available || 0),
      sold:      Number(counts?.sold      || 0),
    },
    rows,
    total_pages: Math.max(1, Math.ceil(Number(totalRow.c) / limitN)),
  };
}
