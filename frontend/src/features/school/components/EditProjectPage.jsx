// src/pages/school/EditProjectPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJson, request } from "../../../api/http.js";
import "../styles/EditProjectPage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const EDUCATION_LEVELS = [
  { value: "อนุบาล",       label: "อนุบาล",               emoji: "🧒" },
  { value: "ประถมศึกษา",   label: "ประถมศึกษา (ป.1–ป.6)",  emoji: "👦" },
  { value: "มัธยมตอนต้น",  label: "มัธยมตอนต้น (ม.1–ม.3)", emoji: "🎒" },
  { value: "มัธยมตอนปลาย", label: "มัธยมตอนปลาย (ม.4–ม.6)",emoji: "🎓" },
];

function FemaleUniformIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M34 30.2222C34 32.3085 32.3085 34 30.2222 34H3.77778C1.6915 34 0 32.3085 0 30.2222V3.77778C0 1.6915 1.6915 0 3.77778 0H30.2222C32.3085 0 34 1.6915 34 3.77778V30.2222Z" fill="#FBF0F0"/>
      <path d="M18.2665 33.4853C17.5695 34.1709 16.4305 34.1709 15.7344 33.4853L9.46994 27.319C8.77389 26.6333 8.58972 25.3999 9.06005 24.5763L16.1434 7.15417C16.6147 6.33156 17.3853 6.33156 17.8557 7.15417L24.939 24.5763C25.4093 25.3989 25.2252 26.6333 24.5291 27.3181L18.2665 33.4853Z" fill="#FF88C2"/>
      <path d="M17 13.8531C17.8963 13.8531 18.8927 12.954 19.7379 11.7838L17.8557 7.15417C17.3844 6.33156 16.6137 6.33156 16.1434 7.15417L14.2611 11.7838C15.1083 12.954 16.1037 13.8531 17 13.8531Z" fill="#A0041E"/>
      <path d="M21.7222 5.457C21.7222 7.31189 19.0863 12.1739 17 12.1739C14.9137 12.1739 12.2778 7.31189 12.2778 5.457C12.2778 3.77305 14.9137 2.83333 17 2.83333C19.0863 2.83333 21.7222 3.77305 21.7222 5.457Z" fill="#FF88C2"/>
      <path d="M0 3.77778V5.90656C1.95878 8.52267 6.40239 13.2269 7.55556 13.2269C9.64183 13.2269 17.9444 3.03072 17.9444 0.944444C17.9444 0 17 0 16.0556 0H3.77778C1.6915 0 0 1.6915 0 3.77778Z" fill="#B5B5B5"/>
      <path d="M16.0556 0.944444C16.0556 3.03072 24.3582 13.2269 26.4444 13.2269C27.5976 13.2269 32.0412 8.52267 34 5.90656V3.77778C34 1.6915 32.3085 0 30.2222 0H17.9444C17 0 16.0556 0 16.0556 0.944444Z" fill="#B5B5B5"/>
      <path d="M3.77778 0C3.52561 0 3.281 0.0273889 3.043 0.0746111C4.16028 1.63956 9.97522 2.83333 17 2.83333C24.0248 2.83333 29.8397 1.63956 30.957 0.0746111C30.719 0.0273889 30.4744 0 30.2222 0H3.77778Z" fill="#383838"/>
    </svg>
  );
}

// หมวดหมู่หลัก 4 ตัว (ตรงกับ category_item ใน DB)
const MAIN_CATEGORIES = [
  { id: 1, name: "เสื้อนักเรียนชาย",    gender: "male",   icon: "👔", color: "#1D4ED8", bg: "#EFF6FF" },
  { id: 3, name: "กางเกงนักเรียนชาย",   gender: "male",   icon: "👖", color: "#1D4ED8", bg: "#EFF6FF" },
  { id: 2, name: "เสื้อนักเรียนหญิง",   gender: "female", icon: "👗", Svg: FemaleUniformIcon, color: "#BE185D", bg: "#FDF2F8" },
  { id: 4, name: "กระโปรงนักเรียนหญิง", gender: "female", icon: "👗", color: "#BE185D", bg: "#FDF2F8" },
];

