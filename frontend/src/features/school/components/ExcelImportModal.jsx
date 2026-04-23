import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { schoolRequestSvc } from "../services/schoolRequest.service.js";
import "../styles/excelImport.css";

// ── map ภาษาไทย → ค่า DB ─────────────────────────────────
const MAP_GENDER   = { "ชาย": "male", "หญิง": "female" };
function translateGenderInText(text) {
  return text
    .replace(/\bเพศ\s*male\b/g,   "เพศชาย")
    .replace(/\bเพศ\s*female\b/g, "เพศหญิง")
    .replace(/\bmale\b/g,   "ชาย")
    .replace(/\bfemale\b/g, "หญิง");
}
const MAP_URGENCY  = { "เร่งด่วนมาก": "very_urgent", "เร่งด่วน": "urgent", "รอได้": "can_wait" };
const MAP_SUPPORT  = { "รับครั้งเดียว": "one_time", "รับต่อเนื่อง": "recurring" };

function mapVal(dict, val) {
  const v = String(val ?? "").trim();
  return dict[v] ?? v;
}

// ── parse แถวจาก sheet ──────────────────────────────────
function parseRows(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const results = [];
  for (let i = 7; i < data.length; i++) {
    const r = data[i];
    const name = String(r[1] ?? "").trim();
    if (!name) continue;

    const gender         = mapVal(MAP_GENDER, r[2]);
    const education_level = String(r[3] ?? "").trim();
    const urgency        = mapVal(MAP_URGENCY, r[4]);
    const support_mode   = mapVal(MAP_SUPPORT, r[5]);
    const support_years  = support_mode === "recurring"
      ? Math.max(1, parseInt(r[6]) || 1)
      : null;

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
      if (sizeVal && qty > 0) {
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
      _rowNum: i + 1,          // Excel row number (1-based, for display)
      student_name:    name,
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

// ── Validation ───────────────────────────────────────────
// Validates a single student row; returns array of error strings
function validateRow(s) {
  const errs = [];

  // ── ชื่อ ─────────────────────────────────────────────
  const nameParts = s.student_name.trim().split(/\s+/);
  if (!s.student_name.trim()) {
    errs.push("ไม่มีชื่อ");
  } else if (nameParts.length < 2) {
    errs.push("ต้องมีทั้งชื่อและนามสกุล (คั่นด้วยช่องว่าง)");
  } else if (/\d/.test(s.student_name)) {
    errs.push("ชื่อ-นามสกุลต้องไม่มีตัวเลข");
  }

  // ── เพศ ──────────────────────────────────────────────
  if (!["male", "female"].includes(s.gender)) {
    errs.push(`เพศ "${s.gender}" ไม่ถูกต้อง (ใช้ ชาย / หญิง)`);
  }

  // ── ระดับชั้น ────────────────────────────────────────
  if (!s.education_level) {
    errs.push("ไม่ระบุระดับชั้น");
  }

  // ── ความเร่งด่วน ─────────────────────────────────────
  if (!["very_urgent", "urgent", "can_wait"].includes(s.urgency)) {
    errs.push(`ความเร่งด่วน "${s.urgency}" ไม่ถูกต้อง (ใช้ เร่งด่วนมาก / เร่งด่วน / รอได้)`);
  }

  // ── support mode ─────────────────────────────────────
  if (!["one_time", "recurring"].includes(s.support_mode)) {
    errs.push(`รูปแบบการรับ "${s.support_mode}" ไม่ถูกต้อง (ใช้ รับครั้งเดียว / รับต่อเนื่อง)`);
  }

  if (s.support_mode === "recurring" && (!s.support_years || s.support_years < 1)) {
    errs.push("ระยะเวลาต้องเป็นตัวเลขอย่างน้อย 1 ปี");
  }

  // ── needs ────────────────────────────────────────────
  if (!s.needs || s.needs.length === 0) {
    errs.push("ไม่มีรายการชุดนักเรียน (ต้องกรอกขนาดและจำนวนอย่างน้อย 1 รายการ)");
  } else {
    s.needs.forEach((n, ni) => {
      if (!n.size || n.size === "{}") {
        errs.push(`รายการชุดที่ ${ni + 1}: ไม่ระบุขนาด`);
      }
      if (!n.quantity_needed || n.quantity_needed < 1) {
        errs.push(`รายการชุดที่ ${ni + 1}: จำนวนต้องมากกว่า 0`);
      }
    });
  }

  return errs;
}

// ── Duplicate detection ───────────────────────────────────
// Uses full name (first+last) comparison — NOT just first name
// Returns Map<arrayIndex, { type, existingStudent, matchFields, source }>
//
// type "exact"  = name+gender+level+urgency+needs all identical → skip
// type "update" = name+gender+level match, but needs differ    → update
// type "similar"= only name matches                            → warn
//
function detectDuplicatesWithExisting(rows, existing) {
  const result = new Map();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fullName = r.student_name.trim().toLowerCase();

    // Compare against existing DB students
    for (const ex of existing) {
      const exName = (ex.student_name || "").trim().toLowerCase();

      // Only consider it a potential duplicate if the FULL name matches
      if (fullName !== exName) continue;

      // Exact match on name + gender + level + urgency
      const coreMatch =
        r.gender          === ex.gender          &&
        r.education_level === ex.education_level &&
        r.urgency         === ex.urgency;

      // Compare needs (simple hash)
      const needsHash  = (ns) => JSON.stringify(
        (ns || [])
          .map(n => `${n.uniform_type_id}:${n.size}:${n.quantity_needed}`)
          .sort()
      );
      const needsSame  = needsHash(r.needs) === needsHash(ex.needs || ex.uniform_needs);

      if (coreMatch && needsSame) {
        result.set(i, { type: "exact", existingStudent: ex, matchFields: ["ทุกข้อมูล"] });
      } else if (coreMatch) {
        result.set(i, { type: "update", existingStudent: ex, matchFields: ["ชื่อ", "เพศ", "ระดับ", "ความเร่งด่วน"] });
      } else {
        // Same full name but different other fields — just warn
        const matchFields = ["ชื่อ-นามสกุล"];
        result.set(i, { type: "similar", existingStudent: ex, matchFields });
      }
      break; // found a match, stop checking more existing students
    }
  }
  return result;
}

// Detect duplicates within the uploaded file itself
function detectDuplicatesInFile(rows) {
  const result = new Map();
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < i; j++) {
      if (result.has(i)) break;
      const a = rows[i], b = rows[j];
      if (a.student_name.trim().toLowerCase() === b.student_name.trim().toLowerCase()) {
        result.set(i, {
          type: "file_dup",
          matchIndex: j,
          matchFields: ["ชื่อ-นามสกุลซ้ำกับแถวที่ " + (j + 1)],
          source: "file",
        });
      }
    }
  }
  return result;
}

