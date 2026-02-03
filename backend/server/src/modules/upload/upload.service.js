import { cloudinary } from "../../config/cloudinary.js";

export async function uploadSchoolDoc(file) {
  if (!file) throw Object.assign(new Error("No file"), { status: 400 });

  const b64 = Buffer.from(file.buffer).toString("base64");
  const dataUri = `data:${file.mimetype};base64,${b64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "unieed/school_docs",
    resource_type: "auto"
  });

  return { url: result.secure_url, public_id: result.public_id };
}
