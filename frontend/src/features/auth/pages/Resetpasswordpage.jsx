import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../services/auth.service.js";
import "../styles/reset.css"; // ← เปลี่ยน path ตาม project ของคุณ

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const nav = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (newPassword.length < 6) {
      setErr("รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirm) {
      setErr("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, newPassword });
      setDone(true);
      setTimeout(() => nav("/login"), 2500);
    } catch (e2) {
      setErr(e2?.data?.message || e2?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path fill="currentColor" fillRule="evenodd" d="M1 12c2.028-4.152 6.192-7 11-7s8.972 2.848 11 7c-2.028 4.152-6.192 7-11 7s-8.972-2.848-11-7m11 3.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7"/>
    </svg>
  );

  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path fill="currentColor" fillRule="evenodd" d="m18.922 16.8l3.17 3.17l-1.06 1.061L4.06 4.061L5.12 3l2.74 2.738A11.9 11.9 0 0 1 12 5c4.808 0 8.972 2.848 11 7a12.66 12.66 0 0 1-4.078 4.8m-8.098-8.097l4.473 4.473a3.5 3.5 0 0 0-4.474-4.474zm5.317 9.56A11.9 11.9 0 0 1 12 19c-4.808 0-8.972-2.848-11-7a12.66 12.66 0 0 1 4.078-4.8l3.625 3.624a3.5 3.5 0 0 0 4.474 4.474l2.964 2.964z"/>
    </svg>
  );

  /* ── ลิงก์ไม่ถูกต้อง ── */
  if (!token) {
    return (
      <div className="rpPage">
        <div className="rpCard">
          <div className="rpSuccessIcon" style={{ background: "#fef2f2" }}>⚠️</div>
          <div className="rpHeader" style={{ textAlign: "center" }}>
            <h2 className="rpTitle">ลิงก์ไม่ถูกต้อง</h2>
            <p className="rpSubtitle">ลิงก์นี้หมดอายุหรือไม่ถูกต้อง</p>
          </div>
          <div className="rpFooter">
            <Link to="/forgot-password" className="rpLink">← ขอลิงก์ใหม่</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── สำเร็จ ── */
  if (done) {
    return (
      <div className="rpPage">
        <div className="rpCard">
          <div className="rpSuccessIcon">✓</div>
          <div className="rpHeader" style={{ textAlign: "center" }}>
            <h2 className="rpTitle">เปลี่ยนรหัสผ่านสำเร็จ</h2>
            <p className="rpSubtitle">กำลังพาไปหน้าเข้าสู่ระบบ...</p>
          </div>
          <div className="rpAlert rpAlert--success">
            รหัสผ่านใหม่ถูกบันทึกแล้ว คุณสามารถเข้าสู่ระบบได้ทันที
          </div>
        </div>
      </div>
    );
  }

  /* ── ฟอร์มหลัก ── */
  return (
    <div className="rpPage">
      <div className="rpCard">

        <div className="rpIcon">🔐</div>

        <div className="rpHeader">
          <h2 className="rpTitle">ตั้งรหัสผ่านใหม่</h2>
          <p className="rpSubtitle">กรอกรหัสผ่านใหม่ที่ต้องการใช้งาน</p>
        </div>

        {err && <div className="rpAlert rpAlert--error">{err}</div>}

        <form className="rpForm" onSubmit={submit}>

          {/* รหัสผ่านใหม่ */}
          <div className="rpField">
            <label className="rpLabel">รหัสผ่านใหม่</label>
            <div className="rpInputWrap">
              <input
                className="rpInput"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                style={{ paddingRight: "44px" }}
                required
              />
              <button type="button" className="rpEyeBtn" onClick={() => setShowNew(!showNew)}>
                {showNew ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* ยืนยันรหัสผ่าน */}
          <div className="rpField">
            <label className="rpLabel">ยืนยันรหัสผ่านใหม่</label>
            <div className="rpInputWrap">
              <input
                className="rpInput"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                style={{ paddingRight: "44px" }}
                required
              />
              <button type="button" className="rpEyeBtn" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button type="submit" className="rpBtn" disabled={loading}>
            {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
          </button>

        </form>

        <div className="rpFooter">
          <Link to="/login" className="rpLink">← กลับหน้าเข้าสู่ระบบ</Link>
        </div>

      </div>
    </div>
  );
}