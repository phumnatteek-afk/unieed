import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../../../api/http.js";
import "../styles/auth.css";

export default function RegisterGeneralPage() {
  const navigate = useNavigate();

  const [user_name, setUserName] = useState("");
  const [user_email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      await request("/auth/register/general", {
        method: "POST",
        body: { user_name, user_email, password },
        auth: false,
      });

      alert("สมัครสมาชิกสำเร็จ");
      navigate("/login");
    } catch (e) {
      setErr(e?.data?.message || e.message);
    }
  };

  return (
 <div className="auth-page">
    {/* <div className="authWrap"> */}
      <div className="authCard">
        <h2>สมัครสมาชิก</h2>
        {err && <div className="error">{err}</div>}

        <form onSubmit={submit}>
          <input
            placeholder="ชื่อผู้ใช้"
            value={user_name}
            onChange={(e) => setUserName(e.target.value)}
          />
          <input
            placeholder="อีเมล"
            value={user_email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">ลงทะเบียน</button>
        </form>
      </div>
    </div>
  );
}
