import { getSchoolMe } from "./school.service.js";
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

/**
 * สมมติว่า middleware auth ใส่ req.user = { user_id, role, school_id }
 * และโรงเรียนเข้า role: school_admin
 */

export async function getUniformTypes(req, res) {
  const [rows] = await db.query(
    `SELECT uniform_type_id,
            type_name AS uniform_type_name,
            gender,
            size_schema
     FROM uniform_type
     ORDER BY type_name ASC`
  );

  res.json(rows);
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


export async function createStudentWithNeeds(req, res) {
  const request_id = Number(req.params.request_id);
  const school_id = req.user.school_id;
  const {
    student_name,
    education_level,
    gender,
    urgency, // very_urgent | urgent | can_wait
    needs,   // [{uniform_type_id,size,quantity_needed,support_mode,support_years,status}]
  } = req.body;
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

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO students (school_id, request_id, student_name, education_level, gender, urgency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [school_id, request_id, student_name, education_level, genderDb, urgency || "can_wait"]
    );

    const student_id = ins.insertId;
for (const n of needs) {
  if (!n.uniform_type_id || !n.size || !n.quantity_needed) {
    throw Object.assign(new Error("ข้อมูลความต้องการไม่ครบ"), { status: 400 });
  }

  const needQty = Number(n.quantity_needed);
  const recvQty = Math.max(0, Math.min(Number(n.quantity_received || 0), needQty));

  // สร้าง status จากจำนวนที่ได้รับแล้ว
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
      school_id,
      student_id,
      n.uniform_type_id,
      n.size,
      needQty,
      recvQty,
      status,
      n.support_mode || "one_time",
      n.support_mode === "recurring" ? Number(n.support_years || 1) : null,
    ]
  );
}


    await conn.commit();
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
  const { student_name, education_level, gender, urgency, needs } = req.body;

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

    await conn.query(
      `UPDATE students
       SET student_name=?, education_level=?, gender=?, urgency=?
       WHERE student_id=? AND school_id=?`,
      [student_name, education_level, genderDb, urgency, student_id, school_id]
    );

    // strategy: ลบ needs เดิม แล้ว insert ใหม่ (ง่าย + กัน mismatch)
   await conn.query(
  `DELETE FROM student_need WHERE student_id=? AND school_id=?`,
  [student_id, school_id]
);


    if (!Array.isArray(needs) || needs.length === 0) {
      throw Object.assign(new Error("ต้องมีอย่างน้อย 1 รายการความต้องการ"), { status: 400 });
    }
for (const n of needs) {

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
      school_id,
      student_id,
      n.uniform_type_id,
      n.size,
      needQty,
      recvQty,
      status,
      n.support_mode || "one_time",
      n.support_mode === "recurring" ? Number(n.support_years || 1) : null,
    ]
  );
}


    await conn.commit();
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
    } = req.body;

    if (!request_title?.trim()) {
      return res.status(400).json({ message: "กรุณากรอกชื่อโครงการ" });
    }

    const [result] = await db.query(
      `INSERT INTO donation_request
        (school_id, request_title, request_description, request_image_url, request_image_public_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', NOW())`,
      [
        school_id,
        request_title.trim(),
        request_description || null,
        request_image_url || null,
        request_image_public_id || null,
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
      `SELECT request_id, request_title, status, created_at
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
      `SELECT request_id, request_title, request_description, request_image_url, request_image_public_id, status, created_at
       FROM donation_request
       WHERE school_id = ?
       ORDER BY request_id DESC
       LIMIT 1`,
      [school_id]
    );

    res.json(rows[0] || null);
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

