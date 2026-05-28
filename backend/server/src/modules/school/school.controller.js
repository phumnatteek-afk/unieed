import { getSchoolMe, syncProjectFeedStatus } from "./school.service.js";
import { db } from "../../config/db.js";
import { cloudinary } from "../../config/cloudinary.js"; // ปรับ path ตามจริง
 
export async function schoolMe(req, res, next) {
  try {
    const user_id = req.user.user_id; // ต้องมาจาก middleware auth
    const me = await getSchoolMe(user_id);
    res.json(me);
  }
  catch (err) {
    next(err);
  }
}
 
export async function getProjectByIdPublic(req, res, next) {
  try {
    const request_id = Number(req.params.request_id);
 
    // ── Query 1: ข้อมูลหลัก ──────────────────────────────────
    const [rows] = await db.query(
      `SELECT
         dr.request_id,
         dr.school_id,
         dr.request_title,
         dr.request_description,
         dr.request_image_url,
         dr.status,
         dr.created_at,
         dr.start_date,
         dr.end_date,
         dr.duration_months,
         s.school_name,
         s.school_address        AS school_full_address,
         s.school_phone,
         s.school_logo_url,
         (SELECT u.user_email FROM users u
          WHERE u.school_id = dr.school_id
            AND u.role = 'school_admin'
          ORDER BY u.user_id ASC LIMIT 1) AS school_email,
         (SELECT u.user_name FROM users u
          WHERE u.school_id = dr.school_id
            AND u.role = 'school_admin'
          ORDER BY u.user_id ASC LIMIT 1) AS contact_person,
         (SELECT COUNT(*) FROM students st
          WHERE st.request_id = dr.request_id) AS student_count,
         (SELECT COALESCE(SUM(sn.quantity_needed), 0)
          FROM student_need sn
          JOIN students st ON st.student_id = sn.student_id
          WHERE st.request_id = dr.request_id) AS total_needed,
         (SELECT COALESCE(SUM(f.quantity_fulfilled), 0)
          FROM fulfillment f
          WHERE f.request_id = dr.request_id) AS total_fulfilled,
         (SELECT COALESCE(SUM(f2.quantity_fulfilled), 0)
          FROM fulfillment f2
          WHERE f2.request_id = dr.request_id) AS total_received,
         (SELECT COALESCE(SUM(don.quantity), 0)
          FROM donation_record don
          WHERE don.request_id = dr.request_id
            AND don.status = 'pending') AS total_pending,
         (SELECT COUNT(DISTINCT don.donor_id)
          FROM donation_record don
          WHERE don.request_id = dr.request_id
            AND don.status != 'rejected'
            AND don.donor_id IS NOT NULL) AS donor_count
       FROM donation_request dr
       JOIN schools s ON s.school_id = dr.school_id
       WHERE dr.request_id = ?
       LIMIT 1`,
      [request_id]
    );
 
    if (!rows[0]) return res.json(null);
 
    const project = {
      ...rows[0],
      school_address: rows[0].school_full_address,
      total_needed: Number(rows[0].total_needed) || 0,
      total_fulfilled: Number(rows[0].total_fulfilled) || 0,
      total_received: Number(rows[0].total_received) || 0,
      total_pending: Number(rows[0].total_pending) || 0,
      student_count: Number(rows[0].student_count) || 0,
      donor_count: Number(rows[0].donor_count) || 0,
      uniform_items: [],   // ✅ default ก่อน กัน undefined
    };
 
    const { school_id } = project;
 
    // ── Query 2: uniform_items ────────────────────────────────
    // แยก try/catch เพื่อกันไม่ให้ crash ทั้งหน้า
    try {
  const [items] = await db.query(
    `SELECT
       ut.uniform_type_id,
       ut.type_name AS name,
       ut.gender,
       ut.uniform_category,
       sn.size,
       st.education_level_group AS education_level,
       SUM(sn.quantity_needed) AS quantity,
       MAX(
         CASE
           WHEN uti_exact.image_url IS NOT NULL THEN uti_exact.image_url
           WHEN uti_all.image_url IS NOT NULL THEN uti_all.image_url
           WHEN uti_sys.image_url IS NOT NULL THEN uti_sys.image_url
           WHEN ut.default_image_url IS NOT NULL THEN ut.default_image_url
         END
       ) AS image_url,
       MAX(
         CASE
           WHEN uti_exact.uniform_subtype_name IS NOT NULL 
                AND uti_exact.uniform_subtype_name != ''
             THEN uti_exact.uniform_subtype_name
           WHEN uti_all.uniform_subtype_name IS NOT NULL 
                AND uti_all.uniform_subtype_name != ''
             THEN uti_all.uniform_subtype_name
           ELSE NULL
         END
       ) AS uniform_subtype_name
     FROM student_need sn
     JOIN students st ON st.student_id = sn.student_id
                       AND st.request_id = ?
     JOIN uniform_type ut ON ut.uniform_type_id = sn.uniform_type_id
     LEFT JOIN uniform_type_images uti_exact
       ON uti_exact.uniform_type_id = sn.uniform_type_id
       AND uti_exact.school_id = ?
       AND uti_exact.request_id = ?
       AND uti_exact.education_level = st.education_level_group
     LEFT JOIN uniform_type_images uti_all
       ON uti_all.uniform_type_id = sn.uniform_type_id
       AND uti_all.school_id = ?
       AND uti_all.request_id = ?
       AND uti_all.education_level IS NULL
     LEFT JOIN uniform_type_images uti_sys
  ON uti_sys.uniform_type_id = sn.uniform_type_id
  AND uti_sys.school_id IS NULL
  AND uti_sys.request_id IS NULL
  AND uti_sys.education_level = CASE
    WHEN st.education_level_group IN ('อนุบาล','kg','Kindergarten') THEN 'อนุบาล'
    WHEN st.education_level_group REGEXP '^ป\\.|ประถม' THEN 'ประถมศึกษา'
    WHEN st.education_level_group REGEXP '^ม\\.[4-6]|มัธยมปลาย' THEN 'มัธยมตอนปลาย'
    WHEN st.education_level_group REGEXP '^ม\\.|มัธยม' THEN 'มัธยมตอนต้น'
    ELSE st.education_level_group
  END
     GROUP BY
       ut.uniform_type_id, ut.type_name, ut.gender,
       ut.uniform_category,
       sn.size, st.education_level_group
     ORDER BY
       ut.uniform_type_id ASC,
       st.education_level_group ASC,
       sn.size ASC`,
    [request_id, school_id, request_id, school_id, request_id]
  );
 
  // 🔹 map จาก student_need
  project.uniform_items = (items || []).map(i => {
    let sizeObj = null;
    if (i.size) {
      try {
        sizeObj = typeof i.size === "string" ? JSON.parse(i.size) : i.size;
      } catch {
        sizeObj = i.size;
      }
    }
 
    return {
      uniform_type_id: i.uniform_type_id,
      name: i.name,
      // ✅ uniform_subtype_name = ชื่อที่โรงเรียนกรอก (NULL ถ้าใช้ default)
      uniform_subtype_name: i.uniform_subtype_name || null,
      gender: i.gender,
      uniform_category: i.uniform_category || null,
      size: sizeObj,
      education_level: i.education_level || null,
      quantity: Number(i.quantity) || 0,
      image_url: i.image_url || null,
    };
  });
 
  // คำนวณ quantity_remaining per (type, size) จาก items_condition_snapshot
  try {
    const [approvedDons] = await db.query(
      `SELECT items_snapshot, items_condition_snapshot, condition_status
       FROM donation_record
       WHERE request_id = ? AND status = 'approved'`,
      [request_id]
    );
    const parseJ = (v) => { try { return typeof v === "string" ? JSON.parse(v) : (v || null); } catch { return null; } };
    const normSize = (s) => {
      if (!s) return "null";
      let obj;
      if (typeof s === "string") { try { obj = JSON.parse(s); } catch { return s; } }
      else { obj = s; }
      if (!obj || typeof obj !== "object") return String(obj);
      const cleaned = Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "")
      );
      return Object.keys(cleaned).length ? JSON.stringify(cleaned) : "null";
    };
    const snapKey = (typeId, size) => `${typeId}__${normSize(size)}`;

    // fulfilledByTypeSize = exact (typeId__size), fulfilledByType = no-size pool
    const fulfilledByTypeSize = {};
    const fulfilledByType = {};

    for (const d of approvedDons) {
      const condSnap = parseJ(d.items_condition_snapshot);
      if (Array.isArray(condSnap) && condSnap.length > 0) {
        for (const it of condSnap) {
          if (it.item_condition === "usable") {
            const sizeStr = normSize(it.size);
            if (sizeStr === "null") {
              const tid = String(it.uniform_type_id);
              fulfilledByType[tid] = (fulfilledByType[tid] || 0) + Number(it.qty_received || 0);
            } else {
              const k = `${it.uniform_type_id}__${sizeStr}`;
              fulfilledByTypeSize[k] = (fulfilledByTypeSize[k] || 0) + Number(it.qty_received || 0);
            }
          }
        }
      } else if (d.condition_status === "usable") {
        const snap = parseJ(d.items_snapshot);
        if (Array.isArray(snap)) {
          for (const it of snap) {
            const sizeStr = normSize(it.size);
            if (sizeStr === "null") {
              const tid = String(it.uniform_type_id);
              fulfilledByType[tid] = (fulfilledByType[tid] || 0) + Number(it.quantity || 0);
            } else {
              const k = `${it.uniform_type_id}__${sizeStr}`;
              fulfilledByTypeSize[k] = (fulfilledByTypeSize[k] || 0) + Number(it.quantity || 0);
            }
          }
        }
      }
    }

    // คำนวณ total qty needed per type สำหรับ proportional fallback
    const typeQtyNeeded = {};
    for (const item of project.uniform_items) {
      const tid = String(item.uniform_type_id);
      typeQtyNeeded[tid] = (typeQtyNeeded[tid] || 0) + item.quantity;
    }

    let totalFulfilledCapped = 0;
    project.uniform_items = project.uniform_items.map(item => {
      const tid = String(item.uniform_type_id);
      const sizeStr = normSize(item.size);
      const exactKey = `${item.uniform_type_id}__${sizeStr}`;

      const exactFulfilled = fulfilledByTypeSize[exactKey] || 0;
      const typePool = fulfilledByType[tid] || 0;
      const typeTotalNeeded = typeQtyNeeded[tid] || 1;
      const proportionalFulfilled = typePool > 0
        ? Math.round(typePool * (item.quantity / typeTotalNeeded))
        : 0;

      const itemFulfilled = Math.min(exactFulfilled + proportionalFulfilled, item.quantity);
      const quantity_remaining = Math.max(item.quantity - itemFulfilled, 0);
      totalFulfilledCapped += itemFulfilled;
      return { ...item, quantity_needed: item.quantity, quantity_remaining };
    });
    project.total_fulfilled = totalFulfilledCapped;
  } catch (e) {
    console.warn("[getProjectByIdPublic] snapshot qty failed:", e.message);
    for (const item of project.uniform_items) {
      item.quantity_remaining = item.quantity || 0;
      item.quantity_needed = item.quantity || 0;
    }
  }

  // ✅ FIX สำคัญ: ดึง uniform_type_images ของโรงเรียนนี้มา merge เสมอ
  // เพื่อให้แสดงรูปที่โรงเรียน upload แม้ยังไม่มีนักเรียนใน request นี้
  // หรือ type นั้นไม่ได้อยู่ใน student_need
  const [schoolImgs] = await db.query(
    `SELECT
       uti.uniform_type_id,
       uti.education_level,
       uti.image_url,
       uti.uniform_subtype_name,
       ut.type_name AS name,
       ut.gender,
       ut.uniform_category
     FROM uniform_type_images uti
     JOIN uniform_type ut ON ut.uniform_type_id = uti.uniform_type_id
     WHERE uti.school_id = ? AND uti.request_id = ?`,
    [school_id, request_id]
  );
 
  // merge: ถ้า uniform_type_id + education_level ยังไม่มีใน items → เพิ่ม
  // ถ้ามีแล้ว → update image_url + uniform_subtype_name ด้วยของโรงเรียน
  // ✅ FIX: key ต้องรวม size ด้วย ไม่งั้น type เดียวกันแต่คนละไซส์จะ overwrite กัน
  const itemKey = (typeId, level, size) => {
    const sizeStr = size
      ? (typeof size === "string" ? size : JSON.stringify(size))
      : "null";
    return `${typeId}__${level ?? "null"}__${sizeStr}`;
  };
  const itemMap = new Map(
    project.uniform_items.map(i => [itemKey(i.uniform_type_id, i.education_level, i.size), i])
  );
 
  for (const img of schoolImgs) {
    // schoolImgs ไม่มี size → update ทุก item ที่ตรง type+level (อาจมีหลาย size)
    for (const [, existing] of itemMap) {
      if (
        existing.uniform_type_id === img.uniform_type_id &&
        (existing.education_level ?? null) === (img.education_level ?? null)
      ) {
        existing.image_url = img.image_url;
        existing.uniform_subtype_name = img.uniform_subtype_name || null;
      }
    }
  }
 
  project.uniform_items = [...itemMap.values()];


} catch (uniformErr) {
  console.error("[getProjectByIdPublic] uniform_items query failed:", uniformErr.message);
  project.uniform_items = [];
}

