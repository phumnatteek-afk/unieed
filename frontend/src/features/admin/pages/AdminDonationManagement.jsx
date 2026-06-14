// AdminDonationManagement.jsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import "../styles/adminPages.css";

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
        <div style={{ fontSize:12, color:"#0e7490", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
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
            style={{ fontSize:11, color:"#2563eb", background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:"monospace", marginTop:2, transform:"none" }}>
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
          style={{ fontSize:11, color:"#2563eb", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:6, padding:"2px 8px", cursor:"pointer", fontFamily:"monospace", marginTop:3, transform:"none" }}>
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
        <div style={{ textAlign:"center", marginBottom:12 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none" /><path fill="#16a34a" fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z" clipRule="evenodd" /></svg>
        </div>
        <div style={{ fontWeight:700, fontSize:16, color:"#0f172a", textAlign:"center", marginBottom:8 }}>อนุมัติรายการบริจาค</div>
        <div style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:20 }}>
          อนุมัติการบริจาคจาก <strong>{donation.donor_name}</strong> และออกใบ Certificate ให้ผู้บริจาคทันที
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} disabled={loading} style={{ padding:"9px 20px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", transform:"none" }}>ยกเลิก</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding:"9px 20px", borderRadius:8, border:"none", background:loading?"#94a3b8":"#2563eb", color:"#fff", fontSize:13, fontWeight:600, cursor:loading?"not-allowed":"pointer", transform:"none" }}>
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
        <div style={{ textAlign:"center", marginBottom:12 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none" /><path fill="#dc2626" d="M12 2c5.53 0 10 4.47 10 10s-4.47 10-10 10S2 17.53 2 12S6.47 2 12 2m3.59 5L12 10.59L8.41 7L7 8.41L10.59 12L7 15.59L8.41 17L12 13.41L15.59 17L17 15.59L13.41 12L17 8.41z" /></svg>
        </div>
        <div style={{ fontWeight:700, fontSize:16, color:"#0f172a", textAlign:"center", marginBottom:8 }}>ไม่อนุมัติรายการบริจาค</div>
        <div style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:20 }}>จาก <strong>{donation.donor_name}</strong></div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:6 }}>
            เหตุผลที่ไม่อนุมัติ <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <textarea rows={4} placeholder="เช่น พัสดุถูกตีกลับ, ของที่บริจาคไม่ตรงความต้องการ..."
            value={reason} onChange={e => setReason(e.target.value)}
            style={{ width:"100%", boxSizing:"border-box", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#1e293b", resize:"vertical", outline:"none", fontFamily:"inherit", lineHeight:1.6, background:"#fff" }}
          />
          {reason.trim()==="" && <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>กรุณากรอกเหตุผล</div>}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} disabled={loading} style={{ padding:"9px 20px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", transform:"none" }}>ยกเลิก</button>
          <button onClick={() => onReject(reason)} disabled={loading||!reason.trim()}
            style={{ padding:"9px 20px", borderRadius:8, border:"none", background:(loading||!reason.trim())?"#94a3b8":"#dc2626", color:"#fff", fontSize:13, fontWeight:600, cursor:(loading||!reason.trim())?"not-allowed":"pointer", transform:"none" }}>
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

  const authHeaders = { "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) };
  const items = parseItems(donation.items_snapshot);
  const statusMeta = STATUS_META[donation.status] || STATUS_META.pending;

  const handleApprove = async () => {
    try {
      setApproving(true);
      await fetch(`${BASE}/donations/${donation.donation_id}/verify`, {
        method:"PATCH", headers:authHeaders,
        body: JSON.stringify({ thank_message:"แอดมินได้ตรวจสอบและอนุมัติการบริจาคของท่านเรียบร้อยแล้ว ขอขอบคุณสำหรับน้ำใจของท่าน" }),
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
          {donation.strike_count > 0 && (
            <div style={{ marginTop:4 }}>
              <span style={{ fontSize:11, fontWeight:600, color:"#dc2626", background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:20, padding:"2px 8px" }}>
                ⚠ คำเตือน {donation.strike_count}/3
              </span>
            </div>
          )}
        </td>
        <td style={{ padding:"12px 16px" }} onClick={e => e.stopPropagation()}>
          <DeliveryCell d={donation} onOpenTracking={(c,n) => window.open(getTrackingUrl(c,n),"_blank")} />
        </td>
        <td style={{ padding:"12px 16px" }} onClick={e => e.stopPropagation()}>
          {donation.donation_pic ? (
            <button onClick={() => setShowImage(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:8, border:"1.5px solid #bfdbfe", background:"#eff6ff", color:"#2563eb", fontSize:12, fontWeight:600, cursor:"pointer", transform:"none" }}>
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
        <td style={{ padding:"12px 16px" }}>
          {done ? (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600,
              color:doneType==="approved"?"#16a34a":"#dc2626",
              background:doneType==="approved"?"#dcfce7":"#fee2e2",
              padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
              <Icon icon={doneType==="approved"?"mdi:check":"mdi:close"} width={13} />
              {doneType==="approved" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}
            </span>
          ) : (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:statusMeta.color, background:statusMeta.bg, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
              {donation.status==="approved" && <Icon icon="mdi:check" width={13} />}
              {statusMeta.label}
            </span>
          )}
        </td>
        <td style={{ padding:"12px 16px" }} onClick={e => e.stopPropagation()}>
          {!done && (
            <div style={{ display:"flex", gap:8, flexWrap:"nowrap" }}>
              <button onClick={() => setShowConfirm(true)}
                style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"background 0.15s", transform:"none" }}
                onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
                onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}>
                <Icon icon="mdi:check-circle-outline" width={14} />อนุมัติ
              </button>
              <button onClick={() => setShowReject(true)}
                style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:8, border:"1.5px solid #fca5a5", background:"#fff5f5", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"background 0.15s", transform:"none" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
                onMouseLeave={e => e.currentTarget.style.background = "#fff5f5"}>
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

const PROJECT_STATUS_META = {
  open:     { label:"เปิดอยู่",  color:"#16a34a", bg:"#dcfce7" },
  closed:   { label:"ปิดแล้ว",  color:"#dc2626", bg:"#fee2e2" },
  archived: { label:"เก็บถาวร", color:"#64748b", bg:"#f1f5f9" },
};

function ProjectStatusBadge({ status }) {
  const meta = PROJECT_STATUS_META[status] || PROJECT_STATUS_META.closed;
  return (
    <span style={{ fontSize:11, fontWeight:600, color:meta.color, background:meta.bg, padding:"2px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
      {meta.label}
    </span>
  );
}

function SchoolCard({ school, pendingCount, maxDays, onSelect }) {
  const urgent = maxDays >= 14;
  return (
    <div onClick={() => onSelect(school)}
      className={`admDonationSchoolCard${urgent ? " admDonationSchoolCard--urgent" : ""}`}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:44, height:44, borderRadius:12, background:urgent?"#fee2e2":"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Icon icon="teenyicons:school-outline" width={22} color={urgent?"#dc2626":"#2563eb"} />
        </div>
        <div>
          <div style={{ fontWeight:600, fontSize:14, color:"#1e293b" }}>{school.school_name}</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            {pendingCount > 0 ? (
              <><span>{pendingCount} รายการรอดำเนินการ</span> · รายการเก่าสุด <DaysBadge days={maxDays} /></>
            ) : (
              <span style={{ color:"#16a34a", fontWeight:600 }}>✓ ดำเนินการครบแล้ว</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {urgent && pendingCount > 0 && <span style={{ fontSize:11, fontWeight:600, color:"#dc2626", background:"#fee2e2", padding:"3px 9px", borderRadius:20, whiteSpace:"nowrap" }}>เร่งด่วน</span>}
        <Icon icon="mdi:chevron-right" width={20} color="#94a3b8" />
      </div>
    </div>
  );
}

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
          <button key={v} onClick={() => setFilterMethod(v)}
            style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:"none", transition:"background 0.15s", transform:"none", background:active?"#2563eb":"#f1f5f9", color:active?"#fff":"#64748b" }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#e2e8f0"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#f1f5f9"; }}>
            {l}
            {count > 0 && (
              <span style={{ background:active?"rgba(255,255,255,0.3)":"#e2e8f0", color:active?"#fff":"#475569", borderRadius:10, padding:"1px 7px", fontSize:11, fontWeight:700 }}>
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

  const [schools,        setSchools]        = useState([]);
  const [stats,          setStats]          = useState({ total:0, schools:0, urgent:0 });
  const [loading,        setLoading]        = useState(true);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [search,         setSearch]         = useState("");
  const [filterMethod,   setFilterMethod]   = useState("all");
  const [schoolFilter,   setSchoolFilter]   = useState("all");
  const [schoolSort,     setSchoolSort]     = useState("most_overdue");
  const [doneMap, setDoneMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem("adminDoneMap") || "{}"); }
    catch { return {}; }
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization:`Bearer ${token}` } : {};
      const res  = await fetch(`${BASE}/admin/autocheck/overdue/by-school`, { headers });
      const json = await res.json();
      const list = json.schools ?? [];
      setSchools(list);
      const totalDonations = list.reduce((s,sc) => s + sc.projects.reduce((ps,p) => ps + p.donations.length, 0), 0);
      const urgentSchools  = list.filter(sc => sc.projects.some(p => p.donations.some(d => d.days_elapsed >= 14))).length;
      setStats({ total:totalDonations, schools:list.length, urgent:urgentSchools });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { localStorage.setItem("adminDoneMap", JSON.stringify(doneMap)); }, [doneMap]);

  // donations ที่ยังรอดำเนินการ (pending) ของแต่ละ school สำหรับ stats ใน card
  const getPendingDonations = useCallback((school) =>
    school.projects.flatMap(p => p.donations.filter(d => !doneMap[d.donation_id])),
  [doneMap]);

  const getSchoolDonations = useCallback((school) =>
    school.projects.flatMap(p => p.donations),
  []);

  const getSchoolLatestTime = useCallback((school) => {
    const times = getSchoolDonations(school)
      .map(d => new Date(d.created_at || d.donation_date || 0).getTime())
      .filter(Number.isFinite);
    return times.length ? Math.max(...times) : 0;
  }, [getSchoolDonations]);

  // schools ที่แสดงในลิสต์ — ยังคง show แม้ done ครบ แต่แสดงสถานะ "ดำเนินการครบแล้ว"
  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();

    return schools
      .map(sc => {
        const pending = getPendingDonations(sc);
        const donations = getSchoolDonations(sc);
        const pendingMaxDays = pending.length
          ? Math.max(...pending.map(d => Number(d.days_elapsed) || 0))
          : 0;
        const maxDays = pending.length
          ? pendingMaxDays
          : Math.max(0, ...donations.map(d => Number(d.days_elapsed) || 0));
        const latestTime = getSchoolLatestTime(sc);

        return {
          school: sc,
          pendingCount: pending.length,
          maxDays,
          latestTime,
          urgent: pendingMaxDays >= 14,
          done: pending.length === 0,
        };
      })
      .filter(row => {
        const projectMatch = row.school.projects.some(p =>
          String(p.request_title || "").toLowerCase().includes(q)
        );
        const schoolMatch = row.school.school_name.toLowerCase().includes(q);
        const searchMatch = !q || schoolMatch || projectMatch;
        if (!searchMatch) return false;
        if (schoolFilter === "urgent") return row.urgent;
        if (schoolFilter === "pending") return row.pendingCount > 0;
        if (schoolFilter === "done") return row.done;
        return true;
      })
      .sort((a, b) => {
        if (schoolSort === "latest_overdue") return b.latestTime - a.latestTime;
        if (schoolSort === "school_name") {
          return a.school.school_name.localeCompare(b.school.school_name, "th");
        }
        return b.maxDays - a.maxDays || b.pendingCount - a.pendingCount || b.latestTime - a.latestTime;
      });
  }, [schools, search, schoolFilter, schoolSort, getPendingDonations, getSchoolDonations, getSchoolLatestTime]);

  // donations ทั้งหมด (รวม done) ของ selectedSchool สำหรับแสดงในตาราง
  const allSelectedDonations = useMemo(() =>
    selectedSchool ? selectedSchool.projects.flatMap(p => p.donations) : [],
  [selectedSchool]);

  // tab counts นับจาก donations ทั้งหมด (รวม done)
  const tabCounts = useMemo(() => {
    const d = allSelectedDonations;
    return {
      all:             d.length,
      parcel:          d.filter(x => x.delivery_method === "parcel").length,
      dropoff:         d.filter(x => x.delivery_method === "dropoff").length,
      market_purchase: d.filter(x => x.delivery_method === "market_purchase").length,
    };
  }, [allSelectedDonations]);

  // filteredProjects แสดงทุก donation (รวม done) แต่ filter ตาม method
  const filteredProjects = useMemo(() => {
    if (!selectedSchool) return [];
    return selectedSchool.projects.map(proj => ({
      ...proj,
      donations: proj.donations.filter(d =>
        filterMethod === "all" || d.delivery_method === filterMethod
      ),
    })).filter(proj => proj.donations.length > 0);
  }, [selectedSchool, filterMethod]);

  return (
    <div style={{ padding:"28px 32px", maxWidth:1200, margin:"0 auto" }}>

      <div className="boTop" style={{ marginBottom:24 }}>
        <div>
          <div className="boTitle">รายการค้างนาน</div>
          <p style={{ fontSize:13, color:"#fff", margin:"4px 0 0" }}>รายการบริจาคที่ยังรอแอดมินตรวจสอบ</p>
        </div>
        <div className="boAdmin">
          <NotificationBell />
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
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <button onClick={() => { setSelectedSchool(null); setFilterMethod("all"); }}
              style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#2563eb", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, transform:"none" }}
              onMouseEnter={e => e.currentTarget.style.color = "#1d4ed8"}
              onMouseLeave={e => e.currentTarget.style.color = "#2563eb"}>
              <Icon icon="mdi:arrow-left" width={16} />กลับไปหน้ารายการโรงเรียน
            </button>
            <FilterTabs filterMethod={filterMethod} setFilterMethod={setFilterMethod} tabCounts={tabCounts} />
          </div>

          <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:14, padding:"16px 20px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon icon="teenyicons:school-outline" width={18} color="#2563eb" />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:15, color:"#0f172a" }}>{selectedSchool.school_name}</div>
              <div style={{ fontSize:12, color:"#64748b" }}>{allSelectedDonations.length} รายการทั้งหมด · {getPendingDonations(selectedSchool).length} รายการที่ยังรอดำเนินการ</div>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {filteredProjects.length === 0 ? (
              <div style={{ textAlign:"center", padding:32, color:"#94a3b8", fontSize:13, background:"#fff", borderRadius:14, border:"1.5px solid #e2e8f0" }}>
                ไม่มีรายการในหมวดนี้
              </div>
            ) : filteredProjects.map(proj => (
              <div key={proj.request_id} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:14, overflow:"hidden" }}>
                <div style={{ padding:"12px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:10, background:"#f8fafc" }}>
                  <Icon icon="mdi:clipboard-text-outline" width={16} color="#475569" />
                  <span style={{ fontWeight:600, fontSize:14, color:"#1e293b", flex:1 }}>{proj.request_title}</span>
                  <ProjectStatusBadge status={proj.project_status} />
                  <span style={{ fontSize:12, color:"#94a3b8" }}>{proj.donations.length} รายการ</span>
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
                      {proj.donations.map(d => (
                        <DonationRow
                          key={d.donation_id}
                          donation={d}
                          token={token}
                          doneStatus={doneMap[d.donation_id] ?? null}
                          onDone={(id, data) => setDoneMap(prev => ({ ...prev, [id]: data }))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="admDonationToolbar">
            <div className="admDonationSearch">
              <Icon icon="mdi:magnify" width={20} color="#5285e8" />
              <input
                placeholder="ค้นหาโรงเรียน หรือชื่อโครงการ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="ล้างคำค้นหา">
                  <Icon icon="mdi:close" width={16} />
                </button>
              )}
            </div>

            <div className="admDonationControls">
              <div className="admDonationSegment" aria-label="ตัวกรองรายการค้างนาน">
                {[
                  ["all", "ทั้งหมด"],
                  ["pending", "รอดำเนินการ"],
                  ["urgent", "เร่งด่วน"],
                  ["done", "ครบแล้ว"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={schoolFilter === value ? "active" : ""}
                    onClick={() => setSchoolFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="admDonationSort">
                <Icon icon="mdi:sort" width={18} />
                <select value={schoolSort} onChange={e => setSchoolSort(e.target.value)}>
                  <option value="most_overdue">ค้างส่งมากสุด</option>
                  <option value="latest_overdue">ค้างส่งล่าสุด</option>
                  <option value="school_name">ชื่อโรงเรียน ก-ฮ</option>
                </select>
              </label>
            </div>
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
              {filteredSchools.map(({ school, pendingCount, maxDays }) => {
                return (
                  <SchoolCard
                    key={school.school_id}
                    school={school}
                    pendingCount={pendingCount}
                    maxDays={maxDays}
                    onSelect={setSelectedSchool}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
