import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cloudinary } from "../config/cloudinary.js";
import { db } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// โฟลเดอร์รูป: backend/server/seed-images/testimonials
const IMAGE_DIR = path.join(__dirname, "../../seed-images/testimonials");

const SEED_DATA = [
  {
    school_name: "โรงเรียนบ้านห้วยน้ำใส",
    review_title: "โรงเรียนได้รับชุดแล้ว !",
    review_text: "เด็ก ๆ ดีใจมาก ขอบคุณทุกการแบ่งปันที่ส่งต่อโอกาสทางการศึกษาให้กับนักเรียนของเรา",
    review_date: "2025-02-05",
    file: "ts1.png",
  },
  {
    school_name: "โรงเรียนวัดศรีสว่าง",
    review_title: "ขอบคุณจากใจโรงเรียน",
    review_text: "การได้รับชุดนักเรียนช่วยลดภาระค่าใช้จ่ายของผู้ปกครองได้อย่างมาก",
    review_date: "2025-02-07",
    file: "ts2.png",
  },
  {
    school_name: "โรงเรียนบ้านหนองไผ่",
    review_title: "เด็ก ๆ มีกำลังใจขึ้นมาก",
    review_text: "นักเรียนมีกำลังใจในการมาเรียนมากขึ้น ขอขอบคุณทุกการสนับสนุนจากทุกคน",
    review_date: "2025-02-10",
    file: "ts3.png",
  },
];

async function uploadImage(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "unieed/testimonials",
    resource_type: "image",
  });
  return {
    image_url: result.secure_url,
    image_public_id: result.public_id,
  };
}

async function seedTestimonials() {
  console.log("=== Seed Testimonials Start ===");
  console.log("IMAGE_DIR =", IMAGE_DIR);

  if (!fs.existsSync(IMAGE_DIR)) {
    throw new Error(`Image dir not found: ${IMAGE_DIR}`);
  }

  // (ทางเลือก) ล้างของเก่าก่อน seed ใหม่
  // await db.query(`DELETE FROM testimonials`);

  for (const item of SEED_DATA) {
    const fullPath = path.join(IMAGE_DIR, item.file);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing image file: ${fullPath}`);
    }

    console.log("Uploading:", item.file);
    const { image_url, image_public_id } = await uploadImage(fullPath);

    // รองรับตารางของคุณที่มี review_title (จากรูป phpMyAdmin)
    await db.query(
      `INSERT INTO testimonials
        (school_name, review_title, review_text, review_date, image_url, image_public_id, is_published)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        item.school_name,
        item.review_title,
        item.review_text,
        new Date(item.review_date),
        image_url,
        image_public_id,
      ]
    );

    console.log("Inserted:", item.school_name);
  }

  console.log("=== Seed Testimonials Done ===");
}

seedTestimonials()
  .then(async () => {
    try {
      // ปิด connection ให้จบจริง (กันค้าง)
      if (db?.end) await db.end();
    } catch {}
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed testimonials error:", err);
    try {
      if (db?.end) await db.end();
    } catch {}
    process.exit(1);
  });
