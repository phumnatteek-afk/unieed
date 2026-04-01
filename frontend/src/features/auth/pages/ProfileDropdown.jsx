import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../styles/ProfileDropdown.css";

const ROLE_LABEL = {
  admin: "ผู้ดูแลระบบ",
  school_admin: "ผู้ดูแลโรงเรียน",
  user:         "บุคคลทั่วไป",
};

export default function ProfileDropdown() {
  const { userName, role, logout } = useAuth();  // ← เพิ่ม role
  const navigate = useNavigate();
  const [open, setOpen]               = useState(false);
  const [openAccount, setOpenAccount] = useState(false);
  const [openDonate,  setOpenDonate]  = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout   = ()     => { setOpen(false); logout(); navigate("/"); };
  const handleNavigate = (path) => { setOpen(false); navigate(path); };

  return (
    <div className="pd-outer" ref={ref}>
      <div className="pd-wrap">

        {/* ===== Trigger ===== */}
        <div className="pd-trigger" onClick={() => setOpen((o) => !o)}>
          <div className="pd-avatar">
            <Icon icon="fluent:person-circle-28-filled" width="38" height="38" color="#fff" />
          </div>
          <div className="pd-info">
            <div className="pd-name">{userName || "ผู้ใช้"}</div>
            <div className="pd-role">{ROLE_LABEL[role] ?? "บุคคลทั่วไป"}</div>  {/* ← แก้ตรงนี้ */}
          </div>
          <div className={`pd-chevron ${open ? "pd-chevron--open" : ""}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* ===== Dropdown ===== */}
        {open && (
          <div className="pd-menu">

            {/* ── school_admin: เมนูหลังบ้านโรงเรียน ── */}
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

                <div className="pd-item" onClick={() => handleNavigate("/school/profile/edit")}>
                  <span className="pd-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="pd-item-label">จัดการโปรไฟล์โรงเรียน</span>
                </div>

                <div className="pd-divider" />
              </>
            )}

            {/* ── admin: เมนูสำหรับผู้ดูแลระบบกลาง ── */}
{role === "admin" && (
  <>
    <div className="pd-item" onClick={() => handleNavigate("/admin/dashboard")}>
      <span className="pd-item-icon">
        <Icon icon="material-symbols:dashboard-rounded" width="18" height="18" />
      </span>
      <span className="pd-item-label">แดชบอร์ดผู้ดูแลระบบ</span>
    </div>

    <div className="pd-item" onClick={() => handleNavigate("/admin/schools")}>
      <span className="pd-item-icon">
        <Icon icon="fluent:people-settings-20-filled" width="18" height="18" />
      </span>
      <span className="pd-item-label">จัดการโรงเรียน</span>
    </div>
    
    <div className="pd-divider" />
  </>
)}

            {/* ── user: เมนูปกติ ── */}
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
                    <div className="pd-sub-item" onClick={() => handleNavigate("/profile/edit")}>
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M20 12v10H4V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M22 7H2v5h20V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M12 22V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
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

                {/* คำสั่งซื้อ / รายการขาย */}
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
  );
}