import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson, getBlob } from "../../../api/http.js";
import { schoolRequestSvc } from "../services/schoolRequest.service.js";
import StudentModal from "../components/StudentModal.jsx";
import ExcelImportModal from "../components/ExcelImportModal.jsx";
import "../styles/requestManage.css";
import { Icon } from "@iconify/react";

// ── helpers ──────────────────────────────────────────────
function projectStatusMeta(status) {
  switch (String(status || "").toLowerCase()) {
    case "open":     return { label: "กำลังเปิดรับบริจาค", cls: "pill-green"  };
    case "closed":   return { label: "ปิดรับบริจาคแล้ว",   cls: "pill-yellow" };
    case "archived": return { label: "จบโครงการแล้ว",      cls: "pill-gray"   };
    case "paused":   return { label: "ได้รับครบแล้ว — ซ่อนจากฟีดชั่วคราว", cls: "pill-green" };
    case "draft":    return { label: "ฉบับร่าง",           cls: "pill-blue"   };
    default:         return { label: "ไม่ทราบสถานะ",        cls: "pill-gray"   };
  }
}

const FULFILL_META = {
  fulfilled: { text: "ครบแล้ว",    cls: "badge-green"  },
  partial:   { text: "บางส่วน",    cls: "badge-yellow" },
  pending:   { text: "ยังไม่ได้รับ", cls: "badge-red"  },
};

const URGENCY_META = {
  very_urgent: { label: "เร่งด่วนมาก", cls: "urg-red",    dot: "#EF4444" },
  urgent:      { label: "เร่งด่วน",    cls: "urg-yellow",  dot: "#F59E0B" },
  can_wait:    { label: "รอได้",        cls: "urg-blue",    dot: "#29B6E8" },
};

const GENDER_TH = { male: "ชาย", female: "หญิง" };
const PAGE_SIZE  = 20;