// ── Error panel sub-component ────────────────────────────
function ErrorPanel({ errors }) {
  const [open, setOpen] = useState(true);
  if (!errors.length) return null;
  return (
    <div className="eiErrPanel">
      <button
        className="eiErrPanelHeader"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="eiErrPanelIcon">⚠</span>
        <span className="eiErrPanelTitle">
          พบข้อมูลผิดพลาด {errors.length} แถว — แถวเหล่านี้จะถูกข้ามไป
        </span>
        <span className="eiErrPanelChevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="eiErrPanelBody">
          {errors.map((e) => (
            <div className="eiErrItem" key={e.index}>
              <div className="eiErrItemHeader">
                <span className="eiErrRowBadge">แถว {e.index}</span>
                <span className="eiErrRowName">{e.name || "—"}</span>
              </div>
              <ul className="eiErrItemList">
                {e.errors.map((msg, mi) => (
                  <li key={mi} className="eiErrItemMsg">
                    <span className="eiErrBullet">•</span>
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────
export default function ExcelImportModal({ open, onClose, requestId, onDone }) {
  const inputRef = useRef();
  const [step, setStep]                   = useState("idle");
  const [students, setStudents]           = useState([]);
  const [errors, setErrors]               = useState([]);
  const [dupWarnings, setDupWarnings]     = useState(new Map());
  const [existingStudents, setExistingStudents] = useState([]);
  const [result, setResult]               = useState(null);
  const [importErr, setImportErr]         = useState("");

  if (!open) return null;

  const reset = () => {
    setStep("idle"); setStudents([]); setErrors([]);
    setResult(null); setImportErr(""); setDupWarnings(new Map());
  };
  const handleClose = () => { reset(); onClose(); };

  // ── Read xlsx ──────────────────────────────────────────
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(ws);

        if (!parsed.length) {
          setImportErr("ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบว่าใช้ Template ที่ถูกต้อง");
          return;
        }

        // Load existing students from DB
        let existing = [];
        try {
          existing = await schoolRequestSvc.listStudents(requestId) || [];
          setExistingStudents(existing);
        } catch { /* ถ้าโหลดไม่ได้ก็ตรวจ dup เฉพาะในไฟล์ */ }

        // Validate each row
        const errs = [];
        parsed.forEach((s, i) => {
          const ve = validateRow(s);
          if (ve.length) errs.push({ index: i + 1, name: s.student_name, errors: ve });
        });

        // Detect dups vs DB (using full-name logic)
        const dupWithDb   = detectDuplicatesWithExisting(parsed, existing);
        // Detect dups within file
        const dupInFile   = detectDuplicatesInFile(parsed);

        // Merge: DB duplicates take priority
        const allDups = new Map([...dupWithDb]);
        for (const [idx, info] of dupInFile.entries()) {
          if (!allDups.has(idx)) allDups.set(idx, info);
        }

        setStudents(parsed);
        setErrors(errs);
        setDupWarnings(allDups);
        setStep("preview");
      } catch (err) {
        setImportErr("อ่านไฟล์ไม่ได้: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Import ────────────────────────────────────────────
  const doImport = async () => {
    setStep("importing");
    setImportErr("");

    const errorIdxSet = new Set(errors.map(e => e.index - 1));
    const toImport    = students
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => !errorIdxSet.has(i));

    let created = 0, updated = 0, skipped = 0, failed = 0;
    const failedRows = [];

    for (const { s, i } of toImport) {
      const dup = dupWarnings.get(i);
      try {
        if (dup?.type === "exact") {
          skipped++;
        } else if (dup?.type === "update" && dup.existingStudent?.student_id) {
          await schoolRequestSvc.updateStudent(requestId, dup.existingStudent.student_id, {
            student_name:    s.student_name,
            gender:          s.gender,
            education_level: s.education_level,
            urgency:         s.urgency,
            needs:           s.needs,
          });
          updated++;
        } else {
          // "similar" or "file_dup" or no dup → always create new
          await schoolRequestSvc.createStudent(requestId, s);
          created++;
        }
      } catch (e) {
        failed++;
        failedRows.push({
          name:  s.student_name,
          row:   s._rowNum,
          error: e?.data?.message || e?.response?.data?.message || e.message || "เกิดข้อผิดพลาด",
        });
      }
    }

    setResult({ created, updated, skipped, failed, failedRows });
    setStep("done");
    if (created > 0 || updated > 0) onDone?.();
  };

  const validCount = students.length - errors.length;
  const hasErrors  = errors.length > 0;

  const dupExact   = [...dupWarnings.values()].filter(d => d.type === "exact").length;
  const dupUpdate  = [...dupWarnings.values()].filter(d => d.type === "update").length;
  const dupWarn    = [...dupWarnings.values()].filter(d => !["exact","update"].includes(d.type)).length;

  return (
    <div className="eiOverlay" onMouseDown={handleClose}>
      <div className="eiModal" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── Head ── */}
        <div className="eiHead">
          <div className="eiTitle">
            <svg width="18" height="18" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
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

          {/* ── STEP: idle ── */}
          {step === "idle" && (
            <div className="eiIdle">
              <div className="eiIconWrap">
                <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M44.1176 1.47059H5.88235C3.44559 1.47059 1.47059 3.44559 1.47059 5.88235V44.1176C1.47059 46.5544 3.44559 48.5294 5.88235 48.5294H44.1176C46.5544 48.5294 48.5294 46.5544 48.5294 44.1176V5.88235C48.5294 3.44559 46.5544 1.47059 44.1176 1.47059Z" fill="#CCD6DD"/>
                  <path d="M44.1176 0H5.88235C2.63382 0 0 2.63382 0 5.88235V44.1176C0 47.3662 2.63382 50 5.88235 50H44.1176C47.3662 50 50 47.3662 50 44.1176V5.88235C50 2.63382 47.3662 0 44.1176 0ZM47.0588 44.1176C47.0588 45.7397 45.7397 47.0588 44.1176 47.0588H38.2353V38.2353H47.0588V44.1176ZM47.0588 35.2941H38.2353V26.4706H47.0588V35.2941ZM47.0588 23.5294H38.2353V14.7059H47.0588V23.5294ZM47.0588 11.7647H38.2353V2.94118H44.1176C45.7397 2.94118 47.0588 4.26029 47.0588 5.88235V11.7647Z" fill="#E1E8ED"/>
                  <path d="M17.6471 47.0588H8.82353V22.0588C8.82353 20.4353 10.1412 19.1176 11.7647 19.1176H14.7059C16.3294 19.1176 17.6471 20.4353 17.6471 22.0588V47.0588Z" fill="#5C913B"/>
                  <path d="M41.1765 47.0588H32.3529V11.7647C32.3529 10.1412 33.6706 8.82353 35.2941 8.82353H38.2353C39.8588 8.82353 41.1765 10.1412 41.1765 11.7647V47.0588Z" fill="#3B94D9"/>
                  <path d="M29.4118 47.0588H20.5882V32.3529C20.5882 30.7294 21.9059 29.4118 23.5294 29.4118H26.4706C28.0941 29.4118 29.4118 30.7294 29.4118 32.3529V47.0588Z" fill="#DD2E44"/>
                </svg>
              </div>
              <p className="eiDesc">ดาวน์โหลด Template กรอกข้อมูล แล้วอัพโหลดไฟล์ .xlsx กลับมา</p>
              <div className="eiActions">
                <a className="eiBtnGhost" href="/templates/unieed_template.xlsx" download>
                  ⬇ ดาวน์โหลด Template
                </a>
                <label className="eiBtnPrimary">
                  📂 เลือกไฟล์ Excel
                  <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={onFile} />
                </label>
              </div>
              {importErr && <div className="eiErr">{importErr}</div>}
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === "preview" && (
            <div className="eiPreview">

              {/* Summary badges */}
              <div className="eiSummaryBar">
                <span className="eiSumBadge eiSumOk">
                  <span className="eiSumBadgeNum">{validCount}</span> พร้อม import
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
                {dupWarn > 0 && (
                  <span className="eiSumBadge eiSumWarnDup">
                    <span className="eiSumBadgeNum">{dupWarn}</span> คล้ายกัน
                  </span>
                )}
                {hasErrors && (
                  <span className="eiSumBadge eiSumErr">
                    <span className="eiSumBadgeNum">{errors.length}</span> ข้อมูลผิด
                  </span>
                )}
              </div>

              {/* Error panel — collapsible, row-by-row */}
              <ErrorPanel errors={errors} />

              {/* Table */}
              <div className="eiPreviewTable">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>#</th>
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
                      const errObj = errors.find((e) => e.index === i + 1);
                      const dup    = dupWarnings.get(i);
                      const rowCls = errObj        ? "eiRowErr"    :
                                     dup?.type === "exact"   ? "eiRowExact"  :
                                     dup?.type === "update"  ? "eiRowUpdate" :
                                     dup                     ? "eiRowDup"    : "";
                      return (
                        <tr key={i} className={rowCls}>
                          <td>
                            <span className="eiRowNum">{i + 1}</span>
                            {errObj && (
                              <span className="eiTag eiTagErr" title={errObj.errors.join(" | ")}>Error</span>
                            )}
                            {!errObj && dup?.type === "exact"   && <span className="eiTag eiTagExact">ซ้ำ</span>}
                            {!errObj && dup?.type === "update"  && <span className="eiTag eiTagUpdate">Update</span>}
                            {!errObj && dup?.type === "similar" && <span className="eiTag eiTagDup">คล้าย</span>}
                            {!errObj && dup?.type === "file_dup"&& <span className="eiTag eiTagDup">ซ้ำในไฟล์</span>}
                          </td>
                          <td className={errObj ? "eiCellErr" : ""}>{s.student_name}</td>
                          <td>{s.gender === "male" ? "ชาย" : "หญิง"}</td>
                          <td>{s.education_level || <span className="eiCellMissing">—</span>}</td>
                          <td>
                            <span className={`eiUrgBadge eiUrg-${s.urgency}`}>
                              {s.urgency === "very_urgent" ? "เร่งด่วนมาก" :
                               s.urgency === "urgent"      ? "เร่งด่วน"    : "รอได้"}
                            </span>
                          </td>
                          <td>{s.support_mode === "recurring"
                            ? `ต่อเนื่อง ${s.support_years} ปี`
                            : "ครั้งเดียว"}
                          </td>
                          <td>{s.needs.length} รายการ</td>
                          <td>
                            {errObj ? (
                              <span className="eiStatusErr">
                                ⚠ {errObj.errors.length} ปัญหา
                              </span>
                            ) : dup?.type === "exact" ? (
                              <span className="eiStatusSkip">ข้าม</span>
                            ) : dup?.type === "update" ? (
                              <span className="eiStatusUpdate">อัปเดต</span>
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

          {/* ── STEP: importing ── */}
          {step === "importing" && (
            <div className="eiLoading">
              <div className="eiSpinner" />
              <p>กำลัง import ข้อมูล...</p>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === "done" && result && (
            <div className="eiDone">
              <div className="eiDoneIcon">
                {result.failed === 0 ? "🎉" : "⚠️"}
              </div>
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

              {/* Failed rows panel */}
              {result.failedRows?.length > 0 && (
                <div className="eiErrPanel" style={{ marginTop: 16 }}>
                  <div className="eiErrPanelHeader" style={{ cursor: "default" }}>
                    <span className="eiErrPanelIcon">✕</span>
                    <span className="eiErrPanelTitle">รายการที่ import ไม่สำเร็จ</span>
                  </div>
                  <div className="eiErrPanelBody">
                    {result.failedRows.map((r, i) => (
                      <div className="eiErrItem" key={i}>
                        <div className="eiErrItemHeader">
                          {r.row && <span className="eiErrRowBadge">แถว {r.row}</span>}
                          <span className="eiErrRowName">{r.name}</span>
                        </div>
                        <ul className="eiErrItemList">
                          <li className="eiErrItemMsg">
                            <span className="eiErrBullet">•</span>
                            {translateGenderInText(r.error)}
                          </li>
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Foot ── */}
        <div className="eiFoot">
          {step === "preview" && (
            <>
              <button className="eiBtnGhost" onClick={reset} type="button">
                ← เลือกไฟล์ใหม่
              </button>
              <button
                className="eiBtnPrimary"
                onClick={doImport}
                disabled={validCount === 0}
                type="button"
              >
                นำเข้า {validCount} คน
              </button>
            </>
          )}
          {(step === "idle" || step === "done") && (
            <button className="eiBtnGhost" onClick={handleClose} type="button">
              {step === "done" ? "ปิด" : "ยกเลิก"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}