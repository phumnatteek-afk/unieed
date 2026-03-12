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
          <div className="lgHeader">
            <h2 className="lgTitle">ตรวจสอบอีเมลของคุณ</h2>
          </div>
          <div className="lgAlert lgAlert--success">
            ส่งอีเมลยืนยันไปที่ <strong>{user_email}</strong> แล้ว
            กรุณาคลิกลิงก์ในอีเมลเพื่อเริ่มใช้งาน
          </div>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "16px" }}>
            ไม่เห็นอีเมล? ตรวจสอบโฟลเดอร์ spam หรือ
          </p>
          <Link to="/resend-verification" className="lgLink" style={{ fontSize: "14px" }}>
            ขอส่งอีเมลยืนยันใหม่
          </Link>
          <div className="lgFooter" style={{ marginTop: "24px" }}>
            <Link to="/login" className="lgLink">
              ← กลับหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── หน้า Register ────────────────────────────────────────
  return (
    <div className="lgPage">
      <div className="lgCard">
        <div className="lgHeader">
          <h2 className="lgTitle">สมัครสมาชิก</h2>
          <p className="lgSubtitle">กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้</p>
        </div>

        {err && <div className="lgAlert lgAlert--error">{err}</div>}

        <form className="lgForm" onSubmit={submit}>
          <div className="lgField">
            <label className="lgLabel">ชื่อผู้ใช้</label>
            <input
              className="lgInput"
              placeholder="ชื่อผู้ใช้"
              value={user_name}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div className="lgField">
            <label className="lgLabel">อีเมล</label>
            <input
              className="lgInput"
              placeholder="name@email.com"
              value={user_email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <div className="lgField">
            <label className="lgLabel">รหัสผ่าน</label>
            <input
              className="lgInput"
              type="password"
              placeholder="อย่างน้อย 6 ตัว"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <button className="lgBtn" type="submit" disabled={loading}>
            {loading ? "กำลังสมัคร..." : "ลงทะเบียน"}
          </button>
        </form>

        {/* ─── Divider ─────────────────────────────────── */}
        <div className="lgDivider">
          <span>หรือ</span>
        </div>

        {/* ─── Google Sign-up ──────────────────────────── */}
        <div className="lgGoogleWrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setErr("Google สมัครสมาชิกไม่สำเร็จ")}
            width="100%"
            text="signup_with"
            locale="th"
          />
        </div>

        <div className="lgFooter">
          มีบัญชีแล้ว? |
          <Link to="/login" className="lgLink">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}