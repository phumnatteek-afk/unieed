// src/pages/school/EditProjectPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJson, request } from "../../../api/http.js";
import "../styles/EditProjectPage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

// ── ระดับชั้นที่รองรับ ────────────────────────────────────────────────────────
const EDUCATION_LEVELS = [
  { value: "อนุบาล",      label: "อนุบาล",              emoji: "🧒" },
  { value: "ประถมศึกษา",  label: "ประถมศึกษา (ป.1–ป.6)", emoji: "👦" },
  { value: "มัธยมตอนต้น", label: "มัธยมตอนต้น (ม.1–ม.3)", emoji: "🎒" },
  { value: "มัธยมตอนปลาย",label: "มัธยมตอนปลาย (ม.4–ม.6)", emoji: "🎓" },
];
function getCategoryIcon(category) {
  switch (category) {
    case "เสื้อ":        return "👔";
    case "กางเกง":       return "👖";
    case "กระโปรง":      return "👗";
    case "อื่นๆ":  return "🎒";
    default:             return "👕";
  }
}

function projectStatusMeta(status) {
  switch (String(status||"").toLowerCase()) {
    case "open":   return { label: "กำลังเปิดรับบริจาค", dotClass: "dotGreen"  };
    case "closed": return { label: "ปิดรับบริจาคแล้ว",   dotClass: "dotGray"   };
    case "paused": return { label: "พักโครงการชั่วคราว",  dotClass: "dotYellow" };
    case "draft":  return { label: "ฉบับร่าง",            dotClass: "dotBlue"   };
    default:       return { label: "ไม่ทราบสถานะ",         dotClass: "dotGray"   };
  }
}

