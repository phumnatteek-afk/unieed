import { useEffect, useMemo, useState } from "react";
import * as svc from "../services/admin.service.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import SchoolDetailModal from "../components/SchoolDetailModal.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import "../styles/backoffice.css";
import { Icon } from "@iconify/react";

const SCHOOL_TIME_FILTERS = [
  { v: "today",   l: "วันนี้",   icon: "mdi:weather-sunny" },
  { v: "month",   l: "เดือนนี้", icon: "mdi:calendar-month" },
  { v: "3months", l: "3 เดือน",  icon: "mdi:calendar-range" },
  { v: "6months", l: "6 เดือน",  icon: "mdi:calendar-range" },
  { v: "year",    l: "1 ปี",     icon: "mdi:calendar-year" },
];

function isInDateRange(dateStr, period, startDate, endDate) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "today") {
    return d.toDateString() === now.toDateString();
  } else if (period === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } else if (period === "3months") {
    const cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 3);
    return d >= cutoff;
  } else if (period === "6months") {
    const cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 6);
    return d >= cutoff;
  } else if (period === "year") {
    const cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1);
    return d >= cutoff;
  } else if (period === "custom" && startDate && endDate) {
    const s = new Date(startDate); const e = new Date(endDate); e.setHours(23,59,59);
    return d >= s && d <= e;
  }
  return true;
}

