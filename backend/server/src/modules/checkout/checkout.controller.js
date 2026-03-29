// backend/server/src/modules/checkout/checkout.controller.js
import {
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getShippingProviders, getCheckoutItems,
    getCheckoutItemsByProduct,
} from "./checkout.service.js";

// ── Address ──────────────────────────────────────────────
export const getAddressesHandler = async (req, res) => {
  try {
    const rows = await getAddresses(req.user.user_id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createAddressHandler = async (req, res) => {
  try {
    const address = await createAddress(req.user.user_id, req.body);
    res.status(201).json(address);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const updateAddressHandler = async (req, res) => {
  try {
    const address = await updateAddress(req.user.user_id, Number(req.params.id), req.body);
    res.json(address);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const deleteAddressHandler = async (req, res) => {
  try {
    await deleteAddress(req.user.user_id, Number(req.params.id));
    res.json({ message: "ลบที่อยู่แล้ว" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const setDefaultAddressHandler = async (req, res) => {
  try {
    await setDefaultAddress(req.user.user_id, Number(req.params.id));
    res.json({ message: "ตั้งเป็นที่อยู่หลักแล้ว" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Shipping ─────────────────────────────────────────────
export const getShippingHandler = async (req, res) => {
  try {
    const rows = await getShippingProviders();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Checkout items ────────────────────────────────────────
export const getCheckoutItemsHandler = async (req, res) => {
  try {
    const ids = String(req.query.items || "")
      .split(",")
      .map(Number)
      .filter(Boolean);
    const rows = await getCheckoutItems(req.user.user_id, ids);
    res.json(rows);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const getCheckoutItemsByProductHandler = async (req, res) => {
  try {
    const ids = String(req.query.items || "")
      .split(",")
      .map(Number)
      .filter(Boolean);
    const rows = await getCheckoutItemsByProduct(req.user.user_id, ids);
    res.json(rows);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};