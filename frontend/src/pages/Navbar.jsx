import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ProfileDropdown from "../features/auth/pages/ProfileDropdown.jsx";
import NotificationBell from "./NotificationBell.jsx";
import CartIcon from "../features/market/components/CartIcon.jsx";
import "./styles/Homepage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

export default function Navbar({ activeLink = "" }) {
  const { token, role } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasPendingTracking, setHasPendingTracking] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/donations/my/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setHasPendingTracking(data.some(d => d.delivery_method === "parcel" && d.status === "pending" && !d.tracking_number));
      })
      .catch(() => {});
  }, [token]);

  // ปิดเมนูเมื่อ resize กลับ desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMobileMenuOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isDonor = token && role !== "admin" && role !== "school_admin";

  const rightSection = !token ? (
    <div className="navAuth">
      <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
      <Link className="navBtn navBtnWhite" to="/login">เข้าสู่ระบบ</Link>
    </div>
  ) : (
    <div className="navUserActions">
      {isDonor && hasPendingTracking && (
        <Link to="/donations/history" className="navPendingLink" style={{ fontSize: 14, color: "#ffffff", textDecoration: "underline", marginRight: 4, whiteSpace: "nowrap", lineHeight: 1 }}>
          รอกรอกเลขพัสดุ
        </Link>
      )}
      <NotificationBell />
      <ProfileDropdown />
      <CartIcon />
    </div>
  );

  const close = () => setMobileMenuOpen(false);

  return (
    <header className="topBar">
      <div className="topRow">
        <button className="hamburgerBtn" onClick={() => setMobileMenuOpen(o => !o)} aria-label="เมนู">
          <span className={`hamburgerLine ${mobileMenuOpen ? "open" : ""}`} />
          <span className={`hamburgerLine ${mobileMenuOpen ? "open" : ""}`} />
          <span className={`hamburgerLine ${mobileMenuOpen ? "open" : ""}`} />
        </button>

        <Link to="/" className="brand">
          <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
        </Link>

        <nav className="navLinks">
          <Link to="/" className={activeLink === "home" ? "active" : ""}>หน้าหลัก</Link>
          <Link to="/projects" className={activeLink === "projects" ? "active" : ""}>โครงการ</Link>
          <Link to="/market" className={activeLink === "market" ? "active" : ""}>ร้านค้า</Link>
          <Link to="/about" className={activeLink === "about" ? "active" : ""}>เกี่ยวกับเรา</Link>
          <button><Link to="/sell" className={activeLink === "sell" ? "active" : ""}>ลงขาย</Link></button>
        </nav>

        {rightSection}
      </div>

      {mobileMenuOpen && (
        <>
          <div className="mobileMenuOverlay" onClick={close} />
          <nav className="mobileMenu">
            <div className="mobileMenuHeader">
              <img className="mobileMenuLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
            </div>
            <div className="mobileMenuLinks">
              {isDonor && hasPendingTracking && (
                <Link to="/donations/history" onClick={close} className="mobileMenuPending">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>
                  รอกรอกเลขพัสดุ
                </Link>
              )}
              <div className="mobileMenuLabel">เมนู</div>
              <Link to="/" onClick={close} className={activeLink === "home" ? "mobileMenuActive" : ""}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3L2 12h3v8z"/></svg>
                หน้าหลัก
              </Link>
              <Link to="/projects" onClick={close} className={activeLink === "projects" ? "mobileMenuActive" : ""}>
                <Icon icon="mdi:school" width={20} />
                โครงการ
              </Link>
              <Link to="/market" onClick={close} className={activeLink === "market" ? "mobileMenuActive" : ""}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6H17c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2m-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3m7 17H5V8h14z"/></svg>
                ร้านค้า
              </Link>
              <Link to="/about" onClick={close}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>
                เกี่ยวกับเรา
              </Link>
              <Link to="/sell" className={`mobileMenuSell${activeLink === "sell" ? " mobileMenuActive" : ""}`} onClick={close}>
                ลงขาย
              </Link>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
