import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import { getJson } from "../../../api/http.js";
import "../styles/school.css";
import { Icon } from "@iconify/react";

export default function SchoolWelcomePage() {
  const nav = useNavigate();
  const { token, role, userName } = useAuth();

  const [schoolName, setSchoolName] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        setLoading(true);

        if (!token || role !== "school_admin") {
          nav("/login");
          return;
        }

        // ดึงข้อมูลโรงเรียน + โครงการล่าสุด พร้อมกัน
        const [me, latest] = await Promise.all([
          getJson("/school/me", true),
          getJson("/school/projects/latest", true).catch(() => null),
        ]);

        setCoordinatorName(me?.user_name || userName || "");
        setSchoolName(me?.school_name || "");

        // ถ้ามีโครงการ open หรือ closed (อยู่ในช่วง 14 วัน) → ไป dashboard
        if (latest && ["open", "closed"].includes(latest.status)) {
          nav("/school/dashboard", { replace: true });
          return;
        }

        // archived = จบแล้ว → ไปสร้างโครงการใหม่ได้
        if (latest && latest.status === "archived") {
          nav("/school/request/new", { replace: true });
          return;
        }

        // ยังไม่มีโครงการเลย (ครั้งแรก) → แสดงหน้า welcome
      } catch (e) {
        // 401 = token invalid/expired → http.js already cleared localStorage
        // and fired auth:logout, so AuthContext will clear state and
        // ProtectedRoute will redirect to /login automatically.
        if (e.status === 401) return;
        setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, role, nav, userName]);

  // loading state
  if (loading) {
    return (
      <div style={{
        height: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon icon="mdi:loading" width="36" color="#29B6E8"
          style={{ animation: "spin 1s linear infinite" }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // error state
  if (err) {
    return (
      <div style={{
        height: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        color: "#dc2626", fontSize: 14,
      }}>
        {err}
      </div>
    );
  }

  // ครั้งแรก — แสดงหน้า welcome
  return (
    <div className="swPage">
      <main className="swMain">
        <div className="swHero">
          <div className="swIllustration">
            <img src="/src/unieed_pic/illustrator.png" alt="Illustration"/>
          </div>

          <div className="swWelcomeText">
            <h1 className="swTitle">ยินดีต้อนรับ คุณ{coordinatorName || "ผู้ประสานงาน"}</h1>
            <h2 className="swSub">{schoolName || "ชื่อโรงเรียน"}</h2>

            <button className="swCTA" onClick={() => nav("/school/request/new")}>
              เข้าสู่ระบบบันทึก
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}