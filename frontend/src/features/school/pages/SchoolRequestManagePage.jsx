import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJson } from "../../../api/http.js"; // ✅ ปรับ path ถ้าไฟล์คุณอยู่คนละตำแหน่ง
import { schoolRequestSvc } from "../services/schoolRequest.service.js";
import StudentModal from "../components/StudentModal.jsx";
import "../styles/requestManage.css";

import { Icon } from "@iconify/react";

function projectStatusMeta(status) {
    const s = String(status || "").toLowerCase();

    switch (s) {
        case "open":
            return { label: "กำลังเปิดรับบริจาค", pillClass: "pmPillGreen" };
        case "closed":
            return { label: "ปิดรับบริจาคแล้ว", pillClass: "pmPillGray" };
        case "paused":
            return { label: "พักโครงการชั่วคราว", pillClass: "pmPillYellow" };
        case "draft":
            return { label: "ฉบับร่าง", pillClass: "pmPillBlue" };
        default:
            return {
                label: s ? `สถานะ: ${s}` : "ไม่ทราบสถานะ",
                pillClass: "pmPillGray",
            };
    }
}

function statusBadge(status) {
    if (status === "fulfilled") return { text: "ได้รับครบแล้ว", cls: "st stGreen" };
    if (status === "partial") return { text: "ได้รับบางส่วน", cls: "st stYellow" };
    return { text: "ยังไม่ได้รับ", cls: "st stRed" };
}

function genderTH(g) {
    if (g === "male") return "ชาย";
    if (g === "female") return "หญิง";
    return "-";
}

