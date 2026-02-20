import { useState } from "react";
import { useNavigate } from "react-router-dom";
// import { request } from "../../../api/http.js";
import * as svc from "../services/auth.service.js"; // ปรับ path ให้ตรง



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
    await svc.registerGeneral({ user_name, user_email, password });

    alert("สมัครสมาชิกสำเร็จ");
    navigate("/login");
  } catch (e) {
    setErr(e?.data?.message || e.message);
  }
};


  return (
 <div className="lgPage">
  <div className="lgCard">
    <div className="lgHeader">
      <h2 className="lgTitle">สมัครสมาชิก</h2>
      <p className="lgSubtitle">กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้</p>
    </div>

    {err && <div className="lgAlert lgAlert--error">{err}</div>}

    <form className="lgForm" onSubmit={submit}>
      <div className="lgField">
        <label className="lgLabel">ชื่อผู้ใช้</label>
        <input
          className="lgInput"
          placeholder="ชื่อผู้ใช้"
          value={user_name}
          onChange={(e) => setUserName(e.target.value)}
        />
      </div>

      <div className="lgField">
        <label className="lgLabel">อีเมล</label>
        <input
          className="lgInput"
          placeholder="name@email.com"
          value={user_email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="lgField">
        <label className="lgLabel">รหัสผ่าน</label>
        <input
          className="lgInput"
          type="password"
          placeholder="อย่างน้อย 6 ตัว"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button className="lgBtn" type="submit">
        ลงทะเบียน
      </button>
    </form>

    <div className="lgFooter">
      มีบัญชีแล้ว?
      <a className="lgLink" href="/login">
        เข้าสู่ระบบ
      </a>
    </div>
  </div>
</div>

  );
}
