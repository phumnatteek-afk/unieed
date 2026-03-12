import { useState } from "react";
import { Link } from "react-router-dom";
import { resendVerification } from "../services/auth.service.js";
import "../styles/auth.css";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await resendVerification({ user_email: email });
      setSent(true);
    } catch (e2) {
      setErr(e2?.data?.message || e2?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="lgPage">
        <div className="lgCard">
          <div className="lgHeader">
            <h2 className="lgTitle">ตรวจสอบอีเมลของคุณ</h2>
          </div>
          <div className="lgAlert lgAlert--success">
            หากอีเมล <strong>{email}</strong> ถูกต้อง คุณจะได้รับอีเมลยืนยันใหม่
            กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์ spam)
          </div>
          <div className="lgFooter" style={{ marginTop: "24px" }}>
            <Link to="/login" className="lgLink">กลับหน้าเข้าสู่ระบบ</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lgPage">
      <div className="lgCard">
        <div className="lgHeader">
          <h2 className="lgTitle">ขอส่งอีเมลยืนยันใหม่</h2>
          <p className="lgSubtitle">กรอกอีเมลที่ใช้สมัครสมาชิก</p>
        </div>

        {err && <div className="lgAlert lgAlert--error">{err}</div>}

        <form className="lgForm" onSubmit={submit}>
          <div className="lgField">
            <label className="lgLabel">อีเมล</label>
            <input
              className="lgInput"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              required
            />
          </div>

          <button type="submit" className="lgBtn" disabled={loading}>
            {loading ? "กำลังส่ง..." : "ส่งอีเมลยืนยันใหม่"}
          </button>
        </form>

        <div className="lgFooter">
          <Link to="/login" className="lgLink">← กลับหน้าเข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}