import { db } from "../../config/db.js";
import {
  decryptBankAccountNumber,
  formatBankAccountNumber,
  isValidBankNumber,
  maskBankAccountNumber,
  sanitizeBankNumber,
} from "../../utils/bankAccountSecurity.js";

/* ────── helpers ────── */

function normalizeThaiPhone(input) {
  if (!input) return null;
  let raw = String(input).replace(/\D/g, "");
  if (!raw) return null;
  if (raw.startsWith("66") && raw.length === 11) raw = "0" + raw.slice(2);
  if (raw.length === 9) raw = "0" + raw;
  return raw;
}

function periodToDateRange(period) {
  const now = new Date();
  let from;
  if (period === "week") {
    from = new Date(now); from.setDate(now.getDate() - 7);
  } else if (period === "month") {
    from = new Date(now); from.setMonth(now.getMonth() - 1);
  } else {
    from = new Date(now); from.setFullYear(now.getFullYear() - 1);
  }
  return { from: from.toISOString().slice(0, 19), to: now.toISOString().slice(0, 19) };
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
    LEFT JOIN users u ON u.school_id = s.school_id AND u.role = 'school_admin'
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
    LEFT JOIN users u ON u.school_id = s.school_id AND u.role = 'school_admin'
    WHERE s.school_id = ? LIMIT 1
  `, [id]);
  if (!rows.length) throw Object.assign(new Error("ไม่พบโรงเรียน"), { status: 404 });
  return rows[0];
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
 * - fee_revenue      = ค่าธรรมเนียม (15% หรือขั้นต่ำ 20 บาท) ที่แพลตฟอร์มได้
 * - fee_min_revenue  = ส่วนที่เป็น "ขั้นต่ำ 20 บาท" (สินค้าราคา < 100 บาท)
 * - net_revenue      = รายได้สุทธิหลังหักค่าธรรมเนียม (= ยอดที่ผู้ขายควรได้รวมกัน)
 */
export async function getRevenueStats(period = "week") {
  const { from, to } = periodToDateRange(period);

  // คำนวณ "ช่วงก่อนหน้า" ที่ยาวเท่ากัน สำหรับ % เปลี่ยนแปลง
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const diffMs   = toDate - fromDate;
  const prevTo   = new Date(fromDate - 1).toISOString().slice(0, 19);
  const prevFrom = new Date(fromDate - diffMs - 1).toISOString().slice(0, 19);

  // Query รายได้ + แยกประเภทค่าธรรมเนียม
  // fee_15_revenue  = ค่าธรรมเนียม 15% (orders ที่ item_subtotal >= 100 บาท)
  // fee_min_revenue = ค่าธรรมเนียมขั้นต่ำ 20 บาท (orders ที่ item_subtotal < 100 บาท → fee = 20 flat)
  const revenueQuery = `
    SELECT
      COALESCE(SUM(o.total_price), 0)           AS platform_revenue,
      COALESCE(SUM(o.platform_fee), 0)          AS fee_revenue,
      COALESCE(SUM(o.seller_payout_amount), 0)  AS net_revenue,
      COUNT(*)                                  AS fee_count,
      -- ค่าธรรมเนียม 15% (สินค้ารวม >= 100 บาท)
      COALESCE(SUM(
        CASE WHEN COALESCE(items_sub.subtotal, 0) >= 100 THEN o.platform_fee ELSE 0 END
      ), 0) AS fee_15_revenue,
      -- ค่าธรรมเนียมขั้นต่ำ 20 บาท (สินค้ารวม < 100 บาท)
      COALESCE(SUM(
        CASE WHEN COALESCE(items_sub.subtotal, 0) < 100 AND o.platform_fee > 0 THEN o.platform_fee ELSE 0 END
      ), 0) AS fee_min_revenue,
      COUNT(CASE WHEN COALESCE(items_sub.subtotal, 0) >= 100 THEN 1 END) AS fee_15_count,
      COUNT(CASE WHEN COALESCE(items_sub.subtotal, 0) < 100 AND o.platform_fee > 0 THEN 1 END) AS fee_min_count
    FROM orders o
    LEFT JOIN (
      SELECT order_id,
             SUM(price_at_purchase * quantity) AS subtotal
      FROM order_items
      GROUP BY order_id
    ) items_sub ON items_sub.order_id = o.order_id
    WHERE o.payment_status = 'paid'
      AND o.created_at BETWEEN ? AND ?
  `;

  const [[revenueRow]] = await db.query(revenueQuery, [from, to]);
  const [[prevRow]]    = await db.query(revenueQuery, [prevFrom, prevTo]);

  return {
    platform_revenue:     Math.round(Number(revenueRow?.platform_revenue || 0)),
    fee_revenue:          Math.round(Number(revenueRow?.fee_revenue      || 0)),
    fee_15_revenue:       Math.round(Number(revenueRow?.fee_15_revenue   || 0)),
    fee_min_revenue:      Math.round(Number(revenueRow?.fee_min_revenue  || 0)),
    fee_15_count:         Number(revenueRow?.fee_15_count  || 0),
    fee_min_count:        Number(revenueRow?.fee_min_count || 0),
    net_revenue:          Math.round(Number(revenueRow?.net_revenue      || 0)),
    fee_count:            Number(revenueRow?.fee_count || 0),
    pct_platform_revenue: pctChange(
      Number(revenueRow?.platform_revenue || 0),
      Number(prevRow?.platform_revenue    || 0)
    ),
    pct_fee_15:           pctChange(
      Number(revenueRow?.fee_15_revenue || 0),
      Number(prevRow?.fee_15_revenue    || 0)
    ),
    pct_fee_min:          pctChange(
      Number(revenueRow?.fee_min_revenue || 0),
      Number(prevRow?.fee_min_revenue    || 0)
    ),
  };
}

/**
 * ข้อมูลกราฟ "ยอดขายรวม vs ค่าธรรมเนียม" ย้อนหลัง N เดือน
 * - กรองด้วย payment_status = 'paid' (ครอบคลุม confirmed/shipping/delivered)
 *   ไม่ filter เฉพาะ delivered เพื่อให้ chart มีข้อมูลทันทีหลัง buyer จ่ายเงิน
 * - ใช้ 1 query เดียวต่อ N เดือน (เร็วกว่า loop)
 */
export async function getChartData(months = 6) {
  const N = Math.max(1, Math.min(24, Number(months) || 6));

  const [rows] = await db.query(`
    SELECT
      DATE_FORMAT(o.created_at, '%Y-%m')              AS ym,
      COALESCE(SUM(o.total_price), 0)                 AS sales,
      COALESCE(SUM(o.platform_fee), 0)                AS fees
    FROM orders o
    WHERE o.payment_status = 'paid'
      AND o.created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m-01')
    GROUP BY ym
  `, [N - 1]);

  // map ปี-เดือน -> {sales, fees}
  const byYm = Object.fromEntries(rows.map(r => [r.ym, r]));

  // เติมเดือนที่ไม่มีข้อมูลให้เป็น 0 (เพื่อให้ chart ลากเส้นเรียงต่อกัน N จุด)
  const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const labels = [];
  const salesArr = [];
  const feesArr  = [];
  const now = new Date();
  for (let i = N - 1; i >= 0; i--) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const r  = byYm[ym] || { sales: 0, fees: 0 };
    labels.push(MONTHS[d.getMonth()]);
    salesArr.push(Math.round(Number(r.sales || 0)));
    feesArr.push(Math.round(Number(r.fees  || 0)));
  }

  // Donation status (donation_request)
  const [[donOpen]] = await db.query(`SELECT COUNT(*) AS c FROM donation_request WHERE status='open'`)
    .catch(() => [[{ c: 0 }]]);
  const [[donAll]]  = await db.query(`SELECT COUNT(*) AS c FROM donation_request`)
    .catch(() => [[{ c: 0 }]]);
  const openPct = Number(donAll?.c) > 0 ? Math.round((Number(donOpen.c) / Number(donAll.c)) * 100) : 0;

  return {
    months:            labels,
    sales:             salesArr,
    fees:              feesArr,
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

export async function listOrders({ status = "", q = "", page = 1, limit = 10, seller_id = "" } = {}) {
  const where = []; const params = [];
  if (status && ["pending", "confirmed", "shipping", "delivered", "cancelled"].includes(status)) {
    where.push("o.order_status = ?"); params.push(status);
  }
  if (q) {
    where.push("(buyer.user_name LIKE ? OR seller.user_name LIKE ? OR p.product_title LIKE ?)");
    const like = `%${q}%`; params.push(like, like, like);
  }
  if (seller_id) {
    where.push("o.seller_id = ?"); params.push(Number(seller_id));
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
      buyer.user_name  AS buyer_name,
      buyer.user_phone AS buyer_phone,
      seller.user_name AS seller_name
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
    LEFT JOIN users  seller  ON seller.user_id = seller_map.seller_id
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
    LEFT JOIN users  seller  ON seller.user_id = o.seller_id
    ${whereSql}
  `, params);

  // ── Stats ───────────────────────────────────────────────────────
  const [[stats]] = await db.query(`
    SELECT
      COUNT(*)                                              AS total,
      SUM(order_status = 'pending')                         AS pending,
      SUM(order_status IN ('confirmed','shipping'))         AS shipping,
      SUM(order_status = 'delivered')                       AS delivered,
      SUM(order_status = 'cancelled')                       AS cancelled
    FROM orders
  `);

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
      const calculatedFee = itemsSubtotal >= 100
        ? Math.round(itemsSubtotal * 0.15 * 100) / 100
        : (itemsSubtotal > 0 ? 20 : 0);
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
  const calculatedFee = itemsSubtotal >= 100
    ? Math.round(itemsSubtotal * 0.15 * 100) / 100
    : (itemsSubtotal > 0 ? 20 : 0);

  return {
    ...order,
    items,
    shipping,
    items_subtotal: Math.round(itemsSubtotal),
    calculated_fee: Math.round(calculatedFee),
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
export async function listPayouts({ period = "week", page = 1, limit = 10 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const safePage  = Math.max(1, Number(page) || 1);
  const offset    = (safePage - 1) * safeLimit;

  // ผู้ขายที่มีออเดอร์ delivered + ยังไม่ได้จ่าย
  const [pendingRows] = await db.query(`
    SELECT
      u.user_id                                      AS seller_id,
      u.user_name                                    AS seller_name,
      u.bank_account_number,
      u.bank_account_name,
      u.bank_code,
      COUNT(o.order_id)                              AS order_count,
      COALESCE(SUM(o.total_price), 0)                AS total_sales,
      COALESCE(SUM(o.platform_fee), 0)               AS fee_amount,
      COALESCE(SUM(o.seller_payout_amount), 0)       AS net_amount
    FROM orders o
    LEFT JOIN users u ON u.user_id = o.seller_id
    WHERE o.order_status  = 'delivered'
      AND o.payout_status = 'pending'
    GROUP BY u.user_id, u.user_name, u.bank_account_number, u.bank_account_name, u.bank_code
    ORDER BY total_sales DESC
    LIMIT ? OFFSET ?
  `, [safeLimit, offset]).catch(() => [[]]);

  // ประวัติการโอน (JOIN bank info จาก users)
  const [historyRows] = await db.query(`
    SELECT p.payout_id, p.seller_id, p.net_amount, p.fee_amount, p.order_count,
           p.status, p.omise_transfer_id, p.created_at, p.completed_at,
           u.user_name          AS seller_name,
           u.bank_account_number AS bank_account_number_enc,
           u.bank_account_name  AS bank_account_name,
           u.bank_code          AS bank_code
    FROM payouts p
    LEFT JOIN users u ON u.user_id = p.seller_id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `, [safeLimit, offset]).catch(() => [[]]);

  const [[countRow]] = await db.query(`
    SELECT COUNT(DISTINCT seller_id) AS c
    FROM orders
    WHERE order_status='delivered' AND payout_status='pending'
  `).catch(() => [[{ c: 0 }]]);

  // Summary stats
  const [[pendStats]] = await db.query(`
    SELECT COALESCE(SUM(seller_payout_amount), 0) AS pending_total, COUNT(*) AS pending_count
    FROM orders
    WHERE order_status='delivered' AND payout_status='pending'
  `).catch(() => [[{ pending_total: 0, pending_count: 0 }]]);

  const [[paidStats]] = await db.query(`
    SELECT COALESCE(SUM(net_amount), 0) AS paid_total, COUNT(*) AS paid_count
    FROM payouts WHERE status='completed'
  `).catch(() => [[{ paid_total: 0, paid_count: 0 }]]);

  const [[feeStats]] = await db.query(`
    SELECT COALESCE(SUM(platform_fee), 0) AS fee_total
    FROM orders WHERE order_status='delivered'
  `).catch(() => [[{ fee_total: 0 }]]);

  return {
    stats: {
      pending_total: Math.round(Number(pendStats?.pending_total || 0)),
      pending_count: Number(pendStats?.pending_count || 0),
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
        total_sales: Math.round(Number(r.total_sales || 0)),
        fee_amount:  Math.round(Number(r.fee_amount  || 0)),
        net_amount:  Math.round(Number(r.net_amount  || 0)),
        order_count: Number(r.order_count || 0),
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
    total_pages: Math.max(1, Math.ceil(Number(countRow?.c || 0) / safeLimit)),
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

    // 1) สรุปยอดผู้ขายก่อน mark
    const [[sum]] = await conn.query(
      `SELECT
         COUNT(*)                                  AS order_count,
         COALESCE(SUM(seller_payout_amount), 0)    AS net_total,
         COALESCE(SUM(platform_fee), 0)            AS fee_total
       FROM orders
       WHERE seller_id=? AND order_status='delivered' AND payout_status='pending'`,
      [seller_id]
    );
    if (Number(sum.order_count) === 0) {
      throw Object.assign(new Error("ไม่มีออเดอร์ที่รอจ่าย"), { status: 400 });
    }

    // 2) บันทึก payout
    const [ins] = await conn.query(
      `INSERT INTO payouts (seller_id, net_amount, fee_amount, order_count, status, created_at, completed_at)
       VALUES (?, ?, ?, ?, 'completed', NOW(), NOW())`,
      [seller_id, Math.round(Number(sum.net_total)), Math.round(Number(sum.fee_total)), sum.order_count]
    );
    const payoutId = ins.insertId;

    // 3) อัปเดต orders -> payout_status='paid' + ผูก payout_id
    await conn.query(
      `UPDATE orders
          SET payout_status='paid', payout_id=?, payout_date=NOW()
        WHERE seller_id=? AND order_status='delivered' AND payout_status='pending'`,
      [payoutId, seller_id]
    );

    await conn.commit();
    return { message: "Paid", seller_id, payout_id: payoutId, net_amount: Math.round(Number(sum.net_total)) };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

export async function payAllSellers() {
  const [sellers] = await db.query(`
    SELECT
      seller_id,
      COUNT(*)                                  AS order_count,
      COALESCE(SUM(seller_payout_amount), 0)    AS net_amount,
      COALESCE(SUM(platform_fee), 0)            AS fee_amount
    FROM orders
    WHERE order_status='delivered' AND payout_status='pending'
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

      const [ins] = await conn.query(
        `INSERT INTO payouts (seller_id, net_amount, fee_amount, order_count, status, created_at, completed_at)
         VALUES (?, ?, ?, ?, 'completed', NOW(), NOW())`,
        [s.seller_id, Math.round(Number(s.net_amount)), Math.round(Number(s.fee_amount)), Number(s.order_count)]
      );
      await conn.query(
        `UPDATE orders
            SET payout_status='paid', payout_id=?, payout_date=NOW()
          WHERE seller_id=? AND order_status='delivered' AND payout_status='pending'`,
        [ins.insertId, s.seller_id]
      );
      paidCount += 1;
    }
    await conn.commit();
    return { message: "All paid", count: paidCount };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}