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


// ส่วนดีเทลการ์ด
export async function getProjectByIdPublic(req, res, next) {
  try {
    const request_id = Number(req.params.request_id);

    const [rows] = await db.query(
      `SELECT dr.request_id,
              dr.request_title,
              dr.request_description,
              dr.request_image_url,
              dr.status,
              dr.created_at,
              s.school_name,
              s.school_address,
              s.school_phone
     
       FROM donation_request dr
       JOIN schools s ON s.school_id = dr.school_id
       WHERE dr.request_id = ? LIMIT 1`,
      [request_id]
    );

    res.json(rows[0] || null);
  } catch (err) {
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


// ── Export นักเรียนทั้งหมดในโครงการเป็น Excel ────────────
// GET /school/projects/:request_id/students/export
// ใช้ library: exceljs  →  npm install exceljs
export async function exportStudentsExcel(req, res, next) {
  try {
    const request_id = Number(req.params.request_id);
    const school_id  = req.user.school_id;

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
    const BLUE      = "FF29B6E8";
    const BLUE_DARK = "FF0E8BB5";
    const BLUE_LT   = "FFE0F7FF";
    const MALE_HD   = "FF1565C0";
    const MALE_BG   = "FFE3F2FD";
    const FEM_HD    = "FFAD1457";
    const FEM_BG    = "FFFCE4EC";
    const WHITE     = "FFFFFFFF";
    const GRAY      = "FFF4F8FB";
    const SUPP_BG   = "FFD6EEF8";

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
      { col: "A", label: "#",                         bg: BLUE,    fg: WHITE  },
      { col: "B", label: "ชื่อ-นามสกุล",              bg: BLUE,    fg: WHITE  },
      { col: "C", label: "เพศ",                        bg: BLUE,    fg: WHITE  },
      { col: "D", label: "ระดับชั้น",                  bg: BLUE,    fg: WHITE  },
      { col: "E", label: "ความเร่งด่วน",               bg: BLUE,    fg: WHITE  },
      { col: "F", label: "การรับ",                     bg: BLUE_DARK, fg: WHITE },
      { col: "G", label: "จำนวนปี",                   bg: BLUE_DARK, fg: WHITE },
      { col: "H", label: "รอบอก (cm)\nเสื้อชาย",      bg: MALE_BG,  fg: MALE_HD },
      { col: "I", label: "จำนวน (ตัว)\nเสื้อชาย",     bg: MALE_BG,  fg: MALE_HD },
      { col: "J", label: "รอบเอว (cm)\nกางเกงชาย",    bg: MALE_BG,  fg: MALE_HD },
      { col: "K", label: "จำนวน (ตัว)\nกางเกงชาย",    bg: MALE_BG,  fg: MALE_HD },
      { col: "L", label: "รอบอก (cm)\nเสื้อหญิง",     bg: FEM_BG,   fg: FEM_HD  },
      { col: "M", label: "จำนวน (ตัว)\nเสื้อหญิง",    bg: FEM_BG,   fg: FEM_HD  },
      { col: "N", label: "รอบเอว (cm)\nกระโปรงหญิง",  bg: FEM_BG,   fg: FEM_HD  },
      { col: "O", label: "จำนวน (ตัว)\nกระโปรงหญิง",  bg: FEM_BG,   fg: FEM_HD  },
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
    const GENDER_TH  = { male: "ชาย", female: "หญิง" };

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
      const firstNeed   = needs[0];
      const supportMode = firstNeed?.support_mode === "recurring" ? "รับต่อเนื่อง" : "รับครั้งเดียว";
      const supportYears= firstNeed?.support_mode === "recurring" ? (firstNeed.support_years || 1) : "";

      const n1 = getNeed(1); // เสื้อชาย
      const n3 = getNeed(3); // กางเกงชาย
      const n2 = getNeed(2); // เสื้อหญิง
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
        const isMale    = ["H","I","J","K"].includes(colLetter);
        const isFemale  = ["L","M","N","O"].includes(colLetter);
        const isSupport = ["F","G"].includes(colLetter);
        const cellBg    = isMale ? (idx%2===0?"FFE3F2FD":"FFF3F8FF")
                        : isFemale ? (idx%2===0?"FFFCE4EC":"FFFFF0F5")
                        : isSupport ? (idx%2===0?"FFD6EEF8":"FFE4F4FB")
                        : bg;

        const c = ws.getCell(`${colLetter}${rowNum}`);
        c.value = val === "" ? null : val;
        c.font  = { name: "Arial", size: 10 };
        c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: cellBg } };
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
    sumCell.font  = { name: "Arial", bold: true, size: 10, color: { argb: WHITE } };
    sumCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_DARK } };
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