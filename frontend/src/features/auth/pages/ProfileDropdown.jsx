import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import { request } from "../../../api/http.js";
import "../styles/ProfileDropdown.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";
const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function localDateParts(dateStr) {
  const d = new Date(dateStr);
  return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate() };
}

function localDateISO(dateStr) {
  const { y, m, day } = localDateParts(dateStr);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fmtApptDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const { y, m, day } = localDateParts(dateStr);
  const date = `${day} ${TH_MONTHS[m]} ${y + 543}`;
  const time = timeStr ? String(timeStr).slice(0, 5) + " น." : "";
  return time ? `${date}, ${time}` : date;
}

function apptDaysLeft(dateStr, timeStr) {
  if (!dateStr) return null;
  const t = timeStr ? String(timeStr).slice(0, 5) : "23:59";
  const diff = new Date(`${localDateISO(dateStr)}T${t}:00`) - new Date();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days === 0 ? "วันนี้" : `อีก ${days} วัน`;
}

const ROLE_LABEL = {
  admin: "ผู้ดูแลระบบ",
  school_admin: "ผู้ดูแลโรงเรียน",
  user: "บุคคลทั่วไป",
};

// ── Avatar SVG 5 แบบ ─────────────────────────────────────────
const AVATARS = [
  (size = 40) => (
    <svg width={size} height={size} viewBox="0 0 136 136" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <circle cx="68" cy="68" r="68" fill="#F5EEF8"/>
      <rect x="18" y="100" width="100" height="60" fill="#7D3C98"/>
      <ellipse cx="28" cy="102" rx="24" ry="16" fill="#7D3C98"/>
      <ellipse cx="108" cy="102" rx="24" ry="16" fill="#7D3C98"/>
      <ellipse cx="68" cy="112" rx="15" ry="20" fill="#F0EDEA"/>
      <polygon points="68,90 57,120 68,120" fill="#7D3C98"/>
      <polygon points="68,90 79,120 68,120" fill="#7D3C98"/>
      <rect x="62" y="82" width="12" height="16" rx="5" fill="#FFCBA4"/>
      <circle cx="68" cy="60" r="30" fill="#FFCBA4"/>
      <ellipse cx="68" cy="38" rx="28" ry="18" fill="#C8922A"/>
      <ellipse cx="42" cy="48" rx="10" ry="16" fill="#C8922A"/>
      <ellipse cx="94" cy="48" rx="10" ry="16" fill="#C8922A"/>
      <rect x="64" y="12" width="8" height="20" rx="4" fill="#C8922A"/>
      <ellipse cx="60" cy="10" rx="10" ry="8" fill="#C8922A"/>
      <ellipse cx="76" cy="10" rx="10" ry="8" fill="#C8922A"/>
      <ellipse cx="68" cy="6" rx="12" ry="9" fill="#D4A030"/>
      <rect x="62" y="24" width="12" height="6" rx="3" fill="#9B6A10"/>
      <path d="M54 50 Q59 47 64 50" stroke="#8B5A10" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M72 50 Q77 47 82 50" stroke="#8B5A10" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <ellipse cx="58" cy="57" rx="5" ry="4.5" fill="#3D2010"/>
      <ellipse cx="78" cy="57" rx="5" ry="4.5" fill="#3D2010"/>
      <circle cx="59.5" cy="55.5" r="1.5" fill="white"/>
      <circle cx="79.5" cy="55.5" r="1.5" fill="white"/>
      <path d="M61 74 Q65 71 68 73 Q71 71 75 74" fill="#E07878"/>
      <path d="M61 74 Q68 81 75 74" fill="#C85858"/>
      <ellipse cx="49" cy="67" rx="7" ry="4" fill="#F4A0A0" opacity="0.4"/>
      <ellipse cx="87" cy="67" rx="7" ry="4" fill="#F4A0A0" opacity="0.4"/>
    </svg>
  ),
  (size = 40) => (
    <svg width={size} height={size} viewBox="0 0 136 136" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <circle cx="68" cy="68" r="68" fill="#E8EEF5"/>
      <rect x="18" y="104" width="100" height="60" fill="#1A3A6B"/>
      <ellipse cx="28" cy="106" rx="20" ry="12" fill="#1A3A6B"/>
      <ellipse cx="108" cy="106" rx="20" ry="12" fill="#1A3A6B"/>
      <ellipse cx="68" cy="118" rx="14" ry="22" fill="#E8EEF5"/>
      <polygon points="68,94 54,126 68,126" fill="#1A3A6B"/>
      <polygon points="68,94 82,126 68,126" fill="#1A3A6B"/>
      <rect x="62" y="86" width="14" height="18" rx="6" fill="#FFCBA4"/>
      <circle cx="68" cy="62" r="30" fill="#FFCBA4"/>
      <ellipse cx="68" cy="36" rx="32" ry="20" fill="#3E2A1A"/>
      <ellipse cx="68" cy="28" rx="26" ry="12" fill="#3E2A1A"/>
      <rect x="36" y="42" width="10" height="16" rx="5" fill="#3E2A1A"/>
      <rect x="90" y="42" width="10" height="16" rx="5" fill="#3E2A1A"/>
      <path d="M54 53 Q59 50 64 53" stroke="#5A3010" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M72 53 Q77 50 82 53" stroke="#5A3010" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <ellipse cx="58" cy="59" rx="5" ry="4.5" fill="#2C1808"/>
      <ellipse cx="78" cy="59" rx="5" ry="4.5" fill="#2C1808"/>
      <circle cx="59.5" cy="57.5" r="1.6" fill="white"/>
      <circle cx="79.5" cy="57.5" r="1.6" fill="white"/>
      <path d="M60 75 Q68 83 76 75" stroke="#C07050" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  (size = 40) => (
    <svg width={size} height={size} viewBox="0 0 136 136" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <circle cx="68" cy="68" r="68" fill="#E8F5F0"/>
      <rect x="18" y="104" width="100" height="60" fill="#1A6B5A"/>
      <ellipse cx="28" cy="106" rx="20" ry="12" fill="#1A6B5A"/>
      <ellipse cx="108" cy="106" rx="20" ry="12" fill="#1A6B5A"/>
      <ellipse cx="68" cy="118" rx="14" ry="22" fill="#E8F5F0"/>
      <polygon points="68,94 54,126 68,126" fill="#1A6B5A"/>
      <polygon points="68,94 82,126 68,126" fill="#1A6B5A"/>
      <rect x="38" y="40" width="14" height="75" rx="7" fill="#8B4513"/>
      <rect x="84" y="40" width="14" height="75" rx="7" fill="#8B4513"/>
      <rect x="62" y="86" width="12" height="18" rx="6" fill="#FDBCB4"/>
      <circle cx="68" cy="62" r="30" fill="#FDBCB4"/>
      <ellipse cx="68" cy="36" rx="30" ry="20" fill="#8B4513"/>
      <path d="M46 53 Q52 50 58 53" stroke="#6B3010" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M78 53 Q84 50 90 53" stroke="#6B3010" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <ellipse cx="58" cy="59" rx="6" ry="5.5" fill="#2C1808"/>
      <ellipse cx="78" cy="59" rx="6" ry="5.5" fill="#2C1808"/>
      <ellipse cx="58" cy="59" rx="4" ry="4" fill="#6B3A1F"/>
      <ellipse cx="78" cy="59" rx="4" ry="4" fill="#6B3A1F"/>
      <circle cx="58" cy="59" r="2.2" fill="#1A0800"/>
      <circle cx="78" cy="59" r="2.2" fill="#1A0800"/>
      <circle cx="59.5" cy="57.5" r="1.6" fill="white"/>
      <circle cx="79.5" cy="57.5" r="1.6" fill="white"/>
      <path d="M61 75 Q65 72 68 74 Q71 72 75 75" fill="#E88080"/>
      <path d="M61 75 Q68 82 75 75" fill="#D06060"/>
      <ellipse cx="50" cy="69" rx="7" ry="4" fill="#F4A0A0" opacity="0.4"/>
      <ellipse cx="86" cy="69" rx="7" ry="4" fill="#F4A0A0" opacity="0.4"/>
    </svg>
  ),
  (size = 40) => (
    <svg width={size} height={size} viewBox="0 0 136 136" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <circle cx="68" cy="68" r="68" fill="#FDF0E8"/>
      <rect x="18" y="104" width="100" height="60" fill="#B34A1A"/>
      <ellipse cx="28" cy="106" rx="20" ry="12" fill="#B34A1A"/>
      <ellipse cx="108" cy="106" rx="20" ry="12" fill="#B34A1A"/>
      <ellipse cx="68" cy="118" rx="14" ry="22" fill="#FDF0E8"/>
      <polygon points="68,94 54,126 68,126" fill="#B34A1A"/>
      <polygon points="68,94 82,126 68,126" fill="#B34A1A"/>
      <rect x="62" y="86" width="14" height="18" rx="6" fill="#FFCBA4"/>
      <circle cx="68" cy="62" r="30" fill="#FFCBA4"/>
      <ellipse cx="68" cy="36" rx="32" ry="20" fill="#1A1A1A"/>
      <ellipse cx="56" cy="34" rx="14" ry="10" fill="#1A1A1A"/>
      <rect x="44" y="54" width="16" height="12" rx="6" fill="none" stroke="#444" strokeWidth="2"/>
      <rect x="64" y="54" width="16" height="12" rx="6" fill="none" stroke="#444" strokeWidth="2"/>
      <line x1="60" y1="60" x2="64" y2="60" stroke="#444" strokeWidth="2"/>
      <line x1="44" y1="60" x2="40" y2="59" stroke="#444" strokeWidth="1.5"/>
      <line x1="80" y1="60" x2="84" y2="59" stroke="#444" strokeWidth="1.5"/>
      <ellipse cx="52" cy="60" rx="4" ry="3.5" fill="#2C1808"/>
      <ellipse cx="72" cy="60" rx="4" ry="3.5" fill="#2C1808"/>
      <circle cx="53.5" cy="58.5" r="1.4" fill="white"/>
      <circle cx="73.5" cy="58.5" r="1.4" fill="white"/>
      <path d="M56 53 Q60 50 64 53" stroke="#5A3010" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M64 53 Q68 50 72 53" stroke="#5A3010" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M60 76 Q68 84 76 76" stroke="#C07050" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  (size = 40) => (
    <svg width={size} height={size} viewBox="0 0 136 136" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <circle cx="68" cy="68" r="68" fill="#F5E8F0"/>
      <rect x="18" y="104" width="100" height="60" fill="#8B1A5A"/>
      <ellipse cx="28" cy="106" rx="20" ry="12" fill="#8B1A5A"/>
      <ellipse cx="108" cy="106" rx="20" ry="12" fill="#8B1A5A"/>
      <ellipse cx="68" cy="118" rx="14" ry="22" fill="#F5E8F0"/>
      <polygon points="68,94 54,126 68,126" fill="#8B1A5A"/>
      <polygon points="68,94 82,126 68,126" fill="#8B1A5A"/>
      <rect x="62" y="86" width="14" height="18" rx="6" fill="#FDBCB4"/>
      <circle cx="68" cy="62" r="30" fill="#FDBCB4"/>
      <ellipse cx="68" cy="36" rx="30" ry="20" fill="#C0392B"/>
      <ellipse cx="96" cy="32" rx="12" ry="8" fill="#C0392B"/>
      <ellipse cx="101" cy="46" rx="8" ry="20" fill="#C0392B"/>
      <ellipse cx="98" cy="66" rx="6" ry="12" fill="#C0392B"/>
      <path d="M54 53 Q58 50 62 53" stroke="#5A3010" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <path d="M74 53 Q78 50 82 53" stroke="#5A3010" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <ellipse cx="58" cy="59" rx="5" ry="4.5" fill="#2C1808"/>
      <ellipse cx="78" cy="59" rx="5" ry="4.5" fill="#2C1808"/>
      <circle cx="59.5" cy="57.5" r="1.6" fill="white"/>
      <circle cx="79.5" cy="57.5" r="1.6" fill="white"/>
      <path d="M61 75 Q65 72 68 74 Q71 72 75 75" fill="#E88080"/>
      <path d="M61 75 Q68 82 75 75" fill="#D06060"/>
      <ellipse cx="51" cy="68" rx="7" ry="4" fill="#F4A0A0" opacity="0.45"/>
      <ellipse cx="85" cy="68" rx="7" ry="4" fill="#F4A0A0" opacity="0.45"/>
    </svg>
  ),
];

// ── helpers ──────────────────────────────────────────────────
function getUserId(token) {
  try { return JSON.parse(atob(token.split(".")[1])).user_id; }
  catch { return null; }
}
function getUserEmail(token) {
  try { const p = JSON.parse(atob(token.split(".")[1])); return p.email || p.user_email || ""; }
  catch { return ""; }
}
function getDefaultAvatarIndex(userId) {
  const num = parseInt(String(userId).replace(/\D/g, ""), 10) || 0;
  return num % AVATARS.length;
}
function getAvatarIndex(userId) {
  if (!userId) return 0;
  const saved = localStorage.getItem(`avatar_${userId}`);
  if (saved !== null) return Number(saved);
  return getDefaultAvatarIndex(userId);
}

// ── AvatarCircle ─────────────────────────────────────────────
function AvatarCircle({ index, size = 40, border }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      overflow: "hidden", position: "relative", flexShrink: 0,
      border: border || "none",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {AVATARS[index](size)}
      </div>
    </div>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────
function EditProfileModal({ onClose, userId, email }) {
  const [selectedAvatar, setSelectedAvatar] = useState(() => getAvatarIndex(userId));
  const [success, setSuccess] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userId) localStorage.setItem(`avatar_${userId}`, selectedAvatar);
    setSuccess("บันทึกสำเร็จ!");
    setTimeout(onClose, 1000);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 420, background: "#fff",
        borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,.15)", overflow: "hidden",
      }}>
        <div style={{
          background: "#87c7eb", padding: "24px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AvatarCircle index={selectedAvatar} size={56} border="2px solid rgba(255,255,255,.6)"/>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>แก้ไขข้อมูลส่วนตัว</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 2 }}>
                {ROLE_LABEL["user"]}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#fff",
          padding: 4,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "color .15s",
          transform: "none",    // ← เพิ่ม
          outline: "none",      // ← เพิ่ม
        }}
          onMouseEnter={e => {
            e.currentTarget.style.color = "rgba(255,255,255,.5)";
            e.currentTarget.style.transform = "none";   // ← lock position
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.transform = "none";   // ← lock position
          }}
        >
          <Icon icon="mdi:close" width="24"/>
        </button>
        </div>

        <div style={{ padding: "24px 28px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>เลือก Avatar</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {AVATARS.map((_, i) => (
                <div key={i} onClick={() => setSelectedAvatar(i)} style={{
                  width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                  cursor: "pointer", overflow: "hidden", position: "relative",
                  border: selectedAvatar === i ? "3px solid #87c7eb" : "3px solid #E5E7EB",
                  boxShadow: selectedAvatar === i ? "0 0 0 2px rgba(41,182,232,.3)" : "none",
                  transition: "all .15s",
                }}>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {AVATARS[i](52)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                อีเมล <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>(ไม่สามารถเปลี่ยนได้)</span>
              </label>
              <div style={{ padding: "11px 14px", border: "1.5px solid #F3F4F6", borderRadius: 10, fontSize: 14, color: "#6b7280", background: "#F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{email || "—"}</span>
                <Icon icon="mdi:lock-outline" width="16" color="#9ca3af"/>
              </div>
            </div>
            {success && <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#16a34a", display: "flex", alignItems: "center", gap: 8 }}><Icon icon="mdi:check-circle" width="16"/>{success}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" onClick={onClose} className="pd-btn-static"
                onMouseEnter={e => e.currentTarget.style.background = "#E5E7EB"}
                onMouseLeave={e => e.currentTarget.style.background = "#F3F4F6"}
                style={{ flex: 1, padding: "12px", background: "#F3F4F6", color: "#1a1a2e", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ยกเลิก
              </button>
              <button type="submit" className="pd-btn-static"
                onMouseEnter={e => e.currentTarget.style.background = "#3a6fd8"}
                onMouseLeave={e => e.currentTarget.style.background = "#5285e8"}
                style={{ flex: 2, padding: "12px", background: "#5285e8", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                บันทึก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Manage Admins Modal ───────────────────────────────────────
function ManageAdminsModal({ onClose, currentUserId }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);
  const [pendingSetPrimary, setPendingSetPrimary] = useState(null);
  const [setPrimaryLoading, setSetPrimaryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await request("/auth/school-admins", { auth: true });
        setAdmins(data);
      } catch { setErr("โหลดข้อมูลไม่สำเร็จ"); }
      finally { setLoading(false); }
    })();
  }, []);

  // handleAdd ใหม่
const handleAdd = async (e) => {
  e.preventDefault();
  setErr(""); setSuccess("");
  if (!newEmail.trim()) return setErr("กรุณากรอกอีเมล");
  try {
    setAddLoading(true);
    await request("/auth/school-admins/invite", {
      method: "POST",
      body: { user_email: newEmail.trim() },
      auth: true,
    });
    setNewEmail("");
    setShowAdd(false);
    setSuccess("ส่งคำเชิญสำเร็จ! ผู้ดูแลจะได้รับอีเมลเชิญ");
    setTimeout(() => setSuccess(""), 5000);
  } catch (e) {
    setErr(e?.message || "เกิดข้อผิดพลาด");
  } finally { setAddLoading(false); }
};

  const handleRemove = async (userId, name) => {
    setPendingRemove({ userId, name });
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    try {
      await request(`/auth/school-admins/${pendingRemove.userId}`, { method: "DELETE", auth: true });
      setAdmins(prev => prev.filter(a => a.user_id !== pendingRemove.userId));
      setPendingRemove(null);
    } catch (e) { setErr(e?.message || "ลบไม่สำเร็จ"); setPendingRemove(null); }
  };

  const confirmSetPrimary = async () => {
    if (!pendingSetPrimary || setPrimaryLoading) return;
    try {
      setSetPrimaryLoading(true);
      await request(`/auth/school-admins/${pendingSetPrimary.userId}/set-primary`, { method: "PATCH", auth: true });
      const data = await request("/auth/school-admins", { auth: true });
      setAdmins(data);
      setSuccess(`โอนตำแหน่งแอดมินหลักให้ "${pendingSetPrimary.name}" สำเร็จ`);
      setTimeout(() => setSuccess(""), 5000);
      setPendingSetPrimary(null);
    } catch (e) { setErr(e?.message || "โอนตำแหน่งไม่สำเร็จ"); setPendingSetPrimary(null); }
    finally { setSetPrimaryLoading(false); }
  };

  const iAmPrimary = admins.length > 0 && Number(admins[0].user_id) === Number(currentUserId);

  return (
    <>
      <style>{`.ph-gray::placeholder { color: #B0BEC5 !important; opacity: 1 !important; }`}</style>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 20,
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, background: "#fff", borderRadius: 24,
        boxShadow: "0 8px 40px rgba(0,0,0,.15)", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: "#87c7eb", padding: "24px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid rgba(255,255,255,.5)",
            }}>
              <Icon icon="mdi:account-group" width="24" color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>จัดการผู้ดูแลโรงเรียน</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 2 }}>{admins.length} คน</div>
            </div>
          </div>
          <button onClick={onClose} className="pd-btn-static" style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#fff",
            padding: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color .15s",
            outline: "none",
          }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,.5)"}
            onMouseLeave={e => e.currentTarget.style.color = "#fff"}
          >
            <Icon icon="mdi:close" width="24"/>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 28px", flex: 1, overflowY: "auto", maxHeight: "70vh" }}>
          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Icon icon="mdi:alert-circle" width="16"/>{err}
            </div>
          )}
          {success && (
            <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#16a34a", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Icon icon="mdi:check-circle" width="16"/>{success}
            </div>
          )}

          {/* รายชื่อ */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>ผู้ดูแลทั้งหมด</div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>กำลังโหลด...</div>
            ) : admins.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>ไม่พบผู้ดูแล</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {admins.map((a, index) => (
  <div key={a.user_id} style={{
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", background: "#F9FAFB",
    borderRadius: 12, border: "1px solid #F3F4F6",
  }}>
    <AvatarCircle index={getAvatarIndex(a.user_id)} size={40} border="2px solid #E5E7EB"/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {a.user_name}
        {/* badge แอดมินหลัก / แอดมิน 1 2 3... */}
        <span style={{
          fontSize: 11, borderRadius: 6, padding: "2px 8px",
          background: index === 0 ? "#FFF7E6" : "#DBEAFE",
          color: index === 0 ? "#B45309" : "#5285e8",
        }}>
          {index === 0 ? "แอดมิน 1 (หลัก)" : `แอดมิน ${index + 1}`}
        </span>
        {/* badge คุณ */}
        {Number(a.user_id) === Number(currentUserId) && (
          <span style={{ fontSize: 11, color: "#87C7EB", background: "#EFF6FF", borderRadius: 6, padding: "2px 8px" }}>คุณ</span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{a.user_email}</div>
    </div>
    {Number(a.user_id) !== Number(currentUserId) && index !== 0 && (
  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
    {iAmPrimary && (
      <button onClick={() => setPendingSetPrimary({ userId: a.user_id, name: a.user_name })} title="ตั้งเป็นแอดมินหลัก" style={{
        background: "#FFFBEB", border: "none", borderRadius: 8,
        padding: "7px", cursor: "pointer", color: "#B45309",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon icon="mdi:crown-outline" width="18"/>
      </button>
    )}
    <button onClick={() => handleRemove(a.user_id, a.user_name)} style={{
      background: "#FEF2F2", border: "none", borderRadius: 8,
      padding: "7px", cursor: "pointer", color: "#DC2626",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon icon="mdi:trash-can-outline" width="18"/>
    </button>
  </div>
)}
  </div>
))}
              </div>
            )}
          </div>

          {/* ฟอร์มเพิ่ม */}
          {/* ฟอร์มใหม่ — แค่ช่องอีเมล */}
{showAdd ? (
  <div style={{ background: "#F0F9FF", borderRadius: 14, border: "1.5px solid #BAE6FD", padding: "18px" }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>เชิญผู้ดูแลใหม่</div>
    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
      ระบบจะส่งลิงก์เชิญไปยังอีเมลที่ระบุ ผู้รับสามารถตั้งชื่อและรหัสผ่านเองได้
    </div>
    <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`.adm-ph::placeholder{color:#B0BEC5;}`}</style>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>อีเมลผู้ดูแล</label>
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
          placeholder="teacher@school.ac.th" type="email"
          className="adm-ph"
          style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}
          onFocus={e => e.target.style.borderColor = "#87c7eb"}
          onBlur={e => e.target.style.borderColor = "#E5E7EB"}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => { setShowAdd(false); setErr(""); }}
          className="pd-btn-static"
          onMouseEnter={e => e.currentTarget.style.background = "#E5E7EB"}
          onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          style={{ flex: 1, padding: "10px", background: "#fff", color: "#1a1a2e", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ยกเลิก
        </button>
        <button type="submit" disabled={addLoading}
          className="pd-btn-static"
          onMouseEnter={e => { if (!addLoading) e.currentTarget.style.background = "#3a6fd8"; }}
          onMouseLeave={e => { if (!addLoading) e.currentTarget.style.background = "#5285e8"; }}
          style={{ flex: 2, padding: "10px", background: "#5285e8", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: addLoading ? "not-allowed" : "pointer", opacity: addLoading ? 0.7 : 1 }}>
          {addLoading ? "กำลังส่ง..." : "ส่งคำเชิญ"}
        </button>
      </div>
    </form>
  </div>
) : (
  <button
    onClick={() => { setShowAdd(true); setErr(""); setSuccess(""); }}
    className="add-admin-btn"
  >
    <Icon icon="mdi:plus" width="18"/>เพิ่มผู้ดูแลใหม่
  </button>
)}
        </div>
      </div>
    </div>

    {/* ── Confirm โอนตำแหน่งแอดมินหลัก ── */}
    {pendingSetPrimary && (
      <div onClick={() => { if (!setPrimaryLoading) setPendingSetPrimary(null); }} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10000, padding: 20,
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "#fff", borderRadius: 16, padding: 28,
          maxWidth: 380, width: "100%",
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon icon="mdi:crown" width="22" color="#B45309"/>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a2e" }}>โอนตำแหน่งแอดมินหลัก?</div>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 20 }}>
            <strong style={{ color: "#1a1a2e" }}>"{pendingSetPrimary.name}"</strong> จะกลายเป็นแอดมินหลักของโรงเรียน
            <br/>คุณจะกลายเป็นแอดมินรองและไม่สามารถโอนตำแหน่งคืนเองได้
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setPendingSetPrimary(null)}
              disabled={setPrimaryLoading}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              ยกเลิก
            </button>
            <button
              onClick={confirmSetPrimary}
              disabled={setPrimaryLoading}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#B45309", color: "#fff", fontSize: 13, fontWeight: 700, cursor: setPrimaryLoading ? "not-allowed" : "pointer", opacity: setPrimaryLoading ? 0.7 : 1 }}
            >
              {setPrimaryLoading ? "กำลังโอน..." : "ยืนยันโอนตำแหน่ง"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Confirm ลบผู้ดูแล ── */}
    {pendingRemove && (
      <div onClick={() => setPendingRemove(null)} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10000, padding: 20,
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "#fff", borderRadius: 16, padding: 28,
          maxWidth: 360, width: "100%",
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>
            ลบผู้ดูแลออกจากระบบ?
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 20 }}>
            ผู้ดูแล <strong style={{ color: "#1a1a2e" }}>"{pendingRemove.name}"</strong> จะถูกลบออกจากระบบและไม่สามารถเข้าใช้งานได้อีก
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setPendingRemove(null)}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              ยกเลิก
            </button>
            <button
              onClick={confirmRemove}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              ลบออก
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── Main Dropdown ─────────────────────────────────────────────
export default function ProfileDropdown() {
  const { userName, userEmail, role, logout, token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [openDonate, setOpenDonate] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);
  const [noListingMsg, setNoListingMsg] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [apptLoading, setApptLoading] = useState(false);
  const ref = useRef(null);

  const userId = getUserId(token);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!openDonate || !token) return;
    setApptLoading(true);
    fetch(`${BASE}/donations/my/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const upcoming = (Array.isArray(data) ? data : [])
          .filter(d => d.delivery_method === "dropoff" && d.status === "pending")
          .filter(d => {
            if (!d.donation_date) return true;
            const t = d.donation_time ? String(d.donation_time).slice(0, 5) : "23:59";
            return new Date(`${localDateISO(d.donation_date)}T${t}:00`) > new Date();
          })
          .sort((a, b) => new Date(a.donation_date) - new Date(b.donation_date));
        setAppointments(upcoming);
      })
      .catch(() => {})
      .finally(() => setApptLoading(false));
  }, [openDonate, token]);

  const handleLogout = () => { setOpen(false); logout(); navigate("/"); };
  const handleNavigate = (path, state) => { setOpen(false); navigate(path, state ? { state } : undefined); };
  const handleModalClose = () => { setShowEditModal(false); setAvatarKey(k => k + 1); };
  const handleManageListings = async () => {
    setOpen(false);
    try {
      const sellerData = await request("/seller/dashboard", { auth: true });
      if (sellerData?.is_seller) {
        navigate("/seller");
        return;
      }
      setNoListingMsg(sellerData?.message || "ยังไม่มีรายการขายของท่าน");
    } catch (e) {
      setNoListingMsg(e?.data?.message || "ยังไม่มีรายการขายของท่าน");
    }
  };

  return (
    <>
      {showEditModal && <EditProfileModal onClose={handleModalClose} userId={userId} email={userEmail}/>}
      {showAdminModal && <ManageAdminsModal onClose={() => setShowAdminModal(false)} currentUserId={userId}/>}

      {noListingMsg && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setNoListingMsg("")}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: "32px 28px 24px",
            maxWidth: 360, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            textAlign: "center",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon icon="mdi:store-off-outline" width={32} color="#f97316" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>
                ยังไม่มีรายการขาย
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
                {noListingMsg}
              </div>
            </div>
            <button
              onClick={() => setNoListingMsg("")}
              style={{
                width: "100%", height: 44, borderRadius: 12,
                background: "#1d4ed8",
                color: "#fff", border: "none", fontSize: 15, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      <div className="pd-outer" ref={ref}>
        <div className="pd-wrap">
          <div className="pd-trigger" onClick={() => setOpen(o => !o)}>
            <div className="pd-avatar" style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {AVATARS[getAvatarIndex(userId)](38)}
              </div>
            </div>
            <div className="pd-info">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="pd-name">{userName || "ผู้ใช้"}</div>
                <div className={`pd-chevron ${open ? "pd-chevron--open" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div className="pd-role">{ROLE_LABEL[role] ?? "บุคคลทั่วไป"}</div>
            </div>
          </div>

          {open && (
            <div className="pd-menu">
              {role === "school_admin" && (
                <>
                  <div className="pd-item" onClick={() => handleNavigate("/school/welcome")}>
                    <span className="pd-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </span>
                    <span className="pd-item-label">หน้าหลักโรงเรียน</span>
                  </div>
                  <div className="pd-item" onClick={() => { setOpen(false); setShowEditModal(true); }}>
                    <span className="pd-item-icon"><Icon icon="mdi:account-edit-outline" width="18"/></span>
                    <span className="pd-item-label">แก้ไขข้อมูลส่วนตัว</span>
                  </div>
                  <div className="pd-item" onClick={() => { setOpen(false); setShowAdminModal(true); }}>
                    <span className="pd-item-icon"><Icon icon="mdi:account-group-outline" width="18"/></span>
                    <span className="pd-item-label">จัดการผู้ดูแลโรงเรียน</span>
                  </div>
                  <div className="pd-divider"/>
                </>
              )}

              {role === "admin" && (
                <>
                  <div className="pd-item" onClick={() => handleNavigate("/admin/backoffice")}>
                    <span className="pd-item-icon"><Icon icon="material-symbols:dashboard-rounded" width="18"/></span>
                    <span className="pd-item-label">แดชบอร์ดผู้ดูแลระบบ</span>
                  </div>
                  <div className="pd-divider"/>
                </>
              )}

              {role !== "admin" && role !== "school_admin" && (
                <>
                  <div className="pd-item pd-item--expand" onClick={() => setOpenAccount(o => !o)}>
                    <span className="pd-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <span className="pd-item-label">บัญชีของฉัน</span>
                    <span className={`pd-sub-arrow ${openAccount ? "pd-sub-arrow--open" : ""}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                  {openAccount && (
                    <div className="pd-sub">
                      <div className="pd-sub-item" onClick={() => { setOpen(false); setShowEditModal(true); }}>
                        <span className="pd-sub-dot"/>แก้ไขข้อมูลส่วนตัว
                      </div>
                      <div className="pd-sub-item" onClick={() => handleNavigate("/profile/certificates")}>
                        <span className="pd-sub-dot"/>ประกาศนียบัตร
                      </div>
                    </div>
                  )}

                  <div className="pd-item pd-item--expand" onClick={() => setOpenDonate(o => !o)}>
                    <span className="pd-item-icon"><Icon icon="mdi:gift-outline" width="18"/></span>
                    <span className="pd-item-label">รายการบริจาคของฉัน</span>
                    <span className={`pd-sub-arrow ${openDonate ? "pd-sub-arrow--open" : ""}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                  {openDonate && (
                    <div className="pd-sub">
                      <div className="pd-sub-item" onClick={() => handleNavigate("/donations/history")}>
                        <span className="pd-sub-dot"/>ประวัติการบริจาค
                      </div>

                      {/* ── นัดหมาย Drop-off ── */}
                      <div className="pd-appt-section">
                        <div className="pd-appt-label">
                          <Icon icon="mdi:walk" width={13} />
                          นัดหมาย Drop-off
                        </div>
                        {apptLoading && (
                          <div className="pd-appt-loading">
                            <Icon icon="mdi:loading" width={14} className="pd-appt-spin" />
                            กำลังโหลด...
                          </div>
                        )}
                        {!apptLoading && appointments.length === 0 && (
                          <div className="pd-appt-empty">ไม่มีนัดหมายที่รอดำเนินการ</div>
                        )}
                        {!apptLoading && appointments.map(d => {
                          const days = apptDaysLeft(d.donation_date, d.donation_time);
                          const dateLabel = fmtApptDate(d.donation_date, d.donation_time);
                          return (
                            <div
                              key={d.donation_id}
                              className="pd-appt-card"
                              onClick={() => handleNavigate("/donations/history", { tab: "dropoff", scrollTo: d.donation_id })}
                            >
                              <div className="pd-appt-school">{d.school_name}</div>
                              <div className="pd-appt-meta">
                                <Icon icon="mdi:calendar-outline" width={12} />
                                <span>{dateLabel || "ยังไม่ระบุวัน"}</span>
                                {days !== null && (
                                  <span className="pd-appt-days">{days}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}

                  <div className="pd-item" onClick={() => handleNavigate("/orders")}>
                    <span className="pd-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </span>
                    <span className="pd-item-label">จัดการคำสั่งซื้อ</span>
                  </div>

                  <div className="pd-item" onClick={handleManageListings}>
                    <span className="pd-item-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <span className="pd-item-label">จัดการรายการขาย</span>
                  </div>
                </>
              )}

              <div className="pd-divider"/>

              <div className="pd-item pd-item--logout" onClick={handleLogout}>
                <span className="pd-item-icon pd-item-icon--red">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
                <span className="pd-item-label pd-item-label--red">ออกจากระบบ</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}