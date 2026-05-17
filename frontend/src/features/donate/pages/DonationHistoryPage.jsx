import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import Navbar from "../../../pages/Navbar.jsx";
import { QRLabelPage } from "../../project/pages/Donatepage.jsx";
import "../../../pages/styles/Homepage.css";
import "../../project/styles/Donatepage.css";
import "../styles/DonationHistoryPage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function formatThaiDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function isDropoffAppointmentPast(d) {
  if (d.delivery_method !== "dropoff" || !d.donation_date) return false;
  const dateStr = new Date(d.donation_date).toISOString().split("T")[0];
  const timeStr = d.donation_time ? String(d.donation_time).slice(0, 5) : "23:59";
  return new Date(`${dateStr}T${timeStr}:00`) < new Date();
}

function parseItems(snapshot) {
  if (!snapshot) return [];
  try { return typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot; }
  catch { return []; }
}

const CARRIERS = [
  { name: "ไปรษณีย์ไทย", logo: "/src/unieed_pic/ship1.png" },
  { name: "Flash Express", logo: "/src/unieed_pic/ship2.png" },
  { name: "J&T Express",  logo: "/src/unieed_pic/ship3.png" },
  { name: "Kerry Express", logo: "/src/unieed_pic/ship4.png" },
];

function CarrierSelect({ value, onChange }) {
  const selected = CARRIERS.find(c => c.name === value);
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      {selected && (
        <img
          src={selected.logo}
          alt={selected.name}
          style={{
            position: "absolute", left: 10, top: "50%",
            transform: "translateY(-50%)",
            height: 20, width: 48, objectFit: "contain",
            pointerEvents: "none", zIndex: 1,
          }}
        />
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px",
          textIndent: selected ? "52px" : "0px",
          borderRadius: 8, border: "1px solid #D1D5DB",
          fontSize: 13, background: "#fff",
          outline: "none", cursor: "pointer",
        }}
      >
        <option value="">— เลือกบริษัทขนส่ง —</option>
        {CARRIERS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
    </div>
  );
}

const STATUS_CONFIG = {
  pending:   { label: "รอยืนยัน",   bg: "#FEF3C7", color: "#D97706", icon: "mdi:clock-outline" },
  approved:  { label: "ยืนยันแล้ว", bg: "#D1FAE5", color: "#16a34a", icon: "mdi:check-circle-outline" },
  rejected:  { label: "ปฏิเสธ",     bg: "#FEE2E2", color: "#DC2626", icon: "mdi:close-circle-outline" },
  cancelled: { label: "ยกเลิกแล้ว", bg: "#F3F4F6", color: "#6b7280", icon: "mdi:cancel" },
};

const CONDITION_OVERRIDE = {
  wrong_item: { label: "รายการไม่ตรง", bg: "#FEF3C7", color: "#d97706", icon: "mdi:swap-horizontal" },
  damaged:    { label: "ชำรุด",        bg: "#FEE2E2", color: "#dc2626", icon: "mdi:alert-circle-outline" },
};

function getStatusConfig(d) {
  if (d.status === "approved" && CONDITION_OVERRIDE[d.condition_status]) {
    return CONDITION_OVERRIDE[d.condition_status];
  }
  return STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
}

