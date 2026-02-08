import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as svc from "../services/auth.service.js";
import "../../auth/styles/auth.css";

export default function RegisterSchoolPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    admin_name: "",
    admin_email: "",
    password: "",
    school_name: "",
    school_address: "",
    school_phone: "",
  });

  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    setLoading(true);

    try {
      // ถ้าคุณทำ “สมัครโรงเรียนครั้งเดียวจบ” ให้ใช้ service นี้
      // และให้ service handle upload/doc เอง หรือส่ง file ไปด้วย (ตามที่คุณทำไว้)
      const res = await svc.registerSchoolOneStep({
        ...form,
        file, // ถ้า service รองรับ
      });

      // ถ้า backend ตอบมาว่า pending
      setOk("ส่งคำขอสำเร็จ กำลังพาไปหน้าตรวจสอบสถานะ...");

      // เด้งไปหน้า pending (หรือหน้าผลลัพธ์ที่คุณมี)
      setTimeout(() => nav("/school/pending"), 600);
    } catch (e2) {
      setErr(e2?.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <h1 className="auth-title">ลงทะเบียนโรงเรียน</h1>
          <p className="auth-subtitle">ยืนยันตัวตนเพื่อเปิดใช้งานบัญชีโรงเรียน</p>
        </div>

        <form className="auth-card__body" onSubmit={onSubmit}>
          <div className="auth-grid">
            {!!err && <div className="auth-alert auth-alert--error">{err}</div>}
            {!!ok && <div className="auth-alert auth-alert--success">{ok}</div>}

            <div className="auth-section">
              <h3>ข้อมูลผู้ดูแลโรงเรียน</h3>
            </div>

            <div className="auth-field">
              <label className="auth-label">ชื่อผู้ดูแล</label>
              <input className="auth-input" name="admin_name" value={form.admin_name} onChange={onChange} placeholder="ชื่อ-นามสกุล" />
            </div>

            <div className="auth-field">
              <label className="auth-label">อีเมล</label>
              <input className="auth-input" name="admin_email" value={form.admin_email} onChange={onChange} placeholder="name@email.com" />
            </div>

            <div className="auth-field">
              <label className="auth-label">รหัสผ่าน</label>
              <input className="auth-input" type="password" name="password" value={form.password} onChange={onChange} placeholder="อย่างน้อย 6 ตัว" />
            </div>

            <div className="auth-helper">
              ใช้อีเมลนี้สำหรับเข้าสู่ระบบในอนาคต
            </div>

            <div className="auth-section">
              <h3>ข้อมูลโรงเรียน</h3>
            </div>

            <div className="auth-field">
              <label className="auth-label">ชื่อโรงเรียน</label>
              <input className="auth-input" name="school_name" value={form.school_name} onChange={onChange} placeholder="ชื่อโรงเรียน" />
            </div>

            <div className="auth-field">
              <label className="auth-label">ที่อยู่โรงเรียน</label>
              <input className="auth-input" name="school_address" value={form.school_address} onChange={onChange} placeholder="เลขที่/ถนน/ตำบล/อำเภอ/จังหวัด" />
            </div>

            <div className="auth-field">
              <label className="auth-label">เบอร์โทร</label>
              <input className="auth-input" name="school_phone" value={form.school_phone} onChange={onChange} placeholder="0xx-xxx-xxxx" />
            </div>

            <div className="auth-field auth-file" style={{ gridColumn: "1 / -1" }}>
              <label className="auth-label">เอกสารยืนยันโรงเรียน (ไฟล์)</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>

            <div className="auth-actions">
              <button className="auth-btn auth-btn--primary" disabled={loading}>
                {loading ? "กำลังส่ง..." : "ส่งคำขอ"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
