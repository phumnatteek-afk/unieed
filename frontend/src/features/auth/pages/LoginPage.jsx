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
            <input
              className="lgInput"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {/* ✅ ลิงก์ลืมรหัสผ่าน */}
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