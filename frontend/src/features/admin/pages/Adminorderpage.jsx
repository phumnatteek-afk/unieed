import { useEffect, useState, useCallback } from "react";
import { request } from "../../../api/http.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import "../styles/admin.css";
import "../styles/backoffice.css";
import "../styles/adminPages.css";
import { Icon } from "@iconify/react";
import { formatOrderNo } from "../../../utils/orderNo.js";

const STATUS_TABS = [
  { key: "", label: "ทั้งหมด" },
  { key: "pending", label: "รอดำเนินการ" },
  { key: "shipping", label: "กำลังจัดส่ง" },
  { key: "delivered", label: "จัดส่งสำเร็จ" },
  { key: "cancelled", label: "ยกเลิก" },
];

const STATUS_BADGE = {
  pending:   { cls: "admPending",  label: "รอดำเนินการ",  dot: "#f1aa00" },
  shipping:  { cls: "admPending",  label: "กำลังจัดส่ง", dot: "#3b82f6" },
  delivered: { cls: "admApproved", label: "จัดส่งสำเร็จ", dot: "#22b14c" },
  cancelled: { cls: "admRejected", label: "ยกเลิก",       dot: "#e03131" },
};
const getSizeText = (size, categoryId) => {
  if (!size) return "-";
  let s = size;
  if (typeof s === "string") {
    try { s = JSON.parse(s); } catch { return String(size); }
  }
  const cid = Number(categoryId);
  const parts = [];
  if (cid === 1) {
    if (s.chest) parts.push(`อก ${s.chest}`);
    if (s.length) parts.push(`ยาว ${s.length}`);
  } else {
    if (s.waist) parts.push(`เอว ${s.waist}`);
    if (s.length) parts.push(`ยาว ${s.length}`);
  }
  return parts.join(" / ") || "-";
};

