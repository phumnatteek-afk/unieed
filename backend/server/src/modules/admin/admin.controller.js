import * as svc from "./admin.service.js";

/* ───────────── Schools ───────────── */

export async function adminListSchools(req, res, next) {
  try {
    const { status = "", q = "", sort = "latest" } = req.query;
    const data = await svc.listSchools({ status, q, sort });
    res.json(data);
  } catch (e) { next(e); }
}

export async function adminApproveSchool(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.approveSchool(id));
  } catch (e) { next(e); }
}

export async function adminRemoveSchool(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.suspendSchool(id)); // ระงับแทนลบ
  } catch (e) { next(e); }
}

export async function adminSuspendSchool(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.suspendSchool(id));
  } catch (e) { next(e); }
}

export async function adminUnsuspendSchool(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.unsuspendSchool(id));
  } catch (e) { next(e); }
}

export async function adminRejectSchool(req, res, next) {
  try {
    const school_id = Number(req.params.id);
    const note = String(req.body?.note || "").trim();
    res.json(await svc.rejectSchool(school_id, note));
  } catch (e) { next(e); }
}

export async function getSchoolDetail(req, res, next) {
  try {
    res.json(await svc.getSchoolDetail(req.params.id));
  } catch (e) { next(e); }
}

export async function getSchoolAdminsList(req, res, next) {
  try {
    res.json(await svc.getSchoolAdminsList(req.params.id));
  } catch (e) { next(e); }
}

export async function updateSchool(req, res, next) {
  try {
    res.json(await svc.updateSchool(req.params.id, req.body));
  } catch (e) { next(e); }
}

export async function adminUpdateSchool(req, res, next) {
  try {
    res.json(await svc.adminUpdateSchool(req.params.id, req.body));
  } catch (e) { next(e); }
}

/* ───────────── Dashboard overview ───────────── */

export async function adminOverview(req, res, next) {
  try {
    res.json(await svc.getOverviewStats());
  } catch (e) { next(e); }
}

export async function adminRevenue(req, res, next) {
  try {
    const { period = "month", start_date, end_date } = req.query;
    res.json(await svc.getRevenueStats({ period, start_date, end_date }));
  } catch (e) { next(e); }
}

export async function adminChart(req, res, next) {
  try {
    const { period = "", start_date = "", end_date = "", months = "" } = req.query;
    res.json(await svc.getChartData({
      period: period || null,
      start_date,
      end_date,
      months: months ? Number(months) : null,
    }));
  } catch (e) { next(e); }
}

export async function adminPendingTasks(req, res, next) {
  try {
    res.json(await svc.getPendingTasks());
  } catch (e) { next(e); }
}

/* ───────────── Orders ───────────── */

export async function adminListOrders(req, res, next) {
  try {
    const { status = "", q = "", page = 1, limit = 10, seller_id = "", period = "month", start_date = "", end_date = "", payout_status = "" } = req.query;
    res.json(await svc.listOrders({
      status, q, page: Number(page), limit: Number(limit), seller_id, period, start_date, end_date, payout_status,
    }));
  } catch (e) { next(e); }
}

export async function adminOrderDetail(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.getOrderDetail(id));
  } catch (e) { next(e); }
}

export async function adminShipOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.shipOrder(id));
  } catch (e) { next(e); }
}

export async function adminCancelOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.cancelOrder(id));
  } catch (e) { next(e); }
}

/* ───────────── Payouts ───────────── */

export async function adminListPayouts(req, res, next) {
  try {
    const {
      period = "week",
      page = 1,
      limit = 10,
      pending_page = page,
      pending_limit = limit,
      history_page = page,
      history_limit = limit,
      start_date = "",
      end_date = "",
    } = req.query;
    res.json(await svc.listPayouts({
      period,
      page: Number(page),
      limit: Number(limit),
      pending_page: Number(pending_page),
      pending_limit: Number(pending_limit),
      history_page: Number(history_page),
      history_limit: Number(history_limit),
      start_date,
      end_date,
    }));
  } catch (e) { next(e); }
}

export async function adminPaySeller(req, res, next) {
  try {
    const seller_id = Number(req.params.seller_id);
    const { net_amount } = req.body;
    res.json(await svc.paySeller(seller_id, Number(net_amount)));
  } catch (e) { next(e); }
}

export async function adminPayAll(req, res, next) {
  try {
    res.json(await svc.payAllSellers());
  } catch (e) { next(e); }
}

export async function adminDemandInsight(req, res, next) {
  try {
    res.json(await svc.getDemandInsight());
  } catch (e) { next(e); }
}

export async function adminProjectStatusProjects(req, res, next) {
  try {
    const { status = "open", limit = 200 } = req.query;
    res.json(await svc.listProjectStatusProjects({ status, limit: Number(limit) }));
  } catch (e) { next(e); }
}

export async function adminGetDonorSuspensionHistory(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    res.json(await svc.getDonorSuspensionHistory(userId));
  } catch (e) { next(e); }
}

export async function adminGetDonorProfile(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const data = await svc.getDonorProfile(userId);
    if (!data) return res.status(404).json({ message: "ไม่พบผู้บริจาค" });
    res.json(data);
  } catch (e) { next(e); }
}
