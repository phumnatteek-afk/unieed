import { useState, useEffect } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import { formatOrderNo } from "../../../utils/orderNo.js";
import "../styles/OrderDetailPage.css";

const STATUS_MAP = {
  pending:   { label: "รอดำเนินการ",  color: "#f59e0b", icon: "mdi:clock-outline" },
  confirmed: { label: "ยืนยันแล้ว",   color: "#3b82f6", icon: "mdi:check-circle-outline" },
  shipped:   { label: "จัดส่งแล้ว",   color: "#8b5cf6", icon: "mdi:truck-fast-outline" },
  delivered: { label: "ได้รับสินค้า", color: "#22c55e", icon: "mdi:package-variant-closed-check" },
  cancelled: { label: "ยกเลิกแล้ว",  color: "#ef4444", icon: "mdi:close-circle-outline" },
};

const PAY_MAP = {
  paid:   { label: "ชำระแล้ว",  color: "#22c55e" },
  unpaid: { label: "ยังไม่ชำระ", color: "#f59e0b" },
};

// คืน true ถ้า shipping_date เกิน 7 วันแล้ว (ผู้ซื้อยกเลิกได้)
const shippedOver7Days = (shippingDate) => {
  if (!shippingDate) return false;
  return Date.now() - new Date(shippingDate).getTime() > 7 * 24 * 60 * 60 * 1000;
};

