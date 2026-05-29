import { useEffect, useState, useCallback } from "react";
import { request } from "../../../api/http.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import "../styles/admin.css";
import "../styles/backoffice.css";
import "../styles/adminPages.css";
import { Icon } from "@iconify/react";
import { formatOrderNo } from "../../../utils/orderNo.js";

/* ── Shipping tracking URLs (same as buyer page) ── */
const TRACKING_URLS = {
  "ไทยไปรษณีย์":     (n) => `https://track.thailandpost.co.th/?trackNumber=${n}`,
  "Thailand Post":    (n) => `https://track.thailandpost.co.th/?trackNumber=${n}`,
  "EMS":              (n) => `https://track.thailandpost.co.th/?trackNumber=${n}`,
  "Kerry":            (n) => `https://th.kerryexpress.com/th/track/?track=${n}`,
  "Kerry Express":    (n) => `https://th.kerryexpress.com/th/track/?track=${n}`,
  "Flash":            (n) => `https://www.flashexpress.co.th/tracking/?se=${n}`,
  "Flash Express":    (n) => `https://www.flashexpress.co.th/tracking/?se=${n}`,
  "J&T":              (n) => `https://www.jtexpress.co.th/trajectoryQuery?bills=${n}`,
  "J&T Express":      (n) => `https://www.jtexpress.co.th/trajectoryQuery?bills=${n}`,
  "SCG Yamato":       (n) => `https://www.scgyamato.co.th/tracking?trackingNo=${n}`,
  "DHL":              (n) => `https://www.dhl.com/th-en/home/tracking.html?tracking-id=${n}`,
  "Ninja Van":        (n) => `https://www.ninjavan.co/th-th/tracking?id=${n}`,
  "NinjaVan":         (n) => `https://www.ninjavan.co/th-th/tracking?id=${n}`,
  "Best Express":     (n) => `https://www.best-inc-th.com/track/${n}`,
  "Shopee Express":   (n) => `https://spx.co.th/tracking?trackingNumber=${n}`,
  "Lazada Logistics": () => `https://lazada.co.th/track`,
};
const getTrackingUrl = (providerName, trackingNo) => {
  if (!trackingNo) return null;
  if (!providerName) return null;
  const key = Object.keys(TRACKING_URLS).find(k =>
    providerName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(providerName.toLowerCase())
  );
  return key ? TRACKING_URLS[key](trackingNo) : null;
};

const ORDER_TIME_FILTERS = [
  { v: "today",   l: "วันนี้",   icon: "mdi:weather-sunny" },
  { v: "month",   l: "เดือนนี้", icon: "mdi:calendar-month" },
  { v: "3months", l: "3 เดือน",  icon: "mdi:calendar-range" },
  { v: "6months", l: "6 เดือน",  icon: "mdi:calendar-range" },
  { v: "year",    l: "1 ปี",     icon: "mdi:calendar-year" },
];

const STATUS_TABS = [
  { key: "",          label: "ทั้งหมด" },
  { key: "pending",   label: "รอจัดส่ง" },
  { key: "shipping",  label: "กำลังจัดส่ง" },
  { key: "delivered", label: "สำเร็จ" },
  { key: "cancelled", label: "ยกเลิก" },
];

const STATUS_BADGE = {
  pending:   { cls: "admBadge--amber", label: "รอจัดส่ง",    dot: "#f59e0b" },
  confirmed: { cls: "admBadge--amber", label: "รอจัดส่ง",    dot: "#f59e0b" },
  shipping:  { cls: "admBadge--blue",  label: "กำลังจัดส่ง", dot: "#3b82f6" },
  delivered: { cls: "admBadge--green", label: "สำเร็จ",       dot: "#22c55e" },
  cancelled: { cls: "admBadge--red",   label: "ยกเลิก",       dot: "#ef4444" },
};

const PAY_BADGE = {
  paid:   { cls: "admBadge--green", label: "ชำระแล้ว" },
  unpaid: { cls: "admBadge--red",   label: "ยังไม่ชำระ" },
};

const getSizeText = (size, categoryId) => {
  if (!size) return "-";
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
  return parts.join(" / ") || "-";
};

