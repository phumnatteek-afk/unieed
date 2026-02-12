import { cloudinary } from "../../config/cloudinary.js";

function folderFromType(type) {
  if (type === "product") return "unieed/products";
  if (type === "project") return "unieed/projects";
  if (type === "school_doc") return "unieed/schools";
  return "unieed/misc";
}

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const type = String(req.query.type || "");
    const folder = folderFromType(type);

    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(b64, {
      folder,
      resource_type: "image",
    });

    return res.json({
      image_url: result.secure_url,
      public_id: result.public_id,
      folder,
    });
  } catch (err) {
    next(err);
  }
}
// ✅ เพิ่มใหม่: ใช้กับเอกสารโรงเรียน (คืน key ให้ตรงกับ DB)
export async function uploadSchoolDoc(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(b64, {
      folder: "unieed/school_docs",
      resource_type: "auto", // รองรับ pdf/jpg/png ฯลฯ
    });

    return res.json({
      school_doc_url: result.secure_url,
      school_doc_public_id: result.public_id,
    });
  } catch (err) {
    next(err);
  }
}
