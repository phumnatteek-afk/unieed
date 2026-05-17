/**
 * migrate.js — รัน ALTER TABLE อัตโนมัติตอน server start
 * เพิ่ม column ที่ขาดโดยไม่กระทบ column ที่มีอยู่แล้ว
 */
import { db } from "./db.js";

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
  const exists = await columnExists(table, column);
  if (!exists) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[migrate] Added ${table}.${column}`);
  }
}

export async function runMigrations() {
  try {
    // ── orders ────────────────────────────────────────────
    await addColumnIfMissing("orders", "seller_id",            "INT NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "platform_fee",         "DECIMAL(10,2) NOT NULL DEFAULT 0");
    await addColumnIfMissing("orders", "seller_payout_amount", "DECIMAL(10,2) NOT NULL DEFAULT 0");
    await addColumnIfMissing("orders", "payout_status",        "ENUM('none','pending','paid') NOT NULL DEFAULT 'none'");
    await addColumnIfMissing("orders", "payout_id",            "INT NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "payout_date",          "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "tracking_number",      "VARCHAR(100) NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "shipping_date",        "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "completed_at",         "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "request_id",           "INT NULL DEFAULT NULL");

    // ── users (bank account + suspend) ───────────────────
    await addColumnIfMissing("users", "bank_code",             "VARCHAR(20) NULL DEFAULT NULL");
    await addColumnIfMissing("users", "bank_account_number",   "TEXT NULL DEFAULT NULL");
    await addColumnIfMissing("users", "bank_account_name",     "VARCHAR(200) NULL DEFAULT NULL");
    await addColumnIfMissing("users", "strike_count",          "INT NOT NULL DEFAULT 0");
    await addColumnIfMissing("users", "suspended_until",       "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("users", "strike_reset_count",    "INT NOT NULL DEFAULT 0");
    // รองรับสถานะ suspended (ระงับชั่วคราว)
    try {
      await db.query(`
        ALTER TABLE users MODIFY COLUMN status
          ENUM('active','pending','rejected','banned','suspended')
          NOT NULL DEFAULT 'pending'
      `);
    } catch (_) { /* column อาจมี enum นี้อยู่แล้ว */ }

    // ── schools.verification_status — รองรับ suspended ──────────────────
    try {
      await db.query(`
        ALTER TABLE schools MODIFY COLUMN verification_status
          ENUM('pending','approved','rejected','suspended')
          NOT NULL DEFAULT 'pending'
      `);
    } catch (_) { /* enum อาจครบแล้ว */ }

    // ── orders.order_status — รองรับทุก status ที่ระบบใช้ ─────────────────
    try {
      await db.query(`
        ALTER TABLE orders MODIFY COLUMN order_status
          ENUM('pending','confirmed','shipping','delivered','cancelled')
          NOT NULL DEFAULT 'pending'
      `);
    } catch (_) { /* enum อาจครบแล้ว */ }

    // ── address (เพิ่ม amphoe) ────────────────────────────
    await addColumnIfMissing("address", "amphoe", "VARCHAR(100) NULL DEFAULT NULL AFTER district");

    // ── students (รหัสนักเรียน) ───────────────────────────
    await addColumnIfMissing("students", "student_code", "VARCHAR(50) NULL DEFAULT NULL");

    // Backfill student_code สำหรับนักเรียนที่มีอยู่แล้ว (student_code = NULL)
    try {
      const [noCodeStudents] = await db.query(
        `SELECT student_id, school_id FROM students
         WHERE student_code IS NULL
         ORDER BY school_id ASC, student_id ASC`
      );
      if (noCodeStudents.length > 0) {
        // หา max code ปัจจุบันต่อโรงเรียน
        const [maxCodes] = await db.query(
          `SELECT school_id, MAX(CAST(student_code AS UNSIGNED)) AS max_num
           FROM students WHERE student_code IS NOT NULL
           GROUP BY school_id`
        );
        const counterBySchool = {};
        for (const r of maxCodes) counterBySchool[r.school_id] = Number(r.max_num) || 0;

        for (const s of noCodeStudents) {
          counterBySchool[s.school_id] = (counterBySchool[s.school_id] || 0) + 1;
          const code = String(counterBySchool[s.school_id]).padStart(5, "0");
          await db.query(
            `UPDATE students SET student_code = ? WHERE student_id = ?`,
            [code, s.student_id]
          );
        }
        console.log(`[migrate] Backfilled student_code for ${noCodeStudents.length} students`);
      }
    } catch (backfillErr) {
      console.warn("[migrate] student_code backfill warning:", backfillErr.message);
    }

    // ── schools (จังหวัด สำหรับค้นหาใกล้ฉัน) ────────────
    await addColumnIfMissing("schools", "province", "VARCHAR(100) NULL DEFAULT NULL");
    // script สกัดจังหวัดจาก school_address ครั้งเดียว
    await db.query(`
      UPDATE schools
      SET province = (
        CASE
          WHEN school_address LIKE '%กรุงเทพ%'       THEN 'กรุงเทพมหานคร'
          WHEN school_address LIKE '%กระบี่%'         THEN 'กระบี่'
          WHEN school_address LIKE '%กาญจนบุรี%'      THEN 'กาญจนบุรี'
          WHEN school_address LIKE '%กาฬสินธุ์%'      THEN 'กาฬสินธุ์'
          WHEN school_address LIKE '%กำแพงเพชร%'      THEN 'กำแพงเพชร'
          WHEN school_address LIKE '%ขอนแก่น%'        THEN 'ขอนแก่น'
          WHEN school_address LIKE '%จันทบุรี%'        THEN 'จันทบุรี'
          WHEN school_address LIKE '%ฉะเชิงเทรา%'     THEN 'ฉะเชิงเทรา'
          WHEN school_address LIKE '%ชลบุรี%'         THEN 'ชลบุรี'
          WHEN school_address LIKE '%ชัยนาท%'         THEN 'ชัยนาท'
          WHEN school_address LIKE '%ชัยภูมิ%'        THEN 'ชัยภูมิ'
          WHEN school_address LIKE '%ชุมพร%'          THEN 'ชุมพร'
          WHEN school_address LIKE '%เชียงราย%'       THEN 'เชียงราย'
          WHEN school_address LIKE '%เชียงใหม่%'      THEN 'เชียงใหม่'
          WHEN school_address LIKE '%ตรัง%'           THEN 'ตรัง'
          WHEN school_address LIKE '%ตราด%'           THEN 'ตราด'
          WHEN school_address LIKE '%ตาก%'            THEN 'ตาก'
          WHEN school_address LIKE '%นครนายก%'        THEN 'นครนายก'
          WHEN school_address LIKE '%นครปฐม%'         THEN 'นครปฐม'
          WHEN school_address LIKE '%นครพนม%'         THEN 'นครพนม'
          WHEN school_address LIKE '%นครราชสีมา%'     THEN 'นครราชสีมา'
          WHEN school_address LIKE '%นครศรีธรรมราช%'  THEN 'นครศรีธรรมราช'
          WHEN school_address LIKE '%นครสวรรค์%'      THEN 'นครสวรรค์'
          WHEN school_address LIKE '%นนทบุรี%'        THEN 'นนทบุรี'
          WHEN school_address LIKE '%นราธิวาส%'       THEN 'นราธิวาส'
          WHEN school_address LIKE '%น่าน%'           THEN 'น่าน'
          WHEN school_address LIKE '%บึงกาฬ%'         THEN 'บึงกาฬ'
          WHEN school_address LIKE '%บุรีรัมย์%'      THEN 'บุรีรัมย์'
          WHEN school_address LIKE '%ปทุมธานี%'       THEN 'ปทุมธานี'
          WHEN school_address LIKE '%ประจวบคีรีขันธ์%' THEN 'ประจวบคีรีขันธ์'
          WHEN school_address LIKE '%ปราจีนบุรี%'     THEN 'ปราจีนบุรี'
          WHEN school_address LIKE '%ปัตตานี%'        THEN 'ปัตตานี'
          WHEN school_address LIKE '%พระนครศรีอยุธยา%' THEN 'พระนครศรีอยุธยา'
          WHEN school_address LIKE '%พะเยา%'          THEN 'พะเยา'
          WHEN school_address LIKE '%พังงา%'          THEN 'พังงา'
          WHEN school_address LIKE '%พัทลุง%'         THEN 'พัทลุง'
          WHEN school_address LIKE '%พิจิตร%'         THEN 'พิจิตร'
          WHEN school_address LIKE '%พิษณุโลก%'       THEN 'พิษณุโลก'
          WHEN school_address LIKE '%เพชรบุรี%'       THEN 'เพชรบุรี'
          WHEN school_address LIKE '%เพชรบูรณ์%'      THEN 'เพชรบูรณ์'
          WHEN school_address LIKE '%แพร่%'           THEN 'แพร่'
          WHEN school_address LIKE '%ภูเก็ต%'         THEN 'ภูเก็ต'
          WHEN school_address LIKE '%มหาสารคาม%'      THEN 'มหาสารคาม'
          WHEN school_address LIKE '%มุกดาหาร%'       THEN 'มุกดาหาร'
          WHEN school_address LIKE '%แม่ฮ่องสอน%'     THEN 'แม่ฮ่องสอน'
          WHEN school_address LIKE '%ยโสธร%'          THEN 'ยโสธร'
          WHEN school_address LIKE '%ยะลา%'           THEN 'ยะลา'
          WHEN school_address LIKE '%ร้อยเอ็ด%'       THEN 'ร้อยเอ็ด'
          WHEN school_address LIKE '%ระนอง%'          THEN 'ระนอง'
          WHEN school_address LIKE '%ระยอง%'          THEN 'ระยอง'
          WHEN school_address LIKE '%ราชบุรี%'        THEN 'ราชบุรี'
          WHEN school_address LIKE '%ลพบุรี%'         THEN 'ลพบุรี'
          WHEN school_address LIKE '%ลำปาง%'          THEN 'ลำปาง'
          WHEN school_address LIKE '%ลำพูน%'          THEN 'ลำพูน'
          WHEN school_address LIKE '%เลย%'            THEN 'เลย'
          WHEN school_address LIKE '%ศรีสะเกษ%'       THEN 'ศรีสะเกษ'
          WHEN school_address LIKE '%สกลนคร%'         THEN 'สกลนคร'
          WHEN school_address LIKE '%สงขลา%'          THEN 'สงขลา'
          WHEN school_address LIKE '%สตูล%'           THEN 'สตูล'
          WHEN school_address LIKE '%สมุทรปราการ%'    THEN 'สมุทรปราการ'
          WHEN school_address LIKE '%สมุทรสงคราม%'    THEN 'สมุทรสงคราม'
          WHEN school_address LIKE '%สมุทรสาคร%'      THEN 'สมุทรสาคร'
          WHEN school_address LIKE '%สระแก้ว%'        THEN 'สระแก้ว'
          WHEN school_address LIKE '%สระบุรี%'        THEN 'สระบุรี'
          WHEN school_address LIKE '%สิงห์บุรี%'      THEN 'สิงห์บุรี'
          WHEN school_address LIKE '%สุโขทัย%'        THEN 'สุโขทัย'
          WHEN school_address LIKE '%สุพรรณบุรี%'     THEN 'สุพรรณบุรี'
          WHEN school_address LIKE '%สุราษฎร์ธานี%'   THEN 'สุราษฎร์ธานี'
          WHEN school_address LIKE '%สุรินทร์%'       THEN 'สุรินทร์'
          WHEN school_address LIKE '%หนองคาย%'        THEN 'หนองคาย'
          WHEN school_address LIKE '%หนองบัวลำภู%'    THEN 'หนองบัวลำภู'
          WHEN school_address LIKE '%อ่างทอง%'        THEN 'อ่างทอง'
          WHEN school_address LIKE '%อำนาจเจริญ%'     THEN 'อำนาจเจริญ'
          WHEN school_address LIKE '%อุดรธานี%'       THEN 'อุดรธานี'
          WHEN school_address LIKE '%อุตรดิตถ์%'      THEN 'อุตรดิตถ์'
          WHEN school_address LIKE '%อุทัยธานี%'      THEN 'อุทัยธานี'
          WHEN school_address LIKE '%อุบลราชธานี%'    THEN 'อุบลราชธานี'
          ELSE NULL
        END
      )
      WHERE province IS NULL
    `);

    // ── donation_record ───────────────────────────────────
    await addColumnIfMissing("donation_record", "admin_resolved_at",   "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("donation_record", "strike_issued",       "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfMissing("donation_record", "clarification_text",  "TEXT NULL DEFAULT NULL");
    await addColumnIfMissing("donation_record", "clarified_at",        "DATETIME NULL DEFAULT NULL");

    // ── payouts ───────────────────────────────────────────
    // สร้าง table payouts ถ้ายังไม่มี
    await db.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        payout_id       INT AUTO_INCREMENT PRIMARY KEY,
        seller_id       INT NOT NULL,
        net_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
        fee_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
        order_count     INT NOT NULL DEFAULT 0,
        status          ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
        omise_transfer_id VARCHAR(100) NULL,
        slip_url        TEXT NULL,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at    DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("[migrate] ✅ All migrations applied");
  } catch (err) {
    console.error("[migrate] ❌ Migration error:", err.message);
    throw err;
  }
}
