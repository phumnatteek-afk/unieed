import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { request } from "../../../api/http.js";
import { formatOrderNo } from "../../../utils/orderNo.js";
import { NotSellerView } from "../layouts/SellerLayout.jsx";

const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString();
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

const TABS = [
  { key: "to_ship",   label: "รอจัดส่ง"   },
  { key: "shipped",   label: "จัดส่งแล้ว" },
  { key: "delivered", label: "สำเร็จ"     },
  { key: "cancelled", label: "ยกเลิก"     },
];

// แปลง datetime จาก MySQL ให้เป็น JS Date ที่ถูกต้อง
// รองรับทุกรูปแบบ: Date object, ISO string, MySQL string "2024-01-15 14:30:00"
const parseThaiDate = (val) => {
  if (!val) return null;
  // เป็น Date object อยู่แล้ว
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  // ISO format ที่มี timezone แล้ว (มี Z หรือ +/-)
  if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // MySQL format "2024-01-15 14:30:00" หรือ "2024-01-15T14:30:00" — บอกว่าเป็น +07:00
  const normalized = s.replace(" ", "T") + "+07:00";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

// คำนวณวันที่ deadline การจัดส่ง
const getDeadlineDate = (createdAt, days) => {
  const d = parseThaiDate(createdAt);
  if (!d) return null;
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
};

// format วันที่ด้วย timezone ไทยเสมอ
const fmtThaiDate = (date, opts = {}) =>
  date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", ...opts });

const OVERDUE_DAYS = 3;

export default function SellerOrdersPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "to_ship";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("latest");
  const [edits, setEdits] = useState({}); // { [order_id]: { tracking_number } }
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const search = q ? `&q=${encodeURIComponent(q)}` : "";
      const d = await request(`/seller/orders?tab=${tab}${search}&sort=${sort}`);
      setData(d);
    } catch (e) { setErr(e?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [tab, q, sort]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirmShip = async (orderId) => {
    const tracking = edits[orderId]?.tracking_number?.trim();
    if (!tracking) { window.alert("กรุณากรอก tracking number"); return; }
    const row = (data?.rows || []).find(r => Number(r.order_id) === Number(orderId));
    try {
      await request(`/seller/orders/${orderId}/ship`, {
        method: "PATCH",
        body: { tracking_number: tracking, provider_id: row?.shipping_provider_id || null },
      });
      fetchData();
    } catch (e) { window.alert(e?.data?.message || e.message); }
  };

  return (
    <>
      <div className="slBreadcrumb">จัดการร้านค้า</div>
      <h1 className="slPageTitle">คำสั่งซื้อและการจัดส่ง</h1>

      {!data?.is_seller && !loading
        ? <NotSellerView message={data?.message} />
        : (
          <div className="slCard">
            {/* Tabs */}
            <div className="slTabs">
              {TABS.map(t => {
                const cnt = data?.counts?.[t.key] || 0;
                return (
                  <div key={t.key}
                       className={`slTab ${tab === t.key ? "active" : ""}`}
                       onClick={() => setParams({ tab: t.key })}>
                    {t.label}
                    {cnt > 0 && <span className="slTabBadge">{cnt}</span>}
                  </div>
                );
              })}
            </div>

            {/* Toolbar */}
            <div className="slToolbar">
              <div className="slSearch">
                <Icon icon="mdi:magnify" className="slSearch__icon" />
                <input placeholder="ค้นหาออเดอร์ทั้งหมด"
                       value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <select className="slSelect" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="latest">ล่าสุด</option>
                <option value="oldest">เก่าสุด</option>
              </select>
            </div>

            {loading && <div style={{ padding:30 }}>กำลังโหลด...</div>}
            {err && <div style={{ color:"#b91c1c" }}>{err}</div>}
            {!loading && data?.rows?.length === 0 && (
              <div style={{ padding:40, textAlign:"center", color:"#94a3b8" }}>ไม่มีรายการในแถบนี้</div>
            )}

            {!loading && data?.rows?.map(row => (
              <OrderCard
                key={row.order_id}
                row={row}
                tab={tab}
                overdueDays={OVERDUE_DAYS}
                trackInput={edits[row.order_id]?.tracking_number || row.tracking_number || ""}
                onChangeTracking={(v) => setEdits(s => ({ ...s, [row.order_id]: { tracking_number: v } }))}
                onConfirmShip={() => handleConfirmShip(row.order_id)}
                onOpenDetail={() => setSelectedOrder(row)}
              />
            ))}
          </div>
        )
      }
      {selectedOrder && <SellerOrderDetailModal row={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </>
  );
}

function OrderCard({ row, tab, overdueDays, trackInput, onChangeTracking, onConfirmShip, onOpenDetail }) {
  const items = Array.isArray(row.items) ? row.items : (row.items ? JSON.parse(row.items) : []);
  const ship  = Number(row.shipping_price || 0);
  const fee   = Number(row.platform_fee   || 0);
  const net   = Number(row.seller_payout_amount || 0);

  const STATUS_BADGE = {
    to_ship:   { label: "รอการจัดส่ง", color: "#fef3c7", text: "#92400e" },
    shipped:   { label: "จัดส่งแล้ว",  color: "#dbeafe", text: "#1e40af" },
    delivered: { label: "สำเร็จ",       color: "#dcfce7", text: "#166534" },
    cancelled: { label: "ยกเลิก",       color: "#fee2e2", text: "#b91c1c" },
  }[tab] || {};

  // แสดงวันที่สั่งซื้อด้วย timezone ไทยเสมอ
  const createdDate = parseThaiDate(row.created_at);
  const dateStr = createdDate
    ? fmtThaiDate(createdDate, { day:"2-digit", month:"short", year:"2-digit", hour:"2-digit", minute:"2-digit" })
    : "-";

  // คำนวณ deadline และสถานะของ order นี้
  const deadline = tab === "to_ship" ? getDeadlineDate(row.created_at, overdueDays) : null;
  const now = Date.now();
  const msLeft = deadline ? deadline.getTime() - now : null;
  const hoursLeft = msLeft !== null ? msLeft / (1000 * 60 * 60) : null;
  const isExpired  = hoursLeft !== null && hoursLeft <= 0;
  const isUrgent   = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 24;

  const deadlineDateStr = deadline
    ? fmtThaiDate(deadline, { day:"numeric", month:"short", year:"numeric" })
    : null;

  // สีและข้อความแจ้งเตือน deadline
  const deadlineAlert = deadline ? (() => {
    if (isExpired) return {
      bg: "#fee2e2", border: "#fca5a5", text: "#991b1b",
      icon: "mdi:alert-circle-outline",
      msg: `เลยกำหนดส่งวันที่ ${deadlineDateStr} แล้ว — ออเดอร์จะถูกยกเลิกอัตโนมัติเร็วๆ นี้`,
    };
    if (isUrgent) return {
      bg: "#fff7ed", border: "#fdba74", text: "#9a3412",
      icon: "mdi:clock-fast",
      msg: `กรุณาจัดส่งภายในวันที่ ${deadlineDateStr} มิฉะนั้นออเดอร์จะถูกยกเลิกอัตโนมัติ`,
    };
    return {
      bg: "#fefce8", border: "#fde047", text: "#854d0e",
      icon: "mdi:truck-delivery-outline",
      msg: `กรุณาจัดส่งภายใน ${overdueDays} วัน ภายในวันที่ ${deadlineDateStr} มิฉะนั้นออเดอร์จะถูกยกเลิกอัตโนมัติ`,
    };
  })() : null;

  return (
    <div className="slOrderCard slCard">
      <div className="slOrderHead">
        <div>
          <span className="slOrderId">{formatOrderNo(row.order_id)}</span>
          <span className="slOrderDate">สั่งซื้อเมื่อ: {dateStr}</span>
        </div>
        <span className="slOrderBadge" style={{ background: STATUS_BADGE.color, color: STATUS_BADGE.text }}>
          {STATUS_BADGE.label}
        </span>
      </div>

      {/* แจ้งเตือนกำหนดจัดส่ง (แสดงเฉพาะแถบ to_ship) */}
      {deadlineAlert && (
        <div style={{
          margin: "8px 0 4px",
          padding: "8px 14px",
          background: deadlineAlert.bg,
          border: `1px solid ${deadlineAlert.border}`,
          borderRadius: 8,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          fontSize: 12.5,
          color: deadlineAlert.text,
          lineHeight: 1.5,
        }}>
          <Icon icon={deadlineAlert.icon} style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }} />
          <span>{deadlineAlert.msg}</span>
        </div>
      )}

      <div className="slOrderBody">
        <div>
          <div className="slOrderColLabel">รายการสินค้า</div>
          <div className="slOrderItemList">
            {items.map((it, i) => (
              <div key={i} className="slOrderItem">
                {it.cover_image ? (
                  <img
                    src={it.cover_image}
                    alt={it.title}
                    className="slOrderItem__thumb"
                    style={{ objectFit: "cover", borderRadius: 6 }}
                    onError={e => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className="slOrderItem__thumb"
                    style={{ background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon icon="mdi:hanger" style={{ color: "#cbd5e1", fontSize: 18 }} />
                  </div>
                )}
                <span style={{ fontSize:13 }}>
                  {it.title || `สินค้า #${it.product_id}`} x{it.qty}
                  <span style={{ color:"#64748b", marginLeft:6 }}>({getSizeText(it.size, it.category_id)})</span>
                </span>
                <span className="slOrderItem__price">{fmtBaht(Number(it.price) * Number(it.qty))}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="slOrderColLabel">ที่อยู่จัดส่ง</div>
          <div style={{ fontSize:13, lineHeight:1.6 }}>
            <strong>{row.recipient_name || "-"}</strong><br />
            {row.shipping_address} {row.shipping_province} {row.shipping_postcode}
          </div>
        </div>

        <div>
          <div className="slOrderColLabel">หมายเลข Tracking</div>
          {tab === "to_ship" ? (
            <input
              className="slOrderTrackInput"
              placeholder="กรอกเลข Tracking"
              value={trackInput}
              onChange={e => onChangeTracking(e.target.value)}
            />
          ) : (
            <div style={{ fontSize:13, color:"#0f172a", padding:"6px 0" }}>
              {row.tracking_number || "-"}
              {row.tracking_number && (
                <div style={{ marginTop:6, fontSize:11, color:"#22c55e" }}>
                  <Icon icon="mdi:check-circle-outline" /> บันทึกข้อมูลเรียบร้อยแล้ว
                </div>
              )}
            </div>
          )}
          <div className="slOrderProvider">
            <span>ผู้ให้บริการขนส่ง</span>
            <span className="slOrderProviderTag">{row.shipping_provider_name || "ยังไม่กำหนด"}</span>
          </div>
        </div>
      </div>

      <div className="slOrderFoot">
        <div className="slOrderFootBreakdown">
          <div>รับสุทธิ <b>{fmtBaht(net)}</b></div>
          <div>หัก ค่าธรรมเนียม 15% <span style={{ color:"#94a3b8" }}>{fmtBaht(fee)}</span></div>
          <div>ค่าจัดส่ง (ได้รับเต็ม) <span style={{ color:"#94a3b8" }}>{fmtBaht(ship)}</span></div>
        </div>
        <div className="slOrderActions">
          <button className="slBtn" onClick={onOpenDetail}>ดูรายละเอียด</button>
          {tab === "to_ship" && (
            <button className="slBtnPrimary slBtn" onClick={onConfirmShip}>ยืนยันการส่งสินค้า</button>
          )}
        </div>
      </div>
    </div>
  );
}

function SellerOrderDetailModal({ row, onClose }) {
  const items = Array.isArray(row.items) ? row.items : [];
  const itemsSubtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
  const shippingCost  = Number(row.shipping_price || 0);
  const fee           = Number(row.platform_fee || 0);
  const net           = Number(row.seller_payout_amount || 0);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }} onClick={onClose}>
      <div className="slCard" style={{ width:"100%", maxWidth:700, maxHeight:"90vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <h3 style={{ margin:0, fontSize:17 }}>รายละเอียดคำสั่งซื้อ</h3>
            <div style={{ fontSize:13, color:"#64748b", marginTop:3 }}>{formatOrderNo(row.order_id)}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:20, lineHeight:1 }}
          >✕</button>
        </div>

        {/* Shipping info */}
        <div style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", marginBottom:14, fontSize:13 }}>
          <div style={{ fontWeight:700, color:"#334155", marginBottom:8 }}>ข้อมูลการจัดส่ง</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 16px" }}>
            <div><span style={{ color:"#94a3b8" }}>ผู้รับ: </span><b>{row.recipient_name || "-"}</b></div>
            <div><span style={{ color:"#94a3b8" }}>ขนส่ง: </span><b>{row.shipping_provider_name || "-"}</b></div>
            <div style={{ gridColumn:"1/-1" }}>
              <span style={{ color:"#94a3b8" }}>ที่อยู่: </span>
              {row.shipping_address || "-"} {row.shipping_province || ""} {row.shipping_postcode || ""}
            </div>
            {row.tracking_number && (
              <div style={{ gridColumn:"1/-1" }}>
                <span style={{ color:"#94a3b8" }}>Tracking: </span>
                <b style={{ color:"#1d4ed8" }}>{row.tracking_number}</b>
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", marginBottom:14 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f1f5f9" }}>
                <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, color:"#64748b" }}>สินค้า</th>
                <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:600, color:"#64748b" }}>ไซส์</th>
                <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:600, color:"#64748b" }}>จำนวน</th>
                <th style={{ padding:"8px 12px", textAlign:"right", fontWeight:600, color:"#64748b" }}>ราคา/ชิ้น</th>
                <th style={{ padding:"8px 12px", textAlign:"right", fontWeight:600, color:"#64748b" }}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} style={{ borderTop:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"10px 12px" }}>{it.title || `สินค้า #${it.product_id}`}</td>
                  <td style={{ padding:"10px 12px", textAlign:"center", color:"#64748b" }}>{getSizeText(it.size, it.category_id)}</td>
                  <td style={{ padding:"10px 12px", textAlign:"center", color:"#64748b" }}>{it.qty}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", color:"#64748b" }}>{fmtBaht(it.price)}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:700 }}>{fmtBaht(Number(it.price) * Number(it.qty))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ fontWeight:700, color:"#334155", marginBottom:10, fontSize:13 }}>สรุปการเงิน</div>
          {[
            { label:"ยอดราคาสินค้า", val: fmtBaht(itemsSubtotal), color:"#0f172a" },
            { label:"ค่าจัดส่ง",     val: `+${fmtBaht(shippingCost)}`, color:"#3b82f6" },
            { label:"ค่าธรรมเนียมแพลตฟอร์ม (15%, ขั้นต่ำ ฿20)", val: `−${fmtBaht(fee)}`, color:"#f59e0b" },
          ].map(r => (
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", marginBottom:7, fontSize:13 }}>
              <span style={{ color:"#64748b" }}>{r.label}</span>
              <span style={{ fontWeight:600, color:r.color }}>{r.val}</span>
            </div>
          ))}
          <div style={{ borderTop:"2px solid #e2e8f0", marginTop:10, paddingTop:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <span style={{ fontWeight:700, color:"#0f172a" }}>รับสุทธิ</span>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>ยอดสินค้า + ค่าส่ง − ค่าธรรมเนียม</div>
            </div>
            <span style={{ fontWeight:800, fontSize:18, color:"#22c55e" }}>{fmtBaht(net)}</span>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button className="slBtnPrimary slBtn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
