// DonatePage.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import QRCode from "https://esm.sh/qrcode@1.5.3";
import Navbar from "../../../pages/Navbar.jsx";
import kidsImg  from "../../../unieed_pic/kids.png";
import logo3Img from "../../../unieed_pic/logo3.png";

import "../../../pages/styles/Homepage.css";
import "../styles/DonatePage.css";

// ─── palette (match existing Unieed brand) ───────────────
const C = {
  blue:       "#87c7eb",
  yellow:     "#FFBE1B",
  navy:       "#5285e8",
  green:      "#0F6E56",   // → Unieed primary teal (was #16a34a)
  greenLight: "#E1F5EE",   // → Unieed teal-light
  greenMid:   "#1D9E75",   // → Unieed teal-mid
  red:        "#DD2E44",
  bg:         "#F7F8FA",
  white:      "#FFFFFF",
  text:       "#1a1a2e",
  sub:        "#6b7280",
  border:     "#E5E7EB",
};

const COURIERS = ["ไปรษณีย์ไทย", "Flash Express", "J&T Express", "Kerry Express"];
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
  const colors = ["#29B6E8", "#FFBE1B", "#f97316", "#0F6E56", "#7c3aed", "#ec4899"];
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

  const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();

  const prevMonth = () => {
    if (isCurrentMonth) return; // ห้ามย้อนกลับก่อนเดือนปัจจุบัน
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
        <button className="dnCalNavBtn" onClick={prevMonth} type="button" disabled={isCurrentMonth} style={isCurrentMonth ? { opacity: 0.3, cursor: "not-allowed" } : {}}>
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
  const [donorName, setDonorName] = useState(localStorage.getItem("savedDonorName") || "");

  // Drop-off
  const [appointDate, setAppointDate] = useState(""); // "YYYY-MM-DD"
  const [appointTime, setAppointTime] = useState(""); // "HH:MM"
  const [donorPhone, setDonorPhone] = useState(() => localStorage.getItem("lastDonorPhone") || "");

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
          u => u.uniform_type_id === d.uniform_type_id &&
               u.education_level === d.education_level &&
               JSON.stringify(u.size) === JSON.stringify(d.size)
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
        size: item.size ?? null,
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

  // validate แล้วไปหน้า confirm (ยังไม่ call API)
  const handleSubmit = () => {
    setErr("");
    if (!donorName.trim()) return setErr("กรุณากรอกชื่อ-นามสกุลผู้บริจาค");
    if (!donorName.trim().includes(" ")) return setErr("กรุณากรอกชื่อและนามสกุลจริง (คั่นด้วยเว้นวรรค)");
    if (donateMethod === "dropoff") {
      if (!appointDate) return setErr("กรุณาเลือกวันนัดหมาย");
      if (!appointTime) return setErr("กรุณาเลือกเวลานัดหมาย");
      if (!donorPhone.trim()) return setErr("กรุณากรอกเบอร์ติดต่อ");
      const cleanPhone = donorPhone.replace(/\D/g, "");
      if (!cleanPhone) return setErr("กรุณากรอกเบอร์ติดต่อเป็นตัวเลข");
      if (cleanPhone.startsWith("02")) {
        if (cleanPhone.length !== 9) return setErr("เบอร์บ้าน (02) ต้องมี 9 หลัก");
      } else {
        if (!/^0[0-9]{9}$/.test(cleanPhone)) return setErr("เบอร์มือถือต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0");
      }
    }
    if (selectedItems.length === 0) return setErr("ไม่พบรายการที่เลือก กรุณากลับไปเลือกใหม่");
    setStep("confirm");
  };

  // call API จริง หลังจาก confirm
  const handleConfirmDonate = async () => {
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
        if (donorPhone.trim()) fd.append("donor_phone", donorPhone.trim());
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
      // จำชื่อผู้บริจาคสำหรับครั้งต่อไป
      if (donorName.trim()) localStorage.setItem("savedDonorName", donorName.trim());
      if (donorPhone.trim()) localStorage.setItem("lastDonorPhone", donorPhone.trim());
      setRealDonationId(data.donation_id);
      setStep("qr_label");
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
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
      <path d="M3.78741 11.7637C3.59213 11.9591 3.48242 12.224 3.48242 12.5002C3.48242 12.7764 3.59213 13.0413 3.78741 13.2366L9.68012 19.1294C9.87658 19.3191 10.1397 19.4241 10.4128 19.4217C10.6859 19.4193 10.9472 19.3098 11.1403 19.1167C11.3335 18.9235 11.443 18.6623 11.4454 18.3891C11.4478 18.116 11.3428 17.8529 11.153 17.6564L7.03845 13.5419H20.8332C21.1095 13.5419 21.3745 13.4321 21.5698 13.2368C21.7652 13.0414 21.8749 12.7765 21.8749 12.5002C21.8749 12.2239 21.7652 11.959 21.5698 11.7636C21.3745 11.5683 21.1095 11.4585 20.8332 11.4585H7.03845L11.153 7.34394C11.3428 7.14748 11.4478 6.88435 11.4454 6.61123C11.443 6.33811 11.3335 6.07684 11.1403 5.88371C10.9472 5.69058 10.6859 5.58103 10.4128 5.57865C10.1397 5.57628 9.87658 5.68127 9.68012 5.87102L3.78741 11.7637Z" fill="currentColor" />
    </svg>
  );

  return (
    <div className="homePage">
      <Navbar activeLink="projects" />

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
                    u => u.uniform_type_id === d.uniform_type_id &&
                         u.education_level === d.education_level &&
                         JSON.stringify(u.size) === JSON.stringify(d.size)
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
                    <span className="dnSummaryQty">{d.qty} ตัว</span>
                  </div>
                );
              })}
              <div className="dnTotal">รวม <strong>{totalQty} ตัว</strong></div>
            </div>
          )}
        </div>

        {/* ── Pop-up: Confirm step ── */}
        {step === "confirm" && (
          <div style={S.overlay}>
            <div style={S.modalContainer}>
              <ConfirmationSummaryPage
                donorName={donorName}
                projectTitle={project?.request_title}
                schoolName={project?.school_name}
                schoolAddress={project?.school_full_address || project?.school_address}
                proofPreview={proofPreview}
                donateMethod={donateMethod}
                courier={courier}
                trackingNo={trackingNo}
                appointDate={appointDate}
                appointTime={appointTime}
                donorPhone={donorPhone}
                selectedItems={selectedItems.map(it => ({ name: it.name, qty: it.quantity }))}
                totalQty={totalQty}
                onBack={() => setStep("form")}
                onConfirm={handleConfirmDonate}
              />
            </div>
          </div>
        )}

        {/* ── Pop-up: Summary + QR รวมกัน ── */}
        {step === "qr_label" && (
          <div style={S.overlay}>
            <div style={S.modalContainer}>
              <QRLabelPage
                donationId={realDonationId}
                donateMethod={donateMethod}
                donorName={donorName}
                projectTitle={project?.request_title}
                schoolName={project?.school_name}
                schoolAddress={project?.school_full_address || project?.school_address}
                courier={courier}
                trackingNo={trackingNo}
                appointDate={appointDate}
                appointTime={appointTime}
                donorPhone={donorPhone}
                selectedItems={selectedItems.map(it => ({ name: it.name, qty: it.quantity }))}
                totalQty={totalQty}
                baseUrl={window.location.origin}
                onUpdateTracking={async (newTracking, newCarrier) => {
                  await fetch(`${BASE}/donations/${realDonationId}/tracking`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ tracking_number: newTracking, shipping_carrier: newCarrier || null }),
                  });
                }}
                onUploadProof={async (file) => {
                  const fd = new FormData();
                  fd.append("image", file);
                  await fetch(`${BASE}/donations/${realDonationId}/pic`, {
                    method: "PATCH",
                    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: fd,
                  });
                }}
                onViewProject={null}
                onClose={() => {
                  if (donateMethod === "dropoff") {
                    setStep("form");
                    setSubmitSuccess(true);
                  } else {
                    navigate("/donations/history");
                  }
                }}
                onTrackingSaved={() => { setStep("form"); setSubmitSuccess(true); }}
              />
            </div>
          </div>
        )}

        {/* RIGHT */}
        <div className="dnRight" style={step !== "form" ? { visibility: "hidden" } : undefined}>
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
              <svg width="27" height="20" viewBox="0 0 43 31" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M43 21.8149C43 24.3511 40.8607 26.4075 38.2222 26.4075H4.77778C2.13925 26.4075 0 24.3511 0 21.8149V18.3705C0 15.8343 2.13925 13.778 4.77778 13.778H38.2222C40.8607 13.778 43 15.8343 43 18.3705V21.8149Z" fill="#DD2E44"/><path d="M22.6944 5.74067L21.5251 4.59253H8.5355C4.77778 4.59253 3.58333 6.8888 3.58333 6.8888L0 13.7305V19.5183H22.6944V5.74067Z" fill="#FFEEC3"/><path d="M10.7498 13.7779H2.38867L4.77756 9.18531C4.77756 9.18531 5.97201 6.88904 8.36089 6.88904H10.7498V13.7779Z" fill="#55ACEE"/><path d="M10.7504 31C13.3891 31 15.5282 28.9439 15.5282 26.4075C15.5282 23.8711 13.3891 21.8149 10.7504 21.8149C8.11174 21.8149 5.97266 23.8711 5.97266 26.4075C5.97266 28.9439 8.11174 31 10.7504 31Z" fill="#292F33"/><path d="M10.7502 28.7034C12.0696 28.7034 13.1391 27.6753 13.1391 26.4071C13.1391 25.1389 12.0696 24.1108 10.7502 24.1108C9.43087 24.1108 8.36133 25.1389 8.36133 26.4071C8.36133 27.6753 9.43087 28.7034 10.7502 28.7034Z" fill="#CCD6DD"/><path d="M32.2504 31C34.8891 31 37.0282 28.9439 37.0282 26.4075C37.0282 23.8711 34.8891 21.8149 32.2504 21.8149C29.6117 21.8149 27.4727 23.8711 27.4727 26.4075C27.4727 28.9439 29.6117 31 32.2504 31Z" fill="#292F33"/><path d="M32.2502 28.7034C33.5696 28.7034 34.6391 27.6753 34.6391 26.4071C34.6391 25.1389 33.5696 24.1108 32.2502 24.1108C30.9309 24.1108 29.8613 25.1389 29.8613 26.4071C29.8613 27.6753 30.9309 28.7034 32.2502 28.7034Z" fill="#CCD6DD"/><path d="M38.2218 0.00012207H20.3051C17.6666 0.00012207 15.5273 2.05643 15.5273 4.59267V19.5184H42.9996V4.59267C42.9996 2.05643 40.8603 0.00012207 38.2218 0.00012207Z" fill="#CCD6DD"/></svg>
              จัดส่งพัสดุ
            </button>
            <button
              className={`dnMethodTab ${donateMethod === "dropoff" ? "dnMethodTabActive" : ""}`}
              onClick={() => setDonateMethod("dropoff")}
            >
              <svg width="25" height="27" viewBox="0 0 41 44" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.00195312 13.5022V28.7514C0.00195312 31.2677 1.60232 31.8124 1.60232 31.8124L18.549 43.0247C21.2167 44.7893 20.5008 41.0741 20.5008 41.0741V27.0571L0.00195312 13.5022Z" fill="#662113"/><path d="M41 13.5022V28.7514C41 31.2677 39.4435 31.8124 39.4435 31.8124C39.4435 31.8124 25.1427 41.2601 22.4764 43.0247C19.8071 44.7893 20.5012 41.0741 20.5012 41.0741V27.0571L41 13.5022Z" fill="#C1694F"/><path d="M22.3869 0.56376C21.2843 -0.18792 19.4761 -0.18792 18.3721 0.56376L0.828005 12.306C-0.276002 13.0577 -0.276002 14.2862 0.828005 15.0367L18.4321 26.9231C19.5361 27.6735 21.3444 27.6735 22.4484 26.9231L40.1711 14.9332C41.2751 14.1827 41.2751 12.9542 40.1711 12.2025L22.3869 0.56376Z" fill="#D99E82"/><path d="M20.4994 43.9999C19.6911 43.9999 19.0352 43.406 19.0352 42.6715V26.7421C19.0352 26.0076 19.6911 25.4137 20.4994 25.4137C21.3091 25.4137 21.9636 26.0076 21.9636 26.7421V42.6715C21.9636 43.406 21.3091 43.9999 20.4994 43.9999Z" fill="#D99E82"/><path d="M35.1426 23.1575C35.1426 24.5179 35.2949 25.1858 33.6784 26.1667L30.0633 28.4809C28.4468 29.463 27.8216 28.6201 27.8216 27.2585V23.6097C27.8216 23.3719 27.7835 23.1168 27.4146 22.8605C23.6398 20.242 8.9832 10.4442 6.3125 8.63529L13.0844 4.10303C14.9381 5.2441 28.829 14.2717 34.6404 18.1225C34.9288 18.3147 35.1426 18.5266 35.1426 18.7583V23.1575Z" fill="#99AAB5"/><path d="M34.6389 18.1225C28.829 14.2717 14.9381 5.2441 13.0844 4.10303L10.5645 5.78876L6.3125 8.63529C8.98467 10.4442 23.6398 20.242 27.4146 22.8605C27.6356 23.0145 27.7323 23.1686 27.7777 23.3177L35.0006 18.4305C34.9127 18.3233 34.7868 18.2198 34.6389 18.1225Z" fill="#CCD6DD"/><path d="M35.1423 23.1575V18.7583C35.1423 18.5267 34.9285 18.3159 34.6386 18.1225C28.8287 14.2717 14.9378 5.2441 13.0841 4.10303L10.0488 6.13503C15.0169 9.42393 28.3235 18.0646 31.8068 20.396C32.1817 20.6474 32.2139 20.9074 32.2139 21.1452V27.1044L33.6781 26.1667C35.2946 25.1846 35.1423 24.5179 35.1423 23.1575Z" fill="#CCD6DD"/><path d="M34.6386 18.1225C28.8287 14.2716 14.9378 5.2441 13.0841 4.10303L10.0488 6.13503C15.0169 9.42393 28.3235 18.0645 31.8068 20.396C31.861 20.4317 31.8947 20.4687 31.9342 20.5044L35.0003 18.4305C34.9124 18.3233 34.7865 18.2198 34.6386 18.1225Z" fill="#E1E8ED"/></svg>
              Drop-off
            </button>

            <button
              className={`dnMethodTab ${donateMethod === "buy" ? "dnMethodTabActive" : ""}`}
              onClick={() => {
                const projectForMarket = {
                  ...project,
                  request_id:          project?.request_id          || requestId,
                  project_id:          project?.project_id          || requestId,
                  title:               project?.request_title       || project?.title || "",
                  school_address:      project?.school_address      || project?.school_full_address || "",
                  school_full_address: project?.school_full_address || project?.school_address      || "",
                  district:            project?.district            || project?.school_district     || "",
                  province:            project?.province            || project?.school_province     || "",
                  postal_code:         project?.postal_code         || project?.school_postal_code  || project?.postcode || "",
                  contact_phone:       project?.contact_phone       || project?.school_phone        || project?.phone    || "",
                };
                navigate(`/donate/${requestId}/market`, { state: { project: projectForMarket } });
              }}
            >
              <svg width="27" height="27" viewBox="0 0 43 43" fill="none" xmlns="http://www.w3.org/2000/svg"><g clipPath="url(#clip0_dn_buy)"><path d="M21.5 42.9982C33.3743 42.9982 43 33.3725 43 21.4982C43 9.62662 33.3743 0 21.5 0C9.62573 0 0 9.62573 0 21.4991C0 33.3725 9.62573 42.9982 21.5 42.9982Z" fill="#32BEA6"/><path d="M30.8721 17.5189C30.8542 17.3247 30.7645 17.1443 30.6205 17.0129C30.4765 16.8814 30.2886 16.8086 30.0936 16.8085H12.7574C12.5621 16.8077 12.3737 16.8803 12.2293 17.0118C12.085 17.1434 11.9953 17.3243 11.9781 17.5189L10.5582 33.1547C10.5479 33.2631 10.5604 33.3724 10.595 33.4756C10.6295 33.5788 10.6853 33.6736 10.7587 33.754C10.8322 33.8343 10.9216 33.8984 11.0213 33.9421C11.121 33.9858 11.2287 34.0081 11.3375 34.0076H31.5153C31.6239 34.0074 31.7312 33.9846 31.8306 33.9407C31.9299 33.8968 32.019 33.8327 32.0922 33.7525C32.1654 33.6723 32.2211 33.5777 32.2558 33.4748C32.2905 33.3719 32.3035 33.2629 32.2938 33.1547L30.8721 17.5189Z" fill="#FACB1B"/><path d="M12.7592 16.8085C12.5641 16.8083 12.3759 16.8811 12.2317 17.0125C12.0875 17.144 11.9977 17.3246 11.9798 17.5189L10.5599 33.1547C10.5451 33.3156 10.5807 33.4772 10.6618 33.617C10.7428 33.7568 10.8653 33.8679 11.0123 33.935L28.1388 16.8085H12.7592Z" fill="#FBE158"/><path d="M17.9933 17.7482C17.5962 17.6293 17.1681 17.6729 16.8031 17.8694C16.4381 18.066 16.166 18.3994 16.0467 18.7964C15.7986 19.6241 16.62 22.326 16.62 22.326C16.62 22.326 18.7933 20.5226 19.0415 19.6949C19.1005 19.4983 19.1202 19.2919 19.0994 19.0877C19.0787 18.8834 19.0179 18.6852 18.9206 18.5045C18.8233 18.3237 18.6913 18.1639 18.5322 18.0341C18.3731 17.9044 18.19 17.8072 17.9933 17.7482Z" fill="#5B5C5F"/><path d="M17.5898 19.1529C17.797 19.1529 17.9958 19.0706 18.1424 18.9241C18.2891 18.7777 18.3716 18.579 18.3718 18.3717V13.6811C18.3725 12.8519 18.7022 12.0567 19.2885 11.4702C19.8748 10.8838 20.6699 10.5538 21.4992 10.5529C22.328 10.5541 23.1225 10.8839 23.7086 11.4699C24.2947 12.056 24.6245 12.8505 24.6256 13.6794V18.3708C24.6256 18.5782 24.708 18.7772 24.8547 18.9238C25.0014 19.0705 25.2003 19.1529 25.4077 19.1529C25.6151 19.1529 25.814 19.0705 25.9607 18.9238C26.1074 18.7772 26.1898 18.5782 26.1898 18.3708V13.6802C26.1658 12.4521 25.661 11.2824 24.784 10.4223C23.9069 9.56222 22.7276 9.08044 21.4992 9.08044C20.2708 9.08044 19.0914 9.56222 18.2144 10.4223C17.3373 11.2824 16.8326 12.4521 16.8086 13.6802V18.3708C16.8086 18.5781 16.8909 18.7769 17.0373 18.9235C17.1838 19.0702 17.3825 19.1527 17.5898 19.1529Z" fill="#84462D"/><path d="M18.3735 26.9718C18.3735 27.1792 18.2911 27.3781 18.1444 27.5248C17.9977 27.6715 17.7988 27.7539 17.5914 27.7539H16.0282C15.9254 27.7542 15.8235 27.7342 15.7285 27.695C15.6334 27.6559 15.5471 27.5983 15.4744 27.5256C15.4017 27.4529 15.3441 27.3665 15.3049 27.2715C15.2657 27.1764 15.2457 27.0746 15.2461 26.9718V22.2812C15.2461 22.1785 15.2663 22.0768 15.3056 21.9819C15.3449 21.887 15.4025 21.8008 15.4752 21.7282C15.5478 21.6556 15.634 21.598 15.7289 21.5587C15.8238 21.5194 15.9255 21.4991 16.0282 21.4991H17.5914C17.7988 21.4991 17.9977 21.5815 18.1444 21.7282C18.2911 21.8749 18.3735 22.0738 18.3735 22.2812V26.9718Z" fill="white"/></g><defs><clipPath id="clip0_dn_buy"><rect width="43" height="43" fill="white"/></clipPath></defs></svg>
              ซื้อเพื่อบริจาค
            </button>

          </div>

          {/* ── Step guide ── */}
          {donateMethod === "parcel" && (
            <div style={{
              display: "flex", gap: 0,
              margin: "4px 0 4px",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #E0F0FB",
            }}>
              {[
                { num: "①", label: "แพ็คชุดนักเรียน", icon: "mdi:package-variant-closed" },
                { num: "②", label: "พิมพ์ใบสรุป+QR", icon: "mdi:qrcode" },
                { num: "③", label: "นำส่งที่ไปรษณีย์", icon: "mdi:truck-outline" },
                { num: "④", label: "กรอกเลขพัสดุทีหลัง", icon: "mdi:barcode" },
              ].map((s, i, arr) => (
                <div key={i} style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: "10px 6px", gap: 4,
                  background: i % 2 === 0 ? "#EEF7FD" : "#F8FBFF",
                  borderRight: i < arr.length - 1 ? "1px solid #D1E9F6" : "none",
                }}>
                  <Icon icon={s.icon} width="20" color="#29B6E8" />
                  <span style={{ fontSize: 14, color: "#378ADD", fontWeight: 700 }}>{s.num}</span>
                  <span style={{ fontSize: 10, color: "#4B5563", textAlign: "center", lineHeight: 1.3 }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
          {donateMethod === "dropoff" && (
            <div style={{
              display: "flex", gap: 0,
              margin: "4px 0 4px",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #E0F0FB",
            }}>
              {[
                { num: "①", label: "แพ็คชุดนักเรียน", icon: "mdi:package-variant-closed" },
                { num: "②", label: "นัดวันเวลา", icon: "mdi:calendar-clock" },
                { num: "③", label: "นำส่งที่โรงเรียน", icon: "mdi:school-outline" },
              ].map((s, i, arr) => (
                <div key={i} style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: "10px 6px", gap: 4,
                  background: i % 2 === 0 ? "#EEF7FD" : "#F8FBFF",
                  borderRight: i < arr.length - 1 ? "1px solid #D1E9F6" : "none",
                }}>
                  <Icon icon={s.icon} width="20" color="#29B6E8" />
                  <span style={{ fontSize: 14, color: "#378ADD", fontWeight: 700 }}>{s.num}</span>
                  <span style={{ fontSize: 10, color: "#4B5563", textAlign: "center", lineHeight: 1.3 }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
          {donateMethod === "buy" && (
            <div style={{
              display: "flex", gap: 0,
              margin: "4px 0 4px",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #E0F0FB",
            }}>
              {[
                { num: "①", label: "เลือกสินค้าในร้านค้า", icon: "mdi:store-outline" },
                { num: "②", label: "ชำระเงิน", icon: "mdi:credit-card-outline" },
                { num: "③", label: "ร้านค้าจัดส่งให้โรงเรียน", icon: "mdi:truck-check-outline" },
              ].map((s, i, arr) => (
                <div key={i} style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: "10px 6px", gap: 4,
                  background: i % 2 === 0 ? "#EEF7FD" : "#F8FBFF",
                  borderRight: i < arr.length - 1 ? "1px solid #D1E9F6" : "none",
                }}>
                  <Icon icon={s.icon} width="20" color="#29B6E8" />
                  <span style={{ fontSize: 14, color: "#378ADD", fontWeight: 700 }}>{s.num}</span>
                  <span style={{ fontSize: 10, color: "#4B5563", textAlign: "center", lineHeight: 1.3 }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

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
                <label className="dnLabel">ชื่อ - นามสกุลผู้บริจาค <span style={{ color: "#ef4444", fontWeight: 600 }}>*</span></label>
                <input
                  className="dnInput"
                  value={donorName}
                  onChange={e => setDonorName(e.target.value)}
                  placeholder="กรอกชื่อจริงและนามสกุลจริง เช่น สมชาย ใจดี"
                  maxLength={80}
                />
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "#f59e0b" }}>⚠</span>
                  กรุณากรอกชื่อ-นามสกุลจริงเพื่อใช้บนใบประกาศนียบัตร
                </div>
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">เบอร์โทรติดต่อ <span style={{ color: "#9ca3af", fontWeight: 400 }}>(ไม่บังคับ)</span></label>
                <input
                  className="dnInput"
                  type="tel"
                  placeholder="เช่น 09XXXXXXXX"
                  value={donorPhone}
                  inputMode="numeric"
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "");
                    const max = val.startsWith("02") ? 9 : 10;
                    if (val.length <= max) setDonorPhone(val);
                  }}
                />
              </div>
              {err && <div className="dnErr">{err}</div>}
              <button className="dnDraftBtn" onClick={handleSaveDraft} style={{ marginTop: "20px" }}>
                {draftSaved ? "✓ บันทึกแล้ว!" : "บันทึกฉบับร่าง"}
              </button>
              <button className="dnSubmitBtn" onClick={handleSubmit}>
                ยืนยันการส่งต่อ
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
                  <Icon icon="mdi:calendar-check" width="16" color={C.green} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div style={{ fontSize: "13px", color: "#14532d", lineHeight: 1.5 }}>
                    <strong>โรงเรียนรับของ:</strong>{" "}
                    {(schedule.open_days || [])
                      .map(k => ({
                        sunday: "อาทิตย์", monday: "จันทร์", tuesday: "อังคาร",
                        wednesday: "พุธ", thursday: "พฤหัสบดี", friday: "ศุกร์", saturday: "เสาร์"
                      })[k])
                      .join(", ")}
                    {" · "}{schedule.time_start?.slice(0, 5)}–{schedule.time_end?.slice(0, 5)} น.
                    {schedule.note && <><br /><span style={{ color: C.green }}>{schedule.note}</span></>}
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
                <label className="dnLabel">เบอร์โทรติดต่อ</label>
                <input
                  className="dnInput"
                  value={donorPhone}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "");
                    const max = val.startsWith("02") ? 9 : 10;
                    if (val.length <= max) setDonorPhone(val);
                  }}
                  placeholder="เช่น 09XXXXXXXX"
                  inputMode="numeric"
                />
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">ชื่อ - นามสกุลผู้บริจาค <span style={{ color: "#ef4444", fontWeight: 600 }}>*</span></label>
                <input
                  className="dnInput"
                  value={donorName}
                  onChange={e => setDonorName(e.target.value)}
                  placeholder="กรอกชื่อจริงและนามสกุลจริง เช่น สมชาย ใจดี"
                  maxLength={80}
                />
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "#f59e0b" }}>⚠</span>
                  กรุณากรอกชื่อ-นามสกุลจริงเพื่อใช้บนใบประกาศนียบัตร
                </div>
              </div>

              {err && <div className="dnErr">{err}</div>}
              <button className="dnDraftBtn" onClick={handleSaveDraft} style={{ marginTop: "20px" }}>
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
            <div className="certPopupTitle">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" style={{ color: "#22c55e" }}><path fill="currentColor" fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z" clipRule="evenodd"/></svg>
              ส่งรายการเรียบร้อย!
            </div>
            <div className="certPopupName">{donorName}</div>
            <div className="certPopupMsg">
              ขอบคุณที่ร่วมส่งต่อโอกาสให้เด็กๆ ผ่าน Unieed
              <br /><br />
              <span style={{
                display: "block",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                padding: "14px 20px",
                fontSize: "13px",
                color: "#1e40af",
                lineHeight: 1.8,
                textAlign: "center",
                width: "100%",
                boxSizing: "border-box",
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
                onClick={() => { setSubmitSuccess(false); navigate("/donations/history"); }}
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
      display: "flex", flexDirection: "column",
      maxHeight: "88vh", overflow: "hidden",
    }}>
      {/* Header — sticky */}
      <div style={{
        padding: "12px 20px", borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: "#29B6E8",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon icon="fluent:document-checkmark-20-filled" width="22" color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1a1a2e" }}>ตรวจสอบรายการ</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>โครงการ: {projectTitle}</div>
        </div>
      </div>

      {/* Body — scrollable 2 columns */}
      <div className="dnModalScroll" style={{
        flex: 1, minHeight: 0,
        display: "flex", gap: 0, overflowY: "auto",
      }}>

        {/* LEFT — รายการชุด */}
        <div style={{
          flex: 1, padding: "14px 16px",
          borderRight: "1px solid #E5E7EB",
          display: "flex", flexDirection: "column", gap: 10,
        }}>

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
                  fontSize: 13, fontWeight: 600, color: "#5285e8",
                  background: "#EFF6FF", padding: "2px 10px", borderRadius: 20,
                }}>
                  {item.qty} ตัว
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
            <span style={{ color: "#1a1a2e" }}>{totalQty} ตัว</span>
          </div>
        </div>

        {/* RIGHT — รายละเอียด */}
        <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

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
                  <DetailRow label="วันที่ส่ง" value={formatThaiDate(new Date())} />
                  {donorPhone && <DetailRow label="เบอร์ติดต่อ" value={donorPhone} />}
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
        </div>
      </div>

      {/* Footer — sticky (notice + buttons) */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid #E5E7EB",
        padding: "10px 16px",
        display: "flex", flexDirection: "column", gap: 8,
        background: "#fff", borderRadius: "0 0 20px 20px",
      }}>
        {/* Next steps / Notice */}
        {donateMethod === "parcel" ? (
          <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>หลังยืนยันแล้วต้องทำอะไรต่อ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                "บันทึก PNG หรือปริ้นท์ใบนำส่งแนบกับพัสดุ",
                "นำส่งพัสดุที่ไปรษณีย์หรือบริษัทขนส่ง",
                'กลับมากรอกเลขพัสดุและอัปโหลดรูปหลักฐานที่เมนู "ประวัติการบริจาค"',
              ].map((text, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", flexShrink: 0 }}>{"①②③"[i]}</span>
                  <span style={{ fontSize: 11, color: "#1e40af", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: "#FFFBEB", border: "1.5px solid #FFBE1B", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>หลังยืนยันแล้วต้องทำอะไรต่อ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                "บันทึก QR หรือ screenshot ใบสรุปนี้ไว้ใช้แสดงตอน drop-off",
                `นำชุดนักเรียนไปส่งที่โรงเรียนตามวันและเวลาที่นัดหมายไว้`,
                "โรงเรียนจะสแกน QR เพื่อยืนยันรับของ คุณจะได้รับแจ้งเตือนทันที",
              ].map((text, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", flexShrink: 0 }}>{"①②③"[i]}</span>
                  <span style={{ fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{
              flex: 1, padding: "11px", background: "#F3F4F6", color: "#1a1a2e",
              border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
            onClick={onBack} type="button"
          >
            ← กลับไปแก้ไข
          </button>
          <button
            style={{
              flex: 2, padding: "11px", background: "#5285e8", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              cursor: "pointer", opacity: confirming ? 0.7 : 1,
            }}
            onClick={handleConfirm} disabled={confirming} type="button"
          >
            {confirming ? <><Spinner /> กำลังยืนยัน...</> : donateMethod === "parcel" ? "ยืนยันและดูใบนำส่ง →" : "ยืนยันการส่งต่อ →"}
          </button>
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
// 2. QR LABEL PAGE — สรุปการบริจาค + QR รวมกัน
// ═══════════════════════════════════════════════════════════
export function QRLabelPage({
  donationId,
  donorName = "",
  projectTitle = "",
  schoolName = "",
  schoolAddress = "",
  donateMethod,
  courier,
  trackingNo: initialTrackingNo = "",
  appointDate,
  appointTime,
  donorPhone,
  selectedItems = [],
  totalQty = 0,
  baseUrl = "http://localhost:5173",
  donationStatus = "",
  conditionStatus = "",
  onUpdateTracking = async () => {},
  onUploadProof = async () => {},
  onViewProject = null,
  onClose,
  onTrackingSaved,
}) {
  const slipRef = useRef(null);
  const id = donationId;
  const qrUrl = `${baseUrl}/confirm/${id}`;
  const isDropoff = donateMethod === "dropoff";

  const [courierInput, setCourierInput] = useState(courier || "");
  const [trackingInput, setTrackingInput] = useState(initialTrackingNo);
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingSaved, setTrackingSaved] = useState(false);
  const [trackingConfirmed, setTrackingConfirmed] = useState(!!initialTrackingNo);
  const [downloading, setDownloading] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);

  const qrRef = useQRCanvas(qrUrl, 110);

  const handleSaveTracking = async () => {
    if (!trackingInput.trim()) return;
    setSavingTracking(true);
    try {
      await onUpdateTracking(trackingInput.trim(), courierInput.trim() || null);
      if (proofFile) await onUploadProof(proofFile);
      setTrackingSaved(true);
      setTrackingConfirmed(true);
      setTimeout(() => {
        setTrackingSaved(false);
        onTrackingSaved?.();
      }, 800);
    } finally {
      setSavingTracking(false);
    }
  };

  const captureSlip = async () => {
    const { default: html2canvas } = await import("html2canvas");

    // แปลง QR canvas → img ก่อน capture (html2canvas ไม่ copy canvas pixels จาก clone)
    const qrCanvas = qrRef.current;
    let qrImg = null;
    if (qrCanvas?.width > 0) {
      qrImg = document.createElement("img");
      qrImg.src = qrCanvas.toDataURL("image/png");
      qrImg.style.width = qrCanvas.width + "px";
      qrImg.style.height = qrCanvas.height + "px";
      qrImg.style.border = "1.5px solid #e5e7eb";
      qrImg.style.borderRadius = "6px";
      qrCanvas.replaceWith(qrImg);
    }

    try {
      return await html2canvas(slipRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });
    } finally {
      if (qrImg) qrImg.replaceWith(qrCanvas);
    }
  };

  const downloadPNG = async () => {
    setDownloading("png");
    try {
      const canvas = await captureSlip();
      const link = document.createElement("a");
      link.download = `donation-slip-${id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally { setDownloading(""); }
  };

  const downloadPDF = async () => {
    setDownloading("pdf");
    try {
      const canvas = await captureSlip();
      const imgData = canvas.toDataURL("image/png");
      const { default: jsPDF } = await import("jspdf");
      const pxToMm = 25.4 / 96;
      const pageW = 105; // A6 width mm
      const pageH = Math.round((canvas.height / canvas.width) * pageW * 10) / 10;
      const pdf = new jsPDF({ format: [pageW, pageH], orientation: "portrait", unit: "mm" });
      pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
      pdf.save(`donation-slip-${id}.pdf`);
    } finally { setDownloading(""); }
  };

  const carrierLogos = {
    "ไปรษณีย์ไทย": "/src/unieed_pic/ship1.png",
    "Flash Express": "/src/unieed_pic/ship2.png",
    "J&T": "/src/unieed_pic/ship3.png",
    "Kerry": "/src/unieed_pic/ship4.png",
  };
  const carrierLogo = carrierLogos[courier] || null;

  return (
    <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 8px 40px rgba(0,0,0,.18)", width: "100%", maxWidth: 500, margin: "0 auto", display: "flex", flexDirection: "column", maxHeight: "75vh" }}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon icon="mdi:hand-heart" width="20" color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>ใบนำส่งพัสดุ</div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>โครงการ: {projectTitle}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
            <span style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>ช่องทางการจัดส่ง :</span>
            <span style={{ background: isDropoff ? "#E1F5EE" : "#eff6ff", color: isDropoff ? C.green : C.navy, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon icon={isDropoff ? "mdi:walk" : "mdi:truck-outline"} width="12" />
              {isDropoff ? "นัดหมาย" : "จัดส่งพัสดุ"}
            </span>
          </div>
        </div>
        <button onClick={onClose ?? onViewProject} className="dnCloseBtn" style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2, flexShrink: 0, alignSelf: "flex-start", display: "flex" }}>
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16"><path fill="currentColor" d="M7.293 8L3.146 3.854a.5.5 0 1 1 .708-.708L8 7.293l4.146-4.147a.5.5 0 0 1 .708.708L8.707 8l4.147 4.146a.5.5 0 0 1-.708.708L8 8.707l-4.146 4.147a.5.5 0 0 1-.708-.708z"/></svg>
</button>
      </div>

      {/* ── Scrollable middle ── */}
      <div className="dnModalScroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>

      {/* ── Slip body (captured for PNG/PDF) ── */}
      <div
        ref={slipRef}
        style={{
          position: "relative", overflow: "hidden",
          background: "#fff", padding: "16px 18px",
        }}
      >
        {/* watermark logo */}
        <img src={logo3Img} alt="" aria-hidden style={{
          position: "absolute", bottom: 10, left: "50%",
          transform: "translateX(-50%)",
          width: "55%", opacity: 0.05, pointerEvents: "none", userSelect: "none",
        }} />

        {/* kids illustration */}
        <img src={kidsImg} alt="" aria-hidden style={{
          position: "absolute", top: 16, right: 0,
          height: "34%", objectFit: "contain",
          pointerEvents: "none", userSelect: "none",
        }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* ผู้รับ — paddingRight เพื่อเว้นที่ illustration */}
          <div style={{ paddingRight: 110 }}>
            <div style={{ fontSize: 9, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 2 }}>ข้อมูลผู้รับ (Receiver)</div>
            <div style={{ fontSize: 9, color: C.sub }}>โรงเรียนปลายทาง :</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1.3, marginTop: 1 }}>{schoolName}</div>
            {schoolAddress && <div style={{ fontSize: 9, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>{schoolAddress}</div>}
          </div>

          <div style={{ borderTop: `1px dashed ${C.border}` }} />

          {/* ผู้บริจาค */}
          <div>
            <div style={{ fontSize: 9, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 2 }}>ข้อมูลผู้บริจาค (Sender)</div>
            <div style={{ fontSize: 11, color: C.text }}>ผู้บริจาค : <strong>{donorName}</strong></div>
            {donorPhone && (
              <div style={{ fontSize: 11, color: C.text }}>โทร : <strong>{donorPhone}</strong></div>
            )}
          </div>

          {/* ข้อมูลการส่ง — ซ่อนถ้าเป็น parcel และยังไม่มีข้อมูล */}
          {(isDropoff || courier || trackingInput) && (
            <>
              <div style={{ borderTop: `1px dashed ${C.border}` }} />
              <div>
                <div style={{ fontSize: 9, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{isDropoff ? "ข้อมูลการนัดหมาย" : "ข้อมูลการส่ง"}</div>
                {isDropoff ? (
                  <>
                    <div style={{ fontSize: 11, color: C.text }}>📅 {formatThaiDate(appointDate)}{appointTime ? ` เวลา ${appointTime} น.` : ""}</div>
                    <div style={{ fontSize: 11, color: C.text }}>📞 {donorPhone}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: C.text, display: "flex", alignItems: "center", gap: 5 }}>
                      {carrierLogo
                        ? <img src={carrierLogo} alt={courier} style={{ height: 16, width: "auto", objectFit: "contain", flexShrink: 0 }} />
                        : "🚚"}
                      {courier}
                    </div>
                    {trackingInput && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 9, color: C.sub }}>เลขพัสดุ (Tracking Number) :</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, fontFamily: "monospace", letterSpacing: 1 }}>{trackingInput}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <div style={{ borderTop: `1px dashed ${C.border}` }} />

          {/* รายการชุด */}
          <div>
            <div style={{ background: C.navy, borderRadius: "6px 6px 0 0", padding: "4px 10px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>รายการชุดนักเรียน</span>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
              {selectedItems.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 10px", background: i % 2 === 0 ? "#fff" : "#F7F8FA", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 10, color: C.text }}>{it.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.navy }}>{it.qty} ตัว</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", background: "#EFF6FF" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.navy }}>รวมทั้งหมด</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.navy }}>{totalQty} ตัว</span>
              </div>
            </div>
          </div>

          {/* QR code — ล่างสุด */}
          <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 9, color: C.sub, textAlign: "center", fontWeight: 600 }}>
              สำหรับโรงเรียน · สแกนยืนยันรับของ
            </div>
            <canvas ref={qrRef} style={{ border: `1.5px solid ${C.border}`, borderRadius: 6 }} />
            <div style={{ fontSize: 8, color: "#ccc", fontFamily: "monospace" }}>{id}</div>
          </div>
        </div>
      </div>

      {/* ── Approved banner ── */}
      {donationStatus === "approved" && (() => {
        const banners = {
          wrong_item: { bg: "#fffbeb", color: "#d97706", icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3M12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1m1 4h-2v-2h2z"/></svg>, text: "โรงเรียนแจ้งว่ารายการไม่ตรง" },
          not_sent:   { bg: "#f5f3ff", color: "#7c3aed", icon: "📦", text: "โรงเรียนแจ้งว่ายังไม่ได้รับพัสดุ" },
          damaged:    { bg: "#fff1f2", color: "#dc2626", icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3M12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1m1 4h-2v-2h2z"/></svg>, text: "โรงเรียนยืนยันรับของแล้ว (ชำรุด)" },
        };
        const b = banners[conditionStatus];
        if (b) return (
          <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, background: b.bg }}>
            <span style={{ color: b.color, display:"flex", alignItems:"center", flexShrink:0 }}>{b.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: b.color }}>{b.text}</span>
          </div>
        );
        return (
          <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, background: "#f0fdf4" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0, color: C.green }}>
              <path fill="currentColor" fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z" clipRule="evenodd"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>โรงเรียนยืนยันรับของเรียบร้อยแล้ว</span>
          </div>
        );
      })()}

      </div>{/* ── end scrollable middle ── */}

      {/* ── Footer buttons ── */}
      <div style={{ padding: "10px 18px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={downloadPNG}
          disabled={!!downloading}
          className={`qrSaveBtn qrSaveBtn--primary${downloading === "png" ? " qrSaveBtn--disabled" : ""}`}
          style={downloading === "png" ? { background: "#9ca3af" } : {}}
        >
          <Icon icon="mdi:image-outline" width="16" />
          {downloading === "png" ? "กำลังสร้าง..." : "บันทึก PNG"}
        </button>
        <button
          onClick={downloadPDF}
          disabled={!!downloading}
          className={`qrSaveBtn qrSaveBtn--outline${downloading === "pdf" ? " qrSaveBtn--disabled" : ""}`}
          style={downloading === "pdf" ? { background: "#9ca3af", color: "#fff", border: "none" } : {}}
        >
          <Icon icon="mdi:file-pdf-box" width="16" />
          {downloading === "pdf" ? "กำลังสร้าง..." : "บันทึก PDF"}
        </button>
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
                  <span style={{ fontWeight: 600 }}>{it.qty} ตัว</span>
                </div>
              ))}
              <div style={S.scanTableTotal}>
                <span>รวม</span><span style={{ fontWeight: 700 }}>{totalQty} ตัว</span>
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
          {schoolName} · {totalQty} ตัว · DON-{donationId?.replace("DON-", "")}
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
    flex: 1, padding: "12px", background: "#E8F7F2", color: C.green,
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
    background: "#C5EEE0", color: C.green, padding: "2px 10px",
    borderRadius: 20, fontSize: 12, fontWeight: 600
  },
  badgeOrange: {
    background: "#FEF3C7", color: "#B45309", padding: "2px 10px",
    borderRadius: 20, fontSize: 12, fontWeight: 600
  },

  scanSuccess: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    padding: "24px", background: "#E8F7F2", borderRadius: 12, marginTop: 16, textAlign: "center"
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
    borderRadius: "20px",
    position: "relative",
    background: "transparent",
    borderRadius: "20px",
    position: "relative",
  },
};
