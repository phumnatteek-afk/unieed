// src/utils/studentValidation.js
// ─────────────────────────────────────────────────────────────────────────────
// Validation กลาง — ใช้ได้ทั้ง frontend (StudentModal, ExcelImport) และ backend
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────
export const VALID_GENDERS        = ["male", "female"];
export const VALID_LEVELS         = ["อนุบาล", "ประถมศึกษา", "มัธยมตอนต้น", "มัธยมตอนปลาย"];
export const VALID_URGENCIES      = ["very_urgent", "urgent", "can_wait"];
export const VALID_SUPPORT_MODES  = ["one_time", "recurring"];
export const VALID_SIZES          = {
  chest: [26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46],
  waist: [22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42],
};
export const MAX_QUANTITY         = 10;
export const MAX_SUPPORT_YEARS    = 10;
export const MAX_NAME_LENGTH      = 100;

// ── Rule 1: ชื่อ-นามสกุล ─────────────────────────────────
// ❌ ตัวเลขล้วน, ว่าง, สั้นเกิน 2 ตัวอักษร, มีอักขระพิเศษ
const NAME_ONLY_DIGITS  = /^\d+$/;
const NAME_VALID_CHARS  = /^[ก-๙a-zA-Z\s.\-']+$/u; // ไทย + อังกฤษ + . - ' และช่องว่าง
const NAME_HAS_SPACE    = /\s/; // ต้องมีนามสกุล (มีช่องว่าง)

export function validateName(name) {
  const errs = [];
  const n = String(name ?? "").trim();

  if (!n)                          errs.push("กรุณากรอกชื่อ-นามสกุล");
  else if (n.length < 3)           errs.push("ชื่อ-นามสกุลสั้นเกินไป (อย่างน้อย 3 ตัวอักษร)");
  else if (n.length > MAX_NAME_LENGTH) errs.push(`ชื่อ-นามสกุลยาวเกินไป (สูงสุด ${MAX_NAME_LENGTH} ตัวอักษร)`);
  else if (NAME_ONLY_DIGITS.test(n))    errs.push("ชื่อ-นามสกุลไม่สามารถเป็นตัวเลขล้วนได้");
  else if (!NAME_VALID_CHARS.test(n))   errs.push("ชื่อ-นามสกุลมีอักขระที่ไม่อนุญาต (ใช้ได้เฉพาะภาษาไทย/อังกฤษ)");
  else if (!NAME_HAS_SPACE.test(n))     errs.push("กรุณากรอกทั้งชื่อและนามสกุล (คั่นด้วยช่องว่าง)");

  return errs;
}

// ── Rule 2: เพศ ───────────────────────────────────────────
export function validateGender(gender) {
  if (!VALID_GENDERS.includes(gender))
    return [`เพศไม่ถูกต้อง: "${gender}" (ใช้ได้: ชาย / หญิง)`];
  return [];
}

// ── Rule 3: ระดับชั้น ─────────────────────────────────────
export function validateLevel(level) {
  if (!VALID_LEVELS.includes(level))
    return [`ระดับชั้นไม่ถูกต้อง: "${level}" (ใช้ได้: ${VALID_LEVELS.join(" / ")})`];
  return [];
}

// ── Rule 4: ความเร่งด่วน ──────────────────────────────────
export function validateUrgency(urgency) {
  if (!VALID_URGENCIES.includes(urgency))
    return [`ความเร่งด่วนไม่ถูกต้อง: "${urgency}"`];
  return [];
}

// ── Rule 5: รายการชุด (needs) ────────────────────────────
export function validateNeeds(needs) {
  const errs = [];
  if (!Array.isArray(needs) || needs.length === 0) {
    return ["ต้องมีรายการชุดอย่างน้อย 1 รายการ"];
  }

  // ตรวจ duplicate uniform_type_id ใน needs เดียวกัน
  const typeIds = needs.map(n => n.uniform_type_id).filter(Boolean);
  const dupTypes = typeIds.filter((id, i) => typeIds.indexOf(id) !== i);
  if (dupTypes.length) errs.push(`มีรายการชุดประเภทซ้ำกัน (type_id: ${[...new Set(dupTypes)].join(", ")})`);

  needs.forEach((n, i) => {
    const label = `รายการที่ ${i + 1}`;
    if (!n.uniform_type_id)
      errs.push(`${label}: ยังไม่ได้เลือกประเภทชุด`);
    const qty = Number(n.quantity_needed);
    if (!qty || qty < 1)
      errs.push(`${label}: จำนวนต้องมากกว่า 0`);
    else if (qty > MAX_QUANTITY)
      errs.push(`${label}: จำนวนสูงสุด ${MAX_QUANTITY} ชิ้น`);
    if (!n.size || Object.keys(n.size ?? {}).length === 0)
      errs.push(`${label}: ยังไม่ได้กรอกขนาด`);
  });

  return errs;
}

// ── Rule 6: support_mode / support_years ─────────────────
export function validateSupportMode(support_mode, support_years) {
  const errs = [];
  if (!VALID_SUPPORT_MODES.includes(support_mode))
    errs.push(`รูปแบบการรับไม่ถูกต้อง: "${support_mode}"`);
  if (support_mode === "recurring") {
    const y = Number(support_years);
    if (!y || y < 1)             errs.push("กรอกจำนวนปีสำหรับการรับต่อเนื่อง");
    else if (y > MAX_SUPPORT_YEARS) errs.push(`จำนวนปีสูงสุด ${MAX_SUPPORT_YEARS} ปี`);
  }
  return errs;
}

// ─────────────────────────────────────────────────────────
// validateStudent — validate นักเรียน 1 คนครบทุก field
// คืน [] ถ้า valid, หรือ string[] ของข้อผิดพลาด
// ─────────────────────────────────────────────────────────
export function validateStudent(s) {
  return [
    ...validateName(s.student_name),
    ...validateGender(s.gender),
    ...validateLevel(s.education_level),
    ...validateUrgency(s.urgency),
    ...validateSupportMode(s.support_mode ?? s.needs?.[0]?.support_mode, s.support_years ?? s.needs?.[0]?.support_years),
    ...validateNeeds(s.needs),
  ];
}

// ─────────────────────────────────────────────────────────
// detectDuplicates — ตรวจสอบความซ้ำในรายการนักเรียน
//
// กฎ:
//  • ชื่อ + เพศ + ระดับ + ความเร่งด่วน ตรงกัน 3 ขึ้นไป → "คนเดียวกัน" → แจ้งเตือน ซ้ำ
//  • ชื่อ + เพศ + ระดับ + ความเร่งด่วน ครบทุก field ตรงกัน แต่ needs ต่าง → UPDATE
//  • ชื่อ + เพศ + ระดับ + ความเร่งด่วน + needs เหมือนกันทั้งหมด → ซ้ำซ้อน 100%
//
// คืน Map<index, { type: "duplicate"|"update"|"exact", matchIndex: number, matchFields: string[] }>
// ─────────────────────────────────────────────────────────
export function detectDuplicates(students) {
  const results = new Map(); // index → { type, matchIndex, matchFields }

  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      const a = students[i], b = students[j];
      const matchFields = [];

      if (normalize(a.student_name) === normalize(b.student_name)) matchFields.push("ชื่อ-นามสกุล");
      if (a.gender === b.gender)           matchFields.push("เพศ");
      if (a.education_level === b.education_level) matchFields.push("ระดับชั้น");
      if (a.urgency === b.urgency)         matchFields.push("ความเร่งด่วน");

      if (matchFields.length < 3) continue; // ไม่ถือว่าซ้ำ

      // ตรวจว่า needs ต่างกันไหม (= UPDATE case)
      const needsA = JSON.stringify(normalizeNeeds(a.needs));
      const needsB = JSON.stringify(normalizeNeeds(b.needs));
      const needsSame = needsA === needsB;

      const type = needsSame ? "exact" : matchFields.length === 4 ? "update" : "duplicate";

      // บันทึกทั้ง i และ j
      if (!results.has(j)) {
        results.set(j, { type, matchIndex: i, matchFields });
      }
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────
// detectDuplicatesWithExisting — เปรียบกับ student ใน DB
// existingStudents: array ของนักเรียนที่มีอยู่แล้วใน DB
// newStudents: array ที่กำลังจะ import/เพิ่ม
//
// คืน Map<newIndex, { type, existingStudent, matchFields }>
// ─────────────────────────────────────────────────────────
export function detectDuplicatesWithExisting(newStudents, existingStudents) {
  const results = new Map();

  for (let i = 0; i < newStudents.length; i++) {
    const n = newStudents[i];
    for (const ex of existingStudents) {
      const matchFields = [];

      if (normalize(n.student_name) === normalize(ex.student_name)) matchFields.push("ชื่อ-นามสกุล");
      if (n.gender === ex.gender)           matchFields.push("เพศ");
      if (n.education_level === ex.education_level) matchFields.push("ระดับชั้น");
      if (n.urgency === ex.urgency)         matchFields.push("ความเร่งด่วน");

      if (matchFields.length < 3) continue;

      const needsSame = JSON.stringify(normalizeNeeds(n.needs)) === JSON.stringify(normalizeNeeds(ex.needs));
      const type = needsSame ? "exact" : matchFields.length === 4 ? "update" : "duplicate";

      results.set(i, { type, existingStudent: ex, matchFields });
      break; // หาเจอตัวแรกพอ
    }
  }
  return results;
}

// ── helpers ───────────────────────────────────────────────
function normalize(str) {
  return String(str ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeNeeds(needs) {
  if (!Array.isArray(needs)) return [];
  return [...needs]
    .map(n => ({
      type: Number(n.uniform_type_id),
      size: typeof n.size === "string" ? JSON.parse(n.size || "{}") : (n.size ?? {}),
      qty: Number(n.quantity_needed),
    }))
    .sort((a, b) => a.type - b.type);
}