// ── Query: testimonials (published) ──────────────────────────
try {
  const [testimonials] = await db.query(
    `SELECT t.testimonial_id, t.review_title, t.review_text,
            t.image_url, t.review_date,
            s.school_name
     FROM testimonials t
     JOIN schools s ON s.school_id = t.school_id
     WHERE t.request_id = ? AND t.is_published = 1
     ORDER BY t.review_date DESC`,
    [request_id]
  );
  project.testimonials = testimonials;
} catch (tErr) {
  console.error("[testimonials query error]", tErr.message);
  project.testimonials = [];
}

    res.json(project);
 
  } catch (err) {
    next(err);
  }
}
 
// export async function getUniformTypes(req, res) {
//   const [rows] = await db.query(
//     `SELECT uniform_type_id,
//             type_name         AS uniform_type_name,
//             gender,
//             uniform_category,
//             size_schema,
//             category_id
//      FROM uniform_type
//      ORDER BY gender ASC, uniform_category ASC, type_name ASC`
//   );
 
//   res.json(rows);
// }
export async function getUniformTypes(req, res) {
  const { education_level, context } = req.query; 
 
 
  // ดึง education_levels จาก uniform_type แล้ว filter
  const [rows] = await db.query(
    `SELECT uniform_type_id,
            type_name,
            type_name AS uniform_type_name,
            gender,
            uniform_category,
            size_schema,
            category_id,
            education_levels,
            is_default,
            default_image_url
     FROM uniform_type
     ORDER BY gender ASC, uniform_category ASC, type_name ASC`
  );
 
  // filter ฝั่ง JS ตาม education_level ที่ส่งมา
  let filtered = education_level
    ? rows.filter(r => {
      if (!r.education_levels) return true; // ถ้าไม่มี levels = ใช้ได้ทุกระดับ
      try {
        const levels = typeof r.education_levels === "string"
          ? JSON.parse(r.education_levels)
          : r.education_levels;
        return Array.isArray(levels)
          ? levels.includes(education_level)
          : true;
      } catch { return true; }
    })
    : rows;
    if (context === "student_need") {
    filtered = filtered.filter(r => r.is_default === 1);
  }
 
  res.json(filtered);
}
 
 
export async function listProjectStudents(req, res, next) {
  try {
    const request_id = Number(req.params.request_id);
 
    if (!req.user?.school_id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
 
    const school_id = req.user.school_id;
 
    // 1️⃣ ดึง students
    const [students] = await db.query(
      `SELECT student_id,
              school_id,
              request_id,
              student_name,
              student_code,
              education_level,
              gender,
              urgency,
              created_at
       FROM students
       WHERE school_id = ?
         AND request_id = ?
       ORDER BY created_at DESC`,
      [school_id, request_id]
    );
 
    if (!students.length) {
      return res.json([]);
    }
 
    // 2️⃣ ดึง needs
    const ids = students.map((s) => s.student_id);
 
    const [needs] = await db.query(
      `SELECT sn.student_need_id,
              sn.student_id,
              sn.uniform_type_id,
              ut.type_name AS uniform_type_name,
              sn.size,
              sn.quantity_needed,
              sn.quantity_received,
              sn.status,
              sn.support_mode,
              sn.support_years,
              sn.created_at,
              sn.updated_at
       FROM student_need sn
       JOIN uniform_type ut
         ON ut.uniform_type_id = sn.uniform_type_id
       WHERE sn.school_id = ?
         AND sn.student_id IN (?)
       ORDER BY sn.student_need_id DESC`,
      [school_id, ids]
    );
 
    // 3️⃣ รวมข้อมูล
    const byStudent = new Map();
 
    for (const s of students) {
      byStudent.set(s.student_id, {
        ...s,
        needs: [],
        summary: null,
      });
    }
 
    for (const n of needs) {
      if (byStudent.has(n.student_id)) {
        byStudent.get(n.student_id).needs.push(n);
      }
    }
 
    // 4️⃣ คำนวณ summary
    for (const s of students) {
      const box = byStudent.get(s.student_id);
 
      const totalItems = box.needs.length;
 
      const totalNeedQty = box.needs.reduce(
        (sum, x) => sum + (Number(x.quantity_needed) || 0),
        0
      );
 
      const receivedQty = box.needs.reduce(
        (sum, x) => sum + (Number(x.quantity_received) || 0),
        0
      );
 
      let fulfillStatus = "pending";
 
      if (totalNeedQty > 0 && receivedQty >= totalNeedQty) {
        fulfillStatus = "fulfilled";
      } else if (receivedQty > 0 && receivedQty < totalNeedQty) {
        fulfillStatus = "partial";
      }
 
      const hasRecurring = box.needs.some(
        (x) => x.support_mode === "recurring"
      );
 
      box.summary = {
        totalItems,
        receivedText: `${receivedQty}/${totalNeedQty || 0}`,
        fulfillStatus,
        supportLabel: hasRecurring ? "รับต่อเนื่อง" : "รับครั้งเดียว",
      };
    }
 
    return res.json(students.map((s) => byStudent.get(s.student_id)));
 
  } catch (err) {
    next(err);
  }
}
function resolveGroup(edu) {
  if (!edu) return null;
  const s = edu.toString().trim();
  if (/อนุบาล|kg|kindergarten/i.test(s)) return "อนุบาล";
  if (/^ป\.|ประถม|primary|^[Pp]\d/i.test(s)) return "ประถมศึกษา";
  // ✅ check ปลายก่อน ต้น
  if (/มัธยมตอนปลาย|มัธยมปลาย|ม\.ปลาย|^ม\.[4-6]|^[Mm][4-6]/i.test(s)) return "มัธยมตอนปลาย";
  if (/มัธยมตอนต้น|มัธยม|secondary|^ม\.|^[Mm]\d/i.test(s)) return "มัธยมตอนต้น";
  return null;
}

function normalizeNeedSize(size) {
  if (!size) return {};
  if (typeof size === "string") {
    try { return JSON.parse(size); } catch { return {}; }
  }
  return typeof size === "object" ? size : {};
}

function needMatchKey(uniform_type_id, size) {
  return `${Number(uniform_type_id)}:${JSON.stringify(normalizeNeedSize(size))}`;
}

function needFulfillStatus(needQty, recvQty) {
  const need = Number(needQty) || 0;
  const recv = Math.max(0, Math.min(Number(recvQty) || 0, need));
  const status =
    need > 0 && recv >= need ? "fulfilled" :
      recv > 0 ? "partial" :
        "pending";
  return { need, recv, status };
}
export async function createStudentWithNeeds(req, res) {
  const request_id = Number(req.params.request_id);
  const school_id = req.user.school_id;
  const { student_name, education_level, gender, urgency, needs, student_code: bodyCode } = req.body;
 
  const genderDb =
    gender === "ชาย" ? "male" :
      gender === "หญิง" ? "female" :
        gender;
 
  if (!student_name || !education_level || !gender) {
    return res.status(400).json({ message: "กรอกข้อมูลนักเรียนให้ครบ" });
  }
  if (!Array.isArray(needs) || needs.length === 0) {
    return res.status(400).json({ message: "ต้องเพิ่มอย่างน้อย 1 รายการความต้องการ" });
  }

  // ── backend validation (defense in depth) ─────────────
  const nameStr = String(student_name ?? "").trim();
  if (/^\d+$/.test(nameStr))
    return res.status(400).json({ message: "ชื่อ-นามสกุลไม่สามารถเป็นตัวเลขล้วนได้" });
  if (nameStr.length < 3)
    return res.status(400).json({ message: "ชื่อ-นามสกุลสั้นเกินไป (อย่างน้อย 3 ตัวอักษร)" });
  if (!/\s/.test(nameStr))
    return res.status(400).json({ message: "กรุณากรอกทั้งชื่อและนามสกุล (คั่นด้วยช่องว่าง)" });
  if (!["male", "female"].includes(genderDb))
    return res.status(400).json({ message: `เพศไม่ถูกต้อง: "${gender}"` });
  if (!["อนุบาล", "ประถมศึกษา", "มัธยมตอนต้น", "มัธยมตอนปลาย"].includes(education_level))
    return res.status(400).json({ message: `ระดับชั้นไม่ถูกต้อง: "${education_level}"` });
  if (!["very_urgent", "urgent", "can_wait"].includes(urgency || "can_wait"))
    return res.status(400).json({ message: `ความเร่งด่วนไม่ถูกต้อง: "${urgency}"` });
 
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
 
    // ── ตรวจซ้ำ: ชื่อ + เพศ + ระดับชั้น ตรงกัน → ถือว่าคนเดียวกัน ──
    const [dupCheck] = await conn.query(
      `SELECT student_id, student_name FROM students
       WHERE school_id = ? AND request_id = ?
         AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))
         AND gender = ? AND education_level = ?
       LIMIT 1`,
      [school_id, request_id, student_name.trim(), genderDb, education_level]
    );
    if (dupCheck[0]) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        message: `มีนักเรียนชื่อ "${student_name.trim()}" เพศ${gender} ระดับ${education_level} ในโครงการนี้อยู่แล้ว`,
        student_id: dupCheck[0].student_id,
        code: "DUPLICATE_STUDENT",
      });
    }

    // ── ตรวจซ้ำแบบ "คล้ายกัน" (ชื่อ+เพศ ตรงกัน ต่างแค่ระดับ) → แจ้งเตือนแต่ไม่บล็อก ──
    const [similarCheck] = await conn.query(
      `SELECT student_id, student_name, education_level FROM students
       WHERE school_id = ? AND request_id = ?
         AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))
         AND gender = ?
       LIMIT 1`,
      [school_id, request_id, student_name.trim(), genderDb]
    );
    // (ไม่บล็อก — เพียง log ไว้, frontend จัดการ warning เอง)
 
    // ── กำหนด student_code ──────────────────────────────────
    // ถ้า body ส่ง student_code มาและยังไม่ซ้ำในโรงเรียน → ใช้เลย
    // ไม่งั้น → auto-generate ต่อจาก max
    let newCode = null;
    const providedCode = String(bodyCode ?? "").trim();
    if (providedCode) {
      const [codeCheck] = await conn.query(
        `SELECT student_id FROM students WHERE school_id = ? AND student_code = ? LIMIT 1`,
        [school_id, providedCode]
      );
      if (!codeCheck[0]) newCode = providedCode; // ไม่ซ้ำ → ใช้รหัสที่กรอกมา
    }
    if (!newCode) {
      // FOR UPDATE lock ป้องกัน race condition — concurrent request จะรอ transaction นี้ commit ก่อน
      const [[{ max_num }]] = await conn.query(
        `SELECT MAX(CAST(student_code AS UNSIGNED)) AS max_num
         FROM students
         WHERE school_id = ? AND student_code IS NOT NULL
         FOR UPDATE`,
        [school_id]
      );
      newCode = String((Number(max_num) || 0) + 1).padStart(5, "0");
    }

    const [ins] = await conn.query(
      `INSERT INTO students
         (school_id, request_id, student_name,
          education_level, education_level_group,
          gender, urgency, student_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        school_id, request_id, student_name,
        education_level,
        resolveGroup(education_level),
        genderDb, urgency || "can_wait",
        newCode,
      ]
    );

    const student_id = ins.insertId;
 
    for (const n of needs) {
      if (!n.uniform_type_id || !n.size || !n.quantity_needed) {
        throw Object.assign(new Error("ข้อมูลความต้องการไม่ครบ"), { status: 400 });
      }
 
      const needQty = Number(n.quantity_needed);
      const recvQty = Math.max(0, Math.min(Number(n.quantity_received || 0), needQty));
      const status =
        recvQty >= needQty ? "fulfilled" :
          recvQty > 0 ? "partial" :
            "pending";
 
      await conn.query(
        `INSERT INTO student_need
           (school_id, student_id, uniform_type_id, size,
            quantity_needed, quantity_received,
            status, support_mode, support_years, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          school_id, student_id,
          n.uniform_type_id, n.size,
          needQty, recvQty, status,
          n.support_mode || "one_time",
          n.support_mode === "recurring" ? Number(n.support_years || 1) : null,
        ]
      );
    }
 
    await conn.commit();
    // นักเรียนใหม่เพิ่มความต้องการ → un-pause โครงการถ้าครบไปแล้ว
    await syncProjectFeedStatus(request_id).catch(() => {});
    res.json({ message: "created", student_id });
  } catch (e) {
    await conn.rollback();
    res.status(e.status || 500).json({ message: e.message || "Create failed" });
  } finally {
    conn.release();
  }
}
 
