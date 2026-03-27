import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as svc from "../services/auth.service.js";
import { uploadSchoolDoc, uploadSchoolLogo } from "../../../api/upload.js";
import "../../auth/styles/auth.css";

function normalizeThaiPhone(input) {
  if (!input) return null;
  let raw = String(input).replace(/\D/g, "");
  if (raw.startsWith("66") && raw.length === 11) raw = "0" + raw.slice(2);
  if (raw.length === 9) raw = "0" + raw;
  return raw;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function StepBar({ step, total = 3 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const active = step >= n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              border: `2px solid ${active ? "#5285E8" : "#d1d5db"}`,
              background: active ? "#5285E8" : "#fff",
              color: active ? "#fff" : "#9ca3af",
              fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.3s",
            }}>{n}</div>
            {i < total - 1 && (
              <div style={{
                width: 36, height: 2, margin: "0 6px",
                background: step > n ? "#5285E8" : "#e5e7eb",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RegisterSchoolPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    user_name: "", user_email: "", password: "",
    school_name: "", school_address: "", school_phone: "",
    school_code: "", school_intent: "",
  });

  const [file, setFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onPhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, "");
    const maxLen = val.startsWith("02") ? 9 : 10;
    if (val.length > maxLen) return;
    setForm((prev) => ({ ...prev, school_phone: val }));
  };

  const goBack = () => { setStep((s) => s - 1); setErr(""); setOk(""); };

  const handleStep1 = (e) => {
    e.preventDefault(); setErr("");
    const n = form.user_name?.trim(), em = form.user_email?.trim().toLowerCase(), pw = form.password || "";
    if (!n || !em || !pw) { setErr("กรุณากรอกข้อมูลให้ครบ"); return; }
    if (!isValidEmail(em)) { setErr("รูปแบบอีเมลไม่ถูกต้อง"); return; }
    if (pw.length < 6) { setErr("รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร"); return; }
    setStep(2);
  };

  const handleStep2 = (e) => {
    e.preventDefault(); setErr("");
    
    // Check basic required fields
    if (!form.school_name?.trim() || !form.school_address?.trim()) { 
      setErr("กรุณากรอกข้อมูลโรงเรียนให้ครบ"); 
      return; 
    }

    // ---------- Phone validation ----------
    const normalizedPhone = normalizeThaiPhone(form.school_phone);
    if (!normalizedPhone || !/^(02\d{7}|0[3-9]\d{8})$/.test(normalizedPhone)) {
      setErr("เบอร์โทรไม่ถูกต้อง (02xxxxxxx หรือ 08xxxxxxxx)");
      return;
    }

    // ---------- School Code validation ----------
    const schoolCodeDigits = String(form.school_code || "").replace(/\D/g, "");
    if (!schoolCodeDigits) {
      setErr("กรุณากรอกรหัสสถานศึกษา");
      return;
    }

    setStep(3);
  };

  const onSubmit = async (e) => {
    e.preventDefault(); setErr(""); setOk(""); setLoading(true);
    try {
      let doc = { school_doc_url: null, school_doc_public_id: null };
      let logo = { school_logo_url: null, school_logo_public_id: null };
      if (file) { setOk("กำลังอัปโหลดรูปโรงเรียน..."); doc = await uploadSchoolDoc(file); }
      if (logoFile) { setOk("กำลังอัปโหลดตราโรงเรียน..."); logo = await uploadSchoolLogo(logoFile); }
      setOk("กำลังส่งคำขอลงทะเบียน...");
      await svc.registerSchoolOneStep({
        ...form,
        user_name: form.user_name.trim(),
        user_email: form.user_email.trim().toLowerCase(),
        school_phone: normalizeThaiPhone(form.school_phone),
        school_code: String(form.school_code || "").replace(/\D/g, ""),
        ...doc, ...logo,
      });
      setOk("ส่งคำขอสำเร็จ กำลังพาไปหน้าตรวจสอบสถานะ...");
      setTimeout(() => navigate("/school/pending"), 600);
    } catch (e2) {
      setErr(e2?.data?.message || e2?.message || "ส่งคำขอไม่สำเร็จ");
      setOk("");
    } finally { setLoading(false); }
  };

  // icons
  const icoUser = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
  const icoMail = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
  const icoLock = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
  const icoHome = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  const icoPin = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
  const icoArrow = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
  const eyeOff = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="m18.922 16.8l3.17 3.17l-1.06 1.061L4.06 4.061L5.12 3l2.74 2.738A11.9 11.9 0 0 1 12 5c4.808 0 8.972 2.848 11 7a12.66 12.66 0 0 1-4.078 4.8m-8.098-8.097l4.473 4.473a3.5 3.5 0 0 0-4.474-4.474zm5.317 9.56A11.9 11.9 0 0 1 12 19c-4.808 0-8.972-2.848-11-7a12.66 12.66 0 0 1 4.078-4.8l3.625 3.624a3.5 3.5 0 0 0 4.474 4.474l2.964 2.964z"/></svg>;
  const eyeOn = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M1 12c2.028-4.152 6.192-7 11-7s8.972 2.848 11 7c-2.028 4.152-6.192 7-11 7s-8.972-2.848-11-7m11 3.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7"/></svg>;
  const iconNumber = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M13.003 7.754a.75.75 0 0 1 .75-.75h5.232a.75.75 0 0 1 .53 1.28l-2.776 2.777c.55.097 1.057.253 1.492.483c.905.477 1.504 1.284 1.504 2.418c0 .966-.471 1.75-1.172 2.27c-.687.511-1.587.77-2.521.77c-1.367 0-2.274-.528-2.667-.756a.75.75 0 0 1 .755-1.297c.331.193.953.553 1.912.553c.673 0 1.243-.188 1.627-.473c.37-.275.566-.635.566-1.067c0-.5-.219-.836-.703-1.091c-.538-.284-1.375-.443-2.471-.443a.75.75 0 0 1-.53-1.28l2.643-2.644h-3.421a.75.75 0 0 1-.75-.75M7.88 15.215a1.4 1.4 0 0 0-1.446.83a.75.75 0 0 1-1.37-.61a2.9 2.9 0 0 1 2.986-1.71c.589.06 1.139.323 1.557.743c.434.446.685 1.058.685 1.778c0 1.641-1.254 2.437-2.12 2.986c-.538.341-1.18.694-1.495 1.273H9.75a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75c0-1.799 1.337-2.63 2.243-3.21c1.032-.659 1.55-1.031 1.55-1.8c0-.355-.116-.584-.26-.732a1.07 1.07 0 0 0-.652-.298Zm.234-13.121a.75.75 0 0 1 .386.656V9h1.252a.75.75 0 0 1 0 1.5H5.75a.75.75 0 0 1 0-1.5H7V4.103l-.853.533a.749.749 0 1 1-.795-1.272l2-1.25a.75.75 0 0 1 .762-.02"/></svg>
  const iconPhone = <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M5.733 2.043c1.217-1.21 3.221-.995 4.24.367l1.262 1.684c.83 1.108.756 2.656-.229 3.635l-.238.238a.65.65 0 0 0-.008.306c.063.408.404 1.272 1.832 2.692s2.298 1.76 2.712 1.824a.7.7 0 0 0 .315-.009l.408-.406c.876-.87 2.22-1.033 3.304-.444l1.91 1.04c1.637.888 2.05 3.112.71 4.445l-1.421 1.412c-.448.445-1.05.816-1.784.885c-1.81.169-6.027-.047-10.46-4.454c-4.137-4.114-4.931-7.702-5.032-9.47l.749-.042l-.749.042c-.05-.894.372-1.65.91-2.184zm3.04 1.266c-.507-.677-1.451-.731-1.983-.202l-1.57 1.56c-.33.328-.488.69-.468 1.036c.08 1.405.72 4.642 4.592 8.492c4.062 4.038 7.813 4.159 9.263 4.023c.296-.027.59-.181.865-.454l1.42-1.413c.578-.574.451-1.62-.367-2.064l-1.91-1.039c-.528-.286-1.146-.192-1.53.19l-.455.453l-.53-.532c.53.532.529.533.528.533l-.001.002l-.003.003l-.007.006l-.015.014a1 1 0 0 1-.136.106c-.08.053-.186.112-.319.161c-.27.101-.628.155-1.07.087c-.867-.133-2.016-.724-3.543-2.242c-1.526-1.518-2.122-2.66-2.256-3.526c-.069-.442-.014-.8.088-1.07a1.5 1.5 0 0 1 .238-.42l.032-.035l.014-.015l.006-.006l.003-.003l.002-.002l.53.53l-.53-.531l.288-.285c.428-.427.488-1.134.085-1.673z" clip-rule="evenodd"/></svg>
  const stepMeta = [
    { title: "ข้อมูลผู้ดูแลโรงเรียน", sub: "กรอกข้อมูลผู้รับผิดชอบบัญชีนี้" },
    { title: "ข้อมูลโรงเรียน", sub: "กรอกรายละเอียดของสถานศึกษา" },
    { title: "เอกสาร & เหตุผล", sub: "แนบไฟล์และระบุวัตถุประสงค์" },
  ];

  return (
    <div className="rsPage rsPageGradient">
      <div className="lgCard rsCard2">
        
        {/* ===== ฟอร์ม (ซ้าย) ===== */}
        <div className="lgRightPanel rsFormPanel">
          <StepBar step={step} total={3} />
          
          <div className="lgHeader">
            <h2 className="lgTitle">{stepMeta[step - 1].title}</h2>
            <p className="lgSubtitle">{stepMeta[step - 1].sub}</p>
          </div>

          {err && <div className="lgAlert lgAlert--error">{err}</div>}
          {ok && <div className="lgAlert lgAlert--success">{ok}</div>}

          {/* ──── STEP 1 ──── */}
          {step === 1 && (
            <form className="lgForm" onSubmit={handleStep1}>
              <div className="lgField">
                <label className="lgLabel">ชื่อผู้ดูแล</label>
                <div className="lgInputWrap">
                  <span className="lgInputIcon">{icoUser}</span>
                  <input className="lgInput" name="user_name" value={form.user_name} onChange={onChange} placeholder="ชื่อ-นามสกุล" />
                </div>
              </div>
              <div className="lgField">
                <label className="lgLabel">อีเมล</label>
                <div className="lgInputWrap">
                  <span className="lgInputIcon">{icoMail}</span>
                  <input className="lgInput" name="user_email" value={form.user_email} onChange={onChange} placeholder="name@email.com" inputMode="email" />
                </div>
              </div>
              <div className="lgField">
                <label className="lgLabel">รหัสผ่าน</label>
                <div className="lgInputWrap" style={{ position: "relative" }}>
                  <span className="lgInputIcon">{icoLock}</span>
                  <input className="lgInput" type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={onChange} placeholder="อย่างน้อย 6 ตัว" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#888" }}>
                    {showPassword ? eyeOff : eyeOn}
                  </button>
                </div>
              </div>
              <button className="lgBtn" type="submit" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 , boxShadow: "none"}}>
                ถัดไป {icoArrow}
              </button>
            </form>
          )}

          {/* ──── STEP 2 ──── */}
{step === 2 && (
  <form className="lgForm rsSchoolForm" onSubmit={handleStep2}>
    <div className="lgField">
      <label className="lgLabel">ชื่อโรงเรียน</label>
      <div className="lgInputWrap">
        <span className="lgInputIcon">{icoHome}</span>
        <input className="lgInput" name="school_name" value={form.school_name} onChange={onChange} placeholder="ชื่อโรงเรียน" />
      </div>
    </div>
    
    <div className="rsSchoolRow" style={{ display: "flex", gap: "15px" }}>
      <div className="lgField" style={{ flex: 1 }}>
        <label className="lgLabel">รหัสสถานศึกษา</label>
        <div className="lgInputWrap">
          <span className="lgInputIcon">{iconNumber}</span>
          <input 
            className="lgInput" 
            name="school_code" 
            value={form.school_code} 
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, ""); // กรองเอาเฉพาะตัวเลข
              if (val.length > 10) return; // จำกัด 10 หลัก
              setForm((prev) => ({ ...prev, school_code: val }));
            }} 
            placeholder="รหัสสถานศึกษา" 
            inputMode="numeric"
          />
        </div>
        <div style={{ fontSize: "12px", color: "#6b7270", marginTop: "4px" }}>กรอกเฉพาะตัวเลข ไม่เกิน 10 หลัก</div>
      </div>
      
      <div className="lgField" style={{ flex: 1 }}>
  <label className="lgLabel">เบอร์โทร</label>
  <div className="lgInputWrap">
    <span className="lgInputIcon">{iconPhone}</span>
    <input 
      className="lgInput" 
      name="school_phone" 
      value={form.school_phone} 
      onChange={onPhoneChange} 
      placeholder="02xxxxxxx" 
    />
  </div>
