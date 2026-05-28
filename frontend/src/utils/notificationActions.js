/** Parse notification body (JSON object or plain string) */
export function parseNotifBody(notif) {
  const raw = notif?.body;
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : { message: String(raw) };
  } catch {
    return { message: String(raw) };
  }
}

const POPUP_TYPES = new Set([
  "certificate",
  "donation_issue",
  "suspension",
  "strike_reset",
  "strike_appeal",
  "wrong_item_report",
  "donation_clarify",
]);

const CHIP_LABELS = {
  certificate:            "ดูใบประกาศนียบัตร →",
  donation_issue:         "ชี้แจง / ดูรายละเอียด →",
  suspension:             "ดูรายละเอียด →",
  strike_reset:           "รับทราบ →",
  strike_appeal:          "ไปตรวจสอบ →",
  wrong_item_report:      "ไปตรวจสอบ →",
  donation_clarify:       "ไปตรวจสอบ →",
  admin_approved:         "ดูรายการบริจาค →",
  donation_received:      "ตรวจสอบบริจาค →",
  donation_shipped:       "ดูประวัติการบริจาค →",
  order_shipped:          "ดูออเดอร์ →",
  order_delivered:        "ดูออเดอร์ →",
  order_auto_delivered:   "ดูออเดอร์ →",
  order_auto_cancelled:   "ดูออเดอร์ →",
  order_cancel_warning:   "จัดการออเดอร์ →",
  order_auto_cancelled_seller: "จัดการออเดอร์ →",
  payout_completed:       "ดูยอดโอน →",
};

export const NOTIF_ICONS = {
  certificate:            "mdi:certificate-outline",
  donation_issue:         "mdi:alert-circle-outline",
  suspension:             "mdi:account-cancel",
  strike_reset:           "mdi:shield-check-outline",
  strike_appeal:          "mdi:file-document-edit-outline",
  wrong_item_report:      "mdi:swap-horizontal",
  donation_clarify:       "mdi:message-reply-outline",
  admin_approved:         "mdi:check-circle-outline",
  donation_received:      "mdi:gift-outline",
  donation_shipped:       "mdi:truck-delivery-outline",
  order_shipped:          "mdi:package-variant-closed",
  order_delivered:        "mdi:check-decagram-outline",
  order_auto_delivered:   "mdi:check-decagram-outline",
  order_auto_cancelled:   "mdi:close-circle-outline",
  order_cancel_warning:   "mdi:clock-alert-outline",
  order_auto_cancelled_seller: "mdi:close-circle-outline",
  payout_completed:       "mdi:cash-check",
  default:                "mdi:bell-outline",
};

export const NOTIF_ICON_CLASS = {
  certificate:            "nb-item-icon--cert",
  suspension:             "nb-item-icon--suspension",
  admin_approved:           "nb-item-icon--approved",
  donation_received:        "nb-item-icon--approved",
  order_delivered:          "nb-item-icon--approved",
  order_shipped:            "nb-item-icon--cert",
  payout_completed:         "nb-item-icon--approved",
  donation_issue:           "nb-item-icon--default",
  wrong_item_report:        "nb-item-icon--default",
  donation_clarify:         "nb-item-icon--default",
  order_cancel_warning:     "nb-item-icon--default",
  default:                  "nb-item-icon--default",
};

/**
 * Resolve click action for a notification.
 * @returns {{ mode: 'popup'|'navigate'|'none', path?: string, state?: object, chip?: string }}
 */
export function getNotifAction(notif, role) {
  const type = notif?.type;
  const refId = notif?.ref_id != null ? Number(notif.ref_id) : null;
  const chip = CHIP_LABELS[type] || "ดูรายละเอียด →";

  if (POPUP_TYPES.has(type)) {
    return { mode: "popup", chip };
  }

  if (type === "admin_approved" || type === "donation_received") {
    return {
      mode: "navigate",
      path: "/school/donations",
      state: refId ? { openDonationId: refId } : undefined,
      chip: CHIP_LABELS[type],
    };
  }

  if (type === "donation_shipped") {
    return { mode: "navigate", path: "/donations/history", chip: CHIP_LABELS[type] };
  }

  if (type === "payout_completed") {
    return { mode: "navigate", path: "/seller/payouts", chip: CHIP_LABELS[type] };
  }

  const sellerOrderTypes = new Set([
    "order_cancel_warning",
    "order_auto_cancelled_seller",
  ]);
  if (sellerOrderTypes.has(type)) {
    return { mode: "navigate", path: "/seller/orders", chip: CHIP_LABELS[type] };
  }

  if (type === "order_delivered" && role === "seller") {
    return {
      mode: "navigate",
      path: refId ? `/seller/orders` : "/seller/orders",
      chip: CHIP_LABELS[type],
    };
  }

  const buyerOrderTypes = new Set([
    "order_shipped",
    "order_auto_cancelled",
    "order_auto_delivered",
  ]);
  if (buyerOrderTypes.has(type) || (type === "order_delivered" && role !== "seller")) {
    if (refId) {
      return { mode: "navigate", path: `/orders/${refId}`, chip: CHIP_LABELS[type] || "ดูออเดอร์ →" };
    }
    return { mode: "navigate", path: "/orders", chip: "ดูออเดอร์ →" };
  }

  if (refId) {
    if (role === "school_admin") {
      return { mode: "navigate", path: "/school/donations", state: { openDonationId: refId }, chip };
    }
    if (role === "seller") {
      return { mode: "navigate", path: "/seller/orders", chip };
    }
    return { mode: "navigate", path: `/orders/${refId}`, chip };
  }

  return { mode: "none", chip: null };
}