export default function SchoolRequestManagePage() {
    const { requestId } = useParams(); // route: /school/projects/:requestId
    const navigate = useNavigate();

    // project header
    const [project, setProject] = useState(null);

    // table data
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [rows, setRows] = useState([]);
    const [uniformTypes, setUniformTypes] = useState([]);

    // filters
    const [q, setQ] = useState("");
    const [grade, setGrade] = useState("");
    const [status, setStatus] = useState("");

    // modal
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const meta = projectStatusMeta(project?.status);

    const formattedDate = project?.created_at
        ? new Date(project.created_at).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
        : "-";

    // ✅ โหลดข้อมูลนักเรียน + uniform types
    const loadStudentsAndTypes = async () => {
        try {
            setErr("");
            setLoading(true);

            const [uts, data] = await Promise.all([
                schoolRequestSvc.getUniformTypes(),
                schoolRequestSvc.listStudents(requestId),
            ]);

            setUniformTypes(Array.isArray(uts) ? uts : []);
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    };

    // ✅ โหลดข้อมูลโครงการ (title/status/created_at)
    const loadProject = async () => {
        try {
            const data = await getJson(`/school/projects/${requestId}`, true);
            setProject(data);
        } catch (e) {
            // ไม่ให้ทับ err หลัก ถ้าโหลดตารางยังโอเค
            setProject(null);
            setErr((prev) => prev || e?.data?.message || e.message || "โหลดโครงการไม่สำเร็จ");
        }
    };

    useEffect(() => {
        if (!requestId) return;
        loadProject();
        loadStudentsAndTypes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestId]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((r) => {
            const hitQ =
                !qq ||
                String(r.student_name || "").toLowerCase().includes(qq) ||
                String(r.gender || "").toLowerCase().includes(qq);

            const hitGrade = !grade || r.education_level === grade;
            const hitStatus = !status || r.summary?.fulfillStatus === status;
            return hitQ && hitGrade && hitStatus;
        });
    }, [rows, q, grade, status]);

    // cards
    const stats = useMemo(() => {
        const total = rows.length;
        const urgent = rows.filter((r) => r.urgency === "urgent").length;
        const veryUrgent = rows.filter((r) => r.urgency === "very_urgent").length;
        const fulfilled = rows.filter((r) => r.summary?.fulfillStatus === "fulfilled").length;
        const pendingDelivery = rows.filter((r) => r.summary?.fulfillStatus !== "fulfilled").length;
        return { total, urgent, veryUrgent, fulfilled, pendingDelivery };
    }, [rows]);

    const onAdd = () => {
        setEditing(null);
        setOpen(true);
    };

    const onEdit = (r) => {
        setEditing(r);
        setOpen(true);
    };

    const onDelete = async (r) => {
        if (!confirm(`ลบ ${r.student_name} ?`)) return;
        try {
            await schoolRequestSvc.deleteStudent(requestId, r.student_id);
            await loadStudentsAndTypes();
        } catch (e) {
            alert(e?.data?.message || e.message);
        }
    };

    const onSave = async (payload) => {
        try {
            if (editing) {
                await schoolRequestSvc.updateStudent(requestId, editing.student_id, payload);
            } else {
                await schoolRequestSvc.createStudent(requestId, payload);
            }
            setOpen(false);
            setEditing(null);
            await loadStudentsAndTypes();
        } catch (e) {
            alert(e?.data?.message || e.message);
        }
    };

    return (
    <div className="pmPage">
      <div className="pmTop">
        <div>
          <div className="pmTitle">
            จัดการโครงการ : {project?.request_title || "กำลังโหลด..."}
          </div>

          <div className="pmMeta">
            <span className={`pmPill ${meta.pillClass}`}>
              <span className="pmDot" /> {meta.label}
            </span>

            <span className="pmMetaText">สร้างเมื่อ : {formattedDate}</span>
          </div>
        </div>

        <button
          className="pmBtnGhost"
          type="button"
          onClick={() => navigate(`/school/projects/${requestId}/edit`)}
          disabled={!requestId}
        >
          <span className="pmGear">⚙</span> แก้ไขชื่อ/รายละเอียด
        </button>
      </div>

      {err && <div className="pmErr">{err}</div>}

      <div className="pmCards">
        <div className="pmCard">
          <div className="pmCardLabel">จำนวนเด็กทั้งหมด</div>
          <div className="pmCardValue blue">{stats.total} คน</div>
        </div>
        <div className="pmCard">
          <div className="pmCardLabel">ความต้องการเร่งด่วน</div>
          <div className="pmCardValue red">{stats.veryUrgent} คน</div>
        </div>
        <div className="pmCard">
          <div className="pmCardLabel">ส่งมอบสำเร็จ</div>
          <div className="pmCardValue green">{stats.fulfilled} คน</div>
        </div>
        <div className="pmCard">
          <div className="pmCardLabel">รอส่งมอบ</div>
          <div className="pmCardValue orange">{stats.pendingDelivery} คน</div>
        </div>
      </div>

     

         <div className="pmFilters">
  <div className="pmSearch">
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="ค้นหา..."
    />
    <button
      className="pmSearchBtn"
      onClick={loadStudentsAndTypes}
      aria-label="search"
      type="button"
    >
      <span className="pmSearchIcon"><Icon icon="material-symbols:search-rounded" width="28" height="28" /></span>
    </button>
  </div>

  <select value={grade} onChange={(e) => setGrade(e.target.value)} className="pmSelect">
    <option value="">ระดับชั้น</option>
    <option value="ประถมศึกษา">ประถมศึกษา</option>
    <option value="มัธยมศึกษา">มัธยมศึกษา</option>
  </select>

  <select value={status} onChange={(e) => setStatus(e.target.value)} className="pmSelect">
    <option value="">สถานะ</option>
    <option value="pending">ยังไม่ได้รับ</option>
    <option value="partial">ได้รับบางส่วน</option>
    <option value="fulfilled">ได้รับครบแล้ว</option>
  </select>
</div>


      <div className="pmTableCard">
        <div className="pmTableHead">
          <div className="pmTableTitle">
            <span className="pmTableIcon"><Icon icon="gg:list" width="24" height="24" /></span> รายชื่อนักเรียนในโครงการ
          </div>
          <button className="pmBtnPrimary" onClick={onAdd} type="button">
            ➕ เพิ่มรายชื่อนักเรียน
          </button>
        </div>

        {loading ? (
          <div className="pmLoading">กำลังโหลด...</div>
        ) : (
          <div className="pmTableWrap">
            <table className="pmTable">
              <thead>
                <tr>
                  <th>วันที่เพิ่ม</th>
                  <th>ข้อมูลนักเรียน</th>
                  <th>ระดับชั้น</th>
                  <th>สิ่งที่ต้องการ</th>
                  <th>ได้แล้ว</th>
                  <th>สถานะ</th>
                  <th>การสนับสนุน</th>
                  <th className="pmThRight">จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {!filtered.length ? (
                  <tr>
                    <td colSpan="8" className="pmEmpty">
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const b = statusBadge(r.summary?.fulfillStatus);
                    return (
                      <tr key={r.student_id}>
                        <td>{new Date(r.created_at).toLocaleDateString("th-TH")}</td>

                        <td>
                          <div className="pmStudent">
                            <span
                              className={`pmUrgencyDot ${
                                r.urgency === "very_urgent"
                                  ? "dotRed"
                                  : r.urgency === "urgent"
                                  ? "dotYellow"
                                  : "dotBlue"
                              }`}
                              title={
                                r.urgency === "very_urgent"
                                  ? "เร่งด่วนมาก"
                                  : r.urgency === "urgent"
                                  ? "เร่งด่วน"
                                  : "รอได้"
                              }
                            />
                            <div>
                              <div className="pmStudentName">{r.student_name}</div>
                              <div className="pmStudentSub">เพศ : {genderTH(r.gender)}</div>
                            </div>
                          </div>
                        </td>

                        <td>{r.education_level}</td>
                        <td>{r.summary?.totalItems || 0} รายการ</td>
                        <td className="pmMono">{r.summary?.receivedText || "0/0"}</td>
                        <td>
                          <span className={b.cls}>{b.text}</span>
                        </td>
                        <td>
                          <span className="pmSupport">{r.summary?.supportLabel || "-"}</span>
                        </td>

                        <td className="pmActions">
                          <button className="pmBtnMini" onClick={() => onEdit(r)} type="button">
                           <Icon icon="line-md:edit" width="24" height="24" />  แก้ไข
                          </button>
                          <button className="pmBtnIcon" onClick={() => onDelete(r)} title="ลบ" type="button">
                        <Icon icon="si:bin-fill" width="24" height="24" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSave={onSave}
        uniformTypes={Array.isArray(uniformTypes) ? uniformTypes : []}
        initial={editing}
      />
    </div >
  );
}
