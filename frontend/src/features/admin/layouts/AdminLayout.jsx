import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import "../styles/admin.css";
import { Icon } from "@iconify/react";

export default function AdminLayout() {
  const location = useLocation();
  const tradeActive =
    location.pathname.includes("/admin/orders") ||
    location.pathname.includes("/admin/payouts");
  const [tradeOpen, setTradeOpen] = useState(tradeActive);

  return (
    <div className="boShell">
      <aside className="boSide">
        <div className="boBrand">
          <div className="boBrandName">
            <img src="/src/unieed_pic/logo.png" alt="Unieed Logo" />
          </div>
        </div>

        <div className="boSideLine" />

        <nav className="boMenu">
          <NavLink
            to="/admin/backoffice"
            className={({ isActive }) => (isActive ? "boItem active" : "boItem")}
          >
            <span className="boMenuIcon" /><Icon icon="wordpress:category" />
            ภาพรวมของระบบ
          </NavLink>

          <NavLink
            to="/admin/schools"
            className={({ isActive }) => (isActive ? "boItem active" : "boItem")}
          >
            <span className="boMenuIcon" /><Icon icon="fa-regular:edit" />
            จัดการโรงเรียน
          </NavLink>

          <NavLink
            to="/admin/donations"
            className={({ isActive }) => (isActive ? "boItem active" : "boItem")}
          >
            <span className="boMenuIcon" /><Icon icon="mdi:package-variant-closed" />
            จัดการการบริจาค
          </NavLink>

          {/* จัดการซื้อ-ขาย (collapsible) */}
          <div>
            <button
              onClick={() => setTradeOpen(o => !o)}
              className={`boTradeToggle${tradeActive ? " active" : ""}`}
            >
              <Icon icon="mdi:shopping-outline" className="boTradeToggle__icon" />
              <span className="boTradeToggle__label">จัดการซื้อ-ขาย</span>
              <Icon
                icon={tradeOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                className="boTradeToggle__chevron"
              />
            </button>

            {tradeOpen && (
              <div className="boTradeSubmenu">
                <NavLink
                  to="/admin/orders"
                  className={({ isActive }) => (isActive ? "boItem boItem--sub active" : "boItem boItem--sub")}
                >
                  <Icon icon="lets-icons:order" className="boItem--sub__icon" />
                  จัดการออเดอร์
                </NavLink>

                <NavLink
                  to="/admin/payouts"
                  className={({ isActive }) => (isActive ? "boItem boItem--sub active" : "boItem boItem--sub")}
                >
                  <Icon icon="mdi:bank-transfer-out" className="boItem--sub__icon" />
                  โอนเงินให้ผู้ขาย
                </NavLink>
              </div>
            )}
          </div>
        </nav>
      </aside>

      <main className="boMain">
        <Outlet />
      </main>
    </div>
  );
}