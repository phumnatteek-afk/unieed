import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import { request } from "../../../api/http.js";
import "../styles/ProfileDropdown.css";

const ROLE_LABEL = {
  admin: "ผู้ดูแลระบบ",
  school_admin: "ผู้ดูแลโรงเรียน",
  user: "บุคคลทั่วไป",
};

// ── Edit Profile Modal ──────────────────────────────────────
function EditProfileModal({ onClose }) {
  const { userName, updateUserName } = useAuth();
  const [name, setName] = useState(userName || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setSuccess("");
    if (!name.trim()) return setErr("กรุณากรอกชื่อ");
    try {
      setLoading(true);
      const res = await request("/auth/profile", {
        method: "PATCH",
        body: { user_name: name.trim() },
        auth: true,
      });
      updateUserName(res.user_name);
      setSuccess("บันทึกสำเร็จ!");
      setTimeout(onClose, 1000);
    } catch (e) {
      setErr(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Overlay
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 20,
      }}
    >
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          background: "#fff", borderRadius: 24,
          boxShadow: "0 8px 40px rgba(0,0,0,.15)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          background: "#29B6E8", padding: "24px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid rgba(255,255,255,.5)",
            }}>
              <Icon icon="fluent:person-28-filled" width="32" color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                แก้ไขข้อมูลส่วนตัว
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 2 }}>
                {ROLE_LABEL["user"]}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.2)", border: "none",
              borderRadius: "50%", width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <Icon icon="mdi:close" width="18" />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "24px 28px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ชื่อ */}
            <div>
              <label style={{
                fontSize: 13, fontWeight: 600, color: "#374151",
                display: "block", marginBottom: 6,
              }}>
                ชื่อผู้ใช้
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                style={{
                  width: "100%", padding: "11px 14px",
                  border: "1.5px solid #E5E7EB", borderRadius: 10,
                  fontSize: 14, color: "#1a1a2e", outline: "none",
                  boxSizing: "border-box", background: "#F9FAFB",
                }}
                onFocus={e => e.target.style.borderColor = "#29B6E8"}
                onBlur={e => e.target.style.borderColor = "#E5E7EB"}
              />
            </div>

            {/* อีเมล */}
            <div>
              <label style={{
                fontSize: 13, fontWeight: 600, color: "#374151",
                display: "block", marginBottom: 6,
              }}>
                อีเมล
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>
                  (ไม่สามารถเปลี่ยนได้)
                </span>
              </label>
              <div style={{
                padding: "11px 14px", border: "1.5px solid #F3F4F6",
                borderRadius: 10, fontSize: 14, color: "#9ca3af",
                background: "#F3F4F6", display: "flex",
                justifyContent: "space-between", alignItems: "center",
              }}>
                <span>—</span>
                <Icon icon="mdi:lock-outline" width="16" color="#9ca3af" />
              </div>
            </div>

            {/* Error / Success */}
            {err && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 13, color: "#dc2626",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Icon icon="mdi:alert-circle" width="16" />{err}
              </div>
            )}
            {success && (
              <div style={{
                background: "#F0FDF4", border: "1px solid #86EFAC",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 13, color: "#16a34a",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Icon icon="mdi:check-circle" width="16" />{success}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: "12px", background: "#F3F4F6",
                  color: "#1a1a2e", border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2, padding: "12px", background: "#29B6E8",
                  color: "#fff", border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Dropdown ───────────────────────────────────────────
export default function ProfileDropdown() {
  const { userName, role, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [openDonate, setOpenDonate] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // ← เพิ่ม
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => { setOpen(false); logout(); navigate("/"); };
  const handleNavigate = (path) => { setOpen(false); navigate(path); };

  return (
    <>
      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfileModal onClose={() => setShowEditModal(false)} />
      )}

      <div className="pd-outer" ref={ref}>
        <div className="pd-wrap">
          {/* Trigger */}
          <div className="pd-trigger" onClick={() => setOpen((o) => !o)}>
            <div className="pd-avatar">
              <Icon icon="fluent:person-circle-28-filled" width="38" height="38" color="#fff" />
            </div>
            <div className="pd-info">
              <div className="pd-name">{userName || "ผู้ใช้"}</div>
              <div className="pd-role">{ROLE_LABEL[role] ?? "บุคคลทั่วไป"}</div>
            </div>
            <div className={`pd-chevron ${open ? "pd-chevron--open" : ""}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Dropdown */}
          {open && (
            <div className="pd-menu">
              {/* school_admin */}
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
                  <div className="pd-divider" />
                </>
              )}

              {/* admin */}
              {role === "admin" && (
                <>
                  <div className="pd-item" onClick={() => handleNavigate("/admin/backoffice")}>
                    <span className="pd-item-icon">
                      <Icon icon="material-symbols:dashboard-rounded" width="18" />
                    </span>
                    <span className="pd-item-label">แดชบอร์ดผู้ดูแลระบบ</span>
                  </div>
                  <div className="pd-divider" />
                </>
              )}

              {/* user */}
              {role !== "admin" && role !== "school_admin" && (
                <>
                  {/* บัญชีของฉัน */}
                  <div className="pd-item pd-item--expand" onClick={() => setOpenAccount((o) => !o)}>
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
                      {/* ← เปลี่ยนจาก navigate เป็นเปิด modal */}
                      <div className="pd-sub-item" onClick={() => { setOpen(false); setShowEditModal(true); }}>
                        <span className="pd-sub-dot" />แก้ไขข้อมูลส่วนตัว
                      </div>
                      <div className="pd-sub-item" onClick={() => handleNavigate("/profile/certificates")}>
                        <span className="pd-sub-dot" />ประกาศนียบัตร
                      </div>
                    </div>
                  )}

                  {/* รายการบริจาค */}
                  <div className="pd-item pd-item--expand" onClick={() => setOpenDonate((o) => !o)}>
                    <span className="pd-item-icon">
                      <Icon icon="mdi:gift-outline" width="18" />
                    </span>
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
                        <span className="pd-sub-dot" />ประวัติการบริจาค
                      </div>
                      <div className="pd-sub-item" onClick={() => handleNavigate("/donations/tracking")}>
                        <span className="pd-sub-dot" />ติดตามสถานะการนัดหมาย
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

                  <div className="pd-item" onClick={() => handleNavigate("/my-listings")}>
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

              <div className="pd-divider" />

              {/* ออกจากระบบ */}
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