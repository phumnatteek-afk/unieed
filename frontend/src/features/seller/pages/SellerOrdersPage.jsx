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

// คำนวณว่า order นี้รอจัดส่งเกิน 3 วันแล้วหรือยัง
const isOverdue3Days = (createdAt) => {
  if (!createdAt) return false;
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff > 3 * 24 * 60 * 60 * 1000;
};

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

            {/* แจ้งเตือนออเดอร์รอจัดส่งเกิน 3 วัน */}
            {tab === "to_ship" && !loading && (() => {
              const overdue = (data?.rows || []).filter(r => isOverdue3Days(r.created_at));
              if (overdue.length === 0) return null;
              return (
                <div style={{
                  margin: "12px 0 4px",
                  padding: "10px 16px",
                  background: "#fef9c3",
                  border: "1px solid #fde047",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#854d0e",
                }}>
                  <Icon icon="mdi:alert-outline" style={{ fontSize: 18, flexShrink: 0 }} />
                  <span>
                    มี <b>{overdue.length}</b> รายการที่รอจัดส่งเกิน 3 วันแล้ว กรุณาดำเนินการโดยเร็ว
                  </span>
                </div>
              );
            })()}

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

function OrderCard({ row, tab, trackInput, onChangeTracking, onConfirmShip, onOpenDetail }) {
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

  const dateStr = new Date(row.created_at).toLocaleString("th-TH", {
    day:"2-digit", month:"short", year:"2-digit", hour:"2-digit", minute:"2-digit",
  });

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

      <div className="slOrderBody">
        <div>
          <div className="slOrderColLabel">รายการสินค้า</div>
          <div className="slOrderItemList">
            {items.map((it, i) => (
              <div key={i} className="slOrderItem">
                <div className="slOrderItem__thumb" />
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
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }} onClick={onClose}>
      <div className="slCard" style={{ width:"100%", maxWidth:680 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop:0 }}>รายละเอียดคำสั่งซื้อ {formatOrderNo(row.order_id)}</h3>
        <div style={{ display:"grid", gap:8, fontSize:14, marginBottom:12 }}>
          <div>ผู้รับ: {row.recipient_name || "-"}</div>
          <div>ที่อยู่: {row.shipping_address || "-"} {row.shipping_province || ""} {row.shipping_postcode || ""}</div>
          <div>Tracking: {row.tracking_number || "-"}</div>
          <div>ขนส่ง: {row.shipping_provider_name || "-"}</div>
        </div>
        <div className="slTable" style={{ borderRadius: 10, overflow: "hidden" }}>
          <table className="slTable">
            <thead><tr><th>สินค้า</th><th>ไซส์</th><th>จำนวน</th><th>ราคา/ชิ้น</th><th>รวม</th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>{it.title || `สินค้า #${it.product_id}`}</td>
                  <td>{getSizeText(it.size, it.category_id)}</td>
                  <td>{it.qty}</td>
                  <td>{fmtBaht(it.price)}</td>
                  <td>{fmtBaht(Number(it.price) * Number(it.qty))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
          <button className="slBtnPrimary slBtn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
