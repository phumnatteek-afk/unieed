import { db } from "../../config/db.js";

export async function getHomeData() {
  // 1) Stats
  const [[stats]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE status='available') AS products_total,
      (SELECT COUNT(*) FROM schools WHERE verification_status='approved') AS schools_approved,
      0 AS total_paid
  `);

  // 2) Projects
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
      COALESCE(SUM(ri.quantity_fulfilled), 0) AS total_fulfilled
    FROM donation_request dr
    JOIN schools s ON s.school_id = dr.school_id
    LEFT JOIN request_item ri ON ri.request_id = dr.request_id
    WHERE dr.status = 'open'
    GROUP BY
      dr.request_id, dr.school_id, dr.request_title, dr.request_description,
      dr.request_image_url, dr.status, dr.created_at,
      s.school_name, s.school_address
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
