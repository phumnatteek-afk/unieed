// DonatePage.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import QRCode from "https://esm.sh/qrcode@1.5.3";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import CartIcon from "../../market/components/CartIcon.jsx";

import "../../../pages/styles/Homepage.css";
import "../styles/DonatePage.css";

// ─── palette (match existing Unieed brand) ───────────────
const C = {
  blue: "#29B6E8",
  yellow: "#FFBE1B",
  navy: "#378ADD",
  green: "#16a34a",
  red: "#DD2E44",
  bg: "#F7F8FA",
  white: "#FFFFFF",
  text: "#1a1a2e",
  sub: "#6b7280",
  border: "#E5E7EB",
};

const COURIERS = ["ไปรษณีย์ไทย", "Flash Express", "J&T Express", "Kerry Express", "Lazada Logistics", "อื่นๆ"];
const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_INDEX_TO_KEY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1000; // ปรับความกว้างสูงสุดแค่ 1000px พอ (ประหยัดเน็ต)
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        }, "image/jpeg", 0.7); // คุณภาพ 70% ชัดพอสำหรับหลักฐาน
      };
    };
  });
}
// ─── tiny helpers ─────────────────────────────────────────
function formatThaiDate(dateStr) {
  if (!dateStr) return "—";
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function genDonationId() {
  const now = new Date();
  const d = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const r = Math.floor(Math.random() * 900 + 100);
  return `DON-${d}-${r}`;
}

// ─── QR Canvas hook ───────────────────────────────────────
function useQRCanvas(text, size = 200) {
  const canvasRef = useRef(null);
  useEffect(() => {
    // ใส่ timeout เล็กน้อยเพื่อให้มั่นใจว่าหน้าจอวาด Canvas เสร็จก่อนสั่ง gen QR
    const t = setTimeout(() => {
      if (!canvasRef.current || !text) return;
      QRCode.toCanvas(canvasRef.current, text, {
        width: size, margin: 1,
        color: { dark: "#1a1a2e", light: "#ffffff" }
      }, (err) => { if (err) console.error(err); });
    }, 100);
    return () => clearTimeout(t);
  }, [text, size]);
  return canvasRef;
}

function formatSize(size) {
  if (!size) return "";
  try {
    const obj = typeof size === "string" ? JSON.parse(size) : size;
    const parts = [];
    if (obj.chest) parts.push(`อก ${obj.chest}"`);
    if (obj.waist) parts.push(`เอว ${obj.waist}"`);
    if (obj.length) parts.push(`ยาว ${obj.length}"`);
    return parts.length > 0 ? parts.join(" / ") : String(size);
  } catch { return String(size); }
}

// ── สร้าง time slots จาก time_start ถึง time_end ทุก 1 ชั่วโมง ──
function buildTimeSlots(timeStart, timeEnd) {
  if (!timeStart || !timeEnd) return [];
  const [sh, sm] = timeStart.split(":").map(Number);
  const [eh] = timeEnd.split(":").map(Number);
  const slots = [];
  for (let h = sh; h < eh; h++) {
    slots.push(`${String(h).padStart(2, "0")}:${String(sm).padStart(2, "0")}`);
  }
  return slots;
}

// ── Confetti effect ───────────────────────────────────────────────
function ConfettiEffect() {
  const colors = ["#29B6E8", "#FFBE1B", "#f97316", "#16a34a", "#7c3aed", "#ec4899"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {Array.from({ length: 80 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: "-20px",
          left: `${Math.random() * 100}%`,
          width: `${6 + Math.random() * 8}px`,
          height: `${10 + Math.random() * 12}px`,
          background: colors[Math.floor(Math.random() * colors.length)],
          borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          animation: `confettiFall ${2 + Math.random() * 3}s ${Math.random() * 2}s linear forwards`,
          transform: `rotate(${Math.random() * 360}deg)`,
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
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toKey = (d) =>
    `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const isDisabled = (d) => {
    const key = toKey(d);
    if (key < todayKey) return true; // อดีต
    if (!schedule?.open_days?.length) return false;
    const dow = new Date(calYear, calMonth, d).getDay();
    return !schedule.open_days.includes(DAY_INDEX_TO_KEY[dow]);
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  return (
    <div className="dnCalWrap">
      {/* nav */}
      <div className="dnCalNav">
        <button className="dnCalNavBtn" onClick={prevMonth} type="button">
          <Icon icon="mdi:chevron-left" width="18" />
        </button>
        <span className="dnCalMonthLabel">{TH_MONTHS_FULL[calMonth]} {calYear + 543}</span>
        <button className="dnCalNavBtn" onClick={nextMonth} type="button">
          <Icon icon="mdi:chevron-right" width="18" />
        </button>
      </div>
      {/* grid */}
      <div className="dnCalGrid">
        {TH_DAYS.map(d => <div key={d} className="dnCalDayLabel">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const key = toKey(d);
          const disabled = isDisabled(d);
          const isToday = key === todayKey;
          const isActive = key === value;
          return (
            <div
              key={key}
              className={[
                "dnCalCell",
                disabled ? "dnCalDisabled" : "dnCalEnabled",
                isToday ? "dnCalToday" : "",
                isActive ? "dnCalActive" : "",
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
          <span style={{ fontSize: "11px", color: "#999" }}>วันที่โรงเรียนไม่รับ</span>
        </div>
      )}
    </div>
  );
}

// ── TimeSlotPicker ────────────────────────────────────────────────
function TimeSlotPicker({ value, onChange, schedule }) {
  const slots = useMemo(() => {
    if (schedule?.time_start && schedule?.time_end) {
      return buildTimeSlots(schedule.time_start.slice(0, 5), schedule.time_end.slice(0, 5));
    }
    // ถ้าไม่มี schedule แสดงช่วง 8:00–17:00
    return buildTimeSlots("08:00", "17:00");
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
  const { requestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const donateItems = location.state?.donateItems || [];
  const initialMethod = params.get("method") || "parcel";

  const [project, setProject] = useState(null);
  const [uniformItems, setUniformItems] = useState([]);
  const [schedule, setSchedule] = useState(null); // โปรแกรมรับของโรงเรียน
  const [loading, setLoading] = useState(true);
  const [donateMethod, setDonateMethod] = useState(initialMethod);

  // Parcel
  const [courier, setCourier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [donorName, setDonorName] = useState(userName || "");

  // Drop-off
  const [appointDate, setAppointDate] = useState(""); // "YYYY-MM-DD"
  const [appointTime, setAppointTime] = useState(""); // "HH:MM"
  const [donorPhone, setDonorPhone] = useState("");

  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  // Certificate popup
  // const [certData,  setCertData]  = useState(null);
  // const [certPopup, setCertPopup] = useState(false);
  // const [confetti,  setConfetti]  = useState(false);
  // เพิ่ม:
  const [step, setStep] = useState("form");
  const [realDonationId, setRealDonationId] = useState(null);


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
          const sch = schRes.ok ? await schRes.json() : null;
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
        const idx = parseInt(d.key.replace("item_", ""), 10);
        item = uniformItems[idx];
      }
      if (!item) return null;
      return {
        uniform_type_id: item.uniform_type_id,
        name: `${item.name}${item.size ? ` (${formatSize(item.size)})` : ""}`,
        education_level: item.education_level,
        quantity: d.qty,
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
      if (!courier) return setErr("กรุณาเลือกบริการขนส่ง");
      if (!trackingNo.trim()) return setErr("กรุณากรอกเลขพัสดุ");
    } else {
      if (!appointDate) return setErr("กรุณาเลือกวันนัดหมาย");
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
      fd.append("donor_name", donorName.trim());
      fd.append("delivery_method", donateMethod);
      fd.append("donation_date",
        donateMethod === "dropoff"
          ? appointDate
          : new Date().toISOString().split("T")[0]
      );
      fd.append("items", JSON.stringify(selectedItems));

      if (donateMethod === "parcel") {
        fd.append("shipping_carrier", courier);
        fd.append("tracking_number", trackingNo.trim());
        if (proofImage) {
          const smallImg = await compressImage(proofImage); // บีบอัดก่อน append
          fd.append("image", smallImg);
        }
        // fd.append("shipping_carrier", courier);
        // fd.append("tracking_number",  trackingNo.trim());
        // if (proofImage) fd.append("image", proofImage);
      } else {
        fd.append("donor_phone", donorPhone.trim());
        fd.append("appoint_time", appointTime || "00:00");
      }

      const res = await fetch(`${BASE}/donations/${requestId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "เกิดข้อผิดพลาด");

      // ✨ ไม่ออก cert ที่นี่อีกต่อไป — แสดง success 
      setRealDonationId(data.donation_id);
      setStep("confirm");     // ← state ใหม่ (เพิ่มในส่วน [2])
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
        <Link className="navBtn navBtnWhite" to="/login">เข้าสู่ระบบ</Link>
      </div>
    );
    return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <NotificationBell />
      <ProfileDropdown />
      <CartIcon />
    </div>
  );
  };

  // format วันที่เลือกเป็นภาษาไทย
  const formatSelectedDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  if (loading) return (
    <div className="homePage">
      <div style={{ padding: "120px", textAlign: "center", color: "#888" }}>กำลังโหลด…</div>
    </div>
  );

  // SVG icons (reuse)
  const BackArrowSVG = (
    <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
      <path d="M3.78741 11.7637C3.59213 11.9591 3.48242 12.224 3.48242 12.5002C3.48242 12.7764 3.59213 13.0413 3.78741 13.2366L9.68012 19.1294C9.87658 19.3191 10.1397 19.4241 10.4128 19.4217C10.6859 19.4193 10.9472 19.3098 11.1403 19.1167C11.3335 18.9235 11.443 18.6623 11.4454 18.3891C11.4478 18.116 11.3428 17.8529 11.153 17.6564L7.03845 13.5419H20.8332C21.1095 13.5419 21.3745 13.4321 21.5698 13.2368C21.7652 13.0414 21.8749 12.7765 21.8749 12.5002C21.8749 12.2239 21.7652 11.959 21.5698 11.7636C21.3745 11.5683 21.1095 11.4585 20.8332 11.4585H7.03845L11.153 7.34394C11.3428 7.14748 11.4478 6.88435 11.4454 6.61123C11.443 6.33811 11.3335 6.07684 11.1403 5.88371C10.9472 5.69058 10.6859 5.58103 10.4128 5.57865C10.1397 5.57628 9.87658 5.68127 9.68012 5.87102L3.78741 11.7637Z" fill="black" />
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

      <div style={{ background: "#87C7EB", height: "8px", width: "100vw", marginLeft: "calc(-50vw + 50%)" }} />

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
              <div className="dnProjectFulfilled" style={{ display: "flex", alignItems: "center", gap: "4px"  }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
                ส่งถึงโรงเรียนแล้ว <strong>{project?.total_fulfilled || 0}</strong> ชุด
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
                  item = uniformItems[parseInt(d.key.replace("item_", ""), 10)];
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

        {/* ── Pop-up 1: สรุปรายการก่อนยืนยัน ── */}
        {/* ── Pop-up 1: สรุปรายการก่อนยืนยัน ── */}
        {step === "confirm" && (
          <div style={S.overlay}>
            <div style={S.modalContainer}>
              
              <ConfirmationSummaryPage
              proofPreview={proofPreview}
                donorName={donorName}
                projectTitle={project?.request_title}
                schoolName={project?.school_name}
                schoolAddress={project?.school_full_address || project?.school_address}

                // ✨ ส่วนที่ปรับปรุง: ส่งข้อมูลตามวิธีที่เลือก
                donateMethod={donateMethod}
                courier={courier}
                trackingNo={trackingNo}
                appointDate={appointDate}
                appointTime={appointTime}
                donorPhone={donorPhone}

                selectedItems={selectedItems.map(it => ({ name: it.name, qty: it.quantity }))}
                totalQty={totalQty}
                onBack={() => setStep("form")}
                onConfirm={() => {
                  // ไม่ว่าจะเป็น parcel หรือ dropoff ให้ไปหน้า QR เหมือนกัน
                  setStep("qr_label");
                }}
              />
            </div>
          </div>
        )}

        {/* ── Pop-up 2: QR Label (ปรับใหม่ให้เป็น Pop-up) ── */}
        {step === "qr_label" && (
          <div style={S.overlay}>
            <div style={S.modalContainer}>
              <QRLabelPage
                donationId={realDonationId}
                donateMethod={donateMethod}
                donorName={donorName}
                projectTitle={project?.request_title}
                schoolName={project?.school_name}
                courier={courier}
                trackingNo={trackingNo}
                appointDate={appointDate}
                appointTime={appointTime}
                donorPhone={donorPhone}
                selectedItems={selectedItems.map(it => ({ name: it.name, qty: it.quantity }))}
                totalQty={totalQty}
                // ✅ ไม่ต้องส่ง baseUrl หรือส่งแบบนี้
                baseUrl={window.location.origin}
                onViewProject={() => {
                  setSubmitSuccess(true);
                  setStep("form");
                }}
              />
            </div>
          </div>
        )}


        {/* RIGHT */}
        <div className="dnRight">
          {/* Draft banner */}
          {localStorage.getItem(`donateDraft_${requestId}`) && (
            <div style={{
              background: "#fffbeb", border: "1.5px solid #FFBE1B", borderRadius: "10px",
              padding: "10px 16px", fontSize: "14px", color: "#92400e",
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px",
            }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M5 21h14c1.1 0 2-.9 2-2v-7h-2v7H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2" />
                  <path fill="currentColor" d="M7 13v3c0 .55.45 1 1 1h3c.27 0 .52-.11.71-.29l9-9a.996.996 0 0 0 0-1.41l-3-3a.996.996 0 0 0-1.41 0l-9.01 8.99A1 1 0 0 0 7 13m10-7.59L18.59 7L17.5 8.09L15.91 6.5zm-8 8l5.5-5.5l1.59 1.59l-5.5 5.5H9z" />
                </svg>
                มีฉบับร่างที่บันทึกไว้ กรอกข้อมูลกลับมาให้แล้ว
              </span>
              <button onClick={() => { localStorage.removeItem(`donateDraft_${requestId}`); window.location.reload(); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#b45309", textDecoration: "underline" }}>
                ล้างร่าง
              </button>
            </div>
          )}

          {/* Method tabs */}
          <div className="dnMethodTabs">
            <button
              className={`dnMethodTab ${donateMethod === "parcel" ? "dnMethodTabActive" : ""}`}
              onClick={() => setDonateMethod("parcel")}
            >
              <svg width="27" height="19" viewBox="0 0 27 19" fill="none">
                <path d="M27 13.3705C27 14.9249 25.6568 16.1852 24 16.1852H3C1.34325 16.1852 0 14.9249 0 13.3705V11.2594C0 9.7049 1.34325 8.44458 3 8.44458H24C25.6568 8.44458 27 9.7049 27 11.2594V13.3705Z" fill="#DD2E44" />
                <path d="M14.25 3.51852L13.5157 2.81482H5.3595C3 2.81482 2.25 4.22221 2.25 4.22221L0 8.41554V11.9629H14.25V3.51852Z" fill="#FFEEC3" />
                <path d="M6.74805 8.44459H1.49805L2.99805 5.6298C2.99805 5.6298 3.74805 4.22241 5.24805 4.22241H6.74805V8.44459Z" fill="#55ACEE" />
                <path d="M6.75 19.0001C8.40685 19.0001 9.75 17.7398 9.75 16.1853C9.75 14.6307 8.40685 13.3705 6.75 13.3705C5.09315 13.3705 3.75 14.6307 3.75 16.1853C3.75 17.7398 5.09315 19.0001 6.75 19.0001Z" fill="#292F33" />
                <path d="M20.25 19.0001C21.9069 19.0001 23.25 17.7398 23.25 16.1853C23.25 14.6307 21.9069 13.3705 20.25 13.3705C18.5931 13.3705 17.25 14.6307 17.25 16.1853C17.25 17.7398 18.5931 19.0001 20.25 19.0001Z" fill="#292F33" />
                <path d="M24 0.00012207H12.75C11.0933 0.00012207 9.75 1.26044 9.75 2.81491V11.963H27V2.81491C27 1.26044 25.6568 0.00012207 24 0.00012207Z" fill="#CCD6DD" />
              </svg>
              จัดส่งพัสดุ
            </button>
            <button
              className={`dnMethodTab ${donateMethod === "dropoff" ? "dnMethodTabActive" : ""}`}
              onClick={() => setDonateMethod("dropoff")}
            >
              <svg width="27" height="29" viewBox="0 0 27 29" fill="none">
                <path d="M0.00195312 8.89917V18.9498C0.00195312 20.6083 1.05586 20.9672 1.05586 20.9672L12.2158 28.3572C13.9727 29.5202 13.5012 27.0715 13.5012 27.0715V17.8331L0.00195312 8.89917Z" fill="#662113" />
                <path d="M27 8.89917V18.9498C27 20.6083 25.975 20.9672 25.975 20.9672C25.975 20.9672 16.5574 27.1942 14.8015 28.3572C13.0437 29.5202 13.5008 27.0715 13.5008 27.0715V17.8331L27 8.89917Z" fill="#C1694F" />
                <path d="M14.7426 0.371569C14.0165 -0.123856 12.8257 -0.123856 12.0987 0.371569L0.545272 8.11076C-0.181757 8.60619 -0.181757 9.41592 0.545272 9.91054L12.1382 17.7448C12.8652 18.2394 14.0561 18.2394 14.7831 17.7448L26.4541 9.84231C27.1811 9.3477 27.1811 8.53796 26.4541 8.04254L14.7426 0.371569Z" fill="#D99E82" />
              </svg>
              Drop-off
            </button>

            <button
              className={`dnMethodTab ${donateMethod === "buy" ? "dnMethodTabActive" : ""}`}
              onClick={() => setDonateMethod("buy")}
            >
              <Icon icon="mdi:gift-outline" width="24" />
              ซื้อเพื่อส่งต่อ
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
                  <input type="file" accept="image/*" onChange={handleProofChange} style={{ display: "none" }} />
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
                  <Icon icon="mdi:calendar-check" width="16" color="#16a34a" style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div style={{ fontSize: "13px", color: "#14532d", lineHeight: 1.5 }}>
                    <strong>โรงเรียนรับของ:</strong>{" "}
                    {(schedule.open_days || [])
                      .map(k => ({
                        sunday: "อาทิตย์", monday: "จันทร์", tuesday: "อังคาร",
                        wednesday: "พุธ", thursday: "พฤหัสบดี", friday: "ศุกร์", saturday: "เสาร์"
                      })[k])
                      .join(", ")}
                    {" · "}{schedule.time_start?.slice(0, 5)}–{schedule.time_end?.slice(0, 5)} น.
                    {schedule.note && <><br /><span style={{ color: "#16a34a" }}>{schedule.note}</span></>}
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

              {donateMethod === "buy" && (
                <div className="dnStep">
                  <button className="dnBackBtn" onClick={() => navigate(`/projects/${requestId}`)}>
                    {BackArrowSVG} ย้อนกลับ
                  </button>
                  <div className="dnStepTitle">ซื้อสินค้ามือสองเพื่อส่งต่อให้โรงเรียน</div>

                  <div className="dnInfoBox">
                    <Icon icon="mdi:school-outline" width="20" color="#29B6E8" />
                    <div>
                      <div className="dnInfoLabel">จัดส่งตรงให้</div>
                      <div className="dnInfoVal">{project?.school_name}</div>
                      <div className="dnInfoSub">
                        {project?.school_full_address || project?.school_address}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 16 }}>
                    ระบบจะค้นหาสินค้ามือสองที่ตรงกับประเภทและขนาดที่โรงเรียนต้องการ
                    เมื่อซื้อสำเร็จ ที่อยู่จัดส่งจะเป็นโรงเรียนโดยอัตโนมัติ
                    และจะได้รับใบเกียรติบัตรเมื่อโรงเรียนยืนยันรับของแล้ว
                  </div>

                  <button
  className="dnSubmitBtn"
  onClick={() => {
    // normalize field ให้ครบก่อนส่งไป DonateMarketPage
    const projectForMarket = {
      ...project,
      // request_id อาจอยู่ใน project หรือใช้ requestId จาก useParams
      request_id:   project?.request_id   || requestId,
      project_id:   project?.project_id   || requestId,
      // title อาจเป็น request_title หรือ title
      title:        project?.request_title || project?.title || "",
      // school address — normalize ให้มีทั้ง 2 แบบ
      school_address:      project?.school_address      || project?.school_full_address || "",
      school_full_address: project?.school_full_address || project?.school_address      || "",
      // แยก district / province / postal_code ถ้ายังไม่มี
      district:      project?.district      || project?.school_district    || "",
      province:      project?.province      || project?.school_province    || "",
      postal_code:   project?.postal_code   || project?.school_postal_code || project?.postcode || "",
      contact_phone: project?.contact_phone || project?.school_phone       || project?.phone    || "",
    };
    navigate(`/donate/${requestId}/market`, {
      state: { project: projectForMarket },
    });
  }}
>
  <Icon icon="mdi:shopping-outline" /> ดูสินค้าที่ตรงกับความต้องการ
</button>
                </div>
              )}

              {/* ── ข้อมูลผู้บริจาค ── */}
              <div className="dnFormGroup">
                <label className="dnLabel">ข้อมูลติดต่อผู้บริจาค</label>
                <input
                  className="dnInput"
                  value={donorPhone}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "");
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
      {submitSuccess && (
        <div className="certOverlay">
          <ConfettiEffect />
          <div className="certPopup">
            <div className="certPopupTitle">✅ ส่งรายการเรียบร้อย!</div>
            <div className="certPopupName">{donorName}</div>
            <div className="certPopupMsg">
              ขอบคุณที่ร่วมส่งต่อโอกาสให้เด็กๆ ผ่าน Unieed
              <br /><br />
              <span style={{
                display: "inline-block",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#1e40af",
                lineHeight: 1.7,
                textAlign: "left",
              }}>
                🏅 <strong>ใบประกาศนียบัตร</strong>จะถูกออกให้อัตโนมัติ
                <br />
                เมื่อโรงเรียน<strong>ยืนยันรับของ / ยืนยันการนัดหมาย</strong>แล้ว
                <br />
                คุณจะได้รับ <strong>notification</strong> แจ้งเตือนทันที
              </span>
            </div>
            <div className="certPopupActions">
              <button
                className="certBtnClose"
                onClick={() => { setSubmitSuccess(false); navigate(`/projects/${requestId}`); }}
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 1. CONFIRMATION SUMMARY PAGE
// ═══════════════════════════════════════════════════════════
// export function ConfirmationSummaryPage({
//   donorName="สมชาย ใจดี",
//   projectTitle="ชุดนักเรียนเพื่อน้อง ปี 2568",
//   schoolName="โรงเรียนบ้านทนองแสง",
//   donateMethod, // รับเพิ่ม
//   courier,      // สำหรับ parcel
//   trackingNo,   // สำหรับ parcel
//   appointDate,  // สำหรับ dropoff
//   appointTime,  // สำหรับ dropoff
//   donorPhone,   // สำหรับ dropoff
//   schoolAddress="อ.เมือง จ.ขอนแก่น",
//   courier="Flash Express",
//   trackingNo="TH12345678XX",
//   donationDate="2026-03-27",
//   selectedItems=[
//     { name:"เสื้อเชิ้ตขาวชาย ป.1-3 (อก 30\")", qty:2 },
//     { name:"กางเกงนักเรียนชาย (เอว 24\")", qty:1 },
//     { name:"เสื้อเชิ้ตขาวหญิง ป.4-6 (อก 32\")", qty:2 },
//   ],
//   totalQty=5,
//   onConfirm=()=>{},
//   onBack=()=>{},
// }) {
// แก้ไขบรรทัดประมาณ 760+ (จุดที่ประกาศฟังก์ชัน)
export function ConfirmationSummaryPage({
  donorName, projectTitle, schoolName, schoolAddress,
  proofPreview,
  donateMethod, courier, trackingNo, appointDate, appointTime, donorPhone,
  selectedItems = [], totalQty = 0,
  onConfirm = () => {}, onBack = () => {},
}) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    await new Promise(r => setTimeout(r, 600));
    onConfirm();
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 20,
      boxShadow: "0 4px 32px rgba(0,0,0,.12)",
      width: "100%", maxWidth: 640, margin: "0 auto",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px", borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: "#29B6E8",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon icon="fluent:document-checkmark-20-filled" width="22" color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1a1a2e" }}>สรุปรายการบริจาค</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>โครงการ: {projectTitle}</div>
        </div>
      </div>

      {/* Body — 2 columns */}
      <div style={{ display: "flex", gap: 0 }}>

        {/* LEFT — รายการชุด */}
        <div style={{
          flex: 1, padding: "20px 20px",
          borderRight: "1px solid #E5E7EB",
          display: "flex", flexDirection: "column", gap: 12,
        }}>

          {/* ✅ รูปหลักฐานที่อัปโหลด — อยู่บนสุด */}
          {proofPreview && (
            <div style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}>
              <img src={proofPreview} alt="หลักฐานการจัดส่ง"
                style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
              <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 4 }}>
                หลักฐานการจัดส่ง
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
            รายการชุดนักเรียน
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedItems.map((item, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#F7F8FA", borderRadius: 8, padding: "8px 12px",
              }}>
                <span style={{ fontSize: 13, color: "#1a1a2e" }}>{item.name}</span>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: "#378ADD",
                  background: "#EFF6FF", padding: "2px 10px", borderRadius: 20,
                }}>
                  {item.qty} ชิ้น
                </span>
              </div>
            ))}
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            paddingTop: 10, borderTop: "1px solid #E5E7EB",
            fontWeight: 700, fontSize: 14,
          }}>
            <span style={{ color: "#6b7280" }}>รวมทั้งหมด</span>
            <span style={{ color: "#1a1a2e" }}>{totalQty} ชิ้น</span>
          </div>
        </div>

        {/* RIGHT — รายละเอียด + ปุ่ม */}
        <div style={{ flex: 1, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* โรงเรียนปลายทาง */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>โรงเรียนปลายทาง</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{schoolName}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.5 }}>{schoolAddress}</div>
          </div>

          <div style={{ borderTop: "1px solid #E5E7EB" }} />

          {/* ช่องทางการส่ง */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>ช่องทางการส่งต่อ</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#EFF6FF", padding: "5px 12px", borderRadius: 8,
              fontSize: 12, fontWeight: 600, color: "#378ADD", marginBottom: 8,
            }}>
              <Icon icon={donateMethod === "parcel" ? "lucide:truck" : "lucide:package-check"} width="14" />
              {donateMethod === "parcel" ? "จัดส่งพัสดุ" : "นำส่งด้วยตนเอง (Drop-off)"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {donateMethod === "parcel" ? (
                <>
                  <DetailRow label="ขนส่ง" value={courier} />
                  <DetailRow label="เลข Tracking" value={trackingNo} mono />
                  <DetailRow label="วันที่ส่ง" value={formatThaiDate(new Date())} />
                </>
              ) : (
                <>
                  <DetailRow label="วันนัดหมาย" value={formatThaiDate(appointDate)} />
                  <DetailRow label="เวลา" value={appointTime ? `${appointTime} น.` : "ไม่ระบุ"} />
                  <DetailRow label="เบอร์ติดต่อ" value={donorPhone} />
                </>
              )}
              <DetailRow label="ผู้บริจาค" value={donorName} />
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Notice */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            background: "#FFFBEB", border: "1.5px solid #FFBE1B",
            borderRadius: 10, padding: "10px 12px",
            fontSize: 12, color: "#92400e", lineHeight: 1.5,
          }}>
            <Icon icon="fluent:info-20-filled" width="14" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {donateMethod === "parcel"
                ? "หลังยืนยันแล้ว ระบบจะสร้าง QR Label สำหรับปริ้นแปะหน้ากล่องพัสดุ"
                : "กรุณานำชุดนักเรียนไปส่งตามวันและเวลาที่นัดหมายไว้"
              }
            </span>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={{
                flex: 1, padding: "11px", background: "#F3F4F6", color: "#1a1a2e",
                border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
              onClick={onBack} type="button"
            >
              ← กลับแก้ไข
            </button>
            <button
              style={{
                flex: 2, padding: "11px", background: "#29B6E8", color: "#fff",
                border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                cursor: "pointer", opacity: confirming ? 0.7 : 1,
              }}
              onClick={handleConfirm} disabled={confirming} type="button"
            >
              {confirming ? <><Spinner /> กำลังยืนยัน...</> : "ยืนยันการส่งต่อ →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// helper เล็กสำหรับแถวรายละเอียดฝั่งขวา
function DetailRow({ label, value, mono = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ color: "#1a1a2e", fontWeight: 500, ...(mono ? { fontFamily: "monospace", fontWeight: 700 } : {}) }}>
        {value || "—"}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. QR LABEL PAGE  (after confirm)
// ═══════════════════════════════════════════════════════════
export function QRLabelPage({
  donationId,
  donorName = "สมชาย ใจดี",
  projectTitle = "ชุดนักเรียนเพื่อน้อง ปี 2568",
  schoolName = "โรงเรียนบ้านทนองแสง",
  donateMethod, // รับค่าเพื่อเช็คประเภท
  courier,      // ข้อมูลสำหรับ Parcel
  trackingNo,   // ข้อมูลสำหรับ Parcel
  appointDate,  // ข้อมูลสำหรับ Drop-off
  appointTime,  // ข้อมูลสำหรับ Drop-off
  donorPhone,   // ข้อมูลสำหรับ Drop-off
  selectedItems = [],
  totalQty = 5,
  baseUrl = "http://localhost:5173",
  onViewProject = () => { },
}) {
  const printRef = useRef(null);
  const id = donationId;
  const qrUrl = `${baseUrl}/confirm/${id}`;
  const qrRef = useQRCanvas(qrUrl, 110);

  const isDropoff = donateMethod === "dropoff";

  // ... (ฟังก์ชัน handlePrint คงเดิม) ...
  const handlePrint = () => {
    const w = window.open("", "_blank", "width=400,height=500");
    w.document.write(`
      <html><head><title>QR Label - ${id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Sarabun',sans-serif; }
        .label { width:378px; height:378px; padding:12px; border:2px dashed #ccc; }
        .brand { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
        .brandName { font-size:16px; font-weight:700; color:#29B6E8; }
        .pill { background:${isDropoff ? "#16a34a" : "#DD2E44"}; color:#fff; font-size:9px; padding:2px 6px; border-radius:20px; }
        .project { font-size:10px; color:#666; margin-bottom:8px; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px; }
        .field label { font-size:9px; color:#999; }
        .field span { font-size:11px; font-weight:600; display:block; }
        .divider { border:none; border-top:1px solid #eee; margin:6px 0; }
        .items-title { font-size:9px; color:#999; margin-bottom:4px; }
        .item { display:flex; justify-content:space-between; font-size:10px; padding:1px 0; }
        .total { font-size:11px; font-weight:700; text-align:right; margin-top:2px; }
        .qr-area { display:flex; gap:8px; align-items:flex-start; margin-top:8px; }
        .qr-canvas { border:1px solid #eee; border-radius:6px; }
        .steps { font-size:9px; color:#666; }
        .steps li { margin:2px 0; }
        .footer { font-size:8px; color:#bbb; margin-top:8px; display:flex; justify-content:space-between; }
      </style></head><body>
      ${printRef.current?.innerHTML || ""}
      </body></html>
    `);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <div style={{ ...S.page, background: "transparent", padding: 0, minHeight: "auto", display: "block" }}>
      <div style={{ ...S.card, margin: "0 auto", maxWidth: 480 }}>

        <div style={S.qrPageTitle}>
          {isDropoff
            ? "รหัสนัดหมาย (แสดงให้เจ้าหน้าที่สแกนผ่านมือถือ)"
            : "ปริ้น QR Label แปะบนกล่องพัสดุ"}
        </div>

        <div ref={printRef}>
          <div style={{ ...S.label, border: isDropoff ? `2px solid ${C.blue}` : "2px dashed #CBD5E0" }}>
            <div style={S.labelBrand}>
              <span style={S.labelBrandName}>Unieed</span>
              <span style={{ ...S.labelPill, background: isDropoff ? C.green : C.red }}>
                {isDropoff ? "นัดหมายส่งมอบ" : "จัดส่งพัสดุ"}
              </span>
            </div>
            <div style={S.labelProject}>โครงการ: {projectTitle}</div>

            <div style={S.labelGrid}>
              <div>
                <div style={S.labelFieldLabel}>โรงเรียนปลายทาง</div>
                <div style={S.labelFieldVal}>{schoolName}</div>
              </div>
              <div>
                <div style={S.labelFieldLabel}>ผู้บริจาค</div>
                <div style={S.labelFieldVal}>{donorName}</div>
              </div>

              {/* ✨ ส่วนที่แสดงต่างกันตามเงื่อนไข ✨ */}
              <div>
                <div style={S.labelFieldLabel}>{isDropoff ? "วันที่นัดหมาย" : "ขนส่ง"}</div>
                <div style={S.labelFieldVal}>
                  {isDropoff
                    ? `${formatThaiDate(appointDate)} ${appointTime ? `(${appointTime} น.)` : ""}`
                    : courier}
                </div>
              </div>
              <div>
                <div style={S.labelFieldLabel}>{isDropoff ? "ข้อมูลติดต่อ" : "TRACKING"}</div>
                <div style={{ ...S.labelFieldVal, fontFamily: isDropoff ? "inherit" : "monospace", fontSize: 12, fontWeight: 700 }}>
                  {isDropoff ? donorPhone : trackingNo}
                </div>
              </div>
            </div>

            <hr style={S.labelDivider} />
            <div style={S.labelItemsTitle}>รายการ ({totalQty} ชิ้น)</div>
            {selectedItems.map((it, i) => (
              <div key={i} style={S.labelItemRow}>
                <span>{it.name}</span>
                <span style={{ fontWeight: 600 }}>×{it.qty}</span>
              </div>
            ))}
            <hr style={S.labelDivider} />

            <div style={S.labelQRArea}>
              <canvas ref={qrRef} style={S.labelCanvas} />
              <div style={S.labelSteps}>
                <div style={S.labelStepsTitle}>{isDropoff ? "วิธีแจ้งรับของ" : "วิธีใช้ QR"}</div>
                <div style={S.labelStep}>{isDropoff ? "1. เดินทางไปโรงเรียนตามนัด" : "1. ปริ้นและแปะ QR หน้ากล่อง"}</div>
                <div style={S.labelStep}>{isDropoff ? "2. ยื่นหน้านี้ให้เจ้าหน้าที่สแกน" : "2. เมื่อพัสดุถึง ครูจะสแกน"}</div>
                <div style={S.labelStep}>3. ระบบจะยืนยันการรับของ</div>
                <div style={S.labelStep}>4. คุณจะได้รับใบเกียรติบัตรทันที</div>
              </div>
            </div>

            <div style={S.labelFooter}>
              <span>unieed.com/confirm/{id}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{id}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          {/* ปุ่มยังคงอยู่ทั้งคู่ตามต้องการ แต่ปรับขนาด flex เล็กน้อย */}
          <button style={{ ...S.btnPrint, flex: 1 }} onClick={handlePrint} type="button">
            <Icon icon="fluent:print-20-filled" width="18" /> ปริ้น QR Code
          </button>
          <button style={{ flex: 1.5, padding: "12px", background: "#F0FDF4", color: "#16a34a", border: "1px solid #16a34a", borderRadius: "12px", fontWeight: "600" }} onClick={onViewProject} type="button">
            ดูผลการส่งต่อ →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. SCHOOL SCAN PAGE  (เมื่อโรงเรียนสแกน QR)
// ═══════════════════════════════════════════════════════════
export function SchoolScanPage({
  donationId = "DON-250327-001",
  isLoggedIn = false,         // ← ถ้า false จะแสดง login gate
  schoolEmail = "",
  donorName = "สมชาย ใจดี",
  courier = "Flash Express",
  trackingNo = "TH12345678XX",
  donationDate = "2026-03-27",
  status = "pending",         // "pending" | "confirmed"
  selectedItems = [
    { name: "เสื้อเชิ้ตขาวชาย ป.1-3", qty: 2 },
    { name: "กางเกงนักเรียนชาย", qty: 1 },
    { name: "เสื้อเชิ้ตขาวหญิง ป.4-6", qty: 2 },
  ],
  totalQty = 5,
  onConfirm = () => { },
  onReport = () => { },
}) {
  const [localStatus, setLocalStatus] = useState(status);
  const [confirming, setConfirming] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const [email, setEmail] = useState(schoolEmail);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (!email.includes("@")) return setLoginErr("อีเมลไม่ถูกต้อง");
    if (pw.length < 4) return setLoginErr("รหัสผ่านสั้นเกินไป");
    setLoginErr("");
    setLoggedIn(true);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    await new Promise(r => setTimeout(r, 800));
    setLocalStatus("confirmed");
    setConfirming(false);
    onConfirm();
  };

  return (
    <div style={S.scanPage}>

      {/* top bar */}
      <div style={S.scanTopbar}>
        <span style={S.scanBrand}>Unieed</span>
        <span style={S.scanSchoolBadge}>โรงเรียนบ้านทนองแสง</span>
      </div>

      <div style={S.scanCard}>

        {!loggedIn ? (
          /* ── Login gate ─────────────────────── */
          <div style={{ padding: "24px 0" }}>
            <div style={S.scanLoginTitle}>เข้าสู่ระบบโรงเรียน</div>
            <div style={S.scanLoginSub}>กรุณาใช้อีเมลที่ลงทะเบียนโรงเรียนเพื่อดูรายละเอียดการบริจาค</div>
            <form onSubmit={handleLogin} style={{ marginTop: 20 }}>
              <input style={S.scanInput} type="email" placeholder="อีเมลโรงเรียน"
                value={email} onChange={e => setEmail(e.target.value)} required />
              <input style={{ ...S.scanInput, marginTop: 10 }} type="password" placeholder="รหัสผ่าน"
                value={pw} onChange={e => setPw(e.target.value)} required />
              {loginErr && <div style={S.scanErr}>{loginErr}</div>}
              <button style={S.btnConfirm} type="submit">เข้าสู่ระบบ</button>
            </form>
          </div>
        ) : (
          /* ── Donation detail ─────────────────── */
          <>
            <div style={S.scanHeaderRow}>
              <div style={S.scanDocId}>รายการบริจาคที่ได้รับ</div>
              <div style={S.scanIdChip}>{donationId} · {formatThaiDate(donationDate)}</div>
            </div>

            {/* meta */}
            <div style={S.scanMeta}>
              <ScanRow label="ผู้บริจาค" value={donorName} />
              <ScanRow label="ขนส่ง" value={courier} />
              <ScanRow label="Tracking" value={trackingNo} mono />
              <ScanRow label="สถานะ" value={
                localStatus === "confirmed"
                  ? <span style={S.badgeGreen}>ยืนยันแล้ว ✓</span>
                  : <span style={S.badgeOrange}>รอยืนยัน</span>
              } />
            </div>

            <div style={S.scanDivider} />

            {/* items table */}
            <div style={S.scanTableTitle}>รายการ</div>
            <div style={S.scanTable}>
              <div style={S.scanTableHead}>
                <span>รายการ</span><span>จำนวน</span>
              </div>
              {selectedItems.map((it, i) => (
                <div key={i} style={S.scanTableRow}>
                  <span>{it.name}</span>
                  <span style={{ fontWeight: 600 }}>{it.qty} ชิ้น</span>
                </div>
              ))}
              <div style={S.scanTableTotal}>
                <span>รวม</span><span style={{ fontWeight: 700 }}>{totalQty} ชิ้น</span>
              </div>
            </div>

            {/* actions */}
            {localStatus !== "confirmed" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                <button style={{ ...S.btnConfirm, opacity: confirming ? 0.7 : 1 }}
                  onClick={handleConfirm} disabled={confirming} type="button">
                  {confirming ? <><Spinner /> กำลังยืนยัน...</> : "ยืนยันรับของแล้ว ✓"}
                </button>
                <button style={S.btnReport} onClick={onReport} type="button">แจ้งปัญหา</button>
              </div>
            ) : (
              <div style={S.scanSuccess}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={C.green} strokeWidth="2" strokeLinecap="round" />
                  <path d="M22 4L12 14.01l-3-3" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ fontWeight: 600, color: C.green }}>ยืนยันรับของเรียบร้อยแล้ว</div>
                <div style={{ fontSize: 12, color: C.sub }}>ผู้บริจาคจะได้รับแจ้งเตือนและใบเกียรติบัตรโดยอัตโนมัติ</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. NOTIFICATION ITEM  (ใน NotificationBell)
// ═══════════════════════════════════════════════════════════
export function DonationNotificationItem({
  donationId = "DON-250327-001",
  schoolName = "โรงเรียนบ้านทนองแสง",
  totalQty = 5,
  donationDate = "2026-03-27",
  isRead = false,
  isExpanded = false,
  onToggle = () => { },
  baseUrl = "http://localhost:5173/login",
}) {
  const qrUrl = `${baseUrl}/confirm/${donationId}`;
  const qrRef = useQRCanvas(isExpanded ? qrUrl : null, 90);

  return (
    <div style={{ ...S.notifItem, background: isRead ? "#fff" : "#f0f7ff" }}
      onClick={onToggle}>

      {/* icon */}
      <div style={{ ...S.notifIcon, background: isRead ? "#e5e7eb" : "#dbeafe" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            stroke={isRead ? "#6b7280" : C.navy} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.notifTitle, fontWeight: isRead ? 500 : 700 }}>
          ส่งรายการบริจาคเรียบร้อย!
        </div>
        <div style={S.notifSub}>
          {schoolName} · {totalQty} ชิ้น · DON-{donationId?.replace("DON-", "")}
        </div>
        <div style={S.notifTime}>{formatThaiDate(donationDate)}</div>

        {/* expanded QR */}
        {isExpanded && (
          <div style={S.notifQRExpand} onClick={e => e.stopPropagation()}>
            <canvas ref={qrRef} style={S.notifQRCanvas} />
            <div style={S.notifQRInfo}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>QR สำหรับปริ้นแปะกล่อง</div>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>โรงเรียนสแกนเพื่อยืนยันรับของ</div>
              <div style={{
                fontFamily: "monospace", fontSize: 10, color: C.navy, background: "#eff6ff",
                padding: "2px 6px", borderRadius: 4
              }}>{donationId}</div>
            </div>
          </div>
        )}
      </div>

      {/* unread dot */}
      {!isRead && <div style={S.unreadDot} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEMO: shows all screens in one page
// ═══════════════════════════════════════════════════════════
export function DonationFlowDemo() {
  const [screen, setScreen] = useState("confirm");  // confirm | qr | school | notif
  const [notifExpanded, setNotifExpanded] = useState(false);

  const donationId = "DON-250327-001";
  const sharedProps = {
    donationId,
    donorName: "สมชาย ใจดี",
    projectTitle: "ชุดนักเรียนเพื่อน้อง ปี 2568",
    schoolName: "โรงเรียนบ้านทนองแสง",
    schoolAddress: "อ.เมือง จ.ขอนแก่น",
    courier: "Flash Express",
    trackingNo: "TH12345678XX",
    donationDate: "2026-03-27",
    selectedItems: [
      { name: "เสื้อเชิ้ตขาวชาย ป.1-3 (อก 30\")", qty: 2 },
      { name: "กางเกงนักเรียนชาย (เอว 24\")", qty: 1 },
      { name: "เสื้อเชิ้ตขาวหญิง ป.4-6 (อก 32\")", qty: 2 },
    ],
    totalQty: 5,
  };

  return (
    <div style={{ fontFamily: "'Kanit', sans-serif", minHeight: "100vh", background: "#F0F4F8" }}>
      {/* font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        input, select, button { font-family:'Sarabun',sans-serif; }
        button { cursor:pointer; transition: opacity .15s, transform .1s; }
        button:active { transform: scale(0.98); }
      `}</style>

      {/* Tab nav */}
      <div style={S.tabNav}>
        {[
          { key: "confirm", label: "① สรุปก่อนยืนยัน" },
          { key: "qr", label: "② QR Label" },
          { key: "school", label: "③ โรงเรียนสแกน" },
          { key: "notif", label: "④ Notification" },
        ].map(t => (
          <button key={t.key} style={{ ...S.tab, ...(screen === t.key ? S.tabActive : {}) }}
            onClick={() => setScreen(t.key)} type="button">{t.label}</button>
        ))}
      </div>

      {screen === "confirm" && (
        <ConfirmationSummaryPage
          {...sharedProps}
          onConfirm={() => setScreen("qr")}
          onBack={() => alert("กลับไปแก้ไข")}
        />
      )}

      {screen === "qr" && (
        <QRLabelPage
          {...sharedProps}
          baseUrl="http://localhost:5173"
          // baseUrl="https://unieed.com"
          onViewProject={() => setScreen("school")}
        />
      )}

      {screen === "school" && (
        <SchoolScanPage
          {...sharedProps}
          isLoggedIn={false}
          onConfirm={() => alert("บันทึกลง DB แล้ว! แจ้งเตือนผู้บริจาค")}
          onReport={() => alert("ส่งรายงานปัญหา")}
        />
      )}

      {screen === "notif" && (
        <div style={{
          maxWidth: 400, margin: "40px auto", background: "#fff", borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden"
        }}>
          <div style={{
            padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
            fontWeight: 700, fontSize: 15
          }}>การแจ้งเตือน
            <span style={{
              marginLeft: 8, background: C.blue, color: "#fff", fontSize: 11,
              padding: "2px 8px", borderRadius: 20
            }}>1 ใหม่</span>
          </div>
          <DonationNotificationItem
            {...sharedProps}
            isRead={false}
            isExpanded={notifExpanded}
            onToggle={() => setNotifExpanded(p => !p)}
            baseUrl="http://localhost:5173/login"
          />
          <div style={{ padding: "12px 20px", textAlign: "center" }}>
            <a href="#" style={{ fontSize: 13, color: C.navy }}>ดูประวัติการบริจาคทั้งหมด →</a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable sub-components ──────────────────────────────
function Section({ label, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionLabel}>{label}</div>
      {children}
    </div>
  );
}
function Row({ label, value, mono = false }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowVal, ...(mono ? { fontFamily: "monospace", fontWeight: 600 } : {}) }}>{value}</span>
    </div>
  );
}
function ScanRow({ label, value, mono = false }) {
  return (
    <div style={S.scanRow}>
      <span style={S.scanRowLabel}>{label}</span>
      <span style={{ ...S.scanRowVal, ...(mono ? { fontFamily: "monospace", fontWeight: 700, letterSpacing: .5 } : {}) }}>{value}</span>
    </div>
  );
}
function Spinner() {
  return <span style={{
    display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)",
    borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite",
    marginRight: 6, verticalAlign: "middle"
  }} />
}

// ─── Styles ───────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh", background: C.bg, display: "flex", alignItems: "flex-start",
    justifyContent: "center", padding: "32px 16px", paddingBottom: 60
  },
  card: {
    background: C.white, borderRadius: 20, boxShadow: "0 4px 32px rgba(0,0,0,.08)",
    padding: "28px 28px", width: "100%", maxWidth: 520
  },

  // card header
  cardHeader: {
    display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20,
    paddingBottom: 20, borderBottom: `1px solid ${C.border}`
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12, background: C.blue,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
  },
  headerTitle: { fontWeight: 700, fontSize: 17, color: C.text },
  headerSub: { fontSize: 13, color: C.sub, marginTop: 3 },

  // section
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12, fontWeight: 600, color: C.sub, textTransform: "uppercase",
    letterSpacing: .6, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}`
  },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    padding: "5px 0", gap: 8
  },
  rowLabel: { fontSize: 13, color: C.sub, flexShrink: 0 },
  rowVal: { fontSize: 13, color: C.text, textAlign: "right" },

  // items
  itemList: { display: "flex", flexDirection: "column", gap: 6 },
  itemRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#F7F8FA", borderRadius: 8, padding: "8px 12px"
  },
  itemName: { fontSize: 13, color: C.text },
  itemQty: {
    fontSize: 13, fontWeight: 600, color: C.navy, background: "#EFF6FF",
    padding: "2px 10px", borderRadius: 20
  },
  totalRow: {
    display: "flex", justifyContent: "space-between", marginTop: 10,
    paddingTop: 10, borderTop: `1px solid ${C.border}`
  },
  totalLabel: { fontSize: 14, color: C.sub },
  totalVal: { fontSize: 15, fontWeight: 700, color: C.text },

  // method badge
  methodBadge: {
    display: "inline-flex", alignItems: "center", gap: 8, background: "#EFF6FF",
    padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 12
  },
  methodIcon: { display: "flex" },

  // notice
  notice: {
    display: "flex", alignItems: "flex-start", gap: 10, background: "#FFFBEB",
    border: `1.5px solid ${C.yellow}`, borderRadius: 10, padding: "10px 14px",
    fontSize: 12.5, color: "#92400e", marginBottom: 20, lineHeight: 1.5
  },

  // buttons
  btnRow: { display: "flex", gap: 12 },
  btnBack: {
    flex: 1, padding: "12px", background: "#F3F4F6", color: C.text,
    border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600
  },
  btnConfirm: {
    flex: 2, padding: "13px", background: C.blue, color: "#fff",
    border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer"
  },
  btnReport: {
    padding: "12px", background: "#FEF2F2", color: "#dc2626",
    border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, width: "100%"
  },

  // ── QR Label ───────────────────────────────────────────
  qrPageTitle: {
    fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20,
    paddingBottom: 16, borderBottom: `1px solid ${C.border}`
  },

  label: {
    border: "2px dashed #CBD5E0", borderRadius: 14, padding: "16px",
    width: "100%", maxWidth: 378, fontFamily: "'Kanit',sans-serif", flex: 1
  },
  labelBrand: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  labelBrandName: { fontSize: 18, fontWeight: 800, color: C.blue },
  labelPill: {
    background: C.red, color: "#fff", fontSize: 9, padding: "2px 8px",
    borderRadius: 20, fontWeight: 600
  },
  labelProject: { fontSize: 11, color: C.sub, marginBottom: 12 },

  labelGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 },
  labelFieldLabel: { fontSize: 9, color: "#9CA3AF", marginBottom: 1 },
  labelFieldVal: { fontSize: 12, fontWeight: 600, color: C.text },

  labelDivider: { border: "none", borderTop: `1px solid ${C.border}`, margin: "10px 0" },
  labelItemsTitle: { fontSize: 9, color: C.sub, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 },
  labelItemRow: {
    display: "flex", justifyContent: "space-between", fontSize: 11,
    color: C.text, padding: "2px 0"
  },

  labelQRArea: { display: "flex", gap: 12, alignItems: "flex-start", marginTop: 10 },
  labelCanvas: { borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 },
  labelSteps: { flex: 1 },
  labelStepsTitle: { fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 4 },
  labelStep: { fontSize: 10, color: C.sub, marginBottom: 3 },

  labelFooter: {
    display: "flex", justifyContent: "space-between", marginTop: 10,
    fontSize: 9, color: "#C0C0C0"
  },

  btnPrint: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: "12px", background: C.blue, color: "#fff", border: "none",
    borderRadius: 12, fontSize: 14, fontWeight: 700
  },
  btnViewProject: {
    flex: 1, padding: "12px", background: "#F0FDF4", color: C.green,
    border: `1.5px solid ${C.green}`, borderRadius: 12, fontSize: 14, fontWeight: 600
  },

  // ── School Scan ────────────────────────────────────────
  scanPage: {
    minHeight: "100vh", background: "#F7F8FA",
    display: "flex", flexDirection: "column", alignItems: "center"
  },
  scanTopbar: {
    width: "100%", background: C.blue, padding: "14px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between"
  },
  scanBrand: { color: "#fff", fontSize: 20, fontWeight: 800 },
  scanSchoolBadge: {
    background: "rgba(255,255,255,.2)", color: "#fff",
    fontSize: 13, padding: "4px 12px", borderRadius: 20
  },
  scanCard: {
    width: "100%", maxWidth: 400, background: "#fff", borderRadius: 20,
    padding: "24px", margin: "24px 16px", boxShadow: "0 4px 24px rgba(0,0,0,.08)"
  },

  scanLoginTitle: { fontSize: 20, fontWeight: 700, color: C.text, textAlign: "center" },
  scanLoginSub: { fontSize: 13, color: C.sub, textAlign: "center", marginTop: 6, lineHeight: 1.5 },
  scanInput: {
    width: "100%", padding: "12px 14px", border: `1.5px solid ${C.border}`,
    borderRadius: 10, fontSize: 14, color: C.text, outline: "none", display: "block"
  },
  scanErr: { fontSize: 12, color: C.red, marginTop: 6 },

  scanHeaderRow: { marginBottom: 16 },
  scanDocId: { fontSize: 16, fontWeight: 700, color: C.text },
  scanIdChip: { fontSize: 12, color: C.sub, marginTop: 2 },

  scanMeta: {
    background: "#F7F8FA", borderRadius: 12, padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 0
  },
  scanRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "5px 0", borderBottom: `1px solid #EFEFEF`
  },
  scanRowLabel: { fontSize: 13, color: C.sub },
  scanRowVal: { fontSize: 13, color: C.text, fontWeight: 500 },

  scanDivider: { border: "none", borderTop: `1px solid ${C.border}`, margin: "16px 0" },
  scanTableTitle: { fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 },
  scanTable: { border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" },
  scanTableHead: {
    display: "flex", justifyContent: "space-between", padding: "8px 14px",
    background: "#F7F8FA", fontSize: 12, fontWeight: 600, color: C.sub
  },
  scanTableRow: {
    display: "flex", justifyContent: "space-between", padding: "10px 14px",
    fontSize: 13, color: C.text, borderTop: `1px solid ${C.border}`
  },
  scanTableTotal: {
    display: "flex", justifyContent: "space-between", padding: "10px 14px",
    background: "#F0F9FF", borderTop: `2px solid ${C.blue}`, fontSize: 14, color: C.text
  },

  badgeGreen: {
    background: "#D1FAE5", color: C.green, padding: "2px 10px",
    borderRadius: 20, fontSize: 12, fontWeight: 600
  },
  badgeOrange: {
    background: "#FEF3C7", color: "#B45309", padding: "2px 10px",
    borderRadius: 20, fontSize: 12, fontWeight: 600
  },

  scanSuccess: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    padding: "24px", background: "#F0FDF4", borderRadius: 12, marginTop: 16, textAlign: "center"
  },

  // ── Notification item ──────────────────────────────────
  notifItem: {
    display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px",
    borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background .15s"
  },
  notifIcon: {
    width: 36, height: 36, borderRadius: 10, display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2
  },
  notifTitle: { fontSize: 13.5, color: C.text, marginBottom: 2 },
  notifSub: { fontSize: 12, color: C.sub, marginBottom: 2 },
  notifTime: { fontSize: 11, color: "#9CA3AF" },

  notifQRExpand: {
    display: "flex", gap: 12, alignItems: "center", marginTop: 12,
    background: "#F0F7FF", borderRadius: 10, padding: "12px",
    border: `1px solid #BFDBFE`
  },
  notifQRCanvas: { borderRadius: 6, border: `1px solid ${C.border}`, flexShrink: 0 },
  notifQRInfo: { flex: 1 },

  unreadDot: {
    width: 8, height: 8, borderRadius: "50%", background: C.blue,
    flexShrink: 0, marginTop: 6
  },

  // ── Tab nav ────────────────────────────────────────────
  tabNav: {
    display: "flex", gap: 4, padding: "16px 20px", background: "#fff",
    borderBottom: `1px solid ${C.border}`, overflowX: "auto",
    flexWrap: "wrap", justifyContent: "center"
  },
  tab: {
    padding: "8px 16px", border: "none", background: "transparent", borderRadius: 8,
    fontSize: 13, color: C.sub, fontWeight: 500
  },
  tabActive: { background: C.blue, color: "#fff", fontWeight: 700 },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.6)", // พื้นหลังมืด
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: "20px",
  },
  modalContainer: {
    width: "100%",
    maxWidth: "700px",
    // maxHeight: "90vh",
    // overflowY: "auto",
    borderRadius: "20px",
    position: "relative",
    background: "transparent",
    borderRadius: "20px",
    position: "relative",
  },
};
