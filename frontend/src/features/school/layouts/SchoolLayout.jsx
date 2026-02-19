import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import "../styles/school.css";

export default function SchoolLayout() {
  const nav = useNavigate();

  return (
    <div className="scShell">
      <aside className="scSide">
        <button className="scBrand" onClick={() => nav("/school/dashboard")} type="button">
          <img className="scLogo" src="/src/unieed_pic/logo.png" alt="Unieed Logo" />
        </button>

        <div className="scSideLine" />

        <nav className="scMenu">
          <NavLink
            to="dashboard"
            end
            className={({ isActive }) => (isActive ? "scItem active" : "scItem")}
          >
            <span className="scMenuIcon">
              <Icon icon="mdi:view-dashboard-outline" />
            </span>
            ภาพรวม (Dashboard)
          </NavLink>

          <NavLink
            to="projects/manage"
            className={({ isActive }) => (isActive ? "scItem active" : "scItem")}
          >
            <span className="scMenuIcon">
              <Icon icon="fa6-regular:pen-to-square" />
            </span>
            จัดการโครงการ
          </NavLink>

          <NavLink
            to="donations"
            className={({ isActive }) => (isActive ? "scItem active" : "scItem")}
          >
            <span className="scMenuIcon">
              <Icon icon="mdi:package-variant-closed" />
            </span>
            ติดตามการบริจาค
          </NavLink>
        </nav>
      </aside>

      <main className="scMain">
        <Outlet />
      </main>
    </div>
  );
}
