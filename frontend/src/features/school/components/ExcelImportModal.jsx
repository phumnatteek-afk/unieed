import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { schoolRequestSvc } from "../services/schoolRequest.service.js";
import { getBlob } from "../../../api/http.js";
import "../styles/excelImport.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAP_GENDER  = { "ชาย": "male", "หญิง": "female" };
const MAP_URGENCY = { "เร่งด่วนมาก": "very_urgent", "เร่งด่วน": "urgent", "รอได้": "can_wait" };
const MAP_SUPPORT = { "รับครั้งเดียว": "one_time", "รับต่อเนื่อง": "recurring" };
const VALID_LEVELS = ["อนุบาล", "ประถมศึกษา", "มัธยมตอนต้น", "มัธยมตอนปลาย"];
const GENDER_TH  = { male: "ชาย", female: "หญิง" };
const URGENCY_TH = { very_urgent: "เร่งด่วนมาก", urgent: "เร่งด่วน", can_wait: "รอได้" };
const MALE_TYPES = [1, 3];
const FEM_TYPES  = [2, 4];
const U_META = {
  1: { name: "เสื้อนักเรียนชาย",    sizeLabel: "รอบอก",  sizeKey: "chest" },
  2: { name: "เสื้อนักเรียนหญิง",   sizeLabel: "รอบอก",  sizeKey: "chest" },
  3: { name: "กางเกงชาย",   sizeLabel: "รอบเอว", sizeKey: "waist" },
  4: { name: "กระโปรงหญิง", sizeLabel: "รอบเอว", sizeKey: "waist" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapVal(dict, val) {
  const v = String(val ?? "").trim();
  return dict[v] ?? v;
}
function getSize(need) {
  if (!need?.size) return "";
  try {
    const obj = typeof need.size === "string" ? JSON.parse(need.size) : need.size;
    return String(Object.values(obj || {})[0] ?? "");
  } catch { return ""; }
}
function makeSize(typeId, val) {
  return JSON.stringify({ [U_META[typeId]?.sizeKey ?? "size"]: String(val) });
}
function translateGenderInText(text) {
  return text
    .replace(/\bเพศ\s*male\b/g, "เพศชาย")
    .replace(/\bเพศ\s*female\b/g, "เพศหญิง")
    .replace(/\bmale\b/g, "ชาย")
    .replace(/\bfemale\b/g, "หญิง");
}
/** Normalize student codes so "00001" and "1" compare equal */
function normStudentCode(code) {
  const s = String(code ?? "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}
function needsHash(ns) {
  return JSON.stringify(
    (ns || []).map(n => `${n.uniform_type_id}:${JSON.stringify(normalizeSize(n.size))}:${n.quantity_needed}`).sort()
  );
}
function needMatchKeyFromNeed(n) {
  return `${n.uniform_type_id}:${JSON.stringify(normalizeSize(n.size))}`;
}
/** สรุปผล merge สำหรับแสดงใน preview */
function summarizeNeedsMerge(existingNeeds, incomingNeeds) {
  const byKey = new Map();
  for (const ex of existingNeeds || []) byKey.set(needMatchKeyFromNeed(ex), ex);
  let newItems = 0, qtyUpdates = 0;
  for (const inc of incomingNeeds || []) {
    const key = needMatchKeyFromNeed(inc);
    const ex = byKey.get(key);
    if (!ex) newItems++;
    else if (Number(inc.quantity_needed) > Number(ex.quantity_needed)) qtyUpdates++;
  }
  return { newItems, qtyUpdates };
}
function mergeActionLabel(existingStudent, incomingNeeds) {
  const { newItems, qtyUpdates } = summarizeNeedsMerge(existingStudent?.needs, incomingNeeds);
  const parts = [];
  if (newItems > 0) parts.push(`+${newItems} ชุดใหม่`);
  if (qtyUpdates > 0) parts.push(`อัปเดตจำนวน ${qtyUpdates} รายการ`);
  return parts.length ? parts.join(", ") : "อัปเดตข้อมูล";
}
function needsToUniforms(needs) {
  const u = { 1: { size: "", qty: 0 }, 2: { size: "", qty: 0 }, 3: { size: "", qty: 0 }, 4: { size: "", qty: 0 } };
  for (const n of (needs || [])) {
    if (u[n.uniform_type_id] !== undefined)
      u[n.uniform_type_id] = { size: getSize(n), qty: n.quantity_needed || 0 };
  }
  return u;
}
function uniformsToNeeds(uniforms, support_mode, support_years) {
  return Object.entries(uniforms)
    .filter(([, { size, qty }]) => size || qty > 0)
    .map(([typeId, { size, qty }]) => ({
      uniform_type_id:   parseInt(typeId),
      size:              makeSize(parseInt(typeId), size),
      quantity_needed:   qty,
      quantity_received: 0,
      status:            "pending",
      support_mode,
      support_years,
    }));
}

// ─── parseRows ────────────────────────────────────────────────────────────────
function parseRows(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const results = [];
  let importNo = 0;
  for (let i = 7; i < data.length; i++) {
    const r            = data[i];
    const excelRowNum  = i + 1;
    const student_code = String(r[0] ?? "").trim() || null;
    const name         = String(r[1] ?? "").trim();
    if (!name) continue;
    importNo++;

    const gender          = mapVal(MAP_GENDER,  r[2]);
    const education_level = String(r[3] ?? "").trim();
    const urgency         = mapVal(MAP_URGENCY, r[4]);
    const support_mode    = mapVal(MAP_SUPPORT, r[5]);
    const support_years   = support_mode === "recurring"
      ? Math.max(1, parseInt(r[6]) || 1) : null;

    const needDefs = [
      { typeId: 1, sizeKey: "chest", sizeIdx: 7,  qtyIdx: 8  },
      { typeId: 3, sizeKey: "waist", sizeIdx: 9,  qtyIdx: 10 },
      { typeId: 2, sizeKey: "chest", sizeIdx: 11, qtyIdx: 12 },
      { typeId: 4, sizeKey: "waist", sizeIdx: 13, qtyIdx: 14 },
    ];
    const needs = [];
    for (const def of needDefs) {
      const sizeVal = String(r[def.sizeIdx] ?? "").trim();
      const qty     = parseInt(r[def.qtyIdx]) || 0;
      if (sizeVal || qty > 0) {  // capture partial entries for validation
        needs.push({
          uniform_type_id:   def.typeId,
          size:              JSON.stringify({ [def.sizeKey]: sizeVal }),
          quantity_needed:   qty,
          quantity_received: 0,
          status:            "pending",
          support_mode,
          support_years,
        });
      }
    }
    results.push({
      _importNo: importNo,
      _excelRowNum: excelRowNum,
      // Keep _rowNum as the real spreadsheet row for older call sites.
      _rowNum: excelRowNum,
      student_code,
      student_name: name,
      gender,
      education_level,
      urgency,
      support_mode,
      support_years,
      needs,
    });
  }
  return results;
}

// ─── validateRow — returns { hard: string[], soft: string[] } ─────────────────
function validateRow(s) {
  const hard = [], soft = [];

  // Name
  const name = s.student_name.trim();
  if (!name) {
    hard.push("ชื่อ-นามสกุล: ว่างเปล่า");
  } else {
    if (name.split(/\s+/).length < 2) hard.push("ชื่อ-นามสกุล: ใส่แต่ชื่อ ขาดนามสกุล");
    if (/\d/.test(name))              hard.push("ชื่อ-นามสกุล: มีตัวเลขปนในชื่อ");
  }

  // Gender
  if (!["male","female"].includes(s.gender)) hard.push("เพศ: ยังไม่ได้เลือกเพศ");

  // Education level
  if (!s.education_level || !VALID_LEVELS.includes(s.education_level))
    hard.push("ระดับชั้น: ยังไม่ได้ระบุ");

  // Urgency
  if (!["very_urgent","urgent","can_wait"].includes(s.urgency))
    hard.push("ความเร่งด่วน: ยังไม่ได้ระบุ");

  // Support mode
  if (!["one_time","recurring"].includes(s.support_mode)) {
    hard.push('การรับ: ต้องเป็น "รับครั้งเดียว" หรือ "รับต่อเนื่อง"');
  } else if (s.support_mode === "recurring") {
    if (!s.support_years || s.support_years < 1)
      hard.push('จำนวนปี: เลือก "รับต่อเนื่อง" แต่ไม่ได้ระบุจำนวนปี');
    else if (s.support_years > 5)
      soft.push(`จำนวนปี: ${s.support_years} ปี — สูงผิดปกติ`);
  }

  // Student code
  if (s.student_code && !/^\d+$/.test(s.student_code))
    hard.push("รหัสนักเรียน: ต้องเป็นตัวเลขเท่านั้น");

  // Uniforms
  if (!s.needs || s.needs.length === 0) {
    hard.push("จำนวนชุด: ยังไม่ได้กรอกจำนวนชุด");
  } else {
    let hasValidNeed = false;
    for (const n of s.needs) {
      const sv    = getSize(n);
      const hasS  = !!sv;
      const hasQ  = n.quantity_needed > 0;
      const label = U_META[n.uniform_type_id]?.name ?? "ชุด";
      if      (hasS && !hasQ)  hard.push(`${label}: ระบุรอบแล้ว แต่ไม่ได้กรอกจำนวน`);
      else if (!hasS && hasQ)  hard.push(`${label}: กรอกจำนวนแล้ว แต่ไม่ได้ระบุรอบ`);
      else if (hasS && hasQ) {
        const cm = parseFloat(sv);
        if (!isNaN(cm) && (cm < 20 || cm > 120))
          hard.push(`${label}: รอบ ${cm} cm นอกช่วง (20–120 cm)`);
        else hasValidNeed = true;
      }
    }
    if (!hasValidNeed && !hard.some(e => e.startsWith("จำนวนชุด")))
      hard.push("จำนวนชุด: ยังไม่ได้กรอกจำนวนชุด");

    // Gender-uniform mismatch
    if (["male","female"].includes(s.gender)) {
      const hasMaleNeed   = s.needs.some(n => MALE_TYPES.includes(n.uniform_type_id) && getSize(n) && n.quantity_needed > 0);
      const hasFemaleNeed = s.needs.some(n => FEM_TYPES.includes(n.uniform_type_id)  && getSize(n) && n.quantity_needed > 0);
      if (s.gender === "male"   && hasFemaleNeed) hard.push("ชุดนักเรียน: นักเรียนชายไม่ควรมีชุดนักเรียนหญิง");
      if (s.gender === "female" && hasMaleNeed)   hard.push("ชุดนักเรียน: นักเรียนหญิงไม่ควรมีชุดนักเรียนชาย");
    }
  }
  return { hard, soft };
}

// ─── buildRowIssues — per-row + cross-row validation ─────────────────────────
function buildRowIssues(rows, existing) {
  const issues = new Map();
  const addErr = (idx, msg, isSoft = false) => {
    const cur = issues.get(idx) ?? { hard: [], soft: [] };
    if (isSoft) { if (!cur.soft.includes(msg)) cur.soft.push(msg); }
    else         { if (!cur.hard.includes(msg)) cur.hard.push(msg); }
    issues.set(idx, cur);
  };

  // Per-row
  rows.forEach((s, i) => {
    const { hard, soft } = validateRow(s);
    if (hard.length || soft.length) issues.set(i, { hard, soft });
  });

  // Code dup within file
  const codeToIdx = new Map();
  rows.forEach((s, i) => {
    if (!s.student_code || !/^\d+$/.test(String(s.student_code).trim())) return;
    const nc = normStudentCode(s.student_code);
    if (codeToIdx.has(nc)) {
      const prevIdx = codeToIdx.get(nc);
      addErr(i,       `รหัสนักเรียน ${s.student_code} ซ้ำกับแถว Excel ${rows[prevIdx]._excelRowNum} ในไฟล์`);
      addErr(prevIdx, `รหัสนักเรียน ${s.student_code} ซ้ำกับแถว Excel ${s._excelRowNum} ในไฟล์`);
    } else codeToIdx.set(nc, i);
  });

  // Code dup in system → soft warning (import จะอัปเดตผ่าน detectSimilarity ไม่ block)
  const sysCodeSet = new Set(
    existing.map(e => normStudentCode(e.student_code)).filter(Boolean)
  );
  rows.forEach((s, i) => {
    const nc = normStudentCode(s.student_code);
    if (nc && /^\d+$/.test(String(s.student_code).trim()) && sysCodeSet.has(nc))
      addErr(i, `รหัสนักเรียน ${s.student_code} มีในระบบแล้ว — จะอัปเดตข้อมูล`, true);
  });

  // Code format inconsistency (soft)
  const validCodes = rows.filter(s => s.student_code && /^\d+$/.test(s.student_code));
  if (validCodes.length >= 2) {
    const freq = {};
    validCodes.forEach(s => { freq[s.student_code.length] = (freq[s.student_code.length] || 0) + 1; });
    const dominant = parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
    rows.forEach((s, i) => {
      if (!s.student_code || !/^\d+$/.test(s.student_code)) return;
      if (s.student_code.length !== dominant)
        addErr(i, `รหัส ${s.student_code} มี ${s.student_code.length} หลัก ซึ่งต่างจากรหัสอื่นในไฟล์ (${dominant} หลัก)`, true);
    });
  }
  return issues;
}

// ─── detectSimilarity — name vs existing DB ───────────────────────────────────
function normalizeSize(size) {
  if (!size) return {};
  if (typeof size === "string") { try { return JSON.parse(size); } catch { return {}; } }
  return size;
}

function detectSimilarity(rows, existing) {
  const result = new Map();
  const codeToExisting = new Map();
  for (const ex of existing) {
    const nc = normStudentCode(ex.student_code);
    if (nc) codeToExisting.set(nc, ex);
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nc = normStudentCode(r.student_code);

    // จับคู่ด้วยรหัสนักเรียนก่อน (กรณี import แถวที่มีรหัสซ้ำในระบบ)
    if (nc && codeToExisting.has(nc)) {
      const ex = codeToExisting.get(nc);
      const coreMatch = r.gender === ex.gender && r.education_level === ex.education_level && r.urgency === ex.urgency;
      const sameName = r.student_name.trim().toLowerCase() === (ex.student_name || "").trim().toLowerCase();
      const needsSame = needsHash(r.needs) === needsHash(ex.needs || ex.uniform_needs);
      if (needsSame && coreMatch && sameName)
        result.set(i, { type: "exact", existingStudent: ex, matchFields: ["รหัสนักเรียน", "ทุกข้อมูล"] });
      else
        result.set(i, { type: "update", existingStudent: ex, matchFields: ["รหัสนักเรียน"] });
      continue;
    }

    const nm = r.student_name.trim().toLowerCase();
    for (const ex of existing) {
      if (nm !== (ex.student_name || "").trim().toLowerCase()) continue;
      const coreMatch = r.gender === ex.gender && r.education_level === ex.education_level && r.urgency === ex.urgency;
      const needsSame = needsHash(r.needs) === needsHash(ex.needs || ex.uniform_needs);
      if (coreMatch && needsSame)     result.set(i, { type: "exact",   existingStudent: ex, matchFields: ["ทุกข้อมูล"] });
      else if (coreMatch)             result.set(i, { type: "update",  existingStudent: ex, matchFields: ["ชื่อ-นามสกุล", "เพศ", "ระดับ"] });
      else                            result.set(i, { type: "similar", existingStudent: ex, matchFields: ["ชื่อ-นามสกุล"] });
      break;
    }
  }
  return result;
}

// ─── RowEditDrawer ────────────────────────────────────────────────────────────
function RowEditDrawer({ student, onSave, onCancel }) {
  const [saveHint, setSaveHint] = useState("");
  const [draft, setDraft] = useState(() => ({
    student_code:    student.student_code ?? "",
    student_name:    student.student_name ?? "",
    gender:          ["male","female"].includes(student.gender) ? student.gender : "",
    education_level: VALID_LEVELS.includes(student.education_level) ? student.education_level : "",
    urgency:         ["very_urgent","urgent","can_wait"].includes(student.urgency) ? student.urgency : "",
    support_mode:    ["one_time","recurring"].includes(student.support_mode) ? student.support_mode : "",
    support_years:   student.support_years ?? 1,
    uniforms:        needsToUniforms(student.needs),
  }));

  const set  = (k, v) => setDraft(p => ({ ...p, [k]: v }));
  const setU = (tid, k, v) => setDraft(p => ({ ...p, uniforms: { ...p.uniforms, [tid]: { ...p.uniforms[tid], [k]: v } } }));

  const handleSave = () => {
    const sm    = draft.support_mode;
    const years = sm === "recurring" ? (parseInt(draft.support_years) || 1) : null;
    const updated = {
      ...student,
      student_code:    draft.student_code.trim() || null,
      student_name:    draft.student_name.trim(),
      gender:          draft.gender,
      education_level: draft.education_level,
      urgency:         draft.urgency,
      support_mode:    sm,
      support_years:   years,
      needs:           uniformsToNeeds(draft.uniforms, sm, years),
    };
    const { hard } = validateRow(updated);
    if (hard.length > 0) {
      setSaveHint(hard.join(" · "));
      return;
    }
    setSaveHint("");
    onSave(updated);
  };

  return (
    <div className="eiEditDrawer">
      <div className="eiEditSection">
        <div className="eiEditSectionTitle">ข้อมูลส่วนตัว</div>
        <div className="eiEditGrid">
          <div className="eiEditField">
            <label>รหัสนักเรียน</label>
            <input type="text" value={draft.student_code} placeholder="optional (ตัวเลขเท่านั้น)"
              onChange={e => set("student_code", e.target.value)} />
          </div>
          <div className="eiEditField eiEditField--wide">
            <label>ชื่อ-นามสกุล <span className="eiEditReq">*</span></label>
            <input type="text" value={draft.student_name} placeholder="ชื่อ นามสกุล"
              onChange={e => set("student_name", e.target.value)} />
          </div>
          <div className="eiEditField">
            <label>เพศ <span className="eiEditReq">*</span></label>
            <select value={draft.gender} onChange={e => set("gender", e.target.value)}>
              {!draft.gender && <option value="" disabled>— กรุณาเลือกเพศ —</option>}
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
            </select>
          </div>
          <div className="eiEditField">
            <label>ระดับชั้น <span className="eiEditReq">*</span></label>
            <select value={draft.education_level} onChange={e => set("education_level", e.target.value)}>
              {!draft.education_level && <option value="" disabled>— กรุณาเลือกระดับชั้น —</option>}
              {VALID_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="eiEditField">
            <label>ความเร่งด่วน <span className="eiEditReq">*</span></label>
            <select value={draft.urgency} onChange={e => set("urgency", e.target.value)}>
              {!draft.urgency && <option value="" disabled>— กรุณาเลือกความเร่งด่วน —</option>}
              <option value="very_urgent">เร่งด่วนมาก</option>
              <option value="urgent">เร่งด่วน</option>
              <option value="can_wait">รอได้</option>
            </select>
          </div>
          <div className="eiEditField">
            <label>การรับ <span className="eiEditReq">*</span></label>
            <select value={draft.support_mode} onChange={e => set("support_mode", e.target.value)}>
              {!draft.support_mode && <option value="" disabled>— กรุณาเลือกรูปแบบการรับ —</option>}
              <option value="one_time">รับครั้งเดียว</option>
              <option value="recurring">รับต่อเนื่อง</option>
            </select>
          </div>
          {draft.support_mode === "recurring" && (
            <div className="eiEditField">
              <label>จำนวนปี <span className="eiEditReq">*</span></label>
              <input type="number" min="1" max="10" value={draft.support_years}
                onChange={e => set("support_years", e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className="eiEditSection">
        <div className="eiEditSectionTitle">รายการชุดนักเรียน</div>
        <div className="eiEditUniformGrid">
          {(draft.gender === "male" ? [1, 3] : draft.gender === "female" ? [2, 4] : [1, 3, 2, 4]).map(tid => {
            const meta = U_META[tid];
            const u    = draft.uniforms[tid];
            const isMale = MALE_TYPES.includes(tid);
            return (
              <div key={tid} className={`eiEditUniformCard ${isMale ? "eiEditUniformCard--male" : "eiEditUniformCard--female"}`}>
                <div className="eiEditUniformLabel">
                  <span className="eiEditUniformGenderDot" style={{ background: isMale ? "#1565C0" : "#AD1457" }} />
                  {meta.name}
                </div>
                <div className="eiEditUniformInputRow">
                  <div className="eiEditUniformInputGroup">
                    <span>{meta.sizeLabel} (cm)</span>
                    <input type="number" min="0" max="200" placeholder="—"
                      value={u.size}
                      onChange={e => setU(tid, "size", e.target.value)} />
                  </div>
                  <div className="eiEditUniformInputGroup">
                    <span>จำนวน (ตัว)</span>
                    <input type="number" min="0" placeholder="—"
                      value={u.qty || ""}
                      onChange={e => setU(tid, "qty", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {saveHint && <div className="eiErr" style={{ marginTop: 8 }}>{saveHint}</div>}
      <div className="eiEditActions">
        <button className="eiBtnGhost" type="button" onClick={onCancel}>ยกเลิก</button>
        <button className="eiBtnSave"  type="button" onClick={handleSave}>✓  บันทึกการแก้ไข</button>
      </div>
    </div>
  );
}

// ─── IssuePanel ───────────────────────────────────────────────────────────────
// ─── ExistingStudentView ──────────────────────────────────────────────────────
function ExistingStudentView({ student }) {
  if (!student) return null;
  const uniforms = needsToUniforms(student.needs || student.uniform_needs || []);
  const hasAnyUniform = [1,2,3,4].some(tid => uniforms[tid]?.size || uniforms[tid]?.qty);
  return (
    <div className="eiExistingView">
      <div className="eiExistingViewLabel">ข้อมูลที่มีในระบบ</div>
      <div className="eiExistingViewGrid">
        <div className="eiExistingField">
          <span className="eiExistingFieldKey">ชื่อ-นามสกุล</span>
          <span className="eiExistingFieldVal">{student.student_name}</span>
        </div>
        <div className="eiExistingField">
          <span className="eiExistingFieldKey">เพศ</span>
          <span className="eiExistingFieldVal">{GENDER_TH[student.gender] ?? student.gender ?? "—"}</span>
        </div>
        <div className="eiExistingField">
          <span className="eiExistingFieldKey">ระดับชั้น</span>
          <span className="eiExistingFieldVal">{student.education_level ?? "—"}</span>
        </div>
        <div className="eiExistingField">
          <span className="eiExistingFieldKey">ความเร่งด่วน</span>
          <span className="eiExistingFieldVal">{URGENCY_TH[student.urgency] ?? student.urgency ?? "—"}</span>
        </div>
        <div className="eiExistingField">
          <span className="eiExistingFieldKey">การรับ</span>
          <span className="eiExistingFieldVal">
            {student.support_mode === "recurring" ? `ต่อเนื่อง ${student.support_years} ปี` : "รับครั้งเดียว"}
          </span>
        </div>
      </div>
      {hasAnyUniform && (
        <div className="eiExistingUniforms">
          {[1,2,3,4].map(tid => {
            const u = uniforms[tid];
            if (!u?.size && !u?.qty) return null;
            const isMale = MALE_TYPES.includes(tid);
            return (
              <div key={tid} className={`eiExistingUniform ${isMale ? "eiExistingUniform--male" : "eiExistingUniform--female"}`}>
                <span className="eiExistingUniformDot" style={{ background: isMale ? "#1565C0" : "#AD1457" }} />
                <span className="eiExistingUniformName">{U_META[tid].name}</span>
                <span className="eiExistingUniformDetail">รอบ {u.size || "—"} &nbsp;·&nbsp; {u.qty || 0} ตัว</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── IssuePanel ───────────────────────────────────────────────────────────────
function IssuePanel({ students, rowIssues, dupMap, editingIdx, onEdit, onCancelEdit, onSave }) {
  const [openIdx, setOpenIdx]       = useState(null);
  const [viewingIdx, setViewingIdx] = useState(null);

  // Build per-student issue list
  const issueRows = [];
  const seenIdxs = new Set();

  for (const [idx, { hard, soft }] of rowIssues.entries()) {
    if (hard.length > 0 || soft.length > 0) {
      seenIdxs.add(idx);
      issueRows.push({ idx, hard, soft, dup: dupMap.get(idx) ?? null });
    }
  }
  for (const [idx, dup] of dupMap.entries()) {
    if (!seenIdxs.has(idx) && dup.type === "similar") {
      issueRows.push({ idx, hard: [], soft: [], dup });
    }
  }
  issueRows.sort((a, b) => a.idx - b.idx);

  if (issueRows.length === 0) return null;

  const hardRowCount = issueRows.filter(r => r.hard.length > 0).length;
  const warnRowCount = issueRows.filter(r => r.hard.length === 0).length;

  const toggle = (idx) => {
    const next = openIdx === idx ? null : idx;
    setOpenIdx(next);
    if (next !== openIdx) setViewingIdx(null);
    if (editingIdx !== null) onCancelEdit();
  };

  return (
    <div className="eiIssuePanel2">
      {/* Summary header */}
      <div className="eiIssuePanel2Header">
        <span className="eiIssuePanel2Icon">⊙</span>
        <span className="eiIssuePanel2Title">
          สรุปปัญหาทั้งหมด {issueRows.length} รายการ
        </span>
        <div className="eiIssuePanel2Counts">
          {hardRowCount > 0 && <span className="eiIssueCountPill eiIssueCountPill--hard">{hardRowCount} ข้อผิดพลาด</span>}
          {warnRowCount > 0 && <span className="eiIssueCountPill eiIssueCountPill--warn">{warnRowCount} คำเตือน</span>}
        </div>
      </div>

      {/* Accordion list */}
      <div className="eiIssuePanel2List">
        {issueRows.map(({ idx, hard, soft, dup }) => {
          const s           = students[idx];
          const isOpen      = openIdx === idx;
          const isEditing   = editingIdx === idx;
          const isViewing   = viewingIdx === idx;

          // Badge on right
          let badgeLabel = null, badgeClass = "";
          if (hard.length > 0)          { badgeLabel = `${hard.length} ฟิลด์ขาด`; badgeClass = "eiIssueFieldCount--err"; }
          else if (soft.length > 0)     { badgeLabel = "คำเตือน";                  badgeClass = "eiIssueFieldCount--warn"; }
          else if (dup?.type === "similar") { badgeLabel = "คำเตือน";              badgeClass = "eiIssueFieldCount--warn"; }

          // Dup tag
          let dupTagLabel = null;
          if (dup) {
            const ex = dup.existingStudent;
            const code = ex?.student_code ? ` · รหัส ${ex.student_code}` : "";
            if (dup.type === "exact" || dup.type === "update") dupTagLabel = `ชื่อซ้ำในระบบ${code}`;
            else if (dup.type === "similar") dupTagLabel = `คล้ายกับ "${ex?.student_name}"`;
          }

          return (
            <div key={idx} className={`eiAccordion ${isOpen ? "eiAccordion--open" : ""}`}>
              {/* Header */}
              <button className="eiAccordionHead" type="button" onClick={() => toggle(idx)}>
                <span className={`eiAccBadge ${hard.length > 0 ? "eiAccBadge--err" : "eiAccBadge--warn"}`}>
                  รายการที่ {s._importNo}
                </span>
                <div className="eiAccHeadInfo">
                  <span className="eiAccName">{s.student_name}</span>
                  <span className="eiAccRowMeta">แถว Excel {s._excelRowNum}</span>
                  {dupTagLabel && (
                    <span className="eiAccDupTag">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                        <rect x="1" y="4" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="5" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                      {dupTagLabel}
                    </span>
                  )}
                </div>
                <div className="eiAccHeadRight">
                  {badgeLabel && <span className={`eiIssueFieldCount ${badgeClass}`}>{badgeLabel}</span>}
                  <svg className="eiAccChevronIcon" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>

              {/* Body */}
              {isOpen && (
                <div className="eiAccordionBody">

                  {/* Hard error section */}
                  {hard.length > 0 && (
                    <div className="eiAccSection eiAccSection--err">
                      <div className="eiAccSectionTitle">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <circle cx="12" cy="16" r="1" fill="currentColor"/>
                        </svg>
                        ข้อมูลไม่ครบ — จะไม่ถูกนำเข้า
                      </div>
                      <div className="eiAccErrList">
                        {hard.map((msg, i) => {
                          const colonIdx = msg.indexOf(":");
                          const field  = colonIdx >= 0 ? msg.slice(0, colonIdx).trim() : msg;
                          const detail = colonIdx >= 0 ? msg.slice(colonIdx + 1).trim() : "";
                          return (
                            <div key={i} className="eiAccErrItem">
                              <span className="eiAccErrField">{field}</span>
                              {detail && <span className="eiAccErrDetail">{detail}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Warning/dup section */}
                  {(soft.length > 0 || dup) && (
                    <div className="eiAccSection eiAccSection--warn">
                      {dup && (
                        <>
                          <div className="eiAccSectionTitle">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <circle cx="12" cy="17" r="1" fill="currentColor"/>
                            </svg>
                            {dup.type === "similar"
                              ? `คล้ายกับ "${dup.existingStudent?.student_name}" ในระบบ — ตรวจสอบก่อน import`
                              : `ชื่อซ้ำกับรหัส ${dup.existingStudent?.student_code} ในระบบ — ข้อมูลเดิมจะถูกเก็บไว้`}
                          </div>
                          {hard.length > 0 && (
                            <div className="eiAccSectionDesc">
                              เนื่องจากข้อมูลบางฟิลด์ว่าง ระบบจะไม่อัปเดต และคงข้อมูลเดิมไว้ทั้งหมด
                            </div>
                          )}
                        </>
                      )}
                      {soft.map((msg, i) => (
                        <div key={i} className="eiAccSectionDesc">{msg}</div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="eiAccActions">
                    {hard.length > 0 && (
                      <button
                        className={`eiAccActionBtn eiAccActionBtn--edit ${isEditing ? "eiAccActionBtn--edit-active" : ""}`}
                        type="button"
                        onClick={() => { isEditing ? onCancelEdit() : onEdit(idx); setViewingIdx(null); }}
                      >
                        {isEditing ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            ปิดการแก้ไข
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            แก้ไขก่อนนำข้อมูลเข้า
                          </>
                        )}
                      </button>
                    )}
                    {dup?.existingStudent && (
                      <button
                        className={`eiAccActionBtn eiAccActionBtn--view ${isViewing ? "eiAccActionBtn--view-active" : ""}`}
                        type="button"
                        onClick={() => { setViewingIdx(isViewing ? null : idx); if (!isViewing && isEditing) onCancelEdit(); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        {isViewing ? "ซ่อนข้อมูลเดิม" : "ดูข้อมูลเดิม ในระบบ"}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          style={{ transition: "transform 0.2s", transform: isViewing ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 2 }}>
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Existing student info */}
                  {isViewing && dup?.existingStudent && (
                    <ExistingStudentView student={dup.existingStudent} />
                  )}

                  {/* Inline edit drawer */}
                  {isEditing && (
                    <RowEditDrawer
                      key={`edit-${idx}-${s._excelRowNum}`}
                      student={students[idx]}
                      onSave={(updated) => onSave(idx, updated)}
                      onCancel={onCancelEdit}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── downloadTemplate ─────────────────────────────────────────────────────────
async function downloadTemplate() {
  try {
    const blob = await getBlob("/school/students/import-template");
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "unieed_import_template.xlsx";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  } catch (e) { alert("ดาวน์โหลด template ไม่สำเร็จ: " + e.message); }
}

// ─── ExcelImportModal ─────────────────────────────────────────────────────────
export default function ExcelImportModal({ open, onClose, requestId, onDone }) {
  const inputRef = useRef();
  const [step, setStep]               = useState("idle");
  const [students, setStudents]       = useState([]);
  const [rowIssues, setRowIssues]     = useState(new Map()); // Map<idx, {hard[], soft[]}>
  const [dupMap, setDupMap]           = useState(new Map()); // Map<idx, {type, existingStudent, matchFields}>
  const [existingStudents, setExisting] = useState([]);
  const [result, setResult]           = useState(null);
  const [importErr, setImportErr]     = useState("");
  const [editingIdx, setEditingIdx]   = useState(null);

  if (!open) return null;

  const reset = () => {
    setStep("idle"); setStudents([]); setRowIssues(new Map()); setDupMap(new Map());
    setResult(null); setImportErr(""); setEditingIdx(null);
  };
  const handleClose = () => { reset(); onClose(); };

  // ── Parse & validate file ─────────────────────────────
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb     = XLSX.read(ev.target.result, { type: "array" });
        const ws     = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(ws);

        if (!parsed.length) {
          setImportErr("ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบว่าใช้ Template ที่ถูกต้อง");
          return;
        }

        let existing = [];
        try {
          existing = await schoolRequestSvc.listStudents(requestId) || [];
          setExisting(existing);
        } catch { /* ไม่มีข้อมูลเดิม */ }

        setStudents(parsed);
        setRowIssues(buildRowIssues(parsed, existing));
        setDupMap(detectSimilarity(parsed, existing));
        setStep("preview");
      } catch (err) {
        setImportErr("อ่านไฟล์ไม่ได้: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Edit row ──────────────────────────────────────────
  const handleSaveEdit = (idx, updated) => {
    const newStudents = students.map((s, i) => i === idx ? updated : s);
    const newIssues   = buildRowIssues(newStudents, existingStudents);
    const newDup      = detectSimilarity(newStudents, existingStudents);
    setStudents(newStudents);
    setRowIssues(newIssues);
    setDupMap(newDup);
    // ปิดฟอร์มเมื่อแก้ครบแล้ว; คงเปิดไว้ถ้ายังมี hard error
    setEditingIdx(newIssues.get(idx)?.hard?.length > 0 ? idx : null);
  };

  // ── Import ────────────────────────────────────────────
  const doImport = async () => {
    setStep("importing");
    setImportErr("");

    const hardErrIdxs = new Set(
      [...rowIssues.entries()].filter(([, v]) => v.hard.length > 0).map(([k]) => k)
    );
    const toImport = students.map((s, i) => ({ s, i })).filter(({ i }) => !hardErrIdxs.has(i));

    let created = 0, updated = 0, skipped = 0, failed = 0;
    const failedRows = [];

    for (const { s, i } of toImport) {
      const dup = dupMap.get(i);
      try {
        if (dup?.type === "exact") {
          skipped++;
        } else if ((dup?.type === "update" || dup?.type === "similar") && dup.existingStudent?.student_id) {
          // "similar" = ชื่อซ้ำแต่ข้อมูล core ต่าง → ก็ต้อง update ไม่ใช่ create ใหม่
          // (createStudent จะ fail ถ้า backend มี unique constraint บน student_name)
          await schoolRequestSvc.updateStudent(requestId, dup.existingStudent.student_id, {
            student_name: s.student_name, student_code: s.student_code || undefined,
            gender: s.gender, education_level: s.education_level, urgency: s.urgency,
            needs: s.needs,
            merge_needs: true,
          });
          updated++;
        } else {
          await schoolRequestSvc.createStudent(requestId, s);
          created++;
        }
      } catch (err) {
        failed++;
        failedRows.push({
          name:  s.student_name,
          importNo: s._importNo,
          excelRow: s._excelRowNum,
          error: err?.data?.message || err?.response?.data?.message || err.message || "เกิดข้อผิดพลาด",
        });
      }
    }

    setResult({ created, updated, skipped, failed, failedRows });
    setStep("done");
    if (created > 0 || updated > 0) onDone?.();
  };

  // ── Derived counts ────────────────────────────────────
  const hardErrCount = [...rowIssues.values()].filter(v => v.hard.length > 0).length;
  const dupExact     = [...dupMap.values()].filter(d => d.type === "exact").length;
  const dupUpdate    = [...dupMap.values()].filter(d => d.type === "update").length;
  const dupSimilar   = [...dupMap.values()].filter(d => d.type === "similar").length;
  const importableCount = students.reduce((n, _s, i) => {
    if (rowIssues.get(i)?.hard?.length > 0) return n;
    if (dupMap.get(i)?.type === "exact") return n;
    return n + 1;
  }, 0);

  return (
    <div className="eiOverlay" onMouseDown={handleClose}>
      <div className="eiModal" onMouseDown={e => e.stopPropagation()}>

        {/* Header */}
        <div className="eiHead">
          <div className="eiTitle">
            <svg width="18" height="18" viewBox="0 0 50 50" fill="none" style={{flexShrink:0}}>
              <path d="M44.1176 1.47059H5.88235C3.44559 1.47059 1.47059 3.44559 1.47059 5.88235V44.1176C1.47059 46.5544 3.44559 48.5294 5.88235 48.5294H44.1176C46.5544 48.5294 48.5294 46.5544 48.5294 44.1176V5.88235C48.5294 3.44559 46.5544 1.47059 44.1176 1.47059Z" fill="#CCD6DD"/>
              <path d="M17.6471 47.0588H8.82353V22.0588C8.82353 20.4353 10.1412 19.1176 11.7647 19.1176H14.7059C16.3294 19.1176 17.6471 20.4353 17.6471 22.0588V47.0588Z" fill="#5C913B"/>
              <path d="M41.1765 47.0588H32.3529V11.7647C32.3529 10.1412 33.6706 8.82353 35.2941 8.82353H38.2353C39.8588 8.82353 41.1765 10.1412 41.1765 11.7647V47.0588Z" fill="#3B94D9"/>
              <path d="M29.4118 47.0588H20.5882V32.3529C20.5882 30.7294 21.9059 29.4118 23.5294 29.4118H26.4706C28.0941 29.4118 29.4118 30.7294 29.4118 32.3529V47.0588Z" fill="#DD2E44"/>
            </svg>
            นำเข้าข้อมูลนักเรียนจาก Excel
          </div>
          <button className="eiClose" onClick={handleClose} type="button">✕</button>
        </div>

        <div className="eiBody">

          {/* STEP: idle */}
          {step === "idle" && (
            <div className="eiIdle">
              <div className="eiIconWrap">
                <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                  <path d="M44.1176 1.47059H5.88235C3.44559 1.47059 1.47059 3.44559 1.47059 5.88235V44.1176C1.47059 46.5544 3.44559 48.5294 5.88235 48.5294H44.1176C46.5544 48.5294 48.5294 46.5544 48.5294 44.1176V5.88235C48.5294 3.44559 46.5544 1.47059 44.1176 1.47059Z" fill="#CCD6DD"/>
                  <path d="M44.1176 0H5.88235C2.63382 0 0 2.63382 0 5.88235V44.1176C0 47.3662 2.63382 50 5.88235 50H44.1176C47.3662 50 50 47.3662 50 44.1176V5.88235C50 2.63382 47.3662 0 44.1176 0ZM47.0588 44.1176C47.0588 45.7397 45.7397 47.0588 44.1176 47.0588H38.2353V38.2353H47.0588V44.1176Z" fill="#E1E8ED"/>
                  <path d="M17.6471 47.0588H8.82353V22.0588C8.82353 20.4353 10.1412 19.1176 11.7647 19.1176H14.7059C16.3294 19.1176 17.6471 20.4353 17.6471 22.0588V47.0588Z" fill="#5C913B"/>
                  <path d="M41.1765 47.0588H32.3529V11.7647C32.3529 10.1412 33.6706 8.82353 35.2941 8.82353H38.2353C39.8588 8.82353 41.1765 10.1412 41.1765 11.7647V47.0588Z" fill="#3B94D9"/>
                  <path d="M29.4118 47.0588H20.5882V32.3529C20.5882 30.7294 21.9059 29.4118 23.5294 29.4118H26.4706C28.0941 29.4118 29.4118 30.7294 29.4118 32.3529V47.0588Z" fill="#DD2E44"/>
                </svg>
              </div>
              <p className="eiDesc">ดาวน์โหลด Template กรอกข้อมูล แล้วอัพโหลดไฟล์ .xlsx กลับมา</p>
              <div className="eiActions">
                <button className="eiBtnGhost" type="button" onClick={downloadTemplate}>⬇ ดาวน์โหลด Template</button>
                <label className="eiBtnPrimary">
                  📂 เลือกไฟล์ Excel
                  <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={onFile} />
                </label>
              </div>
              {importErr && <div className="eiErr">{importErr}</div>}
            </div>
          )}

          {/* STEP: preview */}
          {step === "preview" && (
            <div className="eiPreview">

              {/* Summary bar */}
              <div className="eiSummaryBar">
                <span className="eiSumBadge eiSumOk">
                  <span className="eiSumBadgeNum">{importableCount}</span> พร้อม import
                </span>
                {dupUpdate > 0 && (
                  <span className="eiSumBadge eiSumUpdate">
                    <span className="eiSumBadgeNum">{dupUpdate}</span> อัปเดต
                  </span>
                )}
                {dupExact > 0 && (
                  <span className="eiSumBadge eiSumSkip">
                    <span className="eiSumBadgeNum">{dupExact}</span> ซ้ำ (ข้าม)
                  </span>
                )}
                {dupSimilar > 0 && (
                  <span className="eiSumBadge eiSumWarnDup">
                    <span className="eiSumBadgeNum">{dupSimilar}</span> คล้ายกัน
                  </span>
                )}
                {hardErrCount > 0 && (
                  <span className="eiSumBadge eiSumErr">
                    <span className="eiSumBadgeNum">{hardErrCount}</span> ข้อมูลผิด
                  </span>
                )}
              </div>

              {/* Issue panel */}
              <IssuePanel
                students={students}
                rowIssues={rowIssues}
                dupMap={dupMap}
                editingIdx={editingIdx}
                onEdit={idx => setEditingIdx(idx)}
                onCancelEdit={() => setEditingIdx(null)}
                onSave={handleSaveEdit}
              />

              {/* Preview table */}
              <div className="eiPreviewTable">
                <table>
                  <thead>
                    <tr>
                      <th style={{width:56}}>#</th>
                      <th style={{width:92}}>แถว Excel</th>
                      <th style={{width:86}}>รหัส</th>
                      <th>ชื่อ-นามสกุล</th>
                      <th>เพศ</th>
                      <th>ระดับ</th>
                      <th>เร่งด่วน</th>
                      <th>การรับ</th>
                      <th>ชุด</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => {
                      const issue = rowIssues.get(i);
                      const dup   = dupMap.get(i);
                      const hasHard = issue?.hard?.length > 0;
                      const rowCls  = hasHard          ? "eiRowErr"
                                    : dup?.type === "exact"  ? "eiRowExact"
                                    : dup?.type === "update" ? "eiRowUpdate"
                                    : dup                    ? "eiRowDup" : "";
                      return (
                        <tr key={i} className={rowCls}>
                          <td>
                            <span className="eiRowNum">{s._importNo}</span>
                            {hasHard && <span className="eiTag eiTagErr">Error</span>}
                            {!hasHard && dup?.type === "exact"   && <span className="eiTag eiTagExact">ซ้ำ</span>}
                            {!hasHard && dup?.type === "update"  && <span className="eiTag eiTagUpdate">Update</span>}
                            {!hasHard && dup?.type === "similar" && <span className="eiTag eiTagDup">คล้าย</span>}
                          </td>
                          <td><span className="eiExcelRowBadge">{s._excelRowNum}</span></td>
                          <td>
                            {s.student_code
                              ? <span className="eiCodeBadge">{s.student_code}</span>
                              : <span className="eiCellMissing">อัตโนมัติ</span>}
                          </td>
                          <td className={hasHard ? "eiCellErr" : ""}>{s.student_name}</td>
                          <td>{GENDER_TH[s.gender] ?? s.gender}</td>
                          <td>{s.education_level || <span className="eiCellMissing">—</span>}</td>
                          <td>
                            <span className={`eiUrgBadge eiUrg-${s.urgency}`}>
                              {URGENCY_TH[s.urgency] ?? s.urgency}
                            </span>
                          </td>
                          <td>{s.support_mode === "recurring" ? `ต่อเนื่อง ${s.support_years} ปี` : "ครั้งเดียว"}</td>
                          <td>{s.needs.length} รายการ</td>
                          <td>
                            {hasHard ? (
                              <span className="eiStatusErr">⚠ {issue.hard.length} ปัญหา</span>
                            ) : dup?.type === "exact" ? (
                              <span className="eiStatusSkip">ข้าม</span>
                            ) : dup?.type === "update" ? (
                              <span className="eiStatusUpdate" title={mergeActionLabel(dup.existingStudent, s.needs)}>
                                {mergeActionLabel(dup.existingStudent, s.needs)}
                              </span>
                            ) : (
                              <span className="eiStatusOk">เพิ่มใหม่</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP: importing */}
          {step === "importing" && (
            <div className="eiLoading">
              <div className="eiSpinner" />
              <p>กำลัง import ข้อมูล...</p>
            </div>
          )}

          {/* STEP: done */}
          {step === "done" && result && (
            <div className="eiDone">
              <div className="eiDoneIcon">{result.failed === 0 ? "🎉" : "⚠️"}</div>
              <div className="eiDoneStats">
                <div className="eiDoneStat ok">
                  <span className="eiDoneNum">{result.created}</span>
                  <span className="eiDoneLabel">เพิ่มใหม่</span>
                </div>
                <div className="eiDoneStat update">
                  <span className="eiDoneNum">{result.updated}</span>
                  <span className="eiDoneLabel">อัปเดต</span>
                </div>
                <div className="eiDoneStat warn">
                  <span className="eiDoneNum">{result.skipped}</span>
                  <span className="eiDoneLabel">ข้าม (ซ้ำ)</span>
                </div>
                {result.failed > 0 && (
                  <div className="eiDoneStat err">
                    <span className="eiDoneNum">{result.failed}</span>
                    <span className="eiDoneLabel">ล้มเหลว</span>
                  </div>
                )}
              </div>
              {result.failedRows?.length > 0 && (
                <div className="eiIssuePanel" style={{marginTop:16}}>
                  <div className="eiIssuePanelHeader">
                    <span className="eiIssuePanelIcon">✕</span>
                    <span className="eiIssuePanelTitle">รายการที่ import ไม่สำเร็จ</span>
                  </div>
                  <div className="eiIssuePanelList">
                    {result.failedRows.map((r, i) => (
                      <div key={i} className="eiIssueItem eiIssueItem--hard">
                        <div className="eiIssueItemRow">
                          {r.importNo && <span className="eiIssueBadge eiIssueBadge--hard">รายการที่ {r.importNo}</span>}
                          {r.excelRow && <span className="eiIssueBadge eiIssueBadge--soft">แถว Excel {r.excelRow}</span>}
                          <span className="eiIssueName">"{r.name}"</span>
                          <span className="eiIssueMsgs">{translateGenderInText(r.error)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="eiFoot">
          {step === "preview" && (
            <>
              <button className="eiBtnGhost" onClick={reset} type="button">← เลือกไฟล์ใหม่</button>
              <button className="eiBtnPrimary" onClick={doImport} disabled={importableCount === 0} type="button">
                นำเข้า {importableCount} คน
              </button>
            </>
          )}
          {/* {step === "idle" && (
            <button className="eiBtnGhost" onClick={handleClose} type="button">ยกเลิก</button>
          )} */}
          {/* {step === "done" && (
            <button className="eiBtnGhost" onClick={handleClose} type="button">ปิด</button>
          )} */}
        </div>

      </div>
    </div>
  );
}
