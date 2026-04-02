import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEmail } from "../services/auth.service.js";
import "../styles/auth.css";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("ลิงก์ไม่ถูกต้อง");
      return;
    }
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((e) => {
        setStatus("error");
        setMessage(e?.data?.message || e?.message || "เกิดข้อผิดพลาด");
      });
  }, [token]);

  return (
    <div className="lgPage">
      <div className="lgCard" style={{ height: "auto", minHeight: "420px" }}>

        {/* ===== RIGHT PANEL (content) ===== */}
        <div className="lgRightPanel">
          <div className="lgHeader">
            <h2 className="lgTitle">ยืนยันอีเมล</h2>
            <p className="lgSubtitle">ระบบกำลังตรวจสอบลิงก์ของคุณ</p>
          </div>

          {status === "loading" && (
            <div className="lgAlert">⏳ กำลังยืนยันอีเมล...</div>
          )}

          {status === "success" && (
            <>
              <div className="lgAlert lgAlert--success">
                ✅ ยืนยันอีเมลสำเร็จ! คุณสามารถเข้าสู่ระบบได้แล้ว
              </div>
              <Link
                to="/login"
                className="lgBtn"
                style={{ display: "block", textAlign: "center", textDecoration: "none", lineHeight: "50px" }}
              >
                ไปหน้าเข้าสู่ระบบ
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="lgAlert lgAlert--error">❌ {message}</div>
              <div className="lgFooter" style={{ marginTop: "16px" }}>
                <Link to="/resend-verification" className="lgLink">
                  ขอส่งอีเมลยืนยันใหม่
                </Link>
              </div>
            </>
          )}

          <div className="lgFooter" style={{ marginTop: "24px" }}>
            มีบัญชีอยู่แล้ว? |{" "}
            <Link to="/login" className="lgLink">เข้าสู่ระบบ</Link>
          </div>
        </div>

        {/* ===== LEFT PANEL (blue side) ===== */}
        <div className="lgLeftPanel">
          <div className="lgBgImage" />
          <img className="lgLogo" src="/src/unieed_pic/logo1.png" alt="Unieed" />
          <div className="lgWelcomeBlock">
            <div className="lgWelcomeTitle">ยืนยันตัวตน</div>
            <div className="lgWelcomeSub">
              ก้าวแรกสู่การ<br />ส่งต่อโอกาส
            </div>
          </div>
          <div className="lgBadge">
            <div className="lgBadgeText">
              " สร้างโอกาสทางการศึกษา<br />ผ่านการบริจาคชุดนักเรียน <span>"</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}