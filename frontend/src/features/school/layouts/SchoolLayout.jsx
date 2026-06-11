import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import "../styles/school.css";

const NAV_ITEMS = [
  { to: "dashboard",       end: true,  icon: "mdi:view-dashboard-outline",  label: "ภาพรวม (Dashboard)" },
  { to: "projects/manage", end: false, icon: "fa6-regular:pen-to-square",    label: "จัดการโครงการ" },
  { to: "uniform-manage",  end: false, icon: "mdi:tshirt-crew-outline",      label: "จัดการเครื่องแบบ" },
  { to: "donations",       end: false, icon: "mdi:package-variant-closed",   label: "ติดตามการบริจาค" },
  { to: "appointments",    end: false, icon: "mdi:calendar-clock-outline",   label: "ติดตามการนัดหมาย" },
  { to: "testimonials",    end: false, icon: "mdi:heart-outline",            label: "บันทึกความประทับใจ" },
];

export default function SchoolLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const isProjectsSection = pathname.startsWith("/school/projects");
  const isUniformSection  = pathname.startsWith("/school/uniform-manage");

  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");
  const [menuOpen,   setMenuOpen]   = useState(false);

  useEffect(() => {
    getJson("/school/me", true)
      .then(me => {
        setSchoolName(me?.school_name || "");
        setSchoolLogo(me?.school_logo_url || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isActive = (item) => {
    if (item.to === "projects/manage") return isProjectsSection;
    if (item.to === "uniform-manage")  return isUniformSection;
    return false;
  };

  const NavMenu = ({ onClickItem }) => (
    <nav className="scMenu">
      {NAV_ITEMS.map(item => (
        <NavLink key={item.to} to={item.to} end={item.end}
          className={({ isActive: a }) => (a || isActive(item) ? "scItem active" : "scItem")}
          onClick={onClickItem}>
          <span className="scMenuIcon"><Icon icon={item.icon} /></span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="scShell">

      {/* ── Sidebar (desktop only) ── */}
      <aside className="scSide">
        <button className="scBrand" onClick={() => nav("/school/dashboard")} type="button">
          <img className="scLogo" src="/src/unieed_pic/logo.png" alt="Unieed Logo" />
        </button>
        <div className="scSideLine" />
        <NavMenu />
      </aside>

      {/* ── Overlay (mobile) ── */}
      {menuOpen && <div className="scOverlay" onClick={() => setMenuOpen(false)} />}

      {/* ── Drawer (mobile) ── */}
      <aside className={`scDrawer ${menuOpen ? "scDrawerOpen" : ""}`}>
        <div className="scDrawerHead">
          <button className="scBrand" onClick={() => { nav("/school/dashboard"); setMenuOpen(false); }} type="button">
            <img className="scLogo" src="/src/unieed_pic/logo.png" alt="Unieed Logo" />
          </button>
          <button className="scDrawerClose" onClick={() => setMenuOpen(false)} type="button">
            <Icon icon="mdi:close" width="24" />
          </button>
        </div>

        {schoolName && (
          <div className="scDrawerSchool">
            {schoolLogo
              ? <img src={schoolLogo} alt={schoolName} className="scDrawerSchoolLogo"
                  onError={e => e.currentTarget.style.display = "none"} />
              : <div className="scDrawerSchoolIcon"><Icon icon="mdi:school-outline" width="22" /></div>
            }
            <div>
              <div className="scDrawerSchoolSub">ผู้ดูแลโรงเรียน</div>
              <div className="scDrawerSchoolName">{schoolName}</div>
            </div>
          </div>
        )}

        <div className="scSideLine" style={{ margin: "12px 0" }} />
        <NavMenu onClickItem={() => setMenuOpen(false)} />
      </aside>

      {/* ── Main ── */}
      <div className="scContent">
        <header className="scHeader">

          {/* ซ้าย: hamburger (mobile) + school info (desktop) */}
          <div className="scHeaderLeft">
            <button className="scHamburger" onClick={() => setMenuOpen(o => !o)} type="button">
              <Icon icon="mdi:menu" width="26" />
            </button>
            {/* scHeaderSchool จะถูกซ่อนด้วย CSS บน mobile */}
            {schoolName && (
              <div className="scHeaderSchool">
                {schoolLogo ? (
                  <img src={schoolLogo} alt={schoolName} className="scHeaderSchoolLogo"
                    onError={e => e.currentTarget.style.display = "none"} />
                ) : (
                  <div className="scHeaderSchoolIconFallback">
                    <Icon icon="mdi:school-outline" width="22" style={{ color: "#fff" }} />
                  </div>
                )}
                <div className="scHeaderSchoolText">
                  <div className="scHeaderSchoolSub">ผู้ดูแลโรงเรียน</div>
                  <div className="scHeaderSchoolName">{schoolName}</div>
                </div>
              </div>
            )}
          </div>

          {/* ขวา: bell + profile */}
          <div className="scHeaderRight">
            <NotificationBell />
            <ProfileDropdown />
          </div>

        </header>

        <main className="scMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}