import { db } from "../../config/db.js";

export async function getHomeData() {
  // 1) Stats
  const [[stats]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE status='available') AS products_total,
      (SELECT COUNT(*) FROM schools WHERE verification_status='approved') AS schools_approved,
      (SELECT COUNT(*) FROM students) AS students_total,

      -- ชุดที่ส่งต่อแล้ว = โรงเรียนยืนยันรับของแล้ว (fulfillment)
      (SELECT COALESCE(SUM(quantity_fulfilled), 0) FROM fulfillment) AS uniforms_fulfilled,

      -- ยอดบริจาคทั้งหมด = จำนวนรายการที่ผู้บริจาคบันทึกเข้ามา
      (SELECT COUNT(*) FROM donation_record WHERE status != 'rejected') AS donations_total
  `);

  // 2) Projects — ดึง total_donated จาก donation_record และ total_fulfilled จาก fulfillment
  const [projects] = await db.query(`
    SELECT
      dr.request_id,
      dr.school_id,
      dr.request_title,
      dr.request_description,
      dr.request_image_url,
      dr.status,
      dr.created_at,
      s.school_name,
      s.school_address,

      -- ยอดบริจาคที่บันทึกเข้ามา (ผู้บริจาคส่งแล้ว)
      COALESCE((
        SELECT SUM(don.quantity)
        FROM donation_record don
        WHERE don.request_id = dr.request_id
          AND don.status != 'rejected'
      ), 0) AS total_donated,

      -- ยอดที่โรงเรียนยืนยันรับแล้ว
      COALESCE((
        SELECT SUM(f.quantity_fulfilled)
        FROM fulfillment f
        WHERE f.request_id = dr.request_id
      ), 0) AS total_fulfilled,

      -- ความต้องการรวมทั้งหมดของ request นี้
      COALESCE((
        SELECT SUM(ri.quantity)
        FROM request_item ri
        WHERE ri.request_id = dr.request_id
      ), 0) AS total_needed

    FROM donation_request dr
    JOIN schools s ON s.school_id = dr.school_id
    WHERE dr.status = 'open'
    ORDER BY dr.created_at DESC
    LIMIT 10
  `);

  // 3) Products (เอารูปแรก)
  const [products] = await db.query(`
    SELECT
      p.product_id,
      p.product_title,
      p.size AS size_label,
      p.\`condition\`,
      p.condition_percent,
      p.price,
      pi.image_url AS cover_image
    FROM products p
    LEFT JOIN (
      SELECT t.product_id, t.image_url
      FROM product_images t
      JOIN (
        SELECT product_id, MIN(image_id) AS min_image_id
        FROM product_images
        GROUP BY product_id
      ) x ON x.product_id = t.product_id AND x.min_image_id = t.image_id
    ) pi ON pi.product_id = p.product_id
    WHERE p.status='available'
    ORDER BY p.created_at DESC
    LIMIT 12
  `);

  // 4) Testimonials (FIX)
const [testimonials] = await db.query(`
  SELECT
    t.testimonial_id,
    t.school_id,
    COALESCE(s.school_name, 'ไม่ระบุโรงเรียน') AS school_name,
    t.review_title,
    t.review_text,
    DATE_FORMAT(t.review_date, '%e %b. %Y') AS review_date,
    t.image_url
  FROM testimonials t
  LEFT JOIN schools s ON s.school_id = t.school_id
  WHERE t.is_published = 1
  ORDER BY t.review_date DESC
  LIMIT 10
`);

  return { stats, projects, products, testimonials };
}
