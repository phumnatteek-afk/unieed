import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import { formatOrderNo } from "../../../utils/orderNo.js";
import "../styles/OrderDetailPage.css";

/* ── Constants ───────────────────────────────────────────── */
const STATUS_MAP = {
  pending:   { label: "รอดำเนินการ",  cls: "badge--pending",   icon: "mdi:clock-outline" },
  confirmed: { label: "ยืนยันแล้ว",   cls: "badge--confirmed", icon: "mdi:check-circle-outline" },
  shipping:  { label: "จัดส่งแล้ว",   cls: "badge--shipping",  icon: "mdi:truck-fast-outline" },
  delivered: { label: "ได้รับสินค้า", cls: "badge--delivered", icon: "mdi:package-variant-closed-check" },
  cancelled: { label: "ยกเลิกแล้ว",  cls: "badge--cancelled", icon: "mdi:close-circle-outline" },
};

const PAY_MAP = {
  paid:   { label: "ชำระแล้ว",   cls: "pay--paid" },
  unpaid: { label: "ยังไม่ชำระ", cls: "pay--unpaid" },
};

const TRACKING_URLS = {
  "ไทยไปรษณีย์":     (no) => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  "Thailand Post":    (no) => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  "EMS":              (no) => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  "Kerry":            (no) => `https://th.kerryexpress.com/th/track/?track=${no}`,
  "Kerry Express":    (no) => `https://th.kerryexpress.com/th/track/?track=${no}`,
  "Flash":            (no) => `https://www.flashexpress.co.th/tracking/?se=${no}`,
  "Flash Express":    (no) => `https://www.flashexpress.co.th/tracking/?se=${no}`,
  "J&T":              (no) => `https://www.jtexpress.co.th/trajectoryQuery?bills=${no}`,
  "J&T Express":      (no) => `https://www.jtexpress.co.th/trajectoryQuery?bills=${no}`,
  "DHL":              (no) => `https://www.dhl.com/th-en/home/tracking.html?tracking-id=${no}`,
  "Ninja Van":        (no) => `https://www.ninjavan.co/th-th/tracking?id=${no}`,
  "NinjaVan":         (no) => `https://www.ninjavan.co/th-th/tracking?id=${no}`,
  "SCG Yamato":       (no) => `https://www.scgyamato.co.th/tracking?trackingNo=${no}`,
  "Best Express":     (no) => `https://www.best-inc-th.com/track/${no}`,
  "Shopee Express":   (no) => `https://spx.co.th/tracking?trackingNumber=${no}`,
};

const getTrackingUrl = (provider, trackingNo) => {
  if (!provider || !trackingNo) return null;
  const key = Object.keys(TRACKING_URLS).find(k =>
    provider.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(provider.toLowerCase())
  );
  return key ? TRACKING_URLS[key](trackingNo) : null;
};

const shippedOver7Days = (d) => {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() > 7 * 24 * 60 * 60 * 1000;
};

const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString();

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const getSizeText = (size, categoryId) => {
  if (!size) return "";
  let s = size;
  if (typeof s === "string") { try { s = JSON.parse(s); } catch { return String(size); } }
  const cid = Number(categoryId);
  const parts = [];
  if (cid === 1) {
    if (s.chest)  parts.push(`อก ${s.chest}`);
    if (s.length) parts.push(`ยาว ${s.length}`);
  } else {
    if (s.waist)  parts.push(`เอว ${s.waist}`);
    if (s.length) parts.push(`ยาว ${s.length}`);
  }
  return parts.join(" / ");
};

