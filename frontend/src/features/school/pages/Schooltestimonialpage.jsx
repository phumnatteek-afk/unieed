// SchoolTestimonialPage.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../styles/Schooltestimonialpage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const STATUS_LABEL = { open: "กำลังดำเนินการ", closed: "ปิดรับบริจาคแล้ว", archived: "ปิดโครงการ" };
const STATUS_CLASS = { open: "stBadgeOpen", closed: "stBadgeClosed", archived: "stBadgeArchived" };

const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const formatDate = (raw) => {
  if (!raw) return "";
  const d = new Date(raw);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};

export default function SchoolTestimonialPage() {
  const { token } = useAuth();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // ── View 1: project list ──
  const [projects,     setProjects]     = useState([]);
  const [projLoading,  setProjLoading]  = useState(true);

  // ── View 2: testimonials of selected project ──
  const [selected,     setSelected]     = useState(null); // project object
  const [testimonials, setTestimonials] = useState([]);
  const [tLoading,     setTLoading]     = useState(false);

  // ── Form state ──
  const [showForm,     setShowForm]     = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [err,          setErr]          = useState("");
  const [deleteConfirm,setDeleteConfirm]= useState(null);
  const [title,        setTitle]        = useState("");
  const [text,         setText]         = useState("");
  const [imgFile,      setImgFile]      = useState(null);
  const [imgPrev,      setImgPrev]      = useState(null);
  const [imgUrl,       setImgUrl]       = useState("");
  const [pub,          setPub]          = useState(true);

  // ── Load all projects ──
  useEffect(() => {
    (async () => {
      try {
        setProjLoading(true);
        const res = await fetch(`${BASE}/school/projects`, { headers });
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch (e) { console.error(e); }
      finally { setProjLoading(false); }
    })();
  }, []);

  // ── Load testimonials for selected project ──
  const loadTestimonials = async (proj) => {
    try {
      setTLoading(true);
      const res = await fetch(`${BASE}/school/testimonials?request_id=${proj.request_id}`, { headers });
      const data = await res.json();
      setTestimonials(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setTLoading(false); }
  };

  const selectProject = (proj) => {
    setSelected(proj);
    loadTestimonials(proj);
  };

  const goBack = () => {
    setSelected(null);
    setTestimonials([]);
    resetForm();
  };

  // ── Form helpers ──
  const resetForm = () => {
    setTitle(""); setText(""); setImgFile(null); setImgPrev(null);
    setImgUrl(""); setPub(true); setEditItem(null); setErr("");
  };

  const openEdit = (t) => {
    setEditItem(t);
    setTitle(t.review_title || ""); setText(t.review_text || "");
    setImgPrev(t.image_url || null); setImgUrl(t.image_url || "");
    setPub(t.is_published === 1 || t.is_published === true);
    setImgFile(null); setErr(""); setShowForm(true);
  };

  const handleImgChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgFile(f); setImgPrev(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return setErr("กรุณากรอกหัวข้อ");
    if (!text.trim())  return setErr("กรุณากรอกความประทับใจ");
    setErr(""); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("review_title", title.trim());
      fd.append("review_text",  text.trim());
      fd.append("is_published", pub ? "1" : "0");
      if (!editItem && selected?.request_id) fd.append("request_id", selected.request_id);
      if (imgFile) fd.append("image", imgFile);
      else if (imgUrl) fd.append("image_url", imgUrl);
      const url    = editItem ? `${BASE}/school/testimonials/${editItem.testimonial_id}` : `${BASE}/school/testimonials`;
      const method = editItem ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body: fd });
      const data   = await res.json();
      if (!res.ok) throw new Error(data?.message || "เกิดข้อผิดพลาด");
      setShowForm(false); resetForm(); loadTestimonials(selected);
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${BASE}/school/testimonials/${id}`, { method: "DELETE", headers });
      setDeleteConfirm(null); loadTestimonials(selected);
    } catch (e) { console.error(e); }
  };

  const togglePublish = async (t) => {
    try {
      await fetch(`${BASE}/school/testimonials/${t.testimonial_id}`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: t.is_published ? 0 : 1 }),
      });
      loadTestimonials(selected);
    } catch (e) { console.error(e); }
  };

  // ══════════════════════════════════════════════
  // VIEW 1 — Project list
  // ══════════════════════════════════════════════
  if (!selected) {
    return (
      <div className="stPage">
        <div className="stHeader">
          <div>
            <h1 className="stTitle">บันทึกความประทับใจ</h1>
            <div className="stSubtitle">เลือกโครงการที่ต้องการบันทึกความประทับใจ</div>
          </div>
        </div>

        {projLoading ? (
          <div className="stLoading">กำลังโหลด...</div>
        ) : projects.length === 0 ? (
          <div className="stEmpty">
            <div className="stEmptyIcon">📋</div>
            <div className="stEmptyText">ยังไม่มีโครงการ</div>
            <div className="stEmptySub">สร้างโครงการก่อนเพื่อบันทึกความประทับใจ</div>
          </div>
        ) : (
          <div className="stProjList">
            {projects.map(p => (
              <div key={p.request_id} className="stProjRow" onClick={() => selectProject(p)}>
                <div className="stProjRowImg">
                  {p.request_image_url
                    ? <img src={p.request_image_url} alt={p.request_title} />
                    : <div className="stProjRowImgEmpty"><Icon icon="mdi:school-outline" width="32" color="#94a3b8" /></div>}
                </div>
                <div className="stProjRowBody">
                  <div className="stProjRowTop">
                    <span className={`stBadge ${STATUS_CLASS[p.status] || ""}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>
                  <div className="stProjRowTitle">{p.request_title}</div>
                  <div className="stProjRowDates">
                    <Icon icon="mdi:calendar-range" width="14" />
                    {formatDate(p.created_at)}
                    {p.end_date && <> – {formatDate(p.end_date)}</>}
                  </div>
                  {p.duration_months && (
                    <div className="stProjRowDuration">
                      <Icon icon="mdi:clock-outline" width="13" />
                      ระยะเวลา: <strong>{p.duration_months} เดือน</strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // VIEW 2 — Testimonials of selected project
  // ══════════════════════════════════════════════
  return (
    <div className="stPage">
      {/* Header */}
      <div className="stHeader">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button className="stBackBtn" onClick={goBack}>
            <Icon icon="mdi:arrow-left" width="28" />
          </button>
          <div>
            <h1 className="stTitle">ความประทับใจ</h1>
            <div className="stSubtitle">โครงการ: {selected.request_title}</div>
          </div>
        </div>
        <button className="stBtnAdd" onClick={() => { resetForm(); setShowForm(true); }}>
          <Icon icon="mdi:plus" width="18" /> เพิ่มความประทับใจ
        </button>
      </div>

      {/* Mini project card */}
      <div className="stMiniCard">
        <div className="stMiniImg">
          {selected.request_image_url
            ? <img src={selected.request_image_url} alt={selected.request_title} />
            : <div className="stMiniImgEmpty"><Icon icon="mdi:school-outline" width="28" color="#94a3b8" /></div>}
        </div>
        <div className="stMiniInfo">
          <span className={`stBadge ${STATUS_CLASS[selected.status] || ""}`}>
            {STATUS_LABEL[selected.status] || selected.status}
          </span>
          <div className="stMiniTitle">{selected.request_title}</div>
          <div className="stMiniDates">
            <Icon icon="mdi:calendar-range" width="13" />
            {formatDate(selected.created_at)}
            {selected.end_date && <> – {formatDate(selected.end_date)}</>}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      {tLoading ? (
        <div className="stLoading">กำลังโหลด...</div>
      ) : testimonials.length === 0 ? (
        <div className="stEmpty">
          <div className="stEmptyIcon"><svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 36 36"><path fill="#ccd6dd" d="M36 27a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4z"/><path fill="#99aab5" d="M11.949 17.636L.637 28.948c-.027.029-.037.064-.06.092c.34.57.814 1.043 1.384 1.384c.029-.023.063-.033.09-.06L13.365 19.05a1 1 0 0 0-1.416-1.414M35.423 29.04c-.021-.028-.033-.063-.06-.09L24.051 17.636a1 1 0 1 0-1.415 1.414l11.313 11.314c.026.026.062.037.09.06a4 4 0 0 0 1.384-1.384"/><path fill="#99aab5" d="M32 5H4a4 4 0 0 0-4 4v1.03l14.527 14.496a4.883 4.883 0 0 0 6.885 0L36 10.009V9a4 4 0 0 0-4-4"/><path fill="#e1e8ed" d="M32 5H4A3.99 3.99 0 0 0 .405 7.275l14.766 14.767a4 4 0 0 0 5.657 0L35.595 7.275A3.99 3.99 0 0 0 32 5"/><path fill="#dd2e44" d="M27 16.78a4.986 4.986 0 0 0-4.986-4.987a4.98 4.98 0 0 0-4.053 2.087a4.98 4.98 0 0 0-4.051-2.087a4.987 4.987 0 0 0-4.987 4.987c0 .391.05.769.134 1.133c.693 4.302 5.476 8.841 8.904 10.087c3.428-1.246 8.212-5.785 8.904-10.086c.085-.365.135-.744.135-1.134"/></svg></div>
          <div className="stEmptyText">ยังไม่มีความประทับใจ</div>
          <div className="stEmptySub">กดปุ่ม "เพิ่มความประทับใจ" ด้านบนขวาเพื่อบันทึกครั้งแรก</div>
        </div>
      ) : (
        <div className="stGrid">
          {testimonials.map(t => (
            <div key={t.testimonial_id} className={`stCard ${!t.is_published ? "stCardDraft" : ""}`}>
              <div className={`stRibbon ${t.is_published ? "stRibbonPub" : "stRibbonDraft"}`}>
                {t.is_published ? "เผยแพร่" : "ฉบับร่าง"}
              </div>
              {t.image_url && <div className="stCardImg"><img src={t.image_url} alt={t.review_title} /></div>}
              <div className="stCardTitle">{t.review_title}</div>
              <div className="stCardText">"{t.review_text}"</div>
              <div className="stCardDate">{formatDate(t.review_date || t.created_at)}</div>
              <div className="stCardActions">
                <button className="stCardBtn stCardBtnEdit" onClick={() => openEdit(t)}>
                  <Icon icon="mdi:pencil-outline" width="14" /> แก้ไข
                </button>
                <button className={`stCardBtn ${t.is_published ? "stCardBtnUnpub" : "stCardBtnPub"}`}
                  onClick={() => togglePublish(t)}>
                  <Icon icon={t.is_published ? "mdi:eye-off-outline" : "mdi:eye-outline"} width="14" />
                  {t.is_published ? "ซ่อน" : "เผยแพร่"}
                </button>
                <button className="stCardBtn stCardBtnDel" onClick={() => setDeleteConfirm(t)}>
                  <Icon icon="mdi:trash-can-outline" width="14" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="stOverlay" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="stModal" onClick={e => e.stopPropagation()}>
            <button className="stModalClose" onClick={() => { setShowForm(false); resetForm(); }}>
              <Icon icon="mdi:close" width="18" />
            </button>
            <div className="stModalTitle">
              {editItem ? "✏️ แก้ไขความประทับใจ" : <><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 36 36" style={{verticalAlign:"middle",marginRight:6}}><path fill="#ccd6dd" d="M36 27a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4z"/><path fill="#99aab5" d="M11.949 17.636L.637 28.948c-.027.029-.037.064-.06.092c.34.57.814 1.043 1.384 1.384c.029-.023.063-.033.09-.06L13.365 19.05a1 1 0 0 0-1.416-1.414M35.423 29.04c-.021-.028-.033-.063-.06-.09L24.051 17.636a1 1 0 1 0-1.415 1.414l11.313 11.314c.026.026.062.037.09.06a4 4 0 0 0 1.384-1.384"/><path fill="#99aab5" d="M32 5H4a4 4 0 0 0-4 4v1.03l14.527 14.496a4.883 4.883 0 0 0 6.885 0L36 10.009V9a4 4 0 0 0-4-4"/><path fill="#e1e8ed" d="M32 5H4A3.99 3.99 0 0 0 .405 7.275l14.766 14.767a4 4 0 0 0 5.657 0L35.595 7.275A3.99 3.99 0 0 0 32 5"/><path fill="#dd2e44" d="M27 16.78a4.986 4.986 0 0 0-4.986-4.987a4.98 4.98 0 0 0-4.053 2.087a4.98 4.98 0 0 0-4.051-2.087a4.987 4.987 0 0 0-4.987 4.987c0 .391.05.769.134 1.133c.693 4.302 5.476 8.841 8.904 10.087c3.428-1.246 8.212-5.785 8.904-10.086c.085-.365.135-.744.135-1.134"/></svg>เพิ่มความประทับใจใหม่</>}
            </div>

            <div className="stFormSection">
              <label className="stFormLabel">หัวข้อ <span className="stReq">*</span></label>
              <input className="stFormInput" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="เช่น ขอบคุณผู้ใจบุญทุกท่าน" />
            </div>

            <div className="stFormSection">
              <label className="stFormLabel">ความประทับใจ <span className="stReq">*</span></label>
              <textarea className="stFormTextarea" rows={5} value={text}
                onChange={e => setText(e.target.value)}
                placeholder="เล่าประสบการณ์ ความรู้สึก หรือผลลัพธ์ที่ได้รับ..." />
            </div>

            <div className="stFormSection">
              <label className="stFormLabel">รูปภาพประกอบ (ไม่บังคับ)</label>
              <label className="stUploadBox">
                {imgPrev
                  ? <img src={imgPrev} alt="preview" className="stUploadPreview" />
                  : <><Icon icon="mdi:image-plus-outline" width="32" color="#94a3b8" /><span>คลิกเพื่ออัปโหลดรูป</span></>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImgChange} />
              </label>
              {imgPrev && (
                <button className="stClearImg" onClick={() => { setImgFile(null); setImgPrev(null); setImgUrl(""); }}>
                  <Icon icon="mdi:close-circle" width="14" /> ลบรูป
                </button>
              )}
            </div>

            <div className="stFormSection stFormRow">
              <label className="stFormLabel" style={{ marginBottom: 0 }}>เผยแพร่ทันที</label>
              <button type="button" className={`stToggle ${pub ? "stToggleOn" : ""}`} onClick={() => setPub(p => !p)}>
                <span className="stToggleThumb" />
              </button>
            </div>

            {err && <div className="stErr">{err}</div>}
            <div className="stModalActions">
              <button className="stModalBtnGhost" onClick={() => { setShowForm(false); resetForm(); }}>ยกเลิก</button>
              <button className="stModalBtnPrimary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "กำลังบันทึก..." : editItem ? "บันทึกการแก้ไข" : "เพิ่มความประทับใจ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="stOverlay" onClick={() => setDeleteConfirm(null)}>
          <div className="stConfirmPopup" onClick={e => e.stopPropagation()}>
            <div className="stConfirmIcon">🗑️</div>
            <div className="stConfirmTitle">ลบความประทับใจ?</div>
            <div className="stConfirmBody">"{deleteConfirm.review_title}" จะถูกลบถาวร</div>
            <div className="stModalActions" style={{ justifyContent: "center" }}>
              <button className="stModalBtnGhost" onClick={() => setDeleteConfirm(null)}>ยกเลิก</button>
              <button className="stModalBtnDanger" onClick={() => handleDelete(deleteConfirm.testimonial_id)}>ลบเลย</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
