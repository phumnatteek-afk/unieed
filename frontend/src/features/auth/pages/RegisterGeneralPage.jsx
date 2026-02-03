import { useState } from "react";
import { request } from "../../../api/http.js";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

export default function RegisterGeneralPage() {
  const [user_name,setName] = useState("");
  const [user_email,setEmail] = useState("");
  const [password,setPw] = useState("");
  const [err,setErr] = useState("");
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await request("/auth/register/general", { method:"POST", body:{ user_name, user_email, password } });
      nav("/login");
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="authWrap">
      <div className="authCard">
        <h2>ลงทะเบียนบุคคลทั่วไป</h2>
        {err && <div className="error">{err}</div>}
        <form onSubmit={submit}>
          <input value={user_name} onChange={e=>setName(e.target.value)} placeholder="ชื่อผู้ใช้" />
          <input value={user_email} onChange={e=>setEmail(e.target.value)} placeholder="อีเมล" />
          <input value={password} onChange={e=>setPw(e.target.value)} placeholder="รหัสผ่าน" type="password" />
          <button type="submit">ลงทะเบียน</button>
        </form>
      </div>
    </div>
  );
}