export async function updateStudentWithNeeds(req, res) {
  const request_id = Number(req.params.request_id);
  const school_id = req.user.school_id;
  const student_id = Number(req.params.student_id);
  const { student_name, education_level, gender, urgency, needs, student_code: bodyCode, merge_needs } = req.body;
 
  const genderDb =
    gender === "ชาย" ? "male" :
      gender === "หญิง" ? "female" :
        gender;
 
 
 
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
 
    // check ownership
    const [check] = await conn.query(
      `SELECT student_id FROM students WHERE student_id=? AND school_id=? AND request_id=? LIMIT 1`,
      [student_id, school_id, request_id]
    );
    if (!check[0]) return res.status(404).json({ message: "ไม่พบนักเรียน" });
 
    // ตรวจ student_code ที่ส่งมาว่าซ้ำกับคนอื่นในโรงเรียนไหม
    const updateCode = String(bodyCode ?? "").trim() || null;
    if (updateCode) {
      const [codeConflict] = await conn.query(
        `SELECT student_id FROM students WHERE school_id = ? AND student_code = ? AND student_id != ? LIMIT 1`,
        [school_id, updateCode, student_id]
      );
      if (codeConflict[0]) {
        await conn.rollback(); conn.release();
        return res.status(409).json({ message: `รหัสนักเรียน "${updateCode}" ถูกใช้งานแล้วในโรงเรียนนี้` });
      }
    }

    await conn.query(
      `UPDATE students
       SET student_name          = ?,
           education_level       = ?,
           education_level_group = ?,
           gender                = ?,
           urgency               = ?
           ${updateCode ? ", student_code = ?" : ""}
       WHERE student_id = ? AND school_id = ?`,
      updateCode
        ? [student_name, education_level, resolveGroup(education_level), genderDb, urgency, updateCode, student_id, school_id]
        : [student_name, education_level, resolveGroup(education_level), genderDb, urgency, student_id, school_id]
    );
 
    if (!Array.isArray(needs) || needs.length === 0) {
      throw Object.assign(new Error("ต้องมีอย่างน้อย 1 รายการความต้องการ"), { status: 400 });
    }

    if (merge_needs) {
      // Excel import: รวมรายการชุด — ประเภท+ขนาดซ้ำ → อัปเดตจำนวน, ไม่ซ้ำ → เพิ่มรายการใหม่, ไม่ลบของเดิม
      const [existingNeeds] = await conn.query(
        `SELECT student_need_id, uniform_type_id, size,
                quantity_needed, quantity_received, status,
                support_mode, support_years
         FROM student_need
         WHERE student_id = ? AND school_id = ?`,
        [student_id, school_id]
      );
      const byKey = new Map(
        existingNeeds.map((ex) => [needMatchKey(ex.uniform_type_id, ex.size), ex])
      );

      for (const n of needs) {
        if (!n.uniform_type_id || !n.size || !n.quantity_needed) continue;
        const key = needMatchKey(n.uniform_type_id, n.size);
        const incQty = Number(n.quantity_needed) || 0;
        const match = byKey.get(key);

        if (match) {
          const { need, recv, status } = needFulfillStatus(
            Math.max(Number(match.quantity_needed), incQty),
            match.quantity_received
          );
          await conn.query(
            `UPDATE student_need
             SET quantity_needed = ?, quantity_received = ?, status = ?,
                 support_mode = ?, support_years = ?, updated_at = NOW()
             WHERE student_need_id = ? AND school_id = ?`,
            [
              need,
              recv,
              status,
              n.support_mode || match.support_mode || "one_time",
              (n.support_mode || match.support_mode) === "recurring"
                ? Number(n.support_years || match.support_years || 1)
                : null,
              match.student_need_id,
              school_id,
            ]
          );
          byKey.set(key, { ...match, quantity_needed: need, quantity_received: recv, status });
        } else {
          const { need, recv, status } = needFulfillStatus(incQty, 0);
          const [ins] = await conn.query(
            `INSERT INTO student_need
               (school_id, student_id, uniform_type_id, size,
                quantity_needed, quantity_received,
                status, support_mode, support_years, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              school_id,
              student_id,
              n.uniform_type_id,
              typeof n.size === "string" ? n.size : JSON.stringify(n.size || {}),
              need,
              recv,
              status,
              n.support_mode || "one_time",
              n.support_mode === "recurring" ? Number(n.support_years || 1) : null,
            ]
          );
          byKey.set(key, {
            student_need_id: ins.insertId,
            uniform_type_id: n.uniform_type_id,
            size: n.size,
            quantity_needed: need,
            quantity_received: recv,
          });
        }
      }
    } else {
      // แก้ไขจากฟอร์ม: แทนที่รายการชุดทั้งหมดตามที่ส่งมา
      await conn.query(
        `DELETE FROM student_need WHERE student_id=? AND school_id=?`,
        [student_id, school_id]
      );

      for (const n of needs) {
        const { need, recv, status } = needFulfillStatus(
          n.quantity_needed,
          n.quantity_received
        );

        await conn.query(
          `INSERT INTO student_need
             (school_id, student_id, uniform_type_id, size,
              quantity_needed, quantity_received,
              status, support_mode, support_years, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            school_id,
            student_id,
            n.uniform_type_id,
            typeof n.size === "string" ? n.size : JSON.stringify(n.size || {}),
            need,
            recv,
            status,
            n.support_mode || "one_time",
            n.support_mode === "recurring" ? Number(n.support_years || 1) : null,
          ]
        );
      }
    }
 
 
    await conn.commit();
    // ความต้องการเปลี่ยน → sync สถานะฟีดใหม่
    await syncProjectFeedStatus(request_id).catch(() => {});
    res.json({ message: "updated" });
  } catch (e) {
    await conn.rollback();
    res.status(e.status || 500).json({ message: e.message || "Update failed" });
  } finally {
    conn.release();
  }
}
 
export async function deleteStudent(req, res) {
  const request_id = Number(req.params.request_id);
  const school_id = req.user.school_id;
  const student_id = Number(req.params.student_id);
 
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
 
    const [check] = await conn.query(
      `SELECT student_id FROM students WHERE student_id=? AND school_id=? AND request_id=? LIMIT 1`,
      [student_id, school_id, request_id]
    );
    if (!check[0]) return res.status(404).json({ message: "ไม่พบนักเรียน" });
 
    await conn.query(`DELETE FROM student_need WHERE student_id=? AND school_id=?`, [student_id, school_id]);
    await conn.query(`DELETE FROM students WHERE student_id=? AND school_id=?`, [student_id, school_id]);
 
    await conn.commit();
    res.json({ message: "deleted" });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ message: e.message || "Delete failed" });
  } finally {
    conn.release();
  }
}
 
export async function createProject(req, res, next) {
  try {
    const school_id = req.user?.school_id;
    if (!school_id) return res.status(401).json({ message: "Unauthorized" });

    const {
      request_title,
      request_description,
      request_image_url,
      request_image_public_id,
      start_date,
      end_date,
    } = req.body;

    if (!request_title?.trim()) {
      return res.status(400).json({ message: "กรุณากรอกชื่อโครงการ" });
    }
    if (!start_date || isNaN(Date.parse(start_date))) {
      return res.status(400).json({ message: "กรุณาเลือกวันเริ่มต้นโครงการ" });
    }
    if (!end_date || isNaN(Date.parse(end_date))) {
      return res.status(400).json({ message: "กรุณาเลือกวันสิ้นสุดโครงการ" });
    }
    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ message: "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น" });
    }

    // เช็คว่ามีโครงการที่ยัง open หรือ closed อยู่มั้ย
    const [existing] = await db.query(
      `SELECT request_id, status, end_date FROM donation_request
       WHERE school_id = ? AND status IN ('open','closed') LIMIT 1`,
      [school_id]
    );
    if (existing[0]) {
      if (existing[0].status === 'open') {
        return res.status(400).json({ message: "มีโครงการที่ยังเปิดอยู่ กรุณาปิดโครงการก่อนสร้างใหม่" });
      }

      // status === 'closed' → เช็ค pending และวันที่ผ่านไป
      const [pendingRows] = await db.query(
        `SELECT COUNT(*) as cnt FROM donation_record WHERE request_id = ? AND status = 'pending'`,
        [existing[0].request_id]
      );
      const pendingCount = Number(pendingRows[0].cnt);
      const endDate = new Date(existing[0].end_date);
      const daysSinceClosed = Math.floor((Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 14 - daysSinceClosed);

      if (pendingCount > 0 && daysRemaining > 0) {
        return res.status(400).json({
          message: "ยังมีรายการบริจาคค้างอยู่",
          pending_count: pendingCount,
          days_remaining: daysRemaining,
        });
      }

      // เคลียร์แล้ว หรือ 14 วันผ่านแล้ว → archive โครงการเก่าแล้วสร้างใหม่ได้
      await db.query(
        `UPDATE donation_request SET status='archived' WHERE request_id=?`,
        [existing[0].request_id]
      );
    }

    // คำนวณ duration_months จาก start → end (round เป็นเดือน)
    const diffMs = new Date(end_date) - new Date(start_date);
    const durationMonths = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));

    const [result] = await db.query(
      `INSERT INTO donation_request
        (school_id, request_title, request_description, request_image_url, request_image_public_id, status, duration_months, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, NOW())`,
      [
        school_id,
        request_title.trim(),
        request_description || null,
        request_image_url || null,
        request_image_public_id || null,
        durationMonths,
        start_date,
        end_date,
      ]
    );

    return res.json({ request_id: result.insertId });
  } catch (err) {
    next(err);
  }
}
 