export default function DonationHistoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [suspension, setSuspension] = useState(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealDone, setAppealDone] = useState(false);
  const [appealErr, setAppealErr] = useState("");
  const [appealViewOpen, setAppealViewOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [trackingInputs, setTrackingInputs] = useState({});
  const [courierInputs, setCourierInputs] = useState({});
  const [trackingSaving, setTrackingSaving] = useState({});
  const [trackingMsg, setTrackingMsg] = useState({});
  const [trackingEditing, setTrackingEditing] = useState({});
  const [slipDonation, setSlipDonation] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState("");
  const [previewImg, setPreviewImg] = useState(null); // { url, donationId, status }
  const [uploadingPic, setUploadingPic] = useState(false);
  const [activeTab, setActiveTab] = useState(location.state?.tab || "all");

  const handlePicChange = async (donationId, file) => {
    if (!file) return;
    setUploadingPic(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${BASE}/donations/${donationId}/pic`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `อัปโหลดไม่สำเร็จ (${res.status})`);
      }
      const data = await res.json();
      setDonations(prev => prev.map(d =>
        d.donation_id === donationId ? { ...d, donation_pic: data.donation_pic } : d
      ));
      setPreviewImg(p => p ? { ...p, url: data.donation_pic } : null);
    } catch (e) {
      alert(e.message);
    } finally {
      setUploadingPic(false);
    }
  };

  const saveTracking = async (donationId) => {
    const val = (trackingInputs[donationId] || "").trim();
    const carrier = (courierInputs[donationId] || "").trim() || null;
    if (!val) return;
    setTrackingSaving(p => ({ ...p, [donationId]: true }));
    try {
      const res = await fetch(`${BASE}/donations/${donationId}/tracking`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shipping_carrier: carrier, tracking_number: val }),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      setDonations(prev => prev.map(d =>
        d.donation_id === donationId ? { ...d, tracking_number: val, shipping_carrier: carrier } : d
      ));
      setTrackingMsg(p => ({ ...p, [donationId]: "บันทึกแล้ว ✓" }));
      setTrackingEditing(p => ({ ...p, [donationId]: false }));
    } catch (e) {
      setTrackingMsg(p => ({ ...p, [donationId]: e.message }));
    } finally {
      setTrackingSaving(p => ({ ...p, [donationId]: false }));
    }
  };

  const handleCancel = async () => {
    if (!cancelConfirm) return;
    setCancelling(true);
    setCancelErr("");
    try {
      const res = await fetch(`${BASE}/donations/${cancelConfirm}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setCancelErr(data.message || "เกิดข้อผิดพลาด"); return; }
      setDonations(prev => prev.filter(d => d.donation_id !== cancelConfirm));
      setCancelConfirm(null);
    } catch {
      setCancelErr("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setCancelling(false);
    }
  };

  const submitAppeal = async () => {
    if (!appealReason.trim()) return setAppealErr("กรุณาระบุเหตุผล");
    try {
      setAppealSubmitting(true);
      setAppealErr("");
      const res = await fetch(`${BASE}/donations/appeal-strike`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: appealReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return setAppealErr(data?.message || "ส่งไม่สำเร็จ");
      setAppealDone(true);
    } catch { setAppealErr("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setAppealSubmitting(false); }
  };

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    (async () => {
      try {
        setLoading(true);
        const [histRes, suspRes] = await Promise.all([
          fetch(`${BASE}/donations/my/history`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE}/donations/my-suspension`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!histRes.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const data = await histRes.json();
        setDonations(data);
        if (location.state?.scrollTo) {
          const targetId = location.state.scrollTo;
          setExpanded(targetId);
          setTimeout(() => {
            document.getElementById(`donation-${targetId}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
        if (suspRes.ok) {
          const suspData = await suspRes.json();
          if (suspData.is_suspended) setSuspension(suspData);
        }
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const filteredDonations = activeTab === "all"
    ? donations
    : donations.filter(d => d.delivery_method === activeTab);

  const tabCounts = {
    all:            donations.length,
    parcel:         donations.filter(d => d.delivery_method === "parcel").length,
    dropoff:        donations.filter(d => d.delivery_method === "dropoff").length,
    market_purchase:donations.filter(d => d.delivery_method === "market_purchase").length,
  };

  return (
    <div className="homePage">
      {/* Navbar */}
      <Navbar activeLink="" />

      <div style={{ background: "#87C7EB", height: 8, width: "100vw", marginLeft: "calc(-50vw + 50%)" }} />

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
            ประวัติการบริจาค
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            รายการบริจาคทั้งหมดของคุณ
          </div>
        </div>

        {/* Suspension Banner */}
        {suspension && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 24 }}>🚫</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#991b1b", marginBottom: 2 }}>
                บัญชีของคุณถูกระงับการบริจาคชั่วคราว
              </div>
              <div style={{ fontSize: 13, color: "#b91c1c" }}>
                ระงับถึง {new Date(suspension.suspended_until).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                {" · "}คำเตือน {suspension.strike_count}/3
              </div>
            </div>
            {(suspension.has_pending_appeal || appealDone) ? (
              <button
                onClick={() => setAppealViewOpen(true)}
                style={{ fontSize: 13, fontWeight: 600, color: "#92400e", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 18px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <Icon icon="mdi:clock-outline" width={15} />รอการตรวจสอบ
              </button>
            ) : (
              <button
                onClick={() => { setAppealOpen(true); setAppealDone(false); setAppealReason(""); setAppealErr(""); }}
                style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#2563eb", border: "none", borderRadius: 10, padding: "9px 18px", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 56 56" style={{ flexShrink: 0 }}><path fill="currentColor" d="M15.555 53.125h24.89c4.852 0 7.266-2.461 7.266-7.336V24.508c0-3.024-.328-4.336-2.203-6.258L32.57 5.102c-1.78-1.829-3.234-2.227-5.882-2.227H15.555c-4.828 0-7.266 2.484-7.266 7.36v35.554c0 4.898 2.438 7.336 7.266 7.336m.187-3.773c-2.414 0-3.68-1.29-3.68-3.633V10.305c0-2.32 1.266-3.657 3.704-3.657h10.406v13.618c0 2.953 1.5 4.406 4.406 4.406h13.36v21.047c0 2.343-1.243 3.633-3.68 3.633ZM31 21.132c-.914 0-1.29-.374-1.29-1.312V7.375l13.5 13.758Zm5.625 9.985h-17.79c-.843 0-1.452.633-1.452 1.43c0 .82.61 1.453 1.453 1.453h17.789a1.43 1.43 0 0 0 1.453-1.453c0-.797-.633-1.43-1.453-1.43m0 8.18h-17.79c-.843 0-1.452.656-1.452 1.476c0 .797.61 1.407 1.453 1.407h17.789c.82 0 1.453-.61 1.453-1.407c0-.82-.633-1.476-1.453-1.476"/></svg>
                ขอให้ทีมงานตรวจสอบ
              </button>
            )}
          </div>
        )}

        {/* Appeal Modal */}
        {appealOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setAppealOpen(false)}>
            <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420, overflow: "hidden" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ background: "#1d4ed8", padding: "20px 24px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center" }}><svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 56 56"><path fill="white" d="M15.555 53.125h24.89c4.852 0 7.266-2.461 7.266-7.336V24.508c0-3.024-.328-4.336-2.203-6.258L32.57 5.102c-1.78-1.829-3.234-2.227-5.882-2.227H15.555c-4.828 0-7.266 2.484-7.266 7.36v35.554c0 4.898 2.438 7.336 7.266 7.336m.187-3.773c-2.414 0-3.68-1.29-3.68-3.633V10.305c0-2.32 1.266-3.657 3.704-3.657h10.406v13.618c0 2.953 1.5 4.406 4.406 4.406h13.36v21.047c0 2.343-1.243 3.633-3.68 3.633ZM31 21.132c-.914 0-1.29-.374-1.29-1.312V7.375l13.5 13.758Zm5.625 9.985h-17.79c-.843 0-1.452.633-1.452 1.43c0 .82.61 1.453 1.453 1.453h17.789a1.43 1.43 0 0 0 1.453-1.453c0-.797-.633-1.43-1.453-1.43m0 8.18h-17.79c-.843 0-1.452.656-1.452 1.476c0 .797.61 1.407 1.453 1.407h17.789c.82 0 1.453-.61 1.453-1.407c0-.82-.633-1.476-1.453-1.476"/></svg></div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 4 }}>ขอให้ทีมงานตรวจสอบ</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>ชี้แจงเหตุผลเพื่อขอปลดล็อคการบริจาค</div>
              </div>
              <div style={{ padding: "20px 24px" }}>
                {appealDone ? (
                  <>
                    <div style={{ textAlign: "center", padding: "12px 0", fontSize: 14, color: "#16a34a" }}>
                      ✓ ส่งคำร้องเรียบร้อยแล้ว ทีมงานจะตรวจสอบและติดต่อกลับ
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                      <button onClick={() => setAppealOpen(false)} style={{ fontSize: 13, padding: "9px 24px", borderRadius: 10, border: "1px solid #e2e8f0", cursor: "pointer", background: "#f8fafc" }}>ปิด</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                      อธิบายเหตุผลที่คิดว่าการระงับนี้ไม่ถูกต้อง หรือสิ่งที่เกิดขึ้นจริง
                    </div>
                    <textarea
                      value={appealReason}
                      onChange={e => setAppealReason(e.target.value)}
                      rows={4}
                      placeholder="เช่น ของที่ส่งตรงตามที่โครงการระบุทุกอย่าง..."
                      style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", marginBottom: 8 }}
                    />
                    {appealErr && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{appealErr}</div>}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setAppealOpen(false)} disabled={appealSubmitting} style={{ fontSize: 13, padding: "9px 18px", borderRadius: 10, border: "1px solid #e2e8f0", cursor: "pointer", background: "#f8fafc" }}>ยกเลิก</button>
                      <button onClick={submitAppeal} disabled={appealSubmitting} style={{ fontSize: 13, fontWeight: 600, padding: "9px 18px", borderRadius: 10, border: "none", background: appealSubmitting ? "#94a3b8" : "#2563eb", color: "#fff", cursor: appealSubmitting ? "not-allowed" : "pointer" }}>
                        {appealSubmitting ? "กำลังส่ง..." : "ส่งคำร้อง"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appeal View Modal */}
        {appealViewOpen && createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setAppealViewOpen(false)}>
            <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 400, overflow: "hidden" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ background: "#1d4ed8", padding: "20px 24px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center" }}><svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 56 56"><path fill="white" d="M15.555 53.125h24.89c4.852 0 7.266-2.461 7.266-7.336V24.508c0-3.024-.328-4.336-2.203-6.258L32.57 5.102c-1.78-1.829-3.234-2.227-5.882-2.227H15.555c-4.828 0-7.266 2.484-7.266 7.36v35.554c0 4.898 2.438 7.336 7.266 7.336m.187-3.773c-2.414 0-3.68-1.29-3.68-3.633V10.305c0-2.32 1.266-3.657 3.704-3.657h10.406v13.618c0 2.953 1.5 4.406 4.406 4.406h13.36v21.047c0 2.343-1.243 3.633-3.68 3.633ZM31 21.132c-.914 0-1.29-.374-1.29-1.312V7.375l13.5 13.758Zm5.625 9.985h-17.79c-.843 0-1.452.633-1.452 1.43c0 .82.61 1.453 1.453 1.453h17.789a1.43 1.43 0 0 0 1.453-1.453c0-.797-.633-1.43-1.453-1.43m0 8.18h-17.79c-.843 0-1.452.656-1.452 1.476c0 .797.61 1.407 1.453 1.407h17.789c.82 0 1.453-.61 1.453-1.407c0-.82-.633-1.476-1.453-1.476"/></svg></div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 4 }}>คำร้องของคุณ</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>ข้อความที่ส่งให้ทีมงานตรวจสอบ</div>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", fontSize: 14, color: "#1e293b", lineHeight: 1.7, minHeight: 60, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {suspension?.appeal_reason || "(ไม่ได้ระบุเหตุผล)"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>
                  ทีมงานกำลังตรวจสอบคำร้องของคุณ จะติดต่อผ่านทางแจ้งเตือน
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                  <button onClick={() => setAppealViewOpen(false)} style={{ fontSize: 13, padding: "9px 28px", borderRadius: 10, border: "1px solid #e2e8f0", cursor: "pointer", background: "#f8fafc" }}>ปิด</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Tab bar */}
        {!loading && !err && donations.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { key: "all",            label: "ทั้งหมด",        icon: "mdi:format-list-bulleted" },
              { key: "parcel",         label: "พัสดุ",          icon: "mdi:truck-outline" },
              { key: "dropoff",        label: "Drop-off",       icon: "mdi:walk" },
              { key: "market_purchase",label: "ซื้อเพื่อบริจาค", icon: "mdi:shopping-outline" },
            ].map(tab => {
              const isActive = activeTab === tab.key;
              const count = tabCounts[tab.key];
              if (tab.key !== "all" && count === 0) return null;
              return (
                <button
                  key={tab.key}
                  className={`dhTabBtn${isActive ? " dhTabActive" : ""}`}
                  onClick={e => { e.currentTarget.blur(); setActiveTab(tab.key); }}
                >
                  <Icon icon={tab.icon} width="14" />
                  {tab.label}
                  <span className="dhTabBadge">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>
            <Icon icon="mdi:loading" width="36" color="#29B6E8"
              style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: 12 }}>กำลังโหลด...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {err && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 12, padding: "16px 20px",
            color: "#DC2626", fontSize: 14,
          }}>
            {err}
          </div>
        )}

        {/* Empty */}
        {!loading && !err && donations.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "#fff", borderRadius: 20,
            boxShadow: "0 2px 16px rgba(0,0,0,.06)",
          }}>
            <Icon icon="mdi:gift-outline" width="52" color="#D1D5DB" />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#6b7280", marginTop: 16 }}>
              ยังไม่มีประวัติการบริจาค
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>
              ร่วมส่งต่อชุดนักเรียนให้เด็กๆ ได้เลยครับ
            </div>
            <button
              onClick={() => navigate("/projects")}
              style={{
                marginTop: 20, padding: "10px 24px",
                background: "#29B6E8", color: "#fff",
                border: "none", borderRadius: 12,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              ดูโครงการทั้งหมด
            </button>
          </div>
        )}

        {/* Empty (filtered) */}
        {!loading && !err && donations.length > 0 && filteredDonations.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#9CA3AF", fontSize: 14 }}>
            ไม่มีรายการในหมวดนี้
          </div>
        )}

        {/* List */}
        {!loading && filteredDonations.map((d) => {
          const status = getStatusConfig(d);
          const items = parseItems(d.items_snapshot);
          const isOpen = expanded === d.donation_id;

          return (
            <div key={d.donation_id} id={`donation-${d.donation_id}`} style={{
              background: "#fff", borderRadius: 16,
              boxShadow: "0 2px 16px rgba(0,0,0,.06)",
              marginBottom: 16, overflow: "hidden",
              border: "1px solid #F3F4F6",
            }}>
              {/* Card Header */}
              <div
                onClick={() => setExpanded(isOpen ? null : d.donation_id)}
                style={{
                  padding: "16px 20px", cursor: "pointer",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12,
                }}
              >
                {/* รูปโครงการ */}
  <div style={{
    width: 56, height: 56, borderRadius: 12, flexShrink: 0,
    overflow: "hidden", background: "#F3F4F6",
  }}>
    {d.request_image_url
      ? <img src={d.request_image_url} alt={d.school_name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon icon="mdi:school-outline" width="28" color="#D1D5DB" />
        </div>
    }
  </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* โรงเรียน */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
                    {d.school_name || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {d.request_title}
                  </div>
                  {/* Meta */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    marginTop: 8, flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon icon="mdi:calendar-outline" width="14" />
                      {formatThaiDate(d.donation_date)}
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon icon="mdi:tshirt-crew-outline" width="14" />
                      {d.quantity} ชิ้น
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon icon={
                        d.delivery_method === "dropoff" ? "mdi:walk"
                        : d.delivery_method === "market_purchase" ? "mdi:shopping-outline"
                        : "mdi:truck-outline"
                      } width="14" />
                      {d.delivery_method === "dropoff" ? "Drop-off"
                        : d.delivery_method === "market_purchase" ? "ซื้อเพื่อบริจาค"
                        : "พัสดุ"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  {/* Status Badge */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: status.bg, color: status.color,
                    padding: "4px 12px", borderRadius: 20,
                    fontSize: 12, fontWeight: 600, flexShrink: 0,
                  }}>
                    <Icon icon={status.icon} width="14" />
                    {status.label}
                  </div>
                  {/* Certificate badge */}
                  {d.status === "approved" && d.condition_status !== "wrong_item" && (
                    <div style={{
                      fontSize: 11, color: "#FFBE1B", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                          <path d="M12 15a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/><path d="M13 17.5V22l2-1.5l2 1.5v-4.5"/><path d="M10 19H5a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-1 1.73M6 9h12M6 12h3m-3 3h2"/>
                        </g>
                      </svg>
                      มีใบเกียรติบัตร
                    </div>
                  )}
                  <Icon
                    icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                    width="20" color="#9ca3af"
                  />
                </div>
              </div>

              {/* Expanded Detail */}
              {isOpen && (
                <div style={{
                  borderTop: "1px solid #F3F4F6",
                  padding: "16px 20px",
                  background: "#F9FAFB",
                }}>
                  {/* รายการชุด */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    รายการชุดนักเรียน
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between",
                        background: "#fff", borderRadius: 8, padding: "8px 12px",
                        fontSize: 13,
                      }}>
                        <span style={{ color: "#1a1a2e" }}>{item.name}</span>
                        <span style={{
                          color: "#378ADD", fontWeight: 600,
                          background: "#EFF6FF", padding: "2px 10px", borderRadius: 20,
                        }}>
                          {item.quantity} ชิ้น
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ปุ่มใบสรุป + ยกเลิก (ซ่อนถ้า cancelled) */}
                  {d.status === "cancelled" ? null : <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <button
                      onClick={() => setSlipDonation(d)}
                      className="dnCloseBtn"
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "10px 18px", borderRadius: 10,
                        background: "#EFF6FF", color: "#378ADD",
                        border: "1.5px solid #BFDBFE", fontSize: 13,
                        fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <Icon icon="fluent:document-checkmark-20-filled" width="16" />
                      ใบสรุป / QR
                    </button>

                    {d.status === "pending" && !d.tracking_number && !isDropoffAppointmentPast(d) && (
                      <button
                        onClick={() => { setCancelConfirm(d.donation_id); setCancelErr(""); }}
                        className="dnCloseBtn"
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                          padding: "10px 18px", borderRadius: 10,
                          background: "#fff", color: "#DC2626",
                          border: "1.5px solid #FECACA", fontSize: 13,
                          fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <Icon icon="mdi:close-circle-outline" width="16" />
                        ยกเลิกรายการ
                      </button>
                    )}
                  </div>

                  {/* ข้อมูลการส่ง + ปุ่มแก้ไข */}
                  {d.delivery_method === "parcel" && d.tracking_number && !trackingEditing[d.donation_id] && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "#EFF6FF", borderRadius: 10, padding: "10px 14px",
                      fontSize: 13, color: "#1e40af",
                    }}>
                      <Icon icon="mdi:truck-outline" width="16" />
                      <span style={{ flex: 1 }}>{d.shipping_carrier} · <strong style={{ fontFamily: "monospace" }}>{d.tracking_number}</strong></span>
                      <button
                        onClick={() => {
                          setTrackingInputs(p => ({ ...p, [d.donation_id]: d.tracking_number }));
                          setTrackingEditing(p => ({ ...p, [d.donation_id]: true }));
                          setTrackingMsg(p => ({ ...p, [d.donation_id]: "" }));
                        }}
                        style={{
                          background: "none", border: "1px solid #93c5fd", borderRadius: 6,
                          color: "#3b82f6", fontSize: 11, fontWeight: 600,
                          padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        แก้ไข
                      </button>
                    </div>
                  )}

                  {/* กรอก / แก้ไขเลขพัสดุ */}
                  {d.delivery_method === "parcel" && d.status === "pending" && (!d.tracking_number || trackingEditing[d.donation_id]) && (
                    <div style={{
                      background: "#FFFBEB", border: "1px dashed #FCD34D",
                      borderRadius: 10, padding: "12px 14px", marginTop: 8,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon icon="mdi:truck-outline" width="14" />
                        {trackingEditing[d.donation_id] ? "แก้ไขข้อมูลการจัดส่ง" : "ยังไม่ได้กรอกข้อมูลการจัดส่ง"}
                      </div>

                      {/* เลือกบริษัทขนส่ง */}
                      <CarrierSelect
                        value={courierInputs[d.donation_id] ?? d.shipping_carrier ?? ""}
                        onChange={val => setCourierInputs(p => ({ ...p, [d.donation_id]: val }))}
                      />

                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className="dhTrackInput"
                          value={trackingInputs[d.donation_id] || ""}
                          onChange={e => setTrackingInputs(p => ({ ...p, [d.donation_id]: e.target.value }))}
                          placeholder="เช่น TH123456789"
                          style={{
                            flex: 1, padding: "8px 12px", borderRadius: 8,
                            border: "1px solid #D1D5DB", fontSize: 13,
                            fontFamily: "monospace",
                          }}
                        />
                        {trackingEditing[d.donation_id] && (
                          <button
                            onClick={() => setTrackingEditing(p => ({ ...p, [d.donation_id]: false }))}
                            style={{
                              padding: "8px 12px", borderRadius: 8,
                              background: "#F3F4F6", color: "#6b7280",
                              border: "none", fontSize: 13, cursor: "pointer",
                            }}
                          >
                            ยกเลิก
                          </button>
                        )}
                        <button
                          onClick={() => saveTracking(d.donation_id)}
                          disabled={trackingSaving[d.donation_id] || !trackingInputs[d.donation_id]?.trim()}
                          className="dnCloseBtn"
                          style={{
                            padding: "8px 16px", borderRadius: 8,
                            background: trackingSaving[d.donation_id] ? "#9CA3AF" : "#5285e8",
                            color: "#fff", border: "none", fontSize: 13,
                            fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {trackingSaving[d.donation_id] ? "..." : "บันทึก"}
                        </button>
                      </div>

                      {trackingMsg[d.donation_id] && (
                        <div style={{ fontSize: 12, marginTop: 6, color: trackingMsg[d.donation_id].includes("✓") ? "#16a34a" : "#DC2626" }}>
                          {trackingMsg[d.donation_id]}
                        </div>
                      )}
                    </div>
                  )}

                  {/* หลักฐาน drop-off — อัปโหลดได้ถ้า pending และยังไม่มีรูป */}
                  {d.delivery_method === "dropoff" && d.status === "pending" && !d.donation_pic && (
                    <div style={{
                      marginTop: 12,
                      background: "#FFFBEB", border: "1px dashed #FCD34D",
                      borderRadius: 10, padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon icon="mdi:camera-outline" width="14" />
                        อัปโหลดหลักฐานการส่งของ
                      </div>
                      <div style={{ fontSize: 12, color: "#92400e", marginBottom: 10, lineHeight: 1.5 }}>
                        ถ่ายรูปตอนส่งของ เช่น รูปกับครูที่รับ หรือรูปของที่วางไว้ที่โรงเรียน เพื่อให้แอดมินยืนยันได้เร็วขึ้น
                      </div>
                      <label style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "8px 16px", borderRadius: 8,
                        background: uploadingPic ? "#9CA3AF" : "#f97316",
                        color: "#fff", fontSize: 13, fontWeight: 600,
                        cursor: uploadingPic ? "not-allowed" : "pointer",
                      }}>
                        <Icon icon="mdi:upload-outline" width="16" />
                        {uploadingPic ? "กำลังอัปโหลด..." : "เลือกรูปภาพ"}
                        <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingPic}
                          onChange={e => handlePicChange(d.donation_id, e.target.files[0])} />
                      </label>
                    </div>
                  )}

                  {/* แนบรูปหลักฐาน (parcel) — แยกอิสระจาก tracking form */}
                  {d.delivery_method === "parcel" && d.status === "pending" && !d.donation_pic && (
                    <div style={{
                      marginTop: 12,
                      background: "#FFFBEB", border: "1px dashed #FCD34D",
                      borderRadius: 10, padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon icon="mdi:camera-outline" width="14" />
                        แนบรูปหลักฐานการส่ง <span style={{ fontWeight: 400 }}>(ไม่บังคับ)</span>
                      </div>
                      <label style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "8px 16px", borderRadius: 8,
                        background: uploadingPic ? "#9CA3AF" : "#f97316",
                        color: "#fff", fontSize: 13, fontWeight: 600,
                        cursor: uploadingPic ? "not-allowed" : "pointer",
                      }}>
                        <Icon icon="mdi:upload-outline" width="16" />
                        {uploadingPic ? "กำลังอัปโหลด..." : "เลือกรูปภาพ"}
                        <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingPic}
                          onChange={e => handlePicChange(d.donation_id, e.target.files[0])} />
                      </label>
                    </div>
                  )}

                  {/* หลักฐาน — แสดงรูปถ้ามี */}
                  {d.donation_pic && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>หลักฐานการจัดส่ง</div>
                      <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setPreviewImg({ url: d.donation_pic, donationId: d.donation_id, status: d.status })}>
                        <img
                          src={d.donation_pic}
                          alt="หลักฐาน"
                          style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, display: "block" }}
                        />
                        <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0}
                        >
                          <Icon icon="mdi:magnify-plus-outline" width="32" color="#fff" />
                        </div>
                      </div>
                    </div>
                  )}
                  </>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* QR Slip Modal */}
      {slipDonation && createPortal(
        <div
          onClick={() => setSlipDonation(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640 }}>
            <QRLabelPage
              donationId={slipDonation.donation_id}
              donorName={slipDonation.donor_name}
              projectTitle={slipDonation.request_title}
              schoolName={slipDonation.school_name}
              schoolAddress={slipDonation.school_address || ""}
              donateMethod={slipDonation.delivery_method}
              courier={slipDonation.shipping_carrier}
              trackingNo={slipDonation.tracking_number || ""}
              appointDate={slipDonation.donation_date || ""}
              appointTime={slipDonation.donation_time || ""}
              donorPhone={slipDonation.donor_phone || ""}
              selectedItems={parseItems(slipDonation.items_snapshot).map(it => ({
                name: it.name, qty: it.quantity,
              }))}
              totalQty={slipDonation.quantity}
              donationStatus={slipDonation.status}
              conditionStatus={slipDonation.condition_status}
              baseUrl={window.location.origin}
              onUpdateTracking={async (newTracking) => {
                await fetch(`${BASE}/donations/${slipDonation.donation_id}/tracking`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    shipping_carrier: slipDonation.shipping_carrier || null,
                    tracking_number: newTracking,
                  }),
                });
                setDonations(prev => prev.map(d =>
                  d.donation_id === slipDonation.donation_id
                    ? { ...d, tracking_number: newTracking } : d
                ));
                setSlipDonation(s => ({ ...s, tracking_number: newTracking }));
              }}
              onViewProject={null}
              onClose={() => setSlipDonation(null)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* ── Image Preview Modal ── */}
      {previewImg && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setPreviewImg(null)}
        >
          <div style={{ position: "relative", maxWidth: 560, width: "100%" }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImg(null)}
              className="dnCloseBtn"
              style={{ position: "absolute", top: -40, right: 0, background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
            >
              <Icon icon="mdi:close" width="20" /> ปิด
            </button>
            <img src={previewImg.url} alt="หลักฐาน" style={{ width: "100%", borderRadius: 12, display: "block", maxHeight: "70vh", objectFit: "contain" }} />
            {(previewImg.status === "pending" || previewImg.status === "local") && (
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginTop: 12, padding: "11px", borderRadius: 10,
                background: uploadingPic ? "#9CA3AF" : "#5285e8", color: "#fff",
                fontSize: 14, fontWeight: 600, cursor: uploadingPic ? "not-allowed" : "pointer",
              }}>
                <Icon icon="mdi:image-edit-outline" width="18" />
                {uploadingPic ? "กำลังอัปโหลด..." : "เปลี่ยนรูปหลักฐาน"}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingPic}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (previewImg.status === "local") {
                      setProofFiles(p => ({ ...p, [previewImg.donationId]: file }));
                      const url = URL.createObjectURL(file);
                      setProofPreviews(p => ({ ...p, [previewImg.donationId]: url }));
                      setPreviewImg(p => ({ ...p, url }));
                    } else {
                      handlePicChange(previewImg.donationId, file);
                    }
                  }} />
              </label>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Confirm dialog ยกเลิก ── */}
      {cancelConfirm && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 16,
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: 28,
            maxWidth: 380, width: "100%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>
              ยืนยันยกเลิกรายการ?
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 20 }}>
              รายการบริจาคนี้จะถูกยกเลิกและไม่สามารถเรียกคืนได้
            </div>
            {cancelErr && (
              <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", padding: "8px 12px", borderRadius: 8 }}>
                {cancelErr}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setCancelConfirm(null); setCancelErr(""); }}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: cancelling ? "#9CA3AF" : "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {cancelling ? "กำลังยกเลิก..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