// previewKey: "typeId__level" หรือ "typeId__null"
const pKey = (typeId, level) => `${typeId}__${level ?? "null"}`;

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

  // uniform image states
  const [uniformTypes,     setUniformTypes]     = useState([]);
  const [previews,         setPreviews]         = useState({});   // { pKey: url }
  const [uploadingMap,     setUploadingMap]     = useState({});   // { pKey: bool }
  const [msgMap,           setMsgMap]           = useState({});   // { pKey: string }
  const [activeLevel,      setActiveLevel]      = useState(EDUCATION_LEVELS[0].value);

  const formattedDate = project?.created_at
    ? new Date(project.created_at).toLocaleDateString("th-TH", { year:"numeric", month:"short", day:"numeric" })
    : "-";
  const canSave = !!title.trim() && !uploading;

  const loadProject = () => getJson(`/school/projects/${id}`, true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setErr(""); setLoading(true);
        const [data, types] = await Promise.all([
          loadProject(),
          getJson("/school/uniform-types", true),
        ]);
        if (!data) { setErr("ไม่พบโครงการ"); return; }

        setProject(data);
        setTitle(data.request_title || "");
        setDescription(data.request_description || "");
        setImage(data.request_image_url || "");
        setStatus(data.status || "open");
        setUniformTypes(types || []);

        // โหลดรูปชุดที่เคยอัปไว้แล้ว
        const pub = await getJson(`/school/projects/public/${id}`, false);
        const map = {};
        for (const item of pub?.uniform_items || []) {
          if (item.image_url) {
            const k = pKey(item.uniform_type_id, item.education_level);
            if (!map[k]) map[k] = item.image_url;
          }
        }
        setPreviews(map);
      } catch (e) {
        setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // upload รูปโครงการหลัก
  const uploadProjectImage = async (file) => {
    if (!file?.type.startsWith("image/")) { setErr("กรุณาเลือกไฟล์รูปภาพเท่านั้น"); return; }
    setErr(""); setUploading(true);
    try {
      const fd = new FormData(); fd.append("image", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE}/school/projects/${id}/image`, {
        method:"POST", headers:{ Authorization: token ? `Bearer ${token}` : "" }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setImage(data.url || "");
    } catch (e) { setErr(e?.message || "อัปโหลดรูปไม่สำเร็จ"); }
    finally { setUploading(false); }
  };

  // upload รูปชุด
  const uploadUniformImage = async (file, uniform_type_id, level) => {
    if (!file?.type.startsWith("image/")) return;
    const k = pKey(uniform_type_id, level);
    setPreviews(p => ({ ...p, [k]: URL.createObjectURL(file) }));
    setUploadingMap(p => ({ ...p, [k]: true }));
    setMsgMap(p => ({ ...p, [k]: "กำลังอัปโหลด..." }));
    try {
      const fd = new FormData(); fd.append("image", file);
      if (level) fd.append("education_level", level);
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE}/school/projects/${id}/uniform-images/${uniform_type_id}`, {
        method:"POST", headers:{ Authorization: token ? `Bearer ${token}` : "" }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setPreviews(p => ({ ...p, [k]: data.image_url }));
      setMsgMap(p => ({ ...p, [k]: "✅ อัปโหลดสำเร็จ" }));
    } catch (e) {
      setMsgMap(p => ({ ...p, [k]: `❌ ${e.message||"อัปโหลดไม่สำเร็จ"}` }));
    } finally { setUploadingMap(p => ({ ...p, [k]: false })); }
  };

  // ลบรูปชุด
  const deleteUniformImage = async (uniform_type_id, level) => {
    if (!window.confirm(`ลบรูปชุด${level ? ` (${level})` : ""}?`)) return;
    const k = pKey(uniform_type_id, level);
    setMsgMap(p => ({ ...p, [k]: "กำลังลบ..." }));
    try {
      const token = localStorage.getItem("token");
      const qs = level ? `?education_level=${encodeURIComponent(level)}` : "";
      const res = await fetch(`${BASE}/school/projects/${id}/uniform-images/${uniform_type_id}${qs}`, {
        method:"DELETE", headers:{ Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      setPreviews(p => { const n={...p}; delete n[k]; return n; });
      setMsgMap(p => ({ ...p, [k]: "" }));
    } catch (e) { setMsgMap(p => ({ ...p, [k]: `❌ ${e.message}` })); }
  };

  const onSave = async () => {
    if (!canSave) return;
    try {
      setErr("");
      await request(`/school/projects/${id}`, {
        method:"PUT",
        body:{ request_title:title.trim(), request_description:description||null, request_image_url:image||null, status },
        auth:true,
      });
      alert("บันทึกสำเร็จ");
      const fresh = await loadProject();
      setProject(fresh); setStatus(fresh?.status||status); setImage(fresh?.request_image_url||image);
    } catch (e) { setErr(e?.data?.message||e.message||"บันทึกไม่สำเร็จ"); }
  };

  if (loading) return <div className="epPage"><div className="epLeft">กำลังโหลด...</div><div className="epRight"/></div>;
  if (err && !project) return (
    <div className="epPage">
      <div className="epLeft">
        <h2>แก้ไขข้อมูลโครงการ</h2>
        <div className="epError">{err}</div>
        <div className="epActions"><button className="epBtn epBtnGhost" onClick={()=>navigate(-1)}>ย้อนกลับ</button></div>
      </div>
      <div className="epRight"/>
    </div>
  );

  return (
    <div className="epPage">
      {/* ===== LEFT ===== */}
      <div className="epLeft">
        <h2>แก้ไขข้อมูลโครงการ</h2>
        {err && <div className="epError">{err}</div>}

        <div className="epField">
          <label>ชื่อโรงเรียน</label>
          <input value={project?.school_name||""} disabled />
        </div>
        <div className="epField">
          <label>ที่อยู่โรงเรียน</label>
          <textarea value={project?.school_address||""} disabled />
        </div>
        <div className="epField">
          <label>ชื่อโครงการ</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="เช่น ขอรับบริจาคชุดนักเรียน ปี 2569" />
        </div>
        <div className="epField">
          <label>รายละเอียด</label>
          <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="อธิบายรายละเอียดโครงการ..." />
        </div>
        <div className="epField">
          <label>รูปภาพโครงการ</label>
          <input type="file" accept="image/*" disabled={uploading}
            onChange={e=>{const f=e.target.files?.[0]; if(f) uploadProjectImage(f);}} />
          <div className="epHint">{uploading?"กำลังอัปโหลดรูป...":"เลือกไฟล์รูปเพื่ออัปโหลด (เก็บใน Cloudinary)"}</div>
          <div style={{marginTop:10}}>
            <label style={{display:"block",fontWeight:700,fontSize:13,color:"#334155",marginBottom:8}}>หรือวางลิงก์รูป (URL)</label>
            <input value={image} onChange={e=>setImage(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {/* ════ อัปโหลดรูปชุดนักเรียน ════ */}
        {uniformTypes.length > 0 && (
          <div className="epField">
            <label className="epUniformLabel">
              รูปภาพชุดนักเรียน
              <span className="epUniformLabelSub">
                อัปโหลดรูปชุดแยกตามระดับชั้น เพื่อให้ผู้บริจาคเห็นว่าชุดหน้าตาเป็นอย่างไร
              </span>
            </label>

            {/* Step 1: เลือกระดับชั้น */}
            <div className="epLevelStepBox">
              <div className="epStepLabel">
                <span className="epStepBadge">1</span>
                เลือกระดับชั้นที่ต้องการอัปรูปชุด
              </div>
              <div className="epLevelBtnGroup">
                {EDUCATION_LEVELS.map(lv => {
                  const uploaded = uniformTypes.filter(t => previews[pKey(t.uniform_type_id, lv.value)]).length;
                  return (
                    <button
                      key={lv.value}
                      type="button"
                      className={`epLevelBtn ${activeLevel === lv.value ? "epLevelBtnActive" : ""}`}
                      onClick={() => setActiveLevel(lv.value)}
                    >
                      <span className="epLevelBtnEmoji">{lv.emoji}</span>
                      <span className="epLevelBtnLabel">{lv.label}</span>
                      {uploaded > 0 && (
                        <span className="epLevelBtnBadge">{uploaded} รูป</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: อัปรูปแต่ละประเภทชุด */}
            <div className="epUniformStepBox">
              <div className="epStepLabel">
                <span className="epStepBadge">2</span>
                อัปโหลดรูปชุดสำหรับระดับ
                <strong style={{ color: "#29B6E8", marginLeft: 6 }}>
                  {EDUCATION_LEVELS.find(l => l.value === activeLevel)?.label}
                </strong>
              </div>

              {/* ── แยก grid ตาม gender ── */}
              {[
                {
                  genderKey: "male",
                  genderLabel: "ชุดนักเรียนชาย",
                  genderColor: "#1D4ED8",
                  genderBg: "#EFF6FF",
                  genderEmoji: "👦",
                  types: uniformTypes.filter(t => t.gender === "male"),
                },
                {
                  genderKey: "female",
                  genderLabel: "ชุดนักเรียนหญิง",
                  genderColor: "#BE185D",
                  genderBg: "#FDF2F8",
                  genderEmoji: "👧",
                  types: uniformTypes.filter(t => t.gender === "female"),
                },
                {
                  genderKey: "other",
                  genderLabel: "อื่นๆ",
                  genderColor: "#374151",
                  genderBg: "#F3F4F6",
                  genderEmoji: "👕",
                  types: uniformTypes.filter(t => t.gender !== "male" && t.gender !== "female"),
                },
              ]
                .filter(g => g.types.length > 0)
                .map(g => (
                  <div key={g.genderKey} className="epUniformGenderSection">
                    {/* หัวข้อ gender */}
                    <div
                      className="epUniformGenderHeader"
                      style={{ background: g.genderBg, color: g.genderColor }}
                    >
                      <span>{g.genderEmoji}</span>
                      <span>{g.genderLabel}</span>
                      <span className="epUniformGenderCount">
                        {g.types.filter(t => previews[pKey(t.uniform_type_id, activeLevel)]).length}
                        /{g.types.length} รูป
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="epUniformTypeGrid">
                      {g.types.map(t => {
                        const k       = pKey(t.uniform_type_id, activeLevel);
                        const preview = previews[k];
                        const isUp    = uploadingMap[k];
                        const msg     = msgMap[k];
                        const inputId = `uf-${t.uniform_type_id}-${activeLevel}`;

                        return (
                          <div
                            key={t.uniform_type_id}
                            className={`epUniCard ${isUp ? "epUniCardLoading" : ""} ${preview ? "epUniCardHasImg" : ""}`}
                          >
                            {/* ── ป้ายกำกับประเภทชุด (เด่นชัด) ── */}
                            <div
  className="epUniCardTypeBadge"
  style={{ background: g.genderBg, color: g.genderColor }}
>
  {getCategoryIcon(t.uniform_category)} {t.type_name}
</div>

                            {/* รูป */}
                            <div className="epUniCardImg">
                              {preview
                                ? <img src={preview} alt={t.type_name} />
                                : <div className="epUniCardEmpty">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                      <path
                                        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                                        stroke="#cbd5e1"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                    <span>ยังไม่มีรูป</span>
                                  </div>}
                              {isUp && (
                                <div className="epUniCardSpin">
                                  <div className="epSpinner" />
                                </div>
                              )}
                              {preview && !isUp && (
                                <div className="epUniCardDone">✓</div>
                              )}
                            </div>

                            {/* ── hint บอก gender+ประเภท ── */}
                            <div className="epUniCardHint">
                              {g.genderEmoji} {t.type_name}
                              <br />
                              <span style={{ color: "#94A3B8", fontSize: 10 }}>
                                {activeLevel}
                              </span>
                            </div>

                            {/* message */}
                            {msg && (
                              <div
                                className={`epUniCardMsg ${
                                  msg.startsWith("✅") ? "ok"
                                  : msg.startsWith("❌") ? "err"
                                  : "info"
                                }`}
                              >
                                {msg}
                              </div>
                            )}

                            {/* ปุ่ม */}
                            <div className="epUniCardActions">
                              <label
                                htmlFor={inputId}
                                className={`epUniBtn epUniBtnPrimary ${isUp ? "epUniBtnDisabled" : ""}`}
                              >
                                {isUp ? "กำลังอัป..." : preview ? "เปลี่ยนรูป" : "อัปโหลด"}
                              </label>
                              <input
                                id={inputId}
                                type="file"
                                accept="image/*"
                                disabled={isUp}
                                style={{ display: "none" }}
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadUniformImage(f, t.uniform_type_id, activeLevel);
                                  e.target.value = "";
                                }}
                              />
                              {preview && !isUp && (
                                <button
                                  type="button"
                                  className="epUniBtn epUniBtnDelete"
                                  onClick={() => deleteUniformImage(t.uniform_type_id, activeLevel)}
                                >
                                  ลบ
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

              {/* Summary: รูปที่อัปแล้วในทุก level */}
              <div className="epUniformSummary">
                <div className="epUniformSummaryTitle">สรุปรูปที่อัปโหลดแล้วทุกระดับชั้น</div>
                {EDUCATION_LEVELS.map(lv => {
                  const items = uniformTypes
                    .map(t => ({ t, url: previews[pKey(t.uniform_type_id, lv.value)] }))
                    .filter(x => x.url);
                  if (!items.length) return null;
                  return (
                    <div key={lv.value} className="epUniformSummaryLevel">
                      <span className="epUniformSummaryLevelName">
                        {lv.emoji} {lv.label}
                      </span>
                      <div className="epUniformSummaryImgs">
                        {items.map(({ t, url }) => (
                          <div key={t.uniform_type_id} className="epUniformSummaryThumb">
                            <img src={url} alt={t.type_name} />
                            <span>{t.type_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(previews).length === 0 && (
                  <div className="epUniformSummaryEmpty">ยังไม่มีรูปที่อัปโหลด</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="epActions">
          <button className="epBtn epBtnGhost" onClick={()=>navigate(-1)} disabled={uploading}>ย้อนกลับ</button>
          <button className="epBtn epBtnPrimary" disabled={!canSave} onClick={onSave}>
            {uploading?"กำลังอัปโหลด...":"บันทึก"}
          </button>
        </div>
      </div>

      {/* ===== RIGHT: Preview ===== */}
      <div className="epRight">
        <div className="epRightHead"><div className="ttl">ตัวอย่างการ์ดโครงการ</div></div>
        <div className="epPreviewWrap">
          <div className="projectCard">
            <div className="cover">
              {image ? <img src={image} alt="" /> : <div className="coverPlaceholder" />}
            </div>
            <div className="cardBody">
              <div className="cardSchool">{project?.school_name||"-"}</div>
              <div className="cardTitle">{title||"ชื่อโครงการ"}</div>
              <div className="cardDesc">{description||"รายละเอียดโครงการจะแสดงตรงนี้..."}</div>
              <div className="cardAddr">ที่ตั้ง: {project?.school_address||"-"}</div>
              <div className="cardMeta"><span>สร้างเมื่อ: {formattedDate}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}