export async function listSchoolProjects(req, res, next) {
  try {
    const school_id = req.user.school_id;
 
    const [rows] = await db.query(
      `SELECT request_id, request_title, request_image_url, status, created_at, start_date, duration_months, end_date
       FROM donation_request
       WHERE school_id = ?
       ORDER BY created_at DESC`,
      [school_id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}
 
export async function getLatestProject(req, res, next) {
  try {
    const school_id = req.user.school_id;

    const [rows] = await db.query(
      `SELECT request_id, request_title, request_description, request_image_url, request_image_public_id, status, created_at, start_date, duration_months, end_date,
              COALESCE((SELECT SUM(sn.quantity_needed) FROM student_need sn JOIN students st ON st.student_id = sn.student_id WHERE st.request_id = donation_request.request_id), 0) AS total_needed,
              COALESCE((SELECT SUM(don.quantity) FROM donation_record don WHERE don.request_id = donation_request.request_id AND don.status = 'pending'), 0) AS total_pending
       FROM donation_request
       WHERE school_id = ?
       ORDER BY request_id DESC
       LIMIT 1`,
      [school_id]
    );

    if (!rows[0]) return res.json(null);
    const project = { ...rows[0], total_needed: Number(rows[0].total_needed) || 0, total_pending: Number(rows[0].total_pending) || 0, total_fulfilled: 0 };

    // คำนวณ total_fulfilled จาก snapshot (per-type, capped) เหมือน getProjectByIdPublic
    try {
      const request_id = project.request_id;
      const parseJ = (v) => { try { return typeof v === "string" ? JSON.parse(v) : (v || null); } catch { return null; } };

      const [[snapRows], [needRows]] = await Promise.all([
        db.query(`SELECT items_snapshot, items_condition_snapshot, condition_status FROM donation_record WHERE request_id = ? AND status = 'approved'`, [request_id]),
        db.query(`SELECT sn.uniform_type_id, SUM(sn.quantity_needed) AS qty FROM student_need sn JOIN students st ON st.student_id = sn.student_id WHERE st.request_id = ? GROUP BY sn.uniform_type_id`, [request_id]),
      ]);

      const typeNeeded = {};
      for (const r of needRows) typeNeeded[String(r.uniform_type_id)] = Number(r.qty);

      const fulfilledByType = {};
      for (const d of snapRows) {
        const condSnap = parseJ(d.items_condition_snapshot);
        if (Array.isArray(condSnap) && condSnap.length > 0) {
          for (const it of condSnap) {
            if (it.item_condition === "usable") {
              const tid = String(it.uniform_type_id);
              fulfilledByType[tid] = (fulfilledByType[tid] || 0) + Number(it.qty_received || 0);
            }
          }
        } else if (d.condition_status === "usable") {
          const snap = parseJ(d.items_snapshot);
          if (Array.isArray(snap)) {
            for (const it of snap) {
              const tid = String(it.uniform_type_id);
              fulfilledByType[tid] = (fulfilledByType[tid] || 0) + Number(it.quantity || 0);
            }
          }
        }
      }

      let totalFulfilledCapped = 0;
      for (const [tid, fulfilled] of Object.entries(fulfilledByType)) {
        totalFulfilledCapped += Math.min(fulfilled, typeNeeded[tid] || 0);
      }
      project.total_fulfilled = totalFulfilledCapped;
    } catch { /* noop */ }

    res.json(project);
  } catch (err) {
    next(err);
  }
}
// เรียกดูวันที่
export async function getProjectById(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const request_id = Number(req.params.request_id);
 
    const [rows] = await db.query(
      `SELECT dr.request_id,
              dr.request_title,
              dr.request_description,
              dr.request_image_url,
              dr.request_image_public_id,
              dr.status,
              dr.created_at,
              dr.start_date,
              dr.duration_months,
              dr.end_date,
              s.school_name,
              s.school_address
       FROM donation_request dr
       JOIN schools s ON s.school_id = dr.school_id
       WHERE dr.request_id=? AND dr.school_id=? LIMIT 1`,
      [request_id, school_id]
    );
 
    res.json(rows[0] || null);
  } catch (err) {
    next(err);
  }
}
 
// update แก้ไขโครงการ
export async function updateProject(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const request_id = Number(req.params.request_id);
 
    const {
      request_title,
      request_description,
      request_image_url,
      status,
    } = req.body;
 
    // เช็คว่าเป็นโครงการของโรงเรียนนี้จริงไหม
    const [check] = await db.query(
      `SELECT request_id FROM donation_request
       WHERE request_id=? AND school_id=? LIMIT 1`,
      [request_id, school_id]
    );
 
    if (!check[0]) {
      return res.status(404).json({ message: "ไม่พบโครงการ" });
    }
 
    await db.query(
      `UPDATE donation_request
       SET request_title=?,
           request_description=?,
           request_image_url=?,
           status=?
       WHERE request_id=? AND school_id=?`,
      [
        request_title,
        request_description || null,
        request_image_url || null,
        status || "open",
        request_id,
        school_id,
      ]
    );
 
    res.json({ message: "updated" });
  } catch (err) {
    next(err);
  }
}

export async function closeProject(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const request_id = Number(req.params.request_id);

    const [rows] = await db.query(
      `SELECT status FROM donation_request WHERE request_id=? AND school_id=? LIMIT 1`,
      [request_id, school_id]
    );
    if (!rows[0]) return res.status(404).json({ message: "ไม่พบโครงการ" });
    if (rows[0].status !== "open") return res.status(400).json({ message: "โครงการนี้ไม่ได้อยู่ในสถานะเปิด" });

    const [pendingRows] = await db.query(
      `SELECT COUNT(*) as cnt FROM donation_record WHERE request_id = ? AND status = 'pending'`,
      [request_id]
    );
    const pendingCount = Number(pendingRows[0].cnt);

    await db.query(
      `UPDATE donation_request SET status='closed', end_date=CURDATE() WHERE request_id=? AND school_id=?`,
      [request_id, school_id]
    );

    res.json({ message: "ปิดโครงการเรียบร้อย", pending_count: pendingCount });
  } catch (err) {
    next(err);
  }
}

