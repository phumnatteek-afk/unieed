import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import CartIcon from "../../market/components/CartIcon.jsx";
import { QRLabelPage } from "../../project/pages/Donatepage.jsx";
import "../../../pages/styles/Homepage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function formatThaiDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function parseItems(snapshot) {
  if (!snapshot) return [];
  try { return typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot; }
  catch { return []; }
}

const STATUS_CONFIG = {
  pending:  { label: "รอยืนยัน",   bg: "#FEF3C7", color: "#D97706", icon: "mdi:clock-outline" },
  approved: { label: "ยืนยันแล้ว", bg: "#D1FAE5", color: "#16a34a", icon: "mdi:check-circle-outline" },
  rejected: { label: "ปฏิเสธ",     bg: "#FEE2E2", color: "#DC2626", icon: "mdi:close-circle-outline" },
};

export default function DonationHistoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [trackingInputs, setTrackingInputs] = useState({});
  const [trackingSaving, setTrackingSaving] = useState({});
  const [trackingMsg, setTrackingMsg] = useState({});
  const [slipDonation, setSlipDonation] = useState(null);

  const saveTracking = async (donationId, carrier) => {
    const val = (trackingInputs[donationId] || "").trim();
    if (!val) return;
    setTrackingSaving(p => ({ ...p, [donationId]: true }));
    try {
      const res = await fetch(`${BASE}/donations/${donationId}/tracking`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shipping_carrier: carrier || null, tracking_number: val }),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      setDonations(prev => prev.map(d =>
        d.donation_id === donationId ? { ...d, tracking_number: val } : d
      ));
      setTrackingMsg(p => ({ ...p, [donationId]: "บันทึกแล้ว ✓" }));
    } catch (e) {
      setTrackingMsg(p => ({ ...p, [donationId]: e.message }));
    } finally {
      setTrackingSaving(p => ({ ...p, [donationId]: false }));
    }
  };

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE}/donations/my/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const data = await res.json();
        setDonations(data);
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
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>
          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/projects">โครงการ</Link>
            <Link to="/market">ร้านค้า</Link>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <NotificationBell />
            <ProfileDropdown />
            <CartIcon />
          </div>
        </div>
      </header>

      <div style={{ background: "#87C7EB", height: 8, width: "100vw", marginLeft: "calc(-50vw + 50%)" }} />

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
            ประวัติการบริจาค
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            รายการบริจาคทั้งหมดของคุณ
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
        {!loading && !err && donations.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "#fff", borderRadius: 20,
            boxShadow: "0 2px 16px rgba(0,0,0,.06)",
          }}>
            <Icon icon="mdi:gift-outline" width="52" color="#D1D5DB" />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#6b7280", marginTop: 16 }}>
              ยังไม่มีประวัติการบริจาค
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>
              ร่วมส่งต่อชุดนักเรียนให้เด็กๆ ได้เลยครับ
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

        {/* List */}
        {!loading && donations.map((d) => {
          const status = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
          const items = parseItems(d.items_snapshot);
          const isOpen = expanded === d.donation_id;

          return (
            <div key={d.donation_id} style={{
              background: "#fff", borderRadius: 16,
              boxShadow: "0 2px 16px rgba(0,0,0,.06)",
              marginBottom: 16, overflow: "hidden",
              border: "1px solid #F3F4F6",
            }}>
              {/* Card Header */}
              <div
                onClick={() => setExpanded(isOpen ? null : d.donation_id)}
                style={{
                  padding: "16px 20px", cursor: "pointer",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12,
                }}
              >
                {/* รูปโครงการ */}
  <div style={{
    width: 56, height: 56, borderRadius: 12, flexShrink: 0,
    overflow: "hidden", background: "#F3F4F6",
  }}>
    {d.request_image_url
      ? <img src={d.request_image_url} alt={d.school_name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon icon="mdi:school-outline" width="28" color="#D1D5DB" />
        </div>
    }
  </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* โรงเรียน */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
                    {d.school_name || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {d.request_title}
                  </div>
                  {/* Meta */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    marginTop: 8, flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon icon="mdi:calendar-outline" width="14" />
                      {formatThaiDate(d.donation_date)}
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon icon="mdi:tshirt-crew-outline" width="14" />
                      {d.quantity} ชิ้น
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon icon={d.delivery_method === "dropoff" ? "mdi:walk" : "mdi:truck-outline"} width="14" />
                      {d.delivery_method === "dropoff" ? "Drop-off" : "พัสดุ"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  {/* Status Badge */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: status.bg, color: status.color,
                    padding: "4px 12px", borderRadius: 20,
                    fontSize: 12, fontWeight: 600, flexShrink: 0,
                  }}>
                    <Icon icon={status.icon} width="14" />
                    {status.label}
                  </div>
                  {/* Certificate badge */}
                  {d.status === "approved" && (
                    <div style={{
                      fontSize: 11, color: "#FFBE1B", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      🏅 มีใบเกียรติบัตร
                    </div>
                  )}
                  <Icon
                    icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                    width="20" color="#9ca3af"
                  />
                </div>
              </div>

              {/* Expanded Detail */}
              {isOpen && (
                <div style={{
                  borderTop: "1px solid #F3F4F6",
                  padding: "16px 20px",
                  background: "#F9FAFB",
                }}>
                  {/* รายการชุด */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    รายการชุดนักเรียน
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between",
                        background: "#fff", borderRadius: 8, padding: "8px 12px",
                        fontSize: 13,
                      }}>
                        <span style={{ color: "#1a1a2e" }}>{item.name}</span>
                        <span style={{
                          color: "#378ADD", fontWeight: 600,
                          background: "#EFF6FF", padding: "2px 10px", borderRadius: 20,
                        }}>
                          {item.quantity} ชิ้น
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ปุ่มใบสรุป */}
                  <button
                    onClick={() => setSlipDonation(d)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 10,
                      background: "#EFF6FF", color: "#378ADD",
                      border: "1px solid #BFDBFE", fontSize: 13,
                      fontWeight: 600, cursor: "pointer", width: "fit-content",
                    }}
                  >
                    <Icon icon="fluent:document-checkmark-20-filled" width="16" />
                    ใบสรุป / QR
                  </button>

                  {/* ข้อมูลการส่ง */}
                  {d.delivery_method === "parcel" && d.tracking_number && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "#EFF6FF", borderRadius: 10, padding: "10px 14px",
                      fontSize: 13, color: "#1e40af",
                    }}>
                      <Icon icon="mdi:truck-outline" width="16" />
                      <span>{d.shipping_carrier} · <strong style={{ fontFamily: "monospace" }}>{d.tracking_number}</strong></span>
                    </div>
                  )}

                  {/* กรอกเลขพัสดุภายหลัง */}
                  {d.delivery_method === "parcel" && !d.tracking_number && (
                    <div style={{
                      background: "#FFFBEB", border: "1px dashed #FCD34D",
                      borderRadius: 10, padding: "12px 14px", marginTop: 8,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon icon="mdi:truck-outline" width="14" />
                        ยังไม่ได้กรอกเลขพัสดุ
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={trackingInputs[d.donation_id] || ""}
                          onChange={e => setTrackingInputs(p => ({ ...p, [d.donation_id]: e.target.value }))}
                          placeholder="กรอกเลขพัสดุ"
                          style={{
                            flex: 1, padding: "8px 12px", borderRadius: 8,
                            border: "1px solid #D1D5DB", fontSize: 13,
                            fontFamily: "monospace", outline: "none",
                          }}
                        />
                        <button
                          onClick={() => saveTracking(d.donation_id, d.shipping_carrier)}
                          disabled={trackingSaving[d.donation_id] || !trackingInputs[d.donation_id]?.trim()}
                          style={{
                            padding: "8px 16px", borderRadius: 8,
                            background: trackingSaving[d.donation_id] ? "#9CA3AF" : "#29B6E8",
                            color: "#fff", border: "none", fontSize: 13,
                            fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {trackingSaving[d.donation_id] ? "..." : "บันทึก"}
                        </button>
                      </div>
                      {trackingMsg[d.donation_id] && (
                        <div style={{ fontSize: 12, marginTop: 6, color: trackingMsg[d.donation_id].includes("✓") ? "#16a34a" : "#DC2626" }}>
                          {trackingMsg[d.donation_id]}
                        </div>
                      )}
                    </div>
                  )}

                  {/* หลักฐาน */}
                  {d.donation_pic && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>หลักฐานการจัดส่ง</div>
                      <img
                        src={d.donation_pic}
                        alt="หลักฐาน"
                        style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10 }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* QR Slip Modal */}
      {slipDonation && createPortal(
        <div
          onClick={() => setSlipDonation(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640 }}>
            <QRLabelPage
              donationId={slipDonation.donation_id}
              donorName={slipDonation.donor_name}
              projectTitle={slipDonation.request_title}
              schoolName={slipDonation.school_name}
              donateMethod={slipDonation.delivery_method}
              courier={slipDonation.shipping_carrier}
              trackingNo={slipDonation.tracking_number || ""}
              selectedItems={parseItems(slipDonation.items_snapshot).map(it => ({
                name: it.name, qty: it.quantity,
              }))}
              totalQty={slipDonation.quantity}
              baseUrl={window.location.origin}
              onUpdateTracking={async (newTracking) => {
                await fetch(`${BASE}/donations/${slipDonation.donation_id}/tracking`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    shipping_carrier: slipDonation.shipping_carrier || null,
                    tracking_number: newTracking,
                  }),
                });
                setDonations(prev => prev.map(d =>
                  d.donation_id === slipDonation.donation_id
                    ? { ...d, tracking_number: newTracking } : d
                ));
                setSlipDonation(s => ({ ...s, tracking_number: newTracking }));
              }}
              onViewProject={() => setSlipDonation(null)}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}