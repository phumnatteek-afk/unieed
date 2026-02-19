
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

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
  if (!imageFile) return null;

  const formData = new FormData();
  formData.append("file", imageFile); // ✅ ต้องเป็น "file"

  const res = await fetch("http://localhost:3000/upload/image?type=project", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "อัปโหลดรูปไม่สำเร็จ");

  // ✅ controller คืน { image_url, public_id }
  return data;
};
  const onSubmit = async (e) => {
    e.preventDefault();

    if (!request_title.trim()) {
      setErr("กรุณากรอกชื่อโครงการ");
      return;
    }

    try {
      setErr("");
      setLoading(true);

      let imageData = null;
      if (imageFile) imageData = await uploadImage();

      const created = await postJson(
        "/school/projects",
        {
    request_title,
    request_description,
    request_image_url: imageData?.image_url || null,      // ✅ ใช้ image_url
    request_image_public_id: imageData?.public_id || null,
  },
  true
);

      nav(`/school/projects/${created.request_id}`);
    } catch (e2) {
      setErr(e2?.data?.message || e2.message || "สร้างโครงการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="srpPage">
      <div className="srpCard">
        <h2 className="srpTitle">สร้างโครงการขอรับบริจาค</h2>

        {err && <div className="srpError">{err}</div>}

        <form onSubmit={onSubmit} className="srpForm">
          <div className="srpField">
            <label className="srpLabel">
              ชื่อโครงการ <span className="srpReq">*</span>
            </label>
            <input
              className="srpInput"
              value={request_title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ขอรับบริจาคชุดนักเรียน ภาคเรียนที่ 1/2569"
            />
          </div>

          <div className="srpField">
            <label className="srpLabel">รายละเอียด</label>
            <textarea
              className="srpTextarea"
              value={request_description}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="อธิบายวัตถุประสงค์ของโครงการ..."
            />
          </div>

          <div className="srpField">
            <label className="srpLabel">ภาพโครงการ (ไม่บังคับ)</label>
            <input className="srpFile" type="file" accept="image/*" onChange={handleImageChange} />

            {preview && (
              <div className="srpPreviewWrap">
                <img className="srpPreviewImg" src={preview} alt="preview" />
              </div>
            )}
          </div>

          <button className="srpBtn" disabled={loading} type="submit">
            {loading ? "กำลังบันทึก..." : "บันทึกและไปเพิ่มรายชื่อนักเรียน"}
          </button>
        </form>
      </div>
    </div>
  );
}
