// backend/server/src/modules/cart/cart.controller.js
import {
  getCart, addToCart, updateCartItem,
  removeCartItem, clearCart, getCartCount,
} from "./cart.service.js";

const getCartHandler = async (req, res) => {
  try {
    const data = await getCart(req.user.user_id);
    res.json(data);
  } catch (err) {
    console.error("[Cart.get]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};

const addToCartHandler = async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ message: "กรุณาระบุ product_id" });
    const data = await addToCart(req.user.user_id, Number(product_id), Number(quantity));
    res.status(201).json(data);
  } catch (err) {
    console.error("[Cart.add]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};

const updateCartItemHandler = async (req, res) => {
  try {
    const { quantity } = req.body;
    const data = await updateCartItem(req.user.user_id, Number(req.params.itemId), Number(quantity));
    res.json(data);
  } catch (err) {
    console.error("[Cart.update]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};

const removeCartItemHandler = async (req, res) => {
  try {
    const data = await removeCartItem(req.user.user_id, Number(req.params.itemId));
    res.json(data);
  } catch (err) {
    console.error("[Cart.remove]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};

const clearCartHandler = async (req, res) => {
  try {
    await clearCart(req.user.user_id);
    res.json({ message: "ล้างตะกร้าแล้ว" });
  } catch (err) {
    console.error("[Cart.clear]", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
};

const getCartCountHandler = async (req, res) => {
  try {
    const count = await getCartCount(req.user.user_id);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
};

export {
  getCartHandler, addToCartHandler, updateCartItemHandler,
  removeCartItemHandler, clearCartHandler, getCartCountHandler,
};