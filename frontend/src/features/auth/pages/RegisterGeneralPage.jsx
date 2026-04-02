import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as svc from "../services/auth.service.js";
import { GoogleLogin } from "@react-oauth/google";
import "../styles/auth.css";
import { useAuth } from "../../../context/AuthContext.jsx";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function RegisterGeneralPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [user_name, setUserName] = useState("");
  const [user_email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false); // ✅ state หลัง register สำเร็จ
  const [showPassword, setShowPassword] = useState(false);

  // ─── Register ด้วย email/password ────────────────────────
  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const cleanName = user_name.trim();
    const cleanEmail = user_email.trim().toLowerCase();
    const cleanPass = password;

    if (!cleanName) return setErr("กรุณากรอกชื่อผู้ใช้");
    if (!cleanEmail) return setErr("กรุณากรอกอีเมล");
    if (!isValidEmail(cleanEmail)) return setErr("รูปแบบอีเมลไม่ถูกต้อง");
    if (!cleanPass || cleanPass.length < 6)
      return setErr("รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร");

    setLoading(true);
    try {
      await svc.registerGeneral({
        user_name: cleanName,
        user_email: cleanEmail,
        password: cleanPass,
      });
      setDone(true); // ✅ แสดงหน้ายืนยันอีเมลแทน navigate ทันที
    } catch (e2) {
      setErr(e2?.data?.message || e2?.message || "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // ─── Register/Login ด้วย Google ──────────────────────────
  const handleGoogleSuccess = async (credentialResponse) => {
    setErr("");
    setLoading(true);
    try {
      const res = await svc.googleLogin({ idToken: credentialResponse.credential });
      // Google login สำเร็จ → verified อัตโนมัติ → ไป home ได้เลย
      login({ token: res.token, role: res.role, user_name: res.user_name });
      navigate("/");
    } catch (e2) {
      if (e2?.data?.code === "EMAIL_EXISTS") {
        setErr("อีเมลนี้ถูกใช้งานแล้ว กรุณา login ด้วยรหัสผ่าน");
      } else {
        setErr(e2?.data?.message || e2?.message || "Google สมัครสมาชิกไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── หน้า "กรุณายืนยันอีเมล" หลัง register สำเร็จ ────────
  if (done) {
  return (
    <div className="lgPage">
      <div className="lgCard">
        <div className="lgRightPanel">
          <div className="lgHeader">
            <h2 className="lgTitle">ตรวจสอบอีเมลของคุณ</h2>
            <p className="lgSubtitle">อีเมลยืนยันถูกส่งไปแล้ว</p>
          </div>
          <div className="lgAlert lgAlert--success">
            ✅ ส่งอีเมลยืนยันไปที่ <strong>{user_email}</strong> แล้ว
            กรุณาคลิกลิงก์ในอีเมลเพื่อเริ่มใช้งาน
          </div>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "16px" }}>
            ไม่เห็นอีเมล? ตรวจสอบโฟลเดอร์ spam หรือ
          </p>
          <Link to="/resend-verification" className="lgLink" style={{ fontSize: "14px" }}>
            ขอส่งอีเมลยืนยันใหม่
          </Link>
          <div className="lgFooter" style={{ marginTop: "24px" }}>
            <Link to="/login" className="lgLink">← กลับหน้าเข้าสู่ระบบ</Link>
          </div>
        </div>
        <div className="lgLeftPanel">
          <div className="lgBgImage" />
          <img className="lgLogo" src="/src/unieed_pic/logo1.png" alt="Unieed" />
          <div className="lgWelcomeBlock">
            <div className="lgWelcomeTitle">เข้าร่วมกับเรา</div>
            <div className="lgWelcomeSub">ร่วมส่งต่อโอกาส<br />ให้น้องที่ต้องการ</div>
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

  // ─── หน้า Register ────────────────────────────────────────
return (
  <div className="lgPage">
    <div className="lgCard">

      {/* ===== RIGHT PANEL (content) ===== */}
      <div className="lgRightPanel">
        <div className="lgHeader">
          <h2 className="lgTitle">สมัครสมาชิก</h2>
          <p className="lgSubtitle">กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้</p>
        </div>

        {err && <div className="lgAlert lgAlert--error">{err}</div>}

        <form className="lgForm" onSubmit={submit}>
          <div className="lgField">
  <label className="lgLabel">ชื่อผู้ใช้</label>
  <div className="lgInputWrap">
    <span className="lgInputIcon">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    </span>
    <input className="lgInput" placeholder="ชื่อผู้ใช้" value={user_name} onChange={(e) => setUserName(e.target.value)} />
  </div>
</div>

<div className="lgField">
  <label className="lgLabel">อีเมล</label>
  <div className="lgInputWrap">
    <span className="lgInputIcon">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
    </span>
    <input className="lgInput" placeholder="name@email.com" value={user_email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
  </div>
</div>

<div className="lgField">
  <label className="lgLabel">รหัสผ่าน</label>
  <div className="lgInputWrap" style={{ position: "relative" }}>
    <span className="lgInputIcon">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </span>
    <input
      className="lgInput"
      type={showPassword ? "text" : "password"}
      placeholder="อย่างน้อย 6 ตัว"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      autoComplete="new-password"
      style={{ paddingRight: "44px" }}
    />
    <button type="button" onClick={() => setShowPassword(!showPassword)}
      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#888", display: "flex", alignItems: "center" }}>
      {showPassword
        ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="m18.922 16.8l3.17 3.17l-1.06 1.061L4.06 4.061L5.12 3l2.74 2.738A11.9 11.9 0 0 1 12 5c4.808 0 8.972 2.848 11 7a12.66 12.66 0 0 1-4.078 4.8m-8.098-8.097l4.473 4.473a3.5 3.5 0 0 0-4.474-4.474zm5.317 9.56A11.9 11.9 0 0 1 12 19c-4.808 0-8.972-2.848-11-7a12.66 12.66 0 0 1 4.078-4.8l3.625 3.624a3.5 3.5 0 0 0 4.474 4.474l2.964 2.964z"/></svg>
        : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M1 12c2.028-4.152 6.192-7 11-7s8.972 2.848 11 7c-2.028 4.152-6.192 7-11 7s-8.972-2.848-11-7m11 3.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7"/></svg>
      }
    </button>
  </div>
</div>

          <button className="lgBtn" type="submit" disabled={loading}>
            {loading ? "กำลังสมัคร..." : "ลงทะเบียน"}
          </button>
        </form>

        <div className="lgDivider"><span>หรือ</span></div>

        <div className="lgGoogleWrapper">
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setErr("Google สมัครสมาชิกไม่สำเร็จ")} width="100%" text="signup_with" locale="th" />
        </div>

        <div className="lgFooter">
          มีบัญชีแล้ว? |
          <Link to="/login" className="lgLink">เข้าสู่ระบบ</Link>
        </div>
      </div>

      {/* ===== LEFT PANEL (blue side) ===== */}
      <div className="lgLeftPanel">
        <div className="lgBgImage" />
        <img className="lgLogo" src="/src/unieed_pic/logo1.png" alt="Unieed" />
        <div className="lgWelcomeBlock">
          <div className="lgWelcomeTitle">เข้าร่วมกับเรา</div>
          <div className="lgWelcomeSub">
            ร่วมส่งต่อโอกาส<br />ให้น้องที่ต้องการ
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