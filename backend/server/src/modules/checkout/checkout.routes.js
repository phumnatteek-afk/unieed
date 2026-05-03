import express from "express";
import { auth } from "../../middleware/auth.js";
import {
  getAddressesHandler, createAddressHandler, updateAddressHandler,
  deleteAddressHandler, setDefaultAddressHandler,
  getShippingHandler,
  getCheckoutItemsHandler, getCheckoutItemsByProductHandler,
  getShippingOptionsHandler,
  placeOrderHandler,
} from "./checkout.controller.js";

const router = express.Router();

// Addresses
router.get    ("/addresses",             auth, getAddressesHandler);
router.post   ("/addresses",             auth, createAddressHandler);
router.put    ("/addresses/:id",         auth, updateAddressHandler);
router.delete ("/addresses/:id",         auth, deleteAddressHandler);
router.patch  ("/addresses/:id/default", auth, setDefaultAddressHandler);

// Shipping providers list
router.get("/shipping", getShippingHandler);

// Checkout items
router.get("/items",            auth, getCheckoutItemsHandler);
router.get("/items/by-product", auth, getCheckoutItemsByProductHandler);

// Shipping options (calculated per seller)
router.get("/shipping-options", auth, getShippingOptionsHandler);

// Place order
router.post("/orders", auth, placeOrderHandler);

export default router;