export async function uploadProjectImage(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const request_id = Number(req.params.request_id);
 
    if (!req.file) return res.status(400).json({ message: "No file" });
 
    // check ownership
    const [chk] = await db.query(
      `SELECT request_id FROM donation_request WHERE request_id=? AND school_id=? LIMIT 1`,
      [request_id, school_id]
    );
    if (!chk[0]) return res.status(404).json({ message: "ไม่พบโครงการ" });
 
    // upload to cloudinary (dataUri)
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
 
    const up = await cloudinary.uploader.upload(dataUri, {
      folder: "unieed/projects",
      resource_type: "image",
    });
 
    // update DB
    await db.query(
      `UPDATE donation_request
       SET request_image_url=?, request_image_public_id=?
       WHERE request_id=? AND school_id=?`,
      [up.secure_url, up.public_id, request_id, school_id]
    );
 
    return res.json({ url: up.secure_url, public_id: up.public_id });
  } catch (err) {
    next(err);
  }
}
 
 
// ── Export นักเรียนทั้งหมดในโครงการเป็น Excel ────────────
// GET /school/projects/:request_id/students/export
// ใช้ library: exceljs  →  npm install exceljs
export async function exportStudentsExcel(req, res, next) {
  try {
    const request_id = Number(req.params.request_id);
    const school_id = req.user.school_id;
 
    // 1) ดึง project title
    const [projRows] = await db.query(
      `SELECT request_title FROM donation_request
       WHERE request_id=? AND school_id=? LIMIT 1`,
      [request_id, school_id]
    );
    if (!projRows[0]) return res.status(404).json({ message: "ไม่พบโครงการ" });
    const projectTitle = projRows[0].request_title;
 
    // 2) ดึง students
    const [students] = await db.query(
      `SELECT student_id, student_name, gender, education_level, urgency, created_at
       FROM students
       WHERE school_id=? AND request_id=?
       ORDER BY created_at ASC`,
      [school_id, request_id]
    );
 
    // 3) ดึง needs
    const ids = students.map((s) => s.student_id);
    let needsMap = new Map();
    if (ids.length) {
      const [needs] = await db.query(
        `SELECT student_id, uniform_type_id, size,
                quantity_needed, quantity_received,
                status, support_mode, support_years
         FROM student_need
         WHERE school_id=? AND student_id IN (?)`,
        [school_id, ids]
      );
      for (const n of needs) {
        if (!needsMap.has(n.student_id)) needsMap.set(n.student_id, []);
        needsMap.get(n.student_id).push(n);
      }
    }
 
    // 4) สร้าง Excel ด้วย exceljs
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("รายชื่อนักเรียน");
 
    // สีธีม Unieed
    const BLUE = "FF29B6E8";
    const BLUE_DARK = "FF0E8BB5";
    const BLUE_LT = "FFE0F7FF";
    const MALE_HD = "FF1565C0";
    const MALE_BG = "FFE3F2FD";
    const FEM_HD = "FFAD1457";
    const FEM_BG = "FFFCE4EC";
    const WHITE = "FFFFFFFF";
    const GRAY = "FFF4F8FB";
    const SUPP_BG = "FFD6EEF8";
 
    const thinBorder = {
      top: { style: "thin", color: { argb: "FFC8E8F5" } },
      left: { style: "thin", color: { argb: "FFC8E8F5" } },
      bottom: { style: "thin", color: { argb: "FFC8E8F5" } },
      right: { style: "thin", color: { argb: "FFC8E8F5" } },
    };
 
    // ── Row 1: Title ──────────────────────────────────────
    ws.mergeCells("A1:O1");
    const r1 = ws.getCell("A1");
    r1.value = `🎒  Unieed — ${projectTitle}`;
    r1.font = { name: "Arial", bold: true, size: 14, color: { argb: WHITE } };
    r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    r1.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 40;
 
    // ── Row 2: Export date ────────────────────────────────
    ws.mergeCells("A2:O2");
    const r2 = ws.getCell("A2");
    r2.value = `Export เมื่อ: ${new Date().toLocaleDateString("th-TH", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })}  |  จำนวนนักเรียน: ${students.length} คน`;
    r2.font = { name: "Arial", size: 9, italic: true, color: { argb: WHITE } };
    r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_DARK } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;
 
    // ── Row 3: Section labels ─────────────────────────────
    ws.mergeCells("A3:G3");
    const s3a = ws.getCell("A3");
    s3a.value = "👤  ข้อมูลนักเรียน";
    s3a.font = { name: "Arial", bold: true, size: 9, color: { argb: WHITE } };
    s3a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_DARK } };
    s3a.alignment = { horizontal: "center", vertical: "middle" };
 
    ws.mergeCells("H3:K3");
    const s3b = ws.getCell("H3");
    s3b.value = "👦  ชุดนักเรียนชาย";
    s3b.font = { name: "Arial", bold: true, size: 9, color: { argb: WHITE } };
    s3b.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MALE_HD } };
    s3b.alignment = { horizontal: "center", vertical: "middle" };
 
    ws.mergeCells("L3:O3");
    const s3c = ws.getCell("L3");
    s3c.value = "👧  ชุดนักเรียนหญิง";
    s3c.font = { name: "Arial", bold: true, size: 9, color: { argb: WHITE } };
    s3c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FEM_HD } };
    s3c.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(3).height = 18;
 
    // ── Row 4: Column headers ─────────────────────────────
    const headers = [
      { col: "A", label: "#", bg: BLUE, fg: WHITE },
      { col: "B", label: "ชื่อ-นามสกุล", bg: BLUE, fg: WHITE },
      { col: "C", label: "เพศ", bg: BLUE, fg: WHITE },
      { col: "D", label: "ระดับชั้น", bg: BLUE, fg: WHITE },
      { col: "E", label: "ความเร่งด่วน", bg: BLUE, fg: WHITE },
      { col: "F", label: "การรับ", bg: BLUE_DARK, fg: WHITE },
      { col: "G", label: "จำนวนปี", bg: BLUE_DARK, fg: WHITE },
      { col: "H", label: "รอบอก (cm)\nเสื้อนักเรียนชาย", bg: MALE_BG, fg: MALE_HD },
      { col: "I", label: "จำนวน (ตัว)\nเสื้อนักเรียนชาย", bg: MALE_BG, fg: MALE_HD },
      { col: "J", label: "รอบเอว (cm)\nกางเกงชาย", bg: MALE_BG, fg: MALE_HD },
      { col: "K", label: "จำนวน (ตัว)\nกางเกงชาย", bg: MALE_BG, fg: MALE_HD },
      { col: "L", label: "รอบอก (cm)\nเสื้อนักเรียนหญิง", bg: FEM_BG, fg: FEM_HD },
      { col: "M", label: "จำนวน (ตัว)\nเสื้อนักเรียนหญิง", bg: FEM_BG, fg: FEM_HD },
      { col: "N", label: "รอบเอว (cm)\nกระโปรงหญิง", bg: FEM_BG, fg: FEM_HD },
      { col: "O", label: "จำนวน (ตัว)\nกระโปรงหญิง", bg: FEM_BG, fg: FEM_HD },
    ];
    ws.getRow(4).height = 42;
    for (const h of headers) {
      const c = ws.getCell(`${h.col}4`);
      c.value = h.label;
      c.font = { name: "Arial", bold: true, size: 9, color: { argb: h.fg } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: h.bg } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = thinBorder;
    }
 
    // ── Rows 5+: Data ─────────────────────────────────────
    // map urgency / gender → ภาษาไทย
    const URGENCY_TH = { very_urgent: "เร่งด่วนมาก", urgent: "เร่งด่วน", can_wait: "รอได้" };
    const GENDER_TH = { male: "ชาย", female: "หญิง" };
 
    students.forEach((s, idx) => {
      const rowNum = idx + 5;
      const bg = idx % 2 === 0 ? GRAY : WHITE;
      const needs = needsMap.get(s.student_id) || [];
 
      // หา need ตาม uniform_type_id
      const getNeed = (typeId) => needs.find((n) => n.uniform_type_id === typeId);
      const getSize = (need, key) => {
        if (!need) return "";
        try {
          const obj = typeof need.size === "string" ? JSON.parse(need.size) : need.size;
          return obj?.[key] ?? "";
        } catch { return ""; }
      };
 
      // support_mode — ใช้จาก need แรกที่มี
      const firstNeed = needs[0];
      const supportMode = firstNeed?.support_mode === "recurring" ? "รับต่อเนื่อง" : "รับครั้งเดียว";
      const supportYears = firstNeed?.support_mode === "recurring" ? (firstNeed.support_years || 1) : "";
 
      const n1 = getNeed(1); // เสื้อนักเรียนชาย
      const n3 = getNeed(3); // กางเกงชาย
      const n2 = getNeed(2); // เสื้อนักเรียนหญิง
      const n4 = getNeed(4); // กระโปรงหญิง
 
      const rowData = [
        idx + 1,
        s.student_name,
        GENDER_TH[s.gender] || s.gender,
        s.education_level,
        URGENCY_TH[s.urgency] || s.urgency,
        supportMode,
        supportYears,
        getSize(n1, "chest"),
        n1?.quantity_needed || "",
        getSize(n3, "waist"),
        n3?.quantity_needed || "",
        getSize(n2, "chest"),
        n2?.quantity_needed || "",
        getSize(n4, "waist"),
        n4?.quantity_needed || "",
      ];
 
      const cols = "ABCDEFGHIJKLMNO".split("");
      rowData.forEach((val, ci) => {
        const colLetter = cols[ci];
        const isMale = ["H", "I", "J", "K"].includes(colLetter);
        const isFemale = ["L", "M", "N", "O"].includes(colLetter);
        const isSupport = ["F", "G"].includes(colLetter);
        const cellBg = isMale ? (idx % 2 === 0 ? "FFE3F2FD" : "FFF3F8FF")
          : isFemale ? (idx % 2 === 0 ? "FFFCE4EC" : "FFFFF0F5")
            : isSupport ? (idx % 2 === 0 ? "FFD6EEF8" : "FFE4F4FB")
              : bg;
 
        const c = ws.getCell(`${colLetter}${rowNum}`);
        c.value = val === "" ? null : val;
        c.font = { name: "Arial", size: 10 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cellBg } };
        c.alignment = { horizontal: ci === 1 ? "left" : "center", vertical: "middle" };
        c.border = thinBorder;
      });
      ws.getRow(rowNum).height = 21;
    });
 
    // ── Column widths ─────────────────────────────────────
    const widths = [5, 26, 8, 14, 16, 14, 9, 11, 9, 11, 9, 11, 9, 11, 9];
    "ABCDEFGHIJKLMNO".split("").forEach((col, i) => {
      ws.getColumn(col).width = widths[i];
    });
 
    // ── Summary row ───────────────────────────────────────
    const lastRow = students.length + 5;
    ws.mergeCells(`A${lastRow}:G${lastRow}`);
    const sumCell = ws.getCell(`A${lastRow}`);
    sumCell.value = `รวมทั้งหมด ${students.length} คน`;
    sumCell.font = { name: "Arial", bold: true, size: 10, color: { argb: WHITE } };
    sumCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_DARK } };
    sumCell.alignment = { horizontal: "right", vertical: "middle" };
    ws.getRow(lastRow).height = 24;
 
    // ── Stream response ───────────────────────────────────
    const safeName = projectTitle.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(`unieed_${safeName}.xlsx`)}`);
 
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}
 
// ── Import Template ───────────────────────────────────────────────────────────
export async function generateImportTemplate(req, res, next) {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator  = "Unieed";
    wb.created  = new Date();

    // ═══════════════════════════════════════════════════════════════════
    //  สีธีม Unieed
    // ═══════════════════════════════════════════════════════════════════
    const C = {
      BLUE:       "FF29B6E8",
      BLUE_DARK:  "FF0E8BB5",
      BLUE_DEEP:  "FF0A6E91",
      BLUE_LT:    "FFE0F7FF",
      BLUE_XLT:   "FFF0FBFF",
      MALE_HD:    "FF1565C0",
      MALE_MID:   "FF1976D2",
      MALE_BG:    "FFE3F2FD",
      MALE_LT:    "FFF3F8FF",
      FEM_HD:     "FFAD1457",
      FEM_MID:    "FFC2185B",
      FEM_BG:     "FFFCE4EC",
      FEM_LT:     "FFFFF0F5",
      WHITE:      "FFFFFFFF",
      GRAY_LT:    "FFF8FAFB",
      GRAY_MID:   "FFE8EEF2",
      GRAY_DARK:  "FF607D8B",
      GREEN_BG:   "FFE8F5E9",
      GREEN_FG:   "FF2E7D32",
      GREEN_MID:  "FF43A047",
      AMBER:      "FFFFF8E1",
      AMBER_FG:   "FFF57F17",
      SUPP_BG:    "FFD6EEF8",
      SUPP_MID:   "FFBEDEF4",
    };

    const border = (color = "FFD0E8F5", style = "thin") => ({
      top:    { style, color: { argb: color } },
      left:   { style, color: { argb: color } },
      bottom: { style, color: { argb: color } },
      right:  { style, color: { argb: color } },
    });
    const borderMedium = border("FFA0CCE8", "medium");

    // helper: apply cell to any worksheet
    const cell = (sheet, addr, value, opts = {}) => {
      const {
        bg, fg = C.WHITE, bold = false, size = 10,
        align = "center", wrap = false, italic = false,
        border: bdr, indent = 0,
      } = opts;
      const c = sheet.getCell(addr);
      c.value = value;
      c.font  = { name: "Calibri", bold, size, color: { argb: fg }, italic };
      if (bg) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      c.alignment = { horizontal: align, vertical: "middle", wrapText: wrap, indent };
      if (bdr) c.border = bdr;
      return c;
    };

    const COLS = "ABCDEFGHIJKLMNO".split("");


    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  SHEET 1 — กรอกข้อมูล (data entry sheet)                       ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const ws = wb.addWorksheet("กรอกข้อมูล", {
      views: [{ state: "frozen", ySplit: 7 }],   // freeze แถว 1-7
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
    });

    // ── Row 1: Main title banner ──────────────────────────
    ws.mergeCells("A1:O1");
    cell(ws, "A1", "🎒   Unieed  —  แบบฟอร์มนำเข้าข้อมูลนักเรียน", {
      bg: C.BLUE, bold: true, size: 16, border: borderMedium,
    });
    ws.getRow(1).height = 52;

    // ── Row 2: Sub-banner ─────────────────────────────────
    ws.mergeCells("A2:O2");
    cell(ws, "A2",
      "📖  ดูคำอธิบายคอลัมน์และตัวอย่างการกรอกได้ที่ชีท  « คำแนะนำ »  ด้านล่าง", {
      bg: C.BLUE_DEEP, size: 10, italic: true, border: border("FF0A6E91"),
    });
    ws.getRow(2).height = 24;

    // ── Row 3: Section labels (info / male / female) ──────
    ws.mergeCells("A3:G3");
    cell(ws, "A3", "👤   ข้อมูลนักเรียน", {
      bg: C.BLUE_DARK, bold: true, size: 10, border: borderMedium,
    });
    ws.mergeCells("H3:K3");
    cell(ws, "H3", "👦   ชุดนักเรียนชาย", {
      bg: C.MALE_HD, bold: true, size: 10, border: borderMedium,
    });
    ws.mergeCells("L3:O3");
    cell(ws, "L3", "👧   ชุดนักเรียนหญิง", {
      bg: C.FEM_HD, bold: true, size: 10, border: borderMedium,
    });
    ws.getRow(3).height = 24;

    // ── Row 4: Column headers ─────────────────────────────
    const hdrs = [
      { label:"รหัสนักเรียน\n(optional)",   bg: C.BLUE,      fg: C.WHITE   },
      { label:"ชื่อ-นามสกุล *",             bg: C.BLUE,      fg: C.WHITE   },
      { label:"เพศ *\n▾ เลือก",             bg: C.BLUE,      fg: C.WHITE   },
      { label:"ระดับชั้น *\n▾ เลือก",        bg: C.BLUE,      fg: C.WHITE   },
      { label:"ความเร่งด่วน *\n▾ เลือก",    bg: C.BLUE,      fg: C.WHITE   },
      { label:"การรับ *\n▾ เลือก",           bg: C.BLUE_DARK, fg: C.WHITE   },
      { label:"จำนวนปี\n(ถ้ารับต่อเนื่อง)", bg: C.BLUE_DARK, fg: C.WHITE   },
      { label:"รอบอก (cm)\nเสื้อนักเรียนชาย",       bg: C.MALE_BG,   fg: C.MALE_HD },
      { label:"จำนวน (ตัว)\nเสื้อนักเรียนชาย",      bg: C.MALE_BG,   fg: C.MALE_HD },
      { label:"รอบเอว (cm)\nกางเกงชาย",     bg: C.MALE_BG,   fg: C.MALE_HD },
      { label:"จำนวน (ตัว)\nกางเกงชาย",     bg: C.MALE_BG,   fg: C.MALE_HD },
      { label:"รอบอก (cm)\nเสื้อนักเรียนหญิง",      bg: C.FEM_BG,    fg: C.FEM_HD  },
      { label:"จำนวน (ตัว)\nเสื้อนักเรียนหญิง",     bg: C.FEM_BG,    fg: C.FEM_HD  },
      { label:"รอบเอว (cm)\nกระโปรงหญิง",   bg: C.FEM_BG,    fg: C.FEM_HD  },
      { label:"จำนวน (ตัว)\nกระโปรงหญิง",   bg: C.FEM_BG,    fg: C.FEM_HD  },
    ];
    ws.getRow(4).height = 48;
    hdrs.forEach((h, i) => {
      cell(ws, `${COLS[i]}4`, h.label, {
        bg: h.bg, fg: h.fg, bold: true, size: 9, wrap: true,
        border: borderMedium,
      });
    });

    // ── Row 5: Sub-header hints ───────────────────────────
    const hints = [
      "เช่น 00001", "ชื่อ นามสกุล",
      "ชาย / หญิง", "เลือกจากรายการ", "เลือกจากรายการ", "เลือกจากรายการ",
      "ระบุเมื่อรับต่อเนื่อง",
      "cm","ตัว","cm","ตัว","cm","ตัว","cm","ตัว",
    ];
    ws.getRow(5).height = 16;
    hints.forEach((h, i) => {
      const isDropdown = i >= 2 && i <= 5;
      cell(ws, `${COLS[i]}5`, h, {
        bg: isDropdown ? "FFFFF9C4" : C.BLUE_XLT,
        fg: isDropdown ? "FFE65100" : C.GRAY_DARK,
        size: 8, italic: true, bold: isDropdown,
        border: border(isDropdown ? "FFFFE082" : "FFD8EEF8"),
      });
    });

    // ── Row 6: Empty spacer ───────────────────────────────
    ws.mergeCells("A6:O6");
    cell(ws, "A6", "", { bg: C.GRAY_MID, border: border("FFD0DCE4") });
    ws.getRow(6).height = 6;

    // ── Row 7: Start-here marker ──────────────────────────
    ws.mergeCells("A7:O7");
    cell(ws, "A7",
      "▼   กรอกข้อมูลนักเรียนเริ่มจากแถวที่ 8 เป็นต้นไป   ▼", {
      bg: C.GREEN_BG, fg: C.GREEN_FG, bold: true, size: 10,
      border: border(C.GREEN_MID),
    });
    ws.getRow(7).height = 22;

    // ── Rows 8-57: Pre-formatted empty data rows ──────────
    for (let r = 8; r <= 57; r++) {
      const isEven = (r % 2 === 0);
      ws.getRow(r).height = 22;
      COLS.forEach((col, ci) => {
        const isMale    = ci >= 7  && ci <= 10;
        const isFemale  = ci >= 11 && ci <= 14;
        const isSupport = ci === 5 || ci === 6;
        const isDropCol = ci >= 2  && ci <= 5;   // C D E F — dropdown cols
        const bg = isMale    ? (isEven ? C.MALE_BG  : C.MALE_LT)
                 : isFemale  ? (isEven ? C.FEM_BG   : C.FEM_LT)
                 : isSupport ? (isEven ? C.SUPP_BG  : C.SUPP_MID)
                 : isDropCol ? (isEven ? "FFFFFDE7"  : C.WHITE)
                 :              (isEven ? C.GRAY_LT  : C.WHITE);
        const c = ws.getCell(`${col}${r}`);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        c.font = { name: "Calibri", size: 10 };
        c.alignment = { horizontal: ci === 1 ? "left" : "center", vertical: "middle" };
        c.border = border("FFE0EEF5");
      });

      // ── Dropdown validation ───────────────────────────
      ws.getCell(`C${r}`).dataValidation = {
        type: "list", allowBlank: true,
        formulae: ['"ชาย,หญิง"'],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "ค่าไม่ถูกต้อง",
        error: "กรุณาเลือก: ชาย หรือ หญิง",
        showInputMessage: true,
        promptTitle: "เพศ",
        prompt: "เลือก ชาย หรือ หญิง",
      };
      ws.getCell(`D${r}`).dataValidation = {
        type: "list", allowBlank: true,
        formulae: ['"อนุบาล,ประถมศึกษา,มัธยมตอนต้น,มัธยมตอนปลาย"'],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "ค่าไม่ถูกต้อง",
        error: "กรุณาเลือกระดับชั้นจากรายการ",
        showInputMessage: true,
        promptTitle: "ระดับชั้น",
        prompt: "เลือกระดับชั้นการศึกษา",
      };
      ws.getCell(`E${r}`).dataValidation = {
        type: "list", allowBlank: true,
        formulae: ['"เร่งด่วนมาก,เร่งด่วน,รอได้"'],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "ค่าไม่ถูกต้อง",
        error: "กรุณาเลือก: เร่งด่วนมาก, เร่งด่วน หรือ รอได้",
        showInputMessage: true,
        promptTitle: "ความเร่งด่วน",
        prompt: "เลือกระดับความเร่งด่วน",
      };
      ws.getCell(`F${r}`).dataValidation = {
        type: "list", allowBlank: true,
        formulae: ['"รับครั้งเดียว,รับต่อเนื่อง"'],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "ค่าไม่ถูกต้อง",
        error: "กรุณาเลือก: รับครั้งเดียว หรือ รับต่อเนื่อง",
        showInputMessage: true,
        promptTitle: "การรับ",
        prompt: "เลือกรูปแบบการรับบริจาค",
      };
    }

    // ── Column widths ─────────────────────────────────────
    const widths = [18, 28, 10, 20, 18, 18, 14, 14, 11, 16, 11, 14, 11, 18, 11];
    COLS.forEach((col, i) => { ws.getColumn(col).width = widths[i]; });


    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  SHEET 2 — คำแนะนำ & ตัวอย่าง                                  ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const wg = wb.addWorksheet("คำแนะนำ", {
      views: [{ showGridLines: false }],
    });
    wg.getColumn("A").width = 5;
    wg.getColumn("B").width = 24;
    wg.getColumn("C").width = 52;
    wg.getColumn("D").width = 32;
    wg.getColumn("E").width = 20;

    let gRow = 1;
    const gCell = (addr, value, opts = {}) => cell(wg, addr, value, opts);
    const gMerge = (range) => wg.mergeCells(range);
    const nextRow = (h = 22) => { wg.getRow(gRow).height = h; gRow++; };
    const gap = (h = 10) => { wg.getRow(gRow).height = h; gRow++; };

    // ── Title ──────────────────────────────────────────────
    gMerge(`A${gRow}:E${gRow}`);
    gCell(`A${gRow}`, "📖   คำแนะนำการกรอกแบบฟอร์ม  Unieed", {
      bg: C.BLUE, bold: true, size: 16, border: borderMedium,
    });
    nextRow(52); gap(6);

    // ── Section: คำอธิบายคอลัมน์ ─────────────────────────
    gMerge(`A${gRow}:E${gRow}`);
    gCell(`A${gRow}`, "①   คำอธิบายคอลัมน์และค่าที่รับได้", {
      bg: C.BLUE_DARK, bold: true, size: 12, border: borderMedium,
    });
    nextRow(30); gap(4);

    // column guide table header
    ["", "คอลัมน์", "คำอธิบาย", "ค่าที่รับได้", "หมายเหตุ"].forEach((h, i) => {
      const cols2 = ["A","B","C","D","E"];
      gCell(`${cols2[i]}${gRow}`, h, {
        bg: C.BLUE_DARK, bold: true, size: 10,
        border: borderMedium,
      });
    });
    nextRow(24);

    const colGuide = [
      ["A", "รหัสนักเรียน",          "รหัสประจำตัวนักเรียน",                     "ตัวเลข เช่น 00001, 00042",           "ไม่บังคับ — ถ้าเว้นว่างระบบจะกำหนดให้อัตโนมัติ"],
      ["B", "ชื่อ-นามสกุล *",        "ชื่อและนามสกุลของนักเรียน",                "ข้อความ เช่น สมชาย ใจดี",            "จำเป็นต้องกรอก"],
      ["C", "เพศ *",                 "เพศของนักเรียน",                           "ชาย  หรือ  หญิง",                    "ตรงตัวอักษร ไม่รับ male/female"],
      ["D", "ระดับชั้น *",            "ระดับการศึกษา",                            "อนุบาล / ประถมศึกษา\nมัธยมตอนต้น / มัธยมตอนปลาย", "เลือกจาก dropdown"],
      ["E", "ความเร่งด่วน *",         "ระดับความเร่งด่วนในการรับบริจาค",         "เร่งด่วนมาก / เร่งด่วน / รอได้",     ""],
      ["F", "การรับ *",               "รูปแบบการรับบริจาค",                       "รับครั้งเดียว  หรือ  รับต่อเนื่อง", ""],
      ["G", "จำนวนปี",                "จำนวนปีที่ต้องการรับต่อเนื่อง",            "ตัวเลข เช่น 1, 2, 3",               "ระบุเฉพาะเมื่อ การรับ = รับต่อเนื่อง"],
      ["H", "รอบอก เสื้อนักเรียนชาย",         "ขนาดรอบอก (cm) สำหรับเสื้อนักเรียนชาย",  "ตัวเลข เช่น 30, 32, 34, 36",         "เว้นว่างถ้าไม่ต้องการเสื้อนักเรียนชาย"],
      ["I", "จำนวน เสื้อนักเรียนชาย",         "จำนวนตัวที่ต้องการ (เสื้อนักเรียนชาย)",           "ตัวเลข เช่น 1, 2",                   "เว้นว่างหรือ 0 ถ้าไม่ต้องการ"],
      ["J", "รอบเอว กางเกงชาย",       "ขนาดรอบเอว (cm) สำหรับกางเกงนักเรียนชาย","ตัวเลข เช่น 24, 26, 28",             "เว้นว่างถ้าไม่ต้องการกางเกงชาย"],
      ["K", "จำนวน กางเกงชาย",        "จำนวนตัวที่ต้องการ (กางเกงชาย)",          "ตัวเลข เช่น 1, 2",                   ""],
      ["L", "รอบอก เสื้อนักเรียนหญิง",        "ขนาดรอบอก (cm) สำหรับเสื้อนักเรียนหญิง", "ตัวเลข เช่น 28, 30, 32",             "เว้นว่างถ้าไม่ต้องการเสื้อนักเรียนหญิง"],
      ["M", "จำนวน เสื้อนักเรียนหญิง",        "จำนวนตัวที่ต้องการ (เสื้อนักเรียนหญิง)",          "ตัวเลข เช่น 1, 2",                   ""],
      ["N", "รอบเอว กระโปรงหญิง",     "ขนาดรอบเอว (cm) สำหรับกระโปรงนักเรียนหญิง","ตัวเลข เช่น 22, 24, 26",           "เว้นว่างถ้าไม่ต้องการกระโปรง"],
      ["O", "จำนวน กระโปรงหญิง",      "จำนวนตัวที่ต้องการ (กระโปรงหญิง)",        "ตัวเลข เช่น 1, 2",                   ""],
    ];

    colGuide.forEach(([colLetter, colName, desc, values, note], idx) => {
      const isEven = idx % 2 === 0;
      const bg = isEven ? C.BLUE_XLT : C.WHITE;
      const cols2 = ["A","B","C","D","E"];
      const rowVals = [colLetter, colName, desc, values, note];
      rowVals.forEach((v, ci) => {
        const bdr = ci === 1 ? border("FF90C8E0","medium") : border("FFD0E8F5");
        gCell(`${cols2[ci]}${gRow}`, v, {
          bg,
          fg:    ci === 0 ? C.BLUE_DARK : ci === 4 ? C.GRAY_DARK : "FF1A2C38",
          bold:  ci === 0 || ci === 1,
          size:  ci === 0 ? 11 : 9,
          align: ci === 2 || ci === 3 || ci === 4 ? "left" : "center",
          wrap:  true,
          border: bdr,
        });
      });
      wg.getRow(gRow).height = desc.includes("\n") || values.includes("\n") ? 36 : 22;
      gRow++;
    });

    gap(14);

    // ── Section: ตัวอย่างการกรอก ──────────────────────────
    gMerge(`A${gRow}:E${gRow}`);
    gCell(`A${gRow}`, "②   ตัวอย่างการกรอกข้อมูล", {
      bg: C.MALE_HD, bold: true, size: 12, border: borderMedium,
    });
    nextRow(30); gap(4);

    // example mini-table — headers (resize cols for example area)
    const EX_COLS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
    const exWidths = [5, 18, 28, 9, 18, 16, 16, 14, 14, 11, 16, 11, 14, 11, 18, 11];
    // need more columns for the example sheet
    ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"].forEach((c2, i) => {
      wg.getColumn(c2).width = exWidths[i] ?? 12;
    });

    // Section headers for example
    wg.mergeCells(`B${gRow}:H${gRow}`);
    gCell(`B${gRow}`, "👤  ข้อมูลนักเรียน", { bg: C.BLUE_DARK, bold: true, size: 9, border: borderMedium });
    wg.mergeCells(`I${gRow}:L${gRow}`);
    gCell(`I${gRow}`, "👦  ชุดนักเรียนชาย", { bg: C.MALE_HD, bold: true, size: 9, border: borderMedium });
    wg.mergeCells(`M${gRow}:P${gRow}`);
    gCell(`M${gRow}`, "👧  ชุดนักเรียนหญิง", { bg: C.FEM_HD, bold: true, size: 9, border: borderMedium });
    gCell(`A${gRow}`, "", { bg: C.BLUE_DARK, border: borderMedium });
    nextRow(20);

    // example col headers
    const exHdrs = [
      { label:"#",                   bg: C.BLUE,      fg: C.WHITE   },
      { label:"รหัสนักเรียน",        bg: C.BLUE,      fg: C.WHITE   },
      { label:"ชื่อ-นามสกุล",        bg: C.BLUE,      fg: C.WHITE   },
      { label:"เพศ",                 bg: C.BLUE,      fg: C.WHITE   },
      { label:"ระดับชั้น",            bg: C.BLUE,      fg: C.WHITE   },
      { label:"ความเร่งด่วน",         bg: C.BLUE,      fg: C.WHITE   },
      { label:"การรับ",               bg: C.BLUE_DARK, fg: C.WHITE   },
      { label:"จำนวนปี",              bg: C.BLUE_DARK, fg: C.WHITE   },
      { label:"รอบอก\nเสื้อนักเรียนชาย",     bg: C.MALE_BG,  fg: C.MALE_HD  },
      { label:"จำนวน\nเสื้อนักเรียนชาย",     bg: C.MALE_BG,  fg: C.MALE_HD  },
      { label:"รอบเอว\nกางเกง",      bg: C.MALE_BG,  fg: C.MALE_HD  },
      { label:"จำนวน\nกางเกง",       bg: C.MALE_BG,  fg: C.MALE_HD  },
      { label:"รอบอก\nเสื้อนักเรียนหญิง",    bg: C.FEM_BG,   fg: C.FEM_HD   },
      { label:"จำนวน\nเสื้อนักเรียนหญิง",    bg: C.FEM_BG,   fg: C.FEM_HD   },
      { label:"รอบเอว\nกระโปรง",     bg: C.FEM_BG,   fg: C.FEM_HD   },
      { label:"จำนวน\nกระโปรง",      bg: C.FEM_BG,   fg: C.FEM_HD   },
    ];
    wg.getRow(gRow).height = 40;
    exHdrs.forEach((h, i) => {
      gCell(`${EX_COLS[i]}${gRow}`, h.label, {
        bg: h.bg, fg: h.fg, bold: true, size: 9, wrap: true, border: borderMedium,
      });
    });
    nextRow(40);

    // example data rows
    const exData = [
      [1,"00001","สมชาย ใจดี",     "ชาย", "ประถมศึกษา",    "เร่งด่วน",  "รับครั้งเดียว","","32","1","","","","","",""],
      [2,"00002","สมหญิง รักเรียน","หญิง","มัธยมตอนต้น","รอได้",      "รับครั้งเดียว","","","", "","","30","1","24","1"],
      [3,"",     "สมศักดิ์ มั่นใจ","ชาย", "มัธยมตอนปลาย","เร่งด่วนมาก","รับต่อเนื่อง","2","34","1","28","1","","","",""],
    ];
    exData.forEach((row, ri) => {
      wg.getRow(gRow).height = 22;
      row.forEach((val, ci) => {
        const isMale   = ci >= 8  && ci <= 11;
        const isFemale = ci >= 12 && ci <= 15;
        const isSupport = ci === 6 || ci === 7;
        const isEven = ri % 2 === 0;
        const bg = isMale   ? (isEven ? C.MALE_BG  : C.MALE_LT)
                 : isFemale ? (isEven ? C.FEM_BG   : C.FEM_LT)
                 : isSupport? (isEven ? C.SUPP_BG  : C.SUPP_MID)
                 :             (isEven ? C.GRAY_LT  : C.WHITE);
        gCell(`${EX_COLS[ci]}${gRow}`, val === "" ? null : val, {
          bg, fg: "FF1A2C38", size: 10,
          align: ci === 2 ? "left" : "center",
          border: border("FFD0E8F5"),
        });
      });
      gRow++;
    });

    gap(14);

    // ── Section: หมายเหตุ ──────────────────────────────────
    gMerge(`A${gRow}:E${gRow}`);
    gCell(`A${gRow}`, "③   หมายเหตุสำคัญ", {
      bg: C.AMBER_FG, bold: true, size: 12, border: borderMedium,
    });
    nextRow(30); gap(4);

    const notes = [
      ["⚠️", "คอลัมน์ที่มีเครื่องหมาย * จำเป็นต้องกรอกทุกครั้ง"],
      ["📐", "ขนาดเสื้อผ้าทุกคอลัมน์ใช้หน่วยเป็น เซนติเมตร (cm)"],
      ["🔢", "รหัสนักเรียนต้องไม่ซ้ำกันภายในโรงเรียนเดียวกัน"],
      ["📋", "กรอกข้อมูลในชีท 'กรอกข้อมูล' เท่านั้น ตั้งแต่แถวที่ 8"],
      ["🔄", "ระบบจะอ่านข้อมูลตั้งแต่แถว 8 เป็นต้นไปโดยอัตโนมัติ"],
      ["🎯", "หากต้องการชุดนักเรียนชาย ให้กรอกทั้งขนาดและจำนวน (H+I หรือ J+K)"],
      ["💡", "หากต้องการชุดนักเรียนหญิง ให้กรอกทั้งขนาดและจำนวน (L+M หรือ N+O)"],
    ];
    notes.forEach(([icon, text], ni) => {
      const bg = ni % 2 === 0 ? C.AMBER : C.WHITE;
      wg.mergeCells(`B${gRow}:E${gRow}`);
      gCell(`A${gRow}`, icon, { bg, fg: C.AMBER_FG, bold: true, size: 12, border: border("FFFFE082") });
      gCell(`B${gRow}`, text, { bg, fg: "FF3E2723", size: 10, align: "left", border: border("FFFFE082") });
      wg.getRow(gRow).height = 22;
      gRow++;
    });

    // ── Stream response ───────────────────────────────────
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''unieed_import_template.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// school.controller.js

export async function uploadUniformImage(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const request_id = Number(req.params.request_id);
    const uniform_type_id = Number(req.params.uniform_type_id);
    // ✅ รับ education_level จาก body (multipart)
    const education_level = req.body?.education_level || null;
    const custom_type_name = req.body.custom_type_name || null;
    if (custom_type_name && typeof custom_type_name !== "string") {
      return res.status(400).json({ message: "Invalid type name" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "ไม่พบไฟล์รูปภาพ" });
    }
 
    // ตรวจสิทธิ์
    const [projRows] = await db.query(
      `SELECT request_id FROM donation_request
       WHERE request_id = ? AND school_id = ? LIMIT 1`,
      [request_id, school_id]
    );
    if (!projRows[0]) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์จัดการโครงการนี้" });
    }
 
    // ลบรูปเดิมที่ตรง education_level เดียวกัน
    const [existing] = await db.query(
      `SELECT image_public_id FROM uniform_type_images
       WHERE school_id = ? AND request_id = ? AND uniform_type_id = ?
         AND (education_level = ? OR (education_level IS NULL AND ? IS NULL))
       LIMIT 1`,
      [school_id, request_id, uniform_type_id, education_level, education_level]
    );
    if (existing[0]?.image_public_id) {
      await cloudinary.uploader.destroy(existing[0].image_public_id);
    }
 
    // Upload Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "uniform",
          public_id: `school_${school_id}_req_${request_id}_type_${uniform_type_id}${education_level ? `_${education_level}` : ""}`,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });
 
    // ✅ Upsert พร้อม education_level
    await db.query(
      `INSERT INTO uniform_type_images
