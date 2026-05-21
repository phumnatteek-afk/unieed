import { db } from "../../config/db.js";

// ── โครงการตามจังหวัด (สำหรับแท็บ "ใกล้ฉัน") ─────────────
export async function getProjectsByProvince(province) {
  if (!province) return [];
  const [rows] = await db.query(`
    SELECT
      dr.request_id,
      dr.school_id,
      dr.request_title,
      dr.request_description,
      dr.request_image_url,
      dr.status,
      dr.created_at,
      dr.start_date,
      dr.end_date,
      s.school_name,
      s.school_address,
      s.province AS school_province,
      COALESCE((
        SELECT SUM(don.quantity) FROM donation_record don
        WHERE don.request_id = dr.request_id AND don.status != 'rejected'
      ), 0) AS total_donated,
      COALESCE((
        SELECT SUM(don.quantity) FROM donation_record don
        WHERE don.request_id = dr.request_id AND don.status = 'approved'
          AND don.condition_status = 'usable'
      ), 0) AS total_received,
      COALESCE((
        SELECT SUM(f.quantity_fulfilled) FROM fulfillment f
        WHERE f.request_id = dr.request_id
      ), 0) AS total_fulfilled,
      COALESCE((
        SELECT SUM(sn.quantity_needed)
        FROM student_need sn
        JOIN students st ON st.student_id = sn.student_id
        WHERE st.request_id = dr.request_id
      ), 0) AS total_needed,
      (SELECT MAX(don2.created_at) FROM donation_record don2
       WHERE don2.request_id = dr.request_id AND don2.status != 'rejected'
      ) AS last_donation_at
    FROM donation_request dr
    JOIN schools s ON s.school_id = dr.school_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND s.verification_status = 'approved'
      AND s.province = ?
    ORDER BY dr.created_at DESC
    LIMIT 20
  `, [province]);
  return rows;
}

// ── จังหวัดที่ต้องการความช่วยเหลือมากสุด (public — ใช้ใน Homepage fallback) ──
export async function getHighDemandProvinces(excludeProvince = "", limit = 3) {
  const [provRows] = await db.query(`
    SELECT
      s.province,
      SUM(sn.quantity_needed - COALESCE(sn.quantity_received, 0)) AS still_needed
    FROM student_need sn
    JOIN students         st ON st.student_id  = sn.student_id
    JOIN donation_request dr ON dr.request_id  = st.request_id
    JOIN schools           s ON s.school_id    = dr.school_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND sn.quantity_needed > COALESCE(sn.quantity_received, 0)
      AND s.province IS NOT NULL AND s.province != ''
      AND s.province != ?
    GROUP BY s.province
    ORDER BY still_needed DESC
    LIMIT ?
  `, [excludeProvince || "", Number(limit) || 3]).catch(() => [[]]);

  if (!provRows.length) return [];

  // top items ต่อจังหวัด
  const topProvinces = provRows.map(r => r.province);
  const placeholders = topProvinces.map(() => "?").join(", ");
  const [itemRows] = await db.query(`
    SELECT
      s.province,
      ut.type_name,
      ut.gender,
      SUM(sn.quantity_needed - COALESCE(sn.quantity_received, 0)) AS still_needed
    FROM student_need sn
    JOIN students         st ON st.student_id  = sn.student_id
    JOIN donation_request dr ON dr.request_id  = st.request_id
    JOIN schools           s ON s.school_id    = dr.school_id
    JOIN uniform_type     ut ON ut.uniform_type_id = sn.uniform_type_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND sn.quantity_needed > COALESCE(sn.quantity_received, 0)
      AND s.province IN (${placeholders})
    GROUP BY s.province, ut.uniform_type_id, ut.type_name, ut.gender
    ORDER BY s.province, still_needed DESC
  `, topProvinces).catch(() => [[]]);

  const GENDER_LABEL = { male: "ชาย", female: "หญิง" };
  const itemMap = {};
  for (const r of (itemRows || [])) {
    if (!itemMap[r.province]) itemMap[r.province] = [];
    if (itemMap[r.province].length < 3) {
      const label = r.gender ? `${r.type_name} (${GENDER_LABEL[r.gender] || r.gender})` : r.type_name;
      itemMap[r.province].push({ type_name: r.type_name, gender: r.gender || null, label, still_needed: Number(r.still_needed || 0) });
    }
  }

  return provRows.map(r => ({
    province:     r.province,
    still_needed: Number(r.still_needed || 0),
    top_items:    itemMap[r.province] || [],
  }));
}

