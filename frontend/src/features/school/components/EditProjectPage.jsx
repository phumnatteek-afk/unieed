// src/pages/school/EditProjectPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJson, request } from "../../../api/http.js";
import "../styles/EditProjectPage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

function projectStatusMeta(status) {
  const s = String(status || "").toLowerCase();
  switch (s) {
    case "open":   return { label: "กำลังเปิดรับบริจาค", dotClass: "dotGreen" };
    case "closed": return { label: "ปิดรับบริจาคแล้ว",   dotClass: "dotGray"  };
    case "paused": return { label: "พักโครงการชั่วคราว",  dotClass: "dotYellow"};
    case "draft":  return { label: "ฉบับร่าง",            dotClass: "dotBlue"  };
    default:       return { label: s ? `สถานะ: ${s}` : "ไม่ทราบสถานะ", dotClass: "dotGray" };
  }
}

// ── helper: แปลง size JSON → ข้อความไทย ─────────────────────────────────
function formatSize(size) {
  if (!size) return "";
  try {
    const obj = typeof size === "string" ? JSON.parse(size) : size;
    const parts = [];
    if (obj.chest) parts.push(`อก ${obj.chest}`);
    if (obj.waist) parts.push(`เอว ${obj.waist}`);
    if (obj.length) parts.push(`ยาว ${obj.length}`);
    return parts.length > 0 ? parts.join(" / ") : String(size);
  } catch {
    return String(size);
  }
}

