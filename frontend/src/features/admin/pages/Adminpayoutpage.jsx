import { useEffect, useState, useCallback } from "react";
import { request } from "../../../api/http.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import "../styles/admin.css";
import "../styles/adminPages.css";
import { Icon } from "@iconify/react";
import { formatOrderNo } from "../../../utils/orderNo.js";

/* ─── Bank code → Thai name (full + short) ─── */
const BANK_NAMES = {
  SCB:   { full: "ธนาคารไทยพาณิชย์",      short: "ไทยพาณิชย์"    },
  KBANK: { full: "ธนาคารกสิกรไทย",         short: "กสิกรไทย"      },
  BBL:   { full: "ธนาคารกรุงเทพ",           short: "กรุงเทพ"       },
  KTB:   { full: "ธนาคารกรุงไทย",           short: "กรุงไทย"       },
  TTB:   { full: "ธนาคารทหารไทยธนชาต",      short: "ทหารไทยธนชาต" },
  BAY:   { full: "ธนาคารกรุงศรีอยุธยา",     short: "กรุงศรีอยุธยา" },
  GSB:   { full: "ธนาคารออมสิน",            short: "ออมสิน"        },
  BAAC:  { full: "ธนาคารเพื่อการเกษตรฯ",   short: "ธ.ก.ส."        },
  KKP:   { full: "ธนาคารเกียรตินาคินภัทร", short: "เกียรตินาคิน"  },
  CIMB:  { full: "ธนาคาร CIMB Thai",        short: "CIMB Thai"     },
  LH:    { full: "ธนาคารแลนด์ แอนด์ เฮ้าส์",short: "LH Bank"      },
  UOBT:  { full: "ธนาคาร UOB",              short: "UOB"           },
  TISCO: { full: "ธนาคารทิสโก้",            short: "ทิสโก้"        },
  IBANK: { full: "ธนาคารอิสลาม",            short: "อิสลาม"        },
  ICBC:  { full: "ธนาคาร ICBC",             short: "ICBC"          },
  TCAP:  { full: "ธนาคารธนชาต",             short: "ธนชาต"         },
};
const bankLabel      = (code) => BANK_NAMES[String(code||"").toUpperCase()]?.full  || code || "—";
const bankLabelShort = (code) => BANK_NAMES[String(code||"").toUpperCase()]?.short || code || "—";

/* ─── Mask account number: แสดงแค่ 4 หลักแรก + กลาง mask + 3 หลักท้าย ─── */
const maskAccNo = (num) => {
  const s = String(num || "").replace(/\D/g, "");
  if (!s || s.length < 5) return s || "—";
  const head = s.slice(0, 4);
  const tail = s.slice(-3);
  const mid  = "X".repeat(Math.max(1, s.length - 7));
  return `${head}-${mid}-${tail}`;
};

/* ─── Size JSON → Thai text ─── */
const SIZE_KEYS = {
  chest: "อก", bust: "อก", waist: "เอว", hip: "สะโพก",
  length: "ยาว", shoulder: "ไหล่", sleeve: "แขน",
  width: "กว้าง", size: "ไซส์", height: "สูง",
};
const formatSize = (size) => {
  if (!size) return "—";
  try {
    const obj = typeof size === "string" ? JSON.parse(size) : size;
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      const parts = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== "")
        .map(([k, v]) => `${SIZE_KEYS[k.toLowerCase()] || k} ${v}`);
      return parts.length ? parts.join(" / ") : "—";
    }
  } catch { /* not JSON, fall through */ }
  return String(size) || "—";
};

/* ─── Time filter options ─── */
const PAYOUT_PERIOD_OPTS = [
  { v: "today",   l: "วันนี้",   icon: "mdi:weather-sunny" },
  { v: "week",    l: "สัปดาห์นี้", icon: "mdi:calendar-week" },
  { v: "month",   l: "เดือนนี้", icon: "mdi:calendar-month" },
  { v: "3months", l: "3 เดือน",  icon: "mdi:calendar-range" },
  { v: "6months", l: "6 เดือน",  icon: "mdi:calendar-range" },
  { v: "year",    l: "1 ปี",     icon: "mdi:calendar-year"  },
];

const PAYOUT_PERIOD_LABELS = {
  today:    "วันนี้",
  week:     "สัปดาห์นี้",
  month:    "เดือนนี้",
  "3months": "ย้อนหลัง 3 เดือน",
  "6months": "ย้อนหลัง 6 เดือน",
  year:     "ย้อนหลัง 1 ปี",
  custom:   "กำหนดเอง",
};

