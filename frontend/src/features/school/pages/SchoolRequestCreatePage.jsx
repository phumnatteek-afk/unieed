import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { postJson } from "../../../api/http.js";
import "../styles/schoolRequestCreate.css";

export default function SchoolRequestCreatePage() {
  const nav = useNavigate();
  const { token } = useAuth();

  const [request_title, setTitle] = useState("");
  const [request_description, setDesc] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const todayIso = new Date().toISOString().split("T")[0];

  // วันเริ่มโครงการ — default วันนี้
  const [startDate, setStartDate] = useState(todayIso);
  // ระยะเวลา — default 3 เดือน
  const [durationMonths, setDurationMonths] = useState(3);

  // คำนวณ end_date = startDate + durationMonths
  const calcEndDate = (start, months) => {
    if (!start) return "";
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };
  const endDate = calcEndDate(startDate, durationMonths);

  const formatThaiDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  };

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
      headers: { Authorization: `Bearer ${token}` },
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
        start_date: startDate,
        end_date: endDate,
        request_image_url: imageData?.image_url || null,
        request_image_public_id: imageData?.public_id || null,
      }, true);
      nav(`/school/projects/${created.request_id}`, { state: { newProject: true } });
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
          <div className="srcHeaderIcon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256"><path fill="#fff" d="M230.33 141.06a24.34 24.34 0 0 0-18.61-4.77C230.5 117.33 240 98.48 240 80c0-26.47-21.29-48-47.46-48A47.58 47.58 0 0 0 156 48.75A47.58 47.58 0 0 0 119.46 32C93.29 32 72 53.53 72 80c0 11 3.24 21.69 10.06 33a31.87 31.87 0 0 0-14.75 8.4L44.69 144H16a16 16 0 0 0-16 16v40a16 16 0 0 0 16 16h104a8 8 0 0 0 1.94-.24l64-16a7 7 0 0 0 1.19-.4L226 182.82l.44-.2a24.6 24.6 0 0 0 3.93-41.56ZM119.46 48a31.15 31.15 0 0 1 29.14 19a8 8 0 0 0 14.8 0a31.15 31.15 0 0 1 29.14-19C209.59 48 224 62.65 224 80c0 19.51-15.79 41.58-45.66 63.9l-11.09 2.55A28 28 0 0 0 140 112h-39.32C92.05 100.36 88 90.12 88 80c0-17.35 14.41-32 31.46-32M16 160h24v40H16Zm203.43 8.21l-38 16.18L119 200H56v-44.69l22.63-22.62A15.86 15.86 0 0 1 89.94 128H140a12 12 0 0 1 0 24h-28a8 8 0 0 0 0 16h32a8.3 8.3 0 0 0 1.79-.2l67-15.41l.31-.08a8.6 8.6 0 0 1 6.3 15.9Z"/></svg>
          </div>
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

          {/* ระยะเวลาโครงการ */}
          <div className="srcField">
            <label className="srcLabel">
              ระยะเวลาโครงการ <span className="srcReq">*</span>
            </label>

            {/* วันเริ่มต้น */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 500 }}>วันเริ่มต้นโครงการ</div>
              <input
                type="date"
                value={startDate}
                min={todayIso}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1.5px solid #E5E7EB", fontSize: 14,
                  color: "#1a1a2e", background: "#F9FAFB",
                  boxSizing: "border-box", outline: "none",
                }}
              />
            </div>

            {/* ระยะเวลา quick-select */}
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500 }}>ระยะเวลา</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "3 เดือน", months: 3 },
                { label: "6 เดือน", months: 6 },
                { label: "1 ปี",    months: 12 },
              ].map(({ label, months }) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setDurationMonths(months)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 10,
                    border: durationMonths === months ? "2px solid #5285e8" : "1.5px solid #E5E7EB",
                    background: durationMonths === months ? "#EFF6FF" : "#F9FAFB",
                    color: durationMonths === months ? "#5285e8" : "#6b7280",
                    fontWeight: durationMonths === months ? 700 : 500,
                    fontSize: 13, cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* แสดงวันสิ้นสุดที่คำนวณอัตโนมัติ */}
            {endDate && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10,
                background: "#EFF6FF", border: "1.5px solid #c7d9f8",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#5285e8" d="M19 4h-2V3a1 1 0 0 0-2 0v1H9V3a1 1 0 0 0-2 0v1H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3m1 15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7h16Zm0-9H4V7a1 1 0 0 1 1-1h2v1a1 1 0 0 0 2 0V6h6v1a1 1 0 0 0 2 0V6h2a1 1 0 0 1 1 1Z"/></svg>
                <span style={{ fontSize: 13, color: "#4b6cb7" }}>
                  โครงการจะดำเนินการ{" "}
                  <strong>{formatThaiDate(startDate)}</strong>
                  {" → "}
                  <strong style={{ color: "#5285e8" }}>{formatThaiDate(endDate)}</strong>
                </span>
              </div>
            )}
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
                    <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4V2.21c0-.45-.54-.67-.85-.35l-2.8 2.79c-.2.2-.2.51 0 .71l2.79 2.79c.32.31.86.09.86-.36V6c3.31 0 6 2.69 6 6c0 .79-.15 1.56-.44 2.25c-.15.36-.04.77.23 1.04c.51.51 1.37.33 1.64-.34c.37-.91.57-1.91.57-2.95c0-4.42-3.58-8-8-8m0 14c-3.31 0-6-2.69-6-6c0-.79.15-1.56.44-2.25c.15-.36.04-.77-.23-1.04c-.51-.51-1.37-.33-1.64.34C4.2 9.96 4 10.96 4 12c0 4.42 3.58 8 8 8v1.79c0 .45.54.67.85.35l2.79-2.79c.2-.2.2-.51 0-.71l-2.79-2.79a.5.5 0 0 0-.85.36z"/></svg>
                      เปลี่ยนรูป
                    </span>
                  </div>
                  <button
                    type="button"
                    className="srcRemoveImgCorner"
                    onClick={(e) => { e.stopPropagation(); setImageFile(null); setPreview(null); }}
                  >✕</button>
                </>
              ) : (
                <div className="srcDropzoneContent">
                  <div className="srcDropzoneIcon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 48 48"><g fill="none"><path fill="#5285e8" d="M44 24a2 2 0 1 0-4 0zM24 8a2 2 0 1 0 0-4zm15 32H9v4h30zM8 39V9H4v30zm32-15v15h4V24zM9 8h15V4H9zm0 32a1 1 0 0 1-1-1H4a5 5 0 0 0 5 5zm30 4a5 5 0 0 0 5-5h-4a1 1 0 0 1-1 1zM8 9a1 1 0 0 1 1-1V4a5 5 0 0 0-5 5z"/><path stroke="#5285e8" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="m6 35l10.693-9.802a2 2 0 0 1 2.653-.044L32 36m-4-5l4.773-4.773a2 2 0 0 1 2.615-.186L42 31M30 12h12m-6-6v12"/></g></svg>
                  </div>
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
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="#6b7280" d="M19 4h-2V3a1 1 0 0 0-2 0v1H9V3a1 1 0 0 0-2 0v1H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3m1 15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7h16Zm0-9H4V7a1 1 0 0 1 1-1h2v1a1 1 0 0 0 2 0V6h6v1a1 1 0 0 0 2 0V6h2a1 1 0 0 1 1 1Z"/></svg>
              {formatThaiDate(startDate)} → {formatThaiDate(endDate)}
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