export default function OrderDetailPage() {
  const { token }  = useAuth();
  const { id }     = useParams();
  const location   = useLocation();
  const navigate   = useNavigate();
  const successMsg = location.state?.successMsg;

  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]         = useState("");

  const loadOrder = () => {
    if (!token || !id) return;
    setLoading(true);
    fetch(`/api/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.order_id) setOrder(data);
        else setErr(data.message || "ไม่พบ order");
      })
      .catch(() => setErr("เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrder(); }, [token, id]);

  const handleAction = async (action) => {
    if (!window.confirm(
      action === "confirm-receipt"
        ? "ยืนยันว่าได้รับสินค้าแล้ว?"
        : "ยืนยันการยกเลิกคำสั่งซื้อนี้?"
    )) return;
    setActionLoading(true); setActionMsg("");
    try {
      const res = await fetch(`/api/orders/${id}/${action}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
      setActionMsg(data.message || "ดำเนินการเรียบร้อย");
      loadOrder();
    } catch (e) {
      setActionMsg(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const status  = STATUS_MAP[order?.order_status] || STATUS_MAP.pending;
  const payInfo = PAY_MAP[order?.payment_status] || PAY_MAP.unpaid;

  return (
    <div className="pageContainer">

      {/* Header */}
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>

          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/market">ร้านค้า</Link>
            <Link to="/orders">คำสั่งซื้อของฉัน</Link>
          </nav>

          <ProfileDropdown />
        </div>
      </header>

      <div className="contentWrapper">

        {/* Success */}
        {successMsg && (
          <div className="successBox">
            <Icon icon="mdi:check-circle" className="successIcon" />
            <span className="successText">{successMsg}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loadingBox">
            <Icon icon="mdi:loading" className="loadingIcon" />
            <p>กำลังโหลด...</p>
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="errorBox">
            <Icon icon="mdi:alert-circle" className="errorIcon" />
            <p>{err}</p>
          </div>
        )}

        {/* Content */}
        {order && !loading && (
          <>
            {/* Header Card */}
            <div className="card orderHeader">
              <div>
                <div className="orderLabel">คำสั่งซื้อ</div>
                <div className="orderId">{formatOrderNo(order.order_id)}</div>
                <div className="orderDate">
                  {new Date(order.created_at).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              <div className="statusGroup">
                <span
                  className="statusBadge"
                  style={{ background: status.color + "20", color: status.color }}
                >
                  <Icon icon={status.icon} />
                  {status.label}
                </span>

                <span
                  className="paymentBadge"
                  style={{ background: payInfo.color + "20", color: payInfo.color }}
                >
                  {payInfo.label}
                  {order.payment_method === "card" && " · บัตรเครดิต"}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="card">
              <div className="sectionTitle">รายการสินค้า</div>

              {(order.items || []).map((item, i) => (
                <div className="itemRow" key={i}>
                  <div className="itemImage">
                    {item.cover_image ? (
                      <img src={item.cover_image} alt={item.product_title} />
                    ) : (
                      <Icon icon="mdi:tshirt-crew" />
                    )}
                  </div>

                  <div className="itemInfo">
                    <div className="itemTitle">{item.product_title}</div>
                    <div className="itemQty">× {item.quantity} ชิ้น</div>
                  </div>

                  <div className="itemPrice">
                    {(Number(item.price_at_purchase) * item.quantity).toLocaleString()} บาท
                  </div>
                </div>
              ))}
            </div>

            {/* Address + Shipping */}
            <div className="card gridTwo">
              <div>
                <div className="sectionTitle">
                  <Icon icon="mdi:map-marker-outline" />
                  ที่อยู่จัดส่ง
                </div>

                <div className="addressText">
                  <b>{order.recipient_name}</b><br />
                  {order.shipping_phone}<br />
                  {order.shipping_address}<br />
                  {order.shipping_province} {order.shipping_postcode}
                </div>
              </div>

              <div>
                <div className="sectionTitle">
                  <Icon icon="mdi:truck-outline" />
                  การจัดส่ง
                </div>

                {(order.shipping || []).map((s, i) => (
                  <div className="shippingRow" key={i}>
                    <span className="shippingName">
                      {s.provider_name || s.provider_id}
                    </span>
                    <span className="shippingPrice">
                      · {Number(s.shipping_price).toLocaleString()} บาท
                    </span>

                    {s.tracking_no && (
                      <div className="tracking">
                        🚚 Tracking: {s.tracking_no}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="card">
              <div className="summaryRow">
                <span>ยอดสินค้า</span>
                <span>
                  {((order.items || []).reduce((s, i) =>
                    s + Number(i.price_at_purchase) * i.quantity, 0
                  )).toLocaleString()} บาท
                </span>
              </div>

              <div className="summaryRow">
                <span>ค่าจัดส่ง</span>
                <span>
                  {((order.shipping || []).reduce((s, sh) =>
                    s + Number(sh.shipping_price), 0
                  )).toLocaleString()} บาท
                </span>
              </div>

              <div className="divider" />

              <div className="summaryTotal">
                <span>ยอดรวม</span>
                <span className="totalPrice">
                  {Number(order.total_price).toLocaleString()} บาท
                </span>
              </div>
            </div>

            {/* Buyer action message */}
            {actionMsg && (
              <div className={actionMsg.includes("ข้อผิดพลาด") || actionMsg.includes("ไม่") || actionMsg.includes("สามารถ")
                ? "errorBox" : "successBox"}
                style={{ marginBottom: 12 }}>
                <Icon icon={actionMsg.includes("ข้อผิดพลาด") || actionMsg.includes("ไม่") || actionMsg.includes("สามารถ")
                  ? "mdi:alert-circle" : "mdi:check-circle"} />
                <span style={{ marginLeft: 8 }}>{actionMsg}</span>
              </div>
            )}

            {/* Buyer action buttons */}
            {(() => {
              const canConfirm = order.order_status === "shipping";
              const canCancel  =
                order.order_status === "pending" ||
                (order.order_status === "shipping" && shippedOver7Days(order.shipping_date));

              if (!canConfirm && !canCancel) return null;
              return (
                <div className="card" style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                  {canConfirm && (
                    <button
                      className="btn btnPrimary"
                      disabled={actionLoading}
                      onClick={() => handleAction("confirm-receipt")}
                    >
                      <Icon icon="mdi:check-circle-outline" style={{ marginRight:6 }} />
                      {actionLoading ? "กำลังดำเนินการ..." : "ยืนยันรับสินค้าแล้ว"}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      className="btn btnDanger"
                      disabled={actionLoading}
                      onClick={() => handleAction("cancel")}
                    >
                      <Icon icon="mdi:close-circle-outline" style={{ marginRight:6 }} />
                      {actionLoading ? "กำลังดำเนินการ..." : "ยกเลิกคำสั่งซื้อ"}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Buttons */}
            <div className="buttonGroup">
              <Link to="/orders" className="btn btnSecondary">
                ดูคำสั่งซื้อทั้งหมด
              </Link>

              <Link to="/market" className="btn btnPrimary">
                ช้อปปิ้งต่อ
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}