</div>
    </div>

    <div className="lgField">
      <label className="lgLabel">ที่อยู่โรงเรียน</label>
      <div className="lgInputWrap">
        <span className="lgInputIcon">{icoPin}</span>
        <input className="lgInput" name="school_address" value={form.school_address} onChange={onChange} placeholder="ที่อยู่..." />
      </div>
    </div>

    <div className="rsStep2Actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: "20px" }}>
      <button type="button" className="rsBackBtn" onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}>
        ← ย้อนกลับ
      </button>
      <button className="lgBtn rsSubmitBtn" type="submit" style={{ display: "flex", alignItems: "center", gap: 8 , boxShadow: "none"}}>
        ถัดไป {icoArrow}
      </button>
    </div>
  </form>
)}

          {/* ──── STEP 3 ──── */}
          {step === 3 && (
            <form className="lgForm rsSchoolForm" onSubmit={onSubmit}>
              <div className="lgField">
  <label className="lgLabel">ตราโรงเรียน (ไฟล์รูป)</label>
  <label className="rsFile" style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    cursor: 'pointer',
    border: '1px solid #ccc',
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: '#fff'
  }}>
    <input
      type="file"
      accept="image/*"
      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
      style={{ display: 'none' }} // *** ซ่อน input จริงไว้
    />
    <span className="rsFileBtn" style={{
      backgroundColor: '#5285e8',
      padding: '4px 12px',
      borderRadius: '999px',
      border: '1px solid #ddd',
      fontSize: '14px'
    }}>
      เลือกไฟล์
    </span>
    <span className="rsFileName" style={{ fontSize: '14px', color: '#666' }}>
      {logoFile?.name || "ยังไม่ได้เลือกไฟล์"}
    </span>
  </label>
