import { useEffect, useState, useCallback } from "react";
import { request } from "../../../api/http.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import "../styles/admin.css";
import "../styles/adminPages.css";
import { Icon } from "@iconify/react";
import { formatOrderNo } from "../../../utils/orderNo.js";

/* ─── helpers ─── */
const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

const STATUS_BADGE = {
  pending:   { label: "รอดำเนินการ", bg: "#fef9c3", color: "#92400e" },
  confirmed: { label: "ยืนยันแล้ว",  bg: "#dbeafe", color: "#1e40af" },
  shipping:  { label: "จัดส่งแล้ว",  bg: "#ede9fe", color: "#5b21b6" },
  delivered: { label: "ส่งถึงแล้ว",  bg: "#dcfce7", color: "#15803d" },
  cancelled: { label: "ยกเลิก",      bg: "#fee2e2", color: "#991b1b" },
};

/* ─── SellerOrdersModal ─── */
function SellerOrdersModal({ seller, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await request(
          `/admin/orders?seller_id=${seller.seller_id}&status=delivered&limit=50`,
          { method: "GET", auth: true }
        );
        setOrders(data.rows || data.orders || []);
      } catch (e) {
        setErr(e?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [seller.seller_id]);

  const totalSales  = orders.reduce((s, o) => s + Number(o.total_price  || 0), 0);
  const totalFee    = orders.reduce((s, o) => s + Number(o.platform_fee || 0), 0);
  const totalPayout = totalSales - totalFee;

  const thSt = { padding: "10px 14px", background: "#f8fafc", color: "#475569", fontSize: 11, fontWeight: 700, textAlign: "left", borderBottom: "2px solid #e2e8f0", textTransform: "uppercase", letterSpacing: "0.4px" };
  const tdSt = { padding: "12px 14px", fontSize: 13, color: "#334155", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

  return (
    <div className="admModalOverlay" onClick={onClose}>
      <div
        className="admModal"
        style={{ width: 760, borderRadius: 20, maxHeight: "88vh", overflowY: "auto", padding: 0, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient header */}
        <div style={{ background: "linear-gradient(90deg,#1d4ed8 0%,#5285e8 60%,#7dd3fc 100%)", padding: "20px 24px", borderRadius: "20px 20px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>ออเดอร์ที่สำเร็จ</div>
            <div style={{ fontSize: 13, color: "#bfdbfe", marginTop: 2 }}>
              <Icon icon="mdi:storefront-outline" style={{ verticalAlign: "middle", marginRight: 5 }} />
              {seller.seller_name} · {loading ? "…" : `${orders.length} ออเดอร์`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", width: 32, height: 32, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* seller summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#fff", padding: "14px 24px", borderBottom: "1px solid #e2e8f0", gap: 12 }}>
          {[
            { label: "ยอดขายรวม",    value: fmtBaht(totalSales),  color: "#0f172a" },
            { label: "ค่าธรรมเนียม", value: fmtBaht(totalFee),    color: "#f59e0b" },
            { label: "ยอดโอนสุทธิ",  value: fmtBaht(totalPayout), color: "#16a34a" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* body */}
        <div style={{ padding: "16px 24px 24px" }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
              <Icon icon="eos-icons:loading" style={{ fontSize: 28, display: "block", margin: "0 auto 8px" }} />
              กำลังโหลด…
            </div>
          )}
          {err && <div style={{ textAlign: "center", color: "#ef4444", padding: 16 }}>{err}</div>}
          {!loading && !err && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thSt}>รหัสออเดอร์</th>
                    <th style={thSt}>วันที่สั่ง</th>
                    <th style={thSt}>สินค้า</th>
                    <th style={{ ...thSt, textAlign: "right" }}>ยอดรวม</th>
                    <th style={{ ...thSt, textAlign: "right" }}>ค่าธรรมเนียม</th>
                    <th style={{ ...thSt, textAlign: "right" }}>ยอดโอน</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdSt, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                        <Icon icon="mdi:inbox-outline" style={{ fontSize: 30, display: "block", margin: "0 auto 8px" }} />
                        ไม่มีออเดอร์ที่สำเร็จ
                      </td>
                    </tr>
                  ) : orders.map((o, i) => {
                    const fee   = Number(o.platform_fee || 0);
                    const total = Number(o.total_price  || 0);
                    const net   = total - fee;
                    return (
                      <tr key={i}
                        style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}
                      >
                        <td style={tdSt}>
                          <span style={{ fontWeight: 700, color: "#1e40af", fontSize: 12, letterSpacing: "0.3px" }}>
                            {formatOrderNo(o.order_id)}
                          </span>
                        </td>
                        <td style={{ ...tdSt, color: "#64748b" }}>{fmtDate(o.created_at)}</td>
                        <td style={{ ...tdSt, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                          {o.products || o.product_names || "-"}
                        </td>
                        <td style={{ ...tdSt, textAlign: "right", fontWeight: 600 }}>{fmtBaht(total)}</td>
                        <td style={{ ...tdSt, textAlign: "right", color: "#f59e0b", fontWeight: 700 }}>{fmtBaht(fee)}</td>
                        <td style={{ ...tdSt, textAlign: "right", color: "#16a34a", fontWeight: 700 }}>{fmtBaht(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmPayoutModal({ item, onConfirm, onCancel }) {
  if (!item) return null;
  const fee15 = Number(item.fee_amount || 0);
  const net = Number(item.net_amount || 0);

  const steps = [
    { n: "1", label: "ตรวจสอบ", active: true },
    { n: "2", label: "ยืนยัน",  active: true },
    { n: "3", label: "สำเร็จ",  active: false },
  ];

  return (
    <div className="admModalOverlay">
      <div className="admModal" style={{ width: 500, borderRadius: 20 }}>

        {/* step indicator */}
        <div className="admModalSteps">
          {steps.map((s, i) => (
            <div key={s.n} className="admModalStep">
              <div className={`admModalStep__circle ${s.active ? "admModalStep__circle--active" : "admModalStep__circle--inactive"}`}>
                {i === 0 ? <Icon icon="mdi:check" /> : s.n}
              </div>
              <div className={`admModalStep__label ${s.active ? "admModalStep__label--active" : "admModalStep__label--inactive"}`}>
                {s.label}
              </div>
              {i < 2 && (
                <div className={`admModalStep__line ${s.active && i === 0 ? "admModalStep__line--active" : "admModalStep__line--inactive"}`} />
              )}
            </div>
          ))}
        </div>

        {/* seller info */}
        <div className="admSellerInfoBox">
          <div className="admSellerInfoBox__header">
            <div className="admSellerAvatar">
              {(item.seller_name || "ก").charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#1e293b" }}>ผู้ขาย</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{item.seller_name}</div>
            </div>
          </div>
          <div className="admSellerInfoBox__grid">
            <div>
              <div className="admSellerInfoBox__fieldLabel">บัญชีปลายทาง</div>
              <div className="admSellerInfoBox__fieldValue">{item.bank_account_number || "-"}</div>
            </div>
            <div>
              <div className="admSellerInfoBox__fieldLabel">ชื่อบัญชี</div>
              <div className="admSellerInfoBox__fieldValue">{item.bank_account_name || item.seller_name}</div>
            </div>
            <div>
              <div className="admSellerInfoBox__fieldLabel">จำนวนออเดอร์</div>
              <div className="admSellerInfoBox__fieldValue">{item.order_count} ออเดอร์</div>
            </div>
            <div>
              <div className="admSellerInfoBox__fieldLabel">ช่วงเวลา</div>
              <div className="admSellerInfoBox__fieldValue">{item.period || "12-13 เม.ย. 2026"}</div>
            </div>
          </div>
        </div>

        {/* summary */}
        <div className="admPayoutSummary">
          <div className="admPayoutSummary__row">
            <span className="admPayoutSummary__rowLabel">ยอดขายสินค้ารวม (ไม่รวมค่าส่ง)</span>
            <span className="admPayoutSummary__rowValue">฿{(item.total_sales || 0).toLocaleString()}</span>
          </div>
          <div className="admPayoutSummary__row">
            <span className="admPayoutSummary__rowLabel">หัก ค่าธรรมเนียม 15%</span>
            <span className="admPayoutSummary__rowValue admPayoutSummary__rowValue--amber">-฿{fee15.toLocaleString()}</span>
          </div>
          <div className="admPayoutSummary__total">
            <span className="admPayoutSummary__totalLabel">ยอดโอนสุทธิ</span>
            <span className="admPayoutSummary__totalValue">฿{net.toLocaleString()}</span>
          </div>
        </div>

        {/* warning */}
        <div className="admModalWarning">
          <Icon icon="mdi:alert-outline" style={{ width: 18, height: 18, color: "#f59e0b", flexShrink: 0 }} />
          กรุณาตรวจสอบบัญชีปลายทางและรายละเอียดการโอนให้ถูกต้องก่อนกดยืนยัน
        </div>

        <div className="admModalActions">
          <button className="admBtnGhost" onClick={onCancel}>ยกเลิก</button>
          <button className="admBtnPrimary admConfirmPayBtn" onClick={() => onConfirm(item, net)}>
            ยืนยันโอนเงิน ฿{net.toLocaleString()}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPayoutPage() {
  const [summaryStats, setSummaryStats] = useState({ pending_total: 0, pending_count: 0, paid_total: 0, paid_count: 0, fee_total: 0 });
  const [pendingRows, setPendingRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [period, setPeriod] = useState("week");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sellerDetail, setSellerDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setErr("");
      const params = new URLSearchParams({ period, page, limit: 10 });
      const data = await request(`/admin/payouts?${params}`, { method: "GET", auth: true });
      setSummaryStats(data.stats || {});
      setPendingRows(data.pending || []);
      setHistoryRows(data.history || []);
      setTotalPages(data.total_pages || 1);
    } catch (e) {
      setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [period, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePayAll = async () => {
    if (!window.confirm("ยืนยันการโอนเงินให้ผู้ขายทั้งหมด?")) return;
    try {
      const data = await request("/admin/payouts/pay-all", { method: "POST", auth: true });
      showToast(`โอนเงินสำเร็จ ${data.count || ""} รายการ`);
      loadData();
    } catch (e) {
      showToast(e?.data?.message || "เกิดข้อผิดพลาด", "error");
    }
  };

  const handleConfirmPayout = async (item, net) => {
    try {
      await request(`/admin/payouts/${item.seller_id}/pay`, {
        method: "POST", auth: true,
        body: { net_amount: net },
      });
      showToast(`โอนเงิน ฿${net.toLocaleString()} ให้ ${item.seller_name} สำเร็จ`);
      setSelectedItem(null);
      loadData();
    } catch (e) {
      showToast(e?.data?.message || "เกิดข้อผิดพลาด", "error");
    }
  };

  return (
    <div className="boPage">
      <div className="boTop">
        <div className="boTitle">โอนเงินให้ผู้ขาย</div>
        <div className="boAdmin">
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      <div className="boPageInner">
        {/* date + period */}
        <div className="admPayoutDateRow">
          <div className="admPayoutPeriodTabs">
            {[["week", "วันนี้"], ["month", "สัปดาห์"], ["year", "เดือนนี้"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`boPeriodTab${period === k ? " active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="boDateLabel">{dateStr} · {timeStr}</div>
        </div>

        {/* summary stat cards */}
        <div className="admPayoutStatGrid3">
          <div className="admPayoutStatCard">
            <div className="admPayoutStatCard__label admPayoutStatCard__label--red">รอดำเนินการทั้งหมด</div>
            <div className="admPayoutStatCard__value admPayoutStatCard__value--red">฿{(summaryStats.pending_total || 0).toLocaleString()}</div>
            <div className="admPayoutStatCard__sub">{summaryStats.pending_count || 0} รายการ</div>
          </div>
          <div className="admPayoutStatCard">
            <div className="admPayoutStatCard__label admPayoutStatCard__label--green">โอนแล้ว</div>
            <div className="admPayoutStatCard__value admPayoutStatCard__value--green">฿{(summaryStats.paid_total || 0).toLocaleString()}</div>
            <div className="admPayoutStatCard__sub">{summaryStats.paid_count || 0} รายการ</div>
          </div>
          <div className="admPayoutStatCard admPayoutStatCard--blue">
            <div className="admPayoutStatCard__label admPayoutStatCard__label--muted">ค่าธรรมเนียมสะสม</div>
            <div className="admPayoutStatCard__value admPayoutStatCard__value--blue">฿{(summaryStats.fee_total || 0).toLocaleString()}</div>
          </div>
        </div>

        {loading && <div className="boMuted">กำลังโหลด…</div>}
        {err && <div className="boError">{err}</div>}

        {!loading && !err && (
          <>
            {/* pending payouts table */}
            <div className="admCard" style={{ width: "100%", marginBottom: 24 }}>
              <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="admCardTitle">รายการรอโอนทั้งหมด</span>
                {pendingRows.length > 0 && (
                  <button onClick={handlePayAll} className="admPayAllBtn">
                    <Icon icon="mdi:download" style={{ width: 16, height: 16 }} />
                    โอนเงินทั้งหมด (฿{pendingRows.reduce((s, r) => s + (r.net_amount || 0), 0).toLocaleString()})
                  </button>
                )}
              </div>
              <div className="admTableWrap" style={{ marginTop: 0 }}>
                <table className="admTable" style={{ tableLayout: "auto" }}>
                  <thead>
                    <tr>
                      <th>ผู้ขาย</th>
                      <th>ออเดอร์ที่สำเร็จ</th>
                      <th>ยอดขายสินค้า</th>
                      <th>ค่าธรรมเนียม</th>
                      <th>ยอดโอนสุทธิ</th>
                      <th>สถานะ</th>
                      <th style={{ textAlign: "center" }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>ไม่มีรายการรอโอน</td></tr>
                    ) : pendingRows.map((row, i) => {
                      const fee = Number(row.fee_amount || 0);
                      const net = Number(row.net_amount || 0);
                      return (
                        <tr key={i}>
                          <td><span className="admTdStrong">{row.seller_name}</span></td>
                          <td>{row.order_count} ออเดอร์</td>
                          <td style={{ fontWeight: 700 }}>฿{(row.total_sales || 0).toLocaleString()}</td>
                          <td style={{ fontWeight: 700, color: "#f59e0b" }}>฿{fee.toLocaleString()}</td>
                          <td style={{ fontWeight: 700, color: "#22b14c" }}>฿{net.toLocaleString()}</td>
                          <td>
                            <span className="admBadge admPending" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span className="admBadgeDot" style={{ background: "#f59e0b" }} />
                              รอโอน
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div className="admActionsCell">
                              <button className="admBtnSmall admBtnApprove" style={{ border: "none", cursor: "pointer", borderRadius: 8 }}
                                onClick={() => setSelectedItem({ ...row, net_amount: net })}>
                                โอนเงิน
                              </button>
                              <button className="admBtnSmall admBtnPrimary" style={{ border: "none", cursor: "pointer", borderRadius: 8, background: "#e2e8f0", color: "#334155" }}
                                onClick={() => setSellerDetail({ ...row })}>
                                ดูรายละเอียด
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* history table */}
            <div className="admCard" style={{ width: "100%" }}>
              <div style={{ padding: "14px 18px" }}>
                <span className="admCardTitle">ประวัติการโอนทั้งหมด</span>
              </div>
              <div className="admTableWrap" style={{ marginTop: 0 }}>
                <table className="admTable" style={{ tableLayout: "auto" }}>
                  <thead>
                    <tr>
                      <th>วันที่โอน</th>
                      <th>ผู้ขาย</th>
                      <th>ยอดโอนสุทธิ</th>
                      <th>ค่าธรรมเนียม</th>
                      <th>สถานะ</th>
                      <th style={{ textAlign: "center" }}>หลักฐาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>ไม่มีประวัติ</td></tr>
                    ) : historyRows.map((row, i) => {
                      const d = row.paid_at ? new Date(row.paid_at) : null;
                      const dateLabel = d
                        ? d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
                          + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
                        : "-";
                      return (
                        <tr key={i}>
                          <td className="admHistoryDate">{dateLabel}</td>
                          <td><span className="admTdStrong">{row.seller_name}</span></td>
                          <td style={{ fontWeight: 700, color: "#22b14c" }}>฿{(row.net_amount || 0).toLocaleString()}</td>
                          <td style={{ fontWeight: 700, color: "#f59e0b" }}>฿{(row.fee_amount || 0).toLocaleString()}</td>
                          <td>
                            <span className="admBadge admApproved" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span className="admBadgeDot" style={{ background: "#22b14c" }} />
                              โอนสำเร็จ
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {row.slip_url ? (
                              <a href={row.slip_url} target="_blank" rel="noreferrer"
                                className="admBtnSmall admBtnPrimary"
                                style={{ border: "none", cursor: "pointer", borderRadius: 8, display: "inline-block", textDecoration: "none", padding: "6px 14px" }}>
                                ดูรายละเอียด
                              </a>
                            ) : (
                              <button className="admBtnSmall admBtnPrimary" style={{ border: "none", cursor: "pointer", borderRadius: 8 }}
                                onClick={() => window.alert(`ดูรายละเอียดการโอนของ ${row.seller_name}`)}>
                                ดูรายละเอียด
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
          </>
        )}
      </div>

      {/* Confirm Modal */}
      {selectedItem && (
        <ConfirmPayoutModal
          item={selectedItem}
          onConfirm={handleConfirmPayout}
          onCancel={() => setSelectedItem(null)}
        />
      )}

      {/* Seller Orders Detail Modal */}
      {sellerDetail && (
        <SellerOrdersModal
          seller={sellerDetail}
          onClose={() => setSellerDetail(null)}
        />
      )}

      {toast && <div className={`admToast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}