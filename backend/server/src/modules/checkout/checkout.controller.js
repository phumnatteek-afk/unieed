// backend/server/src/modules/checkout/checkout.controller.js
import {
  getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress,
  getShippingProviders,
  getCheckoutItems, getCheckoutItemsByProduct,
  getShippingOptions,
  placeOrder,
  checkPaymentStatus,
} from "./checkout.service.js";

// ── Address ──────────────────────────────────────────────
export const getAddressesHandler = async (req, res) => {
  try { res.json(await getAddresses(req.user.user_id)); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

export const createAddressHandler = async (req, res) => {
  try { res.status(201).json(await createAddress(req.user.user_id, req.body)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

export const updateAddressHandler = async (req, res) => {
  try { res.json(await updateAddress(req.user.user_id, Number(req.params.id), req.body)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

export const deleteAddressHandler = async (req, res) => {
  try { await deleteAddress(req.user.user_id, Number(req.params.id)); res.json({ message: "ลบที่อยู่แล้ว" }); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

export const setDefaultAddressHandler = async (req, res) => {
  try { await setDefaultAddress(req.user.user_id, Number(req.params.id)); res.json({ message: "ตั้งเป็นที่อยู่หลักแล้ว" }); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Shipping ─────────────────────────────────────────────
export const getShippingHandler = async (req, res) => {
  try { res.json(await getShippingProviders()); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Checkout Items ────────────────────────────────────────
export const getCheckoutItemsHandler = async (req, res) => {
  try {
    const ids = String(req.query.items || "").split(",").map(Number).filter(Boolean);
    res.json(await getCheckoutItems(req.user.user_id, ids));
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

export const getCheckoutItemsByProductHandler = async (req, res) => {
  try {
    const ids = String(req.query.items || "").split(",").map(Number).filter(Boolean);
    res.json(await getCheckoutItemsByProduct(req.user.user_id, ids));
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

// ── Shipping Options (คำนวณค่าส่งแต่ละ seller) ───────────
export const getShippingOptionsHandler = async (req, res) => {
  try {
    const ids = String(req.query.items || "").split(",").map(Number).filter(Boolean);
    res.json(await getShippingOptions(ids));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Place Order + Omise Charge ────────────────────────────
export const placeOrderHandler = async (req, res) => {
  try {
    const {
      items, product_ids, address_id,
      order_type, request_id, donation_address,
      shipping,
      omise_token,    // card token
      payment_method, // "card" | "promptpay"
    } = req.body;

    const result = await placeOrder({
      userId:            req.user.user_id,
      cartItemIds:       Array.isArray(items)       ? items       : [],
      productIds:        Array.isArray(product_ids) ? product_ids : [],
      addressId:         address_id,
      orderType:         order_type   || "purchase",
      requestId:         request_id   || null,
      donationAddress:   donation_address || null,
      shippingSelections: Array.isArray(shipping) ? shipping : [],
      omiseToken:        omise_token   || null,
      paymentMethod:     payment_method || null,
    });

    res.status(201).json({
      message:       "สั่งซื้อสำเร็จ",
      order_id:      result.order_id,
      charge_id:     result.charge_id,
      // แปลง base64 → data URI ให้ frontend ใช้เป็น <img src> ได้เลย
      qr_image_url:  result.qr_base64
                       ? `data:image/png;base64,${result.qr_base64}`
                       : null,
      authorize_uri: result.authorize_uri || null,
    });
  } catch (err) {
    console.error("[placeOrder]", err);
    res.status(err.status || 500).json({ message: err.message || "เกิดข้อผิดพลาด" });
  }
};

// ── Check Payment Status (PromptPay polling) ──────────────
export const checkPaymentStatusHandler = async (req, res) => {
  try {
    const result = await checkPaymentStatus(Number(req.params.id), req.user.user_id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};