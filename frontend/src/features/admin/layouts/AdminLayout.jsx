import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import "../styles/admin.css";
import { Icon } from "@iconify/react";

export default function AdminLayout() {
  const location = useLocation();
  const tradeActive =
    location.pathname.includes("/admin/orders") ||
    location.pathname.includes("/admin/payouts");
  const donationActive =
    location.pathname.includes("/admin/donations") ||
    location.pathname.includes("/admin/wrong-items");
  const [tradeOpen,    setTradeOpen]    = useState(tradeActive);
  const [donationOpen, setDonationOpen] = useState(donationActive);

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

          {/* จัดการการบริจาค (collapsible) */}
          <div>
            <div
              onClick={() => setDonationOpen(o => !o)}
              className={`boTradeToggle${donationActive ? " active" : ""}`}
            >
              <Icon icon="mdi:package-variant-closed" className="boTradeToggle__icon" />
              <span className="boTradeToggle__label">จัดการการบริจาค</span>
              <Icon
                icon={donationOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                className="boTradeToggle__chevron"
              />
            </div>

            {donationOpen && (
              <div className="boTradeSubmenu">
                <NavLink
                  to="/admin/donations"
                  className={({ isActive }) => (isActive ? "boItem boItem--sub active" : "boItem boItem--sub")}
                >
                  <Icon icon="mdi:clock-alert-outline" className="boItem--sub__icon" />
                  รายการค้างนาน
                </NavLink>

                <NavLink
                  to="/admin/wrong-items"
                  className={({ isActive }) => (isActive ? "boItem boItem--sub active" : "boItem boItem--sub")}
                >
                  <Icon icon="mdi:swap-horizontal-circle-outline" className="boItem--sub__icon" />
                  ตรวจสอบของไม่ตรง
                </NavLink>
              </div>
            )}
          </div>

          {/* จัดการซื้อ-ขาย (collapsible) */}
          <div>
            <div
              onClick={() => setTradeOpen(o => !o)}
              className={`boTradeToggle${tradeActive ? " active" : ""}`}
            >
              <Icon icon="mdi:shopping-outline" className="boTradeToggle__icon" />
              <span className="boTradeToggle__label">จัดการซื้อ-ขาย</span>
              <Icon
                icon={tradeOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                className="boTradeToggle__chevron"
              />
            </div>

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