export async function getHomeData() {
  // 1) Stats
  const [[stats]] = await db.query(`
    SELECT
    (SELECT COUNT(*) FROM products WHERE status='available') AS products_total,
    (SELECT COUNT(*) FROM schools WHERE verification_status='approved') AS schools_approved,
    (SELECT COUNT(*) FROM students) AS students_total,
    (SELECT COALESCE(SUM(quantity), 0) FROM donation_record WHERE status = 'approved' AND condition_status = 'usable') AS uniforms_fulfilled,
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
      dr.start_date,
      dr.end_date,
      s.school_name,
      s.school_address,
      s.province AS school_province,

      -- ยอดบริจาคที่บันทึกเข้ามา (ผู้บริจาคส่งแล้ว)
      COALESCE((
        SELECT SUM(don.quantity)
        FROM donation_record don
        WHERE don.request_id = dr.request_id
          AND don.status != 'rejected'
      ), 0) AS total_donated,

      -- ยอดที่โรงเรียน approve แล้ว (all conditions)
      COALESCE((
        SELECT SUM(don.quantity)
        FROM donation_record don
        WHERE don.request_id = dr.request_id
          AND don.status = 'approved'
      ), 0) AS total_received,

      -- ยอดที่โรงเรียนยืนยันรับแล้ว
      COALESCE((
        SELECT SUM(f.quantity_fulfilled)
        FROM fulfillment f
        WHERE f.request_id = dr.request_id
      ), 0) AS total_fulfilled,

      -- ความต้องการรวมทั้งหมดของ request นี้
      COALESCE((
        SELECT SUM(sn.quantity_needed)
        FROM student_need sn
        JOIN students st ON st.student_id = sn.student_id
        WHERE st.request_id = dr.request_id
      ), 0) AS total_needed,

      -- ✅ เพิ่ม: นับนักเรียน very_urgent ต่อโครงการ
      (SELECT COUNT(*)
       FROM students st
       WHERE st.request_id = dr.request_id
         AND st.urgency = 'very_urgent') AS very_urgent_count,

      -- ✅ เพิ่ม: นับนักเรียน urgent ต่อโครงการ (ใช้ tiebreak)
      (SELECT COUNT(*)
       FROM students st
       WHERE st.request_id = dr.request_id
         AND st.urgency = 'urgent') AS urgent_count,

      -- ✅ เพิ่ม: นับนักเรียนทั้งหมดต่อโครงการ
      (SELECT COUNT(*)
       FROM students st
       WHERE st.request_id = dr.request_id) AS student_count,

      -- สำหรับ fairness modifier: วันที่ได้รับบริจาคล่าสุด
      (SELECT MAX(don.created_at)
       FROM donation_record don
       WHERE don.request_id = dr.request_id
         AND don.status != 'rejected') AS last_donation_at

    FROM donation_request dr
    JOIN schools s ON s.school_id = dr.school_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND s.verification_status = 'approved'
    LIMIT 80
  `);

  // 3) Closed/Archived projects
  const [closedProjects] = await db.query(`
    SELECT
      dr.request_id,
      dr.request_title,
      dr.request_image_url,
      dr.status,
      dr.end_date,
      dr.created_at,
      s.school_name,
      s.school_address,
      COALESCE((
        SELECT SUM(f.quantity_fulfilled)
        FROM fulfillment f
        WHERE f.request_id = dr.request_id
      ), 0) AS total_fulfilled,
      COALESCE((
        SELECT SUM(sn.quantity_needed)
        FROM student_need sn
        JOIN students st ON st.student_id = sn.student_id
        WHERE st.request_id = dr.request_id
      ), 0) AS total_needed
    FROM donation_request dr
    JOIN schools s ON s.school_id = dr.school_id
    WHERE dr.status IN ('closed', 'archived')
    ORDER BY dr.end_date DESC
    LIMIT 8
  `);

  // 4) Products (เอารูปแรก)
  const [products] = await db.query(`
  SELECT
  p.product_id,
  p.product_title,
  p.size,
  p.level,
  p.condition_percent,
  p.condition_label,
  p.price,
  p.quantity,
  p.school_name,
  p.custom_type_name,
  COALESCE(ut.type_name, p.custom_type_name) AS type_name,
  COALESCE(p.gender, ut.gender) AS gender,
  COALESCE(p.category_id, ci.category_id) AS category_id,
  ci.category_name,
  GROUP_CONCAT(pi.image_url ORDER BY pi.sort_order SEPARATOR '|||') AS image_urls
FROM products p
LEFT JOIN uniform_type ut ON ut.uniform_type_id = p.uniform_type_id
LEFT JOIN category_item ci ON ci.category_id = ut.category_id
LEFT JOIN product_images pi ON pi.product_id = p.product_id
WHERE p.status = 'available'
GROUP BY p.product_id, p.product_title, p.size, p.level,
         p.condition_percent, p.condition_label, p.price, p.quantity,
         p.school_name, p.custom_type_name, p.category_id, p.gender,
         ut.type_name, ut.gender,
         ci.category_id, ci.category_name
ORDER BY RAND()
LIMIT 4
`);

// แปลง image_urls เป็น array
const productsWithImages = products.map(p => ({
  ...p,
  images: p.image_urls
    ? p.image_urls.split('|||').map(url => ({ image_url: url }))
    : [],
}));

  // 4) Testimonials (FIX)
const [testimonials] = await db.query(`
  SELECT
    t.testimonial_id,
    t.school_id,
    COALESCE(s.school_name, 'ไม่ระบุโรงเรียน') AS school_name,
    t.review_title,
    t.review_text,
    DATE_FORMAT(t.review_date, '%e %b. %Y') AS review_date,
    t.image_url,
    u.user_name AS recorded_by_name
  FROM testimonials t
  LEFT JOIN schools s ON s.school_id = t.school_id
  LEFT JOIN users u ON u.user_id = t.recorded_by_user_id
  WHERE t.is_published = 1
  ORDER BY t.review_date DESC
  LIMIT 10
`);
return { stats, projects, closed_projects: closedProjects, products: productsWithImages, testimonials };
}
