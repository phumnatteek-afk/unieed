import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";

export default function AdminLoginPage() {
  const [user_email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();

    const data = await request("/auth/login", {
      method: "POST",
      body: { user_email, password },
      auth: false,
    });

    if (data.role !== "admin") {
      alert("ไม่ใช่ผู้ดูแลระบบ");
      return;
    }

    login(data);
    navigate("/admin/backoffice");
  };

  return (
    <div className="authWrap">
      <div className="authCard">
        <h2>Admin Login</h2>
        {err && <div className="error">{err}</div>}

        <form onSubmit={submit}>
          <input value={user_email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" type="password" />
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
      </div>
    </div>
  );
}