(school_id, request_id, uniform_type_id, education_level, image_url, image_public_id, uniform_subtype_name)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  image_url = VALUES(image_url),
  image_public_id = VALUES(image_public_id),
  uniform_subtype_name = VALUES(uniform_subtype_name),
  updated_at = NOW()`,
      [school_id, request_id, uniform_type_id, education_level,
        result.secure_url, result.public_id, custom_type_name]
    );
 
    res.json({ image_url: result.secure_url, image_public_id: result.public_id });
  } catch (err) {
    next(err);
  }
}
 
 
export async function deleteUniformImage(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const request_id = Number(req.params.request_id);
    const uniform_type_id = Number(req.params.uniform_type_id);
    // ✅ รับ education_level จาก query string
    const education_level = req.query?.education_level || null;
 
    const [rows] = await db.query(
      `SELECT image_public_id FROM uniform_type_images
       WHERE school_id = ? AND request_id = ? AND uniform_type_id = ?
         AND (education_level = ? OR (education_level IS NULL AND ? IS NULL))
       LIMIT 1`,
      [school_id, request_id, uniform_type_id, education_level, education_level]
    );
 
    if (!rows[0]) {
      return res.status(404).json({ message: "ไม่พบรูปภาพ" });
    }
 
    await cloudinary.uploader.destroy(rows[0].image_public_id);
 
    await db.query(
      `DELETE FROM uniform_type_images
       WHERE school_id = ? AND request_id = ? AND uniform_type_id = ?
         AND (education_level = ? OR (education_level IS NULL AND ? IS NULL))`,
      [school_id, request_id, uniform_type_id, education_level, education_level]
    );
 
    res.json({ message: "ลบรูปภาพสำเร็จ" });
  } catch (err) {
    next(err);
  }
}
 
// GET /school/testimonials?request_id=
export async function getTestimonials(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const request_id = req.query.request_id ? Number(req.query.request_id) : null;

    const [rows] = await db.query(
      `SELECT t.*, u.user_name AS recorded_by_name
       FROM testimonials t
       LEFT JOIN users u ON u.user_id = t.recorded_by_user_id
       WHERE t.school_id = ?
       ${request_id ? "AND t.request_id = ?" : ""}
       ORDER BY t.created_at DESC`,
      request_id ? [school_id, request_id] : [school_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}
 
// POST /school/testimonials
export async function createTestimonial(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const recorded_by_user_id = req.user.user_id || null;
    const { review_title, review_text, rating, is_published, image_url: bodyImgUrl } = req.body;
 
    if (!review_title?.trim()) return res.status(400).json({ message: "กรุณากรอกหัวข้อ" });
    if (!review_text?.trim()) return res.status(400).json({ message: "กรุณากรอกความประทับใจ" });
 
    let image_url = bodyImgUrl || null;
    let image_public_id = null;
 
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "unieed/testimonials", resource_type: "image" },
          (err, r) => (err ? reject(err) : resolve(r))
        );
        stream.end(req.file.buffer);
      });
      image_url = result.secure_url;
      image_public_id = result.public_id;
    }
 
    const { request_id } = req.body;

    const [ins] = await db.query(
      `INSERT INTO testimonials
     (school_id, request_id, review_title, review_text,
      image_url, image_public_id, is_published, review_date, recorded_by_user_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
      [
        school_id,
        request_id ? Number(request_id) : null,
        review_title.trim(),
        review_text.trim(),
        image_url,
        image_public_id,
        is_published === "1" || is_published === 1 ? 1 : 0,
        recorded_by_user_id,
      ]
    );
 
    res.status(201).json({ message: "บันทึกสำเร็จ", testimonial_id: ins.insertId });
  } catch (err) { next(err); }
}
 
