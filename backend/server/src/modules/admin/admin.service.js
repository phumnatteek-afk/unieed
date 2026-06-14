import { db } from "../../config/db.js";
import { sendNotification } from "../../lib/notify.js";
import {
  decryptBankAccountNumber,
  formatBankAccountNumber,
  isValidBankNumber,
  maskBankAccountNumber,
  sanitizeBankNumber,
} from "../../utils/bankAccountSecurity.js";

/** คืนเวลาไทย (UTC+7) ในรูปแบบ YYYY-MM-DD HH:MM:SS สำหรับส่งเข้า DB */
function thaiNow() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function toSqlLocalDateTime(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-") + " " + [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join(":");
}

/* ────── helpers ────── */

function normalizeThaiPhone(input) {
  if (!input) return null;
  let raw = String(input).replace(/\D/g, "");
  if (!raw) return null;
  if (raw.startsWith("66") && raw.length === 11) raw = "0" + raw.slice(2);
  if (raw.length === 9) raw = "0" + raw;
  return raw;
}

function periodToDateRange(period, startDate = null, endDate = null) {
  const now = new Date();
  if (period === "custom" && startDate && endDate) {
    const f = new Date(startDate); f.setHours(0, 0, 0, 0);
    const t = new Date(endDate);   t.setHours(23, 59, 59, 999);
    return { from: toSqlLocalDateTime(f), to: toSqlLocalDateTime(t) };
  }
  let from;
  switch (period) {
    case "today":   from = new Date(now); from.setHours(0, 0, 0, 0); break;
    case "month":   from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "3months": from = new Date(now); from.setMonth(now.getMonth() - 3); break;
    case "6months": from = new Date(now); from.setMonth(now.getMonth() - 6); break;
    case "year":    from = new Date(now); from.setFullYear(now.getFullYear() - 1); break;
    default:        from = new Date(now); from.setDate(now.getDate() - 7);
  }
  return { from: toSqlLocalDateTime(from), to: toSqlLocalDateTime(now) };
}

const orderFinancialSql = {
  itemSubtotal: "COALESCE(items_sub.subtotal, GREATEST(COALESCE(o.total_price, 0) - COALESCE(ship_agg.ship_sum, 0), 0), 0)",
  shipping: "COALESCE(ship_agg.ship_sum, 0)",
};
orderFinancialSql.fee = `
  CASE
    WHEN COALESCE(o.platform_fee, 0) > 0 THEN COALESCE(o.platform_fee, 0)
    WHEN ${orderFinancialSql.itemSubtotal} > 0 THEN GREATEST(ROUND(${orderFinancialSql.itemSubtotal} * 0.15, 2), 20)
    ELSE 0
  END
`;
orderFinancialSql.total = `
  CASE
    WHEN COALESCE(o.total_price, 0) > 0 THEN COALESCE(o.total_price, 0)
    ELSE ${orderFinancialSql.itemSubtotal} + ${orderFinancialSql.shipping}
  END
`;
orderFinancialSql.net = `
  CASE
    WHEN COALESCE(o.seller_payout_amount, 0) > 0 THEN COALESCE(o.seller_payout_amount, 0)
    ELSE GREATEST((${orderFinancialSql.itemSubtotal} + ${orderFinancialSql.shipping}) - (${orderFinancialSql.fee}), 0)
  END
`;

function pendingPayoutOrderSelect(extraWhere = "") {
  const completedBase = "COALESCE(o.completed_at, o.created_at)";
  const cycleEnd = `TIMESTAMP(LAST_DAY(${completedBase}), '23:59:59')`;
  const payoutDeadline = `DATE_ADD(${cycleEnd}, INTERVAL 7 DAY)`;
  return `
    SELECT
      o.order_id,
      COALESCE(o.seller_id, seller_map.seller_id) AS seller_id,
      o.created_at,
      ${completedBase} AS completed_base_at,
      ${orderFinancialSql.total} AS total_sales,
      ${orderFinancialSql.shipping} AS shipping_total,
      ${orderFinancialSql.fee} AS fee_amount,
      ${orderFinancialSql.net} AS net_amount,
      ${cycleEnd} AS cycle_end_at,
      ${payoutDeadline} AS payout_deadline_at,
      CASE
        WHEN NOW() > ${payoutDeadline} THEN 'overdue'
        WHEN NOW() > ${cycleEnd} THEN 'ready'
        ELSE 'cycle'
      END AS payout_stage
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(price_at_purchase * quantity) AS subtotal
      FROM order_items
      GROUP BY order_id
    ) items_sub ON items_sub.order_id = o.order_id
    LEFT JOIN (
      SELECT order_id, COALESCE(SUM(shipping_price), 0) AS ship_sum
      FROM order_shipping
      GROUP BY order_id
    ) ship_agg ON ship_agg.order_id = o.order_id
    LEFT JOIN (
      SELECT oi2.order_id, MIN(p2.seller_id) AS seller_id
      FROM order_items oi2
      JOIN products p2 ON p2.product_id = oi2.product_id
      GROUP BY oi2.order_id
    ) seller_map ON seller_map.order_id = o.order_id
    WHERE o.order_status = 'delivered'
      AND o.payout_status = 'pending'
      AND COALESCE(o.seller_id, seller_map.seller_id) IS NOT NULL
      ${extraWhere}
  `;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function chartBucketKey(date, granularity) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  if (granularity === "month") return `${y}-${m}`;
  if (granularity === "hour") return `${y}-${m}-${d} ${pad2(date.getHours())}:00`;
  return `${y}-${m}-${d}`;
}

