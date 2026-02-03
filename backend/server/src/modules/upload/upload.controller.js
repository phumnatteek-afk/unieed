import cloudinary from "../../config/cloudinary.js";


export async function uploadSchoolDoc(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(b64, {
      folder: "unieed/school_docs",
      resource_type: "auto",
    });

    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    next(err);
  }
}
