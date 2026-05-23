import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import { formatOrderNo } from "../../../utils/orderNo.js";
import "../styles/MyOrdersPage.css";

/* ── Constants ───────────────────────────────────────────── */
const TABS = [
  { key: "all",       label: "ทั้งหมด",    icon: "mdi:format-list-bulleted" },
  { key: "pending",   label: "รอจัดส่ง",   icon: "mdi:clock-outline" },
  { key: "shipping",  label: "จัดส่งแล้ว", icon: "mdi:truck-delivery-outline" },
  { key: "delivered", label: "สำเร็จ",     icon: "mdi:check-circle-outline" },
  { key: "cancelled", label: "ยกเลิก",     icon: "mdi:close-circle-outline" },
];

const TAB_STATUSES = {
  all:       null,
  pending:   ["pending", "confirmed"],
  shipping:  ["shipping"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

const STATUS_BADGE = {
  pending:   { label: "รอจัดส่ง",   icon: "mdi:clock-outline",          cls: "badge--pending"   },
  confirmed: { label: "รอจัดส่ง",   icon: "mdi:clock-outline",          cls: "badge--pending"   },
  shipping:  { label: "จัดส่งแล้ว", icon: "mdi:truck-delivery-outline", cls: "badge--shipping"  },
  delivered: { label: "สำเร็จ",     icon: "mdi:check-circle-outline",   cls: "badge--delivered" },
  cancelled: { label: "ยกเลิก",     icon: "mdi:close-circle-outline",   cls: "badge--cancelled" },
};

/* ── Shipping provider tracking URLs ─────────────────────── */
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
  "SCG Yamato":       (no) => `https://www.scgyamato.co.th/tracking?trackingNo=${no}`,
  "DHL":              (no) => `https://www.dhl.com/th-en/home/tracking.html?tracking-id=${no}`,
  "Ninja Van":        (no) => `https://www.ninjavan.co/th-th/tracking?id=${no}`,
  "NinjaVan":         (no) => `https://www.ninjavan.co/th-th/tracking?id=${no}`,
  "Best Express":     (no) => `https://www.best-inc-th.com/track/${no}`,
  "Shopee Express":   (no) => `https://spx.co.th/tracking?trackingNumber=${no}`,
  "Lazada Logistics": (no) => `https://lazada.co.th/track`,
};

const getTrackingUrl = (providerName, trackingNo) => {
  if (!providerName || !trackingNo) return null;
  // ค้นหา provider แบบ case-insensitive partial match
  const key = Object.keys(TRACKING_URLS).find(k =>
    providerName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(providerName.toLowerCase())
  );
  return key ? TRACKING_URLS[key](trackingNo) : null;
};

/* ── Helpers ─────────────────────────────────────────────── */
const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString();

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

const getSizeText = (size, categoryId) => {
  if (!size) return "";
  let s = size;
  if (typeof s === "string") {
    try { s = JSON.parse(s); } catch { return String(size); }
  }
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

const shippedOver7Days = (shippingDate) => {
  if (!shippingDate) return false;
  return Date.now() - new Date(shippingDate).getTime() > 7 * 24 * 60 * 60 * 1000;
};

/* ── Product Image ───────────────────────────────────────── */
function ProductImage({ item }) {
  const [imgErr, setImgErr] = useState(false);

  // รองรับ field names หลายแบบจาก API (cover_image, image_url, image, thumbnail)
  const imgUrl =
    item.cover_image ||
    item.image_url  ||
    item.image      ||
    item.thumbnail  ||
    (item.product_id ? `/api/products/${item.product_id}/cover` : null);

  if (!imgUrl || imgErr) {
    return (
      <div className="moItemThumb moItemThumb--fallback">
        <Icon icon="mdi:tshirt-crew-outline" />
      </div>
    );
  }

  return (
    <div className="moItemThumb">
      <img
        src={imgUrl}
        alt={item.product_title || item.title || "สินค้า"}
        onError={() => setImgErr(true)}
        loading="lazy"
      />
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function MyOrdersPage() {
  const { token }                       = useAuth();
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";

  const [orders,      setOrders]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");
  const [actionState, setActionState] = useState({});

  /* ── Load orders ── */
  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr("");
    try {
      const res  = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "โหลดไม่สำเร็จ");
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  /* ── Filter by tab ── */
  const filtered = orders.filter((o) => {
    const allowed = TAB_STATUSES[activeTab];
    if (!allowed) return true;
    return allowed.includes(o.order_status);
  });

  /* ── Tab counts ── */
  const counts = TABS.reduce((acc, t) => {
    const s = TAB_STATUSES[t.key];
    acc[t.key] = s ? orders.filter(o => s.includes(o.order_status)).length : orders.length;
    return acc;
  }, {});

  /* ── Buyer actions ── */
  const doAction = async (orderId, action) => {
    const label = action === "confirm-receipt"
      ? "ยืนยันว่าได้รับสินค้าแล้ว?"
      : "ยืนยันการยกเลิกคำสั่งซื้อนี้?";
    if (!window.confirm(label)) return;
    setActionState(s => ({ ...s, [orderId]: "loading" }));
    try {
      const res  = await fetch(`/api/orders/${orderId}/${action}`, {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
      setActionState(s => ({ ...s, [orderId]: "done" }));
      await loadOrders();
    } catch (e) {
      window.alert(e.message);
      setActionState(s => ({ ...s, [orderId]: null }));
    }
  };

  return (
    <div className="moPage">
      {/* ── Header bar (title + profile only) ── */}
      <header className="moHeader">
        <div className="moHeaderInner">
          <button className="moBack" onClick={() => navigate(-1)}>
            <Icon icon="mdi:chevron-left" />
          </button>
          <span className="moHeaderTitle">รายการสั่งซื้อของฉัน</span>
          <div className="moHeaderRight">
            <ProfileDropdown />
          </div>
        </div>
      </header>

      {/* ── Tabs (แยกออกจาก header เป็นแถบใต้) ── */}
      <div className="moTabsBar">
        <div className="moTabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`moTab ${activeTab === t.key ? "moTab--active" : ""}`}
              onClick={() => setSearchParams({ tab: t.key })}
            >
              <Icon icon={t.icon} className="moTabIcon" />
              {t.label}
              {counts[t.key] > 0 && activeTab !== t.key && (
                <span className="moTabCount">{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="moBody">
        {loading && (
          <div className="moCenterMsg">
            <div className="moLoadingRing" />
            <p>กำลังโหลด...</p>
          </div>
        )}
        {err && (
          <div className="moCenterMsg moErr">
            <Icon icon="mdi:alert-circle-outline" style={{ fontSize: 40 }} />
            <p>{err}</p>
          </div>
        )}
        {!loading && !err && filtered.length === 0 && (
          <div className="moCenterMsg">
            <div className="moEmptyIcon">
              <Icon icon="mdi:package-variant-closed" />
            </div>
            <p className="moEmptyTitle">ไม่มีรายการในแถบนี้</p>
            <p className="moEmptySubtitle">ไปช้อปปิ้งสินค้าใหม่กันเถอะ</p>
            <Link to="/market" className="moShopBtn">
              <Icon icon="mdi:shopping-outline" />
              เริ่มช้อปปิ้ง
            </Link>
          </div>
        )}

        {!loading && filtered.map((order, idx) => (
          <OrderCard
            key={order.order_id}
            order={order}
            index={idx}
            actionLoading={actionState[order.order_id] === "loading"}
            onConfirm={() => doAction(order.order_id, "confirm-receipt")}
            onCancel={() => doAction(order.order_id, "cancel")}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Order Card ──────────────────────────────────────────── */
function OrderCard({ order, index, actionLoading, onConfirm, onCancel }) {
  const badge = STATUS_BADGE[order.order_status] || STATUS_BADGE.pending;
  const items = (() => {
    try {
      return Array.isArray(order.items)
        ? order.items
        : JSON.parse(order.items || "[]");
    } catch { return []; }
  })();

  const shippingTotal = Number(order.shipping_total || 0);
  const canCancel =
    ["pending", "confirmed"].includes(order.order_status) ||
    (order.order_status === "shipping" && shippedOver7Days(order.shipping_date));
  const canConfirm = order.order_status === "shipping";

  const SHOW_MAX   = 2;
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, SHOW_MAX);
  const hiddenCount  = items.length - SHOW_MAX;

  /* tracking URL */
  const trackingUrl = getTrackingUrl(order.shipping_provider_name, order.tracking_number);

  /* copy state */
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(order.tracking_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className={`moCard moCard--${order.order_status}`}
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* ── Card Header ── */}
      <div className="moCardHead">
        <div className="moCardHeadLeft">
          <span className="moOrderId">{formatOrderNo(order.order_id)}</span>
          <span className="moOrderDate">
            <Icon icon="mdi:calendar-outline" style={{ fontSize: 12, marginRight: 3 }} />
            {fmtDate(order.created_at)}
          </span>
        </div>
        <div className={`moStatusBadge ${badge.cls}`}>
          <Icon icon={badge.icon} />
          {badge.label}
        </div>
      </div>

      {/* ── Items ── */}
      <div className="moItems">
        {visibleItems.map((it, i) => {
          const displayTitle = it.product_title || it.title || `สินค้า #${it.product_id}`;
          const sizeStr = getSizeText(it.size, it.category_id);
          return (
            <div className="moItem" key={i}>
              <ProductImage item={it} />
              <div className="moItemInfo">
                <div className="moItemName">{displayTitle}</div>
                <div className="moItemMeta">
                  {sizeStr && <span className="moItemTag">ไซส์ {sizeStr}</span>}
                  <span className="moItemTag moItemTag--qty">× {it.qty}</span>
                </div>
              </div>
              <div className="moItemPrice">{fmtBaht(Number(it.price_at_purchase ?? it.price) * Number(it.qty))}</div>
            </div>
          );
        })}

        {hiddenCount > 0 && (
          <button className="moShowMore" onClick={() => setExpanded(v => !v)}>
            <Icon icon={expanded ? "mdi:chevron-up" : "mdi:chevron-down"} />
            {expanded ? "ซ่อน" : `+ อีก ${hiddenCount} รายการ`}
          </button>
        )}
      </div>

      {/* ── Shipping tracking (แสดงเมื่อมี tracking_number ไม่ว่าสถานะอะไร) ── */}
      {order.tracking_number && (
        <div className="moTracking">
          <div className="moTrackingTop">
            <div className="moTrackingInfo">
              <div className="moTrackingLabel">
                <Icon icon="mdi:barcode-scan" style={{ fontSize: 12 }} />
                เลขพัสดุ
              </div>
              <div className="moTrackingNumberRow">
                <span className="moTrackingNumber">{order.tracking_number}</span>
              </div>
              {order.shipping_provider_name && (
                <div className="moTrackingProvider">
                  <Icon icon="mdi:truck-fast-outline" style={{ fontSize: 13 }} />
                  {order.shipping_provider_name}
                  {order.shipping_date && ` · ${fmtDate(order.shipping_date)}`}
                </div>
              )}
            </div>

            <div className="moTrackingActions">
              <button
                className={`moTrackingCopy ${copied ? "moTrackingCopy--done" : ""}`}
                onClick={handleCopy}
                title="คัดลอกเลขพัสดุ"
              >
                <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} />
              </button>
              {trackingUrl && (
                <a
                  className="moTrackingLink"
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="ติดตามพัสดุ"
                >
                  <Icon icon="mdi:open-in-new" style={{ fontSize: 14 }} />
                  ติดตาม
                </a>
              )}
            </div>
          </div>

          {order.order_status === "shipping" && (
            <ShippingProgress status={order.order_status} />
          )}
        </div>
      )}

      {/* ── Pending note ── */}
      {["pending", "confirmed"].includes(order.order_status) && (
        <div className="moStatusNote moStatusNote--pending">
          <Icon icon="mdi:clock-outline" />
          ผู้ขายกำลังเตรียมสินค้า กรุณารอการยืนยันการจัดส่ง
        </div>
      )}

      {/* ── Cancelled note ── */}
      {order.order_status === "cancelled" && (
        <div className="moStatusNote moStatusNote--cancelled">
          <Icon icon="mdi:close-circle-outline" />
          <span>
            ยกเลิกคำสั่งซื้อแล้ว
            {order.payment_status === "paid" && (
              <> · คืนเงิน {fmtBaht(order.total_price)} ภายใน 3–5 วันทำการ</>
            )}
          </span>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="moCardFoot">
        <div className="moTotal">
          <span className="moTotalLabel">
            ยอดรวม
            {shippingTotal > 0 && (
              <span className="moTotalSub"> (รวมค่าส่ง {fmtBaht(shippingTotal)})</span>
            )}
          </span>
          <span className="moTotalAmt">{fmtBaht(order.total_price)}</span>
        </div>

        <div className="moActions">
          {canConfirm && (
            <div className="moConfirmWrap">
              <button
                className="moConfirmBtn"
                disabled={actionLoading}
                onClick={onConfirm}
              >
                <Icon
                  icon={actionLoading ? "mdi:loading" : "mdi:check-circle-outline"}
                  className={actionLoading ? "moSpinInline" : ""}
                />
                {actionLoading ? "กำลังดำเนินการ..." : "ยืนยันได้รับสินค้าแล้ว"}
              </button>
              <div className="moConfirmHint">
                <Icon icon="mdi:information-outline" style={{ fontSize: 12 }} />
                หากไม่กดภายใน 7 วัน ระบบจะยืนยันอัตโนมัติ
              </div>
            </div>
          )}

          <div className="moActionsRow">
            {canCancel && !canConfirm && (
              <button
                className="moCancelBtn"
                disabled={actionLoading}
                onClick={onCancel}
              >
                <Icon icon="mdi:close" />
                {actionLoading ? "กำลังดำเนินการ..." : "ยกเลิก"}
              </button>
            )}
            <Link to={`/orders/${order.order_id}`} className="moDetailBtn">
              <Icon icon="mdi:receipt-text-outline" />
              ดูรายละเอียด
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shipping Progress Bar ───────────────────────────────── */
function ShippingProgress({ status }) {
  const steps = [
    { label: "สั่งซื้อสำเร็จ",  done: true,  icon: "mdi:shopping-outline" },
    { label: "จัดส่งแล้ว",      done: status === "shipping" || status === "delivered", icon: "mdi:package-variant-closed" },
    { label: "กำลังขนส่ง",      done: status === "shipping", active: status === "shipping", icon: "mdi:truck-fast-outline" },
    { label: "ได้รับสินค้า",    done: status === "delivered", icon: "mdi:home-outline" },
  ];

  return (
    <div className="moProgress">
      {steps.map((step, i) => (
        <div className="moProgressStep" key={i}>
          {i > 0 && (
            <div className={`moProgressLine ${steps[i - 1].done ? "moProgressLine--done" : ""}`} />
          )}
          <div className={`moProgressDot ${step.done ? "moProgressDot--done" : ""} ${step.active ? "moProgressDot--active" : ""}`}>
            {step.active
              ? <div className="moProgressPulse" />
              : <Icon icon={step.icon} style={{ fontSize: 11 }} />
            }
          </div>
          <div className={`moProgressLabel ${step.done || step.active ? "moProgressLabel--done" : ""}`}>
            {step.label}
          </div>
        </div>
      ))}
    </div>
  );
}