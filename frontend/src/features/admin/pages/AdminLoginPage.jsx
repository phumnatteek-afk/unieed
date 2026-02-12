import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/admin.css"; // ถ้ามีไฟล์ css ของ admin login

export default function AdminLoginPage() {
  const [user_email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); // ✅ เพิ่ม err

  const navigate = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: { user_email, password },
        auth: false,
      });

      if (data.role !== "admin") {
        setErr("บัญชีนี้ไม่ใช่ผู้ดูแลระบบ");
        return;
      }

      // ✅ ส่งให้ตรงกับ AuthContext: login({token, role, user_name})
      login({ token: data.token, role: data.role, user_name: data.user_name });

      navigate("/admin/backoffice", { replace: true });
    } catch (e) {
      setErr(e?.data?.message || e.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  };

  return (
    <div className="adLgPage">
  <div className="adLgCard">
    <div className="adLgHeader">
      <h2 className="adLgTitle">Admin Login</h2>
      <p className="adLgSubtitle">เข้าสู่ระบบสำหรับผู้ดูแลระบบ</p>
    </div>

    {err && <div className="adLgAlert">{err}</div>}

    <form className="adLgForm" onSubmit={submit}>
      <div className="adLgField">
        <label className="adLgLabel">อีเมล</label>
        <input
          className="adLgInput"
          value={user_email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@email.com"
        />
      </div>

      <div className="adLgField">
        <label className="adLgLabel">รหัสผ่าน</label>
        <input
          className="adLgInput"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          type="password"
        />
      </div>

      <button className="adLgBtn" type="submit">
        เข้าสู่ระบบ
      </button>
    </form>
  </div>
</div>

  );
}
