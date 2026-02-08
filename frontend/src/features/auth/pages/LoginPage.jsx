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
      const data = await loginService({ user_email, password });

      if (data.requires_school_check) {
        nav("/school/pending", { state: data });
        return;
      }

      login({ token: data.token, role: data.role, user_name: data.user_name });

      if (data.role === "admin") nav("/admin/schools");
      else if (data.role === "school_admin") nav("/school/dashboard");
      else nav("/");
    } catch (e) {
      setErr(e?.data?.message || e.message);
    }
  };

  return (
    <div className="authWrap">
      <div className="authCard">
        <h2>เข้าสู่ระบบ</h2>
        {err && <div className="error">{err}</div>}

        <form onSubmit={submit}>
          <input value={user_email} onChange={(e)=>setEmail(e.target.value)} placeholder="อีเมล" />
          <input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="รหัสผ่าน" type="password" />
          <button type="submit">เข้าสู่ระบบ</button>
        </form>

        <div className="links">
          <a href="/register">ลงทะเบียน</a>
        </div>
      </div>
    </div>
  );
}
