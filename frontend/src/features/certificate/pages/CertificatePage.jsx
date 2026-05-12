import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import Navbar from "../../../pages/Navbar.jsx";
import "../../../pages/styles/Homepage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function formatThaiDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function CertificatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null); // cert ที่กำลัง preview

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE}/certificates/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const data = await res.json();
        setCerts(data);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="homePage">
      {/* Navbar */}
      <Navbar activeLink="" />

      <div style={{ background: "#87C7EB", height: 8, width: "100vw", marginLeft: "calc(-50vw + 50%)" }} />

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
            ประกาศนียบัตรของฉัน
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
            ใบเกียรติบัตรที่ได้รับจากการบริจาคทั้งหมด
            {certs.length > 0 && (
              <span style={{
                background: "#FC8D1F", color: "#fff",
                fontWeight: 700, fontSize: 15,
                borderRadius: 999, padding: "3px 14px",
              }}>
                {certs.length} ใบ
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>
            <Icon icon="mdi:loading" width="36" color="#29B6E8"
              style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: 12 }}>กำลังโหลด...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {err && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 12, padding: "16px 20px",
            color: "#DC2626", fontSize: 14,
          }}>
            {err}
          </div>
        )}

        {/* Empty */}
        {!loading && !err && certs.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "#fff", borderRadius: 20,
            boxShadow: "0 2px 16px rgba(0,0,0,.06)",
          }}>
            <Icon icon="mdi:certificate-outline" width="52" color="#D1D5DB" />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#6b7280", marginTop: 16 }}>
              ยังไม่มีประกาศนียบัตร
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>
              บริจาคชุดนักเรียนและรอโรงเรียนยืนยันรับของ
            </div>
            <button
              onClick={() => navigate("/projects")}
              style={{
                marginTop: 20, padding: "10px 24px",
                background: "#29B6E8", color: "#fff",
                border: "none", borderRadius: 12,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              ดูโครงการทั้งหมด
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && !err && certs.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {certs.map((c) => (
              <div key={c.certificate_id} style={{
                background: "#fff", borderRadius: 16,
                boxShadow: "0 2px 16px rgba(0,0,0,.06)",
                overflow: "hidden", border: "1px solid #F3F4F6",
              }}>
                {/* รูปใบเซอร์ */}
                <div
                  onClick={() => setPreview(c)}
                  style={{
                    width: "100%", height: 180,
                    background: "#F3F4F6", cursor: "pointer",
                    overflow: "hidden", position: "relative",
                  }}
                >
                  {c.certificate_url
                    ? <img src={c.certificate_url} alt="ใบเกียรติบัตร"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
                      }}>
                        <Icon icon="mdi:certificate" width="60" color="#93C5FD" />
                      </div>
                    )
                  }
                  {/* Hover overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity .2s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  >
                    <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon icon="mdi:eye-outline" width="20" />
                      ดูใบเกียรติบัตร
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: "16px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
                    {c.project_title || c.school_name}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                    {c.school_name} · {formatThaiDate(c.issued_at)}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
                    {c.items_summary}
                  </div>

                  {/* Cert code */}
                  <div style={{
                    background: "#F9FAFB", borderRadius: 8, padding: "6px 10px",
                    fontSize: 11, color: "#6b7280", fontFamily: "monospace",
                    marginBottom: 12,
                  }}>
                    รหัส: {c.certificate_code}
                  </div>

                  {/* Buttons */}
<div style={{ display: "flex", gap: 8 }}>
  {c.certificate_url && (
    <a  
      href={c.certificate_url}
      download
      target="_blank"
      rel="noreferrer"
      style={{
        flex: 1, padding: "9px",
        background: "#EFF6FF", color: "#378ADD",
        border: "none", borderRadius: 10,
        fontSize: 12, fontWeight: 600,
        cursor: "pointer", textDecoration: "none",
        display: "flex", alignItems: "center",
        justifyContent: "center", gap: 6,
      }}
    >
      <Icon icon="mdi:image-outline" width="16" />
      รูปภาพ
    </a>
  )}
  {c.pdf_url && (
    <a 
      href={c.pdf_url}
      download
      target="_blank"
      rel="noreferrer"
      style={{
        flex: 1, padding: "9px",
        background: "#FEF2F2", color: "#DC2626",
        border: "none", borderRadius: 10,
        fontSize: 12, fontWeight: 600,
        cursor: "pointer", textDecoration: "none",
        display: "flex", alignItems: "center",
        justifyContent: "center", gap: 6,
      }}
    >
      <Icon icon="mdi:file-pdf-box" width="16" />
      PDF
    </a>
  )}
</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,.8)",
            display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 9999, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20,
              overflow: "hidden", maxWidth: 600, width: "100%",
              boxShadow: "0 8px 40px rgba(0,0,0,.3)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid #F3F4F6",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
                ใบเกียรติบัตร
              </div>
              <button
                onClick={() => setPreview(null)}
                style={{
                  background: "#F3F4F6", border: "none",
                  borderRadius: "50%", width: 32, height: 32,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer",
                }}
              >
                <Icon icon="mdi:close" width="18" />
              </button>
            </div>

            {/* Image */}
            {preview.certificate_url && (
              <img
                src={preview.certificate_url}
                alt="ใบเกียรติบัตร"
                style={{ width: "100%", display: "block" }}
              />
            )}

            {/* Actions */}
            <div style={{ padding: "16px 20px", display: "flex", gap: 10 }}>
              {preview.certificate_url && (
                <a href={preview.certificate_url} download target="_blank" rel="noreferrer"
                  style={{
                    flex: 1, padding: "11px",
                    background: "#EFF6FF", color: "#378ADD",
                    border: "none", borderRadius: 12,
                    fontSize: 13, fontWeight: 600,
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 6,
                    textDecoration: "none",
                  }}
                >
                  <Icon icon="mdi:download" width="18" />
                  ดาวน์โหลดรูปภาพ
                </a>
              )}
              {preview.pdf_url && (
                <a href={preview.pdf_url} download target="_blank" rel="noreferrer"
                  style={{
                    flex: 1, padding: "11px",
                    background: "#FEF2F2", color: "#DC2626",
                    border: "none", borderRadius: 12,
                    fontSize: 13, fontWeight: 600,
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 6,
                    textDecoration: "none",
                  }}
                >
                  <Icon icon="mdi:file-pdf-box" width="18" />
                  ดาวน์โหลด PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}