// backend/server/src/modules/seller/seller.routes.js
import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import {
  requireSeller,
  dashboard, listOrders, shipOrder,
  payouts, updateBank, listProducts,
  notifications,
} from "./seller.controller.js";

const r = Router();

// ─── Dashboard ร้านค้า ─────────────────────────────────────
r.get("/dashboard",       auth, requireSeller, dashboard);

// ─── Orders (คำสั่งซื้อ + การจัดส่ง) ───────────────────────
r.get("/orders",          auth, requireSeller, listOrders);
r.patch("/orders/:id/ship", auth, requireSeller, shipOrder);

// ─── Payouts (รายได้และการโอนเงิน) ─────────────────────────
r.get("/payouts",         auth, requireSeller, payouts);
r.put("/bank-account",    auth,                updateBank);  // ผู้ที่ยังไม่ใช่ seller ก็ตั้งบัญชีไว้ก่อนได้

// ─── Products ─────────────────────────────────────────────
r.get("/products",        auth, requireSeller, listProducts);

// ─── Notifications (badge counts) ─────────────────────────
r.get("/notifications",   auth, notifications);

export default r;
