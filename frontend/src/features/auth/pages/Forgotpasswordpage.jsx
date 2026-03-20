import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/auth.service.js";
import "../styles/auth.css";

export default function ForgotPasswordPage() {
  console.log("ForgotPasswordPage rendered");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await forgotPassword({ user_email: email });
      setSent(true);
    } catch (e2) {
      console.log("forgot password error:", e2);
      setErr(e2?.data?.message || e2?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lgPage">
      <div className="lgCardForgot">

        {/* ===== LEFT PANEL ===== */}
        <div className="lgLeftPanel">
          <div className="lgBgImage" />
          <img className="lgLogo" src="/src/unieed_pic/logo1.png" alt="Unieed" />
          <div className="lgWelcomeBlock">
            <div className="lgWelcomeTitle">ยินดีต้อนรับ</div>
            <div className="lgWelcomeSub">
              ส่งต่อชุดนักเรียน<br />เพื่อน้องที่ต้องการ
            </div>
          </div>
          <div className="lgBadge">
            <div className="lgBadgeText">
              " สร้างโอกาสทางการศึกษา<br />ผ่านการบริจาคชุดนักเรียน <span>"</span>
            </div>
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="lgRightPanel">

          {sent ? (
            <>
              <div className="lgHeader">
                <h2 className="lgTitle">ตรวจสอบอีเมลของคุณ</h2>
              </div>
              <div className="lgAlert lgAlert--success">
                หากอีเมล <strong>{email}</strong> ถูกต้อง คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านในไม่กี่นาที กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์ spam)
              </div>
              <div className="lgFooter" style={{ marginTop: "24px" }}>
                <Link to="/login" className="lgLink">กลับหน้าเข้าสู่ระบบ</Link>
              </div>
            </>
          ) : (
            <>
              <div className="lgHeader">
                <h2 className="lgTitle">ลืมรหัสผ่าน</h2>
                <p className="lgSubtitle">กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
              </div>

              {err && <div className="lgAlert lgAlert--error">{err}</div>}

              <form className="lgForm" onSubmit={submit}>
                <div className="lgField">
                  <label className="lgLabel">อีเมล</label>
                  <div className="lgInputWrap">
                    <span className="lgInputIcon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                    </span>
                    <input
                      className="lgInput"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="lgBtn" disabled={loading}>
                  {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
                </button>
              </form>

              <div className="lgFooter">
                <Link to="/login" className="lgLink">← กลับหน้าเข้าสู่ระบบ</Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}