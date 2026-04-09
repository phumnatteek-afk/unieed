import { useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { request } from "../../../api/http.js";
import { Icon } from "@iconify/react";

export default function ProfileEditPage() {
  const { userName, updateUserName } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(userName || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setSuccess("");
    if (!name.trim()) return setErr("กรุณากรอกชื่อ");
    try {
      setLoading(true);
      const res = await request("/auth/profile", {
        method: "PATCH",
        body: { user_name: name.trim() },
        auth: true,
      });
      updateUserName(res.user_name);
      setSuccess("บันทึกสำเร็จ!");
    } catch (e) {
      setErr(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#F0F4F8",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "#fff", borderRadius: 24,
        boxShadow: "0 4px 32px rgba(0,0,0,.08)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "#29B6E8", padding: "28px 32px",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,255,255,.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid rgba(255,255,255,.5)",
          }}>
            <Icon icon="fluent:person-28-filled" width="40" color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              {userName || "ผู้ใช้"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginTop: 2 }}>
              บุคคลทั่วไป
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 20 }}>
            แก้ไขข้อมูลส่วนตัว
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ชื่อ */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                ชื่อผู้ใช้
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                style={{
                  width: "100%", padding: "11px 14px",
                  border: "1.5px solid #E5E7EB", borderRadius: 10,
                  fontSize: 14, color: "#1a1a2e", outline: "none",
                  boxSizing: "border-box", background: "#F9FAFB",
                  transition: "border-color .15s",
                }}
                onFocus={e => e.target.style.borderColor = "#29B6E8"}
                onBlur={e => e.target.style.borderColor = "#E5E7EB"}
              />
            </div>

            {/* อีเมล */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                อีเมล
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>
                  (ไม่สามารถเปลี่ยนได้)
                </span>
              </label>
              <div style={{
                padding: "11px 14px", border: "1.5px solid #F3F4F6",
                borderRadius: 10, fontSize: 14, color: "#9ca3af",
                background: "#F3F4F6", display: "flex",
                justifyContent: "space-between", alignItems: "center",
              }}>
                <span>ไม่แสดงอีเมล</span>
                <Icon icon="mdi:lock-outline" width="16" color="#9ca3af" />
              </div>
            </div>

            {/* Error / Success */}
            {err && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 13, color: "#dc2626",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Icon icon="mdi:alert-circle" width="16" />
                {err}
              </div>
            )}
            {success && (
              <div style={{
                background: "#F0FDF4", border: "1px solid #86EFAC",
                borderRadius: 10, padding: "10px 14px",
                fontSize: 13, color: "#16a34a",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Icon icon="mdi:check-circle" width="16" />
                {success}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => navigate(-1)}
                style={{
                  flex: 1, padding: "12px",
                  background: "#F3F4F6", color: "#1a1a2e",
                  border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2, padding: "12px",
                  background: "#29B6E8", color: "#fff",
                  border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}