</div>
              <div className="lgField">
  <label className="lgLabel">รูปภาพโรงเรียน</label>
  
  {/* เราใช้ <label> มาครอบ UI ทั้งหมด เพื่อให้เวลาคลิกตรงไหนก็ได้ (เช่น คำว่า เลือกไฟล์) หน้าต่างเลือกไฟล์ก็จะเปิดขึ้นมาครับ */}
  <label className="rsFileWrap" style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    cursor: 'pointer',
    border: '1px solid #d1d5db',
    padding: '8px',
    borderRadius: '999px',
    backgroundColor: '#fff',
    minHeight: '42px' // ปรับความสูงให้พอดีกับช่อง Input อื่นๆ
  }}>
    
    {/* 1. ซ่อน Input จริงทิ้งไปเลยครับ */}
    <input
      type="file"
      accept="image/*,application/pdf"
      onChange={(e) => setFile(e.target.files?.[0] || null)}
      style={{ display: 'none' }} // *** สำคัญมาก: ซ่อน UI เดิมของระบบ
    />
    
    {/* 2. สร้างปุ่มปลอมขึ้นมา */}
    <span className="rsFileBtn" style={{
      backgroundColor: '#5285e8', // สีเทาอ่อนๆ เหมือนปุ่ม Choose File
      padding: '5px 15px',
      borderRadius: '999px',
      border: '1px solid #d1d5db',
      fontSize: '14px',
      color: '#fff'
    }}>
      เลือกไฟล์
    </span>
    
    {/* 3. แสดงชื่อไฟล์หรือข้อความ "ยังไม่ได้เลือกไฟล์" เอง */}
    <span className="rsFileName" style={{ 
      fontSize: '14px', 
      color: '#666', 
      overflow: 'hidden', // กันชื่อไฟล์ยาวเกินไป
      textOverflow: 'ellipsis', 
      whiteSpace: 'nowrap'
    }}>
      {file?.name || "ยังไม่ได้เลือกไฟล์"}
    </span>
    
  </label>
