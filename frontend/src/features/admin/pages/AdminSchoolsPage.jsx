import { useEffect, useMemo, useState } from "react";
import * as svc from "../services/admin.service.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/backoffice.css";
import { Icon } from "@iconify/react";

export default function AdminSchoolsPage() {
  const { userName } = useAuth();

  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("latest");
  const [loading, setLoading] = useState(true);

  // ✅ Pagination
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);

  // ✅ Modal state
  const [confirmData, setConfirmData] = useState(null); // { type: "approve" | "remove", school_id }
  const [rejectData, setRejectData] = useState(null);   // { school_id }
  const [rejectNote, setRejectNote] = useState("");

  // ✅ Toast
  const [toast, setToast] = useState(null); // { type: "success" | "error", message }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ✅ กันกดซ้ำตอนกำลังบันทึก
  const [actionLoading, setActionLoading] = useState(false);

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, sort]);

  // ✅ เวลา filter/ค้นหา เปลี่ยน ให้กลับไปหน้า 1 เสมอ
  useEffect(() => {
    setPage(1);
  }, [q, status, sort]);

  // ✅ เปิด modal อนุมัติ
  const onApprove = (school_id) => {
    setConfirmData({ type: "approve", school_id });
  };

  // ✅ เปิด modal ปฏิเสธ
  const onReject = (school_id) => {
    setRejectNote("");
    setRejectData({ school_id });
  };

  // ✅ เปิด modal นำออก
  const onRemove = (school_id) => {
    setConfirmData({ type: "remove", school_id });
  };

  // ✅ ยืนยัน (approve/remove)
  const handleConfirm = async () => {
    if (!confirmData || actionLoading) return;

    setActionLoading(true);
    try {
      if (confirmData.type === "approve") {
        await svc.approveSchool(confirmData.school_id);
        setToast({ type: "success", message: "อนุมัติสำเร็จ" });
      } else if (confirmData.type === "remove") {
        await svc.removeSchool(confirmData.school_id);
        setToast({ type: "success", message: "นำออกสำเร็จ" });
      }

      setConfirmData(null);
      await load();
    } catch (e) {
      setToast({ type: "error", message: e?.data?.message || e.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ ยืนยันปฏิเสธ
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
      await load();
    } catch (e) {
      setToast({ type: "error", message: e?.data?.message || e.message || "ทำรายการไม่สำเร็จ" });
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (s) => {
    if (s === "pending") return <span className="admBadge admPending">รอตรวจสอบ</span>;
    if (s === "approved") return <span className="admBadge admApproved">อนุมัติแล้ว</span>;
    if (s === "rejected") return <span className="admBadge admRejected">ปฏิเสธ</span>;
    return <span className="admBadge">-</span>;
  };

  const canApprove = (s) => s === "pending";
  const canRemove = (s) => s === "approved";

  const tableRows = useMemo(() => rows, [rows]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [tableRows, safePage]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goPage = (p) => setPage(p);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="boPage">
      <main className="boMain">
        <div className="boTop">
          <div className="boTitle">จัดการโรงเรียน</div>
          <div className="boAdmin">
            <div className="boAdminText">
              <div className="boAdminRole">
                <span><Icon icon="subway:admin" /></span>
                <span>ผู้ดูแลระบบ: </span>
                <b>{userName || "Admin"}</b>
              </div>
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
              <option value="rejected">ปฏิเสธ</option>
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
                      <th>จัดการ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedRows.map((s) => (
                      <tr key={s.school_id}>
                        <td className="admTdStrong">{s.school_name}</td>

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
                              🗂 ดูข้อมูล
                            </a>
                          ) : (
                            <span className="admSmallMuted">-</span>
                          )}
                        </td>

                        <td>{statusBadge(s.verification_status)}</td>

                        <td>
                          {canApprove(s.verification_status) ? (
                            <>
                              <button
                                className="admBtn admBtnSmall admBtnApprove"
                                onClick={() => onApprove(s.school_id)}
                                disabled={actionLoading}
                              >
                                อนุมัติ
                              </button>

                              <button
                                className="admBtn admBtnSmall admBtnDanger"
                                onClick={() => onReject(s.school_id)}
                                disabled={actionLoading}
                                style={{ marginLeft: 8 }}
                              >
                                ปฏิเสธ
                              </button>
                            </>
                          ) : canRemove(s.verification_status) ? (
                            <button
                              className="admBtn admBtnSmall admBtnout"
                              onClick={() => onRemove(s.school_id)}
                              disabled={actionLoading}
                            >
                              นำออก
                            </button>
                          ) : (
                            <span className="admSmallMuted">-</span>
                          )}
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

              {/* Pagination UI */}
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

        {/* Confirm Modal */}
        {confirmData && (
          <div className="admModalOverlay">
            <div className="admModal">
              <h3>ยืนยันการดำเนินการ</h3>
              <p>
                {confirmData.type === "approve"
                  ? "ต้องการอนุมัติโรงเรียนนี้ใช่หรือไม่?"
                  : "ต้องการนำโรงเรียนออกจากระบบใช่หรือไม่?"}
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
              <h3>แจ้งเหตุผลการปฏิเสธ</h3>
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
                  {actionLoading ? "กำลังบันทึก..." : "ปฏิเสธ"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && <div className={`admToast ${toast.type}`}>{toast.message}</div>}
      </main>
    </div>
  );
}
