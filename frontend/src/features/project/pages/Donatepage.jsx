// DonatePage.jsx
import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";

import "../../../pages/styles/Homepage.css";
import "../styles/DonatePage.css";

const COURIERS = ["ไปรษณีย์ไทย", "Flash Express", "J&T Express", "Kerry Express", "Lazada Logistics", "อื่นๆ"];
const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TH_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const TH_MONTHS_FULL  = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const TH_DAYS = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const DAY_INDEX_TO_KEY = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function formatSize(size) {
  if (!size) return "";
  try {
    const obj = typeof size === "string" ? JSON.parse(size) : size;
    const parts = [];
    if (obj.chest)  parts.push(`อก ${obj.chest}"`);
    if (obj.waist)  parts.push(`เอว ${obj.waist}"`);
    if (obj.length) parts.push(`ยาว ${obj.length}"`);
    return parts.length > 0 ? parts.join(" / ") : String(size);
  } catch { return String(size); }
}

// ── สร้าง time slots จาก time_start ถึง time_end ทุก 1 ชั่วโมง ──
function buildTimeSlots(timeStart, timeEnd) {
  if (!timeStart || !timeEnd) return [];
  const [sh, sm] = timeStart.split(":").map(Number);
  const [eh]     = timeEnd.split(":").map(Number);
  const slots = [];
  for (let h = sh; h < eh; h++) {
    slots.push(`${String(h).padStart(2,"0")}:${String(sm).padStart(2,"0")}`);
  }
  return slots;
}

// ── Confetti effect ───────────────────────────────────────────────
function ConfettiEffect() {
  const colors = ["#29B6E8","#FFBE1B","#f97316","#16a34a","#7c3aed","#ec4899"];
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9999, overflow:"hidden" }}>
      {Array.from({ length: 80 }).map((_, i) => (
        <div key={i} style={{
          position:  "absolute",
          top:       "-20px",
          left:      `${Math.random()*100}%`,
          width:     `${6+Math.random()*8}px`,
          height:    `${10+Math.random()*12}px`,
          background: colors[Math.floor(Math.random()*colors.length)],
          borderRadius: Math.random()>0.5?"50%":"2px",
          animation: `confettiFall ${2+Math.random()*3}s ${Math.random()*2}s linear forwards`,
          transform: `rotate(${Math.random()*360}deg)`,
        }} />
      ))}
      <style>{`@keyframes confettiFall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

// ── DropoffCalendar ───────────────────────────────────────────────
// mini calendar ให้เลือกวันนัด พร้อม disable วันที่โรงเรียนปิดรับ
function DropoffCalendar({ value, onChange, schedule }) {
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toKey = (d) =>
    `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const isDisabled = (d) => {
    const key = toKey(d);
    if (key < todayKey) return true; // อดีต
    if (!schedule?.open_days?.length) return false;
    const dow = new Date(calYear, calMonth, d).getDay();
    return !schedule.open_days.includes(DAY_INDEX_TO_KEY[dow]);
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11); }
    else setCalMonth(m=>m-1);
  };
  const nextMonth = () => {
    if (calMonth===11) { setCalYear(y=>y+1); setCalMonth(0); }
    else setCalMonth(m=>m+1);
  };

  return (
    <div className="dnCalWrap">
      {/* nav */}
      <div className="dnCalNav">
        <button className="dnCalNavBtn" onClick={prevMonth} type="button">
          <Icon icon="mdi:chevron-left" width="18" />
        </button>
        <span className="dnCalMonthLabel">{TH_MONTHS_FULL[calMonth]} {calYear+543}</span>
        <button className="dnCalNavBtn" onClick={nextMonth} type="button">
          <Icon icon="mdi:chevron-right" width="18" />
        </button>
      </div>
      {/* grid */}
      <div className="dnCalGrid">
        {TH_DAYS.map(d => <div key={d} className="dnCalDayLabel">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const key      = toKey(d);
          const disabled = isDisabled(d);
          const isToday  = key === todayKey;
          const isActive = key === value;
          return (
            <div
              key={key}
              className={[
                "dnCalCell",
                disabled ? "dnCalDisabled" : "dnCalEnabled",
                isToday  ? "dnCalToday"    : "",
                isActive ? "dnCalActive"   : "",
              ].join(" ")}
              onClick={() => !disabled && onChange(key)}
            >
              {d}
            </div>
          );
        })}
      </div>
      {/* legend */}
      {schedule?.open_days?.length > 0 && (
        <div className="dnCalLegend">
          <span className="dnCalLegendItem dnCalLegendClosed" />
          <span style={{ fontSize:"11px", color:"#999" }}>วันที่โรงเรียนไม่รับ</span>
        </div>
      )}
    </div>
  );
}