// PUT /school/testimonials/:id
export async function updateTestimonial(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const testimonial_id = Number(req.params.id);
    const { review_title, review_text, is_published, image_url: bodyImgUrl } = req.body;
 
    const [rows] = await db.query(
      "SELECT * FROM testimonials WHERE testimonial_id = ? AND school_id = ? LIMIT 1",
      [testimonial_id, school_id]
    );
    if (!rows[0]) return res.status(403).json({ message: "ไม่พบหรือไม่มีสิทธิ์" });
 
    let image_url = bodyImgUrl || rows[0].image_url;
    let image_public_id = rows[0].image_public_id;
 
    if (req.file) {
      if (image_public_id) await cloudinary.uploader.destroy(image_public_id);
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "unieed/testimonials", resource_type: "image" },
          (err, r) => (err ? reject(err) : resolve(r))
        );
        stream.end(req.file.buffer);
      });
      image_url = result.secure_url;
      image_public_id = result.public_id;
    }
 
    await db.query(
      `UPDATE testimonials
       SET review_title = ?, review_text = ?,
           image_url = ?, image_public_id = ?, is_published = ?
       WHERE testimonial_id = ? AND school_id = ?`,
      [
        review_title?.trim(),
        review_text?.trim(),
        image_url,
        image_public_id,
        is_published === "1" || is_published === 1 ? 1 : 0,
        testimonial_id,
        school_id,
      ]
    );
 
    res.json({ message: "อัปเดตสำเร็จ" });
  } catch (err) { next(err); }
}
 