export default function AdminOrderPage() {
  const [stats, setStats] = useState({ total: 0, pending: 0, shipping: 0, delivered: 0, cancelled: 0 });
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true); setErr("");
      const params = new URLSearchParams({ status: statusFilter, q, page, limit: 10 });
      const data = await request(`/admin/orders?${params}`, { method: "GET", auth: true });
      setStats(data.stats || {});
      setRows(data.rows || []);
      setTotalPages(data.total_pages || 1);
    } catch (e) {
      setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q, page]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); loadOrders(); };

  const handleCancel = async (orderId) => {
    if (!window.confirm("ยืนยันการยกเลิกออเดอร์นี้?")) return;
    try {
      await request(`/admin/orders/${orderId}/cancel`, { method: "PATCH", auth: true });
      showToast("ยกเลิกออเดอร์แล้ว");
      loadOrders();
    } catch (e) {
      showToast(e?.data?.message || "เกิดข้อผิดพลาด", "error");
    }
  };

  const openDetail = async (orderId) => {
    try {
      const d = await request(`/admin/orders/${orderId}`, { method: "GET", auth: true });
      setDetail(d);
    } catch (e) {
      showToast(e?.data?.message || "โหลดรายละเอียดออเดอร์ไม่สำเร็จ", "error");
    }
  };

  const statCards = [
    { key: "total",     label: "ออเดอร์ทั้งหมด",  icon: "mdi:receipt-text-outline",   tileCls: "admStatTile--blue" },
    { key: "pending",   label: "รอดำเนินการ",    icon: "mdi:clock-outline",            tileCls: "admStatTile--amber" },
    { key: "shipping",  label: "กำลังจัดส่ง",    icon: "mdi:truck-delivery-outline",  tileCls: "admStatTile--cyan" },
    { key: "delivered", label: "จัดส่งสำเร็จ",   icon: "mdi:package-check",            tileCls: "admStatTile--green" },
    { key: "cancelled", label: "ยกเลิก",         icon: "mdi:close-octagon-outline",   tileCls: "admStatTile--rose" },
  ];

  return (
    <div className="boPage admOrderPage">
      <div className="boTop">
        <div>
          <div className="boTitle">จัดการออเดอร์</div>
        </div>
        <div className="boAdmin">
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      <div className="boPageInner admOrderInner">
        <div className="admOrderMetaRow">
          <p className="admOrderSubhead">ติดตามคำสั่งซื้อ สถานะการชำระ และการจัดส่งในตลาดมือสอง</p>
          <div className="admOrderDatePill">
            <Icon icon="mdi:calendar-clock" style={{ fontSize: 18, opacity: 0.85 }} />
            {dateStr} · {timeStr}
          </div>
        </div>

        <div className="admStatGrid5 admStatGrid5--order">
          {statCards.map(c => (
            <div key={c.key} className={`admStatTile ${c.tileCls}`}>
              <div className="admStatTile__top">
                <span className="admStatTile__iconWrap">
                  <Icon icon={c.icon} className="admStatTile__icon" />
                </span>
              </div>
              <div className="admStatTile__label">{c.label}</div>
              <div className="admStatTile__num">{stats[c.key] ?? 0}</div>
            </div>
          ))}
        </div>

        <div className="admCard admOrderCard admOrderCard--elevated">
          <div className="admCardHeader">
            <div>
              <div className="admCardTitle">รายการออเดอร์</div>
              <div className="admOrderSubhead" style={{ marginTop: 6, fontSize: 13 }}>
                กรองตามสถานะหรือค้นหาจากชื่อผู้ซื้อ ผู้ขาย หรือชื่อสินค้า
              </div>
            </div>
            <div className="admCardControls admOrderToolbar">
              <div className="admStatusTabs">
                {STATUS_TABS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setStatusFilter(t.key); setPage(1); }}
                    className={`admStatusTab${statusFilter === t.key ? " active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <form onSubmit={handleSearch} className="admSearch admSearch--order">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา…" aria-label="ค้นหาออเดอร์" />
                <button type="submit" className="admSearchBtn" aria-label="ค้นหา"><Icon icon="mdi:magnify" /></button>
              </form>
            </div>
          </div>

          {loading && (
            <div className="admOrderLoading">
              <Icon icon="eos-icons:loading" style={{ fontSize: 28 }} />
              กำลังโหลดข้อมูล…
            </div>
          )}
          {err && <div className="boError" style={{ margin: "16px 18px" }}>{err}</div>}

          {!loading && !err && (
            <div className="admTableWrap" style={{ marginTop: 12 }}>
              <table className="admTable">
                <thead>
                  <tr>
                    <th>รหัสออเดอร์</th>
                    <th>สินค้า</th>
                    <th>ผู้ซื้อ</th>
                    <th>ผู้ขาย</th>
                    <th style={{ textAlign: "right" }}>ยอดสินค้า</th>
                    <th style={{ textAlign: "right" }}>ค่าธรรมเนียม</th>
                    <th style={{ textAlign: "right" }}>ยอดโอนผู้ขาย</th>
                    <th style={{ textAlign: "center" }}>สถานะ</th>
                    <th style={{ textAlign: "center" }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="admOrderEmpty">ไม่พบออเดอร์ตามเงื่อนไข</td>
                    </tr>
                  ) : rows.map(row => {
                    const badge = STATUS_BADGE[row.order_status] || STATUS_BADGE.pending;
                    const subtotal = Number(row.items_subtotal || 0);
                    const fee = subtotal >= 100
                      ? Math.round(subtotal * 0.15)
                      : (subtotal > 0 ? 20 : 0);
                    const net = Math.max(0, subtotal - fee);
                    return (
                      <tr key={row.order_id}>
                        <td>
                          <span className="admOrderNoCell">{formatOrderNo(row.order_id)}</span>
                        </td>
                        <td>
                          <span className="admOrderProductCell">
                            {row.products || "-"}
                          </span>
                        </td>
                        <td>
                          <span className="admOrderNameCell">{row.buyer_name || "-"}</span>
                        </td>
                        <td>
                          <span className="admOrderNameCell">{row.seller_name || "-"}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="admOrderMoney">฿{subtotal.toLocaleString()}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="admOrderFee">฿{fee.toLocaleString()}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="admOrderNet">฿{net.toLocaleString()}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`admBadge ${badge.cls} admOrderBadge`}>
                            <span className="admBadgeDot" style={{ background: badge.dot }} />
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="admActionsCell admActionsCell--stack">
                            <button
                              type="button"
                              className="admBtnSmall admBtnPrimary admOrderActionBtn"
                              onClick={() => openDetail(row.order_id)}
                            >
                              รายละเอียด
                            </button>
                            {["pending", "shipping"].includes(row.order_status) && (
                              <button
                                type="button"
                                className="admBtnSmall admBtnDanger admOrderActionBtn"
                                onClick={() => handleCancel(row.order_id)}
                              >
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

          {/* pagination */}
          {totalPages > 1 && (
            <div className="admPager">
              <div className="admPagerNums">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`admPageNum ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                ))}
              </div>
              <div className="admPagerBtns">
                <button className="admPagerBtn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{"< Back"}</button>
                <button className="admPagerBtn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{"Next >"}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detail && (() => {
        const detailFee = Number(detail.calculated_fee || detail.platform_fee || 0);
        const detailSubtotal = Number(detail.items_subtotal || 0);
        const detailNet = detailSubtotal - detailFee;
        const detailBadge = STATUS_BADGE[detail.order_status] || STATUS_BADGE.pending;
        return (
          <div className="admModalOverlay" onClick={() => setDetail(null)}>
            <div className="admModal admOrderModal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="adm-order-modal-title">

              <div className="admOrderModal__head">
                <div>
                  <h2 id="adm-order-modal-title" className="admOrderModal__title">รายละเอียดออเดอร์</h2>
                  <div className="admOrderModal__sub">{formatOrderNo(detail.order_id)}</div>
                </div>
                <span className={`admBadge ${detailBadge.cls} admOrderBadge`} style={{ fontSize: 13 }}>
                  <span className="admBadgeDot" style={{ background: detailBadge.dot }} />
                  {detailBadge.label}
                </span>
              </div>

              <div className="admOrderPanelGrid">
                <div className="admOrderPanel">
                  <div className="admOrderPanel__k">ผู้ซื้อ</div>
                  <div className="admOrderPanel__v">{detail.buyer_name || "-"}</div>
                  {detail.buyer_phone && <div className="admOrderPanel__muted">{detail.buyer_phone}</div>}
                  {detail.recipient_name && detail.recipient_name !== detail.buyer_name && (
                    <div className="admOrderPanel__muted">รับสินค้า: {detail.recipient_name}</div>
                  )}
                  {detail.shipping_address && (
                    <div className="admOrderPanel__muted" style={{ marginTop: 8 }}>
                      {detail.shipping_address}{detail.shipping_province ? ` ${detail.shipping_province}` : ""}{detail.shipping_postcode ? ` ${detail.shipping_postcode}` : ""}
                    </div>
                  )}
                </div>
                <div className="admOrderPanel">
                  <div className="admOrderPanel__k">ผู้ขาย</div>
                  <div className="admOrderPanel__v">{detail.seller_name || "-"}</div>
                  {detail.seller_phone && <div className="admOrderPanel__muted">{detail.seller_phone}</div>}
                  {detail.omise_charge_id && (
                    <div className="admOrderPanel__muted" style={{ marginTop: 8, fontSize: 12 }}>Charge ID: {detail.omise_charge_id}</div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div className="admOrderItemsHead">รายการสินค้า</div>
                <div className="admTableWrap admOrderItemsTable" style={{ borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>สินค้า</th>
                        <th style={{ textAlign: "center", width: 72 }}>จำนวน</th>
                        <th style={{ textAlign: "right", width: 110 }}>ราคา/ชิ้น</th>
                        <th style={{ textAlign: "right", width: 110 }}>รวม</th>
                        <th style={{ width: 130 }}>ไซส์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.items || []).map((it) => (
                        <tr key={it.order_item_id}>
                          <td style={{ fontWeight: 600, color: "#0f172a" }}>{it.product_title || `#${it.product_id}`}</td>
                          <td style={{ textAlign: "center", color: "#475569" }}>{it.quantity}</td>
                          <td style={{ textAlign: "right", color: "#475569" }}>฿{Number(it.price_at_purchase || 0).toLocaleString()}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>฿{(Number(it.price_at_purchase || 0) * Number(it.quantity || 0)).toLocaleString()}</td>
                          <td style={{ color: "#64748b", fontSize: 13 }}>{getSizeText(it.size, it.category_id)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admOrderFinance">
                <div className="admOrderFinance__title">สรุปการเงิน</div>
                <div className="admOrderFinance__row">
                  <span>ยอดสินค้า</span>
                  <span style={{ fontWeight: 600 }}>฿{detailSubtotal.toLocaleString()}</span>
                </div>
                <div className="admOrderFinance__row admOrderFinance__row--fee">
                  <span>ค่าธรรมเนียมระบบ {detailSubtotal >= 100 ? "(15%)" : "(คงที่ ฿20)"}</span>
                  <span style={{ fontWeight: 600 }}>− ฿{detailFee.toLocaleString()}</span>
                </div>
                <div className="admOrderFinance__total">
                  <span className="admOrderFinance__totalLabel">ยอดโอนให้ผู้ขาย</span>
                  <span className="admOrderFinance__totalValue">฿{Math.max(0, detailNet).toLocaleString()}</span>
                </div>
              </div>

              <div className="admModalActions" style={{ marginTop: 20 }}>
                <button type="button" className="admBtnPrimary" onClick={() => setDetail(null)}>ปิด</button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && <div className={`admToast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}