// ── TimeSlotPicker ────────────────────────────────────────────────
function TimeSlotPicker({ value, onChange, schedule }) {
  const slots = useMemo(() => {
    if (schedule?.time_start && schedule?.time_end) {
      return buildTimeSlots(schedule.time_start.slice(0,5), schedule.time_end.slice(0,5));
    }
    // ถ้าไม่มี schedule แสดงช่วง 8:00–17:00
    return buildTimeSlots("08:00","17:00");
  }, [schedule]);

  if (slots.length === 0) return null;

  return (
    <div className="dnTimeSlots">
      {slots.map(slot => (
        <button
          key={slot}
          type="button"
          className={`dnTimeSlot ${value === slot ? "dnTimeSlotActive" : ""}`}
          onClick={() => onChange(slot)}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function DonatePage() {
  const { token, userName } = useAuth();
  const { requestId }       = useParams();
  const navigate            = useNavigate();
  const location            = useLocation();
  const params              = new URLSearchParams(location.search);

  const donateItems   = location.state?.donateItems || [];
  const initialMethod = params.get("method") || "parcel";

  const [project,      setProject]      = useState(null);
  const [uniformItems, setUniformItems] = useState([]);
  const [schedule,     setSchedule]     = useState(null); // โปรแกรมรับของโรงเรียน
  const [loading,      setLoading]      = useState(true);
  const [donateMethod, setDonateMethod] = useState(initialMethod);

  // Parcel
  const [courier,      setCourier]      = useState("");
  const [trackingNo,   setTrackingNo]   = useState("");
  const [proofImage,   setProofImage]   = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [donorName,    setDonorName]    = useState(userName || "");

  // Drop-off
  const [appointDate,  setAppointDate]  = useState(""); // "YYYY-MM-DD"
  const [appointTime,  setAppointTime]  = useState(""); // "HH:MM"
  const [donorPhone,   setDonorPhone]   = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  // Certificate popup
  const [certData,  setCertData]  = useState(null);
  const [certPopup, setCertPopup] = useState(false);
  const [confetti,  setConfetti]  = useState(false);

  // ============ บันทึก/โหลดร่าง ============
  const handleSaveDraft = () => {
    if (!token) { alert("กรุณาเข้าสู่ระบบก่อนบันทึกร่าง"); navigate("/login"); return; }
    localStorage.setItem(`donateDraft_${requestId}`, JSON.stringify({
      donorName, donateMethod, courier, trackingNo,
      appointDate, appointTime, donorPhone,
      donateItems: location.state?.donateItems || [], requestId,
    }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
    alert("บันทึกฉบับร่างแล้ว!");
  };

  const loadDraft = () => {
    const raw = localStorage.getItem(`donateDraft_${requestId}`);
    if (!raw) return;
    const draft = JSON.parse(raw);
    setDonorName(draft.donorName || "");
    setDonateMethod(draft.donateMethod || "parcel");
    setCourier(draft.courier || "");
    setTrackingNo(draft.trackingNo || "");
    setAppointDate(draft.appointDate || "");
    setAppointTime(draft.appointTime || "");
    setDonorPhone(draft.donorPhone || "");
  };

  useEffect(() => {
    if (!loading) loadDraft();
  }, [requestId, loading]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson(`/school/projects/public/${requestId}`, false);
        setProject(data);
        setUniformItems(Array.isArray(data.uniform_items) ? data.uniform_items : []);
        // โหลด schedule
        try {
          const schRes = await fetch(`${BASE}/donations/schedule/request/${requestId}`);
          const sch    = schRes.ok ? await schRes.json() : null;
          setSchedule(sch);
        } catch { /* schedule optional */ }
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  // ── แปลง donateItems เป็น selectedItems ──
  const selectedItems = donateItems
    .filter(d => d.qty > 0)
    .map(d => {
      // รองรับทั้ง format ใหม่ (uniform_type_id) และเก่า (key=item_N)
      let item;
      if (d.uniform_type_id) {
        item = uniformItems.find(
          u => u.uniform_type_id === d.uniform_type_id && u.education_level === d.education_level
        );
      } else if (d.key) {
        const idx = parseInt(d.key.replace("item_",""), 10);
        item = uniformItems[idx];
      }
      if (!item) return null;
      return {
        uniform_type_id: item.uniform_type_id,
        name:            `${item.name}${item.size ? ` (${formatSize(item.size)})` : ""}`,
        education_level: item.education_level,
        quantity:        d.qty,
      };
    })
    .filter(Boolean);

  const totalQty = donateItems.reduce((s, d) => s + (d.qty || 0), 0);

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofImage(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setErr("");
    if (!donorName.trim()) return setErr("กรุณากรอกชื่อผู้บริจาค");
    if (donateMethod === "parcel") {
      if (!courier)           return setErr("กรุณาเลือกบริการขนส่ง");
      if (!trackingNo.trim()) return setErr("กรุณากรอกเลขพัสดุ");
    } else {
      if (!appointDate)       return setErr("กรุณาเลือกวันนัดหมาย");
      if (!donorPhone.trim()) return setErr("กรุณากรอกเบอร์ติดต่อ");
      if (donorPhone.length < 9 || donorPhone.length > 10)
        return setErr("เบอร์โทรต้องมี 9-10 หลัก");
      if (donorPhone.length === 9 && !donorPhone.startsWith("02"))
        return setErr("เบอร์ 9 หลักต้องขึ้นต้นด้วย 02");
    }
    if (selectedItems.length === 0) return setErr("ไม่พบรายการที่เลือก กรุณากลับไปเลือกใหม่");

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("donor_name",      donorName.trim());
      fd.append("delivery_method", donateMethod);
      fd.append("donation_date",
        donateMethod === "dropoff"
          ? appointDate
          : new Date().toISOString().split("T")[0]
      );
      fd.append("items", JSON.stringify(selectedItems));

      if (donateMethod === "parcel") {
        fd.append("shipping_carrier", courier);
        fd.append("tracking_number",  trackingNo.trim());
        if (proofImage) fd.append("image", proofImage);
      } else {
        fd.append("donor_phone",  donorPhone.trim());
        // ส่ง appointTime ถ้าเลือกไว้ มิฉะนั้น fallback "00:00"
        fd.append("appoint_time", appointTime || "00:00");
      }

      const res  = await fetch(`${BASE}/donations/${requestId}`, {
        method:  "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "เกิดข้อผิดพลาด");

      const certRes = await fetch(`${BASE}/certificates/generate`, {
        method:  "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ donation_id: data.donation_id }),
      });
      const cert = certRes.ok ? await certRes.json() : null;
      setCertData(cert);
      setCertPopup(true);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 5000);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  const rightAccount = () => {
    if (!token) return (
      <div className="navAuth">
        <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
        <Link className="navBtn navBtnWhite"   to="/login">เข้าสู่ระบบ</Link>
      </div>
    );
    return <ProfileDropdown />;
  };

  // format วันที่เลือกเป็นภาษาไทย
  const formatSelectedDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()+543}`;
  };

  if (loading) return (
    <div className="homePage">
      <div style={{ padding:"120px", textAlign:"center", color:"#888" }}>กำลังโหลด…</div>
    </div>
  );

  // SVG icons (reuse)
  const BackArrowSVG = (
    <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
      <path d="M3.78741 11.7637C3.59213 11.9591 3.48242 12.224 3.48242 12.5002C3.48242 12.7764 3.59213 13.0413 3.78741 13.2366L9.68012 19.1294C9.87658 19.3191 10.1397 19.4241 10.4128 19.4217C10.6859 19.4193 10.9472 19.3098 11.1403 19.1167C11.3335 18.9235 11.443 18.6623 11.4454 18.3891C11.4478 18.116 11.3428 17.8529 11.153 17.6564L7.03845 13.5419H20.8332C21.1095 13.5419 21.3745 13.4321 21.5698 13.2368C21.7652 13.0414 21.8749 12.7765 21.8749 12.5002C21.8749 12.2239 21.7652 11.959 21.5698 11.7636C21.3745 11.5683 21.1095 11.4585 20.8332 11.4585H7.03845L11.153 7.34394C11.3428 7.14748 11.4478 6.88435 11.4454 6.61123C11.443 6.33811 11.3335 6.07684 11.1403 5.88371C10.9472 5.69058 10.6859 5.58103 10.4128 5.57865C10.1397 5.57628 9.87658 5.68127 9.68012 5.87102L3.78741 11.7637Z" fill="black"/>
    </svg>
  );

  return (
    <div className="homePage">
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>
          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/projects" className="active">โครงการ</Link>
            <Link to="/market">ร้านค้า</Link>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><a href="#" className="sell">ลงขาย</a></button>
          </nav>
          {rightAccount()}
        </div>
      </header>

      <div style={{ background:"#87C7EB", height:"8px", width:"100vw", marginLeft:"calc(-50vw + 50%)" }} />

      <div className="dnLayout">
        {/* LEFT */}
        <div className="dnLeft">
          <div className="dnProjectCard">
            <div className="dnProjectImg">
              {project?.request_image_url
                ? <img src={project.request_image_url} alt={project.school_name} />
                : <div className="dnProjectImgPlaceholder" />}
            </div>
            <div className="dnProjectInfo">
              <div className="dnProjectBadge">โครงการ</div>
              <div className="dnProjectTitle">{project?.request_title || "-"}</div>
              <div className="dnProjectSchool">{project?.school_name} {project?.school_address}</div>
              <div className="dnProjectFulfilled">
                ยอดบริจาคชุดปัจจุบัน <strong>{project?.total_fulfilled || 0}</strong> ชิ้น
              </div>
            </div>
          </div>

          {donateItems.some(d => d.qty > 0) && uniformItems.length > 0 && (
            <div className="dnSummaryCard">
              <div className="dnSummaryTitle">รายการที่เลือกบริจาค</div>
              {donateItems.filter(d => d.qty > 0).map((d, i) => {
                let item;
                if (d.uniform_type_id) {
                  item = uniformItems.find(
                    u => u.uniform_type_id === d.uniform_type_id && u.education_level === d.education_level
                  );
                } else if (d.key) {
                  item = uniformItems[parseInt(d.key.replace("item_",""),10)];
                }
                if (!item) return null;
                return (
                  <div key={i} className="dnSummaryRow">
                    <span className="dnSummaryName">
                      {item.name}
                      {item.size && <span className="dnUniformSize"> {formatSize(item.size)}</span>}
                    </span>
                    <span className="dnSummaryQty">{d.qty} ชิ้น</span>
                  </div>
                );
              })}
              <div className="dnTotal">รวม <strong>{totalQty} ชิ้น</strong></div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="dnRight">
          {/* Draft banner */}
          {localStorage.getItem(`donateDraft_${requestId}`) && (
            <div style={{
              background:"#fffbeb", border:"1.5px solid #FFBE1B", borderRadius:"10px",
              padding:"10px 16px", fontSize:"14px", color:"#92400e",
              display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px",
            }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"6px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M5 21h14c1.1 0 2-.9 2-2v-7h-2v7H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2"/>
                  <path fill="currentColor" d="M7 13v3c0 .55.45 1 1 1h3c.27 0 .52-.11.71-.29l9-9a.996.996 0 0 0 0-1.41l-3-3a.996.996 0 0 0-1.41 0l-9.01 8.99A1 1 0 0 0 7 13m10-7.59L18.59 7L17.5 8.09L15.91 6.5zm-8 8l5.5-5.5l1.59 1.59l-5.5 5.5H9z"/>
                </svg>
                มีฉบับร่างที่บันทึกไว้ กรอกข้อมูลกลับมาให้แล้ว
              </span>
              <button onClick={() => { localStorage.removeItem(`donateDraft_${requestId}`); window.location.reload(); }}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:"#b45309", textDecoration:"underline" }}>
                ล้างร่าง
              </button>
            </div>
          )}

          {/* Method tabs */}
          <div className="dnMethodTabs">
            <button
              className={`dnMethodTab ${donateMethod==="parcel" ? "dnMethodTabActive":""}`}
              onClick={() => setDonateMethod("parcel")}
            >
              <svg width="27" height="19" viewBox="0 0 27 19" fill="none">
                <path d="M27 13.3705C27 14.9249 25.6568 16.1852 24 16.1852H3C1.34325 16.1852 0 14.9249 0 13.3705V11.2594C0 9.7049 1.34325 8.44458 3 8.44458H24C25.6568 8.44458 27 9.7049 27 11.2594V13.3705Z" fill="#DD2E44"/>
                <path d="M14.25 3.51852L13.5157 2.81482H5.3595C3 2.81482 2.25 4.22221 2.25 4.22221L0 8.41554V11.9629H14.25V3.51852Z" fill="#FFEEC3"/>
                <path d="M6.74805 8.44459H1.49805L2.99805 5.6298C2.99805 5.6298 3.74805 4.22241 5.24805 4.22241H6.74805V8.44459Z" fill="#55ACEE"/>
                <path d="M6.75 19.0001C8.40685 19.0001 9.75 17.7398 9.75 16.1853C9.75 14.6307 8.40685 13.3705 6.75 13.3705C5.09315 13.3705 3.75 14.6307 3.75 16.1853C3.75 17.7398 5.09315 19.0001 6.75 19.0001Z" fill="#292F33"/>
                <path d="M20.25 19.0001C21.9069 19.0001 23.25 17.7398 23.25 16.1853C23.25 14.6307 21.9069 13.3705 20.25 13.3705C18.5931 13.3705 17.25 14.6307 17.25 16.1853C17.25 17.7398 18.5931 19.0001 20.25 19.0001Z" fill="#292F33"/>
                <path d="M24 0.00012207H12.75C11.0933 0.00012207 9.75 1.26044 9.75 2.81491V11.963H27V2.81491C27 1.26044 25.6568 0.00012207 24 0.00012207Z" fill="#CCD6DD"/>
              </svg>
              จัดส่งพัสดุ
            </button>
            <button
              className={`dnMethodTab ${donateMethod==="dropoff" ? "dnMethodTabActive":""}`}
              onClick={() => setDonateMethod("dropoff")}
            >
              <svg width="27" height="29" viewBox="0 0 27 29" fill="none">
                <path d="M0.00195312 8.89917V18.9498C0.00195312 20.6083 1.05586 20.9672 1.05586 20.9672L12.2158 28.3572C13.9727 29.5202 13.5012 27.0715 13.5012 27.0715V17.8331L0.00195312 8.89917Z" fill="#662113"/>
                <path d="M27 8.89917V18.9498C27 20.6083 25.975 20.9672 25.975 20.9672C25.975 20.9672 16.5574 27.1942 14.8015 28.3572C13.0437 29.5202 13.5008 27.0715 13.5008 27.0715V17.8331L27 8.89917Z" fill="#C1694F"/>
                <path d="M14.7426 0.371569C14.0165 -0.123856 12.8257 -0.123856 12.0987 0.371569L0.545272 8.11076C-0.181757 8.60619 -0.181757 9.41592 0.545272 9.91054L12.1382 17.7448C12.8652 18.2394 14.0561 18.2394 14.7831 17.7448L26.4541 9.84231C27.1811 9.3477 27.1811 8.53796 26.4541 8.04254L14.7426 0.371569Z" fill="#D99E82"/>
              </svg>
              Drop-off
            </button>
          </div>

          {/* ── PARCEL form (unchanged) ── */}
          {donateMethod === "parcel" && (
            <div className="dnStep">
              <button className="dnBackBtn" onClick={() => navigate(`/projects/${requestId}`)}>
                {BackArrowSVG} ย้อนกลับ
              </button>
              <div className="dnStepTitle">ที่อยู่สำหรับจ่าหน้าพัสดุ</div>
              <div className="dnAddressBox">
                <div className="dnAddressText">
                  โครงการ "{project?.request_title}"<br />
                  {project?.school_name} {project?.school_full_address || project?.school_address}
                </div>
                <button className="dnCopyBtn" onClick={() => {
                  navigator.clipboard.writeText(
                    `โครงการ "${project?.request_title}" ${project?.school_name} ${project?.school_full_address || project?.school_address}`
                  );
                  alert("คัดลอกที่อยู่แล้ว!");
                }}>
                  <Icon icon="fluent:copy-20-filled" width="20" />
                </button>
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">เลือกบริการขนส่งที่จัดส่ง</label>
                <select className="dnSelect" value={courier} onChange={e => setCourier(e.target.value)}>
                  <option value="">เลือกขนส่ง</option>
                  {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">กรอกเลขพัสดุ</label>
                <input className="dnInput" value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="เลข Tracking" />
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">อัปโหลดหลักฐานการจัดส่งพัสดุ</label>
                <label className="dnUploadBox">
                  {proofPreview
                    ? <img src={proofPreview} alt="proof" className="dnProofImg" />
                    : <><Icon icon="fluent:image-add-20-filled" width="36" color="#aaa" /><span>เพิ่มรูปภาพ</span></>}
                  <input type="file" accept="image/*" onChange={handleProofChange} style={{ display:"none" }} />
                </label>
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">ชื่อ - นามสกุลผู้บริจาค</label>
                <input className="dnInput" value={donorName} onChange={e => setDonorName(e.target.value)}
                  placeholder="ชื่อ-นามสกุล (ใช้สำหรับออกใบเซอร์)" />
              </div>
              {err && <div className="dnErr">{err}</div>}
              <button className="dnDraftBtn" onClick={handleSaveDraft}>
                {draftSaved ? "✓ บันทึกแล้ว!" : "บันทึกฉบับร่าง"}
              </button>
              <button className="dnSubmitBtn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "กำลังส่ง..." : "ยืนยันการส่งต่อ"}
              </button>
              <div className="dnCertNote">*รับใบเกียรติบัตรเมื่อโรงเรียนยืนยันการรับของแล้ว*</div>
            </div>
          )}

          {/* ── DROP-OFF form (ใหม่) ── */}
          {donateMethod === "dropoff" && (
            <div className="dnStep">
              <button className="dnBackBtn" onClick={() => navigate(`/projects/${requestId}`)}>
                {BackArrowSVG} ย้อนกลับ
              </button>
              <div className="dnStepTitle">เลือกวันและเวลานัดหมาย</div>

              {/* สถานที่รับ */}
              <div className="dnInfoBox">
                <Icon icon="fluent:location-20-filled" width="20" color="#FFBE1B" />
                <div>
                  <div className="dnInfoLabel">สถานที่รับ</div>
                  <div className="dnInfoVal">{project?.school_name}</div>
                  <div className="dnInfoSub">{project?.school_full_address || project?.school_address}</div>
                </div>
              </div>

              {/* Banner ตารางโรงเรียน */}
              {schedule ? (
                <div className="dnScheduleBanner">
                  <Icon icon="mdi:calendar-check" width="16" color="#16a34a" style={{ flexShrink:0, marginTop:"1px" }} />
                  <div style={{ fontSize:"13px", color:"#14532d", lineHeight:1.5 }}>
                    <strong>โรงเรียนรับของ:</strong>{" "}
                    {(schedule.open_days || [])
                      .map(k => ({ sunday:"อาทิตย์",monday:"จันทร์",tuesday:"อังคาร",
                        wednesday:"พุธ",thursday:"พฤหัสบดี",friday:"ศุกร์",saturday:"เสาร์" })[k])
                      .join(", ")}
                    {" · "}{schedule.time_start?.slice(0,5)}–{schedule.time_end?.slice(0,5)} น.
                    {schedule.note && <><br /><span style={{ color:"#16a34a" }}>{schedule.note}</span></>}
                  </div>
                </div>
              ) : (
                <div className="dnScheduleBannerNone">
                  <Icon icon="mdi:information-outline" width="15" color="#6b7280" />
                  <span>โรงเรียนยังไม่ได้กำหนดช่วงเวลารับของ — เลือกวันเวลาที่ต้องการได้เลย</span>
                </div>
              )}

              {/* ── Calendar picker ── */}
              <div className="dnFormGroup">
                <label className="dnLabel">วันที่ต้องการ</label>
                <DropoffCalendar
                  value={appointDate}
                  onChange={setAppointDate}
                  schedule={schedule}
                />
              </div>

              {/* ── Time slot picker ── */}
              <div className="dnFormGroup">
                <label className="dnLabel">
                  เวลา
                  {!schedule && <span className="dnLabelHint"> (เลือกหรือไม่ก็ได้)</span>}
                </label>
                <TimeSlotPicker
                  value={appointTime}
                  onChange={(t) => setAppointTime(prev => prev === t ? "" : t)}
                  schedule={schedule}
                />
              </div>

              {/* ── สรุปวันเวลาที่เลือก ── */}
              {(appointDate || appointTime) && (
                <div className="dnAppointSummary">
                  <Icon icon="mdi:calendar-clock" width="16" color="#378ADD" />
                  <span>
                    นัดหมาย:&nbsp;
                    <strong>
                      {appointDate ? formatSelectedDate(appointDate) : "—"}
                      {appointTime ? ` · ${appointTime} น.` : ""}
                    </strong>
                  </span>
                </div>
              )}

              {/* ── ข้อมูลผู้บริจาค ── */}
              <div className="dnFormGroup">
                <label className="dnLabel">ข้อมูลติดต่อผู้บริจาค</label>
                <input
                  className="dnInput"
                  value={donorPhone}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g,"");
                    if (val.length <= 10) setDonorPhone(val);
                  }}
                  placeholder="เช่น 09X-XXX-XXXX"
                  inputMode="numeric"
                />
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">กรอกชื่อผู้บริจาค</label>
                <input className="dnInput" value={donorName} onChange={e => setDonorName(e.target.value)}
                  placeholder="ชื่อ-นามสกุล (ใช้สำหรับออกใบเซอร์)" />
              </div>

              {err && <div className="dnErr">{err}</div>}
              <button className="dnDraftBtn" onClick={handleSaveDraft}>
                {draftSaved ? "✓ บันทึกแล้ว!" : "บันทึกฉบับร่าง"}
              </button>
              <button className="dnSubmitBtn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "กำลังส่ง..." : "ยืนยันการนัดหมาย"}
              </button>
              <div className="dnCertNote">*รับใบเกียรติบัตรเมื่อโรงเรียนยืนยันการรับของแล้ว*</div>
            </div>
          )}
        </div>
      </div>

      {/* Certificate Popup */}
      {certPopup && (
        <div className="certOverlay">
          {confetti && <ConfettiEffect />}
          <div className="certPopup">
            <div className="certPopupTitle">🎉 ขอบคุณที่ร่วมส่งต่อ!</div>
            <div className="certPopupName">{donorName}</div>
            <div className="certPopupMsg">
              ขอบคุณที่เข้าร่วมเป็นส่วนหนึ่งของการส่งมอบคุณค่าให้กับเด็กๆ
              ผ่านแพลตฟอร์ม Unieed ทางแพลตฟอร์มขอมอบใบประกาศนียบัตร
              ฉบับนี้เพื่อเป็นเกียรติให้แก่ผู้บริจาค
            </div>
            {certData?.certificate_url && (
              <img src={certData.certificate_url} alt="certificate" className="certPreview" />
            )}
            <div className="certPopupActions">
              {certData?.certificate_url && (
                <a href={certData.certificate_url} download="certificate.png" className="certBtnDownload">
                  ⬇ ดาวน์โหลด PNG
                </a>
              )}
              {certData?.pdf_url && (
                <a href={certData.pdf_url} target="_blank" rel="noreferrer" className="certBtnDownload certBtnPdf">
                  ⬇ ดาวน์โหลด PDF
                </a>
              )}
              <button className="certBtnClose" onClick={() => { setCertPopup(false); navigate(`/projects/${requestId}`); }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}