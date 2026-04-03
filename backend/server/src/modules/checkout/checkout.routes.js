// backend/server/src/modules/checkout/checkout.routes.js
import express from "express";
import { auth } from "../../middleware/auth.js";
import {
  getAddressesHandler, createAddressHandler, updateAddressHandler,
  deleteAddressHandler, setDefaultAddressHandler,
  getShippingHandler,
  getCheckoutItemsHandler, getCheckoutItemsByProductHandler,
  getShippingOptionsHandler,
  placeOrderHandler,
  checkPaymentStatusHandler,
} from "./checkout.controller.js";

const router = express.Router();

// Addresses
router.get    ("/addresses",          auth, getAddressesHandler);
router.post   ("/addresses",          auth, createAddressHandler);
router.put    ("/addresses/:id",      auth, updateAddressHandler);
router.delete ("/addresses/:id",      auth, deleteAddressHandler);
router.patch  ("/addresses/:id/default", auth, setDefaultAddressHandler);

// Shipping providers list
router.get("/shipping", getShippingHandler);

// Checkout items
router.get("/items",             auth, getCheckoutItemsHandler);
router.get("/items/by-product",  auth, getCheckoutItemsByProductHandler);

// Shipping options (calculated per seller)
router.get("/shipping-options",  auth, getShippingOptionsHandler);

// Place order + Omise charge
router.post("/orders",               auth, placeOrderHandler);

// Check PromptPay payment status
router.get("/orders/:id/payment-status", auth, checkPaymentStatusHandler);

export default router;

// ─────────────────────────────────────────────────────────
// backend/server/src/modules/orders/order.service.js
// ─────────────────────────────────────────────────────────
// GET /api/orders/:id — ดึง order detail รวม items + shipping
export const getOrderDetail = async (orderId, userId) => {
  const { db } = await import("../../config/db.js");

  const [[order]] = await db.execute(
    `SELECT o.*,
            CASE WHEN o.order_type = 'donation' THEN 'ซื้อเพื่อส่งต่อ' ELSE 'ซื้อปกติ' END AS order_type_label
     FROM orders o
     WHERE o.order_id = ? AND o.buyer_id = ?`,
    [orderId, userId]
  );
  if (!order) throw { status: 404, message: "ไม่พบคำสั่งซื้อ" };

  // items
  const [items] = await db.execute(
    `SELECT oi.*, p.product_title, pi.image_url AS cover_image
     FROM order_items oi
     JOIN products p ON p.product_id = oi.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_cover = 1
     WHERE oi.order_id = ?`,
    [orderId]
  );

  // shipping info
  let shipping = [];
  try {
    [shipping] = await db.execute(
      `SELECT os.*, sp.name AS provider_name, sp.code
       FROM order_shipping os
       LEFT JOIN shipping_providers sp ON sp.provider_id = os.provider_id
       WHERE os.order_id = ?`,
      [orderId]
    );
  } catch { /* table ยังไม่มี */ }

  return { ...order, items, shipping };
};