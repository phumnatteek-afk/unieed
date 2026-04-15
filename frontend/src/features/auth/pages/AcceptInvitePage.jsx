import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const nav = useNavigate();

  const [info, setInfo] = useState(null);  // { email, school_name, has_account }
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);
  const { logout } = useAuth();

  // เช็ค token และดูว่ามีบัญชีอยู่แล้วไหม
  useEffect(() => {
    if (!token) { nav("/login"); return; }
    (async () => {
      try {
        const data = await request(`/auth/school-admins/check-invite?token=${token}`);
        setInfo(data);
        if (data.user_name) setName(data.user_name);
      } catch (e) {
        setErr(e?.message || "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว");
      } finally { setChecking(false); }
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!info?.has_account && (!name.trim() || !pass)) {
      return setErr("กรุณากรอกข้อมูลให้ครบ");
    }
    try {
      setLoading(true);
      await request("/auth/school-admins/accept-invite", {
        method: "POST",
        body: {
          token,
          user_name: name.trim() || info?.user_name,
          password: pass || "unused",
        },
      });
      setSuccess("เข้าร่วมสำเร็จ! กรุณาเข้าสู่ระบบ");
      logout();
      setTimeout(() => nav("/login"), 2000);
    } catch (e) {
      setErr(e?.message || "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6b7280" }}>กำลังตรวจสอบลิงก์...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#F0F9FF", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "#fff",
        borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,.12)", overflow: "hidden",
      }}>
        <div style={{ background: "#87c7eb", padding: "28px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            ยืนยันการเป็นผู้ดูแลโรงเรียน
          </div>
          {info?.school_name && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.9)", marginTop: 6 }}>
              {info.school_name}
            </div>
          )}
        </div>

          <style>{`.acc-ph::placeholder { color: #B0BEC5; }`}</style>
        <form onSubmit={handleSubmit} style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* มีบัญชีอยู่แล้ว */}
          {info?.has_account ? (
            <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "16px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>คุณมีบัญชีอยู่แล้ว</div>
              <div>อีเมล: <strong>{info.email}</strong></div>
              <div style={{ marginTop: 8, color: "#6b7280" }}>
                กดยืนยันเพื่อเข้าร่วมเป็นผู้ดูแลโรงเรียน แล้ว login ด้วยรหัสผ่านเดิมได้เลยครับ
              </div>
            </div>
          ) : (
            // ยังไม่มีบัญชี — กรอกชื่อ + รหัสผ่าน
            <>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>ชื่อ-นามสกุล</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="กรอกชื่อของคุณ"
                  style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#87c7eb"}
                  onBlur={e => e.target.style.borderColor = "#E5E7EB"}
                />
              </div>
              <div>
  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>รหัสผ่าน</label>
      <div style={{ position: "relative" }}>
        <input value={pass} onChange={e => setPass(e.target.value)}
          placeholder="อย่างน้อย 6 ตัวอักษร"
          type={showPass ? "text" : "password"}
          className="acc-ph"
          style={{ width: "100%", padding: "11px 44px 11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
          onFocus={e => e.target.style.borderColor = "#87c7eb"}
          onBlur={e => e.target.style.borderColor = "#E5E7EB"}
        />
        <button type="button" onClick={() => setShowPass(v => !v)} style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: "#9ca3af",
          display: "flex", alignItems: "center", padding: 0,
        }}>
          <Icon icon={showPass ? "mdi:eye-off-outline" : "mdi:eye-outline"} width="20"/>
        </button>
      </div>
</div>
            </>
          )}

          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              {err}
            </div>
          )}
          {success && (
            <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#16a34a" }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading || !!success} style={{
            padding: "13px", background: "#5285e8", color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "กำลังบันทึก..." : info?.has_account ? "ยืนยันเข้าร่วม" : "ยืนยันและเข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}