import { useEffect, useMemo, useState } from "react";
import * as svc from "../services/admin.service.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/backoffice.css";

export default function AdminSchoolsPage() {
  const { userName } = useAuth();

  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState(""); // "" | pending | approved | rejected
  const [sort, setSort] = useState("latest"); // latest | oldest
  const [loading, setLoading] = useState(true);

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

  const onApprove = async (school_id) => {
    if (!confirm("ยืนยันอนุมัติโรงเรียนนี้?")) return;
    try {
      await svc.approveSchool(school_id);
      await load();
    } catch (e) {
      alert(e?.data?.message || e.message);
    }
  };

  const onRemove = async (school_id) => {
    if (!confirm("นำโรงเรียนออกจากระบบ? (จะลบข้อมูลโรงเรียนและผู้ประสานงาน)")) return;
    try {
      await svc.removeSchool(school_id);
      await load();
    } catch (e) {
      alert(e?.data?.message || e.message);
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

  return (
    <div className="admPage">
      {/* Main */}
      <main className="admMain">
        {/* Topbar */}
        <div className="admTop">
          <div className="admTitle">จัดการโรงเรียน</div>
          <div className="admMe">
            <span className="admUserIcon">👤</span>
            <span>ผู้ดูแลระบบ: {userName || "Admin"}</span>
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
            <button className="admSearchBtn" onClick={load}>🔍</button>
          </div>

          <div className="admFilterRow">
            <span className="admFilterLabel">Filter</span>

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

            <button className="admBtn admBtnPrimary" onClick={load}>Filter</button>
          </div>
        </section>

        {err && <div className="admError">{err}</div>}

        {/* Table */}
        <section className="admCard">
          {loading ? (
            <div className="admMuted">กำลังโหลด…</div>
          ) : (
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
                  {tableRows.map((s) => (
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
                        {canApprove(s.verification_status) && (
                          <button
                            className="admBtn admBtnSmall admBtnApprove"
                            onClick={() => onApprove(s.school_id)}
                          >
                            อนุมัติ
                          </button>
                        )}

                        {canRemove(s.verification_status) && (
                          <button
                            className="admBtn admBtnSmall admBtnDanger"
                            onClick={() => onRemove(s.school_id)}
                          >
                            นำออก
                          </button>
                        )}

                        {!canApprove(s.verification_status) && !canRemove(s.verification_status) && (
                          <span className="admSmallMuted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!tableRows.length && (
                    <tr>
                      <td colSpan="7" className="admMuted">ยังไม่มีข้อมูล</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
