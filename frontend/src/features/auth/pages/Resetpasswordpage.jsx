import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../services/auth.service.js";
import "../styles/auth.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const nav = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

  if (!token) {
    return (
      <div className="lgPage">
        <div className="lgCard">
          <div className="lgAlert lgAlert--error">ลิงก์ไม่ถูกต้อง</div>
          <div className="lgFooter">
            <Link to="/forgot-password" className="lgLink">ขอลิงก์ใหม่</Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="lgPage">
        <div className="lgCard">
          <div className="lgHeader">
            <h2 className="lgTitle">เปลี่ยนรหัสผ่านสำเร็จ</h2>
          </div>
          <div className="lgAlert lgAlert--success">
            รหัสผ่านใหม่ถูกบันทึกแล้ว กำลังพาไปหน้าเข้าสู่ระบบ...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lgPage">
      <div className="lgCard">
        <div className="lgHeader">
          <h2 className="lgTitle">ตั้งรหัสผ่านใหม่</h2>
        </div>

        {err && <div className="lgAlert lgAlert--error">{err}</div>}

        <form className="lgForm" onSubmit={submit}>
          <div className="lgField">
            <label className="lgLabel">รหัสผ่านใหม่</label>
            <input
              className="lgInput"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัว"
              required
            />
          </div>

          <div className="lgField">
            <label className="lgLabel">ยืนยันรหัสผ่านใหม่</label>
            <input
              className="lgInput"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="lgBtn" disabled={loading}>
            {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
          </button>
        </form>
      </div>
    </div>
  );
}