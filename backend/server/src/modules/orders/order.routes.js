import express from "express";
import { auth } from "../../middleware/auth.js";
import {
  getMyOrdersHandler,
  getOrderDetailHandler,
  confirmReceiptHandler,
  cancelOrderHandler,
} from "./order.controller.js";

const router = express.Router();

router.get("/",                       auth, getMyOrdersHandler);
router.get("/:id",                    auth, getOrderDetailHandler);
router.patch("/:id/confirm-receipt",  auth, confirmReceiptHandler);
router.patch("/:id/cancel",           auth, cancelOrderHandler);

export default router;