</div>
              <div className="lgField">
                <label className="lgLabel">เหตุผลที่เข้าร่วม</label>
                <textarea className="rsTextarea" name="school_intent" value={form.school_intent} onChange={onChange} rows={4} placeholder="..." />
              </div>
              <div className="rsStep2Actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: "20px" }}>
                <button type="button" className="rsBackBtn" onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#666", boxShadow:"none" }}>
                  ← ย้อนกลับ
                </button>
                <button className="lgBtn rsSubmitBtn" type="submit" style={{boxShadow:"none"}} disabled={loading}>
                  {loading ? "กำลังส่ง..." : "ส่งคำขอลงทะเบียน"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ===== แผงสีฟ้า (ขวา) ===== */}
        <div className="lgLeftPanel">
          <div className="lgBgImage" />
          <img className="lgLogo" src="/src/unieed_pic/logo1.png" alt="Unieed" />
          <div className="lgWelcomeBlock">
            <div className="lgWelcomeTitle">ลงทะเบียนโรงเรียน</div>
            <div className="lgWelcomeSub">
              เปิดโครงการขอรับบริจาค<br />จัดการบัญชีและโครงการ
            </div>
          </div>
          <div className="lgBadge">
            <div className="lgBadgeText">
              " ยืนยันตัวตนเพื่อเปิดใช้งาน<br />บัญชีโรงเรียน <span>"</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}