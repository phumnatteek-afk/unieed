import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { login as loginService, googleLogin } from "../services/auth.service.js";
import { GoogleLogin } from "@react-oauth/google";
import "../styles/auth.css";

export default function LoginPage() {
  const [user_email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const nav = useNavigate();
  const { login } = useAuth();

  const handleSuccess = (res) => {
    if (res?.requires_school_check) {
      nav("/school/pending", {
        state: { status: res.verification_status, note: res.verification_note },
      });
      return;
    }
    login({ token: res.token, role: res.role, user_name: res.user_name });
    if (res.role === "admin") nav("/admin/schools");
    else if (res.role === "school_admin") nav("/school/welcome");
    else nav("/");
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setUnverified(false);
    try {
      const res = await loginService({ user_email, password });
      handleSuccess(res);
    } catch (e2) {
      if (e2?.data?.code === "EMAIL_NOT_VERIFIED" || e2?.code === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
      } else {
        setErr(e2?.data?.message || e2?.message || "เข้าสู่ระบบไม่สำเร็จ");
      }
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setErr("");
    try {
      const res = await googleLogin({ idToken: credentialResponse.credential });
      handleSuccess(res);
    } catch (e2) {
      if (e2?.data?.code === "EMAIL_EXISTS") {
        setErr("อีเมลนี้ถูกใช้งานแล้ว กรุณา login ด้วยรหัสผ่าน");
      } else {
        setErr(e2?.data?.message || e2?.message || "Google login ไม่สำเร็จ");
      }
    }
  };

  return (
    <div className="lgPage">
      <div className="lgCard">
        <div className="lgHeader">
          <h2 className="lgTitle">เข้าสู่ระบบ</h2>
        </div>

        {err && <div className="lgAlert lgAlert--error">{err}</div>}

        {/* ✅ แจ้งเตือนอีเมลยังไม่ถูกยืนยัน */}
        {unverified && (
          <div className="lgAlert lgAlert--warning">
            กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ{" "}
            <Link to="/resend-verification" className="lgLink">
              ขอส่งอีเมลยืนยันใหม่
            </Link>
          </div>
        )}

        <form className="lgForm" onSubmit={submit}>
          <div className="lgField">
            <label className="lgLabel">อีเมล</label>
            <input
              className="lgInput"
              value={user_email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
            />
          </div>

          <div className="lgField">
  <label className="lgLabel">รหัสผ่าน</label>
  <div style={{ position: "relative" }}>
    <input
      className="lgInput"
      type={showPassword ? "text" : "password"}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="••••••••"
      style={{ paddingRight: "44px" }}
    />
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      style={{
        position: "absolute",
        right: "12px",
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: "#888",
        fontSize: "20px",
        display: "flex",
        alignItems: "center",
      }}
    >
      {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="m18.922 16.8l3.17 3.17l-1.06 1.061L4.06 4.061L5.12 3l2.74 2.738A11.9 11.9 0 0 1 12 5c4.808 0 8.972 2.848 11 7a12.66 12.66 0 0 1-4.078 4.8m-8.098-8.097l4.473 4.473a3.5 3.5 0 0 0-4.474-4.474zm5.317 9.56A11.9 11.9 0 0 1 12 19c-4.808 0-8.972-2.848-11-7a12.66 12.66 0 0 1 4.078-4.8l3.625 3.624a3.5 3.5 0 0 0 4.474 4.474l2.964 2.964z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M1 12c2.028-4.152 6.192-7 11-7s8.972 2.848 11 7c-2.028 4.152-6.192 7-11 7s-8.972-2.848-11-7m11 3.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7"/></svg>}
    </button>
  </div>
  <div style={{ textAlign: "right", marginTop: "4px" }}>
    <Link to="/forgot-password" className="lgLink" style={{ fontSize: "13px" }}>
      ลืมรหัสผ่าน?
    </Link>
  </div>
</div>

          <button type="submit" className="lgBtn">
            เข้าสู่ระบบ
          </button>
        </form>

        {/* ✅ Divider */}
        <div className="lgDivider">
          <span>หรือ</span>
        </div>

        {/* ✅ Google Login */}
        <div className="lgGoogleWrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setErr("Google login ไม่สำเร็จ")}
            width="100%"
            text="signin_with"
            locale="th"
          />
        </div>

        <div className="lgFooter">
          ยังไม่มีบัญชี? |
          <Link to="/register" className="lgLink">
            ลงทะเบียน
          </Link>
        </div>
      </div>
    </div>
  );
}