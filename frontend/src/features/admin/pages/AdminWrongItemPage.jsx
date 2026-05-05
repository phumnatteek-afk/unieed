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
  const condMap   = {};
  for (const x of condSnap) condMap[x.uniform_type_id] = x.item_condition;

  const COND_LABEL = {
    usable:     { label: "ใช้งานได้",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
    wrong_item: { label: "รายการไม่ตรง", color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
    damaged:    { label: "เสียหาย",      color: "#dc2626", bg: "#fff5f5", border: "#fca5a5" },
    incomplete: { label: "ได้รับไม่ครบ", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
    not_sent:   { label: "ไม่มีสิ่งของในพัสดุ", color: "#7c3aed", bg: "#faf5ff", border: "#ddd6fe" },
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
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

              {/* Items + condition */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>รายการของที่บริจาค</div>
                {snapItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>ไม่มีข้อมูล</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {snapItems.map((it, i) => {
                      const cond = condMap[it.uniform_type_id];
                      const meta = COND_LABEL[cond];
                      return (
                        <div key={i} style={{ fontSize: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#1e293b" }}>{String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim()} × {it.quantity}</span>
                          {meta && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                              {meta.label}
                            </span>
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

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${color}22`, borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon icon={icon} width={26} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
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
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [resetting, setResetting]   = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [evidenceCase, setEvidence] = useState(null);
  const [search, setSearch]       = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [resetTarget, setResetTarget] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BASE}/donations/wrong-items`, { headers });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const totalDonors    = users.length;
  const totalCases     = users.reduce((s, u) => s + Number(u.total_cases || 0), 0);
  const totalSuspended = users.filter(u => u.suspended_until && new Date(u.suspended_until) > now).length;

  // ── Filtered ───────────────────────────────────────────────────────────────
  const bySearch = users.filter(u =>
    !search || u.donor_name?.toLowerCase().includes(search.toLowerCase())
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

  return (
    <div style={{ padding: "28px 32px", maxWidth: 920 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="boTop" style={{ marginBottom: 24 }}>
        <div>
          <div className="boTitle">ตรวจสอบของไม่ตรง</div>
          <p style={{ fontSize: 13, color: "#fff", margin: "4px 0 0" }}>
            รายชื่อผู้บริจาคที่มีประวัติส่งของไม่ตรง
          </p>
        </div>
        <div className="boAdmin">
          <NotificationBell />
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard
          icon="mdi:account-alert-outline"
          label="ผู้บริจาคที่มีคำเตือน"
          value={totalDonors}
          color="#dc2626"
          bg="#fff5f5"
        />
        <StatCard
          icon="mdi:swap-horizontal-circle-outline"
          label="รายการไม่ตรงทั้งหมด"
          value={totalCases}
          color="#d97706"
          bg="#fffbeb"
        />
        <StatCard
          icon="mdi:account-cancel-outline"
          label="ถูกระงับอยู่"
          value={totalSuspended}
          color="#7c3aed"
          bg="#faf5ff"
        />
      </div>

      {/* ── Search + Filter ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px", maxWidth: 320, flex: "1 1 200px" }}>
          <Icon icon="mdi:magnify" width={18} color="#94a3b8" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาผู้บริจาค..."
            className="wi-search-input"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, flex: 1, color: "#1e293b" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterTab label="ทั้งหมด"   count={tabCounts.all}   active={filterTab === "all"}   onClick={() => setFilterTab("all")} />
          <FilterTab label="คำเตือน 3/3" count={tabCounts.three} active={filterTab === "three"} onClick={() => setFilterTab("three")} />
          <FilterTab label="คำเตือน 2/3" count={tabCounts.two}   active={filterTab === "two"}   onClick={() => setFilterTab("two")} />
          <FilterTab label="คำเตือน 1/3" count={tabCounts.one}   active={filterTab === "one"}   onClick={() => setFilterTab("one")} />
        </div>
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
          {filtered.map(user => {
            const isSuspended      = user.suspended_until && new Date(user.suspended_until) > now;
            const isExpanded       = expanded === user.donor_id;
            const strikeCount      = Number(user.strike_count);
            const resetCount       = Number(user.strike_reset_count || 0);
            const hasPendingAppeal = !!user.has_pending_appeal;
            const cases            = parseJson(user.cases).filter(Boolean).sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));

            const strikeBadgeColor  = strikeCount >= 3 ? "#dc2626" : strikeCount === 2 ? "#d97706" : "#2563eb";
            const strikeBadgeBg     = strikeCount >= 3 ? "#fee2e2" : strikeCount === 2 ? "#fff7ed" : "#eff6ff";
            const strikeBadgeBorder = strikeCount >= 3 ? "#fca5a5" : strikeCount === 2 ? "#fed7aa" : "#bfdbfe";

            return (
              <div key={user.donor_id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                {/* ── Donor row ─────────────────────────────────────────── */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", flexWrap: "wrap" }}>

                  {/* Avatar + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon icon="mdi:account" width={22} style={{ color: "#fff" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{user.donor_name}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {user.total_cases} รายการที่ไม่ตรง
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {hasPendingAppeal && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 20, padding: "4px 12px", display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon icon="mdi:clock-alert-outline" width={13} />
                        รอ Appeal
                      </span>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 700, color: strikeBadgeColor, background: strikeBadgeBg, border: `1px solid ${strikeBadgeBorder}`, borderRadius: 20, padding: "4px 12px", display: "flex", alignItems: "center", gap: 5 }}>
                      <Icon icon="mdi:alert-outline" width={13} />
                      คำเตือน {strikeCount}/3
                    </span>
                    {isSuspended && (
                      <span style={{ fontSize: 11, color: "#7f1d1d", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon icon="mdi:cancel" width={12} />
                        ระงับถึง {formatDate(user.suspended_until)}
                      </span>
                    )}
                    {resetCount > 0 && (
                      <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon icon="mdi:refresh" width={12} />
                        เคยปลดระงับ {resetCount} ครั้ง
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                    {/* Ghost danger — reset */}
                    <button
                      onClick={() => setResetTarget({ donor_id: user.donor_id, donor_name: user.donor_name, strike_count: strikeCount })}
                      disabled={resetting === user.donor_id}
                      className="wi-action-btn"
                      style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", background: "#fff", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "7px 14px", cursor: resetting === user.donor_id ? "not-allowed" : "pointer", opacity: resetting === user.donor_id ? 0.6 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Icon icon="mdi:refresh" width={15} />
                      {resetting === user.donor_id ? "กำลังปลดระงับ..." : "ปลดระงับบัญชี"}
                    </button>
                    {/* Primary — view */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : user.donor_id)}
                      className="wi-action-btn"
                      style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#2563eb", border: "none", borderRadius: 10, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                    >
                      <Icon icon={isExpanded ? "mdi:chevron-up" : "mdi:history"} width={15} />
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
                      const condMap   = {};
                      for (const x of condSnap) condMap[x.uniform_type_id] = x.item_condition;

                      const wrongItems  = snapItems.filter(it => condMap[it.uniform_type_id] === "wrong_item");
                      const usableItems = snapItems.filter(it => condMap[it.uniform_type_id] === "usable");

                      return (
                        <div key={c.donation_id} style={{ padding: "14px 20px 14px 72px", borderBottom: i < cases.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                              {c.school_name}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 20, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <Icon icon="mdi:alert-circle-outline" width={11} />
                              รายการที่ {i + 1}
                            </span>
                            <button onClick={() => setEvidence(c)} className="wi-action-btn"
                              style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <Icon icon="mdi:image-search-outline" width={13} />ดูหลักฐาน
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

      {/* ── Evidence Modal ─────────────────────────────────────────────────── */}
      {evidenceCase && <EvidenceModal c={evidenceCase} onClose={() => setEvidence(null)} />}

      {/* ── Reset Confirm Modal ────────────────────────────────────────────── */}
      {resetTarget && (
        <div onClick={() => setResetTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 420, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon icon="mdi:refresh" width={24} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>ปลดระงับบัญชี</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{resetTarget.donor_name}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <Icon icon="mdi:alert-circle-outline" width={18} color="#d97706" />
              <span style={{ fontSize: 13, color: "#92400e" }}>
                ปัจจุบัน คำเตือน <strong>{resetTarget.strike_count}/3</strong> — หลังปลดระงับจะกลับเป็น <strong>0/3</strong>
              </span>
            </div>

            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 20 }}>
              หลังจากปลดระงับ ผู้บริจาครายนี้จะสามารถ
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
                <li>บริจาคผ่านระบบพัสดุได้ตามปกติ</li>
                <li>นัด Drop-off กับโรงเรียนได้ตามปกติ</li>
                <li>หากถูกระงับชั่วคราวอยู่ จะถูกปลดล็อคทันที</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setResetTarget(null)}
                style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetStrike}
                style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                ยืนยันปลดระงับ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
