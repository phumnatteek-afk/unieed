// AdminDonationManagement.jsx
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TRACKING_URLS = {
  "ไปรษณีย์ไทย":    (no) => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  "Flash Express":   (no) => `https://www.flashexpress.co.th/tracking/?se=${no}`,
  "J&T Express":     (no) => `https://www.jtexpress.co.th/service/track?waybillNo=${no}`,
  "Kerry Express":   (no) => `https://th.kex-express.com/th/track/?track=${no}`,
  "Lazada Logistics":()   => `https://www.lazada.co.th/helpcenter/`,
  "SCG Express":     (no) => `https://www.scgexpress.co.th/tracking/?barcode=${no}`,
  "Best Express":    (no) => `https://www.best-inc.co.th/track?numbers=${no}`,
  "Ninja Van":       (no) => `https://www.ninjavan.co/th-th/tracking?id=${no}`,
};

const getTrackingUrl = (carrier, trackingNo) => {
  const fn = TRACKING_URLS[carrier];
  return fn ? fn(trackingNo) : `https://www.google.com/search?q=${encodeURIComponent((carrier||"")+" tracking "+trackingNo)}`;
};

const STATUS_META = {
  pending:  { label:"รอตรวจสอบ", color:"#d97706", bg:"#fef3c7" },
  approved: { label:"ได้รับแล้ว", color:"#16a34a", bg:"#dcfce7" },
  rejected: { label:"ปฏิเสธ",    color:"#dc2626", bg:"#fee2e2" },
};

const CONDITION_META = {
  usable:     { label:"ใช้งานได้",    color:"#16a34a", bg:"#dcfce7" },
  wrong_item: { label:"รายการไม่ตรง", color:"#d97706", bg:"#fef3c7" },
  damaged:    { label:"เสียหาย",      color:"#dc2626", bg:"#fee2e2" },
};

const formatDate = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { day:"2-digit", month:"2-digit", year:"numeric" });
};

const parseItems = (snapshot) => {
  if (!snapshot) return [];
  try { return typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot; }
  catch { return []; }
};

function DaysBadge({ days }) {
  const color = days >= 14 ? "#dc2626" : days >= 10 ? "#d97706" : "#2563eb";
  const bg    = days >= 14 ? "#fee2e2" : days >= 10 ? "#fef3c7" : "#eff6ff";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:600, color, background:bg, whiteSpace:"nowrap" }}>
      <Icon icon="mdi:clock-alert-outline" width={13} />{days} วัน
    </span>
  );
}

