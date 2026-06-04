import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import "../styles/school.css";

export default function SchoolLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const isProjectsSection = pathname.startsWith("/school/projects");
  const isUniformSection  = pathname.startsWith("/school/uniform-manage");
  const [schoolName, setSchoolName] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");

  useEffect(() => {
    getJson("/school/me", true)
      .then(me => {
        setSchoolName(me?.school_name || "");
        setSchoolLogo(me?.school_logo_url || "");
      })
      .catch(() => {});
  }, []);

  return (
    <div className="scShell">
      <aside className="scSide">
        <button className="scBrand" onClick={() => nav("/school/dashboard")} type="button">
          <img className="scLogo" src="/src/unieed_pic/logo.png" alt="Unieed Logo" />
        </button>

        <div className="scSideLine" />

        <nav className="scMenu">
          <NavLink to="dashboard" end
            className={({ isActive }) => (isActive ? "scItem active" : "scItem")}>
            <span className="scMenuIcon"><Icon icon="mdi:view-dashboard-outline" /></span>
            ภาพรวม (Dashboard)
          </NavLink>

          <NavLink to="projects/manage"
            className={({ isActive }) => (isActive || isProjectsSection ? "scItem active" : "scItem")}>
            <span className="scMenuIcon"><Icon icon="fa6-regular:pen-to-square" /></span>
            จัดการโครงการ
          </NavLink>

          <NavLink to="uniform-manage"
            className={({ isActive }) => (isActive || isUniformSection ? "scItem active" : "scItem")}>
            <span className="scMenuIcon"><Icon icon="mdi:tshirt-crew-outline" /></span>
            จัดการเครื่องแบบ
          </NavLink>

          <NavLink to="donations"
            className={({ isActive }) => (isActive ? "scItem active" : "scItem")}>
            <span className="scMenuIcon"><Icon icon="mdi:package-variant-closed" /></span>
            ติดตามการบริจาค
          </NavLink>

          {/* ✅ เพิ่ม */}
          <NavLink to="appointments"
            className={({ isActive }) => (isActive ? "scItem active" : "scItem")}>
            <span className="scMenuIcon"><Icon icon="mdi:calendar-clock-outline" /></span>
            ติดตามการนัดหมาย
          </NavLink>

          {/* ✅ เพิ่ม */}
          <NavLink to="testimonials"
            className={({ isActive }) => (isActive ? "scItem active" : "scItem")}>
            <span className="scMenuIcon"><Icon icon="mdi:heart-outline" /></span>
            บันทึกความประทับใจ
          </NavLink>
        </nav>
      </aside>

      <div className="scContent">
        {/* ── Header ── */}
        <header className="scHeader">
          {schoolName && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              marginRight: "auto",
              padding: "4px 0",
            }}>
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt={schoolName}
                  style={{
                    width: 46, height: 46,
                    borderRadius: 10,
                    objectFit: "cover",
                    flexShrink: 0,
                    background: "#fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
                  }}
                  onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
                />
              ) : null}
              <span style={{
                display: schoolLogo ? "none" : "flex",
                alignItems: "center", justifyContent: "center",
                width: 46, height: 46, borderRadius: 10,
                background: "rgba(255,255,255,0.2)",
                flexShrink: 0,
              }}>
                <Icon icon="mdi:school-outline" width="26" style={{ color: "#fff" }} />
              </span>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: "rgba(255,255,255,0.65)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: 2,
                }}>
                  ผู้ดูแลโรงเรียน
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 800, color: "#1e3a8a",
                  lineHeight: 1, textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                  letterSpacing: "0.01em",
                }}>
                  {schoolName}
                </div>
              </div>
            </div>
          )}
          <NotificationBell />
          <ProfileDropdown />
        </header>

        <main className="scMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}