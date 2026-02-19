import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import "../styles/school.css";

// icon
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

        // กันหลุด role
        if (!token || role !== "school_admin") {
          nav("/login");
          return;
        }

        // ต้องเป็น auth=true เพื่อแนบ token
        const me = await getJson("/school/me", true);

        setCoordinatorName(me?.user_name || userName || "");
        setSchoolName(me?.school_name || "");
      } catch (e) {
        setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, role, nav, userName]);

  return (
    <div className="swPage">
      <header className="swTopbar">
        <button className="swBrand" onClick={() => nav("/")}>
          <div className="swLogo" />
          <div className="swBrandPic"><img src="/src/unieed_pic/logo.png" alt="Unieed Logo" /></div>
        </button>

        <div className="swAdminTag">
          <span className="swAvatar"><Icon icon="subway:admin" /></span>
          <span>ผู้ดูแลระบบ: </span>
          <b>{coordinatorName || "-"}</b>
        </div>
      </header>

      <main className="swMain">
        <div className="swHero">
          <div className="swIllustration" 
          ><img src="/src/unieed_pic/illustrator.png" alt="Illustration" /></div>

          {loading ? (
            <div className="swMuted">กำลังโหลด…</div>
          ) : err ? (
            <div className="swError">{err}</div>
          ) : (
            <div className="swWelcomeText">
              <h1 className="swTitle">ยินดีต้อนรับ คุณ{coordinatorName || "ผู้ประสานงาน"}</h1>
              <h2 className="swSub">{schoolName || "ชื่อโรงเรียน"}</h2>

              <button className="swCTA" onClick={() => nav("/school/request/new")}>
                เข้าสู่ระบบบันทึก
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