function DeliveryCell({ d, onOpenTracking }) {
  if (d.delivery_method === "dropoff") {
    return (
      <div>
        <div style={{ fontSize:12, color:"#7c3aed", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
          <Icon icon="mdi:calendar-clock" width={13} />Drop-Off
        </div>
        <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
          {formatDate(d.donation_date)}
          {d.donation_time ? ` ${String(d.donation_time).slice(0,5)} น.` : ""}
        </div>
      </div>
    );
  }
  if (d.delivery_method === "market_purchase") {
    return (
      <div>
        <div style={{ fontSize:12, color:"#5285E8", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
          <Icon icon="mdi:shopping-outline" width={13} />ซื้อเพื่อบริจาค
        </div>
        {d.tracking_number && (
          <button onClick={() => onOpenTracking(d.shipping_carrier, d.tracking_number)}
            style={{ fontSize:11, color:"#2563eb", background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:"monospace", marginTop:2 }}>
            #{d.tracking_number}
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize:12, color:"#475569", display:"flex", alignItems:"center", gap:4 }}>
        <Icon icon="mdi:package-variant-closed" width={13} />{d.shipping_carrier}
      </div>
      {d.tracking_number ? (
        <button onClick={() => onOpenTracking(d.shipping_carrier, d.tracking_number)}
          style={{ fontSize:11, color:"#2563eb", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:6, padding:"2px 8px", cursor:"pointer", fontFamily:"monospace", marginTop:3 }}>
          #{d.tracking_number}
        </button>
      ) : (
        <span style={{ fontSize:11, color:"#94a3b8" }}>ไม่มีเลขพัสดุ</span>
      )}
    </div>
  );
}

function ImagePopup({ url, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ position:"relative", maxWidth:"90vw", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
        <img src={url} alt="หลักฐาน" style={{ maxWidth:"90vw", maxHeight:"85vh", borderRadius:12, objectFit:"contain" }} />
        <button onClick={onClose} style={{ position:"absolute", top:-12, right:-12, width:32, height:32, borderRadius:"50%", background:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)" }}>
          <Icon icon="mdi:close" width={18} />
        </button>
      </div>
    </div>
  );
}

function ConfirmPopup({ donation, onConfirm, onCancel, loading }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onCancel}>
      <div style={{ background:"#fff", borderRadius:16, padding:"28px 32px", maxWidth:420, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:32, textAlign:"center", marginBottom:12 }}>✅</div>
        <div style={{ fontWeight:700, fontSize:16, color:"#0f172a", textAlign:"center", marginBottom:8 }}>อนุมัติรายการบริจาค</div>
        <div style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:20 }}>
          อนุมัติการบริจาคจาก <strong>{donation.donor_name}</strong> และออกใบ Certificate ให้ผู้บริจาคทันที
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} disabled={loading} style={{ padding:"9px 20px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer" }}>ยกเลิก</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding:"9px 20px", borderRadius:8, border:"none", background:loading?"#94a3b8":"#2563eb", color:"#fff", fontSize:13, fontWeight:600, cursor:loading?"not-allowed":"pointer" }}>
            {loading ? "กำลังอนุมัติ..." : "ยืนยันอนุมัติ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectPopup({ donation, onReject, onCancel, loading }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onCancel}>
      <div style={{ background:"#fff", borderRadius:16, padding:"28px 32px", maxWidth:460, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:32, textAlign:"center", marginBottom:12 }}>❌</div>
        <div style={{ fontWeight:700, fontSize:16, color:"#0f172a", textAlign:"center", marginBottom:8 }}>ไม่อนุมัติรายการบริจาค</div>
        <div style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:20 }}>จาก <strong>{donation.donor_name}</strong></div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:6 }}>
            เหตุผลที่ไม่อนุมัติ <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <textarea rows={4}
            placeholder="เช่น พัสดุถูกตีกลับ, ของที่บริจาคไม่ตรงความต้องการ, ไม่มีหลักฐานการส่ง..."
            value={reason} onChange={e => setReason(e.target.value)}
            style={{ width:"100%", boxSizing:"border-box", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#1e293b", resize:"vertical", outline:"none", fontFamily:"inherit", lineHeight:1.6 }}
            onFocus={e => e.target.style.borderColor="#dc2626"}
            onBlur={e => e.target.style.borderColor="#e2e8f0"}
          />
          {reason.trim()==="" && <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>กรุณากรอกเหตุผล</div>}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} disabled={loading} style={{ padding:"9px 20px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer" }}>ยกเลิก</button>
          <button onClick={() => onReject(reason)} disabled={loading||!reason.trim()}
            style={{ padding:"9px 20px", borderRadius:8, border:"none", background:(loading||!reason.trim())?"#94a3b8":"#dc2626", color:"#fff", fontSize:13, fontWeight:600, cursor:(loading||!reason.trim())?"not-allowed":"pointer" }}>
            {loading ? "กำลังบันทึก..." : "ยืนยันไม่อนุมัติ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DonationRow({ donation, token, doneStatus, onDone }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReject,  setShowReject]  = useState(false);
  const [showImage,   setShowImage]   = useState(false);
  const [expanded,    setExpanded]    = useState(false);
  const [approving,   setApproving]   = useState(false);
  const [rejecting,   setRejecting]   = useState(false);
  const done     = !!doneStatus;
  const doneType = doneStatus?.type ?? doneStatus;
  const doneReason = doneStatus?.reason ?? null;

  const authHeaders = { "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) };
  const items = parseItems(donation.items_snapshot);
  const statusMeta    = STATUS_META[donation.status] || STATUS_META.pending;
  const conditionMeta = donation.condition_status ? CONDITION_META[donation.condition_status] : null;

  const handleApprove = async () => {
    try {
      setApproving(true);
      await fetch(`${BASE}/donations/${donation.donation_id}/verify`, {
        method:"PATCH", headers:authHeaders,
        body: JSON.stringify({thank_message:"แอดมินได้ตรวจสอบและอนุมัติการบริจาคของท่านเรียบร้อยแล้ว ขอขอบคุณสำหรับน้ำใจของท่าน" }),
      });
      onDone(donation.donation_id, "approved");
      setShowConfirm(false);
    } catch(e) { console.error(e); }
    finally { setApproving(false); }
  };

  const handleReject = async (reason) => {
    try {
      setRejecting(true);
      await fetch(`${BASE}/donations/${donation.donation_id}/status`, {
        method:"PATCH", headers:authHeaders,
        body: JSON.stringify({ status:"rejected", reject_reason:reason }),
      });
      onDone(donation.donation_id, { type:"rejected", reason });
      setShowReject(false);
    } catch(e) { console.error(e); }
    finally { setRejecting(false); }
  };

  const rowBg = done && doneType==="approved" ? "#f0fdf4" : done && doneType==="rejected" ? "#fff5f5" : "transparent";

  return (
    <>
      <tr style={{ background:rowBg, transition:"background 0.3s", cursor:"pointer" }} onClick={() => setExpanded(v => !v)}>
        <td style={{ padding:"12px 16px", fontSize:13, color:"#475569", whiteSpace:"nowrap" }}>
          {formatDate(donation.created_at)}
          <div style={{ marginTop:2 }}><DaysBadge days={donation.days_elapsed} /></div>
        </td>
        <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#1e293b" }}>
          {donation.donor_name}
        </td>
        <td style={{ padding:"12px 16px" }} onClick={e => e.stopPropagation()}>
          <DeliveryCell d={donation} onOpenTracking={(c,n) => window.open(getTrackingUrl(c,n),"_blank")} />
        </td>
        <td style={{ padding:"12px 16px" }} onClick={e => e.stopPropagation()}>
          {donation.donation_pic ? (
            <button onClick={() => setShowImage(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:8, border:"1.5px solid #bfdbfe", background:"#eff6ff", color:"#2563eb", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <Icon icon="mdi:image-outline" width={13} />ดูรูปภาพ
            </button>
          ) : (
            <span style={{ fontSize:12, color:"#cbd5e1" }}>ไม่มี</span>
          )}
        </td>
        <td style={{ padding:"12px 16px" }}>
          <span style={{ fontSize:12, color:"#475569" }}>
            {items.length > 0
              ? `${items.length} รายการ · ${items.reduce((s,i) => s+(Number(i.quantity)||0), 0)} ชิ้น`
              : donation.quantity ? `${donation.quantity} ชิ้น` : "—"}
          </span>
        </td>
        {/* สถานะ */}
{/* สถานะ */}
<td style={{ padding:"12px 16px" }}>
  {done ? (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600,
        color:doneType==="approved"?"#16a34a":"#dc2626",
        background:doneType==="approved"?"#dcfce7":"#fee2e2",
        padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
        <Icon icon={doneType==="approved"?"mdi:check":"mdi:close"} width={13} />
        {doneType==="approved" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}
      </span>
      {/* ✅ เพิ่มตรงนี้ — แสดงเหตุผลเมื่อ reject */}
      {doneType==="rejected" && donation.reject_reason && (
        <span style={{ fontSize:11, color:"#64748b", background:"#f8fafc", border:"1px solid #e2e8f0", padding:"3px 8px", borderRadius:8 }}>
          {donation.reject_reason}
        </span>
      )}
    </div>
  ) : (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:statusMeta.color, background:statusMeta.bg, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
        {donation.status==="approved" && <Icon icon="mdi:check" width={13} />}
        {statusMeta.label}
      </span>
      {donation.status==="rejected" && donation.reject_reason && (
        <span style={{ fontSize:11, color:"#64748b", background:"#f8fafc", border:"1px solid #e2e8f0", padding:"3px 8px", borderRadius:8 }}>
          {donation.reject_reason}
        </span>
      )}
    </div>
  )}
</td>
        {/* <td style={{ padding:"12px 16px" }}>
          {conditionMeta ? (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:conditionMeta.color, background:conditionMeta.bg, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
              {conditionMeta.label}
            </span>
          ) : <span style={{ color:"#e2e8f0" }}>—</span>}
        </td> */}
        <td style={{ padding:"12px 16px" }} onClick={e => e.stopPropagation()}>
          {!done && (
            <div style={{ display:"flex", gap:8, flexWrap:"nowrap" }}>
              {/* ปุ่มอนุมัติ */}
<button onClick={() => setShowConfirm(true)}
  style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap",
    transition:"background 0.15s",  // ← เปลี่ยนจาก "all"
    transform:"none",               // ← เพิ่ม
  }}
  onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
  onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}
>
  <Icon icon="mdi:check-circle-outline" width={14} />อนุมัติ
</button>

      {/* ปุ่มไม่อนุมัติ */}
      <button onClick={() => setShowReject(true)}
        style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:8, border:"1.5px solid #fca5a5", background:"#fff5f5", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap",
          transition:"background 0.15s",  // ← เปลี่ยนจาก "all"
          transform:"none",               // ← เพิ่ม
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
        onMouseLeave={e => e.currentTarget.style.background = "#fff5f5"}
      >
        <Icon icon="mdi:close-circle-outline" width={14} />ไม่อนุมัติ
      </button>
            </div>
          )}
        </td>
      </tr>

      {expanded && items.length > 0 && (
        <tr style={{ background:"#f8fafc" }}>
          <td colSpan={7} style={{ padding:"8px 16px 12px 32px" }}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {items.map((item, i) => (
                <span key={i} style={{ fontSize:12, color:"#475569", background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"4px 10px" }}>
                  {item.name} · {item.quantity} ชิ้น
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}

      {showConfirm && <ConfirmPopup donation={donation} onConfirm={handleApprove} onCancel={() => setShowConfirm(false)} loading={approving} />}
      {showReject  && <RejectPopup  donation={donation} onReject={handleReject}   onCancel={() => setShowReject(false)}  loading={rejecting} />}
      {showImage && donation.donation_pic && <ImagePopup url={donation.donation_pic} onClose={() => setShowImage(false)} />}
    </>
  );
}

function SchoolCard({ school, onSelect }) {
  const maxDays = Math.max(...school.donations.map(d => d.days_elapsed));
  const urgent  = maxDays >= 14;
  return (
    <div onClick={() => onSelect(school)}
      style={{ background:"#fff", border:urgent?"1.5px solid #fca5a5":"1.5px solid #e2e8f0", borderRadius:14, padding:"18px 20px", cursor:"pointer", transition:"box-shadow 0.15s, transform 0.15s", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}
      onMouseEnter={e => { e.currentTarget.style.background = urgent ? "#fff0f0" : "#f8faff"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:44, height:44, borderRadius:12, background:urgent?"#fee2e2":"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Icon icon="teenyicons:school-outline" width={22} color={urgent?"#dc2626":"#2563eb"} />
        </div>
        <div>
          <div style={{ fontWeight:600, fontSize:14, color:"#1e293b" }}>{school.school_name}</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
            {school.donations.length} รายการรอดำเนินการ · รายการเก่าสุด <DaysBadge days={maxDays} />
          </div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {urgent && <span style={{ fontSize:11, fontWeight:600, color:"#dc2626", background:"#fee2e2", padding:"3px 9px", borderRadius:20, whiteSpace:"nowrap" }}>เร่งด่วน</span>}
        <Icon icon="mdi:chevron-right" width={20} color="#94a3b8" />
      </div>
    </div>
  );
}

// ── Filter Tabs ───────────────────────────────────────────────────────────────
function FilterTabs({ filterMethod, setFilterMethod, tabCounts }) {
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {[
        ["all",             "ทั้งหมด"],
        ["parcel",          "พัสดุ"],
        ["dropoff",         "Drop-Off"],
        ["market_purchase", "ซื้อเพื่อบริจาค"],
      ].map(([v, l]) => {
        const count = tabCounts[v] ?? 0;
        const active = filterMethod === v;
        return (
          // ใน FilterTabs component เพิ่ม onMouseEnter/onMouseLeave
           <button key={v} onClick={() => setFilterMethod(v)}
            style={{ 
              display:"inline-flex", alignItems:"center", gap:6, 
              padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, 
              cursor:"pointer", border:"none", 
              transition:"background 0.15s", // ← เปลี่ยนจาก "all" เป็น "background"
              transform:"none",              // ← เพิ่ม
              background: active ? "#2563eb" : "#f1f5f9",
              color:      active ? "#fff"    : "#64748b",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#e2e8f0"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#f1f5f9"; }}
          >
            {l}
            {count > 0 && (
              <span style={{ background: active ? "rgba(255,255,255,0.3)" : "#e2e8f0", color: active ? "#fff" : "#475569", borderRadius:10, padding:"1px 7px", fontSize:11, fontWeight:700 }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminDonationManagement() {
  const { token } = useAuth();
  const headers = token ? { Authorization:`Bearer ${token}` } : {};

  const [schools,        setSchools]        = useState([]);
  const [stats,          setStats]          = useState({ total:0, schools:0, urgent:0 });
  const [loading,        setLoading]        = useState(true);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [search,         setSearch]         = useState("");
  const [filterMethod,   setFilterMethod]   = useState("all");
  const [doneMap, setDoneMap] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("adminDoneMap") || "{}");
      } catch { return {}; }
    });

  const loadData = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BASE}/admin/autocheck/overdue/by-school`, { headers });
      const json = await res.json();
      const list = json.schools ?? [];
      setSchools(list);
      const totalDonations = list.reduce((s,sc) => s+sc.donations.length, 0);
      const urgentSchools  = list.filter(sc => sc.donations.some(d => d.days_elapsed >= 14)).length;
      setStats({ total:totalDonations, schools:list.length, urgent:urgentSchools });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
  localStorage.setItem("adminDoneMap", JSON.stringify(doneMap));
  }, [doneMap]);

  const filteredSchools = useMemo(() =>
    schools.filter(sc => !search || sc.school_name.toLowerCase().includes(search.toLowerCase())),
    [schools, search]
  );

  const filteredDonations = useMemo(() => {
    if (!selectedSchool) return [];
    return filterMethod === "all"
      ? selectedSchool.donations
      : selectedSchool.donations.filter(d => d.delivery_method === filterMethod);
  }, [selectedSchool, filterMethod]);

  const tabCounts = useMemo(() => {
    if (!selectedSchool) return {};
    const d = selectedSchool.donations;
    return {
      all:             d.length,
      parcel:          d.filter(x => x.delivery_method === "parcel").length,
      dropoff:         d.filter(x => x.delivery_method === "dropoff").length,
      market_purchase: d.filter(x => x.delivery_method === "market_purchase").length,
    };
  }, [selectedSchool]);

  return (
    <div style={{ padding:"28px 32px", maxWidth:1200, margin:"0 auto" }}>

      <div className="boTop" style={{ marginBottom:24 }}>
        <div>
          <div className="boTitle">จัดการการบริจาค</div>
          <p style={{ fontSize:13, color:"#64748b", margin:"4px 0 0" }}>รายการที่เกิน 7 วันและยังรอแอดมินตรวจสอบ</p>
        </div>
        <div className="boAdmin">
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
        {[
          { label:"โรงเรียนที่รอดำเนินการ",    value:stats.schools, icon:"teenyicons:school-outline",  color:"#2563eb", bg:"#eff6ff" },
          { label:"รายการทั้งหมดที่เกิน 7 วัน", value:stats.total,   icon:"mdi:package-variant-closed", color:"#d97706", bg:"#fef3c7" },
          { label:"โรงเรียนเร่งด่วน (≥14 วัน)", value:stats.urgent,  icon:"mdi:alert-circle-outline",   color:"#dc2626", bg:"#fee2e2" },
        ].map(card => (
          <div key={card.label} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:14, padding:"18px 20px", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:card.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon icon={card.icon} width={22} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize:24, fontWeight:700, color:card.color }}>{card.value}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {selectedSchool ? (
        <div>
          {/* ── แถวเดียวกัน: ปุ่มกลับ (ซ้าย) + Filter Tabs (ขวา) ── */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <button onClick={() => { setSelectedSchool(null); setFilterMethod("all"); }}
              style={{ 
                display:"flex", alignItems:"center", gap:6, 
                background:"none", border:"none", color:"#2563eb", 
                fontSize:13, fontWeight:600, cursor:"pointer", padding:0,
                transform:"none",  // ← เพิ่ม
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#1d4ed8"}
              onMouseLeave={e => e.currentTarget.style.color = "#2563eb"}
            >
              <Icon icon="mdi:arrow-left" width={16} />กลับไปหน้ารายการโรงเรียน
            </button>
            <FilterTabs filterMethod={filterMethod} setFilterMethod={setFilterMethod} tabCounts={tabCounts} />
          </div>

          <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:14, overflow:"hidden" }}>
            {/* School header */}
            <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon icon="teenyicons:school-outline" width={18} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:"#0f172a" }}>{selectedSchool.school_name}</div>
                <div style={{ fontSize:12, color:"#64748b" }}>{selectedSchool.donations.length} รายการที่เกิน 7 วันและยังไม่ได้รับการยืนยัน</div>
              </div>
            </div>

            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["วันที่บริจาค","ผู้บริจาค","ข้อมูลการจัดส่ง","หลักฐาน","รายการบริจาค","สถานะ","จัดการ"].map(h => (
                      <th key={h} style={{ padding:"10px 16px", fontSize:12, fontWeight:600, color:"#64748b", textAlign:"left", borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDonations.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign:"center", padding:32, color:"#94a3b8", fontSize:13 }}>ไม่มีรายการในหมวดนี้</td></tr>
                  ) : filteredDonations.map(d => (
                    <DonationRow 
                      key={d.donation_id} 
                      donation={d} 
                      onRefresh={loadData} 
                      token={token}
                      doneStatus={doneMap[d.donation_id] ?? null}
                      onDone={(id, data) => setDoneMap(prev => ({ ...prev, [id]: data }))}
                    />
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", 
            border:"1.5px solid #e2e8f0", borderRadius:10, padding:"9px 14px", 
            marginBottom:16, maxWidth:400 , outline:"none"}}
            // ✅ เพิ่ม 2 บรรทัดนี้
            onFocus={e => e.currentTarget.style.border = "1.5px solid #e2e8f0"}
            onBlur={e => e.currentTarget.style.border = "1.5px solid #e2e8f0"}
          >
            <Icon icon="mdi:magnify" width={18} color="#94a3b8" />
            <input
              style={{ border:"none", outline:"none", fontSize:13, flex:1, color:"#334155", background:"transparent" }}
              onFocus={e => { e.target.style.outline = "none"; e.target.style.boxShadow = "none"; }}
              placeholder="ค้นหาชื่อโรงเรียน..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <div style={{ textAlign:"center", padding:48, color:"#94a3b8", fontSize:13 }}>กำลังโหลด...</div>
          ) : filteredSchools.length === 0 ? (
            <div style={{ textAlign:"center", padding:48, color:"#94a3b8", fontSize:13, background:"#fff", borderRadius:14, border:"1.5px solid #e2e8f0" }}>
              <Icon icon="mdi:check-circle-outline" width={36} color="#86efac" />
              <div style={{ marginTop:12 }}>ไม่มีรายการที่เกิน 7 วัน 🎉</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filteredSchools.map(school => (
                <SchoolCard key={school.school_id} school={school} onSelect={setSelectedSchool} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}