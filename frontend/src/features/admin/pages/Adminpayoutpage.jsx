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

/* ═══════════════════════════════════════════════════════════
   PayAllConfirmModal — แทน window.confirm สำหรับโอนทั้งหมด
═══════════════════════════════════════════════════════════ */
function PayAllConfirmModal({ rows, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  const totalNet = rows.reduce((s, r) => s + Number(r.net_amount || 0), 0);

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
          background: "linear-gradient(135deg,#7c3aed 0%,#8b5cf6 60%,#a78bfa 100%)",
          padding: "22px 26px 18px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:bank-transfer-out" style={{ fontSize: 26, color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>โอนเงินทั้งหมด</div>
                <div style={{ fontSize: 13, color: "#ddd6fe", marginTop: 2 }}>
                  {rows.length} ผู้ขาย · รวม {fmtBaht(totalNet)}
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
            {rows.map((r, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 10,
                background: i % 2 === 0 ? "#f8fafc" : "#fff",
                border: "1px solid #f1f5f9", marginBottom: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                    {(r.seller_name || "ก").charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{r.seller_name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.order_count} ออเดอร์</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#16a34a" }}>
                  {fmtBaht(r.net_amount)}
                </div>
              </div>
            ))}
          </div>

          {/* total */}
          <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#4c1d95" }}>ยอดโอนรวมทั้งหมด</span>
            <span style={{ fontWeight: 900, fontSize: 24, color: "#7c3aed" }}>{fmtBaht(totalNet)}</span>
          </div>

          {/* warning */}
          <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#92400e", marginBottom: 18, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Icon icon="mdi:alert-outline" style={{ fontSize: 18, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
            <span>ระบบจะโอนเงินให้ผู้ขาย <strong>{rows.length} ราย</strong> พร้อมกัน การดำเนินการนี้ไม่สามารถยกเลิกได้</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              ยกเลิก
            </button>
            <button onClick={handleConfirm} disabled={loading} style={{
              flex: 2, padding: "12px", borderRadius: 12, border: "none",
              background: loading ? "#ede9fe" : "linear-gradient(135deg,#7c3aed 0%,#8b5cf6 100%)",
              color: loading ? "#7c3aed" : "#fff", fontWeight: 800, fontSize: 14,
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
function OrderDetailModal({ seller, onClose }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [expanded, setExpanded] = useState({}); // orderId → { loading, items, shipping }

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

  const thSt = {
    padding: "10px 18px", background: "#f0f4ff", color: "#1e3a8a",
    fontSize: 11, fontWeight: 700, textAlign: "left",
    borderBottom: "2px solid #dbeafe", textTransform: "uppercase",
    letterSpacing: "0.4px", whiteSpace: "nowrap",
  };
  const tdSt = {
    padding: "11px 18px", fontSize: 13, color: "#334155",
    borderBottom: "1px solid #f1f5f9", verticalAlign: "middle",
  };

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
                  รายละเอียดออเดอร์ · {loading ? "…" : `${orders.length} ออเดอร์`}
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
            <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 90 }}>
              <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>ค่าจัดส่ง</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#7c3aed", marginTop: 2 }}>{fmtBaht(totalShipping)}</div>
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
            <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
              (กดที่แถวเพื่อดูรายการสินค้าในออเดอร์)
            </span>
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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, width: 28 }}></th>
                    <th style={thSt}>รหัสออเดอร์</th>
                    <th style={thSt}>วันที่สั่ง</th>
                    <th style={thSt}>สินค้า</th>
                    <th style={{ ...thSt, textAlign: "right" }}>
                      <div>ยอดสินค้า</div>
                      <div style={{ fontWeight: 400, fontSize: 10, color: "#64748b", textTransform: "none" }}>ไม่รวมค่าส่ง</div>
                    </th>
                    <th style={{ ...thSt, textAlign: "right" }}>ค่าส่ง</th>
                    <th style={{ ...thSt, textAlign: "right" }}>
                      <div>ค่าธรรมเนียม</div>
                      <div style={{ fontWeight: 400, fontSize: 10, color: "#64748b", textTransform: "none" }}>15% ขั้นต่ำ ฿20</div>
                    </th>
                    <th style={{ ...thSt, textAlign: "right" }}>ยอดโอน</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...tdSt, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                        <Icon icon="mdi:inbox-outline" style={{ fontSize: 32, display: "block", margin: "0 auto 8px" }} />
                        ไม่มีออเดอร์ที่สำเร็จ
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
                    // แสดงสูตรคำนวณค่าธรรมเนียม: max(items * 15%, 20)
                    const feeCalcPct = Math.round(itemsOnly * 0.15);
                    const feeIsMin   = feeCalcPct < 20; // ใช้ขั้นต่ำ ฿20
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
                          <td style={{ ...tdSt, textAlign: "center", color: "#5285e8", fontSize: 16 }}>
                            <Icon icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"} />
                          </td>
                          <td style={tdSt}>
                            <span style={{ fontWeight: 700, color: "#1e40af", fontSize: 12, letterSpacing: "0.3px" }}>
                              {formatOrderNo(o.order_id)}
                            </span>
                          </td>
                          <td style={{ ...tdSt, color: "#64748b" }}>{fmtDate(o.created_at)}</td>
                          <td style={{ ...tdSt, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {o.products || "—"}
                          </td>
                          <td style={{ ...tdSt, textAlign: "right" }}>
                            <div style={{ fontWeight: 600 }}>{fmtBaht(itemsOnly)}</div>
                          </td>
                          <td style={{ ...tdSt, textAlign: "right", color: "#7c3aed", fontWeight: 700 }}>{fmtBaht(shipping)}</td>
                          <td style={{ ...tdSt, textAlign: "right" }}>
                            <div style={{ fontWeight: 700, color: "#d97706" }}>{fmtBaht(fee)}</div>
                          </td>
                          <td style={{ ...tdSt, textAlign: "right", color: "#16a34a", fontWeight: 700 }}>{fmtBaht(net)}</td>
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
                                        <tr key={`sh${j}`} style={{ background: "#f5f3ff" }}>
                                          <td style={{ padding: "9px 12px", color: "#7c3aed", fontWeight: 600 }}>
                                            <Icon icon="mdi:truck-outline" style={{ verticalAlign: "middle", marginRight: 6 }} />
                                            ค่าจัดส่ง {sh.provider_name ? `(${sh.provider_name})` : ""}
                                          </td>
                                          <td colSpan={3} />
                                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#7c3aed" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7c3aed", marginBottom: 6 }}>
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
  const [summaryStats, setSummaryStats] = useState({ pending_total: 0, pending_count: 0, paid_total: 0, paid_count: 0, fee_total: 0 });
  const [pendingRows, setPendingRows]   = useState([]);
  const [historyRows, setHistoryRows]   = useState([]);
  const [payoutCycle, setPayoutCycle]   = useState(null);
  const [period, setPeriod]             = useState("week");
  const [selectedItem, setSelectedItem] = useState(null);   // confirm modal
  const [orderDetail, setOrderDetail]   = useState(null);   // pending detail
  const [paidDetail, setPaidDetail]     = useState(null);   // history detail
  const [payAllModal, setPayAllModal]   = useState(false);  // pay-all confirm
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [loading, setLoading]           = useState(true);
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
      const params = new URLSearchParams({ period, page, limit: 10 });
      const data   = await request(`/admin/payouts?${params}`, { method: "GET", auth: true });
      setSummaryStats(data.stats        || {});
      setPendingRows(data.pending       || []);
      setHistoryRows(data.history       || []);
      setTotalPages(data.total_pages    || 1);
      if (data.payout_cycle) setPayoutCycle(data.payout_cycle);
    } catch (e) {
      setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [period, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePayAll = async () => {
    try {
      const data = await request("/admin/payouts/pay-all", { method: "POST", auth: true });
      showToast(`โอนเงินสำเร็จ ${data.count || ""} รายการ`);
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
        {/* date + period */}
        <div className="admPayoutDateRow">
          <div className="admPayoutPeriodTabs">
            {[["week","วันนี้"],["month","สัปดาห์"],["year","เดือนนี้"]].map(([k,label]) => (
              <button key={k} onClick={() => setPeriod(k)} className={`boPeriodTab${period===k?" active":""}`}>{label}</button>
            ))}
          </div>
          <div className="boDateLabel">{dateStr} · {timeStr}</div>
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
              { icon: "mdi:percent-circle-outline", label: "ค่าธรรมเนียม", value: "15% ขั้นต่ำ ฿20/ออเดอร์ (คิดจากยอดสินค้า)" },
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
            { label: "รอดำเนินการ",    value: summaryStats.pending_total, sub: `${summaryStats.pending_count||0} รายการรอโอน`, cls: "red",   icon: "mdi:clock-outline",           iconBg: "#fee2e2", iconColor: "#e03131" },
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
            <div className="admCard" style={{ width: "100%", marginBottom: 24 }}>
              <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <span className="admCardTitle">รายการรอโอนทั้งหมด</span>
                  {pendingRows.length > 0 && (
                    <span style={{ marginLeft: 10, background: "#fee2e2", color: "#e03131", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                      {pendingRows.length} รายการ
                    </span>
                  )}
                </div>
                {pendingRows.length > 0 && (
                  <button onClick={() => setPayAllModal(true)} className="admPayAllBtn">
                    <Icon icon="mdi:bank-transfer-out" style={{ width: 18, height: 18 }} />
                    โอนเงินทั้งหมด ({fmtBaht(pendingRows.reduce((s, r) => s + (r.net_amount || 0), 0))})
                  </button>
                )}
              </div>
              <div className="admTableWrap" style={{ marginTop: 0 }}>
                <table className="admTable" style={{ tableLayout: "auto" }}>
                  <thead>
                    <tr>
                      <th style={{ verticalAlign: "top" }}><div>ผู้ขาย</div></th>
                      <th style={{ verticalAlign: "top" }}><div>ออเดอร์</div></th>
                      <th style={{ verticalAlign: "top" }}>
                        <div>ยอดขายรวม</div>
                        <div style={{ fontWeight: 400, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "none", marginTop: 2 }}>สินค้า + ค่าส่ง</div>
                      </th>
                      <th style={{ verticalAlign: "top" }}>
                        <div>ค่าธรรมเนียม</div>
                        <div style={{ fontWeight: 400, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "none", marginTop: 2 }}>15% ขั้นต่ำ ฿20/ออเดอร์</div>
                      </th>
                      <th style={{ verticalAlign: "top" }}><div>ยอดโอนสุทธิ</div></th>
                      <th style={{ verticalAlign: "top" }}><div>สถานะ</div></th>
                      <th style={{ textAlign: "center", verticalAlign: "top", whiteSpace: "nowrap" }}><div>จัดการ</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                          <Icon icon="mdi:inbox-outline" style={{ fontSize: 32, display: "block", margin: "0 auto 8px" }} />
                          ไม่มีรายการรอโอน
                        </td>
                      </tr>
                    ) : pendingRows.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#5285e8,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                              {(row.seller_name || "ก").charAt(0)}
                            </div>
                            <div>
                              <span className="admTdStrong">{row.seller_name}</span>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                                <span style={{ background: "#f0f4ff", color: "#3b5bdb", borderRadius: 4, padding: "1px 5px", fontWeight: 700, fontSize: 10 }}>
                                  {bankLabelShort(row.bank_code)}
                                </span>
                                <span style={{ color: "#94a3b8" }}>{maskAccNo(row.bank_account_number)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "#475569" }}>{row.order_count} ออเดอร์</td>
                        <td style={{ fontWeight: 700 }}>{fmtBaht(row.total_sales)}</td>
                        <td style={{ fontWeight: 700, color: "#d97706" }}>{fmtBaht(row.fee_amount)}</td>
                        <td style={{ fontWeight: 800, color: "#22b14c", fontSize: 15 }}>{fmtBaht(row.net_amount)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, background: "#fff8e1", color: "#92400e", fontSize: 12, fontWeight: 700, border: "1px solid #fde68a", whiteSpace: "nowrap" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, display: "inline-block" }} />
                            รอโอน
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="admPayoutActionRow">
                            <button className="admPayoutBtn admPayoutBtn--transfer" onClick={() => setSelectedItem({ ...row })}>
                              <Icon icon="mdi:bank-transfer-out" style={{ fontSize: 15 }} />
                              โอนเงิน
                            </button>
                            <button className="admPayoutBtn admPayoutBtn--detail" onClick={() => setOrderDetail({ ...row })}>
                              <Icon icon="mdi:file-document-outline" style={{ fontSize: 15 }} />
                              รายละเอียด
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── ตารางประวัติการโอน ── */}
            <div className="admCard" style={{ width: "100%" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                <span className="admCardTitle">ประวัติการโอนทั้งหมด</span>
                {historyRows.length > 0 && (
                  <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                    {historyRows.length} รายการ
                  </span>
                )}
              </div>
              <div className="admTableWrap" style={{ marginTop: 0 }}>
                <table className="admTable" style={{ tableLayout: "auto" }}>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: "nowrap", verticalAlign: "top" }}><div>วันที่โอน</div></th>
                      <th style={{ verticalAlign: "top" }}><div>ผู้ขาย</div></th>
                      <th style={{ verticalAlign: "top" }}><div>บัญชีปลายทาง</div></th>
                      <th style={{ verticalAlign: "top" }}>
                        <div>ยอดโอนสุทธิ</div>
                        <div style={{ fontWeight: 400, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "none", marginTop: 2 }}>ที่ผู้ขายได้รับจริง</div>
                      </th>
                      <th style={{ verticalAlign: "top" }}>
                        <div>ค่าธรรมเนียม</div>
                        <div style={{ fontWeight: 400, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "none", marginTop: 2 }}>รายได้แพลตฟอร์ม</div>
                      </th>
                      <th style={{ verticalAlign: "top" }}><div>สถานะ</div></th>
                      <th style={{ textAlign: "center", verticalAlign: "top" }}><div>รายละเอียด</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                          <Icon icon="mdi:history" style={{ fontSize: 32, display: "block", margin: "0 auto 8px" }} />
                          ไม่มีประวัติการโอน
                        </td>
                      </tr>
                    ) : historyRows.map((row, i) => {
                      const transferDate = row.paid_at || row.completed_at;
                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ whiteSpace: "nowrap" }}>
                              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>
                                {transferDate
                                  ? new Date(transferDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
                                  : "—"}
                              </div>
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                {transferDate
                                  ? new Date(transferDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
                                  : ""}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                                {(row.seller_name || "ก").charAt(0)}
                              </div>
                              <span className="admTdStrong">{row.seller_name}</span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 13, letterSpacing: "0.02em" }}>
                              {maskAccNo(row.bank_account_number)}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {bankLabelShort(row.bank_code)}
                            </div>
                          </td>
                          <td style={{ fontWeight: 800, color: "#16a34a", fontSize: 15 }}>
                            {fmtBaht(row.net_amount)}
                          </td>
                          <td style={{ fontWeight: 700, color: "#d97706" }}>
                            {fmtBaht(row.fee_amount)}
                          </td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "#f0fdf4", color: "#15803d", fontSize: 12, fontWeight: 700, border: "1px solid #bbf7d0" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22b14c", display: "inline-block" }} />
                              โอนสำเร็จ
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
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
