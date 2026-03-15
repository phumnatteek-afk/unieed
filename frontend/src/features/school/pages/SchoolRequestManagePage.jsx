import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJson, getBlob } from "../../../api/http.js";
import { schoolRequestSvc } from "../services/schoolRequest.service.js";
import StudentModal from "../components/StudentModal.jsx";
import ExcelImportModal from "../components/ExcelImportModal.jsx";
import "../styles/requestManage.css";
import { Icon } from "@iconify/react";

// ── helpers ──────────────────────────────────────────────
function projectStatusMeta(status) {
  switch (String(status || "").toLowerCase()) {
    case "open":   return { label: "กำลังเปิดรับบริจาค", cls: "pill-green" };
    case "closed": return { label: "ปิดรับบริจาคแล้ว",   cls: "pill-gray"  };
    case "paused": return { label: "พักโครงการชั่วคราว", cls: "pill-yellow" };
    case "draft":  return { label: "ฉบับร่าง",           cls: "pill-blue"  };
    default:       return { label: "ไม่ทราบสถานะ",        cls: "pill-gray"  };
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
            {/* <div className="neSupport">
              {n.support_mode === "recurring"
                ? `🔄 ต่อเนื่อง ${n.support_years || 1} ปี`
                : "🎁 ครั้งเดียว"}
            </div> */}
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

  // ── reset page on filter change ───────────────────────
  useEffect(() => { setPage(1); }, [q, grade, status, urgFilter]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (qq && !String(r.student_name || "").toLowerCase().includes(qq) &&
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

  const formattedDate = project?.created_at
    ? new Date(project.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
    : "—";

  return (
    <div className="pm-page">

      {/* ══ TOP BAR ══════════════════════════════════════ */}
      <div className="pm-topbar">
        <div className="pm-topbar-left">
          {/* <button className="pm-back-btn" onClick={() => navigate("/school/projects")} type="button">
            <Icon icon="mdi:arrow-left" width="18" />
          </button> */}
          <div>
            <div className="pm-project-title">
              โครงการ: {project?.request_title || "กำลังโหลด..."}
            </div>
            <div className="pm-project-meta">
              <span className={`pm-status-pill ${meta.cls}`}>
                <span className="pm-status-dot" /> {meta.label}
              </span>
              <span className="pm-meta-sep">·</span>
              <span className="pm-meta-date">สร้างเมื่อ {formattedDate}</span>
            </div>
          </div>
        </div>
        <button
          className="pm-edit-btn"
          onClick={() => navigate(`/school/projects/${requestId}/edit`)}
          type="button"
        >
          <Icon icon="mdi:pencil-outline" width="16" /> แก้ไขโครงการ
        </button>
      </div>

      {err && <div className="pm-err"><Icon icon="mdi:alert-circle" width="16" /> {err}</div>}

      {/* ══ STAT CARDS ═══════════════════════════════════ */}
      <div className="pm-stats">
        {[
          { label: "นักเรียนทั้งหมด",  value: stats.total,      accent: "blue",   icon: "mdi:account-group" },
          { label: "เร่งด่วนมาก",       value: stats.veryUrgent, accent: "red",    icon: "mdi:alert" },
          { label: "ส่งมอบสำเร็จ",      value: stats.fulfilled,  accent: "green",  icon: "mdi:check-circle" },
          { label: "รอส่งมอบ",          value: stats.pending,    accent: "orange", icon: "mdi:clock-outline" },
        ].map((s, i) => (
          <div className={`pm-stat-card pm-stat-${s.accent}`} key={i}
               style={{ animationDelay: `${i * 60}ms` }}>
            <div className="pm-stat-icon-wrap">
              <Icon icon={s.icon} width="20" />
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
            <div className="pm-search-wrap">
              <Icon icon="mdi:magnify" className="pm-search-icon" width="18" />
              <input
                className="pm-search"
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อนักเรียน..."
              />
              {q && <button className="pm-search-clear" onClick={() => setQ("")} type="button">✕</button>}
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

            {(q || grade || status || urgFilter) && (
              <button className="pm-clear-filters"
                onClick={() => { setQ(""); setGrade(""); setStatus(""); setUrgFilter(""); }}
                type="button">
                ล้างตัวกรอง
              </button>
            )}
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
            <div className="pm-empty-icon">🔍</div>
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
          {/* ── Table ─────────────────────────────────── */}
<table className="pm-table">
  <thead>
    <tr>
      {/* ลบ <th style={{ width: 36 }} /> ออก */}
      <th>วันที่เพิ่ม</th>
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
            onClick={() => toggleExpand(r.student_id)}  // 👈 กดทั้งแถว
          >
            {/* ลบ td expand toggle ออกทั้งหมด */}

            {/* วันที่ */}
            <td onClick={(e) => e.stopPropagation()}>  {/* ป้องกัน bubble ถ้าต้องการ */}
              <div className="pm-date-cell">
                <span>{new Date(r.created_at).toLocaleDateString("th-TH", {
                  year: "numeric", month: "short", day: "numeric"
                })}</span>
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

            {/* actions — ต้องหยุด event ไม่ให้ trigger expand */}
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
              <td colSpan="9" className="pm-td-detail">  {/* 👈 ลด colSpan เหลือ 9 */}
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
      />
      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        requestId={requestId}
        onDone={loadStudentsAndTypes}
      />
    </div>
  );
}