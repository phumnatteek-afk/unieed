// backend/server/src/config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// เก็บไฟล์ใน memory แล้วค่อย stream ขึ้น Cloudinary เอง
const storage = multer.memoryStorage();

const uploadProductImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น"));
  },
}).fields(
  Array.from({ length: 10 }, (_, i) => ({ name: `item${i}_images`, maxCount: 4 }))
);

// helper — upload buffer ขึ้น Cloudinary
const uploadToCloudinary = (buffer, filename) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:         "unieed/products",
        public_id:      filename,
        transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto:good" }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

export { cloudinary, uploadProductImages, uploadToCloudinary };