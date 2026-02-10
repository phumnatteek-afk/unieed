import { NavLink, Outlet } from "react-router-dom";
import "../styles/admin.css";

export default function AdminLayout() {
  return (
    <div className="boShell">
      <aside className="boSide">
        <div className="boBrand">
          <div className="boLogo" />
          <div className="boBrandName">Unieed</div>
        </div>

        <div className="boSideLine" />

        <nav className="boMenu">
          <NavLink to="/admin/backoffice" className={({ isActive }) => (isActive ? "boItem active" : "boItem")}>
            <span className="boMenuIcon boMenuIconGrid" />
            ภาพรวมของระบบ
          </NavLink>

          <NavLink to="/admin/schools" className={({ isActive }) => (isActive ? "boItem active" : "boItem")}>
            <span className="boMenuIcon boMenuIconEdit" />
            จัดการโรงเรียน
          </NavLink>
        </nav>
      </aside>

      <main className="boMain">
        <Outlet />
      </main>
    </div>
  );
}
