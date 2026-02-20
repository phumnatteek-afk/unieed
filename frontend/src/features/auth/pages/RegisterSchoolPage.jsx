import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as svc from "../services/auth.service.js";
// import { request } from "../../../api/http.js";

import { uploadSchoolDoc, uploadSchoolLogo } from "../../../api/upload.js"; // ✅ เพิ่มโลโก้
import "../../auth/styles/auth.css";

function normalizeThaiPhone(input) {
  if (!input) return null;

  let raw = String(input).replace(/\D/g, "");

  if (raw.startsWith("66") && raw.length === 11) {
    raw = "0" + raw.slice(2);
  }

  if (raw.length === 9) {
    raw = "0" + raw;
  }

  return raw;
}


export default function RegisterSchoolPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    user_name: "",
    user_email: "",
    password: "",
    school_name: "",
    school_address: "",
    school_phone: "",
    school_code: "",      // ✅ รหัสสถานศึกษา
    school_intent: "",
  });

  const [file, setFile] = useState(null);       // เอกสารยืนยันโรงเรียน
  const [logoFile, setLogoFile] = useState(null); // ✅ โลโก้โรงเรียน

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
    // ---------- Required basic fields ----------
    if (!form.user_name || !form.user_email || !form.password) {
      setErr("กรุณากรอกข้อมูลผู้ดูแลให้ครบ");
      return;
    }

    if (!form.school_name || !form.school_address) {
      setErr("กรุณากรอกข้อมูลโรงเรียนให้ครบ");
      return;
    }

    // ---------- Phone validation ----------
    const normalizedPhone = normalizeThaiPhone(form.school_phone);

    if (!normalizedPhone || !/^0\d{9}$/.test(normalizedPhone)) {
      setErr("เบอร์โทรต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0");
      return;
    }

    // ---------- School Code validation ----------
    const schoolCodeDigits = String(form.school_code || "").replace(/\D/g, "");

    if (!/^\d{10}$/.test(schoolCodeDigits)) {
      setErr("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี");
      return;
    }

    // ---------- Upload doc ----------
    let doc = { school_doc_url: null, school_doc_public_id: null };
    if (file) {
      setOk("กำลังอัปโหลดเอกสาร...");
      doc = await uploadSchoolDoc(file);
    }

    // ---------- Upload logo ----------
    let logo = { school_logo_url: null, school_logo_public_id: null };
    if (logoFile) {
      setOk("กำลังอัปโหลดโลโก้...");
      logo = await uploadSchoolLogo(logoFile);
    }

    // ---------- Register ----------
    setOk("กำลังส่งคำขอลงทะเบียน...");
    await svc.registerSchoolOneStep({
      ...form,
      school_phone: normalizedPhone,
      school_code: schoolCodeDigits,
      ...doc,
      ...logo,
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

            {/* ✅ เพิ่ม: รหัสสถานศึกษา */}
            <div className="rsField">
              <label className="rsLabel">รหัสสถานศึกษา</label>
              <input
                className="rsInput"
                name="school_code"
                value={form.school_code}
                onChange={onChange}
                placeholder="เช่น 10 หลัก / ตามรหัสของโรงเรียน"
              />
              <div className="rsHelper">กรอกเพื่อให้ตรวจสอบและอ้างอิงได้ง่ายขึ้น</div>
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

            {/* ✅ เพิ่ม: อัปโหลดโลโก้ */}
            <div className="rsField rsField--full">
              <label className="rsLabel">ตราโรงเรียน (ไฟล์รูป)</label>

              <label className="rsFile">
                <input
                  className="rsFileInput"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                <span className="rsFileBtn">เลือกไฟล์</span>
                <span className="rsFileName">{logoFile?.name || "ยังไม่ได้เลือกไฟล์"}</span>
              </label>

              {logoFile && (
                <div className="rsHelper">
                  แนะนำไฟล์ .png/.jpg ขนาดไม่เกิน ~2MB
                </div>
              )}
            </div>

            <div className="rsField rsField--full">
              <label className="rsLabel">รูปภาพโรงเรียน (ไฟล์)</label>

              <label className="rsFile">
                <input
                  className="rsFileInput"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <span className="rsFileBtn">เลือกไฟล์</span>
                <span className="rsFileName">{file?.name || "ยังไม่ได้เลือกไฟล์"}</span>
              </label>
              {logoFile && (
                <div className="rsHelper">
                  แนะนำไฟล์ .png/.pdf
                </div>
              )}
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