/* ── Status Timeline ─────────────────────────────────────── */
function StatusTimeline({ status }) {
  if (status === "cancelled") return null;
  const steps = [
    { label: "สั่งซื้อแล้ว",  icon: "mdi:shopping-outline",        done: true,  active: false },
    { label: "ยืนยันออเดอร์", icon: "mdi:clipboard-check-outline", done: ["confirmed","shipping","delivered"].includes(status), active: status === "pending" },
    { label: "จัดส่งแล้ว",    icon: "mdi:truck-fast-outline",      done: ["shipping","delivered"].includes(status), active: status === "confirmed" },
    { label: "ได้รับสินค้า",  icon: "mdi:home-check-outline",      done: status === "delivered", active: status === "shipping" },
  ];
  return (
    <div className="odTimeline">
      {steps.map((step, i) => (
        <div key={i} className={`odTimelineStep ${step.done ? "odTimelineStep--done" : ""} ${step.active ? "odTimelineStep--active" : ""}`}>
          {i > 0 && <div className={`odTimelineLine ${steps[i-1].done ? "odTimelineLine--done" : ""}`} />}
          <div className={`odTimelineDot ${step.done ? "odTimelineDot--done" : ""} ${step.active ? "odTimelineDot--active" : ""}`}>
            {step.active ? <div className="odTimelinePulse" /> : <Icon icon={step.icon} style={{ fontSize: 13 }} />}
          </div>
          <div className={`odTimelineLabel ${step.done ? "odTimelineLabel--done" : ""} ${step.active ? "odTimelineLabel--active" : ""}`}>
            {step.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Product Image (object-fit: contain) ─────────────────── */
function ProductImage({ item }) {
  const [imgErr, setImgErr] = useState(false);
  const imgUrl = item.cover_image || item.image_url || item.image;
  if (!imgUrl || imgErr) {
    return (
      <div className="odItemThumb odItemThumb--fallback">
        <Icon icon="mdi:tshirt-crew-outline" />
      </div>
    );
  }
  return (
    <div className="odItemThumb">
      <img src={imgUrl} alt={item.product_title} onError={() => setImgErr(true)} loading="lazy" />
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function OrderDetailPage() {
  const { token }  = useAuth();
  const { id }     = useParams();
  const location   = useLocation();
  const navigate   = useNavigate();
  const successMsg = location.state?.successMsg;

  const [order,         setOrder]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [err,           setErr]           = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg,     setActionMsg]     = useState("");
  const [copied,        setCopied]        = useState(false);

  const loadOrder = useCallback(() => {
    if (!token || !id) return;
    setLoading(true);
    fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.order_id) setOrder(data);
        else setErr(data.message || "ไม่พบคำสั่งซื้อ");
      })
      .catch(() => setErr("เกิดข้อผิดพลาด กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, [token, id]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const handleAction = async (action) => {
    if (!window.confirm(
      action === "confirm-receipt" ? "ยืนยันว่าได้รับสินค้าแล้ว?" : "ยืนยันการยกเลิกคำสั่งซื้อนี้?"
    )) return;
    setActionLoading(true); setActionMsg("");
    try {
      const res  = await fetch(`/api/orders/${id}/${action}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
      setActionMsg(data.message || "ดำเนินการเรียบร้อย");
      loadOrder();
    } catch (e) { setActionMsg(e.message); }
    finally { setActionLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(order.tracking_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* derived */
  const statusInfo    = STATUS_MAP[order?.order_status] || STATUS_MAP.pending;
  const payInfo       = PAY_MAP[order?.payment_status]  || PAY_MAP.unpaid;
  const items         = order?.items    || [];
  const shipping      = order?.shipping || [];
  const subtotal      = items.reduce((s, i) => s + Number(i.price_at_purchase) * i.quantity, 0);
  const shippingTotal = shipping.reduce((s, sh) => s + Number(sh.shipping_price), 0);
  const canConfirm    = order?.order_status === "shipping";
  const canCancel     = order?.order_status === "pending" ||
    (order?.order_status === "shipping" && shippedOver7Days(order?.shipping_date));
  const providerName  = shipping[0]?.provider_name || order?.shipping_provider_name;
  const trackingUrl   = order ? getTrackingUrl(providerName, order.tracking_number) : null;

  return (
    <div className="odPage">

      {/* ── Sticky Header ── */}
      <header className="odHeader">
        <div className="odHeaderInner">
          <button className="odBack" onClick={() => navigate(-1)}>
            <Icon icon="mdi:chevron-left" />
          </button>
          <span className="odHeaderTitle">รายละเอียดคำสั่งซื้อ</span>
          <div className="odHeaderRight"><ProfileDropdown /></div>
        </div>
      </header>

      <div className="odBody">

        {successMsg && (
          <div className="odAlert odAlert--success"><Icon icon="mdi:check-circle" />{successMsg}</div>
        )}
        {loading && (
          <div className="odCenterMsg"><div className="odLoadingRing" /><p>กำลังโหลด...</p></div>
        )}
        {err && (
          <div className="odAlert odAlert--error"><Icon icon="mdi:alert-circle" />{err}</div>
        )}

        {order && !loading && (
          <>
            {/* ══ 1. ORDER ID + STATUS + TIMELINE ══ */}
            <div className="odCard odCard--header">
              <div className="odCardHeaderTop">
                <div className="odCardHeaderLeft">
                  <div className="odOrderLabel">
                    <Icon icon="mdi:receipt-text-outline" />คำสั่งซื้อ
                  </div>
                  <div className="odOrderId">{formatOrderNo(order.order_id)}</div>
                  <div className="odOrderDate">
                    <Icon icon="mdi:calendar-outline" style={{ fontSize: 12 }} />
                    {fmtDate(order.created_at)}
                  </div>
                </div>

                <div className="odBadgeGroup">
                  <div className={`odStatusBadge ${statusInfo.cls}`}>
                    <Icon icon={statusInfo.icon} />{statusInfo.label}
                  </div>
                  <div className={`odPayBadge ${payInfo.cls}`}>
                    <Icon icon={payInfo.cls === "pay--paid" ? "mdi:check" : "mdi:clock-outline"} />
                    {payInfo.label}
                  </div>
                </div>
              </div>

              <StatusTimeline status={order.order_status} />

              {order.order_status === "cancelled" && (
                <div className="odStatusNote odStatusNote--cancelled">
                  <Icon icon="mdi:close-circle-outline" />
                  <span>
                    ยกเลิกคำสั่งซื้อแล้ว
                    {order.payment_status === "paid" && (
                      <> · คืนเงิน {fmtBaht(order.total_price)} ภายใน 3–5 วันทำการ</>
                    )}
                  </span>
                </div>
              )}

              {["pending", "confirmed"].includes(order.order_status) && (
                <div className="odStatusNote odStatusNote--pending">
                  <Icon icon="mdi:clock-outline" />
                  ผู้ขายกำลังเตรียมสินค้า กรุณารอการยืนยันการจัดส่ง
                </div>
              )}
            </div>

            {/* ══ 2. TRACKING CARD ══ */}
            {order.tracking_number && (
              <div className="odCard odCard--tracking">
                <div className="odTrackingTop">
                  <div className="odTrackingInfo">
                    <div className="odTrackingLabel">
                      <Icon icon="mdi:barcode-scan" />เลขพัสดุ
                    </div>
                    <div className="odTrackingNumber">{order.tracking_number}</div>
                    {providerName && (
                      <div className="odTrackingProvider">
                        <Icon icon="mdi:truck-fast-outline" />
                        {providerName}
                        {order.shipping_date && ` · ${fmtDate(order.shipping_date)}`}
                      </div>
                    )}
                  </div>
                  <div className="odTrackingActions">
                    <button
                      className={`odCopyBtn ${copied ? "odCopyBtn--done" : ""}`}
                      onClick={handleCopy} title="คัดลอกเลขพัสดุ"
                    >
                      <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} />
                    </button>
                    {trackingUrl && (
                      <a className="odTrackBtn" href={trackingUrl} target="_blank" rel="noopener noreferrer">
                        <Icon icon="mdi:open-in-new" style={{ fontSize: 13 }} />ติดตาม
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ 3. ITEMS CARD ══ */}
            <div className="odCard">
              <div className="odSectionTitle">
                <Icon icon="mdi:shopping-outline" />
                รายการสินค้า
                <span className="odSectionCount">{items.length} รายการ</span>
              </div>
              <div className="odItems">
                {items.map((item, i) => {
                  const sizeStr = getSizeText(item.size, item.category_id);
                  return (
                    <div className="odItem" key={i}>
                      <ProductImage item={item} />
                      <div className="odItemInfo">
                        <div className="odItemTitle">{item.product_title}</div>
                        <div className="odItemMeta">
                          {item.school_name && (
                            <span className="odItemTag odItemTag--school">
                              <Icon icon="mdi:school-outline" style={{ fontSize: 11 }} />
                              {item.school_name}
                            </span>
                          )}
                          {sizeStr && <span className="odItemTag">ไซส์ {sizeStr}</span>}
                          <span className="odItemTag odItemTag--qty">× {item.quantity} ชิ้น</span>
                        </div>
                        {item.seller_name && (
                          <div className="odItemSeller">
                            <Icon icon="mdi:storefront-outline" style={{ fontSize: 12 }} />
                            ผู้ขาย: {item.seller_name}
                            {item.seller_phone && (
                              <span className="odSellerPhone"> · {item.seller_phone}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="odItemPrice">
                        {fmtBaht(Number(item.price_at_purchase) * item.quantity)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ══ 4. ADDRESS + SHIPPING ══ */}
            <div className="odCard">
              <div className="odSectionTitle">
                <Icon icon="mdi:map-marker-outline" />ที่อยู่จัดส่ง
              </div>
              <div className="odAddress">
                <div className="odAddressName">
                  <Icon icon="mdi:account-circle-outline" style={{ fontSize: 16, color: "#3b82f6" }} />
                  {order.recipient_name}
                </div>
                {order.shipping_phone && (
                  <div className="odAddressLine">
                    <Icon icon="mdi:phone-outline" style={{ fontSize: 14, color: "#64748b", flexShrink: 0 }} />
                    {order.shipping_phone}
                  </div>
                )}
                <div className="odAddressLine">
                  <Icon icon="mdi:home-outline" style={{ fontSize: 14, color: "#64748b", flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {order.shipping_address}
                    {order.shipping_province && `, ${order.shipping_province}`}
                    {order.shipping_postcode && ` ${order.shipping_postcode}`}
                  </span>
                </div>
              </div>

              {shipping.length > 0 && (
                <>
                  <div className="odInnerDivider" />
                  <div className="odSectionTitle" style={{ paddingTop: 14, paddingBottom: 10 }}>
                    <Icon icon="mdi:truck-outline" />บริการขนส่ง
                  </div>
                  {shipping.map((s, i) => (
                    <div className="odShippingRow" key={i}>
                      <span className="odShippingName">
                        <Icon icon="mdi:truck-fast-outline" style={{ color: "#3b82f6" }} />
                        {s.provider_name || "ไม่ระบุขนส่ง"}
                      </span>
                      <span className="odShippingPrice">{fmtBaht(s.shipping_price)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ══ 5. PRICE SUMMARY ══ */}
            <div className="odCard odCard--summary">
              <div className="odSummaryRow">
                <span>ยอดสินค้า ({items.length} รายการ)</span>
                <span>{fmtBaht(subtotal)}</span>
              </div>
              <div className="odSummaryRow">
                <span>ค่าจัดส่ง</span>
                <span>{fmtBaht(shippingTotal)}</span>
              </div>
              <div className="odSummaryDivider" />
              <div className="odSummaryTotal">
                <span>ยอดรวมทั้งหมด</span>
                <span className="odTotalPrice">{fmtBaht(order.total_price)}</span>
              </div>
            </div>

            {/* ══ 6. ACTION MESSAGE ══ */}
            {actionMsg && (
              <div className={`odAlert ${
                actionMsg.includes("ข้อผิดพลาด") || actionMsg.includes("ไม่") || actionMsg.includes("สามารถ")
                  ? "odAlert--error" : "odAlert--success"
              }`}>
                <Icon icon={
                  actionMsg.includes("ข้อผิดพลาด") || actionMsg.includes("ไม่") || actionMsg.includes("สามารถ")
                    ? "mdi:alert-circle" : "mdi:check-circle"
                } />
                {actionMsg}
              </div>
            )}

            {/* ══ 7. ACTION BUTTONS ══ */}
            {(canConfirm || canCancel) && (
              <div className="odCard odCard--actions">
                {canConfirm && (
                  <div className="odConfirmWrap">
                    <button
                      className="odConfirmBtn"
                      disabled={actionLoading}
                      onClick={() => handleAction("confirm-receipt")}
                    >
                      <Icon
                        icon={actionLoading ? "mdi:loading" : "mdi:check-circle-outline"}
                        className={actionLoading ? "odSpin" : ""}
                      />
                      {actionLoading ? "กำลังดำเนินการ..." : "ยืนยันได้รับสินค้าแล้ว"}
                    </button>
                    <div className="odConfirmHint">
                      <Icon icon="mdi:information-outline" style={{ fontSize: 12 }} />
                      หากไม่กดภายใน 7 วัน ระบบจะยืนยันอัตโนมัติ
                    </div>
                  </div>
                )}
                {canCancel && (
                  <button
                    className="odCancelBtn" disabled={actionLoading}
                    onClick={() => handleAction("cancel")}
                  >
                    <Icon icon="mdi:close-circle-outline" />
                    {actionLoading ? "กำลังดำเนินการ..." : "ยกเลิกคำสั่งซื้อ"}
                  </button>
                )}
              </div>
            )}

            {/* ══ 8. BOTTOM NAV ══ */}
            <div className="odBottomNav">
              <Link to="/orders" className="odNavBtn odNavBtn--secondary">
                <Icon icon="mdi:format-list-bulleted" />คำสั่งซื้อทั้งหมด
              </Link>
              <Link to="/market" className="odNavBtn odNavBtn--primary">
                <Icon icon="mdi:shopping-outline" />ช้อปปิ้งต่อ
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