function projectStatusMeta(status) {
  switch (String(status || "").toLowerCase()) {
    case "open":   return { label: "กำลังเปิดรับบริจาค", dotClass: "dotGreen"  };
    case "closed": return { label: "ปิดรับบริจาคแล้ว",   dotClass: "dotGray"   };
    case "paused": return { label: "พักโครงการชั่วคราว",  dotClass: "dotYellow" };
    case "draft":  return { label: "ฉบับร่าง",            dotClass: "dotBlue"   };
    default:       return { label: "ไม่ทราบสถานะ",         dotClass: "dotGray"   };
  }
}

// key: "categoryId__level"
const cKey = (catId, level) => `${catId}__${level ?? "null"}`;

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
  const [toast,       setToast]       = useState(false);
  const toastTimer = useRef(null);

  const showToast = () => {
    setToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 2500);
  };

  // state ต่อ card: { preview, isCustom, customTypeName, uploading, msg }
  const [cardState,   setCardState]   = useState({});
  const [activeLevel, setActiveLevel] = useState(EDUCATION_LEVELS[0].value);

  // typeOptions ต่อ category_id (dropdown ใน modal)
  const [typeOptions, setTypeOptions] = useState({}); // { catId: [type_name, ...] }

  // modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [modalCat,    setModalCat]    = useState(null);  // MAIN_CATEGORIES item
  const [modalImg,    setModalImg]    = useState(null);  // file object
  const [modalImgUrl, setModalImgUrl] = useState(null);  // blob preview
  const [modalTypeSel,setModalTypeSel]= useState("");    // dropdown
  const [modalTypeIn, setModalTypeIn] = useState("");    // free text

  const formattedDate = project?.created_at
    ? new Date(project.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
    : "-";
  const canSave = !!title.trim() && !uploading;

  const loadProject = () => getJson(`/school/projects/${id}`, true);

  // โหลด cardState จาก public endpoint
  const loadCardState = async () => {
    const pub = await getJson(`/school/projects/public/${id}`, false);
    const cs = {};
    for (const item of pub?.uniform_items || []) {
      const cat = MAIN_CATEGORIES.find(c =>
        c.gender === item.gender &&
        ((c.id === 1 && item.uniform_category === "เสื้อ" && item.gender === "male") ||
          (c.id === 3 && item.uniform_category === "กางเกง") ||
          (c.id === 2 && item.uniform_category === "เสื้อ" && item.gender === "female") ||
          (c.id === 4 && item.uniform_category === "กระโปรง"))
      );
      if (!cat || !item.education_level) continue;
      const k = cKey(cat.id, item.education_level);

      // ✅ isCustom = โรงเรียนมี row ใน uniform_type_images (มี uniform_subtype_name ≠ null)
      // uniform_subtype_name จาก query = ถ้าไม่มี school custom จะ fallback เป็น ut.type_name
      // ดังนั้นเช็คว่า subtype_name ≠ type_name (name) เพื่อรู้ว่าโรงเรียนกรอกมาเอง
      const hasCustomSubtype = !!(
        item.uniform_subtype_name &&
        item.uniform_subtype_name.trim() !== "" &&
        item.uniform_subtype_name !== item.name
      );
      const isSchoolImage = !!(
  item.uniform_subtype_name &&
  item.uniform_subtype_name.trim() !== ""
);

if (!cs[k] || isSchoolImage) {
  cs[k] = {
    preview:        item.image_url || null,
    isCustom:       isSchoolImage,
    customTypeName: item.uniform_subtype_name || item.name || "",
    uploading:      false,
    msg:            "",
    // ✅ ถ้ามี quantity > 0 ให้ใช้ type_id นั้นเป็นหลัก (มาจาก student_need จริงๆ)
    uniformTypeId:  item.quantity > 0 
      ? item.uniform_type_id 
      : (cs[k]?.uniformTypeId || item.uniform_type_id),
  };
}
  }
  setCardState(cs);
};

//   const map = {};

// for (const t of (types || [])) {
//   if (!map[t.category_id]) map[t.category_id] = [];

//   // กันซ้ำโดยเช็ค id
//   if (!map[t.category_id].some(x => x.id === t.uniform_type_id)) {
//     map[t.category_id].push({
//       id: t.uniform_type_id,
//       name: t.type_name
//     });
//   }
// }
//       setTypeOptions(map);
  
useEffect(() => {
  async function loadTypes() {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${BASE}/school/uniform-types`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });

      const data = await res.json();

      const map = {};

for (const cat of MAIN_CATEGORIES) {
  map[cat.id] = [];

  for (const t of (data || [])) {
    const isMatch =
      t.gender === cat.gender &&
      (
        (cat.id === 1 && t.uniform_category === "เสื้อ") ||
        (cat.id === 2 && t.uniform_category === "เสื้อ") ||
        (cat.id === 3 && t.uniform_category === "กางเกง") ||
        (cat.id === 4 && t.uniform_category === "กระโปรง")
      );

    if (
  isMatch &&
  !map[cat.id].some(x => x.name === t.type_name)
) {
      map[cat.id].push({
        id: t.uniform_type_id,
        name: t.type_name
      });
    }
  }
}

      setTypeOptions(map);

    } catch (err) {
      console.error("loadTypes error:", err);
    }
  }

  loadTypes();
}, []);
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setErr(""); setLoading(true);
        const [data] = await Promise.all([loadProject()]);
        if (!data) { setErr("ไม่พบโครงการ"); return; }

        setProject(data);
        setTitle(data.request_title || "");
        setDescription(data.request_description || "");
        setImage(data.request_image_url || "");
        setStatus(data.status || "open");

        // โหลดรูปชุดนักเรียน
        await loadCardState();
      } catch (e) {
        setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally { setLoading(false); }
    })();
  // eslint-disable-next-line
  }, [id]);

  // useEffect(() => {
  //   if (activeLevel) loadTypeOptions(activeLevel);
  // // eslint-disable-next-line
  // }, [activeLevel]);

  // upload รูปโครงการหลัก
  const uploadProjectImage = async (file) => {
    if (!file?.type.startsWith("image/")) { setErr("กรุณาเลือกไฟล์รูปภาพเท่านั้น"); return; }
    setErr(""); setUploading(true);
    try {
      const fd = new FormData(); fd.append("image", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE}/school/projects/${id}/image`, {
        method: "POST", headers: { Authorization: token ? `Bearer ${token}` : "" }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setImage(data.url || "");
    } catch (e) { setErr(e?.message || "อัปโหลดรูปไม่สำเร็จ"); }
    finally { setUploading(false); }
  };

  const onSave = async () => {
    if (!canSave) return;
    try {
      setErr("");
      await request(`/school/projects/${id}`, {
        method: "PUT",
        body: { request_title: title.trim(), request_description: description || null, request_image_url: image || null, status },
        auth: true,
      });
      showToast();
      const fresh = await loadProject();
      setProject(fresh); setStatus(fresh?.status || status); setImage(fresh?.request_image_url || image);
      await loadCardState();
    } catch (e) { setErr(e?.data?.message || e.message || "บันทึกไม่สำเร็จ"); }
  };

  // ── เปิด modal แก้ไข ─────────────────────────────────────────────────────
  const openModal = (cat) => {
    setModalCat(cat);
    const k = cKey(cat.id, activeLevel);
    const s = cardState[k] || {};
    setModalImg(null);
    setModalImgUrl(s.preview || null);
    // ✅ restore uniformTypeId ที่เคย save ไว้ ให้ dropdown ถูกต้อง
    setModalTypeSel(s.uniformTypeId ? s.uniformTypeId : "");
    setModalTypeIn(s.customTypeName || "");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const onModalFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setModalImg(f);
    setModalImgUrl(URL.createObjectURL(f));
    e.target.value = "";
  };

  // ── บันทึกจาก modal ──────────────────────────────────────────────────────
  const saveModal = async () => {
    if (!modalCat) return;
    const k = cKey(modalCat.id, activeLevel);
    const options = typeOptions[modalCat.id] || [];
    const selected = options.find(x => x.id === Number(modalTypeSel));

    const typeName =
      modalTypeIn.trim() ||
      selected?.name ||
      modalCat.name;

    // ถ้ามีรูปใหม่ → upload
    if (modalImg) {
      // ✅ หา typeId: ใช้จาก dropdown ที่เลือก หรือ uniformTypeId เดิมใน cardState หรือ id แรกของ category
       const existingTypeId = cardState[k]?.uniformTypeId;
    const selectedTypeId = existingTypeId
      ? Number(existingTypeId)
      : modalTypeSel
      ? Number(modalTypeSel)
      : options[0]?.id;

    if (!selectedTypeId) {
      alert("กรุณาเลือก type จาก dropdown");
      return;
    }

      setCardState(prev => ({ ...prev, [k]: { ...prev[k], uploading: true, msg: "กำลังอัปโหลด..." } }));
      try {
        const fd = new FormData();
        fd.append("image", modalImg);
        fd.append("education_level", activeLevel);
        fd.append("category_id", modalCat.id);
        fd.append("custom_type_name", typeName);

        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE}/school/projects/${id}/uniform-images/${selectedTypeId}`, {
          method: "POST",
          headers: { Authorization: token ? `Bearer ${token}` : "" },
          body: fd,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Upload failed");

        setCardState(prev => ({
          ...prev,
          [k]: { preview: data.image_url,
            preview: `${data.image_url}?t=${Date.now()}`, isCustom: true, customTypeName: typeName, uploading: false, msg: "", uniformTypeId: selectedTypeId },
        }));
      } catch (e) {
        setCardState(prev => ({ ...prev, [k]: { ...prev[k], uploading: false, msg: `❌ ${e.message}` } }));
      }
    } else {
      // ไม่มีรูปใหม่ แค่อัปเดต type name และ typeId (ถ้าเปลี่ยน dropdown)
      const existingTypeId = cardState[k]?.uniformTypeId;
      const updatedTypeId = modalTypeSel ? Number(modalTypeSel) : existingTypeId;
      setCardState(prev => ({
        ...prev,
        [k]: {
          ...(prev[k] || {}),
          customTypeName: typeName,
          isCustom: !!prev[k]?.preview,
          uniformTypeId: updatedTypeId,
        },
      }));
    }
    setModalOpen(false);
  };

  // ── reset card ────────────────────────────────────────────────────────────
  const resetCard = async (cat) => {
    if (!window.confirm(`รีเซ็ตกลับไปใช้รูป default ของ "${cat.name}"?`)) return;
    const k = cKey(cat.id, activeLevel);
    // ✅ ใช้ uniformTypeId จริงที่บันทึกไว้ใน cardState (ไม่ใช่ cat.id ซึ่งเป็น MAIN_CATEGORIES index)
    const uniformTypeId = cardState[k]?.uniformTypeId;
    if (!uniformTypeId) {
      setCardState(prev => { const n = { ...prev }; delete n[k]; return n; });
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const qs = `?education_level=${encodeURIComponent(activeLevel)}`;
      const res = await fetch(`${BASE}/school/projects/${id}/uniform-images/${uniformTypeId}${qs}`, {
        method: "DELETE", headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      // ✅ reload จาก DB เพื่อให้ state sync กับข้อมูลจริง (ได้รูป default กลับมา)
      await loadCardState();
    } catch (e) {
      setCardState(prev => ({ ...prev, [k]: { ...prev[k], msg: `❌ ${e.message}` } }));
    }
  };

  // นับจำนวน card ที่มีรูปแล้วต่อ level
  const countCustomByLevel = (level) =>
    MAIN_CATEGORIES.filter(c => cardState[cKey(c.id, level)]?.isCustom).length;

  if (loading) return <div className="epPage"><div className="epLeft">กำลังโหลด...</div><div className="epRight" /></div>;
  if (err && !project) return (
    <div className="epPage">
      <div className="epLeft">
        <h2>แก้ไขข้อมูลโครงการ</h2>
        <div className="epError">{err}</div>
        <div className="epActions"><button className="epBtn epBtnGhost" onClick={() => navigate(-1)}>ย้อนกลับ</button></div>
      </div>
      <div className="epRight" />
    </div>
  );

  return (
    <div className="epPage">
      {/* Toast */}
      {toast && (
        <div className="epToast">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#22c55e"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          บันทึกสำเร็จ
        </div>
      )}
      {/* ===== TOP: Form + Preview ===== */}
      <div className="epTopSection">
      <div className="epLeft">
        <h2>แก้ไขข้อมูลโครงการ</h2>
        {err && <div className="epError">{err}</div>}

        <div className="epField">
          <label>ชื่อโรงเรียน</label>
          <input value={project?.school_name || ""} disabled />
        </div>
        <div className="epField">
          <label>ที่อยู่โรงเรียน</label>
          <textarea value={project?.school_address || ""} disabled />
        </div>
        <div className="epField">
          <label>ชื่อโครงการ</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น ขอรับบริจาคชุดนักเรียน ปี 2569" />
        </div>
        <div className="epField">
          <label>รายละเอียด</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="อธิบายรายละเอียดโครงการ..." />
        </div>
        <div className="epField">
          <label>รูปภาพโครงการ</label>
          <input type="file" accept="image/*" disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadProjectImage(f); }} />
          <div className="epHint">{uploading ? "กำลังอัปโหลดรูป..." : "เลือกไฟล์รูปเพื่ออัปโหลด (เก็บใน Cloudinary)"}</div>
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 8 }}>หรือวางลิงก์รูป (URL)</label>
            <input value={image} onChange={e => setImage(e.target.value)} placeholder="https://..." />
          </div>
        </div>

      </div>{/* end epLeft */}

      {/* ===== RIGHT: Preview ===== */}
      <div className="epRight">
        <div className="epRightHead"><div className="ttl">ตัวอย่างการ์ดโครงการ</div></div>
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
              <div className="cardMeta"><span>สร้างเมื่อ: {formattedDate}</span></div>
            </div>
          </div>
        </div>
      </div>

      </div>{/* end epTopSection */}

      {/* ===== UNIFORM SECTION (full width) ===== */}
      <div className="epUniformSection">
        <label className="epUniformLabel">
          รูปภาพชุดนักเรียน
          <span className="epUniformLabelSub">
            แต่ละหมวดหมู่มีรูป default ให้ — กด "แก้ไข" เพื่อเปลี่ยนรูปและระบุ type ของโรงเรียน
          </span>
        </label>
        <div className="epField">

          {/* Step 1: เลือกระดับชั้น */}
          <div className="epLevelStepBox">
            <div className="epStepLabel">
              <span className="epStepBadge">1</span>
              เลือกระดับชั้น
            </div>
            <div className="epLevelBtnGroup">
              {EDUCATION_LEVELS.map(lv => {
                const cnt = countCustomByLevel(lv.value);
                return (
                  <button key={lv.value} type="button"
                    className={`epLevelBtn ${activeLevel === lv.value ? "epLevelBtnActive" : ""}`}
                    onClick={() => setActiveLevel(lv.value)}
                  >
                    <span className="epLevelBtnEmoji">{lv.emoji}</span>
                    <span className="epLevelBtnLabel">{lv.label}</span>
                    {cnt > 0 && <span className="epLevelBtnBadge">{cnt} แก้ไขแล้ว</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: grid หมวดหมู่หลัก */}
          <div className="epUniformStepBox">
            <div className="epStepLabel">
              <span className="epStepBadge">2</span>
              แก้ไขรูปและ type สำหรับระดับ
              <strong style={{ color: "#29B6E8", marginLeft: 6 }}>
                {EDUCATION_LEVELS.find(l => l.value === activeLevel)?.label}
              </strong>
            </div>

            {/* ── ชาย ── */}
            <div className="epUniformGenderSection">
              <div className="epUniformGenderHeader" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
                <span>👦</span><span>ชุดนักเรียนชาย</span>
                <span className="epUniformGenderCount">
                  {MAIN_CATEGORIES.filter(c => c.gender === "male" && cardState[cKey(c.id, activeLevel)]?.isCustom).length}
                  /{MAIN_CATEGORIES.filter(c => c.gender === "male").length} แก้ไขแล้ว
                </span>
              </div>
              <div className="epUniformTypeGrid">
                {MAIN_CATEGORIES.filter(c => c.gender === "male").map(cat => (
                  <CategoryCard key={cat.id} cat={cat} level={activeLevel}
                    state={cardState[cKey(cat.id, activeLevel)] || {}}
                    onEdit={() => openModal(cat)} onReset={() => resetCard(cat)} />
                ))}
              </div>
            </div>

            {/* ── หญิง ── */}
            <div className="epUniformGenderSection">
              <div className="epUniformGenderHeader" style={{ background: "#FDF2F8", color: "#BE185D" }}>
                <span>👧</span><span>ชุดนักเรียนหญิง</span>
                <span className="epUniformGenderCount">
                  {MAIN_CATEGORIES.filter(c => c.gender === "female" && cardState[cKey(c.id, activeLevel)]?.isCustom).length}
                  /{MAIN_CATEGORIES.filter(c => c.gender === "female").length} แก้ไขแล้ว
                </span>
              </div>
              <div className="epUniformTypeGrid">
                {MAIN_CATEGORIES.filter(c => c.gender === "female").map(cat => (
                  <CategoryCard key={cat.id} cat={cat} level={activeLevel}
                    state={cardState[cKey(cat.id, activeLevel)] || {}}
                    onEdit={() => openModal(cat)} onReset={() => resetCard(cat)} />
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="epUniformSummary">
              <div className="epUniformSummaryTitle">สรุปที่แก้ไขแล้วทุกระดับชั้น</div>
              {EDUCATION_LEVELS.map(lv => {
                const done = MAIN_CATEGORIES.filter(c => cardState[cKey(c.id, lv.value)]?.isCustom);
                if (!done.length) return null;
                return (
                  <div key={lv.value} className="epUniformSummaryLevel">
                    <span className="epUniformSummaryLevelName">{lv.emoji} {lv.label}</span>
                    <div className="epUniformSummaryImgs">
                      {done.map(cat => {
                        const s = cardState[cKey(cat.id, lv.value)];
                        return (
                          <div key={cat.id} className="epUniformSummaryThumb">
                            <img src={s.preview} alt={cat.name} />
                            <span>{s.customTypeName || cat.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {MAIN_CATEGORIES.every(c => !cardState[cKey(c.id, activeLevel)]?.isCustom) && (
                <div className="epUniformSummaryEmpty">ยังใช้รูป default ทั้งหมด</div>
              )}
            </div>
          </div>
        </div>

        <div className="epActions">
          <button className="epBtn epBtnGhost" onClick={() => navigate(-1)} disabled={uploading}>ย้อนกลับ</button>
          <button className="epBtn epBtnPrimary" disabled={!canSave} onClick={onSave}>
            {uploading ? "กำลังอัปโหลด..." : "บันทึก"}
          </button>
        </div>
      </div>{/* end epUniformSection */}

      {/* ═══════════════════════════════════════════════════════════════
          Modal แก้ไข type + รูป
      ═══════════════════════════════════════════════════════════════ */}
      {modalOpen && modalCat && (
        <div className="epModalOverlay" onClick={closeModal}>
          <div className="epModal" onClick={e => e.stopPropagation()}>
            <div className="epModalHead">
              <div>
                <div className="epModalTitle">แก้ไข: {modalCat.name}</div>
                <div className="epModalSub">
                  {EDUCATION_LEVELS.find(l => l.value === activeLevel)?.label}
                </div>
              </div>
              <button className="epModalClose" onClick={closeModal}>×</button>
            </div>

            <div className="epModalBody">
              {/* รูป default ปัจจุบัน */}
              <div className="epModalDefaultStrip">
                <div className="epModalDefaultIcon">{modalCat.Svg ? <modalCat.Svg size={28} /> : modalCat.icon}</div>
                <div className="epModalDefaultInfo">
                  <div className="epModalDefaultTitle">{modalCat.name}</div>
                  <div className="epModalDefaultSub">หมวดหมู่หลักของระบบ</div>
                </div>
                <span className="epModalDefaultBadge">default</span>
              </div>

              {/* Upload zone */}
              <label className="epModalUploadZone" htmlFor="modal-file">
                {modalImgUrl
                  ? <img src={modalImgUrl} alt="preview" className="epModalPreviewImg" />
                  : (
                    <div className="epModalUploadEmpty">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                          stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>คลิกเพื่ออัปโหลดรูปของโรงเรียน</span>
                      <span className="epModalUploadHint">JPG, PNG ไม่เกิน 5MB</span>
                    </div>
                  )}
              </label>
              <input id="modal-file" type="file" accept="image/*"
                style={{ display: "none" }} onChange={onModalFileChange} />

              {/* Type name */}
              <div className="epModalFieldLabel">
                ชื่อ type ของโรงเรียน
                <span className="epModalFieldPill">เลือกจาก dropdown หรือกรอกเอง</span>
              </div>

              {/* Dropdown จาก seed data */}
              {typeOptions[modalCat.id]?.length > 0 && (
                <select className="epModalSelect"
                  value={modalTypeSel}
                  onChange={e => {
  const selectedId = Number(e.target.value);
  const selected = typeOptions[modalCat.id].find(x => x.id === selectedId);

  setModalTypeSel(selectedId);
  setModalTypeIn(selected?.name || "");
}}
                >
                  <option value="">— เลือก type ที่มีในระบบ —</option>
                  {typeOptions[modalCat.id].map(opt => (
  <option key={opt.id} value={opt.id}>
    {opt.name}
  </option>
))}
                </select>
              )}

              <div className="epModalOrDivider">หรือกรอกเอง</div>

              <input className="epModalInput"
                placeholder={`เช่น คอฮาวาย, ทรงตรง, รุ่นพิเศษ...`}
                value={modalTypeIn}
                onChange={e => { setModalTypeIn(e.target.value); setModalTypeSel(""); }}
              />
              <p className="epModalNote">ชื่อที่กรอกจะแสดงใต้รูปบนหน้าโครงการสาธารณะ</p>
            </div>

            <div className="epModalFoot">
              <button className="epBtn epBtnGhost" onClick={closeModal}>ยกเลิก</button>
              <button className="epBtn epBtnPrimary" onClick={saveModal}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CategoryCard component ──────────────────────────────────────────────────
function CategoryCard({ cat, level, state, onEdit, onReset }) {
  const displayName = state.customTypeName || cat.name;
  return (
    <div className={`epUniCard ${state.isCustom ? "epUniCardCustom" : ""} ${state.uploading ? "epUniCardLoading" : ""}`}>
      {/* รูป */}
      <div className="epUniCardImg">
        {state.preview
          ? <img src={state.preview} alt={displayName} />
          : (
            <div className="epUniCardEmpty">
              {cat.Svg ? <cat.Svg size={32} /> : <span style={{ fontSize: 28 }}>{cat.icon}</span>}
              <span>ยังไม่มีรูป</span>
            </div>
          )}
        {/* badge */}
        <span className="epUniCardBadge" style={{
          background: state.isCustom ? "#29B6E8" : "#94A3B8", color: "#fff"
        }}>
          {state.isCustom ? "รูปโรงเรียน" : "default"}
        </span>
        {state.uploading && <div className="epUniCardSpin"><div className="epSpinner" /></div>}
      </div>

      {/* ชื่อ type ใต้รูป */}
      <div className="epUniCardTypeName">
        {cat.Svg ? <cat.Svg size={16} /> : cat.icon} <span>{displayName}</span>
      </div>
      <div className="epUniCardSubCat" style={{ color: "#94A3B8", fontSize: 10, padding: "0 10px 4px" }}>
        {cat.name} · {level}
      </div>

      {state.msg && (
        <div className={`epUniCardMsg ${state.msg.startsWith("❌") ? "err" : "info"}`}>
          {state.msg}
        </div>
      )}

      <div className="epUniCardActions">
        <button type="button" className="epUniBtn epUniBtnPrimary" onClick={onEdit}
          disabled={state.uploading}>
          {state.uploading ? "กำลังบันทึก..." : "✏️ แก้ไข"}
        </button>
        {state.isCustom && !state.uploading && (
          <button type="button" className="epUniBtn epUniBtnGhost" onClick={onReset}>
            reset
          </button>
        )}
      </div>
    </div>
  );
}