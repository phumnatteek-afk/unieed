// src/features/auth/pages/AcceptInvitePage.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { request } from "../../../api/http.js";

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) nav("/login");
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !pass) return setErr("กรุณากรอกข้อมูลให้ครบ");
    try {
      setLoading(true);
      await request("/auth/school-admins/accept-invite", {
        method: "POST",
        body: { token, user_name: name.trim(), password: pass },
      });
      nav("/login?msg=invite_accepted");
    } catch (e) {
      setErr(e?.message || "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  };

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
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>ยืนยันการเป็นผู้ดูแลโรงเรียน</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginTop: 6 }}>
            ตั้งชื่อและรหัสผ่านเพื่อเข้าสู่ระบบ
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 16 }}>
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
            <input value={pass} onChange={e => setPass(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" type="password"
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "#87c7eb"}
              onBlur={e => e.target.style.borderColor = "#E5E7EB"}
            />
          </div>
          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              {err}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            padding: "13px", background: "#5285e8", color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "กำลังบันทึก..." : "ยืนยันและเข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}