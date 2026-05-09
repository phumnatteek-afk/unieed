import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/seller.css";

export default function SellerLayout() {
  const { userName, logout } = useAuth();
  const navigate = useNavigate();
  const [productsBadge, setProductsBadge]  = useState(0);
  const [ordersBadge,   setOrdersBadge]    = useState(0);

  // นับสินค้าที่ยังขายอยู่ — แสดงเป็น badge
  useEffect(() => {
    request("/seller/dashboard", { auth: true })
      .then(d => {
        if (d?.is_seller) setProductsBadge(d?.stats?.products_available || 0);
      })
      .catch(() => {});
  }, []);

  // นับออเดอร์รอจัดส่ง — refresh ทุก 60 วินาที
  useEffect(() => {
    const fetchBadge = () => {
      request("/seller/notifications", { auth: true })
        .then(d => setOrdersBadge(d?.orders_to_ship || 0))
        .catch(() => {});
    };
    fetchBadge();
    const id = setInterval(fetchBadge, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => { logout?.(); navigate("/login"); };

  return (
    <div className="slShell">
      <aside className="slSide">
        {/* Platform logo at the very top */}
        <div className="slLogoTop">
          <img src="/src/unieed_pic/logo2.png" alt="Unieed" className="slLogoImg" />
        </div>

        {/* Seller profile */}
        <div className="slBrand">
          <div className="slAvatar">
            {(userName || "U")[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="slBrandRole">ผู้ขาย</div>
            <div className="slBrandSub" style={{ fontWeight: 600, color: "#1e293b", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName || ""}
            </div>
          </div>
        </div>

        <div className="slSection">ภาพรวม</div>
        <NavLink to="/seller" end className={({isActive}) => isActive ? "slItem active" : "slItem"}>
          <Icon icon="mdi:view-dashboard-outline" /> Dashboard
        </NavLink>

        <div className="slSection">จัดการร้านค้า</div>
        <NavLink to="/seller/products" className={({isActive}) => isActive ? "slItem active" : "slItem"}>
          <Icon icon="mdi:package-variant-closed" /> รายการสินค้า
          {productsBadge > 0 && <span className="slBadge">{productsBadge}</span>}
        </NavLink>
        <NavLink to="/seller/orders" className={({isActive}) => isActive ? "slItem active" : "slItem"}>
          <Icon icon="mdi:receipt-text-outline" /> คำสั่งซื้อ
          {ordersBadge > 0 && <span className="slBadge">{ordersBadge}</span>}
        </NavLink>
        <NavLink to="/seller/orders?tab=shipped" className={({isActive}) => isActive ? "slItem active" : "slItem"}>
          <Icon icon="mdi:truck-fast-outline" /> การจัดส่ง
        </NavLink>

        <div className="slSection">การเงิน</div>
        <NavLink to="/seller/payouts" className={({isActive}) => isActive ? "slItem active" : "slItem"}>
          <Icon icon="mdi:cash-multiple" /> รายได้และการโอนเงิน
        </NavLink>

        <div className="slLogout" onClick={handleLogout}>
          <Icon icon="mdi:logout" /> Log Out
        </div>
      </aside>

      <main className="slMain">
        <Outlet />
      </main>
    </div>
  );
}

/** Component กลาง — ใช้ทุกหน้าเมื่อ API ตอบ is_seller = false */
export function NotSellerView({ message }) {
  return (
    <div className="slCard">
      <div className="slEmpty">
        <Icon icon="mdi:store-off-outline" className="slEmpty__icon" />
        <div className="slEmpty__title">{message || "ยังไม่มีรายการขายของคุณ"}</div>
        <div className="slEmpty__desc">
          เริ่มเปิดร้านโดยลงสินค้าชิ้นแรก เพื่อให้รายการขายและรายงานต่างๆ แสดงในหน้านี้
        </div>
        <a href="/sell" className="slEmpty__cta">ลงสินค้าชิ้นแรก</a>
      </div>
    </div>
  );
}
