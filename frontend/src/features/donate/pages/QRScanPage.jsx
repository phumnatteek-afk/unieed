// src/features/donate/pages/QRScanPage.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { login as loginService, googleLogin } from "../../auth/services/auth.service.js";
import { Icon } from "@iconify/react";
import { GoogleLogin } from "@react-oauth/google";
import "../../auth/styles/auth.css";

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
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);
  const googleWrapperRef        = useRef(null);
  const [googleWidth, setGoogleWidth] = useState(400);
  const { login } = useAuth();

  useEffect(() => {
    const update = () => {
      if (googleWrapperRef.current) {
        const w = googleWrapperRef.current.offsetWidth;
        setGoogleWidth(Math.min(Math.max(w, 140), 400));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleSuccess = (res) => {
    if (res.role !== "school_admin") {
      setErr("บัญชีนี้ไม่ใช่บัญชีโรงเรียน กรุณาใช้บัญชีโรงเรียน");
      return;
    }
    login({ token: res.token, role: res.role, user_name: res.user_name, user_email: res.user_email });
    onLoginSuccess(res.token);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await loginService({ user_email: email, password });
      handleSuccess(res);
    } catch (e) {
      setErr(e?.data?.message || e?.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setErr("");
    try {
      const res = await googleLogin({ idToken: credentialResponse.credential });
      handleSuccess(res);
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Google login ไม่สำเร็จ");
    }
  };

  return (
    <div className="lgPage">
      <div className="lgCard">

        {/* ===== LEFT PANEL ===== */}
        <div className="lgLeftPanel">
          <div className="lgBgImage" />
          <img className="lgLogo" src="/src/unieed_pic/logo1.png" alt="Unieed" />
          <div className="lgWelcomeBlock">
            <div className="lgWelcomeTitle">ยินดีต้อนรับ</div>
            <div className="lgWelcomeSub">
              ยืนยันรับบริจาค<br />ชุดนักเรียนผ่าน QR
            </div>
          </div>
          <div className="lgBadge">
            <div className="lgBadgeText">
              " สร้างโอกาสทางการศึกษา<br />ผ่านการบริจาคชุดนักเรียน <span>"</span>
            </div>
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="lgRightPanel">
          {err && (
            <div className="lgAlert lgAlert--error">
              <Icon icon="mdi:alert-circle" width="16" />
              {err}
            </div>
          )}

          <div className="lgHeader">
            <h2 className="lgTitle">เข้าสู่ระบบโรงเรียน</h2>
            <p className="lgSubtitle">สแกน QR เพื่อยืนยันรับบริจาค</p>
          </div>

          <form className="lgForm" onSubmit={handleSubmit}>
            <div className="lgField">
              <label className="lgLabel">อีเมลโรงเรียน</label>
              <div className="lgInputWrap">
                <span className="lgInputIcon">
                  <Icon icon="mdi:email-outline" width="18" />
                </span>
                <input
                  className="lgInput"
                  type="email"
                  placeholder="school@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="lgField">
              <label className="lgLabel">รหัสผ่าน</label>
              <div className="lgInputWrap" style={{ position: "relative" }}>
                <span className="lgInputIcon">
                  <Icon icon="mdi:lock-outline" width="18" />
                </span>
                <input
                  className="lgInput"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#9ca3af", display: "flex", alignItems: "center" }}
                >
                  <Icon icon={showPw ? "mdi:eye-off" : "mdi:eye"} width="20" />
                </button>
              </div>
            </div>

            <button type="submit" className="lgBtn" style={{ opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <div className="lgDivider"><span>หรือ</span></div>

          <div className="lgGoogleWrapper" ref={googleWrapperRef}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setErr("Google login ไม่สำเร็จ")}
              width={googleWidth}
              text="signin_with"
              locale="th"
            />
          </div>
        </div>

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
  const [checkedMap, setCheckedMap] = useState({});
  const [reasonMap, setReasonMap]   = useState({});
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
        const parsedItems = parseItems(data.items_snapshot);
        const init = {};
        parsedItems.forEach((item, i) => { init[item.uniform_type_id ?? i] = true; });
        setCheckedMap(init);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [donationId, token]);

  const handleConfirm = async () => {
    const items = parseItems(donation?.items_snapshot);
    const noneChecked = items.length > 0 && items.every((it, i) => checkedMap[it.uniform_type_id ?? i] === false);
    const hasDamaged    = Object.values(reasonMap).some(r => r === "ชำรุด");
    const hasIncomplete = Object.values(reasonMap).some(r => r === "ไม่ครบ");
    const finalCondition = noneChecked
      ? (hasDamaged ? "damaged" : hasIncomplete ? "incomplete" : "wrong_item")
      : condition;
    if (!noneChecked && !condition) return setErr("กรุณาเลือกสภาพชุดก่อนยืนยัน");
    const uncheckedWithoutReason = items.some((item, i) => {
      const key = item.uniform_type_id ?? i;
      return checkedMap[key] === false && !reasonMap[key];
    });
    if (uncheckedWithoutReason) return setErr("กรุณาระบุสาเหตุสำหรับรายการที่ไม่ได้รับ");
    const items_received = items
      .filter(item => item.uniform_type_id != null)
      .map((item, i) => {
        const key = item.uniform_type_id ?? i;
        const isChecked = checkedMap[key] !== false;
        return {
          uniform_type_id: item.uniform_type_id,
          qty_received: isChecked ? Number(item.quantity) : 0,
          ...(isChecked ? {} : { reason: reasonMap[key] || null }),
        };
      });
    setErr("");
    setConfirming(true);
    try {
      const res = await fetch(`${BASE}/donations/${donation.donation_id}/verify`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ condition_status: finalCondition, thank_message: thankMsg, items_received }),
      });
      if (!res.ok) throw new Error("ยืนยันไม่สำเร็จ");
      setConfirmed(true);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setConfirming(false);
    }
  };

  // reset condition ถ้า uncheck ทั้งหมดแล้ว condition เป็น "usable"
  useEffect(() => {
    if (!donation) return;
    const parsed = parseItems(donation.items_snapshot);
    const noneChecked = parsed.length > 0 && parsed.every((it, i) => checkedMap[it.uniform_type_id ?? i] === false);
    if (noneChecked && condition === "usable") setCondition("");
  }, [checkedMap]); // eslint-disable-line

  // auto-fill thankMsg จาก item reasons เมื่อ allUnchecked
  useEffect(() => {
    if (!donation) return;
    const parsed = parseItems(donation.items_snapshot);
    const noneChecked = parsed.length > 0 && parsed.every((it, i) => checkedMap[it.uniform_type_id ?? i] === false);
    if (!noneChecked || Object.keys(reasonMap).length === 0) return;
    const name       = donation.donor_name || "ผู้บริจาค";
    const hasDmg     = Object.values(reasonMap).some(r => r === "ชำรุด");
    const hasInc     = Object.values(reasonMap).some(r => r === "ไม่ครบ");
    setThankMsg(hasDmg
      ? `ขอบคุณคุณ ${name} ที่บริจาคชุดนักเรียน ทางโรงเรียนขอแจ้งให้ทราบว่าชุดที่ได้รับมีสภาพเสียหาย ทางโรงเรียนซาบซึ้งในน้ำใจของท่านและขอขอบพระคุณอย่างสูง`
      : hasInc
      ? `ขอบคุณคุณ ${name} ที่บริจาคชุดนักเรียน ทางโรงเรียนขอแจ้งให้ทราบว่าได้รับของบริจาคไม่ครบจำนวน ทางโรงเรียนซาบซึ้งในน้ำใจของท่านและขอขอบพระคุณอย่างสูง`
      : `ขอบคุณคุณ ${name} ที่มีน้ำใจบริจาค ขออภัยที่รายการบริจาคไม่ตรงกับความต้องการของโรงเรียนในขณะนี้`
    );
  }, [reasonMap, checkedMap]); // eslint-disable-line

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
  const allUnchecked = items.length > 0 && items.every((item, i) => checkedMap[item.uniform_type_id ?? i] === false);
  const _hasDmg = Object.values(reasonMap).some(r => r === "ชำรุด");
  const _hasInc = Object.values(reasonMap).some(r => r === "ไม่ครบ");
  const derivedCondition = allUnchecked
    ? (_hasDmg ? "damaged"
      : _hasInc ? "incomplete"
      : Object.keys(reasonMap).length > 0 ? "wrong_item" : null)
    : null;
  const activeCondition = allUnchecked ? derivedCondition : condition;

  const conditionOptions = [
    { value: "usable",  label: "ใช้งานได้", icon: "mdi:check-circle-outline", color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
    { value: "damaged", label: "เสียหาย",    icon: "mdi:alert-outline",         color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  ];

  return (
    <div style={S.detailWrap}>
      <div style={S.detailCard}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#29B6E8,#5285e8)", borderRadius: "14px 14px 0 0", margin: "-24px -24px 20px", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginBottom: 2 }}>ยืนยันรับบริจาคชุดนักเรียน</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{donation?.school_name || "—"}</div>
          </div>
          <img src="/src/unieed_pic/logo.png" alt="Unieed" style={{ height: 30, opacity: 0.9, filter: "brightness(0) invert(1)" }} />
        </div>

        {/* ยืนยันแล้ว */}
        {confirmed ? (
          <div style={S.successBox}>
            <div style={S.successIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" style={{ color: "#16a34a" }}>
                <path fill="currentColor" fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z" clipRule="evenodd"/>
              </svg>
            </div>
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
              <div style={S.sectionLabel}><Icon icon="mdi:account-box-outline" width="14" /> ข้อมูลผู้บริจาค</div>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #EFF6FF" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon="mdi:tshirt-crew-outline" width="16" color="#29B6E8" />
                  รายการชุดนักเรียน
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#29B6E8", background: "#EFF6FF", padding: "1px 8px", borderRadius: 20 }}>{donation?.quantity} ชิ้น</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5285E8", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((item, i) => checkedMap[item.uniform_type_id ?? i] !== false)}
                    onChange={e => {
                      const newMap = {};
                      items.forEach((item, i) => { newMap[item.uniform_type_id ?? i] = e.target.checked; });
                      setCheckedMap(newMap);
                      if (e.target.checked) setReasonMap({});
                    }}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#5285e8", outline: "none" }}
                  />
                  ติ๊กรับทั้งหมด
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((item, i) => {
                  const key = item.uniform_type_id ?? i;
                  const isChecked = checkedMap[key] !== false;
                  return (
                    <div key={i} style={{ borderRadius: 12, border: `2px solid ${isChecked ? "#DBEAFE" : "#FECACA"}`, overflow: "hidden", transition: "border-color 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isChecked ? "#F0F7FF" : "#FFF5F5" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            setCheckedMap(prev => ({ ...prev, [key]: e.target.checked }));
                            if (e.target.checked) setReasonMap(prev => { const n = { ...prev }; delete n[key]; return n; });
                          }}
                          style={{ width: 18, height: 18, flexShrink: 0, cursor: "pointer", accentColor: "#5285e8", outline: "none" }}
                        />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{item.name}</span>
                        <span style={{ ...S.itemQty, background: isChecked ? "#DBEAFE" : "#FEE2E2", color: isChecked ? "#1d4ed8" : "#dc2626" }}>{item.quantity} ชิ้น</span>
                      </div>
                      {!isChecked && (
                        <div style={{ padding: "10px 14px", background: "#fff", borderTop: "1px solid #FEE2E2" }}>
                          <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginBottom: 8 }}>ระบุสาเหตุที่ไม่รับ *</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {["ผิดไซส์", "ผิดประเภท", "ชำรุด", ...(Number(item.quantity) > 1 ? ["ไม่ครบ"] : [])].map(r => (
                              <button
                                key={r} type="button"
                                onClick={() => setReasonMap(prev => ({ ...prev, [key]: r }))}
                                style={{
                                  padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                                  border: `1.5px solid ${reasonMap[key] === r ? "#dc2626" : "#FECACA"}`,
                                  background: reasonMap[key] === r ? "#FEE2E2" : "#fff",
                                  color: reasonMap[key] === r ? "#dc2626" : "#9ca3af",
                                  cursor: "pointer", transition: "all 0.15s",
                                }}
                              >{r}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ประเมินสภาพ */}
            <div style={S.section}>
              <div style={S.sectionLabel}><Icon icon="mdi:clipboard-check-outline" width="14" /> ประเมินสภาพชุดที่ได้รับ {!allUnchecked && <span style={{ color: "#ef4444" }}>*</span>}</div>
              {allUnchecked ? (
                <div style={{
                  padding: "12px 14px", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
                  ...(derivedCondition === "damaged"     ? { background: "#fee2e2", border: "1px solid #fca5a5",  color: "#dc2626" }
                    : derivedCondition === "incomplete"  ? { background: "#eff6ff", border: "1px solid #93c5fd",  color: "#1d4ed8" }
                    : derivedCondition === "wrong_item"  ? { background: "#fef3c7", border: "1px solid #fcd34d",  color: "#d97706" }
                    :                                      { background: "#f3f4f6", border: "1px solid #e5e7eb",  color: "#6b7280" }),
                }}>
                  <Icon icon={
                    derivedCondition === "damaged"    ? "mdi:alert-outline" :
                    derivedCondition === "incomplete" ? "mdi:package-variant" :
                    derivedCondition === "wrong_item" ? "mdi:swap-horizontal" : "mdi:dots-horizontal"
                  } width="16" />
                  {derivedCondition === "damaged"    ? "ผลอัตโนมัติ: เสียหาย — ผู้บริจาคจะได้รับใบเกียรติบัตร"
                  : derivedCondition === "incomplete" ? "ผลอัตโนมัติ: ได้รับไม่ครบ — ผู้บริจาคจะได้รับใบเกียรติบัตร"
                  : derivedCondition === "wrong_item" ? "ผลอัตโนมัติ: รายการไม่ตรง — ไม่ออกใบเกียรติบัตร"
                  : "กรุณาระบุสาเหตุในแต่ละรายการก่อน"}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.5 }}>
                    ประเมินสภาพของที่ได้รับ · "เสียหาย" ผู้บริจาคยังได้รับใบเกียรติบัตร
                  </div>
                  <div style={S.conditionRow}>
                    {conditionOptions.map(opt => {
                      const name = donation?.donor_name || "ผู้บริจาค";
                      const msgMap = {
                        usable:  `ขอบคุณคุณ ${name} มากๆ ที่ได้บริจาคชุดนักเรียน การมีส่วนร่วมของท่านช่วยให้เด็กๆ ได้มีโอกาสทางการศึกษาที่ดีขึ้น ขอบพระคุณอย่างสูง`,
                        damaged: `ขอบคุณคุณ ${name} ที่บริจาคชุดนักเรียน ทางโรงเรียนขอแจ้งให้ทราบว่าชุดที่ได้รับมีสภาพเสียหาย ทางโรงเรียนซาบซึ้งในน้ำใจของท่านและขอขอบพระคุณอย่างสูง`,
                      };
                      return (
                        <button
                          key={opt.value}
                          style={{
                            ...S.conditionBtn,
                            ...(condition === opt.value ? { background: opt.bg, borderColor: opt.border, color: opt.color } : {}),
                          }}
                          onClick={() => { setCondition(opt.value); setThankMsg(msgMap[opt.value]); }}
                          type="button"
                        >
                          <Icon icon={opt.icon} width="18" />
                          {opt.label}
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", background: "#dcfce7", padding: "1px 7px", borderRadius: 20, marginTop: 2 }}>✓ ออกใบเซอร์</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* ข้อความขอบคุณ / แจ้งผู้บริจาค */}
            <div style={S.section}>
              <div style={S.sectionLabel}>
                <Icon icon="mdi:message-text-outline" width="14" />
                {activeCondition === "wrong_item"
                  ? "ข้อความแจ้งผู้บริจาค"
                  : "ข้อความขอบคุณ (ส่งให้ผู้บริจาคพร้อมใบประกาศ)"}
              </div>
              <textarea
                style={S.textarea}
                rows={3}
                value={thankMsg}
                onChange={e => setThankMsg(e.target.value)}
              />
            </div>

            {/* Note */}
            <div style={S.noteBox}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                  <path d="M12 15a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/><path d="M13 17.5V22l2-1.5l2 1.5v-4.5"/><path d="M10 19H5a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-1 1.73M6 9h12M6 12h3m-3 3h2"/>
                </g>
              </svg>
              <span>เมื่อยืนยัน ระบบจะออกใบประกาศนียบัตรอัตโนมัติและส่ง notification ให้ผู้บริจาคทันที</span>
            </div>

            {err && <div style={S.errBox}><Icon icon="mdi:alert-circle" width="16" />{err}</div>}

            <button
              style={{ ...S.btnPrimary, opacity: confirming ? 0.7 : 1 }}
              onClick={handleConfirm}
              disabled={confirming}
              type="button"
            >
              {confirming ? "กำลังยืนยัน..." : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                    <path fill="currentColor" fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z" clipRule="evenodd"/>
                  </svg>
                  ยืนยันรับของ
                </>
              )}
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
    fontSize: 12, fontWeight: 700, color: "#374151",
    marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #E5E7EB",
    display: "flex", alignItems: "center", gap: 6,
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
    flex: 1, padding: "12px 8px", border: "2px solid #E5E7EB",
    borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#6b7280",
    background: "#F9FAFB", cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
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
    width: "100%", padding: "13px", background: "#5285e8", color: "#fff",
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