/* ─── helpers ─── */
const fmtBaht = (n) =>
  "฿" + Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("th-TH", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";
const PAYOUT_PAGE_SIZE = 10;

const payoutStageMeta = (stage) => {
  if (stage === "overdue") {
    return { label: "เกินกำหนด", cls: "admPayoutStatus--overdue", icon: "mdi:alert-circle-outline" };
  }
  if (stage === "ready") {
    return { label: "พร้อมโอน", cls: "admPayoutStatus--ready", icon: "mdi:bank-transfer-out" };
  }
  return { label: "รอตัดรอบ", cls: "admPayoutStatus--cycle", icon: "mdi:calendar-clock" };
};

const payableRows = (rows) => rows.filter((row) => Number(row.payable_amount || 0) > 0);

/* ═══════════════════════════════════════════════════════════
   PayAllConfirmModal — แทน window.confirm สำหรับโอนทั้งหมด
═══════════════════════════════════════════════════════════ */
function PayAllConfirmModal({ rows, totalNet: totalNetProp, sellerCount, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  const rowsToPay = payableRows(rows);
  const totalNet = Number(totalNetProp ?? rowsToPay.reduce((s, r) => s + Number(r.payable_amount || 0), 0));
  const totalSellerCount = Number(sellerCount || rowsToPay.length);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="admModalOverlay">
      <div
        className="admModal"
        style={{ width: 480, borderRadius: 22, padding: 0, boxShadow: "0 24px 70px rgba(0,0,0,0.22)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{
          background: "linear-gradient(135deg,#0d9488 0%,#14b8a6 60%,#5eead4 100%)",
          padding: "22px 26px 18px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:bank-transfer-out" style={{ fontSize: 26, color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>โอนเงินทั้งหมด</div>
                <div style={{ fontSize: 13, color: "#99f6e4", marginTop: 2 }}>
                  {totalSellerCount} ผู้ขาย · รวม {fmtBaht(totalNet)}
                </div>
              </div>
            </div>
            <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", width: 34, height: 34, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: "20px 24px 24px", background: "#fff" }}>
          {/* seller list */}
          <div style={{ marginBottom: 16, maxHeight: 200, overflowY: "auto" }}>
            {rowsToPay.map((r, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 10,
                background: i % 2 === 0 ? "#f8fafc" : "#fff",
                border: "1px solid #f1f5f9", marginBottom: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0d9488,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                    {(r.seller_name || "ก").charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{r.seller_name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{Number(r.ready_count || 0) + Number(r.overdue_count || 0)} ออเดอร์พร้อมโอน</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#16a34a" }}>
                  {fmtBaht(r.payable_amount)}
                </div>
              </div>
            ))}
          </div>

          {/* total */}
          <div style={{ background: "#f0fdfb", border: "1px solid #99f6e4", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#4c1d95" }}>ยอดโอนรวมทั้งหมด</span>
            <span style={{ fontWeight: 900, fontSize: 24, color: "#0d9488" }}>{fmtBaht(totalNet)}</span>
          </div>

          {/* warning */}
          <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#92400e", marginBottom: 18, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Icon icon="mdi:alert-outline" style={{ fontSize: 18, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
            <span>ระบบจะโอนเงินให้ผู้ขาย <strong>{totalSellerCount} ราย</strong> พร้อมกัน การดำเนินการนี้ไม่สามารถยกเลิกได้</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              ยกเลิก
            </button>
            <button onClick={handleConfirm} disabled={loading} style={{
              flex: 2, padding: "12px", borderRadius: 12, border: "none",
              background: loading ? "#ccfbf1" : "linear-gradient(135deg,#0d9488 0%,#14b8a6 100%)",
              color: loading ? "#0d9488" : "#fff", fontWeight: 800, fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading ? "none" : "0 4px 14px rgba(124,58,237,0.3)",
            }}>
              {loading
                ? <><Icon icon="eos-icons:loading" style={{ fontSize: 18 }} /> กำลังโอน…</>
                : <><Icon icon="mdi:bank-transfer-out" style={{ fontSize: 18 }} /> ยืนยันโอนทั้งหมด {fmtBaht(totalNet)}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   OrderDetailModal — รายละเอียดออเดอร์ + items ของผู้ขาย
═══════════════════════════════════════════════════════════ */
function OrderDetailModal({ seller, onClose, period = "month", customStart = "", customEnd = "" }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [expanded, setExpanded] = useState({}); // orderId → { loading, items, shipping }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          seller_id: String(seller.seller_id),
          status: "delivered",
          payout_status: "pending",
          limit: "50",
          period,
        });
        if (period === "custom" && customStart && customEnd) {
          params.set("start_date", customStart);
          params.set("end_date", customEnd);
        }
        const data = await request(
          `/admin/orders?${params.toString()}`,
          { method: "GET", auth: true }
        );
        setOrders(data.rows || data.orders || []);
      } catch (e) {
        setErr(e?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [seller.seller_id, period, customStart, customEnd]);

  /* expand / collapse order items */
  const toggleExpand = async (orderId) => {
    if (expanded[orderId]) {
      setExpanded((p) => ({ ...p, [orderId]: undefined }));
      return;
    }
    setExpanded((p) => ({ ...p, [orderId]: { loading: true, items: [], shipping: [] } }));
    try {
      const detail = await request(`/admin/orders/${orderId}`, { method: "GET", auth: true });
      setExpanded((p) => ({
        ...p,
        [orderId]: {
          loading: false,
          items: detail.items || [],
          shipping: detail.shipping || [],
        },
      }));
    } catch {
      setExpanded((p) => ({ ...p, [orderId]: { loading: false, items: [], shipping: [], error: true } }));
    }
  };

  const totalSales    = orders.reduce((s, o) => s + Number(o.total_price    || 0), 0);
  const totalFee      = orders.reduce((s, o) => s + Number(o.platform_fee   || 0), 0);
  const totalShipping = orders.reduce((s, o) => s + Number(o.shipping_total || 0), 0);
  const totalPayout   = orders.reduce((s, o) => s + Number(o.seller_payout_amount || 0), 0);

  const thSt = (align = "left") => ({
    padding: "10px 14px", background: "#f0f4ff", color: "#1e3a8a",
    fontSize: 11, fontWeight: 700, textAlign: align,
    borderBottom: "2px solid #dbeafe", textTransform: "uppercase",
    letterSpacing: "0.4px", whiteSpace: "nowrap", verticalAlign: "middle",
  });
  const tdSt = (align = "left") => ({
    padding: "11px 14px", fontSize: 13, color: "#334155", textAlign: align,
    borderBottom: "1px solid #f1f5f9", verticalAlign: "middle", whiteSpace: "nowrap",
  });
  const ORDER_COLS = [
    { w: "4%",  align: "center" },
    { w: "14%", align: "left"   },
    { w: "12%", align: "left"   },
    { w: "22%", align: "left"   },
    { w: "12%", align: "right"  },
    { w: "10%", align: "right"  },
    { w: "13%", align: "right"  },
    { w: "13%", align: "right"  },
  ];

  return (
    <div className="admModalOverlay" onClick={onClose}>
      <div
        className="admModal"
        style={{ width: 880, maxWidth: "96vw", borderRadius: 20, maxHeight: "90vh", overflowY: "auto", padding: 0, boxShadow: "0 24px 70px rgba(0,0,0,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient header */}
        <div style={{ background: "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 55%,#7dd3fc 100%)", padding: "22px 26px 18px", borderRadius: "20px 20px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, color: "#fff" }}>
                {(seller.seller_name || "ก").charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>{seller.seller_name}</div>
                <div style={{ fontSize: 13, color: "#bfdbfe", marginTop: 2 }}>
                  <Icon icon="mdi:shopping-outline" style={{ verticalAlign: "middle", marginRight: 5 }} />
                  รายละเอียดออเดอร์รอโอน · {loading ? "…" : `${orders.length} ออเดอร์`}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", width: 34, height: 34, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* bank info strip */}
          <div style={{ marginTop: 16, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "ธนาคาร",    value: bankLabel(seller.bank_code),          icon: "mdi:bank-outline" },
              { label: "เลขบัญชี", value: seller.bank_account_number || "—",     icon: "mdi:credit-card-outline" },
              { label: "ชื่อบัญชี", value: seller.bank_account_name || seller.seller_name || "—", icon: "mdi:account-outline" },
            ].map((f, i) => (
              <>
                {i > 0 && <div key={`div${i}`} style={{ width: 1, height: 32, background: "rgba(255,255,255,0.2)" }} />}
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon icon={f.icon} style={{ color: "#bfdbfe", fontSize: 18 }} />
                  <div>
                    <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600 }}>{f.label}</div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{f.value}</div>
                  </div>
                </div>
              </>
            ))}
          </div>
        </div>

        {/* financial summary strip — formula layout */}
        <div style={{ background: "#fff", padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
          {/* formula row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {/* ยอดสินค้า */}
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>ยอดสินค้า</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginTop: 2 }}>{fmtBaht(totalSales - totalShipping)}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>ไม่รวมค่าส่ง</div>
            </div>
            <div style={{ fontSize: 18, color: "#94a3b8", fontWeight: 700 }}>+</div>
            {/* ค่าจัดส่ง */}
            <div style={{ background: "#f0fdfb", border: "1px solid #99f6e4", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 90 }}>
              <div style={{ fontSize: 10, color: "#0d9488", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>ค่าจัดส่ง</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0d9488", marginTop: 2 }}>{fmtBaht(totalShipping)}</div>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, padding: "0 2px" }}>= {fmtBaht(totalSales)}</div>
            <div style={{ fontSize: 18, color: "#e03131", fontWeight: 700 }}>−</div>
            {/* ค่าธรรมเนียม */}
            <div style={{ background: "#fff8e1", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 110 }}>
              <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>ค่าธรรมเนียม</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#d97706", marginTop: 2 }}>{fmtBaht(totalFee)}</div>
              <div style={{ fontSize: 10, color: "#a16207", marginTop: 1 }}>15% ขั้นต่ำ ฿20/ออเดอร์</div>
            </div>
            <div style={{ fontSize: 18, color: "#16a34a", fontWeight: 700 }}>=</div>
            {/* ยอดโอนสุทธิ */}
            <div style={{ background: "#f0fdf4", border: "2px solid #86efac", borderRadius: 10, padding: "8px 16px", textAlign: "center", minWidth: 110 }}>
              <div style={{ fontSize: 10, color: "#15803d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>ยอดโอนสุทธิ</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#16a34a", marginTop: 2 }}>{fmtBaht(totalPayout)}</div>
            </div>
          </div>
          {/* fee note */}
          <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 6 }}>
            <Icon icon="mdi:information-outline" style={{ fontSize: 14, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>ค่าธรรมเนียมคิดจากยอดสินค้าเท่านั้น</strong> (ไม่รวมค่าจัดส่ง) อัตรา 15% ขั้นต่ำ ฿20/ออเดอร์
              &nbsp;— ยอดโอนสุทธิ = ยอดสินค้า + ค่าจัดส่ง − ค่าธรรมเนียม
            </span>
          </div>
        </div>

        {/* orders body */}
        <div style={{ padding: "18px 24px 24px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#475569", marginBottom: 10 }}>
            <Icon icon="mdi:clipboard-list-outline" style={{ verticalAlign: "middle", marginRight: 6, color: "#5285e8" }} />
            รายการออเดอร์ที่สำเร็จ
          </div>

          {loading && (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
              <Icon icon="eos-icons:loading" style={{ fontSize: 28, display: "block", margin: "0 auto 8px" }} />
              กำลังโหลด…
            </div>
          )}
          {err && <div style={{ textAlign: "center", color: "#ef4444", padding: 16, borderRadius: 10, background: "#fff5f5" }}>{err}</div>}

          {!loading && !err && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  {ORDER_COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={thSt("center")}></th>
                    <th style={thSt("left")}>รหัสออเดอร์</th>
                    <th style={thSt("left")}>วันที่สั่ง</th>
                    <th style={thSt("left")}>สินค้า</th>
                    <th style={thSt("right")}>ยอดสินค้า</th>
                    <th style={thSt("right")}>ค่าส่ง</th>
                    <th style={thSt("right")}>ค่าธรรมเนียม</th>
                    <th style={thSt("right")}>ยอดโอน</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...tdSt("center"), color: "#94a3b8", padding: 40 }}>
                        <Icon icon="mdi:inbox-outline" style={{ fontSize: 32, display: "block", margin: "0 auto 8px" }} />
                        ไม่มีออเดอร์รอโอนในช่วงเวลานี้
                      </td>
                    </tr>
                  ) : orders.map((o, i) => {
                    const exp = expanded[o.order_id];
                    const isOpen = !!exp;
                    const fee        = Number(o.platform_fee          || 0);
                    const shipping   = Number(o.shipping_total        || 0);
                    const total      = Number(o.total_price            || 0);
                    const itemsOnly  = total - shipping; // ยอดสินค้าไม่รวมค่าส่ง
                    const net        = Number(o.seller_payout_amount   || (total - fee));
                    return (
                      <>
                        {/* main row — clickable */}
                        <tr
                          key={o.order_id}
                          style={{ background: isOpen ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                          onClick={() => toggleExpand(o.order_id)}
                          onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "#f0f9ff"; }}
                          onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"; }}
                        >
                          <td style={{ ...tdSt("center"), color: "#5285e8", fontSize: 16 }}>
                            <Icon icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"} />
                          </td>
                          <td style={tdSt("left")}>
                            <span style={{ fontWeight: 700, color: "#1e40af", fontSize: 12, letterSpacing: "0.3px" }}>
                              {formatOrderNo(o.order_id)}
                            </span>
                          </td>
                          <td style={{ ...tdSt("left"), color: "#64748b" }}>{fmtDate(o.created_at)}</td>
                          <td style={{ ...tdSt("left"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {o.products || "—"}
                          </td>
                          <td style={tdSt("right")}>
                            <div style={{ fontWeight: 600 }}>{fmtBaht(itemsOnly)}</div>
                          </td>
                          <td style={{ ...tdSt("right"), color: "#0d9488", fontWeight: 700 }}>{fmtBaht(shipping)}</td>
                          <td style={tdSt("right")}>
                            <div style={{ fontWeight: 700, color: "#d97706" }}>{fmtBaht(fee)}</div>
                          </td>
                          <td style={{ ...tdSt("right"), color: "#16a34a", fontWeight: 700 }}>{fmtBaht(net)}</td>
                        </tr>

                        {/* expanded items row */}
                        {isOpen && (
                          <tr key={`exp-${o.order_id}`} style={{ background: "#f0f9ff" }}>
                            <td colSpan={8} style={{ padding: "0 18px 14px 50px", borderBottom: "1px solid #dbeafe" }}>
                              {exp.loading ? (
                                <div style={{ padding: "12px 0", color: "#94a3b8", display: "flex", alignItems: "center", gap: 8 }}>
                                  <Icon icon="eos-icons:loading" style={{ fontSize: 18 }} /> กำลังโหลดรายการสินค้า…
                                </div>
                              ) : exp.error ? (
                                <div style={{ padding: "10px 0", color: "#ef4444", fontSize: 13 }}>โหลดรายการสินค้าไม่สำเร็จ</div>
                              ) : exp.items.length === 0 ? (
                                <div style={{ padding: "10px 0", color: "#94a3b8", fontSize: 13 }}>ไม่พบรายการสินค้า</div>
                              ) : (
                                <div style={{ marginTop: 10 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                    <Icon icon="mdi:package-variant" style={{ color: "#5285e8", fontSize: 16 }} />
                                    รายการสินค้าในออเดอร์นี้
                                  </div>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                    <thead>
                                      <tr style={{ background: "#dbeafe" }}>
                                        <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#1e3a8a", fontSize: 11 }}>สินค้า</th>
                                        <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#1e3a8a", fontSize: 11 }}>ไซส์</th>
                                        <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#1e3a8a", fontSize: 11 }}>จำนวน</th>
                                        <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#1e3a8a", fontSize: 11 }}>ราคา/ชิ้น</th>
                                        <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#1e3a8a", fontSize: 11 }}>รวม</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {exp.items.map((it, j) => (
                                        <tr key={j} style={{ background: j % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                          <td style={{ padding: "9px 12px", color: "#0f172a", fontWeight: 600 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                              {it.cover_image && (
                                                <img src={it.cover_image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #e2e8f0" }} />
                                              )}
                                              <span>{it.product_title || "—"}</span>
                                            </div>
                                          </td>
                                          <td style={{ padding: "9px 12px", textAlign: "center", color: "#64748b", fontSize: 12 }}>{formatSize(it.size)}</td>
                                          <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700 }}>{it.quantity}</td>
                                          <td style={{ padding: "9px 12px", textAlign: "right" }}>{fmtBaht(it.price_at_purchase)}</td>
                                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                                            {fmtBaht(Number(it.price_at_purchase) * Number(it.quantity))}
                                          </td>
                                        </tr>
                                      ))}
                                      {/* shipping row */}
                                      {exp.shipping.length > 0 && exp.shipping.map((sh, j) => (
                                        <tr key={`sh${j}`} style={{ background: "#f0fdfb" }}>
                                          <td style={{ padding: "9px 12px", color: "#0d9488", fontWeight: 600 }}>
                                            <Icon icon="mdi:truck-outline" style={{ verticalAlign: "middle", marginRight: 6 }} />
                                            ค่าจัดส่ง {sh.provider_name ? `(${sh.provider_name})` : ""}
                                          </td>
                                          <td colSpan={3} />
                                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#0d9488" }}>
                                            {fmtBaht(sh.shipping_price)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
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

/* ═══════════════════════════════════════════════════════════
   PaidDetailModal — ดูรายละเอียดการโอนที่สำเร็จ
═══════════════════════════════════════════════════════════ */
function PaidDetailModal({ row, onClose }) {
  if (!row) return null;

  return (
    <div className="admModalOverlay" onClick={onClose}>
      <div
        className="admModal"
        style={{ width: 460, borderRadius: 22, padding: 0, boxShadow: "0 24px 70px rgba(0,0,0,0.2)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ background: "linear-gradient(135deg,#059669 0%,#10b981 60%,#6ee7b7 100%)", padding: "22px 24px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:check-circle-outline" style={{ fontSize: 26, color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>โอนเงินสำเร็จ</div>
                <div style={{ fontSize: 13, color: "#a7f3d0", marginTop: 2 }}>{row.seller_name}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", width: 34, height: 34, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: "22px 24px 28px", background: "#fff" }}>

          {/* transfer date highlight */}
          <div style={{ background: "linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)", border: "1px solid #bbf7d0", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon icon="mdi:calendar-check" style={{ fontSize: 22, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>วันที่โอนเงิน</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginTop: 2 }}>
                {fmtDateTime(row.paid_at || row.completed_at)}
              </div>
            </div>
          </div>

          {/* bank info */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ข้อมูลบัญชีปลายทาง
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
              {[
                { label: "ธนาคาร",    value: bankLabel(row.bank_code),                              icon: "mdi:bank-outline" },
                { label: "เลขบัญชี", value: maskAccNo(row.bank_account_number),                    icon: "mdi:credit-card-outline" },
                { label: "ชื่อบัญชี", value: row.bank_account_name  || row.seller_name || "—",     icon: "mdi:account-outline" },
                { label: "จำนวนออเดอร์", value: `${row.order_count || "—"} ออเดอร์`,              icon: "mdi:shopping-outline" },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Icon icon={f.icon} style={{ color: "#5285e8", fontSize: 18, marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{f.label}</div>
                    <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{f.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* amount summary */}
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>สรุปยอดโอน</div>

            {/* ยอดรวม (net + fee = total) */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Icon icon="mdi:tag-outline" style={{ fontSize: 14, color: "#5285e8" }} />
                ยอดรวมที่ผู้ขายรับจากผู้ซื้อ
              </span>
              <span style={{ fontWeight: 600 }}>
                {fmtBaht(row.total_sales || (Number(row.net_amount || 0) + Number(row.fee_amount || 0)))}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#d97706", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Icon icon="mdi:minus-circle-outline" style={{ fontSize: 14 }} />
                หัก ค่าธรรมเนียม
                <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 5px" }}>
                  15% ขั้นต่ำ ฿20/ออเดอร์
                </span>
              </span>
              <span style={{ fontWeight: 700 }}>-{fmtBaht(row.fee_amount)}</span>
            </div>
            {/* fee basis note */}
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, paddingLeft: 20, fontStyle: "italic" }}>
              * ค่าธรรมเนียมคิดจากยอดสินค้า (ไม่รวมค่าจัดส่ง) อัตรา 15% ขั้นต่ำ ฿20/ออเดอร์
            </div>

            <div style={{ borderTop: "2px dashed #e2e8f0", paddingTop: 10, marginTop: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>ยอดโอนสุทธิ</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>ที่โอนให้ผู้ขายจริง</div>
              </div>
              <span style={{ fontWeight: 900, fontSize: 22, color: "#16a34a" }}>{fmtBaht(row.net_amount)}</span>
            </div>
          </div>

          <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ConfirmPayoutModal — ยืนยันการโอนเงิน (2 ขั้นตอน)
═══════════════════════════════════════════════════════════ */
function ConfirmPayoutModal({ item, onConfirm, onCancel }) {
  const [step, setStep]         = useState(1); // 1=ตรวจสอบ, 2=ยืนยัน
  const [confirming, setConfirming] = useState(false);

  if (!item) return null;
  const fee15    = Number(item.fee_amount     || 0);
  const net      = Number(item.net_amount     || 0);
  const shipping = Number(item.shipping_total || 0);
  const itemsOnly = Number(item.total_sales   || 0) - shipping; // ยอดสินค้าไม่รวมค่าส่ง

  const STEPS = [
    { n: 1, label: "ตรวจสอบ" },
    { n: 2, label: "ยืนยัน"  },
    { n: 3, label: "สำเร็จ"  },
  ];

  const handleFinalConfirm = async () => {
    setConfirming(true);
    await onConfirm(item, net);
    setConfirming(false);
  };

  return (
    <div className="admModalOverlay">
      <div
        className="admModal"
        style={{ width: 520, borderRadius: 22, padding: 0, boxShadow: "0 24px 70px rgba(0,0,0,0.22)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient header */}
        <div style={{
          background: step === 1
            ? "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 60%,#60a5fa 100%)"
            : "linear-gradient(135deg,#047857 0%,#059669 60%,#34d399 100%)",
          padding: "22px 26px 20px",
          transition: "background 0.4s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
                {step === 1 ? "ตรวจสอบรายการโอน" : "ยืนยันการโอนเงิน"}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>
                {step === 1 ? "กรุณาตรวจสอบข้อมูลให้ถูกต้อง" : "กดยืนยันเพื่อดำเนินการโอนเงิน"}
              </div>
            </div>
            <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", width: 34, height: 34, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* step indicator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13,
                    background: s.n <= step ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.2)",
                    color: s.n <= step ? (step === 1 ? "#1d4ed8" : "#047857") : "#fff",
                    boxShadow: s.n === step ? "0 0 0 3px rgba(255,255,255,0.4)" : "none",
                    transition: "all 0.3s ease",
                  }}>
                    {s.n < step ? <Icon icon="mdi:check" style={{ fontSize: 16 }} /> : s.n}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.n <= step ? "#fff" : "rgba(255,255,255,0.55)" }}>
                    {s.label}
                  </div>
                </div>
                {i < 2 && (
                  <div style={{ width: 80, height: 2, margin: "0 8px 18px", background: s.n < step ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)", transition: "background 0.3s ease" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* body */}
        <div style={{ padding: "22px 26px 26px", background: "#fff" }}>

          {/* seller + bank */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0", marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#5285e8,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
              {(item.seller_name || "ก").charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{item.seller_name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{item.order_count} ออเดอร์ที่สำเร็จ</div>
            </div>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
              รอโอน
            </div>
          </div>

          {/* bank account grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "ธนาคาร",          value: bankLabel(item.bank_code),                            icon: "mdi:bank-outline" },
              { label: "เลขบัญชีปลายทาง", value: item.bank_account_number || "—",                     icon: "mdi:credit-card-outline" },
              { label: "ชื่อบัญชี",       value: item.bank_account_name || item.seller_name || "—",   icon: "mdi:account-circle-outline" },
              { label: "จำนวนออเดอร์",    value: `${item.order_count} ออเดอร์`,                        icon: "mdi:shopping-outline" },
            ].map((f) => (
              <div key={f.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Icon icon={f.icon} style={{ color: "#5285e8", fontSize: 18, marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 13, marginTop: 1 }}>{f.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* financial summary */}
          <div style={{ background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)", borderRadius: 14, padding: "16px 18px", border: "1px solid #e2e8f0", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon icon="mdi:receipt-text-outline" style={{ color: "#5285e8", fontSize: 16 }} />
              สรุปรายการโอน
            </div>

            {/* ยอดสินค้า + ค่าส่ง */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:tag-outline" style={{ fontSize: 15, color: "#5285e8" }} />
                ยอดสินค้า (ไม่รวมค่าจัดส่ง)
              </span>
              <span style={{ fontWeight: 600 }}>{fmtBaht(itemsOnly)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0d9488", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:plus-circle-outline" style={{ fontSize: 15 }} />
                ค่าจัดส่ง
              </span>
              <span style={{ fontWeight: 600 }}>+{fmtBaht(shipping)}</span>
            </div>

            {/* subtotal divider */}
            <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
              <span style={{ fontWeight: 700 }}>รวมที่ผู้ขายได้รับจากผู้ซื้อ</span>
              <span style={{ fontWeight: 700 }}>{fmtBaht(item.total_sales)}</span>
            </div>

            {/* ค่าธรรมเนียม */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#d97706", marginBottom: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:minus-circle-outline" style={{ fontSize: 15 }} />
                หัก ค่าธรรมเนียมแพลตฟอร์ม
              </span>
              <span style={{ fontWeight: 700 }}>-{fmtBaht(fee15)}</span>
            </div>
            {/* fee formula note */}
            <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, padding: "7px 10px", marginBottom: 10, fontSize: 11, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 6 }}>
              <Icon icon="mdi:information-outline" style={{ fontSize: 14, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
              <span>
                คิดจากยอดสินค้า {fmtBaht(itemsOnly)} × 15% = {fmtBaht(Math.round(itemsOnly * 0.15))}
                {Math.round(itemsOnly * 0.15) < 20
                  ? ` → ใช้ขั้นต่ำ ฿20/ออเดอร์`
                  : ` (ใช้ 15% เพราะ > ขั้นต่ำ ฿20)`}
              </span>
            </div>

            {/* net total */}
            <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>ยอดโอนสุทธิ</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>= ยอดสินค้า + ค่าส่ง − ค่าธรรมเนียม</div>
              </div>
              <span style={{ fontWeight: 900, fontSize: 26, color: "#16a34a" }}>{fmtBaht(net)}</span>
            </div>
          </div>

          {/* warning (step 2 only) */}
          {step === 2 && (
            <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#92400e", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Icon icon="mdi:alert-outline" style={{ fontSize: 18, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
              <span>
                การโอนเงินไม่สามารถยกเลิกได้ กรุณาตรวจสอบเลขบัญชี{" "}
                <strong>{item.bank_account_number || "—"}</strong>{" "}
                ({bankLabel(item.bank_code)}) ให้ถูกต้องก่อนกดยืนยัน
              </span>
            </div>
          )}

          {/* buttons */}
          {step === 1 ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                ยกเลิก
              </button>
              <button onClick={() => setStep(2)} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(29,78,216,0.3)" }}>
                ดำเนินการต่อ
                <Icon icon="mdi:arrow-right" style={{ fontSize: 18 }} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon icon="mdi:arrow-left" style={{ fontSize: 16 }} /> ย้อนกลับ
              </button>
              <button onClick={handleFinalConfirm} disabled={confirming} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: confirming ? "#d1fae5" : "linear-gradient(135deg,#047857 0%,#059669 100%)", color: confirming ? "#059669" : "#fff", fontWeight: 800, fontSize: 14, cursor: confirming ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: confirming ? "none" : "0 4px 14px rgba(5,150,105,0.35)", transition: "all 0.2s ease" }}>
                {confirming
                  ? <><Icon icon="eos-icons:loading" style={{ fontSize: 18 }} /> กำลังโอน…</>
                  : <><Icon icon="mdi:bank-transfer" style={{ fontSize: 18 }} /> ยืนยันโอนเงิน {fmtBaht(net)}</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AdminPayoutPage — หน้าหลัก
═══════════════════════════════════════════════════════════ */
export default function AdminPayoutPage() {
  const [summaryStats, setSummaryStats] = useState({
    pending_total: 0, pending_count: 0, pending_seller_count: 0,
    payable_total: 0, payable_count: 0, payable_seller_count: 0,
    ready_total: 0, ready_count: 0,
    overdue_total: 0, overdue_count: 0,
    cycle_pending_total: 0, cycle_pending_count: 0,
    paid_total: 0, paid_count: 0, fee_total: 0,
  });
  const [pendingRows, setPendingRows]   = useState([]);
  const [historyRows, setHistoryRows]   = useState([]);
  const [payoutCycle, setPayoutCycle]   = useState(null);
  const [period, setPeriod]             = useState("month");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart]   = useState("");
  const [customEnd, setCustomEnd]       = useState("");
  const [selectedItem, setSelectedItem] = useState(null);   // confirm modal
  const [orderDetail, setOrderDetail]   = useState(null);   // pending detail
  const [paidDetail, setPaidDetail]     = useState(null);   // history detail
  const [payAllModal, setPayAllModal]   = useState(false);  // pay-all confirm
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [pendingPage, setPendingPage]   = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [loading, setLoading]           = useState(true);
  const pagedPending = pendingRows;
  const [err, setErr]                   = useState("");
  const [toast, setToast]               = useState(null);

  const now     = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setErr("");
      const params = new URLSearchParams({
        period,
        pending_page: pendingPage,
        history_page: page,
        pending_limit: PAYOUT_PAGE_SIZE,
        history_limit: PAYOUT_PAGE_SIZE,
      });
      if (period === "custom" && customStart && customEnd) {
        params.set("start_date", customStart);
        params.set("end_date", customEnd);
      }
      const data   = await request(`/admin/payouts?${params}`, { method: "GET", auth: true });
      setSummaryStats(data.stats        || {});
      setPendingRows(data.pending       || []);
      setHistoryRows(data.history       || []);
      setTotalPages(data.total_pages    || 1);
      setPendingTotalPages(data.pending_total_pages || 1);
      if (data.payout_cycle) setPayoutCycle(data.payout_cycle);
    } catch (e) {
      setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [period, page, pendingPage, customStart, customEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setPendingPage(1);
    setPage(1);
  }, [period, customStart, customEnd]);

  const handlePayAll = async () => {
    try {
      const data = await request("/admin/payouts/pay-all", { method: "POST", auth: true });
      showToast(`โอนเงินสำเร็จ ${data.count || ""} ผู้ขาย`);
      setPayAllModal(false);
      loadData();
    } catch (e) {
      showToast(e?.data?.message || "เกิดข้อผิดพลาด", "error");
      setPayAllModal(false);
    }
  };

  const handleConfirmPayout = async (item, net) => {
    await request(`/admin/payouts/${item.seller_id}/pay`, {
      method: "POST", auth: true,
      body: { net_amount: net },
    });
    showToast(`โอนเงิน ${fmtBaht(net)} ให้ ${item.seller_name} สำเร็จ`);
    setSelectedItem(null);
    loadData();
  };

  return (
    <div className="boPage">
      <div className="boTop">
        <div className="boTitle">โอนเงินให้ผู้ขาย</div>
        <div className="boAdmin">
          <NotificationBell />
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      <div className="boPageInner">
        {/* ── Time Filter Card ── */}
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
          padding: "14px 18px", marginBottom: 18,
          boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:clock-time-four-outline" style={{ color: "#fff", fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>ช่วงเวลา</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>รอโอน: ตามวันที่ออเดอร์ · ประวัติ: ตามวันที่โอน</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:calendar-check" style={{ color: "#1d4ed8", fontSize: 14 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
                  {period === "custom" && customStart && customEnd ? `${customStart} → ${customEnd}` : PAYOUT_PERIOD_LABELS[period] || "เดือนนี้"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{dateStr} · {timeStr}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PAYOUT_PERIOD_OPTS.map((t) => {
              const isActive = period === t.v && !showCustomPicker;
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => { setPeriod(t.v); setShowCustomPicker(false); setPage(1); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "7px 14px", borderRadius: 20, border: "1.5px solid",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: isActive ? "#1d4ed8" : "#f8fafc",
                    color: isActive ? "#fff" : "#475569",
                    borderColor: isActive ? "#1d4ed8" : "#e2e8f0",
                    boxShadow: isActive ? "0 2px 8px rgba(29,78,216,0.22)" : "none",
                    transform: isActive ? "translateY(-1px)" : "none",
                  }}
                >
                  <Icon icon={t.icon} style={{ fontSize: 13 }} />
                  {t.l}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => { setShowCustomPicker(!showCustomPicker); if (!showCustomPicker) setPeriod("custom"); }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: 20, border: "1.5px solid",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                transition: "all 0.15s ease",
                background: showCustomPicker ? "#1d4ed8" : "#f8fafc",
                color: showCustomPicker ? "#fff" : "#475569",
                borderColor: showCustomPicker ? "#1d4ed8" : "#e2e8f0",
                boxShadow: showCustomPicker ? "0 2px 8px rgba(29,78,216,0.22)" : "none",
              }}
            >
              <Icon icon="mdi:calendar-edit" style={{ fontSize: 13 }} />
              กำหนดเอง
            </button>
          </div>
          {showCustomPicker && (
            <div style={{
              marginTop: 12, padding: "12px 16px",
              background: "linear-gradient(135deg,#eff6ff,#f0f9ff)",
              borderRadius: 12, border: "1px solid #bfdbfe",
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon="mdi:calendar-start" style={{ color: "#fff", fontSize: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>วันเริ่มต้น</div>
                  <input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setPage(1); }}
                    style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", fontFamily: "inherit" }} />
                </div>
              </div>
              <Icon icon="mdi:arrow-right" style={{ color: "#1d4ed8", fontSize: 18, paddingTop: 14 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon="mdi:calendar-end" style={{ color: "#fff", fontSize: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>วันสิ้นสุด</div>
                  <input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setPage(1); }}
                    style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", fontFamily: "inherit" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── กล่องข้อกำหนดการโอนเงิน ── */}
        <div style={{
          background: "linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%)",
          border: "1px solid #bfdbfe", borderRadius: 14,
          padding: "14px 18px", marginBottom: 16,
          display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start",
        }}>
          {/* icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon icon="mdi:calendar-clock" style={{ fontSize: 22, color: "#fff" }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#1e3a8a" }}>ข้อกำหนดการโอนเงินผู้ขาย</div>
          </div>
          {/* divider */}
          <div style={{ width: 1, background: "#bfdbfe", alignSelf: "stretch", flexShrink: 0 }} />
          {/* rules */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", flex: 1, fontSize: 12, color: "#1e40af" }}>
            {[
              { icon: "mdi:calendar-end", label: "วันตัดรอบ", value: payoutCycle?.cutoff_date || "สิ้นเดือนนี้" },
              { icon: "mdi:bank-transfer", label: "โอนเงินภายใน", value: payoutCycle?.payout_date ? `ภายใน ${payoutCycle.payout_date}` : "7 วันหลังสิ้นเดือน" },
              { icon: "mdi:check-decagram-outline", label: "เงื่อนไข", value: "เฉพาะออเดอร์ที่ลูกค้ายืนยันรับของแล้ว" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 160 }}>
                <Icon icon={r.icon} style={{ fontSize: 16, color: "#3b82f6", marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.label}</div>
                  <div style={{ fontWeight: 700, color: "#1e3a8a", marginTop: 1 }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* stat cards */}
        <div className="admPayoutStatGrid3">
          {[
            { label: "พร้อมโอน",       value: summaryStats.payable_total, sub: `${summaryStats.payable_count||0} รายการผ่านรอบแล้ว`, cls: "red",   icon: "mdi:bank-transfer-out",      iconBg: "#fee2e2", iconColor: "#e03131" },
            { label: "โอนแล้ว",        value: summaryStats.paid_total,    sub: `${summaryStats.paid_count||0} รายการ`,       cls: "green", icon: "mdi:check-circle-outline",   iconBg: "#dcfce7", iconColor: "#22b14c" },
            { label: "ค่าธรรมเนียมสะสม", value: summaryStats.fee_total,  sub: "",                                             cls: "blue",  icon: "mdi:percent-circle-outline", iconBg: "#dbeafe", iconColor: "#5285e8", extra: true },
          ].map((c) => (
            <div key={c.label} className={`admPayoutStatCard${c.extra ? " admPayoutStatCard--blue" : ""}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon={c.icon} style={{ color: c.iconColor, fontSize: 20 }} />
                </div>
                <div className={`admPayoutStatCard__label admPayoutStatCard__label--${c.cls}`}>{c.label}</div>
              </div>
              <div className={`admPayoutStatCard__value admPayoutStatCard__value--${c.cls}`}>
                ฿{(c.value || 0).toLocaleString()}
              </div>
              {c.sub && <div className="admPayoutStatCard__sub">{c.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "-8px 0 16px" }}>
          <span className="admPayoutStatus admPayoutStatus--cycle">
            <Icon icon="mdi:calendar-clock" style={{ fontSize: 13 }} />
            รอตัดรอบ {summaryStats.cycle_pending_count || 0} รายการ · {fmtBaht(summaryStats.cycle_pending_total)}
          </span>
          <span className="admPayoutStatus admPayoutStatus--overdue">
            <Icon icon="mdi:alert-circle-outline" style={{ fontSize: 13 }} />
            เกินกำหนด {summaryStats.overdue_count || 0} รายการ · {fmtBaht(summaryStats.overdue_total)}
          </span>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
            <Icon icon="eos-icons:loading" style={{ fontSize: 32, display: "block", margin: "0 auto 8px" }} />
            กำลังโหลด…
          </div>
        )}
        {err && (
          <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 12, padding: "14px 18px", color: "#c53030", marginBottom: 16 }}>{err}</div>
        )}

        {!loading && !err && (
          <>
            {/* ── ตารางรายการรอโอน ── */}
            <div className="admPayoutPanel admPayoutPanel--pending">
              {/* card header */}
              <div className="admPayoutPanel__head">
                <div className="admPayoutPanel__title">
                  <div className="admPayoutPanel__icon admPayoutPanel__icon--pending">
                    <Icon icon="mdi:clock-time-eight-outline" style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <span className="admPayoutPanel__label">รายการรอโอนทั้งหมด</span>
                    {Number(summaryStats.pending_seller_count || 0) > 0 && (
                      <span className="admPayoutPanel__count admPayoutPanel__count--pending">
                        {summaryStats.pending_seller_count} รายการ
                      </span>
                    )}
                  </div>
                </div>
                {Number(summaryStats.payable_seller_count || 0) > 0 && (
                  <button onClick={() => setPayAllModal(true)} className="admPayAllBtn">
                    <Icon icon="mdi:bank-transfer-out" style={{ width: 18, height: 18 }} />
                    โอนเงินที่พร้อมโอนทั้งหมด ({fmtBaht(summaryStats.payable_total)})
                  </button>
                )}
              </div>
              <div className="admPayoutTableWrap">
                <table className="admPayoutTable">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "19%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        { label: "ผู้ขาย & บัญชี", align: "left"   },
                        { label: "ออเดอร์",       align: "left" },
                        { label: "ราคาสินค้า",    align: "left" },
                        { label: "ค่าจัดส่ง",     align: "left" },
                        { label: "ค่าธรรมเนียม",  align: "left" },
                        { label: "ยอดโอนสุทธิ",   align: "left"  },
                        { label: "สถานะ",         align: "left" },
                        { label: "จัดการ",        align: "left" },
                      ].map((h, i) => (
                        <th key={i} className="admPayoutTh" style={{ textAlign: h.align }}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="admPayoutTable__empty">
                          <Icon icon="mdi:inbox-outline" className="admPayoutTable__emptyIcon" />
                          <div className="admPayoutTable__emptyTitle">ไม่มีรายการรอโอน</div>
                          <div className="admPayoutTable__emptyText">รายการจะปรากฏที่นี่เมื่อออเดอร์ถูกยืนยัน</div>
                        </td>
                      </tr>
                    ) : pagedPending.map((row, i) => {
                      const shippingTotal = Number(row.shipping_total || 0);
                      const productTotal = Math.max(0, Number(row.total_sales || 0) - shippingTotal);
                      const payableShipping = Number(row.payable_shipping_total || 0);
                      const payableProductTotal = Math.max(0, Number(row.payable_total_sales || 0) - payableShipping);
                      const stage = payoutStageMeta(row.payout_stage);
                      const canPay = Number(row.payable_amount || 0) > 0;
                      return (
                        <tr key={i}>
                          <td>
                            <div className="admPayoutSeller">
                              <div className="admPayoutAvatar">
                                {(row.seller_name || "ก").charAt(0).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div className="admPayoutSeller__name">{row.seller_name}</div>
                                <div className="admPayoutSeller__bank">
                                  <span className="admPayoutBankChip">{bankLabelShort(row.bank_code)}</span>
                                  <span className="admPayoutAccountText">{maskAccNo(row.bank_account_number)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="admPayoutOrderBadge">
                              <Icon icon="mdi:shopping-outline" />
                              <span>{row.order_count}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admPayoutMoney">{fmtBaht(canPay ? payableProductTotal : productTotal)}</div>
                            {canPay && Number(row.cycle_pending_amount || 0) > 0 && (
                              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>ยังไม่ถึงรอบ {fmtBaht(row.cycle_pending_amount)}</div>
                            )}
                          </td>
                          <td>
                            <div className="admPayoutMoney admPayoutMoney--shipping">{fmtBaht(canPay ? payableShipping : shippingTotal)}</div>
                          </td>
                          <td>
                            <div className="admPayoutMoney admPayoutMoney--fee">{fmtBaht(canPay ? row.payable_fee_amount : row.fee_amount)}</div>
                          </td>
                          <td>
                            <div className="admPayoutMoney admPayoutMoney--net">{fmtBaht(canPay ? row.payable_amount : row.net_amount)}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{row.payout_cycle_months || row.first_cycle_month || "—"}</div>
                          </td>
                          <td>
                            <span className={`admPayoutStatus ${stage.cls}`}>
                              <Icon icon={stage.icon} style={{ fontSize: 13 }} />
                              {stage.label}
                            </span>
                          </td>
                          <td>
                            <div className="admPayoutActionRow">
                              <button
                                className="admPayoutBtn admPayoutBtn--transfer"
                                title={canPay ? "โอนเงินรอบที่พร้อมโอน" : "รายการนี้ยังไม่ถึงรอบโอน"}
                                disabled={!canPay}
                                onClick={() => {
                                  if (!canPay) return;
                                  setSelectedItem({
                                    ...row,
                                    total_sales: row.payable_total_sales,
                                    shipping_total: row.payable_shipping_total,
                                    fee_amount: row.payable_fee_amount,
                                    net_amount: row.payable_amount,
                                    order_count: Number(row.ready_count || 0) + Number(row.overdue_count || 0),
                                  });
                                }}
                              >
                                <Icon icon="mdi:bank-transfer-out" style={{ fontSize: 15 }} />
                                {canPay ? "โอนเงิน" : "รอตัดรอบ"}
                              </button>
                              <button className="admPayoutBtn admPayoutBtn--detail" onClick={() => setOrderDetail({ ...row })}>
                                <Icon icon="mdi:file-document-outline" style={{ fontSize: 15 }} />
                                รายละเอียด
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pendingTotalPages > 1 && (
                <div className="admPager">
                  <div className="admPagerNums">
                    {Array.from({ length: pendingTotalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} className={`admPageNum ${p === pendingPage ? "active" : ""}`} onClick={() => setPendingPage(p)}>{p}</button>
                    ))}
                  </div>
                  <div className="admPagerBtns">
                    <button className="admPagerBtn" disabled={pendingPage <= 1} onClick={() => setPendingPage((p) => p - 1)}>{"< ก่อนหน้า"}</button>
                    <button className="admPagerBtn" disabled={pendingPage >= pendingTotalPages} onClick={() => setPendingPage((p) => p + 1)}>{"ถัดไป >"}</button>
                  </div>
                </div>
              )}
            </div>

            {/* ── ตารางประวัติการโอน ── */}
            <div className="admPayoutPanel">
              {/* card header */}
              <div className="admPayoutPanel__head">
                <div className="admPayoutPanel__title">
                  <div className="admPayoutPanel__icon admPayoutPanel__icon--history">
                    <Icon icon="mdi:history" style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <span className="admPayoutPanel__label">ประวัติการโอนทั้งหมด</span>
                    {Number(summaryStats.paid_count || 0) > 0 && (
                      <span className="admPayoutPanel__count admPayoutPanel__count--history">
                        {summaryStats.paid_count} รายการ
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="admPayoutTableWrap">
                <table className="admPayoutTable admPayoutTable--history">
                  <colgroup>
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "19%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        { label: "วันที่โอน",      align: "left"   },
                        { label: "ผู้ขาย",          align: "left"   },
                        { label: "บัญชีปลายทาง",    align: "left"   },
                        { label: "ยอดโอนสุทธิ",     align: "left"  },
                        { label: "ค่าธรรมเนียม",    align: "left"  },
                        { label: "สถานะ",           align: "left" },
                        { label: "รายละเอียด",      align: "left" },
                      ].map((h, i) => (
                        <th key={i} className="admPayoutTh" style={{ textAlign: h.align }}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="admPayoutTable__empty">
                          <Icon icon="mdi:history" className="admPayoutTable__emptyIcon" />
                          <div className="admPayoutTable__emptyTitle">ไม่มีประวัติการโอน</div>
                          <div className="admPayoutTable__emptyText">รายการที่โอนสำเร็จแล้วจะปรากฏที่นี่</div>
                        </td>
                      </tr>
                    ) : historyRows.map((row, i) => {
                      const transferDate = row.paid_at || row.completed_at;
                      return (
                        <tr key={i}>
                          <td className="admPayoutDateCell">
                            <div className="admPayoutDateCell__date">
                              {transferDate ? new Date(transferDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </div>
                            <div className="admPayoutDateCell__time">
                              {transferDate ? new Date(transferDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                          </td>
                          <td>
                            <div className="admPayoutSeller">
                              <div className="admPayoutAvatar">
                                {(row.seller_name || "ก").charAt(0).toUpperCase()}
                              </div>
                              <div className="admPayoutSeller__name">{row.seller_name}</div>
                            </div>
                          </td>
                          <td>
                            <div className="admPayoutSeller__bank admPayoutSeller__bank--inline">
                              <span className="admPayoutBankChip">{bankLabelShort(row.bank_code)}</span>
                              <span className="admPayoutAccountText">{maskAccNo(row.bank_account_number)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admPayoutMoney admPayoutMoney--net">{fmtBaht(row.net_amount)}</div>
                          </td>
                          <td>
                            <div className="admPayoutMoney admPayoutMoney--fee">{fmtBaht(row.fee_amount)}</div>
                          </td>
                          <td>
                            <span className="admPayoutStatus admPayoutStatus--paid">
                              <Icon icon="mdi:check-circle" style={{ fontSize: 13 }} />
                              โอนสำเร็จ
                            </span>
                          </td>
                          <td>
                            <button className="admPayoutBtn admPayoutBtn--detail" onClick={() => setPaidDetail({ ...row })}>
                              <Icon icon="mdi:eye-outline" style={{ fontSize: 15 }} />
                              ดูรายละเอียด
                            </button>
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
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} className={`admPageNum ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                    ))}
                  </div>
                  <div className="admPagerBtns">
                    <button className="admPagerBtn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{"< ก่อนหน้า"}</button>
                    <button className="admPagerBtn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{"ถัดไป >"}</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {payAllModal && (
        <PayAllConfirmModal
          rows={pendingRows}
          totalNet={summaryStats.payable_total}
          sellerCount={summaryStats.payable_seller_count}
          onConfirm={handlePayAll}
          onCancel={() => setPayAllModal(false)}
        />
      )}
      {selectedItem && (
        <ConfirmPayoutModal
          item={selectedItem}
          onConfirm={handleConfirmPayout}
          onCancel={() => setSelectedItem(null)}
        />
      )}
      {orderDetail && (
        <OrderDetailModal
          seller={orderDetail}
          period={period}
          customStart={customStart}
          customEnd={customEnd}
          onClose={() => setOrderDetail(null)}
        />
      )}
      {paidDetail && (
        <PaidDetailModal
          row={paidDetail}
          onClose={() => setPaidDetail(null)}
        />
      )}

      {toast && (
        <div className={`admToast ${toast.type}`}>
          <Icon icon={toast.type === "success" ? "mdi:check-circle" : "mdi:alert-circle"} style={{ fontSize: 18 }} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
