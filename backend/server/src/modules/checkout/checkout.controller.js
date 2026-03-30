// backend/server/src/modules/checkout/checkout.controller.js
import {
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getShippingProviders, getCheckoutItems,
    getCheckoutItemsByProduct,
    placeOrder,
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

export const placeOrderHandler = async (req, res) => {
  try {
    const {
      items,           // cart_item_ids[]
      product_ids,     // กรณีซื้อตรง (ไม่ผ่าน cart)
      address_id,
      order_type,      // "purchase" | "donation"
      request_id,
      donation_address,// { name, address, district, province, postal_code, phone }
    } = req.body;

    const result = await placeOrder({
      userId:          req.user.user_id,
      cartItemIds:     Array.isArray(items)       ? items       : [],
      productIds:      Array.isArray(product_ids) ? product_ids : [],
      addressId:       address_id,
      orderType:       order_type || "purchase",
      requestId:       request_id || null,
      donationAddress: donation_address || null,
    });

    res.status(201).json({ message: "สั่งซื้อสำเร็จ", ...result });
  } catch (err) {
    console.error("[placeOrder]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};