// SchoolTestimonialPage.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../styles/Schooltestimonialpage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";
const STAR_LABELS = ["","แย่มาก","พอใช้","ดี","ดีมาก","ประทับใจมาก"];

export default function SchoolTestimonialPage() {
  const { token } = useAuth();
  const [testimonials,  setTestimonials]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [editItem,      setEditItem]      = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [err,           setErr]           = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [title,  setTitle]  = useState("");
  const [text,   setText]   = useState("");
  const [rating, setRating] = useState(5);
  const [hover,  setHover]  = useState(0);
  const [imgFile,setImgFile]= useState(null);
  const [imgPrev,setImgPrev]= useState(null);
  const [imgUrl, setImgUrl] = useState("");
  const [pub,    setPub]    = useState(true);

  const headers = token ? { Authorization:`Bearer ${token}` } : {};

  const load = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BASE}/school/testimonials`, { headers });
      const data = await res.json();
      setTestimonials(Array.isArray(data) ? data : []);
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setTitle(""); setText(""); setRating(5); setHover(0);
    setImgFile(null); setImgPrev(null); setImgUrl(""); setPub(true);
    setEditItem(null); setErr("");
  };

  const openEdit = (t) => {
    setEditItem(t);
    setTitle(t.review_title||""); setText(t.review_text||"");
    setRating(Number(t.rating)||5); setImgPrev(t.image_url||null);
    setImgUrl(t.image_url||""); setPub(t.is_published===1||t.is_published===true);
    setImgFile(null); setHover(0); setErr(""); setShowForm(true);
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
      fd.append("is_published", pub?"1":"0");
      if (imgFile) fd.append("image", imgFile);
      else if (imgUrl) fd.append("image_url", imgUrl);
      const url    = editItem ? `${BASE}/school/testimonials/${editItem.testimonial_id}` : `${BASE}/school/testimonials`;
      const method = editItem ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body:fd });
      const data   = await res.json();
      if (!res.ok) throw new Error(data?.message||"เกิดข้อผิดพลาด");
      setShowForm(false); resetForm(); load();
    } catch(e){ setErr(e.message); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${BASE}/school/testimonials/${id}`, { method:"DELETE", headers });
      setDeleteConfirm(null); load();
    } catch(e){ console.error(e); }
  };

  const togglePublish = async (t) => {
    try {
      await fetch(`${BASE}/school/testimonials/${t.testimonial_id}`, {
        method:"PATCH", headers:{...headers,"Content-Type":"application/json"},
        body:JSON.stringify({ is_published: t.is_published?0:1 }),
      });
      load();
    } catch(e){ console.error(e); }
  };

  const formatDate = (raw) => {
    if (!raw) return "";
    const d = new Date(raw);
    return `${d.getDate()} ${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][d.getMonth()]} ${d.getFullYear()+543}`;
  };

  return (
    <div className="stPage">
      <div className="stHeader">
        <div>
          <h1 className="stTitle">บันทึกความประทับใจ</h1>
          <div className="stSubtitle">แบ่งปันประสบการณ์และความรู้สึกของโรงเรียน</div>
        </div>
        <button className="stBtnAdd" onClick={() => { resetForm(); setShowForm(true); }}>
          <Icon icon="mdi:plus" width="18" /> เพิ่มความประทับใจ
        </button>
      </div>

      {loading ? <div className="stLoading">กำลังโหลด...</div>
      : testimonials.length === 0 ? (
        <div className="stEmpty">
          <div className="stEmptyIcon">💌</div>
          <div className="stEmptyText">ยังไม่มีความประทับใจ</div>
          <div className="stEmptySub">กดปุ่ม "เพิ่มความประทับใจ" เพื่อบันทึกครั้งแรก</div>
          <button className="stBtnAdd" style={{marginTop:16}} onClick={() => { resetForm(); setShowForm(true); }}>
            <Icon icon="mdi:plus" width="18" /> เพิ่มเลย
          </button>
        </div>
      ) : (
        <div className="stGrid">
          {testimonials.map(t => (
            <div key={t.testimonial_id} className={`stCard ${!t.is_published?"stCardDraft":""}`}>
              <div className={`stRibbon ${t.is_published?"stRibbonPub":"stRibbonDraft"}`}>
                {t.is_published?"เผยแพร่":"ฉบับร่าง"}
              </div>
              {t.image_url && <div className="stCardImg"><img src={t.image_url} alt={t.review_title} /></div>}
              <div className="stCardTitle">{t.review_title}</div>
              <div className="stCardText">"{t.review_text}"</div>
              <div className="stCardDate">{formatDate(t.review_date||t.created_at)}</div>
              <div className="stCardActions">
                <button className="stCardBtn stCardBtnEdit" onClick={() => openEdit(t)}>
                  <Icon icon="mdi:pencil-outline" width="14" /> แก้ไข
                </button>
                <button className={`stCardBtn ${t.is_published?"stCardBtnUnpub":"stCardBtnPub"}`}
                  onClick={() => togglePublish(t)}>
                  <Icon icon={t.is_published?"mdi:eye-off-outline":"mdi:eye-outline"} width="14" />
                  {t.is_published?"ซ่อน":"เผยแพร่"}
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
            <div className="stModalTitle">{editItem?"✏️ แก้ไขความประทับใจ":"💌 เพิ่มความประทับใจใหม่"}</div>


            <div className="stFormSection">
              <label className="stFormLabel">หัวข้อ <span className="stReq">*</span></label>
              <input className="stFormInput" value={title} onChange={e=>setTitle(e.target.value)}
                placeholder="เช่น ขอบคุณผู้ใจบุญทุกท่าน" />
            </div>

            <div className="stFormSection">
              <label className="stFormLabel">ความประทับใจ <span className="stReq">*</span></label>
              <textarea className="stFormTextarea" rows={5} value={text}
                onChange={e=>setText(e.target.value)}
                placeholder="เล่าประสบการณ์ ความรู้สึก หรือผลลัพธ์ที่ได้รับ..." />
            </div>

            <div className="stFormSection">
              <label className="stFormLabel">รูปภาพประกอบ (ไม่บังคับ)</label>
              <label className="stUploadBox">
                {imgPrev
                  ? <img src={imgPrev} alt="preview" className="stUploadPreview" />
                  : <><Icon icon="mdi:image-plus-outline" width="32" color="#94a3b8" /><span>คลิกเพื่ออัปโหลดรูป</span></>}
                <input type="file" accept="image/*" style={{display:"none"}} onChange={handleImgChange} />
              </label>
              {imgPrev && (
                <button className="stClearImg" onClick={()=>{setImgFile(null);setImgPrev(null);setImgUrl("");}}>
                  <Icon icon="mdi:close-circle" width="14" /> ลบรูป
                </button>
              )}
            </div>

            <div className="stFormSection stFormRow">
              <label className="stFormLabel" style={{marginBottom:0}}>เผยแพร่ทันที</label>
              <button type="button" className={`stToggle ${pub?"stToggleOn":""}`} onClick={()=>setPub(p=>!p)}>
                <span className="stToggleThumb" />
              </button>
            </div>

            {err && <div className="stErr">{err}</div>}
            <div className="stModalActions">
              <button className="stModalBtnGhost" onClick={()=>{setShowForm(false);resetForm();}}>ยกเลิก</button>
              <button className="stModalBtnPrimary" onClick={handleSubmit} disabled={submitting}>
                {submitting?"กำลังบันทึก...":editItem?"บันทึกการแก้ไข":"เพิ่มความประทับใจ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="stOverlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="stConfirmPopup" onClick={e=>e.stopPropagation()}>
            <div className="stConfirmIcon">🗑️</div>
            <div className="stConfirmTitle">ลบความประทับใจ?</div>
            <div className="stConfirmBody">"{deleteConfirm.review_title}" จะถูกลบถาวร</div>
            <div className="stModalActions" style={{justifyContent:"center"}}>
              <button className="stModalBtnGhost" onClick={()=>setDeleteConfirm(null)}>ยกเลิก</button>
              <button className="stModalBtnDanger" onClick={()=>handleDelete(deleteConfirm.testimonial_id)}>ลบเลย</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}