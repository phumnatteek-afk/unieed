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

function buildThankMsg(donation, items, itemConditions, itemReasons) {
  const n = donation?.donor_name || "ผู้บริจาค";

  const cleanName = (raw) => String(raw || "").replace(/\s*\(.*?\)\s*/g, "").trim();

  const resolveItemCond = (uid) => {
    const c = itemConditions[uid];
    if (c === "issue") return "wrong_item";
    return c || "usable";
  };

  const checkedItems = items.filter(it => itemConditions[it.uniform_type_id ?? items.indexOf(it)] !== undefined);
  if (checkedItems.length === 0) {
    return `ขอบคุณคุณ ${n} มากๆ ที่ได้บริจาคชุดนักเรียน การมีส่วนร่วมของท่านช่วยให้เด็กๆ ได้มีโอกาสทางการศึกษาที่ดีขึ้น ขอบพระคุณอย่างสูง`;
  }

  const usableItems   = checkedItems.filter(it => resolveItemCond(it.uniform_type_id ?? items.indexOf(it)) === "usable");
  const wrongItems    = checkedItems.filter(it => resolveItemCond(it.uniform_type_id ?? items.indexOf(it)) === "wrong_item");
  const notSentItems  = checkedItems.filter(it => resolveItemCond(it.uniform_type_id ?? items.indexOf(it)) === "not_sent");
  const damagedItems  = checkedItems.filter(it => resolveItemCond(it.uniform_type_id ?? items.indexOf(it)) === "damaged");
  const nameList = (arr) => arr.map(it => it.name || "").join(", ");

  if (notSentItems.length > 0 && wrongItems.length === 0 && usableItems.length === 0) {
    return `ขอบคุณคุณ ${n} ที่มีน้ำใจบริจาค ทางโรงเรียนแจ้งว่าไม่มีสิ่งของในพัสดุที่ได้รับ กรุณาตรวจสอบการจัดส่ง`;
  }

  if (wrongItems.length > 0 && usableItems.length === 0 && damagedItems.length === 0) {
    const wrongNames = nameList(wrongItems);
    return `ขอบคุณคุณ ${n} ที่มีน้ำใจบริจาค ขออภัยที่รายการ (${wrongNames}) ที่ได้รับไม่ตรงตามรายการที่โรงเรียนขอรับบริจาคไว้ ขอบพระคุณในน้ำใจของท่านอย่างสูง`;
  }

  if (wrongItems.length === 0 && damagedItems.length === 0 && notSentItems.length === 0) {
    return `ขอบคุณคุณ ${n} มากๆ ที่ได้บริจาคชุดนักเรียน การมีส่วนร่วมของท่านช่วยให้เด็กๆ ได้มีโอกาสทางการศึกษาที่ดีขึ้น ขอบพระคุณอย่างสูง`;
  }

  // mixed case
  const parts = [];
  if (usableItems.length > 0) parts.push(`ได้รับ${nameList(usableItems)}เรียบร้อย`);
  if (wrongItems.length > 0) parts.push(`${nameList(wrongItems)} ไม่ตรงตามรายการที่โรงเรียนขอรับบริจาคไว้`);
  if (damagedItems.length > 0) parts.push(`${nameList(damagedItems)} มีสภาพชำรุด`);
  if (notSentItems.length > 0) parts.push(`${nameList(notSentItems)} ไม่มีสิ่งของในพัสดุ`);

  return `ขอบคุณคุณ ${n} ที่มีน้ำใจบริจาค ทางโรงเรียนขอแจ้งให้ทราบว่า ${parts.join(" และ ")} ขอบพระคุณในน้ำใจของท่านอย่างสูง`;
}

