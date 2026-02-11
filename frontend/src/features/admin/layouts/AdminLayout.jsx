import { NavLink, Outlet } from "react-router-dom";
import "../styles/admin.css";
// icon
import { Icon } from "@iconify/react";

export default function AdminLayout() {
  return (
    <div className="boShell">
      <aside className="boSide">
        <div className="boBrand">
          <div className="boBrandName"><img src="/src/unieed_pic/logo.png" alt="Unieed Logo" /></div>
        </div>

        <div className="boSideLine" />

        <nav className="boMenu">
          <NavLink to="/admin/backoffice" className={({ isActive }) => (isActive ? "boItem active" : "boItem")}>
            <span className="boMenuIcon boMenuIconGrid" /><Icon icon="wordpress:category"/> 
            ภาพรวมของระบบ
          </NavLink>

          <NavLink to="/admin/schools" className={({ isActive }) => (isActive ? "boItem active" : "boItem")}>
            <span className="boMenuIcon boMenuIconEdit" /><Icon icon="fa-regular:edit" />
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
