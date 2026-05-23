// backend/server/src/modules/seller/seller.controller.js
import * as svc from "./seller.service.js";

/* ─── Notifications ─── */
export async function notifications(req, res, next) {
  try {
    const data = await svc.getSellerNotifications(req.user.user_id);
    res.json({ is_seller: true, ...data });
  } catch (e) { next(e); }
}

/**
 * Middleware: เช็คว่า req.user เป็นผู้ขายไหม
 *  - ถ้าไม่ใช่: ตอบ 200 + { is_seller: false, message } เพื่อให้ frontend แสดงข้อความได้
 *  - ถ้าใช่:    ติด req.isSeller = true แล้ว next()
 *
 * เลือกใช้ HTTP 200 + flag แทน 403 เพื่อให้หน้าจอ render "ยังไม่มีรายการขาย" ได้สบายๆ
 */
export async function requireSeller(req, res, next) {
  try {
    const ok = await svc.isSeller(req.user.user_id);
    if (!ok) {
      return res.json({
        is_seller: false,
        message: "ยังไม่มีรายการขายของคุณ",
      });
    }
    req.isSeller = true;
    next();
  } catch (e) { next(e); }
}

/* ─── Dashboard ─── */
export async function dashboard(req, res, next) {
  try {
    const sellerId = req.user.user_id;
    const period = req.query.period || "month";
    const [stats, tasks, fee, income] = await Promise.all([
      svc.getDashboardStats(sellerId),
      svc.getDashboardPendingTasks(sellerId),
      svc.getMonthFeeSummary(sellerId, period),
      svc.getDashboardIncome(sellerId, req.query || {}),
    ]);
    res.json({ is_seller: true, stats, tasks, fee_summary: fee, ...income });
  } catch (e) { next(e); }
}

/* ─── Orders ─── */
export async function listOrders(req, res, next) {
  try {
    const { tab = "to_ship", q = "", page = 1, limit = 10, sort = "latest" } = req.query;
    const data = await svc.listSellerOrders(req.user.user_id, {
      tab, q, page: Number(page), limit: Number(limit), sort,
    });
    res.json({ is_seller: true, ...data });
  } catch (e) { next(e); }
}

export async function shipOrder(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    res.json(await svc.confirmShipOrder(req.user.user_id, orderId, req.body || {}));
  } catch (e) { next(e); }
}

/* ─── Payouts (รายได้และการโอนเงิน) ─── */
export async function payouts(req, res, next) {
  try {
    const { page = 1, limit = 10, fee_period = "month" } = req.query;
    const data = await svc.getSellerPayouts(req.user.user_id, {
      page: Number(page), limit: Number(limit),
    });
    const fee = await svc.getMonthFeeSummary(req.user.user_id, fee_period);
    res.json({ is_seller: true, ...data, fee_summary: fee });
  } catch (e) { next(e); }
}

export async function updateBank(req, res, next) {
  try {
    res.json(await svc.updateSellerBank(req.user.user_id, req.body || {}));
  } catch (e) { next(e); }
}

/* ─── Products ─── */
export async function listProducts(req, res, next) {
  try {
    const { status = "", category = "", gender = "", q = "", page = 1, limit = 10, sort = "latest" } = req.query;
    const data = await svc.listSellerProducts(req.user.user_id, {
      status, category, gender, q, page: Number(page), limit: Number(limit), sort,
    });
    res.json({ is_seller: true, ...data });
  } catch (e) { next(e); }
}