export default function EditProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project,     setProject]     = useState(null);
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [image,       setImage]       = useState("");
  const [status,      setStatus]      = useState("open");
  const [uploading,   setUploading]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");

  // ── uniform image states ─────────────────────────────────────────────
  const [uniformTypes,    setUniformTypes]    = useState([]);  // [{uniform_type_id, type_name, gender}]
  const [uniformPreviews, setUniformPreviews] = useState({});  // { [uniform_type_id]: url }
  const [uniformUploading,setUniformUploading]= useState({}); // { [uniform_type_id]: bool }
  const [uniformMsg,      setUniformMsg]      = useState({}); // { [uniform_type_id]: string }

  const meta         = useMemo(() => projectStatusMeta(status), [status]);
  const formattedDate = project?.created_at
    ? new Date(project.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
    : "-";
  const canSave = !!title.trim() && !uploading;

  const loadProject = async () => getJson(`/school/projects/${id}`, true);

  // ── โหลด project + uniform types + รูปที่เคยอัปไว้ ──────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setErr("");
        setLoading(true);

        const [data, types] = await Promise.all([
          loadProject(),
          getJson("/school/uniform-types", true),
        ]);

        if (!data) { setErr("ไม่พบโครงการ"); return; }

        setProject(data);
        setTitle(data.request_title       || "");
        setDescription(data.request_description || "");
        setImage(data.request_image_url   || "");
        setStatus(data.status             || "open");
        setUniformTypes(types || []);

        // ดึงรูปชุดที่เคยอัปไว้ของโครงการนี้
        const pub = await getJson(`/school/projects/public/${id}`, false);
        const map = {};
        for (const item of pub?.uniform_items || []) {
          if (item.image_url && !map[item.uniform_type_id]) {
            map[item.uniform_type_id] = item.image_url;
          }
        }
        setUniformPreviews(map);
      } catch (e) {
        setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── upload รูปโครงการหลัก ─────────────────────────────────────────────
  const uploadProjectImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("กรุณาเลือกไฟล์รูปภาพเท่านั้น"); return; }
    setErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const token = localStorage.getItem("token");
      const res   = await fetch(`${BASE}/school/projects/${id}/image`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setImage(data.url || "");
    } catch (e) {
      setErr(e?.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  // ── upload รูปชุดนักเรียนแต่ละประเภท ─────────────────────────────────
  const uploadUniformImage = async (file, uniform_type_id) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUniformMsg(prev => ({ ...prev, [uniform_type_id]: "❌ กรุณาเลือกไฟล์รูปภาพเท่านั้น" }));
      return;
    }

    // preview ก่อนอัปจริง (local blob)
    const localUrl = URL.createObjectURL(file);
    setUniformPreviews(prev => ({ ...prev, [uniform_type_id]: localUrl }));
    setUniformUploading(prev => ({ ...prev, [uniform_type_id]: true }));
    setUniformMsg(prev => ({ ...prev, [uniform_type_id]: "กำลังอัปโหลด..." }));

    try {
      const fd    = new FormData();
      fd.append("image", file);
      const token = localStorage.getItem("token");
      const res   = await fetch(
        `${BASE}/school/projects/${id}/uniform-images/${uniform_type_id}`,
        {
          method:  "POST",
          headers: { Authorization: token ? `Bearer ${token}` : "" },
          body:    fd,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");

      // อัปเดต preview เป็น URL จริงจาก Cloudinary
      setUniformPreviews(prev => ({ ...prev, [uniform_type_id]: data.image_url }));
      setUniformMsg(prev => ({ ...prev, [uniform_type_id]: "✅ อัปโหลดสำเร็จ" }));
    } catch (e) {
      setUniformMsg(prev => ({ ...prev, [uniform_type_id]: `❌ ${e.message || "อัปโหลดไม่สำเร็จ"}` }));
    } finally {
      setUniformUploading(prev => ({ ...prev, [uniform_type_id]: false }));
    }
  };

  // ── ลบรูปชุด ─────────────────────────────────────────────────────────
  const deleteUniformImage = async (uniform_type_id) => {
    if (!window.confirm("ต้องการลบรูปชุดนี้?")) return;
    setUniformMsg(prev => ({ ...prev, [uniform_type_id]: "กำลังลบ..." }));
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(
        `${BASE}/school/projects/${id}/uniform-images/${uniform_type_id}`,
        { method: "DELETE", headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      setUniformPreviews(prev => { const n = { ...prev }; delete n[uniform_type_id]; return n; });
      setUniformMsg(prev => ({ ...prev, [uniform_type_id]: "🗑️ ลบรูปแล้ว" }));
    } catch (e) {
      setUniformMsg(prev => ({ ...prev, [uniform_type_id]: `❌ ${e.message}` }));
    }
  };

  const onSave = async () => {
    if (!canSave) return;
    try {
      setErr("");
      await request(`/school/projects/${id}`, {
        method: "PUT",
        body: {
          request_title:       title.trim(),
          request_description: description || null,
          request_image_url:   image       || null,
          status,
        },
        auth: true,
      });
      alert("บันทึกสำเร็จ");
      const fresh = await loadProject();
      setProject(fresh);
      setStatus(fresh?.status || status);
      setImage(fresh?.request_image_url || image);
    } catch (e) {
      setErr(e?.data?.message || e.message || "บันทึกไม่สำเร็จ");
    }
  };

  // ── group uniform types by gender ────────────────────────────────────
  const maleTypes   = uniformTypes.filter(t => t.gender === "male");
  const femaleTypes = uniformTypes.filter(t => t.gender === "female");
  const otherTypes  = uniformTypes.filter(t => t.gender !== "male" && t.gender !== "female");

  if (loading) return (
    <div className="epPage">
      <div className="epLeft">กำลังโหลด...</div>
      <div className="epRight" />
    </div>
  );

  if (err && !project) return (
    <div className="epPage">
      <div className="epLeft">
        <h2>แก้ไขข้อมูลโครงการ</h2>
        <div className="epError">{err}</div>
        <div className="epActions">
          <button className="epBtn epBtnGhost" type="button" onClick={() => navigate(-1)}>ย้อนกลับ</button>
        </div>
      </div>
      <div className="epRight" />
    </div>
  );

  return (
    <div className="epPage">
      {/* ===== LEFT: Form ===== */}
      <div className="epLeft">
        <h2>แก้ไขข้อมูลโครงการ</h2>

        {err && <div className="epError">{err}</div>}

        {/* ── ข้อมูลโรงเรียน (read-only) ── */}
        <div className="epField">
          <label>ชื่อโรงเรียน</label>
          <input value={project?.school_name || ""} disabled />
        </div>

        <div className="epField">
          <label>ที่อยู่โรงเรียน</label>
          <textarea value={project?.school_address || ""} disabled />
        </div>

        {/* ── ข้อมูลโครงการ ── */}
        <div className="epField">
          <label>ชื่อโครงการ</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="เช่น ขอรับบริจาคชุดนักเรียน ปี 2569"
          />
        </div>

        <div className="epField">
          <label>รายละเอียด</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="อธิบายรายละเอียดโครงการ เช่น กลุ่มเป้าหมาย จำนวนชุดที่ต้องการ เงื่อนไขการรับ ฯลฯ"
          />
        </div>

        {/* ── รูปภาพโครงการหลัก ── */}
        <div className="epField">
          <label>รูปภาพโครงการ</label>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadProjectImage(f); }}
          />
          <div className="epHint">
            {uploading ? "กำลังอัปโหลดรูป..." : "เลือกไฟล์รูปเพื่ออัปโหลด (ระบบจะเก็บใน Cloudinary)"}
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 8 }}>
              หรือวางลิงก์รูป (URL)
            </label>
            <input value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            ── รูปภาพชุดนักเรียนแต่ละประเภท (ใหม่) ──
        ════════════════════════════════════════════════════════════════ */}
        {uniformTypes.length > 0 && (
          <div className="epField">
            <label className="epUniformLabel">
              รูปภาพชุดนักเรียน
              <span className="epUniformLabelSub">อัปโหลดรูปชุดที่โรงเรียนต้องการ เพื่อให้ผู้บริจาคเห็นว่าชุดหน้าตาเป็นอย่างไร</span>
            </label>

            {/* ── ชุดนักเรียนชาย ── */}
            {maleTypes.length > 0 && (
              <div className="epUniformGroup">
                <div className="epUniformGroupTitle epUniformGroupMale">👦 ชุดนักเรียนชาย</div>
                <div className="epUniformCards">
                  {maleTypes.map(t => (
                    <UniformCard
                      key={t.uniform_type_id}
                      type={t}
                      preview={uniformPreviews[t.uniform_type_id]}
                      uploading={uniformUploading[t.uniform_type_id]}
                      message={uniformMsg[t.uniform_type_id]}
                      onUpload={file => uploadUniformImage(file, t.uniform_type_id)}
                      onDelete={() => deleteUniformImage(t.uniform_type_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── ชุดนักเรียนหญิง ── */}
            {femaleTypes.length > 0 && (
              <div className="epUniformGroup">
                <div className="epUniformGroupTitle epUniformGroupFemale">👧 ชุดนักเรียนหญิง</div>
                <div className="epUniformCards">
                  {femaleTypes.map(t => (
                    <UniformCard
                      key={t.uniform_type_id}
                      type={t}
                      preview={uniformPreviews[t.uniform_type_id]}
                      uploading={uniformUploading[t.uniform_type_id]}
                      message={uniformMsg[t.uniform_type_id]}
                      onUpload={file => uploadUniformImage(file, t.uniform_type_id)}
                      onDelete={() => deleteUniformImage(t.uniform_type_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── ประเภทอื่นๆ ── */}
            {otherTypes.length > 0 && (
              <div className="epUniformGroup">
                <div className="epUniformGroupTitle">📦 อื่นๆ</div>
                <div className="epUniformCards">
                  {otherTypes.map(t => (
                    <UniformCard
                      key={t.uniform_type_id}
                      type={t}
                      preview={uniformPreviews[t.uniform_type_id]}
                      uploading={uniformUploading[t.uniform_type_id]}
                      message={uniformMsg[t.uniform_type_id]}
                      onUpload={file => uploadUniformImage(file, t.uniform_type_id)}
                      onDelete={() => deleteUniformImage(t.uniform_type_id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* ════════════════════════════════════════════════════════════════ */}

        <div className="epActions">
          <button className="epBtn epBtnGhost" type="button" onClick={() => navigate(-1)} disabled={uploading}>
            ย้อนกลับ
          </button>
          <button className="epBtn epBtnPrimary" disabled={!canSave} type="button" onClick={onSave}>
            {uploading ? "กำลังอัปโหลด..." : "บันทึก"}
          </button>
        </div>
      </div>

      {/* ===== RIGHT: Preview ===== */}
      <div className="epRight">
        <div className="epRightHead">
          <div className="ttl">ตัวอย่างการ์ดโครงการ</div>
        </div>

        <div className="epPreviewWrap">
          <div className="projectCard">
            <div className="cover">
              {image ? <img src={image} alt="" /> : <div className="coverPlaceholder" />}
            </div>
            <div className="cardBody">
              <div className="cardSchool">{project?.school_name || "-"}</div>
              <div className="cardTitle">{title || "ชื่อโครงการ"}</div>
              <div className="cardDesc">{description || "รายละเอียดโครงการจะแสดงตรงนี้..."}</div>
              <div className="cardAddr">ที่ตั้ง: {project?.school_address || "-"}</div>
              <div className="cardMeta">
                <span>สร้างเมื่อ: {formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Preview รูปชุดที่อัปแล้ว */}
          {Object.keys(uniformPreviews).length > 0 && (
            <div className="epUniformPreviewSection">
              <div className="epUniformPreviewTitle">ตัวอย่างรูปชุดที่อัปโหลด</div>
              <div className="epUniformPreviewRow">
                {uniformTypes
                  .filter(t => uniformPreviews[t.uniform_type_id])
                  .map(t => (
                    <div key={t.uniform_type_id} className="epUniformPreviewItem">
                      <img src={uniformPreviews[t.uniform_type_id]} alt={t.type_name} />
                      <span>{t.type_name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-component: UniformCard ────────────────────────────────────────────
function UniformCard({ type, preview, uploading, message, onUpload, onDelete }) {
  const inputId = `uniform-img-${type.uniform_type_id}`;

  return (
    <div className={`epUniformCard ${uploading ? "epUniformCardUploading" : ""}`}>
      {/* รูป preview หรือ placeholder */}
      <div className="epUniformCardImg">
        {preview ? (
          <img src={preview} alt={type.type_name} />
        ) : (
          <div className="epUniformCardPlaceholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>ยังไม่มีรูป</span>
          </div>
        )}

        {/* overlay spinner ตอน upload */}
        {uploading && (
          <div className="epUniformCardOverlay">
            <div className="epUniformCardSpinner" />
          </div>
        )}
      </div>

      {/* ชื่อประเภทชุด */}
      <div className="epUniformCardName">{type.type_name}</div>

      {/* message (success/error) */}
      {message && (
        <div className={`epUniformCardMsg ${
          message.startsWith("✅") ? "epUniformCardMsgOk" :
          message.startsWith("❌") ? "epUniformCardMsgErr" : "epUniformCardMsgInfo"
        }`}>
          {message}
        </div>
      )}

      {/* ปุ่ม */}
      <div className="epUniformCardActions">
        <label htmlFor={inputId} className={`epUniformCardBtn epUniformCardBtnUpload ${uploading ? "epUniformCardBtnDisabled" : ""}`}>
          {uploading ? "กำลังอัป..." : preview ? "เปลี่ยนรูป" : "อัปโหลด"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={uploading}
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
        />

        {preview && !uploading && (
          <button
            type="button"
            className="epUniformCardBtn epUniformCardBtnDelete"
            onClick={onDelete}
          >
            ลบ
          </button>
        )}
      </div>
    </div>
  );
}