const ITEM_STATES = [
  { value: "usable",       label: "ดี",       icon: "mdi:check-circle",  color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
  { value: "damaged",      label: "ชำรุด",    icon: "mdi:alert-circle",  color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  { value: "partial",      label: "ไม่ครบ",   icon: "mdi:minus-circle",  color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
  { value: "not_received", label: "ไม่รับ",    icon: "mdi:close-circle",  color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
];

const CONDITION_SUMMARY = {
  usable:     { label: "ใช้งานได้",         icon: "mdi:check-circle-outline",  color: "#16a34a", bg: "#dcfce7", border: "#86efac", cert: true  },
  damaged:    { label: "เสียหาย",            icon: "mdi:alert-outline",          color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", cert: true  },
  wrong_item: { label: "รายการไม่ตรง",       icon: "mdi:swap-horizontal",        color: "#d97706", bg: "#fef3c7", border: "#fcd34d", cert: false },
  not_sent:   { label: "ไม่มีสิ่งของในพัสดุ", icon: "mdi:package-variant-remove", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", cert: false },
};

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
  const [donation, setDonation]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [confirming, setConfirming]         = useState(false);
  const [confirmed, setConfirmed]           = useState(false);
  const [checkedSet, setCheckedSet]         = useState(new Set());
  const [itemConditions, setItemConditions] = useState({}); // { [uniform_type_id]: "usable"|"damaged"|"incomplete"|"issue" }
  const [itemReasons, setItemReasons]       = useState({});
  const [itemNotes,   setItemNotes]         = useState({});
  const [thankMsg, setThankMsg]             = useState("");
  const [err, setErr]                       = useState("");
  const navigate = useNavigate();
  const selectAllRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE}/donations/detail/${donationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("ไม่พบรายการบริจาค");
        const data = await res.json();
        setDonation(data);
        const parsedItems = parseItems(data.items_snapshot);
        setThankMsg(buildThankMsg(data, parsedItems, {}, {}));
        if (data.status === "approved") setConfirmed(true);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [donationId, token]);

  const items = parseItems(donation?.items_snapshot);

  // derive per-item actual condition (issue → wrong_item / not_sent)
  const resolveItemCond = (uid) => {
    const c = itemConditions[uid];
    if (c === "issue") return "wrong_item";
    return c || "usable";
  };

  // derive overall condition from all checked items (priority: wrong>not_sent>damaged>incomplete>usable)
  const derivedCondition = (() => {
    const checkedItems = items.filter(it => checkedSet.has(it.uniform_type_id ?? items.indexOf(it)));
    if (checkedItems.length === 0 && items.length > 0) return "";
    const conds = checkedItems.map(it => resolveItemCond(it.uniform_type_id ?? items.indexOf(it)));
    if (conds.includes("wrong_item")) return "wrong_item";
    if (conds.includes("not_sent"))   return "not_sent";
    if (conds.includes("damaged"))    return "damaged";
    return "usable";
  })();

  // auto-fill thank message
  useEffect(() => {
    if (!donation) return;
    setThankMsg(buildThankMsg(donation, items, itemConditions, itemReasons));
  }, [derivedCondition, itemConditions, itemReasons]); // eslint-disable-line

  const handleConfirm = async () => {
    // ตรวจว่า item ที่ issue ต้องมี reason ครบ
    for (const it of items) {
      const uid = it.uniform_type_id ?? items.indexOf(it);
      if (checkedSet.has(uid) && itemConditions[uid] === "issue" && !(itemReasons[uid]?.length > 0))
        return setErr(`กรุณาระบุสาเหตุของ "${it.name}"`);
    }

    const items_received = items
      .filter(item => item.uniform_type_id != null)
      .map(item => {
        const uid = item.uniform_type_id;
        const received = checkedSet.has(uid);
        const cond = received ? resolveItemCond(uid) : "not_received";
        return {
          uniform_type_id: uid,
          qty_received: received ? Number(item.quantity) : 0,
          item_condition: cond,
          ...(cond === "wrong_item" && itemReasons[uid]?.length > 0 ? { reason: itemReasons[uid].join(", "), note: itemNotes[uid] || "" } : {}),
        };
      });

    setErr("");
    setConfirming(true);
    try {
      const res = await fetch(`${BASE}/donations/${donation.donation_id}/verify`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ condition_status: derivedCondition, thank_message: thankMsg, items_received }),
      });
      if (!res.ok) throw new Error("ยืนยันไม่สำเร็จ");
      setConfirmed(true);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setConfirming(false);
    }
  };

  // indeterminate checkbox (ไม่ใช้แล้ว แต่ keep ref ไว้ไม่ให้ hook ผิด)
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = false;
  });

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

  const isDropoff = donation?.delivery_method === "dropoff";
  const condMeta = CONDITION_SUMMARY[derivedCondition] || CONDITION_SUMMARY.usable;
  const CERT_ELIGIBLE = ["usable", "damaged"];
  const hasSomeCertEligible = items.some(it => {
    const uid = it.uniform_type_id ?? items.indexOf(it);
    return checkedSet.has(uid) && CERT_ELIGIBLE.includes(resolveItemCond(uid));
  });
  const willGetCert = hasSomeCertEligible;

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
            <button style={{ ...S.btnPrimary, marginTop: 20 }} onClick={() => navigate("/school/donations")}>
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
                    {donation?.donor_phone && (
                      <MetaRow label="เบอร์ติดต่อ" value={donation.donor_phone} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* รายการชุดนักเรียน */}
            <div style={S.section}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #EFF6FF" }}>
                <Icon icon="mdi:tshirt-crew-outline" width="16" color="#29B6E8" />
                รายการชุดนักเรียน
                <span style={{ fontSize: 12, fontWeight: 600, color: "#29B6E8", background: "#EFF6FF", padding: "1px 8px", borderRadius: 20 }}>{donation?.quantity} ชิ้น</span>
                <label style={{
                  marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                  cursor: "pointer", userSelect: "none",
                  padding: "3px 10px", borderRadius: 20,
                  background: derivedCondition === "usable" ? "#dcfce7" : "#f3f4f6",
                  border: `1.5px solid ${derivedCondition === "usable" ? "#86efac" : "#D1D5DB"}`,
                  transition: "all 0.15s",
                }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={items.length > 0 && items.every((it, i) => checkedSet.has(it.uniform_type_id ?? i))}
                    onChange={() => {
                      const allKeys = items.map((it, i) => it.uniform_type_id ?? i);
                      const allChecked = allKeys.every(k => checkedSet.has(k));
                      if (allChecked) {
                        setCheckedSet(new Set());
                        setItemConditions({});
                        setItemReasons({});
                      } else {
                        setCheckedSet(new Set(allKeys));
                        const conds = {};
                        allKeys.forEach(k => { conds[k] = itemConditions[k] || "usable"; });
                        setItemConditions(conds);
                      }
                    }}
                    style={{ width: 14, height: 14, accentColor: "#16a34a", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 600, color: derivedCondition === "usable" ? "#16a34a" : "#6b7280", whiteSpace: "nowrap" }}>
                    รับครบทุกรายการ
                  </span>
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((item, i) => {
                  const uid = item.uniform_type_id ?? i;
                  const isChecked = checkedSet.has(uid);
                  const cond = itemConditions[uid] || "usable";
                  const COND_OPTS = [
                    { value: "usable",     label: "ใช้งานได้",   icon: "mdi:check-circle",   color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
                    { value: "damaged",    label: "เสียหาย",     icon: "mdi:alert-circle",   color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
                    { value: "issue",      label: "รายการไม่ตรง",     icon: "mdi:swap-horizontal", color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
                  ];
                  const activeMeta = COND_OPTS.find(o => o.value === cond) || COND_OPTS[0];
                  return (
                    <div key={i}>
                      <label style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: isChecked ? "#f0fdf4" : "#F0F7FF",
                        borderRadius: isChecked ? "10px 10px 0 0" : 10,
                        padding: "8px 12px",
                        border: `1.5px solid ${isChecked ? "#86efac" : "#DBEAFE"}`,
                        transition: "all 0.15s", cursor: "pointer",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setCheckedSet(prev => {
                                const next = new Set(prev);
                                if (next.has(uid)) {
                                  next.delete(uid);
                                  setItemConditions(p => { const n = {...p}; delete n[uid]; return n; });
                                  setItemReasons(p => { const n = {...p}; delete n[uid]; return n; });
                                } else {
                                  next.add(uid);
                                  setItemConditions(p => ({ ...p, [uid]: p[uid] || "usable" }));
                                }
                                return next;
                              });
                            }}
                            style={{ width: 15, height: 15, accentColor: "#16a34a", cursor: "pointer", flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 13, color: "#1a1a2e" }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8", background: "#DBEAFE", padding: "2px 8px", borderRadius: 20 }}>{item.quantity} ชิ้น</span>
                      </label>

                      {isChecked && (
                        <div style={{ background: "#fff", border: `1.5px solid ${activeMeta.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>ประเมินสภาพ</div>
                          <div style={{ display: "grid", gridTemplateColumns: `repeat(${COND_OPTS.length}, 1fr)`, gap: 5 }}>
                            {COND_OPTS.map(opt => (
                              <button key={opt.value} type="button"
                                onClick={() => setItemConditions(p => ({ ...p, [uid]: opt.value }))}
                                style={{
                                  padding: "6px 4px", borderRadius: 8, textAlign: "center", cursor: "pointer",
                                  border: `1.5px solid ${cond === opt.value ? opt.border : "#E5E7EB"}`,
                                  background: cond === opt.value ? opt.bg : "#f9fafb",
                                  color: cond === opt.value ? opt.color : "#9ca3af",
                                  fontSize: 10, fontWeight: cond === opt.value ? 700 : 500,
                                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                                  transition: "all 0.15s",
                                }}
                              >
                                <Icon icon={opt.icon} width="15" />
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {cond === "issue" && (
                            <div style={{ marginTop: 8, padding: "8px 10px", background: "#fffbeb", border: "1px dashed #fcd34d", borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: "#92400e", fontWeight: 600, marginBottom: 6 }}>สาเหตุ <span style={{ color: "#dc2626" }}>*</span></div>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                                {["ผิดไซส์", "ผิดประเภท"].map(r => {
                                  const selected = (itemReasons[uid] || []).includes(r);
                                  return (
                                    <button key={r} type="button"
                                      onClick={() => setItemReasons(p => {
                                        const cur = p[uid] || [];
                                        return { ...p, [uid]: cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r] };
                                      })}
                                      style={{
                                        padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                                        border: `1.5px solid ${selected ? "#d97706" : "#E5E7EB"}`,
                                        background: selected ? "#fef3c7" : "#fff",
                                        color: selected ? "#92400e" : "#9ca3af",
                                      }}
                                    >{r}</button>
                                  );
                                })}
                              </div>
                              <textarea
                                rows={2}
                                maxLength={150}
                                placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ) เช่น ส่งบิกินี่มาแทนเสื้อนักเรียน"
                                value={itemNotes[uid] || ""}
                                onChange={e => setItemNotes(p => ({ ...p, [uid]: e.target.value }))}
                                style={{ width: "100%", fontSize: 11, borderRadius: 6, border: "1px solid #fcd34d", padding: "5px 8px", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>


            {/* ผลการประเมิน (auto-derived) */}
            {derivedCondition && <div style={S.section}>
              <div style={S.sectionLabel}><Icon icon="mdi:clipboard-check-outline" width="14" /> ผลการประเมิน</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: condMeta.bg, border: `1px solid ${condMeta.border}` }}>
                <Icon icon={condMeta.icon} width="20" color={condMeta.color} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: condMeta.color }}>{condMeta.label}</div>
                  <div style={{ fontSize: 11, color: condMeta.color, opacity: 0.8, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon icon={willGetCert ? "mdi:certificate-outline" : "mdi:close-circle-outline"} width="13" />
                    {willGetCert
                      ? (condMeta.cert
                          ? "ผู้บริจาคจะได้รับใบเกียรติบัตร"
                          : "ออกใบเกียรติบัตรเฉพาะรายการที่ได้รับ")
                      : "ไม่ออกใบเกียรติบัตร"}
                  </div>
                </div>
              </div>
            </div>}

            {/* ข้อความขอบคุณ / แจ้งผู้บริจาค */}
            <div style={S.section}>
              <div style={S.sectionLabel}>
                <Icon icon="mdi:message-text-outline" width="14" />
                {(derivedCondition === "wrong_item" || derivedCondition === "not_sent")
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
              <Icon icon="mdi:bell-outline" width="16" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>เมื่อยืนยัน ระบบจะส่ง notification ให้ผู้บริจาคทันที</span>
            </div>

            {err && <div style={S.errBox}><Icon icon="mdi:alert-circle" width="16" />{err}</div>}

            <button
              style={{ ...S.btnPrimary, opacity: (confirming || !derivedCondition) ? 0.5 : 1 }}
              onClick={handleConfirm}
              disabled={confirming || !derivedCondition}
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
  detailWrap: {
    minHeight: "100vh", background: "#F7F8FA",
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    padding: "24px 16px 60px",
  },
  detailCard: {
    width: "100%", maxWidth: 480, background: "#fff",
    borderRadius: 20, boxShadow: "0 4px 32px rgba(0,0,0,.08)", padding: "24px",
  },

  successBox:   { textAlign: "center", padding: "32px 16px" },
  successIcon:  { fontSize: 52, marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: 700, color: "#16a34a", marginBottom: 8 },
  successSub:   { fontSize: 14, color: "#6b7280", lineHeight: 1.6 },

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

  itemQty: {
    fontSize: 13, fontWeight: 600, color: "#378ADD", background: "#EFF6FF",
    padding: "2px 10px", borderRadius: 20,
  },

  textarea: {
    width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 10,
    padding: "10px 12px", fontSize: 13, color: "#1a1a2e",
    resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  },

  noteBox: {
    display: "flex", alignItems: "flex-start", gap: 10,
    background: "#EFF6FF", border: "1px solid #BFDBFE",
    borderRadius: 10, padding: "10px 14px",
    fontSize: 12.5, color: "#1e40af", marginBottom: 16, lineHeight: 1.5,
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
    fontSize: 13, color: "#dc2626", marginBottom: 12,
  },
  centerWrap: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
  },
};
