// src/features/donate/pages/QRScanPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { login as loginService } from "../../auth/services/auth.service.js";
import { Icon } from "@iconify/react";

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

// ── หน้า Login ──────────────────────────────────────────────────
function QRLoginPanel({ onLoginSuccess }) {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await loginService({ user_email: email, password });
      if (res.role !== "school_admin") {
        setErr("บัญชีนี้ไม่ใช่บัญชีโรงเรียน กรุณาใช้บัญชีโรงเรียน");
        return;
      }
      login({ token: res.token, role: res.role, user_name: res.user_name });
      onLoginSuccess(res.token);
    } catch (e) {
      setErr(e?.data?.message || e?.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        {/* Header */}
        <div style={S.loginHeader}>
          <img src="/src/unieed_pic/logo.png" alt="Unieed" style={S.loginLogo} />
          <div style={S.loginTitle}>เข้าสู่ระบบโรงเรียน</div>
          <div style={S.loginSub}>สแกน QR เพื่อยืนยันรับบริจาค</div>
        </div>

        {err && (
          <div style={S.errBox}>
            <Icon icon="mdi:alert-circle" width="16" />
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={S.fieldWrap}>
            <label style={S.label}>อีเมลโรงเรียน</label>
            <div style={S.inputWrap}>
              <Icon icon="mdi:email-outline" width="18" color="#9ca3af" style={S.inputIcon} />
              <input
                style={S.input}
                type="email"
                placeholder="school@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div style={S.fieldWrap}>
            <label style={S.label}>รหัสผ่าน</label>
            <div style={S.inputWrap}>
              <Icon icon="mdi:lock-outline" width="18" color="#9ca3af" style={S.inputIcon} />
              <input
                style={{ ...S.input, paddingRight: 44 }}
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(p => !p)} style={S.eyeBtn}>
                <Icon icon={showPw ? "mdi:eye-off" : "mdi:eye"} width="20" color="#9ca3af" />
              </button>
            </div>
          </div>

          <button type="submit" style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── หน้ารายละเอียดการบริจาค + ยืนยัน ───────────────────────────
function DonationDetailPanel({ donationId, token }) {
  const [donation, setDonation]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [condition, setCondition] = useState("");
  const [thankMsg, setThankMsg]   = useState("");
  const [err, setErr]             = useState("");
  const navigate = useNavigate();

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // ดึงข้อมูล donation จาก donation_id
        const res = await fetch(`${BASE}/donations/detail/${donationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("ไม่พบรายการบริจาค");
        const data = await res.json();
        console.log("donation data:", data);        // ← เพิ่ม
      console.log("school_name:", data.school_name); // ← เพิ่ม
        setDonation(data);
        setThankMsg(
          `ขอบคุณคุณ ${data.donor_name} มากๆ ที่ได้บริจาคชุดนักเรียน ` +
          `การมีส่วนร่วมของท่านช่วยให้เด็กๆ ได้มีโอกาสทางการศึกษาที่ดีขึ้น ขอบพระคุณอย่างสูง`
        );
        if (data.status === "approved") setConfirmed(true);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [donationId, token]);

  const handleConfirm = async () => {
    if (!condition) return setErr("กรุณาเลือกสภาพชุดก่อนยืนยัน");
    setErr("");
    setConfirming(true);
    try {
      // PATCH verify (เหมือนกับที่ SchoolDonationPage ทำ)
      const res = await fetch(`${BASE}/donations/${donation.donation_id}/verify`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ condition_status: condition, thank_message: thankMsg }),
      });
      if (!res.ok) throw new Error("ยืนยันไม่สำเร็จ");
      setConfirmed(true);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return (
    <div style={S.centerWrap}>
      <Icon icon="mdi:loading" width="36" color="#29B6E8" style={{ animation: "spin 1s linear infinite" }} />
      <div style={{ color: "#6b7280", marginTop: 12 }}>กำลังโหลดข้อมูล...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (err && !donation) return (
    <div style={S.centerWrap}>
      <Icon icon="mdi:alert-circle-outline" width="48" color="#ef4444" />
      <div style={{ color: "#ef4444", marginTop: 12, fontWeight: 600 }}>{err}</div>
    </div>
  );

  const items = parseItems(donation?.items_snapshot);
  const isDropoff = donation?.delivery_method === "dropoff";

  return (
    <div style={S.detailWrap}>
      <div style={S.detailCard}>

        {/* Header */}
        <div style={S.detailHeader}>
          <img src="/src/unieed_pic/logo.png" alt="Unieed" style={{ height: 32 }} />
          <div style={S.detailHeaderRight}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>โรงเรียน</div>
            <div style={S.detailSchool}>{donation?.school_name || "—"}</div>
          </div>
        </div>

        {/* ยืนยันแล้ว */}
        {confirmed ? (
          <div style={S.successBox}>
            <div style={S.successIcon}>✅</div>
            <div style={S.successTitle}>ยืนยันรับของเรียบร้อยแล้ว!</div>
            <div style={S.successSub}>
              ผู้บริจาค <strong>{donation?.donor_name}</strong> จะได้รับแจ้งเตือนและใบเกียรติบัตรโดยอัตโนมัติ
            </div>
            <button
              style={{ ...S.btnPrimary, marginTop: 20 }}
              onClick={() => navigate("/school/donations")}
            >
              ไปที่หน้าติดตามการบริจาค →
            </button>
          </div>
        ) : (
          <>
            {/* ข้อมูลการบริจาค */}
            <div style={S.section}>
              <div style={S.sectionLabel}>ข้อมูลการบริจาค</div>
              <div style={S.metaGrid}>
                <MetaRow label="ผู้บริจาค" value={donation?.donor_name} />
                <MetaRow label="วิธีส่ง" value={isDropoff ? "Drop-off (นำส่งด้วยตนเอง)" : "จัดส่งพัสดุ"} />
                {isDropoff ? (
                  <>
                    <MetaRow label="วันนัดหมาย" value={formatThaiDate(donation?.donation_date)} />
                    {donation?.donation_time && (
                      <MetaRow label="เวลา" value={`${String(donation.donation_time).slice(0, 5)} น.`} />
                    )}
                    {donation?.donor_phone && (
                      <MetaRow label="เบอร์ติดต่อ" value={donation.donor_phone} />
                    )}
                  </>
                ) : (
                  <>
                    <MetaRow label="ขนส่ง" value={donation?.shipping_carrier} />
                    <MetaRow label="Tracking" value={donation?.tracking_number} mono />
                    <MetaRow label="วันที่ส่ง" value={formatThaiDate(donation?.donation_date)} />
                  </>
                )}
              </div>
            </div>

            {/* รายการชุด */}
            <div style={S.section}>
              <div style={S.sectionLabel}>รายการชุดนักเรียน ({donation?.quantity} ชิ้น)</div>
              <div style={S.itemList}>
                {items.map((item, i) => (
                  <div key={i} style={S.itemRow}>
                    <span style={S.itemName}>{item.name}</span>
                    <span style={S.itemQty}>{item.quantity} ชิ้น</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ข้อความขอบคุณ */}
            <div style={S.section}>
              <div style={S.sectionLabel}>ข้อความขอบคุณ (ส่งให้ผู้บริจาคพร้อมใบประกาศ)</div>
              <textarea
                style={S.textarea}
                rows={3}
                value={thankMsg}
                onChange={e => setThankMsg(e.target.value)}
              />
            </div>

            {/* ประเมินสภาพ */}
            <div style={S.section}>
              <div style={S.sectionLabel}>
                ประเมินสภาพชุดที่ได้รับ <span style={{ color: "#ef4444" }}>*</span>
              </div>
              <div style={S.conditionRow}>
                {[
                  { value: "usable",     label: "ใช้งานได้",     color: "#16a34a", bg: "#dcfce7" },
                  { value: "wrong_item", label: "รายการไม่ตรง",  color: "#d97706", bg: "#fef3c7" },
                  { value: "damaged",    label: "เสียหาย",        color: "#dc2626", bg: "#fee2e2" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    style={{
                      ...S.conditionBtn,
                      ...(condition === opt.value
                        ? { background: opt.bg, borderColor: opt.color, color: opt.color }
                        : {}),
                    }}
                    onClick={() => setCondition(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div style={S.noteBox}>
              <Icon icon="mdi:certificate-outline" width="16" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>เมื่อยืนยัน ระบบจะออกใบประกาศนียบัตรอัตโนมัติและส่ง notification ให้ผู้บริจาคทันที</span>
            </div>

            {err && <div style={S.errBox}><Icon icon="mdi:alert-circle" width="16" />{err}</div>}

            <button
              style={{ ...S.btnPrimary, opacity: confirming ? 0.7 : 1 }}
              onClick={handleConfirm}
              disabled={confirming}
              type="button"
            >
              {confirming ? "กำลังยืนยัน..." : "✅ ยืนยันรับของแล้ว"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono = false }) {
  return (
    <div style={S.metaRow}>
      <span style={S.metaLabel}>{label}</span>
      <span style={{ ...S.metaVal, ...(mono ? { fontFamily: "monospace", fontWeight: 700 } : {}) }}>
        {value || "—"}
      </span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function QRScanPage() {
  const { donationId } = useParams();
  const { token, role } = useAuth();

  const [authToken, setAuthToken] = useState(null);

  if (!authToken) {
    return <QRLoginPanel onLoginSuccess={(tk) => setAuthToken(tk)} />;
  }

  return <DonationDetailPanel donationId={donationId} token={authToken} />;
}

// ── Styles ───────────────────────────────────────────────────────
const S = {
  // login
  loginWrap: {
    minHeight: "100vh", background: "#F7F8FA",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  },
  loginCard: {
    width: "100%", maxWidth: 420, background: "#fff",
    borderRadius: 20, boxShadow: "0 4px 32px rgba(0,0,0,.09)", padding: "32px 28px",
  },
  loginHeader: { textAlign: "center", marginBottom: 28 },
  loginLogo:   { height: 48, marginBottom: 14 },
  loginTitle:  { fontSize: 22, fontWeight: 700, color: "#1a1a2e" },
  loginSub:    { fontSize: 13, color: "#6b7280", marginTop: 4 },

  // detail
  detailWrap: {
    minHeight: "100vh", background: "#F7F8FA",
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    padding: "24px 16px 60px",
  },
  detailCard: {
    width: "100%", maxWidth: 480, background: "#fff",
    borderRadius: 20, boxShadow: "0 4px 32px rgba(0,0,0,.08)", padding: "24px",
  },
  detailHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #E5E7EB",
  },
  detailHeaderRight: { textAlign: "right" },
  detailSchool: { fontSize: 13, fontWeight: 600, color: "#1a1a2e" },

  // success
  successBox: {
    textAlign: "center", padding: "32px 16px",
  },
  successIcon:  { fontSize: 52, marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: 700, color: "#16a34a", marginBottom: 8 },
  successSub:   { fontSize: 14, color: "#6b7280", lineHeight: 1.6 },

  // sections
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: 600, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #E5E7EB",
  },

  metaGrid: { display: "flex", flexDirection: "column", gap: 0 },
  metaRow: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    padding: "6px 0", borderBottom: "1px solid #F3F4F6",
  },
  metaLabel: { fontSize: 13, color: "#6b7280" },
  metaVal:   { fontSize: 13, color: "#1a1a2e", textAlign: "right" },

  itemList: { display: "flex", flexDirection: "column", gap: 6 },
  itemRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#F7F8FA", borderRadius: 8, padding: "8px 12px",
  },
  itemName: { fontSize: 13, color: "#1a1a2e" },
  itemQty: {
    fontSize: 13, fontWeight: 600, color: "#378ADD", background: "#EFF6FF",
    padding: "2px 10px", borderRadius: 20,
  },

  textarea: {
    width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 10,
    padding: "10px 12px", fontSize: 13, color: "#1a1a2e",
    resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  },

  conditionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  conditionBtn: {
    flex: 1, padding: "10px 8px", border: "1.5px solid #E5E7EB",
    borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#6b7280",
    background: "#F9FAFB", cursor: "pointer",
  },

  noteBox: {
    display: "flex", alignItems: "flex-start", gap: 10,
    background: "#EFF6FF", border: "1px solid #BFDBFE",
    borderRadius: 10, padding: "10px 14px",
    fontSize: 12.5, color: "#1e40af", marginBottom: 16, lineHeight: 1.5,
  },

  // shared
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  label:     { fontSize: 13, fontWeight: 600, color: "#374151" },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: 12 },
  input: {
    width: "100%", padding: "11px 12px 11px 38px",
    border: "1.5px solid #E5E7EB", borderRadius: 10,
    fontSize: 14, color: "#1a1a2e", outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute", right: 12, background: "none",
    border: "none", cursor: "pointer", padding: 0, display: "flex",
  },
  btnPrimary: {
    width: "100%", padding: "13px", background: "#29B6E8", color: "#fff",
    border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8,
  },
  errBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#FEF2F2", border: "1px solid #FECACA",
    borderRadius: 10, padding: "10px 14px",
    fontSize: 13, color: "#dc2626", marginBottom: 4,
  },
  centerWrap: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
  },
};