// src/pages/school/EditProjectPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getJson, request } from "../../../api/http.js";
import "../styles/EditProjectPage.css";

function projectStatusMeta(status) {
  const s = String(status || "").toLowerCase();
  switch (s) {
    case "open":
      return { label: "กำลังเปิดรับบริจาค", dotClass: "dotGreen" };
    case "closed":
      return { label: "ปิดรับบริจาคแล้ว", dotClass: "dotGray" };
    case "paused":
      return { label: "พักโครงการชั่วคราว", dotClass: "dotYellow" };
    case "draft":
      return { label: "ฉบับร่าง", dotClass: "dotBlue" };
    default:
      return { label: s ? `สถานะ: ${s}` : "ไม่ทราบสถานะ", dotClass: "dotGray" };
  }
}

export default function EditProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(""); // URL after upload
  const [status, setStatus] = useState("open");

  const [uploading, setUploading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const meta = useMemo(() => projectStatusMeta(status), [status]);

  const formattedDate = project?.created_at
    ? new Date(project.created_at).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

  const canSave = !!title.trim() && !uploading;

  const loadProject = async () => {
    const data = await getJson(`/school/projects/${id}`, true);
    return data;
  };

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const data = await loadProject();

        if (!data) {
          setProject(null);
          setErr("ไม่พบโครงการ");
          return;
        }

        setProject(data);
        setTitle(data.request_title || "");
        setDescription(data.request_description || "");
        setImage(data.request_image_url || "");
        setStatus(data.status || "open");
      } catch (e) {
        setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ✅ upload image -> POST /school/projects/:id/image
  const uploadImage = async (file) => {
    if (!file) return;

    // กันไฟล์ใหญ่/แปลก ๆ นิดหน่อย (ไม่บังคับ)
    if (!file.type.startsWith("image/")) {
      setErr("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    setErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);

      // ใช้ BASE_URL เดียวกับ api/http.js (ดึงจาก env ถ้าคุณมี)
      // ถ้า api/http.js มี BASE_URL ภายใน แต่ไม่ export, ให้ใส่ตรงนี้เป็น backend ของคุณ
      const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

      const token = localStorage.getItem("token");

      const res = await fetch(`${BASE}/school/projects/${id}/image`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");

      // ✅ เอา url ที่ได้มาใส่ preview ทันที
      setImage(data.url || "");
    } catch (e) {
      setErr(e?.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!canSave) return;

    try {
      setErr("");

      await request(`/school/projects/${id}`, {
        method: "PUT",
        body: {
          request_title: title.trim(),
          request_description: description || null,
          request_image_url: image || null, // ✅ จะเป็น url จาก upload
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

  if (loading) {
    return (
      <div className="epPage">
        <div className="epLeft">กำลังโหลด...</div>
        <div className="epRight" />
      </div>
    );
  }

  if (err && !project) {
    return (
      <div className="epPage">
        <div className="epLeft">
          <h2>แก้ไขข้อมูลโครงการ</h2>
          <div className="epError">{err}</div>
          <div className="epActions">
            <button className="epBtn epBtnGhost" type="button" onClick={() => navigate(-1)}>
              ย้อนกลับ
            </button>
          </div>
        </div>
        <div className="epRight" />
      </div>
    );
  }

  return (
    <div className="epPage">
      {/* ===== LEFT: Form ===== */}
      <div className="epLeft">
        <h2>แก้ไขข้อมูลโครงการ</h2>

        {err ? <div className="epError">{err}</div> : null}

        {/* ✅ แสดงชื่อโรงเรียน + ที่อยู่ (read-only) */}
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
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น ขอรับบริจาคชุดนักเรียน ปี 2569"
          />
        </div>

        <div className="epField">
          <label>รายละเอียด</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="อธิบายรายละเอียดโครงการ เช่น กลุ่มเป้าหมาย จำนวนชุดที่ต้องการ เงื่อนไขการรับ ฯลฯ"
          />
        </div>

        {/* ✅ เปลี่ยนเป็นอัปโหลดรูป */}
        <div className="epField">
          <label>รูปภาพโครงการ</label>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadImage(f);
            }}
          />
          <div className="epHint">
            {uploading ? "กำลังอัปโหลดรูป..." : "เลือกไฟล์รูปเพื่ออัปโหลด (ระบบจะเก็บใน Cloudinary)"}
          </div>

          {/* ถ้าอยากให้ยังคงแก้ URL ได้ด้วย ก็เก็บช่องนี้ไว้ */}
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 8 }}>
              หรือวางลิงก์รูป (URL)
            </label>
            <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {/* <div className="epField">
          <label>สถานะโครงการ</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={uploading}>
            <option value="open">เปิดรับบริจาค</option>
            <option value="paused">พักโครงการชั่วคราว</option>
            <option value="closed">ปิดรับบริจาค</option>
            <option value="draft">ฉบับร่าง</option>
          </select>
        </div> */}

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

              {/* ถ้าคุณอยาก “เอาสถานะออกทั้งหมด” ให้ลบ badgeRow นี้ได้ */}
              {/* <div className="badgeRow">
                <span className="badge">
                  <span className={`badgeDot ${meta.dotClass}`} />
                  {meta.label}
                </span>
              </div> */}
            </div>

            <div className="cardBody">
              {/* ✅ โรงเรียน + ที่อยู่ */}
              <div className="cardSchool">{project?.school_name || "-"}</div>
              <div className="cardTitle">{title || "ชื่อโครงการ"}</div>
              <div className="cardDesc">{description || "รายละเอียดโครงการจะแสดงตรงนี้..."}</div>
              <div className="cardAddr">ที่ตั้ง: {project?.school_address || "-"}</div>


              <div className="cardMeta">
                <span>สร้างเมื่อ: {formattedDate}</span>
                {/* ✅ สถานะโครงการ “ออก” จาก meta */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
