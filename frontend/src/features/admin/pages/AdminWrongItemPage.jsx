import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TRACKING_URLS = {
  "ไปรษณีย์ไทย":    (no) => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  "Flash Express":   (no) => `https://www.flashexpress.co.th/tracking/?se=${no}`,
  "J&T Express":     (no) => `https://www.jtexpress.co.th/service/track?waybillNo=${no}`,
  "Kerry Express":   (no) => `https://th.kex-express.com/th/track/?track=${no}`,
};
const getTrackingUrl = (carrier, no) => {
  const fn = TRACKING_URLS[carrier];
  return fn ? fn(no) : `https://www.google.com/search?q=${encodeURIComponent((carrier||"")+" tracking "+no)}`;
};

const formatDate = (raw) => {
  if (!raw) return "-";
  return new Date(raw).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const parseJson = (val) => {
  if (!val) return [];
  try { return typeof val === "string" ? JSON.parse(val) : val; } catch { return []; }
};

// ── Evidence Modal ─────────────────────────────────────────────────────────────
function EvidenceModal({ c, onClose }) {
  const [imgFull, setImgFull] = useState(false);
  const snapItems = parseJson(c.items_snapshot);
  const condSnap  = parseJson(c.items_condition_snapshot);
  const condByType = {};
  for (const x of condSnap) {
    if (!condByType[x.uniform_type_id]) condByType[x.uniform_type_id] = [];
    condByType[x.uniform_type_id].push(x);
  }
  const _typeOcc = {};
  const itemConds = snapItems.map(it => {
    const tid = it.uniform_type_id;
    _typeOcc[tid] = (_typeOcc[tid] || 0);
    const entry = condByType[tid]?.[_typeOcc[tid]] || null;
    _typeOcc[tid]++;
    return entry;
  });

  const COND_LABEL = {
    usable:     { label: "ใช้งานได้",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
    wrong_item: { label: "รายการไม่ตรง", color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
    damaged:    { label: "เสียหาย",      color: "#dc2626", bg: "#fff5f5", border: "#fca5a5" },
  };

  const isMarket  = c.delivery_method === "market_purchase";
  const isDropoff = c.delivery_method === "dropoff";

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
        <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{c.school_name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>{c.request_title} · ยืนยันเมื่อ {formatDate(c.updated_at)}</div>
            </div>
            <button onClick={onClose} className="wi-action-btn" style={{ width: 30, height: 30, borderRadius: "50%", background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon icon="mdi:close" width={16} color="#64748b" />
            </button>
          </div>

          {/* Body */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>

            {/* Left: info */}
            <div style={{ padding: "18px 20px", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Delivery */}
              {!isMarket && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>วิธีการจัดส่ง</div>
                  {isDropoff ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#0e7490", background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Icon icon="mdi:calendar-clock" width={13} />Drop-Off
                    </span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon icon="mdi:package-variant-closed" width={14} />{c.shipping_carrier || "—"}
                      </div>
                      {c.tracking_number && (
                        <a href={getTrackingUrl(c.shipping_carrier, c.tracking_number)} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 10px", fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", textDecoration: "none" }}>
                          <Icon icon="mdi:open-in-new" width={11} />#{c.tracking_number}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* เบอร์ติดต่อ */}
              {c.donor_phone && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>เบอร์ติดต่อผู้บริจาค</div>
                  <div style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon icon="mdi:phone-outline" width={14} color="#64748b" />
                    <a href={`tel:${c.donor_phone}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>{c.donor_phone}</a>
                  </div>
                </div>
              )}

              {/* Items + condition */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>รายการของที่บริจาค</div>
                {snapItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>ไม่มีข้อมูล</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {snapItems.map((it, i) => {
                      const entry = itemConds[i];
                      const cond  = entry?.item_condition;
                      const meta  = COND_LABEL[cond];
                      return (
                        <div key={i} style={{ fontSize: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#1e293b" }}>{String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim()} × {it.quantity}</span>
                          {meta && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                                {meta.label}
                              </span>
                              {entry?.reason && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "1px 7px", whiteSpace: "nowrap" }}>
                                  {entry.reason}
                                </span>
                              )}
                              {entry?.note && (
                                <span style={{ fontSize: 10, color: "#78350f", background: "#fffbeb", borderRadius: 6, padding: "2px 7px", display: "block", marginTop: 2, maxWidth: 160, wordBreak: "break-word" }}>
                                  {entry.note}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: image */}
            <div style={{ padding: "18px 20px", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {c.donation_pic ? (
                <>
                  <img src={c.donation_pic} alt="หลักฐาน" onClick={() => setImgFull(true)}
                    style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 10, cursor: "zoom-in", border: "1px solid #e2e8f0" }} />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon icon="mdi:magnify-plus-outline" width={13} />คลิกเพื่อดูขนาดเต็ม
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "#cbd5e1" }}>
                  <Icon icon="mdi:image-off-outline" width={40} />
                  <div style={{ fontSize: 12, marginTop: 8 }}>ไม่มีรูปหลักฐาน</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen */}
      {imgFull && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setImgFull(false)}>
          <img src={c.donation_pic} alt="หลักฐาน" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 10, objectFit: "contain" }} />
        </div>
      )}
    </>
  );
}

// ── Filter Tab ─────────────────────────────────────────────────────────────────
function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="wi-filter-tab"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 20,
        border: active ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
        background: active ? "#eff6ff" : "#f8fafc",
        color: active ? "#1d4ed8" : "#64748b",
        fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {label}
      <span style={{
        fontSize: 11, fontWeight: 700,
        background: active ? "#2563eb" : "#e2e8f0",
        color: active ? "#fff" : "#64748b",
        borderRadius: 20, padding: "1px 7px",
      }}>{count}</span>
    </button>
  );
}

export default function AdminWrongItemPage() {
  const { token } = useAuth();
  const [mainView, setMainView]   = useState("list"); // "list" | "history"
  const [resetHistory, setResetHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [resetting, setResetting]   = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [evidenceCase, setEvidence] = useState(null);
  const [search, setSearch]       = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [period, setPeriod]       = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [wiPage, setWiPage]       = useState(1);
  const WI_PAGE_SIZE = 10;

  const WI_TIME_FILTERS = [
    { v: "today",   l: "วันนี้",   icon: "mdi:weather-sunny" },
    { v: "month",   l: "เดือนนี้", icon: "mdi:calendar-month" },
    { v: "3months", l: "3 เดือน",  icon: "mdi:calendar-range" },
    { v: "6months", l: "6 เดือน",  icon: "mdi:calendar-range" },
    { v: "year",    l: "1 ปี",     icon: "mdi:calendar-year" },
  ];

  function isInWIRange(dateStr) {
    if (!dateStr || period === "all") return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (period === "today")   { return d.toDateString() === now.toDateString(); }
    if (period === "month")   { return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }
    if (period === "3months") { const c = new Date(now); c.setMonth(now.getMonth()-3); return d >= c; }
    if (period === "6months") { const c = new Date(now); c.setMonth(now.getMonth()-6); return d >= c; }
    if (period === "year")    { const c = new Date(now); c.setFullYear(now.getFullYear()-1); return d >= c; }
    if (period === "custom" && startDate && endDate) { const s=new Date(startDate); const e=new Date(endDate); e.setHours(23,59,59); return d>=s && d<=e; }
    return true;
  }
  const [resetTarget, setResetTarget] = useState(null);
  const [removeStrikeTarget, setRemoveStrikeTarget] = useState(null); // { case, donor_name }
  const [removingStrike, setRemovingStrike] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);
  const [donorProfile, setDonorProfile] = useState(null);
  const [donorProfileLoading, setDonorProfileLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/donations/wrong-items`, { headers });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/donations/wrong-items/reset-history`, { headers });
      const data = await res.json();
      setResetHistory(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  const handleMainViewChange = (view) => {
    setMainView(view);
    if (view === "history") loadHistory();
  };

  const openDonorProfile = async (user) => {
    setDonorProfile({ loading: true, user_name: user.donor_name });
    setDonorProfileLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/donors/${user.donor_id}/profile`, { headers });
      const data = await res.json();
      setDonorProfile(data);
    } catch (e) { console.error(e); setDonorProfile(null); }
    finally { setDonorProfileLoading(false); }
  };

  const openHistory = async (user) => {
    setHistoryTarget(user);
    setHistoryLog([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/donors/${user.donor_id}/suspension-history`, { headers });
      const data = await res.json();
      setHistoryLog(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  const handleResetStrike = async () => {
    if (!resetTarget) return;
    try {
      setResetting(resetTarget.donor_id);
      setResetTarget(null);
      await fetch(`${BASE}/donations/users/${resetTarget.donor_id}/reset-strike`, { method: "PATCH", headers });
      load();
    } catch (e) { console.error(e); }
    finally { setResetting(null); }
  };

  const handleRemoveStrike = async () => {
    if (!removeStrikeTarget || removingStrike) return;
    setRemovingStrike(true);
    try {
      await fetch(`${BASE}/donations/${removeStrikeTarget.case.donation_id}/remove-strike`, { method: "PATCH", headers });
      setRemoveStrikeTarget(null);
      setFilterTab("all");
      load();
    } catch (e) { console.error(e); }
    finally { setRemovingStrike(false); }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const totalDonors    = users.length;
  const totalCases     = users.reduce((s, u) => s + Number(u.total_cases || 0), 0);
  const totalSuspended = users.filter(u => u.suspended_until && new Date(u.suspended_until) > now).length;

  // ── Filtered ───────────────────────────────────────────────────────────────
  const bySearch = users.filter(u =>
    (!search || u.donor_name?.toLowerCase().includes(search.toLowerCase())) &&
    isInWIRange(u.updated_at || u.created_at)
  );

  const tabCounts = {
    all:    bySearch.length,
    three:  bySearch.filter(u => Number(u.strike_count) >= 3).length,
    two:    bySearch.filter(u => Number(u.strike_count) === 2).length,
    one:    bySearch.filter(u => Number(u.strike_count) === 1).length,
  };

  const filtered = bySearch.filter(u => {
    const s = Number(u.strike_count);
    if (filterTab === "three") return s >= 3;
    if (filterTab === "two")   return s === 2;
    if (filterTab === "one")   return s === 1;
    return true;
  });
  const wiTotalPages = Math.ceil(filtered.length / WI_PAGE_SIZE);
  const pagedWI = filtered.slice((wiPage - 1) * WI_PAGE_SIZE, wiPage * WI_PAGE_SIZE);

  return (
    <div style={{ padding: "28px 32px" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="boTop" style={{ marginBottom: 24 }}>
        <div>
          <div className="boTitle">ตรวจสอบของไม่ตรง</div>
          <p style={{ fontSize: 13, color: "#fff", margin: "4px 0 0" }}>
            รายชื่อผู้บริจาคที่มีประวัติส่งรายการไม่ตรงตามที่โครงการระบุ
          </p>
        </div>
        <div className="boAdmin">
          <NotificationBell />
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      {/* ── Main Tab ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "list",    label: "ตรวจสอบของไม่ตรง",      icon: "mdi:swap-horizontal-circle-outline" },
          { key: "history", label: "ประวัติการระงับบัญชี", icon: "mdi:history" },
        ].map(t => (
          <button key={t.key} type="button"
            onClick={() => handleMainViewChange(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 10, border: "1.5px solid", fontWeight: 700, fontSize: 13, cursor: "pointer", background: mainView === t.key ? "#1d4ed8" : "#fff", color: mainView === t.key ? "#fff" : "#475569", borderColor: mainView === t.key ? "#1d4ed8" : "#e2e8f0" }}>
            <Icon icon={t.icon} width={16} />{t.label}
          </button>
        ))}
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { icon: "mdi:account-alert-outline",          label: "ผู้บริจาคที่มีคำเตือน",  value: totalDonors,    color: "#dc2626", bg: "#fff5f5", border: "#fecaca" },
          { icon: "mdi:swap-horizontal-circle-outline", label: "รายการทั้งหมด",           value: totalCases,     color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
          { icon: "mdi:account-lock-outline",           label: "ถูกระงับอยู่",            value: totalSuspended, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 180px", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon icon={c.icon} width={24} color={c.color} />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 500 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Time filter ── */}
      {/* <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "14px 18px", marginBottom: 14, boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon icon="mdi:clock-time-four-outline" style={{ color: "#fff", fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>ช่วงเวลา</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>กรองรายการตามช่วงเวลาที่อัพเดท</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "5px 12px" }}>
            <Icon icon="mdi:calendar-check" style={{ color: "#1d4ed8", fontSize: 14 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
              {period === "custom" && startDate && endDate ? `${startDate} → ${endDate}` : { all: "ทั้งหมด", today: "วันนี้", month: "เดือนนี้", "3months": "ย้อนหลัง 3 เดือน", "6months": "ย้อนหลัง 6 เดือน", year: "ย้อนหลัง 1 ปี" }[period] || "ทั้งหมด"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {[{ v: "all", l: "ทั้งหมด", icon: "mdi:format-list-bulleted" }, ...WI_TIME_FILTERS].map((t) => {
            const isActive = period === t.v && !showPicker;
            return (
              <button key={t.v} type="button"
                onClick={() => { setPeriod(t.v); setShowPicker(false); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, border: "1.5px solid", fontWeight: 700, fontSize: 13, cursor: "pointer", background: isActive ? "#1d4ed8" : "#f8fafc", color: isActive ? "#fff" : "#475569", borderColor: isActive ? "#1d4ed8" : "#e2e8f0", boxShadow: isActive ? "0 2px 8px rgba(29,78,216,0.22)" : "none" }}>
                <Icon icon={t.icon} style={{ fontSize: 13 }} />{t.l}
              </button>
            );
          })}
          <button type="button"
            onClick={() => { setShowPicker(!showPicker); if (!showPicker) setPeriod("custom"); }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, border: "1.5px solid", fontWeight: 700, fontSize: 13, cursor: "pointer", background: showPicker ? "#2563eb" : "#f8fafc", color: showPicker ? "#fff" : "#475569", borderColor: showPicker ? "#2563eb" : "#e2e8f0" }}>
            <Icon icon="mdi:calendar-edit" style={{ fontSize: 13 }} />กำหนดเอง
          </button>
        </div>
        {showPicker && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "linear-gradient(135deg,#eff6ff,#f0f9ff)", borderRadius: 12, border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:calendar-start" style={{ color: "#fff", fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", marginBottom: 3 }}>วันเริ่มต้น</div>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", cursor: "pointer" }} />
              </div>
            </div>
            <Icon icon="mdi:arrow-right" style={{ color: "#2563eb", fontSize: 18, paddingTop: 14 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:calendar-end" style={{ color: "#fff", fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", marginBottom: 3 }}>วันสิ้นสุด</div>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", cursor: "pointer" }} />
              </div>
            </div>
          </div>
        )}
      </div> */}

      {/* ── History View ─────────────────────────────────────────────────────── */}
      {mainView === "history" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b", marginBottom: 14 }}>ประวัติการปลดระงับบัญชี</div>
          {historyLoading ? (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: 32 }}>กำลังโหลด...</div>
          ) : resetHistory.length === 0 ? (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: 32 }}>ยังไม่มีประวัติ</div>
          ) : (() => {
            // group by donor_id
            const grouped = {};
            resetHistory.forEach(r => {
              if (!grouped[r.donor_id]) grouped[r.donor_id] = { donor_name: r.donor_name, donor_id: r.donor_id, events: [] };
              grouped[r.donor_id].events.push(r);
            });
            const donors = Object.values(grouped);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {donors.map(d => {
                  const isOpen = expanded === `hist_${d.donor_id}`;
                  return (
                    <div key={d.donor_id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                      <div
                        onClick={() => setExpanded(isOpen ? null : `hist_${d.donor_id}`)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon icon="mdi:account-check" width={18} color="#16a34a" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{d.donor_name}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>ถูกปลด {d.events.length} ครั้ง</div>
                          </div>
                        </div>
                        <Icon icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"} width={18} color="#94a3b8" />
                      </div>
                      {isOpen && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          {d.events.map((e, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 16px", borderTop: "1px solid #f1f5f9", background: "#fff" }}>
                              <div style={{ fontSize: 12, color: "#475569" }}>
                                <div>
                                  คำเตือนก่อนปลด: <strong>{e.previous_strike != null ? `${e.previous_strike}/3` : "-"}</strong>
                                  {e.was_suspended && <span style={{ marginLeft: 8, color: "#dc2626" }}>· เคยถูกระงับ</span>}
                                  {e.action === "remove_single" && <span style={{ marginLeft: 8, fontSize: 11, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, padding: "1px 7px" }}>ยกเว้นรายการเดียว</span>}
                                </div>
                                {e.school_name && (
                                  <div style={{ marginTop: 3, color: "#64748b" }}>
                                    {e.school_name}{e.request_title ? ` · ${e.request_title}` : ""}
                                  </div>
                                )}
                                {e.action === "full_reset" && (
                                  <div style={{ marginTop: 3, fontSize: 11 }}>
                                    {e.cases_summary?.length > 0
                                      ? e.cases_summary.map((c, j) => (
                                          <div key={j} style={{ color: "#64748b" }}>
                                            {c.school_name || "โรงเรียนไม่ระบุ"}
                                            {c.request_title ? ` · ${c.request_title}` : ""}
                                          </div>
                                        ))
                                      : <span style={{ color: "#94a3b8" }}>รีเซ็ต {e.previous_strike ?? "-"} คำเตือน</span>
                                    }
                                  </div>
                                )}
                                {e.wrong_items?.length > 0 && (
                                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                                    {e.wrong_items.map((it, j) => (
                                      <div key={j} style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "2px 10px", display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }}>
                                        <Icon icon="mdi:swap-horizontal" width={12} />
                                        {it.name}
                                        {it.reason && <span style={{ fontWeight: 700 }}>· {it.reason}</span>}
                                        {it.note && <span style={{ color: "#78350f" }}>({it.note})</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                                <div style={{ fontSize: 12, color: "#64748b" }}>ปลดโดย: <strong>{e.reset_by_admin_name || "-"}</strong></div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(e.created_at)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Search + Filter (one row) ────────────────────────────────────────── */}
      {mainView === "list" && <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: "7px 12px", flex: "1 1 0" }}>
          <Icon icon="mdi:magnify" width={16} color="#94a3b8" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาผู้บริจาค..."
            className="wi-search-input"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, width: "100%", color: "#1e293b" }}
          />
        </div>
        <div style={{ width: 1, height: 24, background: "#e2e8f0", flexShrink: 0 }} />
        {[
          { key: "all",   label: "ทั้งหมด",      count: tabCounts.all   },
          { key: "three", label: "คำเตือน 3/3",  count: tabCounts.three },
          { key: "two",   label: "คำเตือน 2/3",  count: tabCounts.two   },
          { key: "one",   label: "คำเตือน 1/3",  count: tabCounts.one   },
        ].map(t => (
          <FilterTab key={t.key} label={t.label} count={t.count} active={filterTab === t.key} onClick={() => setFilterTab(t.key)} />
        ))}
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <Icon icon="mdi:check-circle-outline" width={40} color="#86efac" />
          <div style={{ marginTop: 12, fontSize: 14 }}>ไม่มีผู้บริจาคที่มีคำเตือนคงเหลือ</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pagedWI.map(user => {
            const isSuspended      = user.suspended_until && new Date(user.suspended_until) > now;
            const isExpanded       = expanded === user.donor_id;
            const strikeCount      = Number(user.strike_count);
            const resetCount       = Number(user.strike_reset_count || 0);
            const hasPendingAppeal = !!user.has_pending_appeal;
            const allCases         = parseJson(user.cases).filter(Boolean).sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
            const cases            = allCases.filter(c => c.condition_status === "wrong_item" && Number(c.strike_issued) === 1);

            const strikeBadgeColor  = strikeCount >= 3 ? "#dc2626" : strikeCount === 2 ? "#d97706" : "#2563eb";
            const strikeBadgeBg     = strikeCount >= 3 ? "#fee2e2" : strikeCount === 2 ? "#fff7ed" : "#eff6ff";
            const strikeBadgeBorder = strikeCount >= 3 ? "#fca5a5" : strikeCount === 2 ? "#fed7aa" : "#bfdbfe";

            return (
              <div key={user.donor_id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

                {/* ── Donor row — single horizontal line ─────────────────── */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px" }}>

                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon icon="mdi:account" width={20} style={{ color: "#fff" }} />
                  </div>

                  {/* Name + subtitle */}
                  <div style={{ minWidth: 0, flex: "0 0 auto", marginRight: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", whiteSpace: "nowrap" }}>{user.donor_name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1, whiteSpace: "nowrap" }}>
                      {cases.length} รายการที่ไม่ตรง
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: strikeBadgeColor, background: strikeBadgeBg, border: `1px solid ${strikeBadgeBorder}`, borderRadius: 20, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                      <Icon icon="mdi:alert-outline" width={12} />
                      คำเตือน {strikeCount}/3
                    </span>
                    {isSuspended && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <Icon icon="mdi:account-lock-outline" width={12} />
                        ระงับถึง {formatDate(user.suspended_until)}
                      </span>
                    )}
                    {hasPendingAppeal && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 20, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <Icon icon="mdi:clock-alert-outline" width={12} />
                        รอ Appeal
                      </span>
                    )}
                    {resetCount > 0 && (
                      <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 9px", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <Icon icon="mdi:refresh" width={11} />
                        ปลดแล้ว {resetCount}×
                      </span>
                    )}
                  </div>

                  {/* Actions — right-aligned */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {/* Profile overview */}
                    <button
                      onClick={() => openDonorProfile(user)}
                      className="wi-action-btn"
                      title="ดูประวัติบริจาคทั้งหมด"
                      style={{ width: 38, height: 38, borderRadius: 9, border: "1.5px solid #bbf7d0", background: "#fff", color: "#16a34a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Icon icon="mdi:account-details-outline" width={20} />
                    </button>
                    {/* History — icon-only ghost */}
                    <button
                      onClick={() => openHistory(user)}
                      className="wi-action-btn"
                      title="ประวัติการระงับ"
                      style={{ width: 38, height: 38, borderRadius: 9, border: "1.5px solid #a5f3fc", background: "#fff", color: "#0e7490", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Icon icon="mdi:clock-outline" width={35} />
                    </button>
                    {/* Ghost danger — ปลดระงับ */}
                    <button
                      onClick={() => setResetTarget({ donor_id: user.donor_id, donor_name: user.donor_name, strike_count: strikeCount, is_suspended: !!isSuspended })}
                      disabled={resetting === user.donor_id}
                      className="wi-action-btn"
                      style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fff", border: "1.5px solid #fca5a5", borderRadius: 9, padding: "6px 13px", cursor: resetting === user.donor_id ? "not-allowed" : "pointer", opacity: resetting === user.donor_id ? 0.5 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon icon="mdi:refresh" width={14} />
                      {resetting === user.donor_id ? "กำลังดำเนินการ..." : "ปลดระงับบัญชี"}
                    </button>
                    {/* Primary — ดูรายการ */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : user.donor_id)}
                      className="wi-action-btn"
                      style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#2563eb", border: "1.5px solid #2563eb", borderRadius: 9, padding: "6px 13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                    >
                      <Icon icon={isExpanded ? "mdi:chevron-up" : "mdi:format-list-bulleted"} width={14} />
                      ดูรายการ
                    </button>
                  </div>
                </div>

                {/* ── Expanded cases ─────────────────────────────────────── */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>

                    {/* Appeal reason box */}
                    {(() => {
                      let appealReason = "";
                      try { appealReason = JSON.parse(user.appeal_body || "{}").reason || ""; } catch { /* noop */ }
                      if (!appealReason) return null;
                      return (
                        <div style={{ margin: "14px 20px 0", background: "#fefce8", border: "1.5px solid #fde68a", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10 }}>
                          <Icon icon="mdi:message-text-outline" width={16} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>เหตุผลที่ขอ Appeal</div>
                            <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.6 }}>{appealReason}</div>
                          </div>
                        </div>
                      );
                    })()}

                    {cases.length === 0 ? (
                      <div style={{ padding: "18px 20px", fontSize: 13, color: "#94a3b8" }}>ไม่มีข้อมูลรายการ</div>
                    ) : cases.map((c, i) => {
                      const snapItems = parseJson(c.items_snapshot);
                      const condSnap  = parseJson(c.items_condition_snapshot);
                      const _cbt = {};
                      for (const x of condSnap) {
                        if (!_cbt[x.uniform_type_id]) _cbt[x.uniform_type_id] = [];
                        _cbt[x.uniform_type_id].push(x.item_condition);
                      }
                      const _to = {};
                      const _ic = snapItems.map(it => {
                        const tid = it.uniform_type_id;
                        _to[tid] = (_to[tid] || 0);
                        const cond = _cbt[tid]?.[_to[tid]] ?? null;
                        _to[tid]++;
                        return cond;
                      });
                      const wrongItems  = snapItems.filter((_, idx) => _ic[idx] === "wrong_item");
                      const usableItems = snapItems.filter((_, idx) => _ic[idx] === "usable");

                      return (
                        <div key={c.donation_id} style={{ padding: "14px 20px 14px 72px", borderBottom: i < cases.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                              {c.school_name}
                            </div>
                            <span style={{
                              fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px",
                              display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                              color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5",
                            }}>
                              <Icon icon="mdi:alert-circle-outline" width={11} />
                              รายการไม่ตรง · ครั้งที่ {i + 1}
                            </span>
                            <button onClick={() => setEvidence(c)} className="wi-action-btn"
                              style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <Icon icon="mdi:image-search-outline" width={13} />ดูหลักฐาน
                            </button>
                            <button onClick={() => setRemoveStrikeTarget({ case: c, donor_name: user.donor_name })} className="wi-action-btn"
                              style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                              <Icon icon="mdi:shield-remove-outline" width={13} />ยกเว้นคำเตือน
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                            {c.request_title} · ยืนยันเมื่อ {formatDate(c.updated_at)}
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {wrongItems.map((it, j) => (
                              <span key={j} style={{ fontSize: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#92400e", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                                <Icon icon="mdi:close-circle" width={12} color="#f97316" />
                                {String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim()} × {it.quantity}
                              </span>
                            ))}
                            {usableItems.map((it, j) => (
                              <span key={j} style={{ fontSize: 12, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                                <Icon icon="mdi:check-circle" width={12} color="#16a34a" />
                                {String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim()} × {it.quantity}
                              </span>
                            ))}
                            {snapItems.length === 0 && (
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>ไม่มีข้อมูลรายละเอียดชิ้น</span>
                            )}
                          </div>

                          {/* ข้อความชี้แจงจากผู้บริจาค */}
                          {c.clarification_text && (
                            <div style={{ marginTop: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px" }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                <Icon icon="mdi:message-reply-outline" width={12} />
                                ข้อความชี้แจงจากผู้บริจาค
                              </div>
                              <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                {c.clarification_text}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && wiTotalPages > 1 && (
        <div className="admPager" style={{ marginTop: 16 }}>
          <div className="admPagerNums">
            {Array.from({ length: wiTotalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`admPageNum ${p === wiPage ? "active" : ""}`} onClick={() => setWiPage(p)}>{p}</button>
            ))}
          </div>
          <div className="admPagerBtns">
            <button className="admPagerBtn" disabled={wiPage <= 1} onClick={() => setWiPage((p) => p - 1)}>{"< ก่อนหน้า"}</button>
            <button className="admPagerBtn" disabled={wiPage >= wiTotalPages} onClick={() => setWiPage((p) => p + 1)}>{"ถัดไป >"}</button>
          </div>
        </div>
      )}

      </>}

      {/* ── Evidence Modal ─────────────────────────────────────────────────── */}
      {evidenceCase && <EvidenceModal c={evidenceCase} onClose={() => setEvidence(null)} />}

      {/* ── Suspension History Modal ───────────────────────────────────────── */}
      {historyTarget && (
        <div onClick={() => setHistoryTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>ประวัติการระงับบัญชี</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{historyTarget.donor_name}</div>
              </div>
              <button onClick={() => setHistoryTarget(null)} className="wi-action-btn" style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:close" width={16} />
              </button>
            </div>
            {/* Body */}
            <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด...</div>
              ) : historyLog.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีประวัติการระงับบัญชี</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {historyLog.map((item, i) => {
                    const isSuspend = item.type === "suspension";
                    const isReset   = item.type === "strike_reset";
                    const isAppeal  = item.type === "strike_appeal";
                    const color  = isSuspend ? "#dc2626" : isReset ? "#16a34a" : "#0e7490";
                    const bgColor = isSuspend ? "#fff5f5" : isReset ? "#f0fdf4" : "#ecfeff";
                    const icon   = isSuspend ? "mdi:account-lock" : isReset ? "mdi:account-check" : "mdi:message-alert";
                    const label  = isSuspend ? "ระงับบัญชี" : isReset ? "ปลดระงับบัญชี" : "ยื่นอุทธรณ์";
                    return (
                      <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 16, position: "relative" }}>
                        {/* line */}
                        {i < historyLog.length - 1 && (
                          <div style={{ position: "absolute", left: 15, top: 32, bottom: 0, width: 2, background: "#e2e8f0" }} />
                        )}
                        {/* icon */}
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: bgColor, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                          <Icon icon={icon} width={16} color={color} />
                        </div>
                        {/* content */}
                        <div style={{ flex: 1, paddingTop: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color }}>{ label }</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{item.title}</div>
                          {item.body?.reason && (
                            <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: "6px 10px", marginTop: 6 }}>
                              เหตุผล: {item.body.reason}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                            {new Date(item.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Single Strike Modal ────────────────────────────────────── */}
      {removeStrikeTarget && (
        <div onClick={() => setRemoveStrikeTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 420, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon icon="mdi:shield-remove-outline" width={24} color="#d97706" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>ยกเว้นคำเตือนรายการนี้</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{removeStrikeTarget.donor_name}</div>
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{removeStrikeTarget.case.school_name}</div>
              <div>{removeStrikeTarget.case.request_title}</div>
            </div>

            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 20 }}>
              จะยกเว้นคำเตือน<strong>เฉพาะรายการบริจาคนี้</strong>เท่านั้น
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
                <li>จำนวนคำเตือนรวมจะลดลง 1 คำเตือน</li>
                <li>รายการบริจาคอื่นที่เคยโดนคำเตือนยังคงอยู่</li>
                <li>ผู้บริจาคจะได้รับแจ้งเตือนทันที</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setRemoveStrikeTarget(null)} disabled={removingStrike}
                className="wi-action-btn"
                style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ยกเลิก
              </button>
              <button onClick={handleRemoveStrike} disabled={removingStrike}
                className="wi-action-btn"
                style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#d97706", color: "#fff", fontSize: 14, fontWeight: 600, cursor: removingStrike ? "not-allowed" : "pointer", opacity: removingStrike ? 0.6 : 1 }}>
                {removingStrike ? "กำลังดำเนินการ..." : "ยืนยันยกเว้นคำเตือน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Confirm Modal ────────────────────────────────────────────── */}
      {resetTarget && (
        <div onClick={() => setResetTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 420, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon icon="mdi:refresh" width={24} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>
                  ปลดระงับบัญชี
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{resetTarget.donor_name}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <Icon icon="mdi:alert-circle-outline" width={18} color="#d97706" />
              <span style={{ fontSize: 13, color: "#92400e" }}>
                ปัจจุบัน คำเตือน <strong>{resetTarget.strike_count}/3</strong> — หลังดำเนินการจะกลับเป็น <strong>0/3</strong>
              </span>
            </div>

            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 20 }}>
              {resetTarget.is_suspended ? (
                <>
                  หลังจากปลดระงับ ผู้บริจาครายนี้จะสามารถ
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
                    <li>บริจาคผ่านระบบพัสดุได้ตามปกติ</li>
                    <li>นัด Drop-off กับโรงเรียนได้ตามปกติ</li>
                    <li>การระงับชั่วคราวจะถูกยกเลิกทันที</li>
                  </ul>
                </>
              ) : (
                <>
                  ผู้บริจาครายนี้<strong>ยังไม่ถูกระงับ</strong> — ยังสามารถบริจาคได้ตามปกติ
                  <br />การล้างคำเตือนจะรีเซ็ตจำนวนคำเตือนกลับเป็น 0/3
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
                    <li>ใช้เมื่อพิจารณาแล้วว่าคำเตือนที่ได้รับไม่เป็นธรรม</li>
                    <li>หรือผู้บริจาคแก้ไขพฤติกรรมแล้ว</li>
                  </ul>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setResetTarget(null)}
                className="wi-action-btn"
                style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetStrike}
                className="wi-action-btn"
                style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                ยืนยันปลดระงับบัญชี
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Donor Profile Modal ─────────────────────────────────────────────── */}
      {donorProfile && (
        <div onClick={() => setDonorProfile(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon="mdi:account" width={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{donorProfile.user_name}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{donorProfile.email} · สมัครเมื่อ {formatDate(donorProfile.joined_at)}</div>
                </div>
              </div>
              <button onClick={() => setDonorProfile(null)} className="wi-action-btn" style={{ width: 30, height: 30, borderRadius: "50%", background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:close" width={16} color="#64748b" />
              </button>
            </div>

            {donorProfileLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                <Icon icon="mdi:loading" width={32} style={{ animation: "spin 1s linear infinite" }} />
                <div style={{ marginTop: 8 }}>กำลังโหลด...</div>
              </div>
            ) : (
              <div style={{ padding: "20px" }}>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "บริจาคทั้งหมด", value: donorProfile.stats?.total || 0, color: "#2563eb", bg: "#eff6ff" },
                    { label: "สำเร็จ", value: donorProfile.stats?.approved || 0, color: "#16a34a", bg: "#f0fdf4" },
                    { label: "ของไม่ตรง", value: donorProfile.stats?.wrongItem || 0, color: "#d97706", bg: "#fff7ed" },
                    { label: "รอดำเนินการ", value: donorProfile.stats?.pending || 0, color: "#0e7490", bg: "#ecfeff" },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Donation list */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>ประวัติการบริจาคทั้งหมด</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(donorProfile.donations || []).length === 0 && (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>ยังไม่มีประวัติ</div>
                  )}
                  {(donorProfile.donations || []).map(d => {
                    const statusMap = {
                      approved:  { label: "อนุมัติแล้ว", color: "#16a34a", bg: "#f0fdf4" },
                      pending:   { label: "รอดำเนินการ", color: "#0e7490", bg: "#ecfeff" },
                      rejected:  { label: "ปฏิเสธ",      color: "#dc2626", bg: "#fff5f5" },
                    };
                    const condMap = {
                      usable:     { label: "ใช้งานได้",    color: "#16a34a" },
                      wrong_item: { label: "ของไม่ตรง",   color: "#d97706" },
                      damaged:    { label: "เสียหาย",     color: "#dc2626" },
                    };
                    const st = statusMap[d.status] || { label: d.status, color: "#6b7280", bg: "#f3f4f6" };
                    const cd = d.condition_status ? condMap[d.condition_status] : null;
                    return (
                      <div key={d.donation_id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.request_title}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{d.school_name} · {formatDate(d.created_at)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {cd && <span style={{ fontSize: 11, fontWeight: 600, color: cd.color }}>{cd.label}</span>}
                          <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, borderRadius: 20, padding: "2px 8px" }}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
