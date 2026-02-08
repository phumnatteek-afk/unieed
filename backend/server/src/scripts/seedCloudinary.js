import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { cloudinary } from "../config/cloudinary.js";
import "dotenv/config";
import { db } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- utils ---------------- */

function isImageFile(name) {
  return /\.(jpg|jpeg|png)$/i.test(name);
}

async function uploadOne(localPath, folder) {
  if (!fs.existsSync(localPath)) {
    throw new Error(`File not found: ${localPath}`);
  }

  const res = await cloudinary.uploader.upload(localPath, {
    folder, // เช่น "unieed/products" หรือ "unieed/projects"
    resource_type: "image",
  });

  return {
    url: res.secure_url,
    public_id: res.public_id,
  };
}

/* ---------------- seed products ---------------- */
/**
 * uniform_type_id อิงจากตาราง uniform_type ของคุณ:
 * 1 เสื้อเชิ้ตนักเรียนชาย
 * 2 เสื้อเชิ้ตนักเรียนหญิง
 * 3 กางเกงนักเรียนชาย
 * 4 กระโปรงนักเรียนหญิง
 */
const PRODUCTS = [
  {
    uniform_type_id: 1,
    title: "เสื้อนักเรียนชาย ตราสมอ",
    description: "โรงเรียนวิทยา",
    size: "M",
    condition: "มีจุดเปื้อน",
    price: 80,
    image: "p1.jpeg",
  },
  {
    uniform_type_id: 3,
    title: "กางเกงนักเรียนรัฐบาล",
    description: "โรงเรียนวิทยา",
    size: "L",
    condition: "",
    price: 80,
    image: "p2.jpeg",
  },
  {
    uniform_type_id: 3,
    title: "กางเกงนักเรียนเอกชน",
    description: "เสื้อนักเรียนหญิง แขนสั้น ใช้งานน้อย",
    size: "S",
    condition: "ดีมาก",
    price: 100,
    image: "p3.jpeg",
  },
];

async function seedProducts() {
  const dir = path.join(__dirname, "../../seed-images/products");
  console.log("[seed products] dir:", dir);

  for (const p of PRODUCTS) {
    const imgPath = path.join(dir, p.image);

    // อัปโหลด -> Cloudinary (จะสร้างโฟลเดอร์ unieed/products ให้อัตโนมัติ)
    const img = await uploadOne(imgPath, "unieed/products");

    // ✅ เพิ่ม uniform_type_id เข้าไป
    const [r] = await db.query(
      `INSERT INTO products
        (uniform_type_id, product_title, product_description, size, \`condition\`, price, quantity, status, created_at)
       VALUES (?,?,?,?,?,?,1,'available',NOW())`,
      [
        p.uniform_type_id,
        p.title,
        p.description,
        p.size,
        p.condition,
        p.price,
      ]
    );

    const product_id = r.insertId;

    await db.query(
      `INSERT INTO product_images
        (product_id, image_url, public_id, is_cover, sort_order, created_at)
       VALUES (?,?,?,?,0,NOW())`,
      [product_id, img.url, img.public_id, 1]
    );

    console.log("✔ product seeded:", p.title);
  }
}

/* ---------------- seed projects ---------------- */

const PROJECTS = [
  {
    school_id: 1,
    title: "ขอรับบริจาคชุดนักเรียน ปีการศึกษา 2569",
    description:
      "โรงเรียนบ้านหนองน้ำใส ต้องการชุดนักเรียนสำหรับนักเรียนระดับประถมศึกษา",
    image: "pj1.png",
  },
  {
    school_id: 2,
    title: "ขอรับบริจาคชุดนักเรียนหญิง ปีการศึกษา 2569",
    description: "โรงเรียนบ้านดอนมะตูม ขอรับชุดนักเรียนหญิง",
    image: "pj2.jpg", 
  },
  {
    school_id: 3,
    title: "ขอรับบริจาคชุดนักเรียนชายและหญิง ปีการศึกษา 2569",
    description: "โรงเรียนบ้านดอนขาไก่ ขาดแคลนชุดนักเรียนสำหรับปีการศึกษาใหม่",
    image: "pj3.jpg",
  },
  {
    school_id: 4,
    title: "ขอรับบริจาคชุดนักเรียนไม่จำกัดรูปแบบ เพื่อน้องบนดอย",
    description: "โครงการช่วยเหลือนักเรียนในพื้นที่ห่างไกล จังหวัดเชียงใหม่",
    image: "pj4.jpg",
  },
];

async function seedProjects() {
  const dir = path.join(__dirname, "../../seed-images/projects");
  console.log("[seed projects] dir:", dir);

  for (const p of PROJECTS) {
    const imgPath = path.join(dir, p.image);

    // อัปโหลด -> Cloudinary (จะสร้างโฟลเดอร์ unieed/projects ให้อัตโนมัติ)
    const img = await uploadOne(imgPath, "unieed/projects");

    await db.query(
      `INSERT INTO donation_request
        (school_id, request_title, request_description, request_image_url, status, created_at)
       VALUES (?,?,?,?, 'open', NOW())`,
      [p.school_id, p.title, p.description, img.url]
    );

    console.log("✔ project seeded:", p.title);
  }
}

/* ---------------- run ---------------- */

(async () => {
  try {
    console.log("=== Seed Cloudinary Start ===");
    await seedProducts();
    await seedProjects();
    console.log("=== Seed Completed ===");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
})();
