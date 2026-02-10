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
    <div className="authWrap">
      <div className="authCard">
        <h2>Admin Login</h2>
        {err && <div className="error">{err}</div>}

        <form onSubmit={submit}>
          <input
            value={user_email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน"
            type="password"
          />
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
      </div>
    </div>
  );
}
