import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  adminListSchools,
  adminApproveSchool,
  adminRejectSchool,
  adminRemoveSchool,
  adminSuspendSchool,
  adminUnsuspendSchool,
  adminOverview,
  getSchoolDetail,
  getSchoolAdminsList,
  updateSchool,
  adminUpdateSchool,
  adminRevenue,
  adminChart,
  adminPendingTasks,
  adminListOrders,
  adminOrderDetail,
  adminShipOrder,
  adminCancelOrder,
  adminListPayouts,
  adminPaySeller,
  adminPayAll,
  adminGetDonorSuspensionHistory,
  adminGetDonorProfile,
  adminDemandInsight,
  adminProjectStatusProjects,
} from "./admin.controller.js";

const r = Router();

/* ─── Schools ─── */
r.get("/schools",             auth, requireRole(["admin"]), adminListSchools);
r.get("/schools/:id",         auth, requireRole(["admin"]), getSchoolDetail);
r.get("/schools/:id/admins",  auth, requireRole(["admin"]), getSchoolAdminsList);
r.put("/schools/:id",         auth, requireRole(["admin"]), updateSchool);
r.patch("/schools/:id",       auth, requireRole(["admin"]), adminUpdateSchool);
r.post("/schools/:id/approve",   auth, requireRole(["admin"]), adminApproveSchool);
r.post("/schools/:id/reject",    auth, requireRole(["admin"]), adminRejectSchool);
r.post("/schools/:id/suspend",   auth, requireRole(["admin"]), adminSuspendSchool);
r.post("/schools/:id/unsuspend", auth, requireRole(["admin"]), adminUnsuspendSchool);
r.delete("/schools/:id",         auth, requireRole(["admin"]), adminRemoveSchool);

/* ─── Dashboard ─── */
r.get("/overview",            auth, requireRole(["admin"]), adminOverview);
r.get("/revenue",             auth, requireRole(["admin"]), adminRevenue);       // ?period=&start_date=&end_date=
r.get("/chart",               auth, requireRole(["admin"]), adminChart);         // ?period=&start_date=&end_date=
r.get("/pending-tasks",       auth, requireRole(["admin"]), adminPendingTasks);
r.get("/demand-insight",      auth, requireRole(["admin"]), adminDemandInsight); // Demand Insight
r.get("/project-status",      auth, requireRole(["admin"]), adminProjectStatusProjects); // ?status=open|closed

/* ─── Orders ─── */
r.get("/orders",              auth, requireRole(["admin"]), adminListOrders);    // ?status=&q=&page=&limit=
r.get("/orders/:id",          auth, requireRole(["admin"]), adminOrderDetail);
r.patch("/orders/:id/ship",   auth, requireRole(["admin"]), adminShipOrder);
r.patch("/orders/:id/cancel", auth, requireRole(["admin"]), adminCancelOrder);

/* ─── Donor Suspension ─── */
r.get("/donors/:userId/suspension-history", auth, requireRole(["admin"]), adminGetDonorSuspensionHistory);
r.get("/donors/:userId/profile",            auth, requireRole(["admin"]), adminGetDonorProfile);

/* ─── Payouts ─── */
r.get("/payouts",             auth, requireRole(["admin"]), adminListPayouts);   // ?period=&page=&limit=
r.post("/payouts/pay-all",    auth, requireRole(["admin"]), adminPayAll);
r.post("/payouts/:seller_id/pay", auth, requireRole(["admin"]), adminPaySeller);

export default r;
