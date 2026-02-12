import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as svc from "../services/auth.service.js";
import { uploadSchoolDoc } from "../../../api/upload.js"; // ✅ เพิ่ม
import "../../auth/styles/auth.css";

export default function RegisterSchoolPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    user_name: "",
    user_email: "",
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
      // ✅ step1: upload file (ถ้ามี)
      let doc = { school_doc_url: null, school_doc_public_id: null };
      if (file) {
        setOk("กำลังอัปโหลดเอกสาร...");
        doc = await uploadSchoolDoc(file);
        // ต้องได้ { school_doc_url, school_doc_public_id }
      }

      // ✅ step2: register (ส่ง url/public_id เข้า DB)
      setOk("กำลังส่งคำขอลงทะเบียน...");
      await svc.registerSchoolOneStep({
        ...form,
        ...doc,
      });

      setOk("ส่งคำขอสำเร็จ กำลังพาไปหน้าตรวจสอบสถานะ...");
      setTimeout(() => navigate("/school/pending"), 600);
    } catch (e2) {
      setErr(e2?.data?.message || e2?.message || "ส่งคำขอไม่สำเร็จ");
      setOk("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rsPage">
  <div className="rsCard">
    <header className="rsHeader">
      <h1 className="rsTitle">ลงทะเบียนโรงเรียน</h1>
      <p className="rsSubtitle">ยืนยันตัวตนเพื่อเปิดใช้งานบัญชีโรงเรียน</p>
    </header>

    <form className="rsBody" onSubmit={onSubmit}>
      <div className="rsGrid">
        {!!err && <div className="rsAlert rsAlert--error">{err}</div>}
        {!!ok && <div className="rsAlert rsAlert--success">{ok}</div>}

        <div className="rsSection">
          <h3 className="rsSectionTitle">ข้อมูลผู้ดูแลโรงเรียน</h3>
        </div>

        <div className="rsField">
          <label className="rsLabel">ชื่อผู้ดูแล</label>
          <input
            className="rsInput"
            name="user_name"
            value={form.user_name}
            onChange={onChange}
            placeholder="ชื่อ-นามสกุล"
          />
        </div>

        <div className="rsField">
          <label className="rsLabel">อีเมล</label>
          <input
            className="rsInput"
            name="user_email"
            value={form.user_email}
            onChange={onChange}
            placeholder="name@email.com"
          />
        </div>

        <div className="rsField">
          <label className="rsLabel">รหัสผ่าน</label>
          <input
            className="rsInput"
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            placeholder="อย่างน้อย 6 ตัว"
          />
        </div>

        <div className="rsHelper">ใช้อีเมลนี้สำหรับเข้าสู่ระบบในอนาคต</div>

        <div className="rsSection">
          <h3 className="rsSectionTitle">ข้อมูลโรงเรียน</h3>
        </div>

        <div className="rsField">
          <label className="rsLabel">ชื่อโรงเรียน</label>
          <input
            className="rsInput"
            name="school_name"
            value={form.school_name}
            onChange={onChange}
            placeholder="ชื่อโรงเรียน"
          />
        </div>

        <div className="rsField">
          <label className="rsLabel">ที่อยู่โรงเรียน</label>
          <input
            className="rsInput"
            name="school_address"
            value={form.school_address}
            onChange={onChange}
            placeholder="เลขที่/ถนน/ตำบล/อำเภอ/จังหวัด"
          />
        </div>

        <div className="rsField">
          <label className="rsLabel">เบอร์โทร</label>
          <input
            className="rsInput"
            name="school_phone"
            value={form.school_phone}
            onChange={onChange}
            placeholder="0xx-xxx-xxxx"
          />
        </div>

        <div className="rsField rsField--full">
          <label className="rsLabel">เอกสารยืนยันโรงเรียน (ไฟล์)</label>

          <label className="rsFile">
            <input
              className="rsFileInput"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span className="rsFileBtn">เลือกไฟล์</span>
            <span className="rsFileName">{file?.name || "ยังไม่ได้เลือกไฟล์"}</span>
          </label>
        </div>

        <div className="rsActions">
          <button className="rsBtn rsBtn--primary" disabled={loading}>
            {loading ? "กำลังส่ง..." : "ส่งคำขอ"}
          </button>
        </div>
      </div>
    </form>
  </div>
</div>

  );
}
