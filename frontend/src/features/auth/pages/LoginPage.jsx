import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { login as loginService } from "../services/auth.service.js";
import "../styles/auth.css";

export default function LoginPage() {
  const [user_email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const nav = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const res = await loginService({ user_email, password }); // ✅ ใช้ res

      // ✅ ถ้าโรงเรียนยังไม่ผ่านการอนุมัติ → ไปหน้า pending พร้อม state
      if (res?.requires_school_check) {
        nav("/school/pending", {
          state: {
            status: res.verification_status,
            note: res.verification_note,
          },
        });
        return;
      }

      // ✅ login ปกติ
      login({ token: res.token, role: res.role, user_name: res.user_name });

      if (res.role === "admin") nav("/admin/schools");
      else if (res.role === "school_admin") nav("/school/welcome");
      else nav("/");
    } catch (e2) {
      setErr(e2?.data?.message || e2?.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  };

  return (
   <div className="lgPage">
  <div className="lgCard">
    <div className="lgHeader">
      <h2 className="lgTitle">เข้าสู่ระบบ</h2>
      {/* <p className="lgSubtitle">กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p> */}
    </div>

    {err && <div className="lgAlert lgAlert--error">{err}</div>}

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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          type="password"
        />
      </div>

      <button type="submit" className="lgBtn">
        เข้าสู่ระบบ
      </button>
    </form>

    <div className="lgFooter">
      ยังไม่มีบัญชี? |
      <a href="/register" className="lgLink">
        ลงทะเบียน
      </a>
    </div>
  </div>
</div>
  );
}