function parseSize(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Expanded needs row ────────────────────────────────────
function NeedsExpanded({ needs = [] }) {
  if (!needs.length) return <div className="neEmpty">ไม่มีรายการ</div>;
  return (
    <div className="neGrid">
      {needs.map((n, i) => {
        const size    = parseSize(n.size);
        const pct     = n.quantity_needed > 0
          ? Math.round((n.quantity_received / n.quantity_needed) * 100) : 0;
        const fm      = FULFILL_META[n.status] || FULFILL_META.pending;
        return (
          <div className="neCard" key={i}>
            <div className="neCardTop">
              <span className="neTypeName">{n.uniform_type_name || `ประเภท ${n.uniform_type_id}`}</span>
              <span className={`neBadge ${fm.cls}`}>{fm.text}</span>
            </div>
            <div className="neCardMeta">
              {Object.entries(size).map(([k, v]) => (
                <span key={k} className="neSizeTag">
                  {k === "chest" ? "รอบอก" : k === "waist" ? "รอบเอว" : k}: {v} cm
                </span>
              ))}
            </div>
            <div className="neProgress">
              <div className="neProgressBar">
                <div className="neProgressFill" style={{ width: `${pct}%`,
                  background: pct >= 100 ? "#10B981" : pct > 0 ? "#F59E0B" : "#E5E7EB" }} />
              </div>
              <span className="neProgressLabel">{n.quantity_received}/{n.quantity_needed} ตัว</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function SchoolRequestManagePage() {
  const { requestId } = useParams();
  const navigate      = useNavigate();
  const location      = useLocation();
  const { token }     = useAuth();

  const [project,      setProject]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState("");
  const [rows,         setRows]         = useState([]);
  const [uniformTypes, setUniformTypes] = useState([]);

  const [q,      setQ]      = useState("");
  const [grade,  setGrade]  = useState("");
  const [status, setStatus] = useState("");
  const [urgFilter, setUrgFilter] = useState("");

  const [page,    setPage]    = useState(1);
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen,  setImportOpen]  = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pendingModal, setPendingModal] = useState({ show: false, count: 0 });
  const BANNER_KEY = `canOpenBanner_${requestId}`;
  // canOpenProject = conditions met (persist ใน sessionStorage, ไม่ถูกลบเมื่อ dismiss)
  const [canOpenProject, setCanOpenProject] = useState(() => sessionStorage.getItem(BANNER_KEY) === "1");
  // bannerDismissed = local state ควบคุมการซ่อน banner เท่านั้น
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const canOpenBanner = canOpenProject && !bannerDismissed;

  const setCanOpenBannerTrue = () => {
    sessionStorage.setItem(BANNER_KEY, "1");
    setCanOpenProject(true);
    setBannerDismissed(false);
  };

  const meta = projectStatusMeta(project?.status);

  const loadStudentsAndTypes = async () => {
    try {
      setErr(""); setLoading(true);
      const [uts, data] = await Promise.all([
        schoolRequestSvc.getUniformTypes(),
        schoolRequestSvc.listStudents(requestId),
      ]);
      setUniformTypes(Array.isArray(uts)  ? uts  : []);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally { setLoading(false); }
  };

  const loadProject = async () => {
    try {
      const data = await getJson(`/school/projects/${requestId}`, true);
      setProject(data);
    } catch (e) {
      setErr((p) => p || e?.data?.message || e.message || "โหลดโครงการไม่สำเร็จ");
    }
  };

  useEffect(() => {
    if (!requestId) return;
    loadProject(); loadStudentsAndTypes();
  }, [requestId]);

  // ── auto-open excel import เมื่อมาจากสร้างโครงการใหม่ ──
  useEffect(() => {
    if (location.state?.newProject) {
      setImportOpen(true);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  // ── reset page on filter change ───────────────────────
  useEffect(() => { setPage(1); }, [q, grade, status, urgFilter]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (qq && !String(r.student_name || "").toLowerCase().includes(qq) &&
                !String(r.student_code || "").toLowerCase().includes(qq) &&
                !String(r.gender || "").toLowerCase().includes(qq)) return false;
      if (grade     && r.education_level           !== grade)     return false;
      if (status    && r.summary?.fulfillStatus    !== status)    return false;
      if (urgFilter && r.urgency                   !== urgFilter) return false;
      return true;
    });
  }, [rows, q, grade, status, urgFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => ({
    total:       rows.length,
    veryUrgent:  rows.filter((r) => r.urgency === "very_urgent").length,
    fulfilled:   rows.filter((r) => r.summary?.fulfillStatus === "fulfilled").length,
    pending:     rows.filter((r) => r.summary?.fulfillStatus !== "fulfilled").length,
  }), [rows]);

  const toggleExpand = (id) => setExpandedIds((prev) => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const onAdd    = () => { setEditing(null); setOpen(true); };
  const onEdit   = (r) => { setEditing(r);  setOpen(true); };
  const onDelete = async (r) => {
    if (!confirm(`ลบ "${r.student_name}" ออกจากโครงการ?`)) return;
    try {
      await schoolRequestSvc.deleteStudent(requestId, r.student_id);
      await loadStudentsAndTypes();
    } catch (e) { alert(e?.data?.message || e.message); }
  };
  const onSave   = async (payload) => {
    try {
      editing
        ? await schoolRequestSvc.updateStudent(requestId, editing.student_id, payload)
        : await schoolRequestSvc.createStudent(requestId, payload);
      setOpen(false); setEditing(null);
      await loadStudentsAndTypes();
    } catch (e) { alert(e?.data?.message || e.message); }
  };
  const onExport = async () => {
    if (exporting || !rows.length) return;
    try {
      setExporting(true);
      const blob = await getBlob(`/school/projects/${requestId}/students/export`);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `unieed_${project?.request_title || requestId}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { alert(e?.data?.message || e.message || "Export ไม่สำเร็จ"); }
    finally { setExporting(false); }
  };

  const handleCloseProject = async () => {
    try {
      setClosing(true);
      const res = await fetch(`http://localhost:3000/school/projects/${requestId}/close`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ปิดโครงการไม่สำเร็จ");
      setCloseConfirm(false);
      await loadProject();
      if (data.pending_count > 0) {
        setPendingModal({ show: true, count: data.pending_count });
      } else {
        setCanOpenBannerTrue();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setClosing(false);
    }
  };

  const formattedDate = (project?.start_date || project?.created_at)
    ? new Date(project.start_date || project.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
    : "—";

  return (
    <div className="pm-page">

      {/* ══ TOP BAR ══════════════════════════════════════ */}
      <div className="pm-topbar">
        <div className="pm-topbar-left">
          <div>
            <div className="pm-project-title">
              โครงการ: {project?.request_title || "กำลังโหลด..."}
            </div>
            <div className="pm-project-meta">
              <span className={`pm-status-pill ${meta.cls}`}>
                <span className="pm-status-dot" /> {meta.label}
              </span>
              <span className="pm-meta-sep">·</span>
              <span className="pm-meta-date">เริ่มต้น {formattedDate}</span>
              {project?.end_date && (
                <>
                  <span className="pm-meta-sep">·</span>
                  <span className="pm-meta-date">
                    สิ้นสุด {new Date(project.end_date).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {project?.status === "open" && (
            <button
              type="button"
              onClick={() => setCloseConfirm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 10,
                background: "#FEF2F2", color: "#DC2626",
                border: "1.5px solid #FECACA",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Icon icon="mdi:lock-outline" width="16" /> ปิดโครงการ
            </button>
          )}
          {canOpenProject && bannerDismissed && (
            <button
              type="button"
              onClick={() => navigate("/school/request/new")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 10,
                background: "#f0fdf4", color: "#15803d",
                border: "1.5px solid #86efac",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Icon icon="mdi:plus-circle-outline" width="16" /> เปิดโครงการใหม่
            </button>
          )}
          <button
            className="pm-edit-btn"
            onClick={() => navigate(`/school/projects/${requestId}/edit`)}
            type="button"
          >
            <Icon icon="mdi:pencil-outline" width="16" /> แก้ไขโครงการ
          </button>
        </div>
      </div>

      {err && <div className="pm-err"><Icon icon="mdi:alert-circle" width="16" /> {err}</div>}

      {/* ══ PAUSED BANNER ════════════════════════════════ */}
      {project?.status === "paused" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#f0fdf4", border: "1.5px solid #86efac",
          borderRadius: 12, padding: "14px 16px", marginBottom: 16,
        }}>
          <Icon icon="mdi:check-circle" width={22} color="#16a34a" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: "#15803d", fontSize: 14 }}>ได้รับชุดครบตามจำนวนที่ต้องการแล้ว</div>
            <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>โครงการนี้ถูกซ่อนจากฟีดชั่วคราว — จะกลับมาปรากฏเมื่อเพิ่มนักเรียนหรือจำนวนความต้องการใหม่</div>
          </div>
        </div>
      )}

      {/* ══ CAN OPEN BANNER ══════════════════════════════ */}
      {canOpenBanner && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#f0fdf4", border: "1.5px solid #86efac",
          borderRadius: 12, padding: "14px 16px", marginBottom: 16,
        }}>
          <Icon icon="mdi:check-circle" width={22} color="#16a34a" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#15803d", fontSize: 14 }}>ไม่มีรายการค้าง — เปิดโครงการใหม่ได้ทันที</div>
            <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>รายการบริจาคทั้งหมดได้รับการยืนยันครบแล้ว</div>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            style={{ background: "none", border: "1.5px solid #86efac", borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: 12, color: "#166534", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ไม่ใช่ตอนนี้
          </button>
          <button
            onClick={() => navigate("/school/request/new")}
            style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            เปิดโครงการใหม่ →
          </button>
        </div>
      )}

      {/* ══ CLOSED BANNER ════════════════════════════════ */}
      {project?.status === "closed" && !canOpenProject && (() => {
        const canCreateDate = project.end_date
          ? new Date(new Date(project.end_date).getTime() + 14 * 24 * 60 * 60 * 1000)
          : null;
        const formatted = canCreateDate
          ? canCreateDate.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
          : null;
        return (
          <div className="pm-closed-banner">
            <Icon icon="mdi:clock-outline" width="20" />
            <span>
              โครงการปิดแล้ว — ยังสามารถอัปเดตสถานะรายการได้อีก 14 วัน
              {formatted && <> สร้างโครงการใหม่ได้ตั้งแต่ <strong>{formatted}</strong></>}
              <span style={{ display: "block", fontSize: 12, color: "#92400e", marginTop: 3 }}>
                หากรายการบริจาคทั้งหมดได้รับการยืนยันก่อนครบ 14 วัน สามารถสร้างโครงการใหม่ได้ทันที
              </span>
            </span>
          </div>
        );
      })()}

      {/* ══ STAT CARDS ═══════════════════════════════════ */}
      <div className="pm-stats">
        {[
          { label: "เร่งด่วนมาก",       value: stats.veryUrgent, accent: "red",    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><path fill="currentColor" d="M17.66 11.2c-.23-.3-.51-.56-.77-.82c-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32c-2.59 2.08-3.61 5.75-2.39 8.9c.04.1.08.2.08.33c0 .22-.15.42-.35.5c-.23.1-.47.04-.66-.12a.6.6 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5c.14.6.41 1.2.71 1.73c1.08 1.73 2.95 2.97 4.96 3.22c2.14.27 4.43-.12 6.07-1.6c1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6c-1.12.4-2.24-.16-2.9-.82c1.19-.28 1.9-1.16 2.11-2.05c.17-.8-.15-1.46-.28-2.23c-.12-.74-.1-1.37.17-2.06c.19.38.39.76.63 1.06c.77 1 1.98 1.44 2.24 2.8c.04.14.06.28.06.43c.03.82-.33 1.72-.93 2.27"/></svg>'},
          { label: "รอส่งมอบ",          value: stats.pending,    accent: "orange", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0"/><path d="M12 7v5l3 3"/></g></svg>' },
          { label: "ส่งมอบสำเร็จ",      value: stats.fulfilled,  accent: "green",  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><path fill="currentColor" d="M20 7h-1.21c.13-.41.21-.9.21-1.5C19 3.57 17.43 2 15.5 2c-1.62 0-2.7 1.48-3.4 3.09C11.41 3.58 10.27 2 8.5 2C6.57 2 5 3.57 5 5.5c0 .6.08 1.09.21 1.5H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2m-4.5-3c.83 0 1.5.67 1.5 1.5C17 7 16.37 7 16 7h-2.48c.51-1.58 1.25-3 1.98-3M7 5.5C7 4.67 7.67 4 8.5 4c.89 0 1.71 1.53 2.2 3H8c-.37 0-1 0-1-1.5M4 9h7v2H4zm2 11v-7h5v7zm12 0h-5v-7h5zm-5-9V9.08s.01-.06.02-.08H20v2z"/></svg>' },
          { label: "นักเรียนทั้งหมด",  value: stats.total, accent: "blue", icon: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M2.5 6L8 4l5.5 2L11 7.5V9s-.667-.5-3-.5S5 9 5 9V7.5zm0 0v4"/><path d="M11 8.5v.889c0 1.718-1.343 3.111-3 3.111s-3-1.393-3-3.111V8.5m10.318 2.53s.485-.353 2.182-.353s2.182.352 2.182.352m-4.364 0V10L13.5 9l4-1.5l4 1.5l-1.818 1v1.03m-4.364 0v.288a2.182 2.182 0 1 0 4.364 0v-.289M4.385 15.926c-.943.527-3.416 1.602-1.91 2.947C3.211 19.53 4.03 20 5.061 20h5.878c1.03 0 1.85-.47 2.586-1.127c1.506-1.345-.967-2.42-1.91-2.947c-2.212-1.235-5.018-1.235-7.23 0M16 20h3.705c.773 0 1.387-.376 1.939-.902c1.13-1.076-.725-1.936-1.432-2.357A5.34 5.34 0 0 0 16 16.214"/></g></svg>' },
        ].map((s, i) => (
          <div className={`pm-stat-card pm-stat-${s.accent}`} key={i}
               style={{ animationDelay: `${i * 60}ms` }}>
            <div className="pm-stat-icon-wrap">
              {s.icon.includes('<svg') ? (
                <div
                  className="custom-svg-icon"
                  style={{ width: '30px', height: '30px', display: 'flex' }}
                  dangerouslySetInnerHTML={{ __html: s.icon }}
                />
              ) : (
                <Icon icon={s.icon} width="20" />
              )}
            </div>
            <div className="pm-stat-body">
              <div className="pm-stat-value">{s.value}</div>
              <div className="pm-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══ TABLE CARD ═══════════════════════════════════ */}
      <div className="pm-table-card">

        {/* ── Toolbar ────────────────────────────────── */}
        <div className="pm-toolbar">
          <div className="pm-toolbar-left">
            <div className="pm-search-group">
              <div className="pm-search-wrap">
                <Icon icon="mdi:magnify" className="pm-search-icon" width="18" />
                <input
                  className="pm-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาชื่อ / รหัสนักเรียน..."
                />
                {q && (
                  <button className="pm-search-clear" onClick={() => setQ("")} type="button">✕</button>
                )}
              </div>
              {(q || grade || status || urgFilter) && (
                <button
                  className="pm-clear-filters"
                  onClick={() => { setQ(""); setGrade(""); setStatus(""); setUrgFilter(""); }}
                  type="button"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
            <select className="pm-filter-sel" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">ทุกระดับชั้น</option>
              <option value="อนุบาล">อนุบาล</option>
              <option value="ประถมศึกษา">ประถมศึกษา</option>
              <option value="มัธยมศึกษา">มัธยมศึกษา</option>
            </select>
            <select className="pm-filter-sel" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              <option value="pending">ยังไม่ได้รับ</option>
              <option value="partial">ได้รับบางส่วน</option>
              <option value="fulfilled">ได้รับครบแล้ว</option>
            </select>
            <select className="pm-filter-sel" value={urgFilter} onChange={(e) => setUrgFilter(e.target.value)}>
              <option value="">ทุกความเร่งด่วน</option>
              <option value="very_urgent">เร่งด่วนมาก</option>
              <option value="urgent">เร่งด่วน</option>
              <option value="can_wait">รอได้</option>
            </select>
          </div>

          <div className="pm-toolbar-right">
            <button className="pm-btn-ghost" onClick={onExport}
              disabled={exporting || !rows.length} type="button">
              <Icon icon={exporting ? "mdi:loading" : "mdi:microsoft-excel"} width="16"
                    className={exporting ? "spin" : ""} />
              {exporting ? "กำลัง Export..." : "Export Excel"}
            </button>
            <button className="pm-btn-ghost" onClick={() => setImportOpen(true)} type="button">
              <Icon icon="mdi:upload" width="16" /> Import Excel
            </button>
            <button className="pm-btn-primary" onClick={onAdd} type="button">
              <Icon icon="mdi:plus" width="16" /> เพิ่มนักเรียน
            </button>
          </div>
        </div>

        {/* ── Result count ──────────────────────────── */}
        {!loading && (
          <div className="pm-result-info">
            แสดง {filtered.length === rows.length
              ? `${rows.length} คน`
              : `${filtered.length} จาก ${rows.length} คน`}
            {filtered.length > PAGE_SIZE && ` · หน้า ${page}/${totalPages}`}
          </div>
        )}

        {/* ── Table ─────────────────────────────────── */}
        {loading ? (
          <div className="pm-loading">
            <div className="pm-loading-spinner" />
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        ) : !filtered.length ? (
          <div className="pm-empty">
            <div className="pm-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0s.41-1.08 0-1.49zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14"/></svg></div>
            <div className="pm-empty-text">
              {rows.length === 0 ? "ยังไม่มีนักเรียนในโครงการนี้" : "ไม่พบผลลัพธ์ที่ตรงกับตัวกรอง"}
            </div>
            {rows.length === 0 && (
              <button className="pm-btn-primary" onClick={onAdd} type="button" style={{ marginTop: 16 }}>
                ➕ เพิ่มนักเรียนคนแรก
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="pm-table-wrap">
              <table className="pm-table">
                <thead>
                  <tr>
                    {/* ✅ รหัสนักเรียนเป็นคอลัมน์แรกแทนวันที่ */}
                    <th style={{ width: 110 }}>รหัสนักเรียน</th>
                    <th>นักเรียน</th>
                    <th>ระดับชั้น</th>
                    <th>ความเร่งด่วน</th>
                    <th>รายการชุด</th>
                    <th>ความคืบหน้า</th>
                    <th>สถานะ</th>
                    <th>การรับ</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r, ri) => {
                    const urg = URGENCY_META[r.urgency] || URGENCY_META.can_wait;
                    const fm  = FULFILL_META[r.summary?.fulfillStatus] || FULFILL_META.pending;
                    const exp = expandedIds.has(r.student_id);
                    const pct = (() => {
                      const parts = (r.summary?.receivedText || "0/0").split("/");
                      const rec = Number(parts[0] || 0), tot = Number(parts[1] || 0);
                      return tot > 0 ? Math.round((rec / tot) * 100) : 0;
                    })();

                    return (
                      <>
                        <tr
                          key={r.student_id}
                          className={`pm-row ${exp ? "pm-row-expanded" : ""}`}
                          style={{ animationDelay: `${ri * 20}ms`, cursor: "pointer" }}
                          onClick={() => toggleExpand(r.student_id)}
                        >
                          {/* ✅ คอลัมน์รหัสนักเรียน — แทนที่วันที่ */}
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="pm-code-cell">
                              {r.student_code ? (
                                <span className="pm-student-code-badge">
                                  <Icon icon="mdi:identifier" width="12" style={{ opacity: 0.6 }} />
                                  {r.student_code}
                                </span>
                              ) : (
                                <span className="pm-code-empty">—</span>
                              )}
                            </div>
                          </td>

                          {/* นักเรียน */}
                          <td>
                            <div className="pm-student-cell">
                              <div>
                                <div className="pm-student-name">{r.student_name}</div>
                                <div className="pm-student-s">
                                  <div className="pm-avatar" style={{
                                    background: r.gender === "male" ? "#DBEAFE" : "#FCE7F3",
                                    color: r.gender === "male" ? "#1D4ED8" : "#BE185D",
                                  }}>
                                    <Icon
                                      icon={r.gender === "male" ? "solar:men-outline" : "solar:women-outline"}
                                      width="10"
                                    />
                                  </div>
                                  <div className="pm-student-sub">
                                    {GENDER_TH[r.gender] || r.gender}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* ระดับชั้น */}
                          <td>
                            <span className="pm-grade-tag">
                              <span className="pm-grade-full"> {r.education_level}</span>
                            </span>
                          </td>

                          {/* ความเร่งด่วน */}
                          <td>
                            <span className={`pm-urg-badge ${urg.cls}`}>
                              <span className="pm-urg-dot" style={{ background: urg.dot }} />
                              {urg.label}
                            </span>
                          </td>

                          {/* รายการ */}
                          <td>
                            <span className="pm-items-count">
                              {r.summary?.totalItems || 0} รายการ
                            </span>
                          </td>

                          {/* progress */}
                          <td>
                            <div className="pm-prog-cell">
                              <div className="pm-prog-bar">
                                <div className="pm-prog-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 100 ? "#10B981" : pct > 0 ? "#F59E0B" : "#E5E7EB",
                                  }} />
                              </div>
                              <span className="pm-prog-text">{r.summary?.receivedText || "0/0"}</span>
                            </div>
                          </td>

                          {/* สถานะ */}
                          <td><span className={`pm-fulfill-badge ${fm.cls}`}>{fm.text}</span></td>

                          {/* การรับ */}
                          <td>
                            <span className="pm-support-tag">
                              <Icon
                                icon={r.summary?.supportLabel === "รับต่อเนื่อง" ? "mdi:calendar-sync" : "mdi:gift-outline"}
                                width="13" style={{ marginRight: 4, verticalAlign: "middle" }}
                              />
                              {r.summary?.supportLabel || "—"}
                            </span>
                          </td>

                          {/* actions */}
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="pm-actions">
                              <button className="pm-action-btn pm-action-edit"
                                onClick={() => onEdit(r)} type="button" title="แก้ไข">
                                <Icon icon="iconamoon:edit" width="50" height="50" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Expanded needs ─────────────── */}
                        {exp && (
                          <tr key={`${r.student_id}-exp`} className="pm-row-detail">
                            <td colSpan="9" className="pm-td-detail">
                              <NeedsExpanded needs={r.needs || []} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ──────────────────────────── */}
            {totalPages > 1 && (
              <div className="pm-pagination">
                <button className="pm-pg-btn" disabled={page === 1}
                  onClick={() => setPage(1)} type="button">«</button>
                <button className="pm-pg-btn" disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)} type="button">‹</button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…"
                      ? <span key={`ellipsis-${i}`} className="pm-pg-ellipsis">…</span>
                      : <button key={p} className={`pm-pg-btn ${page === p ? "pm-pg-active" : ""}`}
                          onClick={() => setPage(p)} type="button">{p}</button>
                  )}

                <button className="pm-pg-btn" disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)} type="button">›</button>
                <button className="pm-pg-btn" disabled={page === totalPages}
                  onClick={() => setPage(totalPages)} type="button">»</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ MODALS ═══════════════════════════════════════ */}
      <StudentModal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSave={onSave}
        uniformTypes={Array.isArray(uniformTypes) ? uniformTypes : []}
        initial={editing}
        existingStudents={rows}
      />
      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        requestId={requestId}
        onDone={loadStudentsAndTypes}
      />

      {/* ── Pending Modal หลังปิดโครงการ ── */}
      {pendingModal.show && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 16,
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: 28,
            maxWidth: 400, width: "100%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>
              ยังมีรายการบริจาคค้างอยู่
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8, marginBottom: 20 }}>
              มีรายการที่รอยืนยัน <strong style={{ color: "#DC2626" }}>{pendingModal.count} รายการ</strong><br />
              กรุณาตรวจสอบและยืนยันให้ครบ<br /><br />
              ระบบจะอนุญาตให้เปิดโครงการใหม่ได้<br />
              • <strong>ทันที</strong> — เมื่อเคลียร์รายการค้างครบ<br />
              • <strong>อัตโนมัติ</strong> — เมื่อครบ 14 วันหลังปิด
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setPendingModal({ show: false, count: 0 })}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                รับทราบ
              </button>
              <button
                onClick={() => { setPendingModal({ show: false, count: 0 }); navigate("/school/donations"); }}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#FFBE1B", color: "#1a1a2e", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ดูรายการค้าง →
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Confirm ปิดโครงการ ── */}
      {closeConfirm && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 16,
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: 28,
            maxWidth: 380, width: "100%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>
              ยืนยันปิดโครงการ?
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 20 }}>
              โครงการจะหยุดรับบริจาคทันที และจะไม่แสดงในหน้าหลักอีกต่อไป<br />
              หากไม่มีรายการบริจาคค้าง สามารถเปิดโครงการใหม่ได้ทันที
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setCloseConfirm(false)}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCloseProject}
                disabled={closing}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: closing ? "#9CA3AF" : "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {closing ? "กำลังปิด..." : "ยืนยันปิดโครงการ"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}