const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString();
const fmtDate = (d) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

/* ── inline styles ── */
const thSt = { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" };
const tdSt = { padding: "13px 16px", verticalAlign: "middle" };
const badgeSt = { display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 };
const btnSt = (color) => ({
  background: color + "15", color, border: `1px solid ${color}40`,
  borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap",
});

export default function AdminOrderPage() {
  const [stats, setStats]               = useState({ total: 0, pending: 0, shipping: 0, delivered: 0, cancelled: 0 });
  const [rows, setRows]                 = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ]                       = useState("");
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [loading, setLoading]           = useState(true);
  const [err, setErr]                   = useState("");
  const [toast, setToast]               = useState(null);
  const [detail, setDetail]             = useState(null);
  const [period, setPeriod]             = useState("month");
  const [startDate, setStartDate]       = useState("");
  const [endDate, setEndDate]           = useState("");
  const [showPicker, setShowPicker]     = useState(false);

  const now     = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true); setErr("");
      const params = new URLSearchParams({ status: statusFilter, q, page, limit: 10 });
      if (period !== "custom") params.set("period", period);
      if (period === "custom" && startDate) params.set("start_date", startDate);
      if (period === "custom" && endDate) params.set("end_date", endDate);
      const data = await request(`/admin/orders?${params}`, { method: "GET", auth: true });
      setStats(data.stats || {});
      setRows(data.rows || []);
      setTotalPages(data.total_pages || 1);
    } catch (e) {
      setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally { setLoading(false); }
  }, [statusFilter, q, page, period, startDate, endDate]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); loadOrders(); };

  const handleCancel = async (orderId) => {
    if (!window.confirm("ยืนยันการยกเลิกออเดอร์นี้?")) return;
    try {
      await request(`/admin/orders/${orderId}/cancel`, { method: "PATCH", auth: true });
      showToast("ยกเลิกออเดอร์แล้ว"); loadOrders();
    } catch (e) { showToast(e?.data?.message || "เกิดข้อผิดพลาด", "error"); }
  };

  const openDetail = async (orderId) => {
    try {
      const d = await request(`/admin/orders/${orderId}`, { method: "GET", auth: true });
      setDetail(d);
    } catch (e) { showToast("โหลดรายละเอียดไม่สำเร็จ", "error"); }
  };

  const statCards = [
    { key: "total",     label: "ทั้งหมด",      icon: "mdi:receipt-text-outline",  color: "#3b82f6", bg: "#eff6ff" },
    { key: "pending",   label: "รอจัดส่ง",     icon: "mdi:clock-outline",          color: "#f59e0b", bg: "#fffbeb" },
    { key: "shipping",  label: "กำลังจัดส่ง",  icon: "mdi:truck-delivery-outline", color: "#06b6d4", bg: "#ecfeff" },
    { key: "delivered", label: "สำเร็จ",        icon: "mdi:package-check",          color: "#22c55e", bg: "#f0fdf4" },
    { key: "cancelled", label: "ยกเลิก",        icon: "mdi:close-octagon-outline",  color: "#ef4444", bg: "#fef2f2" },
  ];

  return (
    <div className="boPage admOrderPage">
      <div className="boTop">
        <div className="boTitle">จัดการออเดอร์</div>
        <div className="boAdmin"><NotificationBell /><ProfileDropdown /></div>
      </div>

      <div className="boPageInner admOrderInner">
        <div className="admOrderMetaRow">
          <p className="admOrderSubhead">ติดตามคำสั่งซื้อ สถานะการชำระ และการจัดส่งในตลาดมือสอง</p>
          <div className="admOrderDatePill">
            <Icon icon="mdi:calendar-clock" style={{ fontSize: 16 }} />
            {dateStr} · {timeStr}
          </div>
        </div>

        {/* ── Time filter ── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "14px 18px", marginBottom: 16, boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:clock-time-four-outline" style={{ color: "#fff", fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>ช่วงเวลา</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>กรองออเดอร์ตามช่วงเวลาที่เลือก</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "5px 12px" }}>
              <Icon icon="mdi:calendar-check" style={{ color: "#1d4ed8", fontSize: 14 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
                {period === "custom" && startDate && endDate ? `${startDate} → ${endDate}` : { today: "วันนี้", month: "เดือนนี้", "3months": "ย้อนหลัง 3 เดือน", "6months": "ย้อนหลัง 6 เดือน", year: "ย้อนหลัง 1 ปี" }[period] || "เดือนนี้"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {ORDER_TIME_FILTERS.map((t) => {
              const isActive = period === t.v && !showPicker;
              return (
                <button key={t.v} type="button"
                  onClick={() => { setPeriod(t.v); setShowPicker(false); setPage(1); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, border: "1.5px solid", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s ease", background: isActive ? "#1d4ed8" : "#f8fafc", color: isActive ? "#fff" : "#475569", borderColor: isActive ? "#1d4ed8" : "#e2e8f0", boxShadow: isActive ? "0 2px 8px rgba(29,78,216,0.22)" : "none" }}>
                  <Icon icon={t.icon} style={{ fontSize: 13 }} />{t.l}
                </button>
              );
            })}
            <button type="button"
              onClick={() => { setShowPicker(!showPicker); if (!showPicker) setPeriod("custom"); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, border: "1.5px solid", fontWeight: 700, fontSize: 13, cursor: "pointer", background: showPicker ? "#2563eb" : "#f8fafc", color: showPicker ? "#fff" : "#475569", borderColor: showPicker ? "#2563eb" : "#e2e8f0" }}>
              <Icon icon="mdi:calendar-edit" style={{ fontSize: 13 }} />กำหนดเอง
            </button>
          </div>
          {showPicker && (
            <div style={{ marginTop: 12, padding: "12px 16px", background: "linear-gradient(135deg,#eff6ff,#f0f9ff)", borderRadius: 12, border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon="mdi:calendar-start" style={{ color: "#fff", fontSize: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", marginBottom: 3 }}>วันเริ่มต้น</div>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", cursor: "pointer" }} />
                </div>
              </div>
              <Icon icon="mdi:arrow-right" style={{ color: "#2563eb", fontSize: 18, paddingTop: 14 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon="mdi:calendar-end" style={{ color: "#fff", fontSize: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", marginBottom: 3 }}>วันสิ้นสุด</div>
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", cursor: "pointer" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
          {statCards.map(c => (
            <div key={c.key}
              style={{ background: c.bg, borderRadius: 14, padding: "16px 18px", border: `1px solid ${c.color}28` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon icon={c.icon} style={{ fontSize: 18, color: c.color }} />
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{stats[c.key] ?? 0}</div>
            </div>
          ))}
        </div>

        {/* ── Table card ── */}
        <div className="admCard" style={{ borderRadius: 16, overflow: "hidden" }}>
          {/* toolbar */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div className="admCardTitle">รายการออเดอร์</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="admStatusTabs">
                {STATUS_TABS.map(t => (
                  <button key={t.key} type="button"
                    onClick={() => { setStatusFilter(t.key); setPage(1); }}
                    className={`admStatusTab${statusFilter === t.key ? " active" : ""}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <form onSubmit={handleSearch} className="admSearch admSearch--order">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา…" />
                <button type="submit" className="admSearchBtn"><Icon icon="mdi:magnify" /></button>
              </form>
            </div>
          </div>

          {loading && (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
              <Icon icon="eos-icons:loading" style={{ fontSize: 28 }} /> กำลังโหลด…
            </div>
          )}
          {err && <div className="boError" style={{ margin: "16px 20px" }}>{err}</div>}

          {!loading && !err && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#3b82f6" }}>
                    <th style={{ ...thSt, color: "#fff", fontWeight: 700 }}>รหัสออเดอร์</th>
                    <th style={{ ...thSt, color: "#fff", fontWeight: 700 }}>สินค้า</th>
                    <th style={{ ...thSt, color: "#fff", fontWeight: 700 }}>ผู้ซื้อ / ผู้ขาย</th>
                    <th style={{ ...thSt, textAlign: "right", color: "#fff", fontWeight: 700 }}>ยอดรวม</th>
                    <th style={{ ...thSt, textAlign: "center", color: "#fff", fontWeight: 700 }}>ชำระเงิน</th>
                    <th style={{ ...thSt, textAlign: "center", color: "#fff", fontWeight: 700 }}>สถานะ</th>
                    <th style={{ ...thSt, textAlign: "left", color: "#fff", fontWeight: 700 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14 }}>
                        <Icon icon="mdi:inbox-outline" style={{ fontSize: 36, display: "block", margin: "0 auto 8px" }} />
                        ไม่พบออเดอร์ตามเงื่อนไข
                      </td>
                    </tr>
                  ) : rows.map((row, i) => {
                    const badge    = STATUS_BADGE[row.order_status] || STATUS_BADGE.pending;
                    const payBadge = PAY_BADGE[row.payment_status]  || PAY_BADGE.unpaid;
                    return (
                      <tr key={row.order_id}
                        style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa",
                          transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}
                      >
                        <td style={tdSt}>
                          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 12, letterSpacing: "0.3px" }}>
                            {formatOrderNo(row.order_id)}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{fmtDate(row.created_at)}</div>
                        </td>

                        <td style={{ ...tdSt, maxWidth: 200 }}>
                          <div style={{ fontWeight: 600, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                            {row.products || "-"}
                          </div>
                          {row.total_qty > 0 && (
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{row.total_qty} ชิ้น</div>
                          )}
                        </td>

                        <td style={tdSt}>
                          <div style={{ fontSize: 12, color: "#1e293b", fontWeight: 600 }}>
                            <Icon icon="mdi:account-outline" style={{ fontSize: 11, color: "#3b82f6", marginRight: 3 }} />
                            {row.buyer_name || "-"}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                            <Icon icon="mdi:storefront-outline" style={{ fontSize: 11, color: "#94a3b8", marginRight: 3 }} />
                            {row.seller_name || "-"}
                          </div>
                        </td>

                        <td style={{ ...tdSt, textAlign: "right" }}>
                          <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>{fmtBaht(row.total_price)}</span>
                        </td>

                        <td style={{ ...tdSt, textAlign: "center" }}>
                          <span className={`admBadge ${payBadge.cls}`} style={badgeSt}>{payBadge.label}</span>
                        </td>

                        <td style={{ ...tdSt, textAlign: "center" }}>
                          <span className={`admBadge ${badge.cls}`} style={badgeSt}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot, display: "inline-block", marginRight: 5, flexShrink: 0 }} />
                            {badge.label}
                          </span>
                        </td>

                        <td style={{ ...tdSt, textAlign: "left" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-start" }}>
                            <button type="button" style={btnSt("#3b82f6")} onClick={() => openDetail(row.order_id)}>
                              รายละเอียด
                            </button>
                            {["pending", "confirmed", "shipping"].includes(row.order_status) && (
                              <button type="button" style={btnSt("#ef4444")} onClick={() => handleCancel(row.order_id)}>
                                ยกเลิก
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="admPager">
              <div className="admPagerNums">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`admPageNum ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                ))}
              </div>
              <div className="admPagerBtns">
                <button className="admPagerBtn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ ก่อนหน้า</button>
                <button className="admPagerBtn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป ›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Order Detail Modal ── */}
      {detail && (() => {
        const detailFee      = Number(detail.platform_fee || 0);
        const detailSubtotal = Number(detail.items_subtotal || 0);
        const detailShipping = Number(detail.shipping_total || 0);
        // ยอดโอนให้ผู้ขาย = ยอดสินค้า - ค่าธรรมเนียม + ค่าส่ง
        const detailNet      = detail.seller_payout_amount != null
          ? Number(detail.seller_payout_amount)
          : Math.max(0, detailSubtotal - detailFee + detailShipping);
        const detailBadge    = STATUS_BADGE[detail.order_status] || STATUS_BADGE.pending;
        return (
          <div className="admModalOverlay" onClick={() => setDetail(null)}>
            <div className="admModal" style={{ width: 580, maxHeight: "88vh", overflowY: "auto", borderRadius: 20, padding: 28 }}
              onClick={e => e.stopPropagation()}>

              {/* header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>รายละเอียดออเดอร์</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>{formatOrderNo(detail.order_id)} · {fmtDate(detail.created_at)}</div>
                </div>
                <span className={`admBadge ${detailBadge.cls}`} style={{ ...badgeSt, fontSize: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: detailBadge.dot, display: "inline-block", marginRight: 5 }} />
                  {detailBadge.label}
                </span>
              </div>

              {/* buyer / seller */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                {[
                  { label: "ผู้ซื้อ", name: detail.buyer_name, phone: detail.buyer_phone, extra: detail.shipping_address ? `${detail.shipping_address}${detail.shipping_province ? ` ${detail.shipping_province}` : ""}${detail.shipping_postcode ? ` ${detail.shipping_postcode}` : ""}` : null },
                  { label: "ผู้ขาย", name: detail.seller_name, phone: detail.seller_phone, extra: null },
                ].map(p => (
                  <div key={p.label} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{p.label}</div>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{p.name || "-"}</div>
                    {p.phone && <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{p.phone}</div>}
                    {p.extra && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5, lineHeight: 1.5 }}>{p.extra}</div>}
                  </div>
                ))}
              </div>

              {/* items table */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 10 }}>รายการสินค้า</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={thSt}>สินค้า</th>
                        <th style={{ ...thSt, textAlign: "center", width: 60 }}>จำนวน</th>
                        <th style={{ ...thSt, textAlign: "right", width: 90 }}>ราคา/ชิ้น</th>
                        <th style={{ ...thSt, textAlign: "right", width: 90 }}>รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.items || []).map((it, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={tdSt}>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{it.product_title || `#${it.product_id}`}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{getSizeText(it.size, it.category_id)}</div>
                          </td>
                          <td style={{ ...tdSt, textAlign: "center", color: "#64748b" }}>{it.quantity}</td>
                          <td style={{ ...tdSt, textAlign: "right", color: "#64748b" }}>{fmtBaht(it.price_at_purchase)}</td>
                          <td style={{ ...tdSt, textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                            {fmtBaht(Number(it.price_at_purchase) * Number(it.quantity))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* finance */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 10 }}>สรุปการเงิน</div>
                {[
                  { label: "ยอดราคาสินค้า", val: fmtBaht(detailSubtotal), color: "#0f172a" },
                  { label: "ค่าจัดส่ง", val: `+${fmtBaht(detailShipping)}`, color: "#3b82f6" },
                  { label: `ค่าธรรมเนียมแพลตฟอร์ม (15%, ขั้นต่ำ ฿20)`, val: `−${fmtBaht(detailFee)}`, color: "#f59e0b" },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>{r.label}</span>
                    <span style={{ fontWeight: 600, color: r.color }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ borderTop: "2px solid #e2e8f0", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>ยอดโอนให้ผู้ขาย</span>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>ยอดสินค้า + ค่าส่ง − ค่าธรรมเนียม</div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 17, color: "#22c55e" }}>{fmtBaht(detailNet)}</span>
                </div>
              </div>

              {/* tracking */}
              {(() => {
                const tracking = detail.tracking_number;
                const providerName = detail.shipping?.[0]?.provider_name || detail.shipping_provider_name || "";
                const trackUrl = getTrackingUrl(providerName, tracking);
                if (!tracking) return null;
                return (
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon icon="mdi:barcode-scan" style={{ color: "#3b82f6", fontSize: 20, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>เลขพัสดุ{providerName ? ` · ${providerName}` : ""}</div>
                        <div style={{ fontWeight: 800, color: "#1e40af", fontSize: 15, letterSpacing: "0.5px", marginTop: 2 }}>{tracking}</div>
                      </div>
                    </div>
                    {trackUrl && (
                      <a href={trackUrl} target="_blank" rel="noreferrer"
                        style={{ background: "#2563eb", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                        <Icon icon="mdi:truck-fast-outline" style={{ fontSize: 14 }} />
                        ติดตามพัสดุ
                      </a>
                    )}
                  </div>
                );
              })()}

              <div style={{ textAlign: "right" }}>
                <button style={btnSt("#64748b")} onClick={() => setDetail(null)}>ปิด</button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && <div className={`admToast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
