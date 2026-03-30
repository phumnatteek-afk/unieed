// backend/server/src/modules/checkout/checkout.routes.js
import express from "express";
import { auth } from "../../middleware/auth.js";
import {
  getAddressesHandler, createAddressHandler, updateAddressHandler,
  deleteAddressHandler, setDefaultAddressHandler,
  getShippingHandler, getCheckoutItemsHandler,
  getCheckoutItemsByProductHandler,
  placeOrderHandler, 
} from "./checkout.controller.js";

const router = express.Router();

// Address
router.get   ("/addresses",           auth, getAddressesHandler);
router.post  ("/addresses",           auth, createAddressHandler);
router.put   ("/addresses/:id",       auth, updateAddressHandler);
router.delete("/addresses/:id",       auth, deleteAddressHandler);
router.patch ("/addresses/:id/default", auth, setDefaultAddressHandler);

// Shipping
router.get("/shipping", getShippingHandler);
router.get("/items/by-product", auth, getCheckoutItemsByProductHandler); 
// Checkout items
router.get("/items", auth, getCheckoutItemsHandler);
router.post("/orders", auth, placeOrderHandler);

export default router;