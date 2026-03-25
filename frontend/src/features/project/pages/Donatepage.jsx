// DonatePage.jsx
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import "../../../pages/styles/Homepage.css";
import "../styles/DonatePage.css";

const COURIERS = ["ไปรษณีย์ไทย", "Flash Express", "J&T Express", "Kerry Express", "Lazada Logistics", "อื่นๆ"];
const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

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

// ── Confetti effect ───────────────────────────────────────────────
function ConfettiEffect() {
  const colors = ["#29B6E8", "#FFBE1B", "#f97316", "#16a34a", "#7c3aed", "#ec4899"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {Array.from({ length: 80 }).map((_, i) => (
        <div key={i} style={{
          position:     "absolute",
          top:          "-20px",
          left:         `${Math.random() * 100}%`,
          width:        `${6 + Math.random() * 8}px`,
          height:       `${10 + Math.random() * 12}px`,
          background:   colors[Math.floor(Math.random() * colors.length)],
          borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          animation:    `confettiFall ${2 + Math.random() * 3}s ${Math.random() * 2}s linear forwards`,
          transform:    `rotate(${Math.random() * 360}deg)`,
        }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          to { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function DonatePage() {
  const { token, userName } = useAuth();
  const { requestId }       = useParams();
  const navigate            = useNavigate();
  const location            = useLocation();
  const params              = new URLSearchParams(location.search);

  // รับ donateItems = [{ key: "item_0", qty: 2 }, ...] จากหน้าโครงการ
  const donateItems   = location.state?.donateItems || [];
  const initialMethod = params.get("method") || "parcel";

  const [project,      setProject]      = useState(null);
  const [uniformItems, setUniformItems] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [donateMethod, setDonateMethod] = useState(initialMethod);

  // Step 2: Parcel
  const [courier,      setCourier]      = useState("");
  const [trackingNo,   setTrackingNo]   = useState("");
  const [proofImage,   setProofImage]   = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [donorName,    setDonorName]    = useState(userName || "");

  // Step 2: Drop-off
  const [appointDate, setAppointDate] = useState("");
  const [appointHour, setAppointHour] = useState("13");
  const [appointMin,  setAppointMin]  = useState("00");
  const [donorPhone,  setDonorPhone]  = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  // Certificate popup
  const [certData,  setCertData]  = useState(null);
  const [certPopup, setCertPopup] = useState(false);
  const [confetti,  setConfetti]  = useState(false);

  // ============ ฟังก์ชันบันทึกร่าง ============
  const handleSaveDraft = () => {
     if (!token) {
    alert("กรุณาเข้าสู่ระบบก่อนบันทึกร่าง");
    navigate("/login");
    return;
  }
    const draftData = {
      donorName,
      donateMethod,
      courier,
      trackingNo,
      appointDate,
      appointHour,
      appointMin,
      donorPhone,
      donateItems: location.state?.donateItems || [],
      requestId,
    };
    localStorage.setItem(`donateDraft_${requestId}`, JSON.stringify(draftData));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
    alert("บันทึกฉบับร่างแล้ว!");
  };

  // ============ ฟังก์ชันโหลดร่าง ============
  const loadDraft = () => {
    const savedDraft = localStorage.getItem(`donateDraft_${requestId}`);
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      setDonorName(draft.donorName);
      setDonateMethod(draft.donateMethod);
      setCourier(draft.courier);
      setTrackingNo(draft.trackingNo);
      setAppointDate(draft.appointDate);
      setAppointHour(draft.appointHour);
      setAppointMin(draft.appointMin);
      setDonorPhone(draft.donorPhone);
    }
  };

  // ============ useEffect เพื่อโหลดร่าง ============
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
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  // แปลง donateItems (key-based) กลับเป็น item objects พร้อม qty สำหรับ submit
  const selectedItems = donateItems
    .filter(d => d.qty > 0)
    .map(d => {
      const idx  = parseInt(d.key.replace("item_", ""), 10);
      const item = uniformItems[idx];
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
        fd.append("appoint_time", `${appointHour}:${appointMin}`);
      }

      const res  = await fetch(`${BASE}/donations/${requestId}`, {
        method:  "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "เกิดข้อผิดพลาด");

      // generate certificate
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
    if (!token) {
      return (
        <div className="navAuth">
          <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
          <Link className="navBtn navBtnWhite"   to="/login">เข้าสู่ระบบ</Link>
        </div>
      );
    }
    return <ProfileDropdown />;
  };

  if (loading) return (
    <div className="homePage">
      <div style={{ padding: "120px", textAlign: "center", color: "#888" }}>กำลังโหลด…</div>
    </div>
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
        {/* LEFT — project card + สรุปรายการ */}
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

          {/* สรุปรายการที่เลือกจากหน้าโครงการ */}
          {donateItems.some(d => d.qty > 0) && uniformItems.length > 0 && (
            <div className="dnSummaryCard">
              <div className="dnSummaryTitle">รายการที่เลือกบริจาค</div>
              {donateItems.filter(d => d.qty > 0).map(d => {
                const idx  = parseInt(d.key.replace("item_", ""), 10);
                const item = uniformItems[idx];
                if (!item) return null;
                return (
                  <div key={d.key} className="dnSummaryRow">
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

        {/* RIGHT — form */}
        <div className="dnRight">
        {localStorage.getItem(`donateDraft_${requestId}`) && (
  <div style={{
    background: "#fffbeb",
    border: "1.5px solid #FFBE1B",
    borderRadius: "10px",
    padding: "10px 16px",
    fontSize: "14px",
    color: "#92400e",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px"
  }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path fill="currentColor" d="M5 21h14c1.1 0 2-.9 2-2v-7h-2v7H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2"/>
    <path fill="currentColor" d="M7 13v3c0 .55.45 1 1 1h3c.27 0 .52-.11.71-.29l9-9a.996.996 0 0 0 0-1.41l-3-3a.996.996 0 0 0-1.41 0l-9.01 8.99A1 1 0 0 0 7 13m10-7.59L18.59 7L17.5 8.09L15.91 6.5zm-8 8l5.5-5.5l1.59 1.59l-5.5 5.5H9z"/>
  </svg>
  มีฉบับร่างที่บันทึกไว้ กรอกข้อมูลกลับมาให้แล้ว
</span>    <button onClick={() => {
      localStorage.removeItem(`donateDraft_${requestId}`);
      window.location.reload();
    }} style={{
      background: "none", border: "none", cursor: "pointer",
      fontSize: "12px", color: "#b45309", textDecoration: "underline" 
    }}>ล้างร่าง</button>
  </div>
)}
          <div className="dnMethodTabs">
            <button
              className={`dnMethodTab ${donateMethod === "parcel"  ? "dnMethodTabActive" : ""}`}
              onClick={() => setDonateMethod("parcel")}
            ><svg width="27" height="19" viewBox="0 0 27 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M27 13.3705C27 14.9249 25.6568 16.1852 24 16.1852H3C1.34325 16.1852 0 14.9249 0 13.3705V11.2594C0 9.7049 1.34325 8.44458 3 8.44458H24C25.6568 8.44458 27 9.7049 27 11.2594V13.3705Z" fill="#DD2E44"/>
<path d="M14.25 3.51852L13.5157 2.81482H5.3595C3 2.81482 2.25 4.22221 2.25 4.22221L0 8.41554V11.9629H14.25V3.51852Z" fill="#FFEEC3"/>
<path d="M6.74805 8.44459H1.49805L2.99805 5.6298C2.99805 5.6298 3.74805 4.22241 5.24805 4.22241H6.74805V8.44459Z" fill="#55ACEE"/>
<path d="M6.75 19.0001C8.40685 19.0001 9.75 17.7398 9.75 16.1853C9.75 14.6307 8.40685 13.3705 6.75 13.3705C5.09315 13.3705 3.75 14.6307 3.75 16.1853C3.75 17.7398 5.09315 19.0001 6.75 19.0001Z" fill="#292F33"/>
<path d="M6.75195 17.5924C7.58038 17.5924 8.25195 16.9623 8.25195 16.185C8.25195 15.4077 7.58038 14.7776 6.75195 14.7776C5.92353 14.7776 5.25195 15.4077 5.25195 16.185C5.25195 16.9623 5.92353 17.5924 6.75195 17.5924Z" fill="#CCD6DD"/>
<path d="M20.25 19.0001C21.9069 19.0001 23.25 17.7398 23.25 16.1853C23.25 14.6307 21.9069 13.3705 20.25 13.3705C18.5931 13.3705 17.25 14.6307 17.25 16.1853C17.25 17.7398 18.5931 19.0001 20.25 19.0001Z" fill="#292F33"/>
<path d="M20.252 17.5924C21.0804 17.5924 21.752 16.9623 21.752 16.185C21.752 15.4077 21.0804 14.7776 20.252 14.7776C19.4235 14.7776 18.752 15.4077 18.752 16.185C18.752 16.9623 19.4235 17.5924 20.252 17.5924Z" fill="#CCD6DD"/>
<path d="M24 0.00012207H12.75C11.0933 0.00012207 9.75 1.26044 9.75 2.81491V11.963H27V2.81491C27 1.26044 25.6568 0.00012207 24 0.00012207Z" fill="#CCD6DD"/>
</svg>
 จัดส่งพัสดุ</button>
            <button
              className={`dnMethodTab ${donateMethod === "dropoff" ? "dnMethodTabActive" : ""}`}
              onClick={() => setDonateMethod("dropoff")}
            ><svg width="27" height="29" viewBox="0 0 27 29" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.00195312 8.89917V18.9498C0.00195312 20.6083 1.05586 20.9672 1.05586 20.9672L12.2158 28.3572C13.9727 29.5202 13.5012 27.0715 13.5012 27.0715V17.8331L0.00195312 8.89917Z" fill="#662113"/>
<path d="M27 8.89917V18.9498C27 20.6083 25.975 20.9672 25.975 20.9672C25.975 20.9672 16.5574 27.1942 14.8015 28.3572C13.0437 29.5202 13.5008 27.0715 13.5008 27.0715V17.8331L27 8.89917Z" fill="#C1694F"/>
<path d="M14.7426 0.371569C14.0165 -0.123856 12.8257 -0.123856 12.0987 0.371569L0.545272 8.11076C-0.181757 8.60619 -0.181757 9.41592 0.545272 9.91054L12.1382 17.7448C12.8652 18.2394 14.0561 18.2394 14.7831 17.7448L26.4541 9.84231C27.1811 9.3477 27.1811 8.53796 26.4541 8.04254L14.7426 0.371569Z" fill="#D99E82"/>
<path d="M13.4994 28.9999C12.9671 28.9999 12.5352 28.6084 12.5352 28.1244V17.6254C12.5352 17.1413 12.9671 16.7499 13.4994 16.7499C14.0326 16.7499 14.4636 17.1413 14.4636 17.6254V28.1244C14.4636 28.6084 14.0326 28.9999 13.4994 28.9999Z" fill="#D99E82"/>
<path d="M23.1419 15.263C23.1419 16.1596 23.2422 16.5998 22.1777 17.2463L19.797 18.7716C18.7325 19.4189 18.3208 18.8633 18.3208 17.9659V15.561C18.3208 15.4043 18.2957 15.2362 18.0527 15.0672C15.5669 13.3414 5.915 6.88378 4.15625 5.69152L8.61581 2.70435C9.83653 3.45642 18.9842 9.40639 22.8112 11.9444C23.0012 12.0711 23.1419 12.2108 23.1419 12.3635V15.263Z" fill="#99AAB5"/>
<path d="M22.8102 11.9444C18.9842 9.40639 9.83653 3.45642 8.61581 2.70435L6.95637 3.8154L4.15625 5.69152C5.91597 6.88379 15.5669 13.3414 18.0527 15.0672C18.1983 15.1688 18.262 15.2703 18.2919 15.3686L23.0484 12.1475C22.9905 12.0768 22.9076 12.0086 22.8102 11.9444Z" fill="#CCD6DD"/>
<path d="M23.1422 15.263V12.3635C23.1422 12.2108 23.0014 12.0719 22.8105 11.9444C18.9844 9.40639 9.83675 3.45642 8.61604 2.70435L6.61719 4.04362C9.88882 6.21131 18.6517 11.9063 20.9456 13.4429C21.1925 13.6086 21.2137 13.7799 21.2137 13.9367V17.8644L22.1779 17.2463C23.2424 16.599 23.1422 16.1596 23.1422 15.263Z" fill="#CCD6DD"/>
<path d="M22.8105 11.9444C18.9844 9.40639 9.83675 3.45642 8.61604 2.70435L6.61719 4.04362C9.88882 6.21131 18.6517 11.9063 20.9456 13.4429C20.9813 13.4664 21.0035 13.4908 21.0295 13.5144L23.0486 12.1475C22.9908 12.0768 22.9078 12.0086 22.8105 11.9444Z" fill="#E1E8ED"/>
</svg>
 Drop-off</button>
          </div>

          {/* Parcel form */}
          {donateMethod === "parcel" && (
            <div className="dnStep">
              <button className="dnBackBtn" onClick={() => navigate(`/projects/${requestId}`)}><svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_2836_936)">
<path d="M3.78741 11.7637C3.59213 11.9591 3.48242 12.224 3.48242 12.5002C3.48242 12.7764 3.59213 13.0413 3.78741 13.2366L9.68012 19.1294C9.87658 19.3191 10.1397 19.4241 10.4128 19.4217C10.6859 19.4193 10.9472 19.3098 11.1403 19.1167C11.3335 18.9235 11.443 18.6623 11.4454 18.3891C11.4478 18.116 11.3428 17.8529 11.153 17.6564L7.03845 13.5419H20.8332C21.1095 13.5419 21.3745 13.4321 21.5698 13.2368C21.7652 13.0414 21.8749 12.7765 21.8749 12.5002C21.8749 12.2239 21.7652 11.959 21.5698 11.7636C21.3745 11.5683 21.1095 11.4585 20.8332 11.4585H7.03845L11.153 7.34394C11.3428 7.14748 11.4478 6.88435 11.4454 6.61123C11.443 6.33811 11.3335 6.07684 11.1403 5.88371C10.9472 5.69058 10.6859 5.58103 10.4128 5.57865C10.1397 5.57628 9.87658 5.68127 9.68012 5.87102L3.78741 11.7637Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_2836_936">
<rect width="25" height="25" fill="currentColor"/>
</clipPath>
</defs>
</svg>
 ย้อนกลับ</button>
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

          {/* Drop-off form */}
          {donateMethod === "dropoff" && (
            <div className="dnStep">
              <button className="dnBackBtn" onClick={() => navigate(`/projects/${requestId}`)}><svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_2836_936)">
<path d="M3.78741 11.7637C3.59213 11.9591 3.48242 12.224 3.48242 12.5002C3.48242 12.7764 3.59213 13.0413 3.78741 13.2366L9.68012 19.1294C9.87658 19.3191 10.1397 19.4241 10.4128 19.4217C10.6859 19.4193 10.9472 19.3098 11.1403 19.1167C11.3335 18.9235 11.443 18.6623 11.4454 18.3891C11.4478 18.116 11.3428 17.8529 11.153 17.6564L7.03845 13.5419H20.8332C21.1095 13.5419 21.3745 13.4321 21.5698 13.2368C21.7652 13.0414 21.8749 12.7765 21.8749 12.5002C21.8749 12.2239 21.7652 11.959 21.5698 11.7636C21.3745 11.5683 21.1095 11.4585 20.8332 11.4585H7.03845L11.153 7.34394C11.3428 7.14748 11.4478 6.88435 11.4454 6.61123C11.443 6.33811 11.3335 6.07684 11.1403 5.88371C10.9472 5.69058 10.6859 5.58103 10.4128 5.57865C10.1397 5.57628 9.87658 5.68127 9.68012 5.87102L3.78741 11.7637Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_2836_936">
<rect width="25" height="25" fill="currentColor"/>
</clipPath>
</defs>
</svg> ย้อนกลับ</button>
              <div className="dnStepTitle">เลือกวันและเวลานัดหมาย</div>
              <div className="dnInfoBox">
                <Icon icon="fluent:location-20-filled" width="20" color="#FFBE1B" />
                <div>
                  <div className="dnInfoLabel">สถานที่รับ</div>
                  <div className="dnInfoVal">{project?.school_name}</div>
                  <div className="dnInfoSub">{project?.school_full_address || project?.school_address}</div>
                </div>
              </div>
              <div className="dnFormGroup">
              <label className="dnLabel">วันที่ต้องการ</label>
              <div className="dnDateWrap">
                <input 
                  className="dnInput" 
                  type="date" 
                  value={appointDate}
                  onChange={e => setAppointDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  id="dnDateInput"
                />
                <label htmlFor="dnDateInput" className="dnDateIcon">
                  <Icon icon="fluent:calendar-20-filled" width="18" color="#fff" />
                </label>
              </div>
            </div>
              <div className="dnFormGroup">
                <label className="dnLabel">เวลา</label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <select className="dnSelect" style={{ flex: 1 }} value={appointHour}
                    onChange={e => setAppointHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) =>
                      <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}</option>)}
                  </select>
                  <select className="dnSelect" style={{ flex: 1 }} value={appointMin}
                    onChange={e => setAppointMin(e.target.value)}>
                    {Array.from({ length: 60 }, (_, i) =>
                      <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}</option>)}
                  </select>
                </div>
              </div>
              <div className="dnFormGroup">
                <label className="dnLabel">ข้อมูลติดต่อผู้บริจาค</label>
               <input
                  className="dnInput"
                  value={donorPhone}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, ""); // กรองเฉพาะตัวเลข
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

      {/* ── Certificate Popup ── */}
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
                <a href={certData.certificate_url} download="certificate.png"
                  className="certBtnDownload">⬇ ดาวน์โหลด PNG</a>
              )}
              {certData?.pdf_url && (
                <a href={certData.pdf_url} target="_blank" rel="noreferrer"
                  className="certBtnDownload certBtnPdf">⬇ ดาวน์โหลด PDF</a>
              )}
              <button className="certBtnClose"
                onClick={() => { setCertPopup(false); navigate(`/projects/${requestId}`); }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}