export default function AdminSchoolsPage() {
  const { userName } = useAuth();

  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("latest");
  const [loading, setLoading] = useState(true);

  // Pagination
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);

  // confirm/reject modals (เดิมของคุณ)
  const [confirmData, setConfirmData] = useState(null); // { type: "approve" | "suspend" | "unsuspend", school_id }
  const [rejectData, setRejectData] = useState(null);   // { school_id }
  const [rejectNote, setRejectNote] = useState("");

  // toast
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // กันกดซ้ำ
  const [actionLoading, setActionLoading] = useState(false);

  const [period, setPeriod]       = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // ✅ school detail modal
  const [selectedSchool, setSelectedSchool] = useState(null);
  const openSchoolModal = (s) => setSelectedSchool(s);
  const closeSchoolModal = () => setSelectedSchool(null);

  const load = async () => {
    try {
      setErr("");
      setLoading(true);
      const data = await svc.listSchools({ q, status, sort });
      setStats(data.stats || { total: 0, pending: 0, approved: 0 });
      setRows(data.rows || []);
    } catch (e) {
      setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status, sort]);
  useEffect(() => { setPage(1); }, [q, status, sort]);

  // open approve/reject/suspend/unsuspend confirm
  const onApprove    = (school_id) => setConfirmData({ type: "approve",   school_id });
  const onRemove     = (school_id) => setConfirmData({ type: "suspend",   school_id });
  const onSuspend    = (school_id) => setConfirmData({ type: "suspend",   school_id });
  const onUnsuspend  = (school_id) => setConfirmData({ type: "unsuspend", school_id });
  const onReject     = (school_id) => { setRejectNote(""); setRejectData({ school_id }); };

  const handleConfirm = async () => {
    if (!confirmData || actionLoading) return;
    setActionLoading(true);
    try {
      if (confirmData.type === "approve") {
        await svc.approveSchool(confirmData.school_id);
        setToast({ type: "success", message: "อนุมัติสำเร็จ" });
      } else if (confirmData.type === "suspend") {
        await svc.suspendSchool(confirmData.school_id);
        setToast({ type: "success", message: "ระงับบัญชีสำเร็จ" });
      } else if (confirmData.type === "unsuspend") {
        await svc.unsuspendSchool(confirmData.school_id);
        setToast({ type: "success", message: "ปลดระงับบัญชีสำเร็จ" });
      }
      await load();
    } catch (e) {
      setToast({ type: "error", message: e?.data?.message || e.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setConfirmData(null);
      closeSchoolModal();
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectData || actionLoading) return;
    const note = rejectNote.trim();
    if (!note) {
      setToast({ type: "error", message: "กรุณากรอกเหตุผลก่อนปฏิเสธ" });
      return;
    }

    setActionLoading(true);
    try {
      await svc.rejectSchool(rejectData.school_id, note);
      setToast({ type: "success", message: "ปฏิเสธเรียบร้อย" });
      setRejectData(null);
      setRejectNote("");
      closeSchoolModal();
      await load();
    } catch (e) {
      setToast({ type: "error", message: e?.data?.message || e.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (s) => {
    if (s === "pending")   return <span className="admBadge admPending">รอตรวจสอบ</span>;
    if (s === "approved")  return <span className="admBadge admApproved">อนุมัติแล้ว</span>;
    if (s === "rejected")  return <span className="admBadge admRejected">รอพิจารณาใหม่</span>;
    if (s === "suspended") return <span className="admBadge admSuspended">ระงับบัญชี</span>;
    return <span className="admBadge">-</span>;
  };

  const tableRows = useMemo(() => {
    if (period === "all") return rows;
    return rows.filter(r => isInDateRange(r.created_at, period, startDate, endDate));
  }, [rows, period, startDate, endDate]);
  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [tableRows, safePage]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goPage = (p) => setPage(p);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  // ✅ save edit from modal
  const handleEditSave = async (school_id, payload) => {
    if (actionLoading) return;

    setActionLoading(true);
    try {
      await svc.updateSchool(school_id, payload);
      setToast({ type: "success", message: "บันทึกข้อมูลโรงเรียนสำเร็จ" });

      // อัปเดต selectedSchool ทันทีให้ UI ใน modal ไม่เด้งกลับ
      setSelectedSchool((prev) => (prev ? { ...prev, ...payload } : prev));

      await load();
    } catch (e) {
      setToast({ type: "error", message: e?.data?.message || e.message || "บันทึกไม่สำเร็จ" });
      throw e; // ให้ modal รู้ว่าพัง (ถ้าคุณอยาก)
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="admPage">
      <main className="boMain">
              {/* เพิ่ม div boTop เข้ามาคลุม */}
      <div className="boTop"> 
        <div className="boTitle">จัดการโรงเรียน</div>

        <div className="boAdmin">
          <NotificationBell />
          <div className="boAdminText">
            <ProfileDropdown />
          </div>
        </div>
      </div>

        {/* Stats */}
        <section className="admStats">
          <div className="admStatCard">
            <div className="admStatLabel">ทั้งหมด</div>
            <div className="admStatNum">{stats.total}</div>
            <div className="admStatSub">โรงเรียน</div>
          </div>
          <div className="admStatCard admStatWarn">
            <div className="admStatLabel">รอการตรวจสอบ</div>
            <div className="admStatNum">{stats.pending}</div>
            <div className="admStatSub">โรงเรียน</div>
          </div>
          <div className="admStatCard admStatOk">
            <div className="admStatLabel">อนุมัติแล้ว</div>
            <div className="admStatNum">{stats.approved}</div>
            <div className="admStatSub">โรงเรียน</div>
          </div>
        </section>

        {/* Time filter */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "14px 18px", marginBottom: 0, boxShadow: "0 2px 8px rgba(15,23,42,0.05)", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon icon="mdi:clock-time-four-outline" style={{ color: "#fff", fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>ช่วงเวลา</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>กรองโรงเรียนตามวันที่สมัคร</div>
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
            {[{ v: "all", l: "ทั้งหมด", icon: "mdi:format-list-bulleted" }, ...SCHOOL_TIME_FILTERS].map((t) => {
              const isActive = period === t.v && !showPicker;
              return (
                <button key={t.v} type="button"
                  onClick={() => { setPeriod(t.v); setShowPicker(false); setPage(1); }}
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
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", cursor: "pointer" }} />
                </div>
              </div>
              <Icon icon="mdi:arrow-right" style={{ color: "#2563eb", fontSize: 18, paddingTop: 14 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon="mdi:calendar-end" style={{ color: "#fff", fontSize: 14 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", marginBottom: 3 }}>วันสิ้นสุด</div>
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", cursor: "pointer" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <section className="admFilters">
          <div className="admSearch">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา..." />
            <button className="admSearchBtn" onClick={load} aria-label="search">
              <Icon icon="material-symbols:search-rounded" width="28" height="28" />
            </button>
          </div>

          <div className="admFilterRow">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="admSelect">
              <option value="">สถานะทั้งหมด</option>
              <option value="pending">รอตรวจสอบ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">รอพิจารณาใหม่</option>
              <option value="suspended">ระงับบัญชี</option>
            </select>

            <select value={sort} onChange={(e) => setSort(e.target.value)} className="admSelect">
              <option value="latest">ล่าสุด</option>
              <option value="oldest">เก่าสุด</option>
            </select>
          </div>
        </section>

        {err && <div className="admError">{err}</div>}

        {/* Table */}
        <section className="admCard">
          {loading ? (
            <div className="admMuted">กำลังโหลด…</div>
          ) : (
            <>
              <div className="admTableWrap">
                <table className="admTable">
                  <thead>
                    <tr>
                      <th>ชื่อโรงเรียน</th>
                      <th>ผู้ดูแลโรงเรียน</th>
                      <th>ข้อมูลติดต่อ</th>
                      <th>ที่อยู่</th>
                      <th>เอกสาร</th>
                      <th>สถานะ</th>
                      <th>ดูเพิ่มเติม</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedRows.map((s) => (
                      <tr key={s.school_id}>
                        <td style={{ fontWeight: 600, color: "#1e293b", whiteSpace: "normal", wordBreak: "break-word", overflow: "visible" }}>{s.school_name}</td>

                        <td>
                          <div className="admCol">
                            <div className="admTdStrong">{s.coordinator_name || "-"}</div>
                            <div className="admSmallMuted">{s.coordinator_email || "-"}</div>
                          </div>
                        </td>

                        <td>{s.school_phone || "-"}</td>
                        <td className="admClamp">{s.school_address || "-"}</td>

                        <td>
                          {s.school_doc_url ? (
                            <a className="admDocBtn" href={s.school_doc_url} target="_blank" rel="noreferrer">
                              🗂 ดูเอกสาร
                            </a>
                          ) : (
                            <span className="admSmallMuted">-</span>
                          )}
                        </td>

                        <td>{statusBadge(s.verification_status)}</td>

                        <td>
                          {/* ✅ แก้ row -> s */}
                          <button className="btn btnGhost" onClick={() => openSchoolModal(s)}>
                            ดูเพิ่มเติม
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!pagedRows.length && (
                      <tr>
                        <td colSpan="7" className="admMuted">ยังไม่มีข้อมูล</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="admPager">
                <div className="admPagerNums">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        className={`admPageNum ${p === safePage ? "active" : ""}`}
                        onClick={() => goPage(p)}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <div className="admPagerBtns">
                  <button className="admPagerBtn" onClick={goPrev} disabled={safePage === 1}>
                    กลับ
                  </button>
                  <button className="admPagerBtn" onClick={goNext} disabled={safePage === totalPages}>
                    ถัดไป
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Confirm Modal (approve/remove) */}
        {confirmData && (
          <div className="admModalOverlay">
            <div className="admModal">
              <h3>ยืนยันการดำเนินการ</h3>
              <p>
                {confirmData.type === "approve"   && "ต้องการอนุมัติโรงเรียนนี้ใช่หรือไม่?"}
                {confirmData.type === "suspend"   && "ต้องการระงับบัญชีโรงเรียนนี้ชั่วคราวใช่หรือไม่? โรงเรียนจะไม่สามารถเข้าสู่ระบบได้จนกว่าจะปลดระงับ"}
                {confirmData.type === "unsuspend" && "ต้องการปลดระงับและเปิดใช้งานบัญชีโรงเรียนนี้อีกครั้งใช่หรือไม่?"}
              </p>
              <div className="admModalActions">
                <button onClick={() => setConfirmData(null)} className="admBtnGhost" disabled={actionLoading}>
                  ยกเลิก
                </button>
                <button onClick={handleConfirm} className="admBtnPrimary" disabled={actionLoading}>
                  {actionLoading ? "กำลังบันทึก..." : "ยืนยัน"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {rejectData && (
          <div className="admModalOverlay">
            <div className="admModal">
              <h3>แจ้งเหตุผลการตรวจสอบ</h3>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="กรอกเหตุผล..."
                rows={4}
              />
              <div className="admModalActions">
                <button onClick={() => setRejectData(null)} className="admBtnGhost" disabled={actionLoading}>
                  ยกเลิก
                </button>
                <button onClick={handleRejectSubmit} className="admBtnDanger" disabled={actionLoading}>
                  {actionLoading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ School Detail Modal (ปุ่มอนุมัติ/ปฏิเสธ/นำออก อยู่ท้ายการ์ดในนี้) */}
        <SchoolDetailModal
          open={!!selectedSchool}
          school={selectedSchool}
          onClose={closeSchoolModal}
          busy={actionLoading}
          onEditSave={handleEditSave}
          onApprove={(s)    => onApprove(s.school_id)}
          onReject={(s)     => onReject(s.school_id)}
          onRemove={(s)     => onSuspend(s.school_id)}
          onSuspend={(s)    => onSuspend(s.school_id)}
          onUnsuspend={(s)  => onUnsuspend(s.school_id)}
        />

        {toast && <div className={`admToast ${toast.type}`}>{toast.message}</div>}
      </main>
    </div>
  );
}