function chartBucketLabel(date, granularity) {
  if (granularity === "hour") return `${pad2(date.getHours())}:00`;
  if (granularity === "month") {
    return date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function startOfChartBucket(date, granularity) {
  const d = new Date(date);
  if (granularity === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  } else if (granularity === "hour") {
    d.setMinutes(0, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function advanceChartBucket(date, granularity) {
  if (granularity === "month") {
    date.setMonth(date.getMonth() + 1);
  } else if (granularity === "hour") {
    date.setHours(date.getHours() + 1);
  } else {
    date.setDate(date.getDate() + 1);
  }
}

/* ────── Schools ────── */

export async function listSchools({ status = "", q = "", sort = "latest" } = {}) {
  const where = []; const params = [];
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.push("s.verification_status = ?"); params.push(status);
  }
  if (q) {
    where.push("(s.school_name LIKE ? OR s.school_address LIKE ? OR u.user_name LIKE ? OR u.user_email LIKE ?)");
    const like = `%${q}%`; params.push(like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql = sort === "oldest" ? "ORDER BY s.created_at ASC" : "ORDER BY s.created_at DESC";

  const [rows] = await db.query(`
    SELECT s.school_id, s.school_name, s.school_address, s.school_phone,
      s.school_doc_url, s.school_doc_public_id, s.school_logo_url, s.school_logo_public_id,
      s.school_code, s.school_intent, s.verification_status, s.verification_note, s.created_at,
      u.user_name AS coordinator_name, u.user_email AS coordinator_email
    FROM schools s
    LEFT JOIN users u ON u.user_id = (
      SELECT user_id FROM users
      WHERE school_id = s.school_id AND role = 'school_admin'
      ORDER BY is_primary DESC, joined_school_at ASC LIMIT 1
    )
    ${whereSql} ${orderSql}
  `, params);

  const [[totalRow]] = await db.query(`SELECT COUNT(*) AS c FROM schools`);
  const [[pendingRow]] = await db.query(`SELECT COUNT(*) AS c FROM schools WHERE verification_status='pending'`);
  const [[approvedRow]] = await db.query(`SELECT COUNT(*) AS c FROM schools WHERE verification_status='approved'`);

  return {
    stats: { total: Number(totalRow?.c || 0), pending: Number(pendingRow?.c || 0), approved: Number(approvedRow?.c || 0) },
    rows,
  };
}

export async function approveSchool(school_id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `UPDATE schools SET verification_status='approved', verification_note=NULL WHERE school_id=?`, [school_id]);
    if (r.affectedRows === 0) throw Object.assign(new Error("School not found"), { status: 404 });
    await conn.query(`UPDATE users SET status='active' WHERE role='school_admin' AND school_id=?`, [school_id]);
    await conn.commit();
    return { message: "Approved" };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

export async function rejectSchool(school_id, note) {
  if (!note) throw Object.assign(new Error("กรุณากรอกเหตุผลการปฏิเสธ"), { status: 400 });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [sr] = await conn.query(
      `UPDATE schools SET verification_status='rejected', verification_note=? WHERE school_id=?`, [note, school_id]);
    if (sr.affectedRows === 0) throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
    await conn.query(`UPDATE users SET status='rejected' WHERE role='school_admin' AND school_id=?`, [school_id]);
    await conn.commit();
    return { message: "Rejected", school_id };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

// ระงับบัญชีโรงเรียน — ข้อมูลยังอยู่ครบ แต่ผู้ดูแลทุกคน login ไม่ได้
export async function suspendSchool(school_id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `UPDATE schools SET verification_status='suspended' WHERE school_id=?`, [school_id]
    );
    if (r.affectedRows === 0) throw Object.assign(new Error("School not found"), { status: 404 });
    await conn.query(
      `UPDATE users SET status='suspended' WHERE school_id=? AND role='school_admin'`, [school_id]
    );
    await conn.commit();
    return { message: "Suspended" };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

// ปลดระงับบัญชีโรงเรียน
export async function unsuspendSchool(school_id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `UPDATE schools SET verification_status='approved' WHERE school_id=?`, [school_id]
    );
    if (r.affectedRows === 0) throw Object.assign(new Error("School not found"), { status: 404 });
    await conn.query(
      `UPDATE users SET status='active' WHERE school_id=? AND role='school_admin' AND status='suspended'`, [school_id]
    );
    await conn.commit();
    return { message: "Unsuspended" };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

export async function getSchoolDetail(school_id) {
  const id = Number(school_id);
  if (!Number.isFinite(id)) throw Object.assign(new Error("school_id ไม่ถูกต้อง"), { status: 400 });
  const [rows] = await db.query(`
    SELECT s.*, u.user_name AS coordinator_name, u.user_email AS coordinator_email
    FROM schools s
    LEFT JOIN users u ON u.user_id = (
      SELECT user_id FROM users
      WHERE school_id = s.school_id AND role = 'school_admin'
      ORDER BY is_primary DESC, joined_school_at ASC LIMIT 1
    )
    WHERE s.school_id = ?
  `, [id]);
  if (!rows.length) throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
  return rows[0];
}

export async function getSchoolAdminsList(school_id) {
  const id = Number(school_id);
  if (!Number.isFinite(id)) throw Object.assign(new Error("school_id ไม่ถูกต้อง"), { status: 400 });
  const [rows] = await db.query(
    `SELECT user_id, user_name, user_email, is_primary, joined_school_at, created_at
     FROM users
     WHERE school_id = ? AND role = 'school_admin'
     ORDER BY is_primary DESC, joined_school_at ASC`,
    [id]
  );
  return rows;
}

export async function updateSchool(school_id, payload = {}) {
  const id = Number(school_id);
  if (!Number.isFinite(id)) throw Object.assign(new Error("school_id ไม่ถูกต้อง"), { status: 400 });
  const { school_name, school_address, school_phone, school_code, school_intent, school_logo_url, school_logo_public_id } = payload;
  const codeDigits = String(school_code ?? "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(codeDigits)) throw Object.assign(new Error("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี"), { status: 400 });
  const phoneDigits = normalizeThaiPhone(school_phone);
  if (!phoneDigits || !/^0\d{9}$/.test(phoneDigits)) throw Object.assign(new Error("เบอร์โทรต้องเป็นตัวเลข 10 หลัก"), { status: 400 });
  if (!String(school_name || "").trim() || !String(school_address || "").trim()) throw Object.assign(new Error("กรุณากรอกข้อมูลให้ครบ"), { status: 400 });
  const [r] = await db.query(
    `UPDATE schools SET school_name=?, school_address=?, school_phone=?, school_code=?, school_intent=?, school_logo_url=?, school_logo_public_id=? WHERE school_id=?`,
    [String(school_name).trim(), String(school_address).trim(), phoneDigits, codeDigits, school_intent || null, school_logo_url || null, school_logo_public_id || null, id]);
  if (r.affectedRows === 0) throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
  return { message: "Updated", school_id: id };
}

export async function adminUpdateSchool(school_id, payload = {}) {
  const id = Number(school_id);
  if (!Number.isFinite(id)) throw Object.assign(new Error("school_id ไม่ถูกต้อง"), { status: 400 });
  const { school_name, school_address, school_phone, school_code, school_intent, school_logo_url, school_logo_public_id, coordinator_name, coordinator_email, coordinator_phone } = payload;
  const name = String(school_name || "").trim();
  const addr = String(school_address || "").trim();
  if (!name || !addr) throw Object.assign(new Error("กรุณากรอกข้อมูลโรงเรียนให้ครบ"), { status: 400 });
  const phoneDigits = normalizeThaiPhone(school_phone);
  if (!phoneDigits || !/^0\d{9}$/.test(phoneDigits)) throw Object.assign(new Error("เบอร์โทรโรงเรียนต้องเป็นตัวเลข 10 หลัก"), { status: 400 });
  let codeDigits = null;
  if (school_code !== undefined) {
    const raw = String(school_code || "").trim();
    if (raw !== "") {
      const d = raw.replace(/\D/g, "");
      if (!/^\d{10}$/.test(d)) throw Object.assign(new Error("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี"), { status: 400 });
      codeDigits = d;
    }
  }
  const [[row]] = await db.query(`SELECT school_id, coordinator_user_id FROM schools WHERE school_id=? LIMIT 1`, [id]);
  if (!row) throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const sFields = ["school_name=?", "school_address=?", "school_phone=?", "school_intent=?", "school_logo_url=?", "school_logo_public_id=?"];
    const sVals = [name, addr, phoneDigits, school_intent || null, school_logo_url || null, school_logo_public_id || null];
    if (codeDigits) { sFields.push("school_code=?"); sVals.push(codeDigits); }
    sVals.push(id);
    const [r1] = await conn.query(`UPDATE schools SET ${sFields.join(", ")} WHERE school_id=?`, sVals);
    if (r1.affectedRows === 0) throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
    const cName = String(coordinator_name ?? "").trim();
    const cEmail = String(coordinator_email ?? "").trim();
    const cPhoneRaw = String(coordinator_phone ?? "").trim();
    const cPhoneDigits = cPhoneRaw ? normalizeThaiPhone(cPhoneRaw) : "";
    if (cEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail)) throw Object.assign(new Error("อีเมลผู้ประสานงานไม่ถูกต้อง"), { status: 400 });
    const coordinatorUserId = row.coordinator_user_id;
    const hasCoordPayload = coordinator_name !== undefined || coordinator_email !== undefined || coordinator_phone !== undefined;
    if (coordinatorUserId && hasCoordPayload) {
      const uFields = []; const uVals = [];
      if (coordinator_name !== undefined) { uFields.push("user_name=?"); uVals.push(cName); }
      if (coordinator_email !== undefined) { uFields.push("user_email=?"); uVals.push(cEmail || null); }
      if (coordinator_phone !== undefined) { uFields.push("user_phone=?"); uVals.push(cPhoneDigits || null); }
      if (uFields.length) { uVals.push(coordinatorUserId); await conn.query(`UPDATE users SET ${uFields.join(", ")} WHERE user_id=?`, uVals); }
    }
    await conn.commit();
    return { message: "Updated", school_id: id };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

/* ────── Dashboard Overview ────── */

/** คำนวณ % เปลี่ยนแปลง เทียบกับค่าก่อนหน้า (ไม่ให้หาร 0) */
function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getOverviewStats() {
  // เดือนนี้ vs เดือนที่แล้ว
  const [[cur]] = await db.query(`
    SELECT
      SUM(role='user')                                                       AS users,
      SUM(1)                                                                 AS schools_approved,
      (SELECT COUNT(*) FROM products)                                        AS products,
      (SELECT COUNT(*) FROM orders)                                          AS orders,
      (SELECT COUNT(*) FROM donation_request)                                AS donations
    FROM users u
    LEFT JOIN schools s ON s.verification_status = 'approved'
    WHERE u.role = 'user'
  `).catch(() => [[{}]]);

  // นับจริงทีละตาราง (ชัดเจนกว่า)
  const [[usersRow]]    = await db.query(`SELECT COUNT(*) AS c FROM users WHERE role='user'`);
  const [[schoolsRow]]  = await db.query(`SELECT COUNT(*) AS c FROM schools WHERE verification_status='approved'`);
  const [[productsRow]] = await db.query(`SELECT COUNT(*) AS c FROM products`);
  const [[ordersRow]]   = await db.query(`SELECT COUNT(*) AS c FROM orders`);
  const [[donationsRow]] = await db.query(`SELECT COUNT(*) AS c FROM donation_request`)
    .catch(() => [[{ c: 0 }]]);

  // เดือนที่แล้ว (สร้างใหม่ในเดือนนั้น)
  const [[prevUsers]]    = await db.query(`
    SELECT COUNT(*) AS c FROM users
    WHERE role='user'
      AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
      AND created_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `);
  const [[prevSchools]]  = await db.query(`
    SELECT COUNT(*) AS c FROM schools
    WHERE verification_status='approved'
      AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
      AND created_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `);
  const [[prevProducts]] = await db.query(`
    SELECT COUNT(*) AS c FROM products
    WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
      AND created_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `);
  const [[prevOrders]]   = await db.query(`
    SELECT COUNT(*) AS c FROM orders
    WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
      AND created_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `);
  const [[prevDonations]] = await db.query(`
    SELECT COUNT(*) AS c FROM donation_request
    WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
      AND created_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `).catch(() => [[{ c: 0 }]]);

  // เดือนนี้ (สร้างใหม่เดือนนี้)
  const [[thisUsers]]    = await db.query(`SELECT COUNT(*) AS c FROM users WHERE role='user' AND created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`);
  const [[thisSchools]]  = await db.query(`SELECT COUNT(*) AS c FROM schools WHERE verification_status='approved' AND created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`);
  const [[thisProducts]] = await db.query(`SELECT COUNT(*) AS c FROM products WHERE created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`);
  const [[thisOrders]]   = await db.query(`SELECT COUNT(*) AS c FROM orders WHERE created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`);
  const [[thisDonations]] = await db.query(`SELECT COUNT(*) AS c FROM donation_request WHERE created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')`)
    .catch(() => [[{ c: 0 }]]);

  return {
    total_users:          Number(usersRow?.c        || 0),
    total_schools:        Number(schoolsRow?.c      || 0),
    total_donations:      Number(donationsRow?.c    || 0),
    total_products:       Number(productsRow?.c     || 0),
    total_orders:         Number(ordersRow?.c       || 0),
    // % เปลี่ยนแปลงเทียบเดือนที่แล้ว (ใช้ยอดสร้างใหม่เดือนนี้ vs เดือนที่แล้ว)
    pct_users:            pctChange(Number(thisUsers?.c||0),    Number(prevUsers?.c||0)),
    pct_schools:          pctChange(Number(thisSchools?.c||0),  Number(prevSchools?.c||0)),
    pct_donations:        pctChange(Number(thisDonations?.c||0),Number(prevDonations?.c||0)),
    pct_products:         pctChange(Number(thisProducts?.c||0), Number(prevProducts?.c||0)),
    pct_orders:           pctChange(Number(thisOrders?.c||0),   Number(prevOrders?.c||0)),
  };
}

/**
 * รายได้แพลตฟอร์ม
 * - platform_revenue = ยอดขายสินค้ารวม (ก่อนหักค่าธรรมเนียม)
 * - fee_revenue      = ค่าธรรมเนียม max(15%, ฿20 ต่อออเดอร์) ที่แพลตฟอร์มได้
 * - fee_15_revenue   = ส่วนที่คิด 15% จริง (subtotal > ฿133.33 ซึ่ง 15% > ฿20)
 * - fee_min_revenue  = ส่วนที่ใช้ขั้นต่ำ ฿20 (subtotal ≤ ฿133.33 ซึ่ง 15% ≤ ฿20)
 * - net_revenue      = รายได้สุทธิหลังหักค่าธรรมเนียม (= ยอดที่ผู้ขายควรได้รวมกัน)
 *
 * จุด breakeven: 20 / 0.15 = 133.33 บาท
 *   subtotal > 133.33 → ใช้ 15%  (เช่น ฿140 → ฿21)
 *   subtotal ≤ 133.33 → ใช้ขั้นต่ำ ฿20 (เช่น ฿80 → ฿20, ฿100 → ฿20, ฿120 → ฿20)
 */
export async function getRevenueStats({ period = "month", start_date = null, end_date = null } = {}) {
  const { from, to } = periodToDateRange(period, start_date, end_date);

  // คำนวณ "ช่วงก่อนหน้า" ที่ยาวเท่ากัน สำหรับ % เปลี่ยนแปลง
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const diffMs   = toDate - fromDate;
  const prevTo   = toSqlLocalDateTime(new Date(fromDate - 1));
  const prevFrom = toSqlLocalDateTime(new Date(fromDate - diffMs - 1));

  // Query รายได้ + แยกประเภทค่าธรรมเนียม
  // ใช้ logic ใหม่: max(subtotal * 15%, ฿20) ต่อออเดอร์
  // จุด breakeven = 20 / 0.15 = 133.33 บาท
  //   fee_15_revenue  = รายการที่คิด 15% จริง (subtotal > 133.33)
  //   fee_min_revenue = รายการที่ใช้ขั้นต่ำ ฿20 (subtotal ≤ 133.33)
  const revenueQuery = `
    SELECT
      COALESCE(SUM(${orderFinancialSql.fee}), 0)          AS platform_revenue,
      COALESCE(SUM(${orderFinancialSql.total}), 0)         AS order_volume,
      COALESCE(SUM(${orderFinancialSql.fee}), 0)           AS fee_revenue,
      COALESCE(SUM(${orderFinancialSql.net}), 0)           AS net_revenue,
      COUNT(*)                                  AS fee_count,
      -- ค่าธรรมเนียม 15% จริง (subtotal > 133.33 → 15% เกิน ฿20)
      COALESCE(SUM(
        CASE WHEN COALESCE(items_sub.subtotal, 0) > 133.33 THEN ${orderFinancialSql.fee} ELSE 0 END
      ), 0) AS fee_15_revenue,
      -- ขั้นต่ำ ฿20 (subtotal ≤ 133.33 → 15% ต่ำกว่า ฿20 → ใช้ขั้นต่ำ)
      COALESCE(SUM(
        CASE WHEN COALESCE(items_sub.subtotal, 0) <= 133.33 AND ${orderFinancialSql.fee} > 0 THEN ${orderFinancialSql.fee} ELSE 0 END
      ), 0) AS fee_min_revenue,
      COUNT(CASE WHEN COALESCE(items_sub.subtotal, 0) > 133.33 THEN 1 END)                                     AS fee_15_count,
      COUNT(CASE WHEN COALESCE(items_sub.subtotal, 0) <= 133.33 AND ${orderFinancialSql.fee} > 0 THEN 1 END)   AS fee_min_count
    FROM orders o
    LEFT JOIN (
      SELECT order_id,
             SUM(price_at_purchase * quantity) AS subtotal
      FROM order_items
      GROUP BY order_id
    ) items_sub ON items_sub.order_id = o.order_id
    LEFT JOIN (
      SELECT order_id,
             COALESCE(SUM(shipping_price), 0) AS ship_sum
      FROM order_shipping
      GROUP BY order_id
    ) ship_agg ON ship_agg.order_id = o.order_id
    WHERE o.payment_status = 'paid'
      AND o.created_at BETWEEN ? AND ?
  `;

  const [[revenueRow]] = await db.query(revenueQuery, [from, to]);
  const [[prevRow]]    = await db.query(revenueQuery, [prevFrom, prevTo]);

  return {
    platform_revenue: Math.round(Number(revenueRow?.platform_revenue || 0)),  // = SUM(fees)
    order_volume:     Math.round(Number(revenueRow?.order_volume     || 0)),  // GMV
    fee_revenue:      Math.round(Number(revenueRow?.fee_revenue      || 0)),
    fee_15_revenue:   Math.round(Number(revenueRow?.fee_15_revenue   || 0)),
    fee_min_revenue:  Math.round(Number(revenueRow?.fee_min_revenue  || 0)),
    fee_15_count:     Number(revenueRow?.fee_15_count  || 0),
    fee_min_count:    Number(revenueRow?.fee_min_count || 0),
    net_revenue:      Math.round(Number(revenueRow?.net_revenue      || 0)),
    fee_count:        Number(revenueRow?.fee_count || 0),
    pct_platform_revenue: pctChange(
      Number(revenueRow?.platform_revenue || 0),
      Number(prevRow?.platform_revenue    || 0)
    ),
    pct_fee_15:  pctChange(Number(revenueRow?.fee_15_revenue || 0), Number(prevRow?.fee_15_revenue || 0)),
    pct_fee_min: pctChange(Number(revenueRow?.fee_min_revenue || 0), Number(prevRow?.fee_min_revenue || 0)),
  };
}

/**
 * ข้อมูลกราฟ "ยอดขายรวม vs ค่าธรรมเนียม" ย้อนหลัง N เดือน
 * - กรองด้วย payment_status = 'paid' (ครอบคลุม confirmed/shipping/delivered)
 *   ไม่ filter เฉพาะ delivered เพื่อให้ chart มีข้อมูลทันทีหลัง buyer จ่ายเงิน
 * - ใช้ 1 query เดียวต่อ N เดือน (เร็วกว่า loop)
 */
export async function getChartData({ period = "month", start_date = null, end_date = null } = {}) {
  const { from, to } = periodToDateRange(period, start_date, end_date);
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffDays = Math.max(1, Math.ceil((toDate - fromDate) / 86400000));

  let dateFormat;
  let granularity;
  if (period === "today" || diffDays <= 2) {
    dateFormat = "%Y-%m-%d %H:00";
    granularity = "hour";
  } else if (diffDays <= 62) {
    dateFormat = "%Y-%m-%d";
    granularity = "day";
  } else {
    dateFormat = "%Y-%m";
    granularity = "month";
  }

  const [rows] = await db.query(
    `
    SELECT
      DATE_FORMAT(o.created_at, ?) AS bucket,
      COALESCE(SUM(${orderFinancialSql.total}), 0) AS sales,
      COALESCE(SUM(${orderFinancialSql.fee}), 0) AS fees
    FROM orders o
    LEFT JOIN (
      SELECT order_id,
             SUM(price_at_purchase * quantity) AS subtotal
      FROM order_items
      GROUP BY order_id
    ) items_sub ON items_sub.order_id = o.order_id
    LEFT JOIN (
      SELECT order_id,
             COALESCE(SUM(shipping_price), 0) AS ship_sum
      FROM order_shipping
      GROUP BY order_id
    ) ship_agg ON ship_agg.order_id = o.order_id
    WHERE o.payment_status = 'paid'
      AND o.created_at BETWEEN ? AND ?
    GROUP BY bucket
    ORDER BY bucket
    `,
    [dateFormat, from, to],
  );

  const byBucket = Object.fromEntries(rows.map((r) => [r.bucket, r]));
  const labels = [];
  const salesArr = [];
  const feesArr = [];

  let cur = startOfChartBucket(fromDate, granularity);
  const end = new Date(toDate);
  const guard = 400;
  let steps = 0;
  while (cur <= end && steps < guard) {
    const key = chartBucketKey(cur, granularity);
    const r = byBucket[key] || { sales: 0, fees: 0 };
    labels.push(chartBucketLabel(cur, granularity));
    salesArr.push(Math.round(Number(r.sales || 0)));
    feesArr.push(Math.round(Number(r.fees || 0)));
    advanceChartBucket(cur, granularity);
    steps += 1;
  }

  const [[donOpen]] = await db.query(`SELECT COUNT(*) AS c FROM donation_request WHERE status='open'`)
    .catch(() => [[{ c: 0 }]]);
  const [[donAll]] = await db.query(`SELECT COUNT(*) AS c FROM donation_request`)
    .catch(() => [[{ c: 0 }]]);
  const openPct = Number(donAll?.c) > 0 ? Math.round((Number(donOpen.c) / Number(donAll.c)) * 100) : 0;

  return {
    months: labels,
    sales: salesArr,
    fees: feesArr,
    granularity,
    donation_open_pct: openPct,
  };
}

/**
 * รายการรอดำเนินงาน — ส่งคืนเฉพาะหมวดที่มี > 0 รายการ
 * frontend ใช้ tasks: [] เพื่อตัดสินใจซ่อนกล่องไปเลย
 */
export async function getPendingTasks() {
  const [[schoolRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM schools WHERE verification_status='pending'`
  );
  // ค้างส่ง = paid แต่ยังไม่ได้จัดส่ง (pending หรือ confirmed เท่านั้น, ไม่รวม shipping)
  const [[shipRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM orders WHERE order_status IN ('pending','confirmed') AND payment_status='paid'`
  ).catch(() => [[{ c: 0 }]]);
  const [[donRow]] = await db.query(
    `SELECT COUNT(*) AS c FROM donation_request WHERE status='pending'`
  ).catch(() => [[{ c: 0 }]]);

  const counts = {
    pending_schools:   Number(schoolRow?.c || 0),
    pending_shipments: Number(shipRow?.c   || 0),
    pending_donations: Number(donRow?.c    || 0),
  };

  // Array แบบ frontend ใช้ render รายการได้เลย (ซ่อนกล่องเมื่อ tasks.length === 0)
  const tasks = [];
  if (counts.pending_schools > 0) {
    tasks.push({ key: "schools",   label: "โรงเรียนรออนุมัติ",   count: counts.pending_schools,   unit: "แห่ง",    action: "อนุมัติ", url: "/admin/schools?status=pending",   color: "yellow" });
  }
  if (counts.pending_shipments > 0) {
    tasks.push({ key: "shipments", label: "รายการสินค้าค้างส่ง", count: counts.pending_shipments, unit: "รายการ", action: "จัดการ",  url: "/admin/orders?status=shipping",  color: "red"    });
  }
  if (counts.pending_donations > 0) {
    tasks.push({ key: "donations", label: "บริจาคไม่ถูกยืนยัน",   count: counts.pending_donations, unit: "รายการ", action: "จัดการ",  url: "/admin/donations?status=pending", color: "red"    });
  }

  return { ...counts, tasks };
}

/* ────── Orders ────── */

export async function listOrders({ status = "", q = "", page = 1, limit = 10, seller_id = "", period = "month", start_date = "", end_date = "", payout_status = "" } = {}) {
  const { from, to } = periodToDateRange(period, start_date, end_date);
  const where = ["o.created_at BETWEEN ? AND ?"]; const params = [from, to];
  if (status && ["pending", "confirmed", "shipping", "delivered", "cancelled"].includes(status)) {
    where.push("o.order_status = ?"); params.push(status);
  }
  if (payout_status && ["pending", "paid"].includes(payout_status)) {
    where.push("o.payout_status = ?"); params.push(payout_status);
  }
  if (q) {
    where.push("(buyer.user_name LIKE ? OR seller.user_name LIKE ? OR p.product_title LIKE ?)");
    const like = `%${q}%`; params.push(like, like, like);
  }
  if (seller_id) {
    where.push("COALESCE(o.seller_id, seller_map.seller_id) = ?"); params.push(Number(seller_id));
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit  = Math.min(100, Math.max(1, Number(limit) || 10));
  const safePage   = Math.max(1, Number(page) || 1);
  const offset     = (safePage - 1) * safeLimit;

  // ── ดึง order list ────────────────────────────────────────────────
  // FIX: เคยมี "LIMIT 1" แทรกกลาง LEFT JOIN -> SQL syntax error
  // FIX: total_amount -> total_price, product_name -> product_title
  const [rows] = await db.query(`
    SELECT
      o.order_id,
      o.total_price,
      o.platform_fee,
      o.seller_payout_amount,
      o.omise_charge_id,
      o.order_status,
      o.payment_status,
      o.payout_status,
      o.created_at,
      COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) AS items_subtotal,
      COALESCE(SUM(os.shipping_price), 0) AS shipping_total,
      GROUP_CONCAT(DISTINCT p.product_title SEPARATOR ', ') AS products,
      COALESCE(SUM(oi.quantity), 0) AS total_qty,
      MAX(buyer.user_name)  AS buyer_name,
      MAX(buyer.user_phone) AS buyer_phone,
      MAX(seller.user_name) AS seller_name
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id  = o.order_id
    LEFT JOIN products    p  ON p.product_id = oi.product_id
    LEFT JOIN order_shipping os ON os.order_id = o.order_id
    LEFT JOIN users  buyer   ON buyer.user_id  = o.buyer_id
    LEFT JOIN (
      SELECT oi2.order_id, MIN(p2.seller_id) AS seller_id
      FROM order_items oi2
      JOIN products p2 ON p2.product_id = oi2.product_id
      GROUP BY oi2.order_id
    ) seller_map ON seller_map.order_id = o.order_id
    LEFT JOIN users  seller  ON seller.user_id = COALESCE(o.seller_id, seller_map.seller_id)
    ${whereSql}
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, safeLimit, offset]);

  // ── นับจำนวนแถวทั้งหมด (ตาม filter เดียวกัน) ─────────────────────
  // ต้องใช้ DISTINCT order_id เพราะ JOIN กับ order_items/products/users
  const [[countRow]] = await db.query(`
    SELECT COUNT(DISTINCT o.order_id) AS c
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id  = o.order_id
    LEFT JOIN products    p  ON p.product_id = oi.product_id
    LEFT JOIN users  buyer   ON buyer.user_id  = o.buyer_id
    LEFT JOIN (
      SELECT oi2.order_id, MIN(p2.seller_id) AS seller_id
      FROM order_items oi2
      JOIN products p2 ON p2.product_id = oi2.product_id
      GROUP BY oi2.order_id
    ) seller_map ON seller_map.order_id = o.order_id
    LEFT JOIN users  seller  ON seller.user_id = COALESCE(o.seller_id, seller_map.seller_id)
    ${whereSql}
  `, params);

  // ── Stats (กรองตาม period เดียวกัน) ─────────────────────────────
  const [[stats]] = await db.query(`
    SELECT
      COUNT(*)                                              AS total,
      SUM(order_status = 'pending')                         AS pending,
      SUM(order_status IN ('confirmed','shipping'))         AS shipping,
      SUM(order_status = 'delivered')                       AS delivered,
      SUM(order_status = 'cancelled')                       AS cancelled
    FROM orders
    WHERE created_at BETWEEN ? AND ?
  `, [from, to]);

  return {
    stats: {
      total:     Number(stats.total),
      pending:   Number(stats.pending),
      shipping:  Number(stats.shipping),
      delivered: Number(stats.delivered),
      cancelled: Number(stats.cancelled),
    },
    rows: (rows || []).map((r) => {
      const itemsSubtotal = Number(r.items_subtotal || 0);
      const calculatedFee = itemsSubtotal > 0
        ? Math.max(Math.round(itemsSubtotal * 0.15 * 100) / 100, 20)
        : 0;
      return {
        ...r,
        items_subtotal: Math.round(itemsSubtotal),
        shipping_total: Math.round(Number(r.shipping_total || 0)),
        calculated_fee: Math.round(calculatedFee),
      };
    }),
    total_pages: Math.max(1, Math.ceil(Number(countRow.c) / safeLimit)),
  };
}

export async function getOrderDetail(orderId) {
  const [[order]] = await db.query(
    `SELECT
       o.order_id,
       o.total_price,
       o.platform_fee,
       o.seller_payout_amount,
       o.order_status,
       o.payment_status,
       o.payout_status,
       o.payment_method,
       o.omise_charge_id,
       o.tracking_number,
       o.created_at,
       o.recipient_name,
       o.shipping_phone,
       o.shipping_address,
       o.shipping_province,
       o.shipping_postcode,
       buyer.user_name AS buyer_name,
       buyer.user_phone AS buyer_phone,
       seller.user_name AS seller_name,
       seller.user_phone AS seller_phone
     FROM orders o
     LEFT JOIN users buyer ON buyer.user_id = o.buyer_id
     LEFT JOIN (
       SELECT oi2.order_id, MIN(p2.seller_id) AS seller_id
       FROM order_items oi2
       JOIN products p2 ON p2.product_id = oi2.product_id
       GROUP BY oi2.order_id
     ) seller_map ON seller_map.order_id = o.order_id
     LEFT JOIN users seller ON seller.user_id = seller_map.seller_id
     WHERE o.order_id = ?
     LIMIT 1`,
    [orderId]
  );
  if (!order) throw Object.assign(new Error("ไม่พบออเดอร์"), { status: 404 });

  const [items] = await db.query(
    `SELECT
       oi.order_item_id,
       oi.product_id,
       oi.quantity,
       oi.price_at_purchase,
       p.product_title,
       p.size,
       p.gender,
       p.category_id,
       p.level,
       pi.image_url AS cover_image
     FROM order_items oi
     LEFT JOIN products p ON p.product_id = oi.product_id
     LEFT JOIN product_images pi ON pi.product_id = oi.product_id AND pi.is_cover = 1
     WHERE oi.order_id = ?
     ORDER BY oi.order_item_id ASC`,
    [orderId]
  );

  const [shipping] = await db.query(
    `SELECT
       os.shipping_price,
       os.seller_id,
       os.provider_id,
       sp.name AS provider_name
     FROM order_shipping os
     LEFT JOIN shipping_provider sp ON sp.provider_id = os.provider_id
     WHERE os.order_id = ?`,
    [orderId]
  ).catch(() => [[]]);

  const itemsSubtotal = items.reduce(
    (sum, it) => sum + Number(it.price_at_purchase || 0) * Number(it.quantity || 0),
    0
  );
  const shippingTotal = (shipping || []).reduce(
    (sum, s) => sum + Number(s.shipping_price || 0),
    0
  );
  const calculatedFee = itemsSubtotal > 0
    ? Math.max(Math.round(itemsSubtotal * 0.15 * 100) / 100, 20)
    : 0;

  // ยอดโอนให้ผู้ขาย = ยอดสินค้า - ค่าธรรมเนียม + ค่าส่ง
  const platformFee = Number(order.platform_fee || calculatedFee);
  const sellerPayout = Math.max(0, itemsSubtotal - platformFee + shippingTotal);

  return {
    ...order,
    items,
    shipping,
    items_subtotal: Math.round(itemsSubtotal),
    shipping_total: Math.round(shippingTotal),
    calculated_fee: Math.round(calculatedFee),
    seller_payout_amount: order.seller_payout_amount
      ? Math.round(Number(order.seller_payout_amount))
      : Math.round(sellerPayout),
  };
}

export async function shipOrder(order_id) {
  const [r] = await db.query(
    `UPDATE orders SET order_status='shipping' WHERE order_id=? AND order_status='pending'`,
    [order_id]);
  if (r.affectedRows === 0) throw Object.assign(new Error("ไม่พบออเดอร์หรือสถานะไม่ถูกต้อง"), { status: 400 });
  return { message: "Shipped", order_id };
}

export async function cancelOrder(order_id) {
  const [r] = await db.query(
    `UPDATE orders SET order_status='cancelled' WHERE order_id=? AND order_status IN ('pending','shipping')`,
    [order_id]);
  if (r.affectedRows === 0) throw Object.assign(new Error("ไม่พบออเดอร์หรือสถานะไม่ถูกต้อง"), { status: 400 });
  return { message: "Cancelled", order_id };
}

/* ────── Payouts ────── */

/**
 * รายการรอจ่ายเงินผู้ขาย + ประวัติ payouts
 * ใช้คอลัมน์ที่ migration เพิ่ม:
 *   - orders.platform_fee, orders.seller_payout_amount, orders.payout_status
 *   - users.bank_account_number, users.bank_account_name, users.bank_code
 *   - payouts (ตารางใหม่)
 */
export async function listPayouts({
  period = "week",
  page = 1,
  limit = 10,
  pending_page,
  pending_limit,
  history_page,
  history_limit,
  start_date = "",
  end_date = "",
} = {}) {
  const { from, to } = periodToDateRange(period, start_date, end_date);
  const fallbackLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const fallbackPage  = Math.max(1, Number(page) || 1);
  const pendingSafeLimit = Math.min(100, Math.max(1, Number(pending_limit) || fallbackLimit));
  const historySafeLimit = Math.min(100, Math.max(1, Number(history_limit) || fallbackLimit));
  const pendingSafePage  = Math.max(1, Number(pending_page) || fallbackPage);
  const historySafePage  = Math.max(1, Number(history_page) || fallbackPage);
  const pendingOffset    = (pendingSafePage - 1) * pendingSafeLimit;
  const historyOffset    = (historySafePage - 1) * historySafeLimit;
  const pendingBaseSql = pendingPayoutOrderSelect("AND o.created_at BETWEEN ? AND ?");
  const pendingParams = [from, to];

  // ผู้ขายที่มีออเดอร์ delivered + ยังไม่ได้จ่าย (กรองตามวันที่สั่งซื้อของออเดอร์)
  // ใช้ seller_id จาก orders ก่อน หากข้อมูลเก่ายังว่างจะ fallback จาก products ผ่าน order_items
  const [pendingRows] = await db.query(`
    SELECT
      po.seller_id,
      u.user_name AS seller_name,
      u.bank_account_number,
      u.bank_account_name,
      u.bank_code,
      COUNT(po.order_id) AS order_count,
      COALESCE(SUM(po.total_sales), 0) AS total_sales,
      COALESCE(SUM(po.fee_amount), 0) AS fee_amount,
      COALESCE(SUM(po.net_amount), 0) AS net_amount,
      COALESCE(SUM(po.shipping_total), 0) AS shipping_total,
      COALESCE(SUM(CASE WHEN po.payout_stage IN ('ready','overdue') THEN po.total_sales ELSE 0 END), 0) AS payable_total_sales,
      COALESCE(SUM(CASE WHEN po.payout_stage IN ('ready','overdue') THEN po.fee_amount ELSE 0 END), 0) AS payable_fee_amount,
      COALESCE(SUM(CASE WHEN po.payout_stage IN ('ready','overdue') THEN po.net_amount ELSE 0 END), 0) AS payable_amount,
      COALESCE(SUM(CASE WHEN po.payout_stage IN ('ready','overdue') THEN po.shipping_total ELSE 0 END), 0) AS payable_shipping_total,
      COUNT(CASE WHEN po.payout_stage = 'ready' THEN 1 END) AS ready_count,
      COUNT(CASE WHEN po.payout_stage = 'overdue' THEN 1 END) AS overdue_count,
      COUNT(CASE WHEN po.payout_stage = 'cycle' THEN 1 END) AS cycle_pending_count,
      COALESCE(SUM(CASE WHEN po.payout_stage = 'cycle' THEN po.net_amount ELSE 0 END), 0) AS cycle_pending_amount,
      CASE
        WHEN COUNT(CASE WHEN po.payout_stage = 'overdue' THEN 1 END) > 0 THEN 'overdue'
        WHEN COUNT(CASE WHEN po.payout_stage = 'ready' THEN 1 END) > 0 THEN 'ready'
        ELSE 'cycle'
      END AS payout_stage,
      MIN(po.created_at) AS first_order_at,
      DATE_FORMAT(MIN(po.completed_base_at), '%Y-%m') AS first_cycle_month,
      GROUP_CONCAT(DISTINCT DATE_FORMAT(po.completed_base_at, '%Y-%m') ORDER BY DATE_FORMAT(po.completed_base_at, '%Y-%m') SEPARATOR ', ') AS payout_cycle_months
    FROM (${pendingBaseSql}) po
    LEFT JOIN users u ON u.user_id = po.seller_id
    GROUP BY po.seller_id, u.user_name, u.bank_account_number, u.bank_account_name, u.bank_code
    HAVING COUNT(po.order_id) > 0
    ORDER BY first_order_at ASC, po.seller_id ASC
    LIMIT ? OFFSET ?
  `, [...pendingParams, pendingSafeLimit, pendingOffset]).catch(() => [[]]);

  // ประวัติการโอน — กรองตามวันที่โอนสำเร็จ
  const [historyRows] = await db.query(`
    SELECT p.payout_id, p.seller_id, p.net_amount, p.fee_amount, p.order_count,
           p.status, p.omise_transfer_id, p.created_at, p.completed_at,
           u.user_name          AS seller_name,
           u.bank_account_number AS bank_account_number_enc,
           u.bank_account_name  AS bank_account_name,
           u.bank_code          AS bank_code
    FROM payouts p
    LEFT JOIN users u ON u.user_id = p.seller_id
    WHERE p.status = 'completed'
      AND COALESCE(p.completed_at, p.created_at) BETWEEN ? AND ?
    ORDER BY COALESCE(p.completed_at, p.created_at) DESC
    LIMIT ? OFFSET ?
  `, [from, to, historySafeLimit, historyOffset]).catch(() => [[]]);

  const [[countRow]] = await db.query(`
    SELECT COUNT(*) AS c
    FROM (
      SELECT seller_id
      FROM (${pendingBaseSql}) po
      GROUP BY seller_id
    ) sellers
  `, pendingParams).catch(() => [[{ c: 0 }]]);

  const [[histCountRow]] = await db.query(`
    SELECT COUNT(*) AS c
    FROM payouts
    WHERE status='completed' AND COALESCE(completed_at, created_at) BETWEEN ? AND ?
  `, [from, to]).catch(() => [[{ c: 0 }]]);

  // Summary stats (ตามช่วงเวลาเดียวกัน)
  const [[pendStats]] = await db.query(`
    SELECT
      COALESCE(SUM(net_amount), 0) AS pending_total,
      COUNT(*) AS pending_count,
      COUNT(DISTINCT seller_id) AS pending_seller_count,
      COALESCE(SUM(CASE WHEN payout_stage IN ('ready','overdue') THEN net_amount ELSE 0 END), 0) AS payable_total,
      COUNT(CASE WHEN payout_stage IN ('ready','overdue') THEN 1 END) AS payable_count,
      COUNT(DISTINCT CASE WHEN payout_stage IN ('ready','overdue') THEN seller_id END) AS payable_seller_count,
      COALESCE(SUM(CASE WHEN payout_stage = 'ready' THEN net_amount ELSE 0 END), 0) AS ready_total,
      COUNT(CASE WHEN payout_stage = 'ready' THEN 1 END) AS ready_count,
      COALESCE(SUM(CASE WHEN payout_stage = 'overdue' THEN net_amount ELSE 0 END), 0) AS overdue_total,
      COUNT(CASE WHEN payout_stage = 'overdue' THEN 1 END) AS overdue_count,
      COALESCE(SUM(CASE WHEN payout_stage = 'cycle' THEN net_amount ELSE 0 END), 0) AS cycle_pending_total,
      COUNT(CASE WHEN payout_stage = 'cycle' THEN 1 END) AS cycle_pending_count
    FROM (${pendingBaseSql}) po
  `, pendingParams).catch(() => [[{
    pending_total: 0, pending_count: 0, pending_seller_count: 0,
    payable_total: 0, payable_count: 0, payable_seller_count: 0,
    ready_total: 0, ready_count: 0, overdue_total: 0, overdue_count: 0,
    cycle_pending_total: 0, cycle_pending_count: 0,
  }]]);

  const [[paidStats]] = await db.query(`
    SELECT COALESCE(SUM(net_amount), 0) AS paid_total, COUNT(*) AS paid_count
    FROM payouts
    WHERE status='completed' AND COALESCE(completed_at, created_at) BETWEEN ? AND ?
  `, [from, to]).catch(() => [[{ paid_total: 0, paid_count: 0 }]]);

  const [[feeStats]] = await db.query(`
    SELECT COALESCE(SUM(${orderFinancialSql.fee}), 0) AS fee_total
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(price_at_purchase * quantity) AS subtotal
      FROM order_items
      GROUP BY order_id
    ) items_sub ON items_sub.order_id = o.order_id
    LEFT JOIN (
      SELECT order_id, COALESCE(SUM(shipping_price), 0) AS ship_sum
      FROM order_shipping
      GROUP BY order_id
    ) ship_agg ON ship_agg.order_id = o.order_id
    WHERE o.order_status='delivered' AND o.created_at BETWEEN ? AND ?
  `, [from, to]).catch(() => [[{ fee_total: 0 }]]);

  return {
    stats: {
      pending_total: Math.round(Number(pendStats?.pending_total || 0)),
      pending_count: Number(pendStats?.pending_count || 0),
      pending_seller_count: Number(pendStats?.pending_seller_count || countRow?.c || 0),
      payable_total: Math.round(Number(pendStats?.payable_total || 0)),
      payable_count: Number(pendStats?.payable_count || 0),
      payable_seller_count: Number(pendStats?.payable_seller_count || 0),
      ready_total: Math.round(Number(pendStats?.ready_total || 0)),
      ready_count: Number(pendStats?.ready_count || 0),
      overdue_total: Math.round(Number(pendStats?.overdue_total || 0)),
      overdue_count: Number(pendStats?.overdue_count || 0),
      cycle_pending_total: Math.round(Number(pendStats?.cycle_pending_total || 0)),
      cycle_pending_count: Number(pendStats?.cycle_pending_count || 0),
      paid_total:    Math.round(Number(paidStats?.paid_total    || 0)),
      paid_count:    Number(paidStats?.paid_count    || 0),
      fee_total:     Math.round(Number(feeStats?.fee_total      || 0)),
    },
    pending: (pendingRows || []).map(r => {
      const rawNum = decryptBankAccountNumber(r.bank_account_number);
      return {
        ...r,
        bank_account_number: rawNum,
        bank_account_number_masked: maskBankAccountNumber(rawNum),
        bank_account_number_formatted: formatBankAccountNumber(rawNum),
        total_sales:    Math.round(Number(r.total_sales    || 0)),
        fee_amount:     Math.round(Number(r.fee_amount     || 0)),
        net_amount:     Math.round(Number(r.net_amount     || 0)),
        shipping_total: Math.round(Number(r.shipping_total || 0)),
        payable_total_sales: Math.round(Number(r.payable_total_sales || 0)),
        payable_fee_amount:  Math.round(Number(r.payable_fee_amount  || 0)),
        payable_amount:      Math.round(Number(r.payable_amount      || 0)),
        payable_shipping_total: Math.round(Number(r.payable_shipping_total || 0)),
        ready_count: Number(r.ready_count || 0),
        overdue_count: Number(r.overdue_count || 0),
        cycle_pending_count: Number(r.cycle_pending_count || 0),
        cycle_pending_amount: Math.round(Number(r.cycle_pending_amount || 0)),
        payout_stage: r.payout_stage || "cycle",
        first_cycle_month: r.first_cycle_month || "",
        payout_cycle_months: r.payout_cycle_months || "",
        order_count:    Number(r.order_count || 0),
      };
    }),
    history: (historyRows || []).map(r => {
      const rawNum = decryptBankAccountNumber(r.bank_account_number_enc);
      return {
        ...r,
        bank_account_number:           rawNum,
        bank_account_number_masked:    maskBankAccountNumber(rawNum),
        bank_account_number_formatted: formatBankAccountNumber(rawNum),
        bank_account_name:             r.bank_account_name || "",
        bank_code:                     r.bank_code || "",
        paid_at:                       r.completed_at,   // alias สำหรับ frontend
        net_amount:  Math.round(Number(r.net_amount  || 0)),
        fee_amount:  Math.round(Number(r.fee_amount  || 0)),
        order_count: Number(r.order_count || 0),
      };
    }),
    total_pages: Math.max(1, Math.ceil(Number(histCountRow?.c || 0) / historySafeLimit)),
    pending_total_pages: Math.max(1, Math.ceil(Number(countRow?.c || 0) / pendingSafeLimit)),
    payout_cycle: (() => {
      const now = new Date();
      // วันสุดท้ายของเดือนนี้ (cutoff)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 0);
      // วันโอนเงิน = cutoff + 7 วัน
      const payoutDeadline = new Date(lastDay);
      payoutDeadline.setDate(lastDay.getDate() + 7);
      const fmt = (d) => d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
      return {
        cutoff_date: fmt(lastDay),
        payout_date: fmt(payoutDeadline),
        note: "ตัดรอบทุกสิ้นเดือน เฉพาะรายการที่ลูกค้ายืนยันรับของแล้ว โอนเงินภายใน 7 วันทำการหลังสิ้นเดือน",
      };
    })(),
  };
}

export async function paySeller(seller_id, net_amount) {
  if (!seller_id || !net_amount) {
    throw Object.assign(new Error("ข้อมูลไม่ครบ"), { status: 400 });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[seller]] = await conn.query(
      `SELECT bank_code, bank_account_number, bank_account_name FROM users WHERE user_id = ? LIMIT 1`,
      [seller_id]
    );
    const bankNum = sanitizeBankNumber(decryptBankAccountNumber(seller?.bank_account_number));
    if (!seller?.bank_code || !bankNum || !seller?.bank_account_name) {
      throw Object.assign(new Error("ผู้ขายยังไม่ได้ตั้งค่าบัญชีรับเงินให้ครบถ้วน"), { status: 400 });
    }
    if (!isValidBankNumber(bankNum)) {
      throw Object.assign(new Error("เลขบัญชีผู้ขายไม่ถูกต้อง"), { status: 400 });
    }

    // 1) สรุปยอดผู้ขายก่อน mark เฉพาะรายการที่ผ่านรอบสิ้นเดือนแล้ว
    const eligibleSql = pendingPayoutOrderSelect(`
      AND COALESCE(o.seller_id, seller_map.seller_id) = ?
      AND NOW() > TIMESTAMP(LAST_DAY(COALESCE(o.completed_at, o.created_at)), '23:59:59')
    `);
    const [eligibleOrders] = await conn.query(
      `SELECT order_id, net_amount, fee_amount FROM (${eligibleSql}) po`,
      [seller_id]
    );
    const sum = {
      order_count: eligibleOrders.length,
      net_total: eligibleOrders.reduce((acc, r) => acc + Number(r.net_amount || 0), 0),
      fee_total: eligibleOrders.reduce((acc, r) => acc + Number(r.fee_amount || 0), 0),
    };
    if (Number(sum.order_count) === 0) {
      throw Object.assign(new Error("ไม่มีออเดอร์ที่ผ่านรอบรอโอน"), { status: 400 });
    }

    // 2) บันทึก payout ด้วยเวลาไทย
    const nowThai = thaiNow();
    const [ins] = await conn.query(
      `INSERT INTO payouts (seller_id, net_amount, fee_amount, order_count, status, created_at, completed_at)
       VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
      [seller_id, Math.round(Number(sum.net_total)), Math.round(Number(sum.fee_total)), sum.order_count, nowThai, nowThai]
    );
    const payoutId = ins.insertId;

    // 3) อัปเดต orders -> payout_status='paid' + ผูก payout_id
    const orderIds = eligibleOrders.map((r) => r.order_id);
    const placeholders = orderIds.map(() => "?").join(",");
    await conn.query(
      `UPDATE orders
          SET payout_status='paid', payout_id=?, payout_date=?
        WHERE order_id IN (${placeholders})`,
      [payoutId, nowThai, ...orderIds]
    );

    await conn.commit();

    // 4) แจ้งเตือนผู้ขาย
    const netAmount = Math.round(Number(sum.net_total));
    try {
      await sendNotification(seller_id, {
        type:   "payout_completed",
        title:  "โอนเงินเข้าบัญชีแล้ว",
        body:   `ยอดโอน ฿${netAmount.toLocaleString()} (${Number(sum.order_count)} รายการ) ได้รับการโอนเข้าบัญชีของคุณแล้ว`,
        ref_id: payoutId,
      });
    } catch (e) { console.warn("[notify] paySeller:", e.message); }

    return { message: "Paid", seller_id, payout_id: payoutId, net_amount: netAmount };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

/* ────── Demand Insight ────── */

// แผนที่จังหวัด → ภาค (77 จังหวัด)
const PROVINCE_REGION = {
  // ภาคเหนือ
  "เชียงใหม่":"เหนือ","เชียงราย":"เหนือ","ลำปาง":"เหนือ","ลำพูน":"เหนือ","แม่ฮ่องสอน":"เหนือ",
  "น่าน":"เหนือ","พะเยา":"เหนือ","แพร่":"เหนือ","อุตรดิตถ์":"เหนือ","ตาก":"เหนือ",
  "สุโขทัย":"เหนือ","พิษณุโลก":"เหนือ","พิจิตร":"เหนือ","กำแพงเพชร":"เหนือ","เพชรบูรณ์":"เหนือ",
  "นครสวรรค์":"เหนือ","อุทัยธานี":"เหนือ",
  // ภาคตะวันออกเฉียงเหนือ (อีสาน)
  "นครราชสีมา":"อีสาน","บึงกาฬ":"อีสาน","บุรีรัมย์":"อีสาน","ชัยภูมิ":"อีสาน",
  "อำนาจเจริญ":"อีสาน","อุดรธานี":"อีสาน","อุบลราชธานี":"อีสาน","ยโสธร":"อีสาน",
  "ศรีสะเกษ":"อีสาน","สกลนคร":"อีสาน","สุรินทร์":"อีสาน","หนองบัวลำภู":"อีสาน",
  "หนองคาย":"อีสาน","มหาสารคาม":"อีสาน","มุกดาหาร":"อีสาน","กาฬสินธุ์":"อีสาน",
  "ขอนแก่น":"อีสาน","เลย":"อีสาน","ร้อยเอ็ด":"อีสาน","นครพนม":"อีสาน",
  // ภาคกลาง
  "กรุงเทพมหานคร":"กลาง","กรุงเทพฯ":"กลาง","นนทบุรี":"กลาง","ปทุมธานี":"กลาง",
  "สมุทรปราการ":"กลาง","สมุทรสาคร":"กลาง","สมุทรสงคราม":"กลาง","นครปฐม":"กลาง",
  "พระนครศรีอยุธยา":"กลาง","อ่างทอง":"กลาง","สิงห์บุรี":"กลาง","ชัยนาท":"กลาง",
  "ลพบุรี":"กลาง","สระบุรี":"กลาง","นครนายก":"กลาง","สุพรรณบุรี":"กลาง",
  // ภาคตะวันออก
  "ชลบุรี":"ตะวันออก","ระยอง":"ตะวันออก","จันทบุรี":"ตะวันออก","ตราด":"ตะวันออก",
  "ฉะเชิงเทรา":"ตะวันออก","ปราจีนบุรี":"ตะวันออก","สระแก้ว":"ตะวันออก",
  // ภาคตะวันตก
  "กาญจนบุรี":"ตะวันตก","ราชบุรี":"ตะวันตก","เพชรบุรี":"ตะวันตก","ประจวบคีรีขันธ์":"ตะวันตก",
  // ภาคใต้
  "สุราษฎร์ธานี":"ใต้","นครศรีธรรมราช":"ใต้","กระบี่":"ใต้","พังงา":"ใต้","ภูเก็ต":"ใต้",
  "ตรัง":"ใต้","พัทลุง":"ใต้","ระนอง":"ใต้","ชุมพร":"ใต้","สงขลา":"ใต้",
  "สตูล":"ใต้","ปัตตานี":"ใต้","ยะลา":"ใต้","นราธิวาส":"ใต้",
};

/**
 * วิเคราะห์ความต้องการชุดนักเรียนจากโครงการที่ยังเปิดอยู่
 * - top3_types     : 3 อันดับประเภทชุดที่ยังขาดมากสุด พร้อมไซส์และระดับชั้น
 * - province_demand: จังหวัด/ภาคที่ต้องการมากที่สุด (top 10)
 * - completed_stats: สถิติโครงการที่สำเร็จแล้ว
 */
export async function getDemandInsight() {
  const CATEGORY_LABEL = { 1:"เสื้อนักเรียน", 2:"กางเกงนักเรียน", 3:"กระโปรงนักเรียน", 4:"อื่นๆ" };
  const GENDER_LABEL   = { male:"ชาย", female:"หญิง" };
  const [[openRowForSummary]] = await db.query(
    `SELECT COUNT(*) AS c FROM donation_request
     WHERE status = 'open' AND (start_date IS NULL OR start_date <= CURDATE())`
  ).catch(() => [[{ c: 0 }]]);

  // ── 1) Top 3 ประเภทชุดที่ยังขาดมากสุด ──────────────────────────────────
  const [typeRows] = await db.query(`
    SELECT
      ut.uniform_type_id,
      ut.type_name,
      ut.gender,
      ut.uniform_category,
      ci.category_id,
      ci.category_name,
      SUM(sn.quantity_needed)                                          AS total_needed,
      COALESCE(SUM(sn.quantity_received), 0)                           AS total_received,
      SUM(sn.quantity_needed) - COALESCE(SUM(sn.quantity_received), 0) AS still_needed
    FROM student_need sn
    JOIN students         st ON st.student_id      = sn.student_id
    JOIN donation_request dr ON dr.request_id      = st.request_id
    JOIN uniform_type     ut ON ut.uniform_type_id = sn.uniform_type_id
    LEFT JOIN category_item ci ON ci.category_id   = ut.category_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
    GROUP BY ut.uniform_type_id, ut.type_name, ut.gender,
             ut.uniform_category, ci.category_id, ci.category_name
    HAVING still_needed > 0
    ORDER BY still_needed DESC
    LIMIT 3
  `).catch(() => [[]]);

  const top3 = (typeRows || []).map((r, idx) => ({
    rank:            idx + 1,
    uniform_type_id: r.uniform_type_id,
    type_name:       r.type_name   || "ไม่ระบุ",
    gender:          r.gender      || null,
    gender_label:    GENDER_LABEL[r.gender] || "",
    category_id:     r.category_id || null,
    category_name:   r.category_name || CATEGORY_LABEL[r.uniform_category] || "อื่นๆ",
    total_needed:    Number(r.total_needed   || 0),
    total_received:  Number(r.total_received || 0),
    still_needed:    Number(r.still_needed   || 0),
  }));

  if (!top3.length) {
    // ยังคง query completed stats แม้ไม่มี top3
    const [[cr]] = await db.query(
      `SELECT COUNT(*) AS closed_projects, COUNT(DISTINCT school_id) AS school_count
       FROM donation_request WHERE status IN ('closed','archived')`
    ).catch(() => [[{ closed_projects: 0, school_count: 0 }]]);
    const [[cu]] = await db.query(
      `SELECT COALESCE(SUM(f.quantity_fulfilled),0) AS total_uniforms
       FROM fulfillment f JOIN donation_request dr ON dr.request_id=f.request_id
       WHERE dr.status IN ('closed','archived')`
    ).catch(() => [[{ total_uniforms: 0 }]]);
    const [[cs]] = await db.query(
      `SELECT COUNT(DISTINCT sn.student_id) AS students_helped
       FROM fulfillment f
       JOIN student_need sn ON sn.student_need_id=f.request_item_id
       JOIN donation_request dr ON dr.request_id=f.request_id
       WHERE dr.status IN ('closed','archived') AND f.quantity_fulfilled>0`
    ).catch(() => [[{ students_helped: 0 }]]);
    return {
      top3_types: [],
      province_demand: [],
      region_demand: [],
      completed_stats: {
        closed_projects: Number(cr?.closed_projects || 0),
        school_count:    Number(cr?.school_count    || 0),
        total_uniforms:  Number(cu?.total_uniforms  || 0),
        students_helped: Number(cs?.students_helped || 0),
      },
      open_projects: Number(openRowForSummary?.c || 0),
    };
  }

  const typeIds      = top3.map(t => t.uniform_type_id);
  const placeholders = typeIds.map(() => "?").join(", ");

  // ── 2) ไซส์ที่ขาดมากสุดของแต่ละ type ──────────────────────────────────
  const [sizeRows] = await db.query(`
    SELECT
      sn.uniform_type_id,
      JSON_UNQUOTE(JSON_EXTRACT(sn.size, '$.chest')) AS chest,
      JSON_UNQUOTE(JSON_EXTRACT(sn.size, '$.waist')) AS waist,
      SUM(sn.quantity_needed - COALESCE(sn.quantity_received, 0)) AS cnt
    FROM student_need sn
    JOIN students         st ON st.student_id  = sn.student_id
    JOIN donation_request dr ON dr.request_id  = st.request_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND sn.uniform_type_id IN (${placeholders})
      AND sn.quantity_needed > COALESCE(sn.quantity_received, 0)
    GROUP BY sn.uniform_type_id, chest, waist
    ORDER BY sn.uniform_type_id, cnt DESC
  `, typeIds).catch(() => [[]]);

  const sizeMap = {};
  for (const r of (sizeRows || [])) {
    const tid = r.uniform_type_id;
    if (!sizeMap[tid]) sizeMap[tid] = [];
    if (sizeMap[tid].length < 3) {
      sizeMap[tid].push({
        chest: r.chest && r.chest !== "null" ? r.chest : null,
        waist: r.waist && r.waist !== "null" ? r.waist : null,
        count: Number(r.cnt || 0),
      });
    }
  }

  // ── 3) ระดับชั้นที่ขาดมากสุดของแต่ละ type ──────────────────────────────
  const [levelRows] = await db.query(`
    SELECT
      sn.uniform_type_id,
      st.education_level_group                                           AS level,
      SUM(sn.quantity_needed - COALESCE(sn.quantity_received, 0))       AS cnt
    FROM student_need sn
    JOIN students         st ON st.student_id  = sn.student_id
    JOIN donation_request dr ON dr.request_id  = st.request_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND sn.uniform_type_id IN (${placeholders})
      AND sn.quantity_needed > COALESCE(sn.quantity_received, 0)
    GROUP BY sn.uniform_type_id, st.education_level_group
    ORDER BY sn.uniform_type_id, cnt DESC
  `, typeIds).catch(() => [[]]);

  const levelMap = {};
  for (const r of (levelRows || [])) {
    const tid = r.uniform_type_id;
    if (!levelMap[tid]) levelMap[tid] = [];
    levelMap[tid].push({ level: r.level || "ไม่ระบุ", count: Number(r.cnt || 0) });
  }

  // ── 4) จังหวัด/ภาค ที่ต้องการมากที่สุด (top 10 จังหวัด) ─────────────────
  const [provRows] = await db.query(`
    SELECT
      s.province,
      SUM(sn.quantity_needed - COALESCE(sn.quantity_received, 0)) AS still_needed
    FROM student_need sn
    JOIN students         st ON st.student_id  = sn.student_id
    JOIN donation_request dr ON dr.request_id  = st.request_id
    JOIN schools           s ON s.school_id    = dr.school_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND sn.quantity_needed > COALESCE(sn.quantity_received, 0)
      AND s.province IS NOT NULL AND s.province != ''
    GROUP BY s.province
    ORDER BY still_needed DESC
    LIMIT 10
  `).catch(() => [[]]);

  const maxProv = Number((provRows || [])[0]?.still_needed || 1);
  const topProvinces = (provRows || []).map(r => r.province).filter(Boolean);

  // ── 4b) top items ต่อจังหวัด (top 3 ประเภทชุดที่ขาดมากสุดในแต่ละจังหวัด) ──
  let provinceItemMap = {};
  if (topProvinces.length > 0) {
    const provPlaceholders = topProvinces.map(() => "?").join(", ");
    const [provItemRows] = await db.query(`
      SELECT
        s.province,
        ut.type_name,
        ci.category_name,
        ut.gender,
        SUM(sn.quantity_needed - COALESCE(sn.quantity_received, 0)) AS still_needed
      FROM student_need sn
      JOIN students         st ON st.student_id  = sn.student_id
      JOIN donation_request dr ON dr.request_id  = st.request_id
      JOIN schools           s ON s.school_id    = dr.school_id
      JOIN uniform_type     ut ON ut.uniform_type_id = sn.uniform_type_id
      LEFT JOIN category_item ci ON ci.category_id = ut.category_id
      WHERE dr.status = 'open'
        AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
        AND sn.quantity_needed > COALESCE(sn.quantity_received, 0)
        AND s.province IN (${provPlaceholders})
      GROUP BY s.province, ut.uniform_type_id, ut.type_name, ci.category_name, ut.gender
      ORDER BY s.province, still_needed DESC
    `, topProvinces).catch(() => [[]]);

    for (const r of (provItemRows || [])) {
      if (!provinceItemMap[r.province]) provinceItemMap[r.province] = [];
      if (provinceItemMap[r.province].length < 3) {
        const GENDER_LABEL = { male: "ชาย", female: "หญิง" };
        const label = r.gender ? `${r.type_name} (${GENDER_LABEL[r.gender] || r.gender})` : r.type_name;
        provinceItemMap[r.province].push({
          type_name:     r.type_name   || "ไม่ระบุ",
          category_name: r.category_name || "อื่นๆ",
          gender:        r.gender || null,
          label,
          still_needed:  Number(r.still_needed || 0),
        });
      }
    }
  }

  const province_demand = (provRows || []).map(r => ({
    province:     r.province,
    region:       PROVINCE_REGION[r.province] || "อื่นๆ",
    still_needed: Number(r.still_needed || 0),
    pct:          Math.round((Number(r.still_needed || 0) / maxProv) * 100),
    top_items:    provinceItemMap[r.province] || [],
  }));

  // สรุปตามภาค
  const regionTotals = {};
  for (const p of province_demand) {
    regionTotals[p.region] = (regionTotals[p.region] || 0) + p.still_needed;
  }
  const maxRegion = Math.max(1, ...Object.values(regionTotals));
  const region_demand = Object.entries(regionTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([region, total]) => ({
      region,
      still_needed: total,
      pct: Math.round((total / maxRegion) * 100),
    }));

  // ── 6) สถิติโครงการที่สำเร็จแล้ว (closed + archived) ─────────────────
  const [[closedRow]] = await db.query(`
    SELECT
      COUNT(*)                     AS closed_projects,
      COUNT(DISTINCT dr.school_id) AS school_count
    FROM donation_request dr
    WHERE dr.status IN ('closed', 'archived')
  `).catch(() => [[{ closed_projects: 0, school_count: 0 }]]);

  // ยอดชุดที่ส่งมอบจริง — ใช้ตาราง fulfillment (quantity_fulfilled) ซึ่งบันทึกตอนโรงเรียนยืนยัน
  const [[closedUniform]] = await db.query(`
    SELECT COALESCE(SUM(f.quantity_fulfilled), 0) AS total_uniforms
    FROM fulfillment f
    JOIN donation_request dr ON dr.request_id = f.request_id
    WHERE dr.status IN ('closed', 'archived')
  `).catch(() => [[{ total_uniforms: 0 }]]);

  // ยอดนักเรียนที่ได้รับชุดจริง — ดึงจาก fulfillment → student_need → students
  const [[closedStudents]] = await db.query(`
    SELECT COUNT(DISTINCT sn.student_id) AS students_helped
    FROM fulfillment f
    JOIN student_need     sn ON sn.student_need_id = f.request_item_id
    JOIN donation_request dr ON dr.request_id      = f.request_id
    WHERE dr.status IN ('closed', 'archived')
      AND f.quantity_fulfilled > 0
  `).catch(() => [[{ students_helped: 0 }]]);

  return {
    top3_types: top3.map(t => ({
      ...t,
      top_sizes:  sizeMap[t.uniform_type_id]  || [],
      levels:     levelMap[t.uniform_type_id] || [],
    })),
    province_demand,
    region_demand,
    open_projects: Number(openRowForSummary?.c || 0),
    completed_stats: {
      closed_projects:  Number(closedRow?.closed_projects  || 0),
      school_count:     Number(closedRow?.school_count     || 0),
      total_uniforms:   Number(closedUniform?.total_uniforms || 0),
      students_helped:  Number(closedStudents?.students_helped || 0),
    },
  };
}

export async function listProjectStatusProjects({ status = "open", limit = 200 } = {}) {
  const normalized = String(status || "open").toLowerCase();
  const statusWhere = {
    open: "dr.status = 'open' AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())",
    closed: "dr.status IN ('closed', 'archived')",
  };
  if (!statusWhere[normalized]) {
    throw Object.assign(new Error("สถานะโครงการไม่ถูกต้อง"), { status: 400 });
  }

  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));

  const [[counts]] = await db.query(`
    SELECT
      COUNT(CASE WHEN status = 'open' AND (start_date IS NULL OR start_date <= CURDATE()) THEN 1 END) AS open_projects,
      COUNT(CASE WHEN status IN ('closed', 'archived') THEN 1 END) AS closed_projects
    FROM donation_request
  `);

  const orderSql = normalized === "open"
    ? "dr.created_at DESC"
    : "COALESCE(dr.end_date, dr.created_at) DESC";

  const [rows] = await db.query(`
    SELECT
      dr.request_id,
      dr.school_id,
      dr.request_title,
      dr.request_description,
      dr.request_image_url,
      dr.status,
      dr.created_at,
      dr.start_date,
      dr.end_date,
      s.school_name,
      s.school_address,
      s.province AS school_province,
      COALESCE((
        SELECT COUNT(*)
        FROM students st
        WHERE st.request_id = dr.request_id
      ), 0) AS student_count,
      COALESCE((
        SELECT SUM(sn.quantity_needed)
        FROM student_need sn
        JOIN students st ON st.student_id = sn.student_id
        WHERE st.request_id = dr.request_id
      ), 0) AS total_needed,
      COALESCE((
        SELECT SUM(don.quantity)
        FROM donation_record don
        WHERE don.request_id = dr.request_id
          AND don.status != 'rejected'
      ), 0) AS total_donated,
      COALESCE((
        SELECT SUM(f.quantity_fulfilled)
        FROM fulfillment f
        WHERE f.request_id = dr.request_id
      ), 0) AS total_fulfilled
    FROM donation_request dr
    LEFT JOIN schools s ON s.school_id = dr.school_id
    WHERE ${statusWhere[normalized]}
    ORDER BY ${orderSql}
    LIMIT ?
  `, [safeLimit]);

  return {
    status: normalized,
    counts: {
      open_projects:   Number(counts?.open_projects || 0),
      closed_projects: Number(counts?.closed_projects || 0),
    },
    rows: (rows || []).map((r) => ({
      ...r,
      student_count:   Number(r.student_count || 0),
      total_needed:    Number(r.total_needed || 0),
      total_donated:   Number(r.total_donated || 0),
      total_fulfilled: Number(r.total_fulfilled || 0),
    })),
  };
}

export async function getDonorProfile(userId) {
  const [[user]] = await db.query(
    `SELECT user_id, user_name, user_email, created_at, strike_count, suspended_until
     FROM users WHERE user_id = ?`,
    [userId]
  );
  if (!user) return null;

  const [donations] = await db.query(
    `SELECT
       dr.donation_id, dr.status, dr.condition_status,
       dr.delivery_method, dr.quantity, dr.created_at, dr.updated_at,
       req.request_title, s.school_name
     FROM donation_record dr
     JOIN donation_request req ON req.request_id = dr.request_id
     JOIN schools s ON s.school_id = req.school_id
     WHERE dr.donor_id = ?
     ORDER BY dr.created_at DESC`,
    [userId]
  );

  const total      = donations.length;
  const approved   = donations.filter(d => d.status === "approved" && d.condition_status === "usable").length;
  const wrongItem  = donations.filter(d => d.condition_status === "wrong_item").length;
  const pending    = donations.filter(d => d.status === "pending").length;
  const rejected   = donations.filter(d => d.status === "rejected").length;

  return {
    user_id:        user.user_id,
    user_name:      user.user_name,
    email:          user.user_email,
    joined_at:      user.created_at,
    strike_count:   user.strike_count,
    suspended_until: user.suspended_until,
    stats: { total, approved, wrongItem, pending, rejected },
    donations,
  };
}

export async function getDonorSuspensionHistory(userId) {
  const [rows] = await db.query(
    `SELECT type, title, body, created_at
     FROM notifications
     WHERE user_id = ? AND type IN ('suspension', 'strike_reset', 'strike_appeal')
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows.map(r => ({
    type: r.type,
    title: r.title,
    body: (() => { try { return JSON.parse(r.body); } catch { return {}; } })(),
    created_at: r.created_at,
  }));
}

export async function payAllSellers() {
  const eligibleSql = pendingPayoutOrderSelect(`
    AND NOW() > TIMESTAMP(LAST_DAY(COALESCE(o.completed_at, o.created_at)), '23:59:59')
  `);
  const [sellers] = await db.query(`
    SELECT
      seller_id,
      COUNT(*) AS order_count,
      COALESCE(SUM(net_amount), 0) AS net_amount,
      COALESCE(SUM(fee_amount), 0) AS fee_amount,
      GROUP_CONCAT(order_id ORDER BY order_id SEPARATOR ',') AS order_ids
    FROM (${eligibleSql}) po
    GROUP BY seller_id
  `).catch(() => [[]]);

  if (!sellers.length) return { message: "No pending payouts", count: 0 };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let paidCount = 0;
    for (const s of sellers) {
      const [[seller]] = await conn.query(
        `SELECT bank_code, bank_account_number, bank_account_name FROM users WHERE user_id = ? LIMIT 1`,
        [s.seller_id]
      );
      const bankNum = sanitizeBankNumber(decryptBankAccountNumber(seller?.bank_account_number));
      if (!seller?.bank_code || !bankNum || !seller?.bank_account_name || !isValidBankNumber(bankNum)) {
        continue;
      }

      const nowThai = thaiNow();
      const [ins] = await conn.query(
        `INSERT INTO payouts (seller_id, net_amount, fee_amount, order_count, status, created_at, completed_at)
         VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
        [s.seller_id, Math.round(Number(s.net_amount)), Math.round(Number(s.fee_amount)), Number(s.order_count), nowThai, nowThai]
      );
      const orderIds = String(s.order_ids || "")
        .split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
      if (!orderIds.length) continue;
      const placeholders = orderIds.map(() => "?").join(",");
      await conn.query(
        `UPDATE orders
            SET payout_status='paid', payout_id=?, payout_date=?
          WHERE order_id IN (${placeholders})`,
        [ins.insertId, nowThai, ...orderIds]
      );
      // แจ้งเตือนผู้ขาย (non-blocking)
      sendNotification(s.seller_id, {
        type:   "payout_completed",
        title:  "โอนเงินเข้าบัญชีแล้ว",
        body:   `ยอดโอน ฿${Math.round(Number(s.net_amount)).toLocaleString()} (${Number(s.order_count)} รายการ) ได้รับการโอนเข้าบัญชีของคุณแล้ว`,
        ref_id: ins.insertId,
      }).catch(e => console.warn("[notify] payAllSellers:", e.message));
      paidCount += 1;
    }
    await conn.commit();
    return { message: "All paid", count: paidCount };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
