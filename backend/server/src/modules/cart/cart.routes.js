// backend/server/src/modules/cart/cart.routes.js
import express from "express";
import { auth } from "../../middleware/auth.js";
import {
  getCartHandler, addToCartHandler, updateCartItemHandler,
  removeCartItemHandler, clearCartHandler, getCartCountHandler,
} from "./cart.controller.js";

const router = express.Router();

router.get("/",              auth, getCartHandler);
router.get("/count",         auth, getCartCountHandler);
router.post("/",             auth, addToCartHandler);
router.patch("/:itemId",     auth, updateCartItemHandler);
router.delete("/clear",      auth, clearCartHandler);
router.delete("/:itemId",    auth, removeCartItemHandler);

export default router;