// PATCH /school/testimonials/:id  — toggle is_published
export async function patchTestimonial(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const testimonial_id = Number(req.params.id);
    const { is_published } = req.body;
 
    await db.query(
      `UPDATE testimonials SET is_published = ?
       WHERE testimonial_id = ? AND school_id = ?`,
      [is_published ? 1 : 0, testimonial_id, school_id]
    );
 
    res.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (err) { next(err); }
}
 
// DELETE /school/testimonials/:id
export async function deleteTestimonial(req, res, next) {
  try {
    const school_id = req.user.school_id;
    const testimonial_id = Number(req.params.id);
 
    const [rows] = await db.query(
      "SELECT image_public_id FROM testimonials WHERE testimonial_id = ? AND school_id = ? LIMIT 1",
      [testimonial_id, school_id]
    );
    if (!rows[0]) return res.status(403).json({ message: "ไม่พบหรือไม่มีสิทธิ์" });
 
    if (rows[0].image_public_id) {
      await cloudinary.uploader.destroy(rows[0].image_public_id);
    }
 
    await db.query(
      "DELETE FROM testimonials WHERE testimonial_id = ? AND school_id = ?",
      [testimonial_id, school_id]
    );
 
    res.json({ message: "ลบสำเร็จ" });
  } catch (err) { next(err); }
}

// GET /school/dashboard
export async function getSchoolDashboard(req, res, next) {
  try {
    const school_id = req.user.school_id;

    // ── 1. Latest project ─────────────────────────────────────────────────────
    const [[project]] = await db.query(
      `SELECT
         dr.request_id, dr.request_title, dr.status,
         dr.end_date, dr.request_image_url,
         DATEDIFF(dr.end_date, CURDATE()) AS days_remaining,
         COALESCE((SELECT SUM(sn.quantity_needed)
                   FROM student_need sn JOIN students st ON st.student_id = sn.student_id
                   WHERE st.request_id = dr.request_id), 0) AS total_needed,
         COALESCE((SELECT SUM(f.quantity_fulfilled)
                   FROM fulfillment f WHERE f.request_id = dr.request_id), 0) AS total_fulfilled,
         COALESCE((SELECT SUM(don.quantity) FROM donation_record don
                   WHERE don.request_id = dr.request_id AND don.status = 'approved'
                   AND don.condition_status = 'usable'), 0) AS total_received,
         COALESCE((SELECT COUNT(*) FROM students st WHERE st.request_id = dr.request_id), 0) AS student_count
       FROM donation_request dr
       WHERE dr.school_id = ?
       ORDER BY dr.created_at DESC LIMIT 1`,
      [school_id]
    );

    if (!project) return res.json({ project: null, stats: {}, chart_by_level: [], chart_by_status: {}, action_items: [], testimonials: [] });

    const rid = project.request_id;

    // คำนวณ total_fulfilled จาก snapshot (per-type, capped) แทน fulfillment table
    try {
      const parseJ = (v) => { try { return typeof v === "string" ? JSON.parse(v) : (v || null); } catch { return null; } };
      const [[snapRows], [needRows]] = await Promise.all([
        db.query(`SELECT items_snapshot, items_condition_snapshot, condition_status FROM donation_record WHERE request_id = ? AND status = 'approved'`, [rid]),
        db.query(`SELECT sn.uniform_type_id, SUM(sn.quantity_needed) AS qty FROM student_need sn JOIN students st ON st.student_id = sn.student_id WHERE st.request_id = ? GROUP BY sn.uniform_type_id`, [rid]),
      ]);
      const typeNeeded = {};
      for (const r of needRows) typeNeeded[String(r.uniform_type_id)] = Number(r.qty);
      const fulfilledByType = {};
      for (const d of snapRows) {
        const condSnap = parseJ(d.items_condition_snapshot);
        if (Array.isArray(condSnap) && condSnap.length > 0) {
          for (const it of condSnap) {
            if (it.item_condition === "usable") {
              const tid = String(it.uniform_type_id);
              fulfilledByType[tid] = (fulfilledByType[tid] || 0) + Number(it.qty_received || 0);
            }
          }
        } else if (d.condition_status === "usable") {
          const snap = parseJ(d.items_snapshot);
          if (Array.isArray(snap)) {
            for (const it of snap) {
              const tid = String(it.uniform_type_id);
              fulfilledByType[tid] = (fulfilledByType[tid] || 0) + Number(it.quantity || 0);
            }
          }
        }
      }
      let capped = 0;
      for (const [tid, fulfilled] of Object.entries(fulfilledByType)) {
        capped += Math.min(fulfilled, typeNeeded[tid] || 0);
      }
      project.total_fulfilled = capped;
    } catch { /* noop */ }

    // ── 2. Stats ──────────────────────────────────────────────────────────────
    const [[stats]] = await db.query(
      `SELECT
         SUM(CASE WHEN status = 'pending' AND delivery_method != 'dropoff' THEN 1 ELSE 0 END) AS pending_postal,
         SUM(CASE WHEN status = 'pending' AND delivery_method = 'dropoff'  THEN 1 ELSE 0 END) AS pending_dropoff,
         SUM(CASE WHEN status = 'pending' AND delivery_method != 'dropoff' THEN quantity ELSE 0 END) AS pending_postal_qty,
         SUM(CASE WHEN status = 'pending' AND delivery_method = 'dropoff'  THEN quantity ELSE 0 END) AS pending_dropoff_qty,
         SUM(CASE WHEN status = 'approved' AND condition_status = 'usable'
                       AND (SELECT COALESCE(SUM(sn.quantity_received), 0)
                            FROM fulfillment f
                            JOIN student_need sn ON sn.student_need_id = f.request_item_id
                            WHERE f.donation_id = donation_record.donation_id) > 0
             THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status = 'approved' AND condition_status = 'usable' THEN quantity ELSE 0 END) AS approved_qty,
         COUNT(*) AS total
       FROM donation_record WHERE request_id = ?`,
      [rid]
    );

    // ── 3. Chart by education level ───────────────────────────────────────────
    const [levelRows] = await db.query(
      `SELECT
         CASE
           WHEN st.education_level_group REGEXP 'อนุบาล|kg|Kindergarten' THEN 'อนุบาล'
           WHEN st.education_level_group REGEXP 'ป\\\\.|ประถม' THEN 'ประถมศึกษา'
           WHEN st.education_level_group REGEXP 'ม\\\\.[4-6]|มัธยมปลาย|มัธยมตอนปลาย' THEN 'มัธยมตอนปลาย'
           ELSE 'มัธยมตอนต้น'
         END AS level,
         COALESCE(SUM(sn.quantity_needed), 0) AS total_needed
       FROM students st
       LEFT JOIN student_need sn ON sn.student_id = st.student_id
       WHERE st.request_id = ?
       GROUP BY level`,
      [rid]
    );

    // กระจาย fulfilled proportionally ตาม level's share
    const totalNeededAll = levelRows.reduce((s, r) => s + Number(r.total_needed), 0);
    const totalFulfilled = Number(project.total_fulfilled) || 0;
    const chart_by_level = ["อนุบาล", "ประถมศึกษา", "มัธยมตอนต้น", "มัธยมตอนปลาย"].map(level => {
      const row = levelRows.find(r => r.level === level);
      const needed = Number(row?.total_needed || 0);
      const received = totalNeededAll > 0 ? Math.round((needed / totalNeededAll) * totalFulfilled) : 0;
      return { level, received: Math.min(received, needed), remaining: Math.max(needed - received, 0) };
    });

    // ── 4. Chart by status ────────────────────────────────────────────────────
    const [statusRows] = await db.query(
      `SELECT status, condition_status, COUNT(*) AS cnt FROM donation_record WHERE request_id = ? GROUP BY status, condition_status`,
      [rid]
    );
    const chart_by_status = { pending: 0, approved: 0, wrong_item: 0, not_sent: 0, dropoff: 0, rejected: 0 };
    for (const r of statusRows) {
      if (r.status === 'pending') chart_by_status.pending += Number(r.cnt);
      else if (r.status === 'rejected') chart_by_status.rejected += Number(r.cnt);
      else if (r.status === 'approved') {
        if (r.condition_status === 'wrong_item') chart_by_status.wrong_item += Number(r.cnt);
        else if (r.condition_status === 'not_sent') chart_by_status.not_sent += Number(r.cnt);
        else chart_by_status.approved += Number(r.cnt);
      }
    }
    const [dropoffPending] = await db.query(
      `SELECT COUNT(*) AS cnt FROM donation_record WHERE request_id = ? AND delivery_method = 'dropoff' AND status = 'pending'`,
      [rid]
    );
    chart_by_status.dropoff = Number(dropoffPending[0]?.cnt || 0);
    chart_by_status.pending -= chart_by_status.dropoff;

    // ── 5. Action items ───────────────────────────────────────────────────────
    const [pendingPostalList] = await db.query(
      `SELECT donation_id, donor_name, quantity, created_at, delivery_method
       FROM donation_record
       WHERE request_id = ? AND status = 'pending' AND delivery_method != 'dropoff'
       ORDER BY created_at ASC LIMIT 8`,
      [rid]
    );

    const [pendingDropoffList] = await db.query(
      `SELECT donation_id, donor_name, quantity, donation_date, donation_time, donor_phone,
              (DATE(donation_date) = CURDATE()) AS is_today,
              (donation_date IS NOT NULL AND TIMESTAMPDIFF(DAY, donation_date, DATE_ADD(NOW(), INTERVAL 7 HOUR)) >= 3) AS is_overdue
       FROM donation_record
       WHERE request_id = ? AND delivery_method = 'dropoff' AND status = 'pending'
       ORDER BY donation_date IS NULL ASC, donation_date ASC LIMIT 8`,
      [rid]
    );

    // ── 6. Testimonials ───────────────────────────────────────────────────────
    const [testimonials] = await db.query(
      `SELECT t.testimonial_id, t.review_title, t.review_text,
              DATE_FORMAT(t.review_date, '%e %b. %Y') AS review_date,
              t.image_url, dr.request_title AS project_title,
              u.user_name AS recorded_by_name
       FROM testimonials t
       LEFT JOIN donation_request dr ON dr.request_id = t.request_id
       LEFT JOIN users u ON u.user_id = t.recorded_by_user_id
       WHERE t.school_id = ? AND t.is_published = 1
       ORDER BY t.review_date DESC LIMIT 3`,
      [school_id]
    );

    res.json({
      project: { ...project, total_needed: Number(project.total_needed), total_fulfilled: Number(project.total_fulfilled) },
      stats: {
        pending_postal:  Number(stats.pending_postal  || 0),
        pending_dropoff: Number(stats.pending_dropoff || 0),
        approved:        Number(stats.approved        || 0),
        students_waiting: Number(project.student_count || 0),
      },
      chart_by_level,
      chart_by_status,
      action_items: {
        pending_postal_list:  pendingPostalList,
        pending_dropoff_list: pendingDropoffList,
      },
      testimonials,
    });
  } catch (err) { next(err); }
}