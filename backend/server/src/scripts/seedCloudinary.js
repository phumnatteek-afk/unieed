import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { cloudinary } from "../config/cloudinary.js";
import "dotenv/config";
import { db } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- utils ---------------- */

async function uploadOne(localPath, folder) {
  if (!fs.existsSync(localPath)) {
    throw new Error(`File not found: ${localPath}`);
  }
  const res = await cloudinary.uploader.upload(localPath, {
    folder,
    resource_type: "image",
  });
  return { url: res.secure_url, public_id: res.public_id };
}

/**
 * ✅ กันซ้ำแบบไม่เพิ่มคอลัมน์
 * products ใช้ natural key: uniform_type_id + title + size
 */
async function findProductNaturalKey(p) {
  const [rows] = await db.query(
    `SELECT product_id
     FROM products
     WHERE uniform_type_id = ?
       AND product_title = ?
       AND size = ?
     LIMIT 1`,
    [p.uniform_type_id, p.title, p.size]
  );
  return rows[0] || null;
}

/**
 * ✅ กันซ้ำแบบไม่เพิ่มคอลัมน์
 * projects ใช้ natural key: school_id + title
 */
async function findProjectNaturalKey(p) {
  const [rows] = await db.query(
    `SELECT request_id
     FROM donation_request
     WHERE school_id = ?
       AND request_title = ?
     LIMIT 1`,
    [p.school_id, p.title]
  );
  return rows[0] || null;
}

/**
 * ดึง cover image ของ product (ถ้ามี) เพื่อไม่ต้องอัปโหลดซ้ำ
 */
async function getProductCoverImage(product_id) {
  const [rows] = await db.query(
    `SELECT image_url, public_id
     FROM product_images
     WHERE product_id = ?
     ORDER BY is_cover DESC, sort_order ASC, created_at ASC
     LIMIT 1`,
    [product_id]
  );
  return rows[0] || null;
}

/**
 * สร้าง/อัปเดตรูป cover ให้ product แบบ “ไม่ซ้ำ”
 * - ถ้ามีรูปเดิมแล้ว: ไม่ทำอะไร (กัน Cloudinary ซ้ำ)
 * - ถ้าไม่มีรูป: อัปโหลดแล้ว insert
 */
async function ensureProductCover(product_id, img, shouldInsert) {
  if (!shouldInsert) return; // ใน flow นี้ เราไม่เปลี่ยนรูปเมื่อพบของเดิม

  await db.query(
    `INSERT INTO product_images
      (product_id, image_url, public_id, is_cover, sort_order, created_at)
     VALUES (?,?,?,?,0,NOW())`,
    [product_id, img.url, img.public_id, 1]
  );
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
  {
    uniform_type_id: 4,
    title: "เสื้อนักเรียนเอกชน",
    description: "เสื้อนักเรียนหญิง แขนยาว",
    size: "L",
    condition: "ดี",
    price: 180,
    image: "p4.jpg",
  },
];

async function seedProducts() {
  const dir = path.join(__dirname, "../../seed-images/products");
  console.log("[seed products] dir:", dir);

  for (const p of PRODUCTS) {
    const existed = await findProductNaturalKey(p);

    if (!existed) {
      // ✅ ยังไม่มี -> อัปโหลดรูป + INSERT
      const imgPath = path.join(dir, p.image);
      const img = await uploadOne(imgPath, "unieed/products");

      const [r] = await db.query(
        `INSERT INTO products
          (uniform_type_id, product_title, product_description, size, \`condition\`,
           price, quantity, status, created_at)
         VALUES (?,?,?,?,?,?,1,'available',NOW())`,
        [p.uniform_type_id, p.title, p.description, p.size, p.condition, p.price]
      );

      const product_id = r.insertId;

      await ensureProductCover(product_id, img, true);

      console.log("✔ product inserted:", p.title, `(id=${product_id})`);
    } else {
      // ✅ มีอยู่แล้ว -> UPDATE เฉพาะข้อมูลสินค้า (ไม่เพิ่มแถวใหม่ / ไม่อัปโหลดรูปใหม่)
      await db.query(
        `UPDATE products
         SET uniform_type_id=?,
             product_title=?,
             product_description=?,
             size=?,
             \`condition\`=?,
             price=?
         WHERE product_id=?`,
        [
          p.uniform_type_id,
          p.title,
          p.description,
          p.size,
          p.condition,
          p.price,
          existed.product_id,
        ]
      );

      // ไม่แตะรูปเดิม เพื่อกัน Cloudinary ซ้ำ
      const cover = await getProductCoverImage(existed.product_id);
      if (!cover) {
        // กรณีพิเศษ: เคยมี product แต่ไม่มีรูป -> ค่อยอัปโหลดครั้งเดียว
        const imgPath = path.join(dir, p.image);
        const img = await uploadOne(imgPath, "unieed/products");
        await ensureProductCover(existed.product_id, img, true);
        console.log("↺ product updated + cover added:", p.title, `(id=${existed.product_id})`);
      } else {
        console.log("↺ product updated (no duplicate):", p.title, `(id=${existed.product_id})`);
      }
    }
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
    const existed = await findProjectNaturalKey(p);

    if (!existed) {
      // ✅ ยังไม่มี -> อัปโหลดรูป + INSERT
      const imgPath = path.join(dir, p.image);
      const img = await uploadOne(imgPath, "unieed/projects");

      await db.query(
        `INSERT INTO donation_request
          (school_id, request_title, request_description, request_image_url, status, created_at)
         VALUES (?,?,?,?, 'open', NOW())`,
        [p.school_id, p.title, p.description, img.url]
      );

      console.log("✔ project inserted:", p.title);
    } else {
      // ✅ มีอยู่แล้ว -> UPDATE (ไม่อัปโหลดรูปใหม่เพื่อกัน Cloudinary ซ้ำ)
      await db.query(
        `UPDATE donation_request
         SET school_id=?,
             request_title=?,
             request_description=?,
             status='open'
         WHERE request_id=?`,
        [p.school_id, p.title, p.description, existed.request_id]
      );

      // ถ้าอยาก “อัปเดตรูป” ด้วยแบบไม่ซ้ำ ต้องเพิ่ม logic เช็ค/ลบ public_id (ค่อนข้างยาว)
      console.log("↺ project updated (no duplicate):", p.title);
    }
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
