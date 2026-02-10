import { useEffect, useState } from "react";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/admin.css";

export default function AdminBackofficePage() {
  const { userName } = useAuth();
  const [stats, setStats] = useState({
    total_users: 0,
    total_schools: 0,
    total_products: 0,
    total_orders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        setLoading(true);

        const data = await request("/admin/overview", {
          method: "GET",
          auth: true, // ✅ ใช้ token จาก localStorage
        });

        setStats({
          total_users: Number(data.total_users || 0),
          total_schools: Number(data.total_schools || 0),
          total_products: Number(data.total_products || 0),
          total_orders: Number(data.total_orders || 0),
        });
      } catch (e) {
        setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="boPage">
      <div className="boTop">
        <div className="boTitle">Dashboard</div>

        <div className="boAdmin">
          <div className="boAvatar" />
          <div className="boAdminText">
            <div className="boAdminRole">ผู้ดูแลระบบ:</div>
            <div className="boAdminName">{userName || "Admin"}</div>
          </div>
        </div>
      </div>

      <div className="boPanel">
        <div className="boPanelTitle">System Overview</div>

        {loading && <div className="boMuted">กำลังโหลด…</div>}
        {err && <div className="boError">{err}</div>}

        {!loading && !err && (
          <div className="boCards">
            <div className="boCard boCardBlue">
              <div className="boCardLabel">ยอดผู้ใช้งานรวมทั้งหมด</div>
              <div className="boCardIcon" />
              <div className="boCardValue">{stats.total_users.toLocaleString()}</div>
            </div>

            <div className="boCard boCardGreen">
              <div className="boCardLabel">โรงเรียนทั้งหมด</div>
              <div className="boCardIcon" />
              <div className="boCardValue">{stats.total_schools.toLocaleString()}</div>
            </div>

            <div className="boCard boCardYellow">
              <div className="boCardLabel">รายการสินค้าทั้งหมด</div>
              <div className="boCardIcon" />
              <div className="boCardValue">{stats.total_products.toLocaleString()}</div>
            </div>

            <div className="boCard boCardRed">
              <div className="boCardLabel">รายการซื้อสินค้า</div>
              <div className="boCardIcon" />
              <div className="boCardValue">{stats.total_orders.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
