import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "../../../api/http.js";
import "../styles/schoolRequestCreate.css";

export default function SchoolRequestCreatePage() {
  const nav = useNavigate();

  const [request_title, setTitle] = useState("");
  const [request_description, setDesc] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleImageChange = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    const formData = new FormData();
    formData.append("file", imageFile);
    const res = await fetch("http://localhost:3000/upload/image?type=project", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "อัปโหลดรูปไม่สำเร็จ");
    return data;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!request_title.trim()) { setErr("กรุณากรอกชื่อโครงการ"); return; }
    try {
      setErr(""); setLoading(true);
      let imageData = null;
      if (imageFile) imageData = await uploadImage();
      const created = await postJson("/school/projects", {
        request_title,
        request_description,
        request_image_url: imageData?.image_url || null,
        request_image_public_id: imageData?.public_id || null,
      }, true);
      nav(`/school/projects/${created.request_id}`);
    } catch (e2) {
      setErr(e2?.data?.message || e2.message || "สร้างโครงการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="srcPage">

      {/* ── Left: Form ─────────────────────────────────── */}
      <div className="srcLeft">

        {/* Header */}
        <div className="srcHeader">
          <div className="srcHeaderIcon">🎒</div>
          <div>
            <h1 className="srcTitle">สร้างโครงการขอรับบริจาค</h1>
            <p className="srcSubtitle">กรอกข้อมูลโครงการเพื่อเปิดรับบริจาคชุดนักเรียน</p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="srcSteps">
          <div className="srcStep srcStepActive">
            <div className="srcStepNum">1</div>
            <span>รายละเอียดโครงการ</span>
          </div>
          <div className="srcStepLine" />
          <div className="srcStep srcStepPending">
            <div className="srcStepNum">2</div>
            <span>เพิ่มรายชื่อนักเรียน</span>
          </div>
        </div>

        {err && (
          <div className="srcErr">
            <span>⚠️</span> {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="srcForm">

          {/* ชื่อโครงการ */}
          <div className="srcField">
            <label className="srcLabel">
              ชื่อโครงการ <span className="srcReq">*</span>
            </label>
            <input
              className="srcInput"
              value={request_title}
              onChange={(e) => { setTitle(e.target.value); if (err) setErr(""); }}
              placeholder="เช่น ขอรับบริจาคชุดนักเรียน ภาคเรียนที่ 1/2569"
              maxLength={120}
            />
            <div className="srcCharCount">{request_title.length}/120</div>
          </div>

          {/* รายละเอียด */}
          <div className="srcField">
            <label className="srcLabel">รายละเอียดโครงการ</label>
            <textarea
              className="srcTextarea"
              value={request_description}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="อธิบายวัตถุประสงค์ ที่ตั้งโรงเรียน หรือข้อมูลที่ผู้บริจาคควรทราบ..."
            />
          </div>

          {/* ภาพโครงการ */}
          <div className="srcField">
            <label className="srcLabel">ภาพโครงการ <span className="srcOpt">(ไม่บังคับ)</span></label>
            <div
              className={`srcDropzone ${dragOver ? "srcDropzoneOver" : ""} ${preview ? "srcDropzoneHasImage" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleImageChange(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById("srcFileInput").click()}
            >
              {preview ? (
                <>
                  <img className="srcPreviewImg" src={preview} alt="preview" />
                  <div className="srcPreviewOverlay">
                    <span>🔄 เปลี่ยนรูป</span>
                  </div>
                </>
              ) : (
                <div className="srcDropzoneContent">
                  <div className="srcDropzoneIcon">🖼️</div>
                  <div className="srcDropzoneText">วางรูปภาพที่นี่ หรือคลิกเพื่อเลือก</div>
                  <div className="srcDropzoneSub">รองรับ JPG, PNG, WEBP — ขนาดไม่เกิน 5MB</div>
                </div>
              )}
            </div>
            <input
              id="srcFileInput"
              type="file" accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleImageChange(e.target.files?.[0])}
            />
            {preview && (
              <button
                type="button" className="srcRemoveImg"
                onClick={(e) => { e.stopPropagation(); setImageFile(null); setPreview(null); }}
              >
                ✕ ลบรูป
              </button>
            )}
          </div>

          <button className="srcBtn" disabled={loading || !request_title.trim()} type="submit">
            {loading ? (
              <><span className="srcSpinner" /> กำลังบันทึก...</>
            ) : (
              <>บันทึกและไปเพิ่มรายชื่อนักเรียน →</>
            )}
          </button>

        </form>
      </div>

      {/* ── Right: Preview card ─────────────────────────── */}
      <div className="srcRight">
        <div className="srcPreviewCard">
          <div className="srcPreviewBadge">ตัวอย่างโครงการ</div>
          <div className="srcPreviewCardImg">
            {preview
              ? <img src={preview} alt="project" />
              : <div className="srcPreviewCardImgEmpty">🏫</div>
            }
          </div>
          <div className="srcPreviewCardBody">
            <div className="srcPreviewCardTitle">
              {request_title || <span className="srcPreviewPlaceholder">ชื่อโครงการของคุณ</span>}
            </div>
            <div className="srcPreviewCardDesc">
              {request_description || <span className="srcPreviewPlaceholder">รายละเอียดโครงการ...</span>}
            </div>
            <div className="srcPreviewCardStatus">
              <span className="srcPreviewDot" /> กำลังเปิดรับบริจาค
            </div>
          </div>
        </div>

        <div className="srcTips">
          <div className="srcTipsTitle">💡 เคล็ดลับ</div>
          <ul className="srcTipsList">
            <li>ใช้ชื่อโครงการที่บอกภาคเรียนและปีการศึกษาชัดเจน</li>
            <li>ใส่รูปภาพโรงเรียนหรือนักเรียนเพื่อเพิ่มความน่าเชื่อถือ</li>
            <li>อธิบายจำนวนนักเรียนและความต้องการโดยรวมในรายละเอียด</li>
          </ul>
        </div>
      </div>

    </div>
  );
}