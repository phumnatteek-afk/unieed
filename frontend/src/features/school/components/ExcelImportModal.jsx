import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { schoolRequestSvc } from "../services/schoolRequest.service.js";
import "../styles/excelImport.css";
import {
  validateStudent,
  detectDuplicates,
  detectDuplicatesWithExisting,
} from "../../../utils/studentValidation.js";

// ── map ภาษาไทย → ค่า DB ─────────────────────────────────
const MAP_GENDER = { "ชาย": "male", "หญิง": "female" };
const MAP_URGENCY = { "เร่งด่วนมาก": "very_urgent", "เร่งด่วน": "urgent", "รอได้": "can_wait" };
const MAP_SUPPORT = { "รับครั้งเดียว": "one_time", "รับต่อเนื่อง": "recurring" };

function mapVal(dict, val) {
  const v = String(val ?? "").trim();
  return dict[v] ?? v;
}

// ── parse แถวจาก sheet โดยใช้ column index (0-based) ────
// row 7 header มี \n อยู่ใน cell จึงใช้ __EMPTY + index แทน
// xlsx sheet_to_json กับ range:6 จะให้ key เป็น header text จริงๆ
// แต่ถ้า header ซ้ำกัน (เช่น "รอบอก\n(cm)" มี 2 ครั้ง) xlsx จะ suffix ด้วย _1, _2
// วิธีที่ robust ที่สุดคืออ่านด้วย header:1 แล้ว map ด้วย column index
function parseRows(ws) {
  // อ่านแบบ array of arrays เริ่มจาก row 7 (index 6)
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  // row index 6 = headers (row 7 ใน Excel)
  // row index 7+ = data
  const results = [];
  for (let i = 7; i < data.length; i++) {
    const r = data[i];
    const name = String(r[1] ?? "").trim(); // col B = index 1
    if (!name) continue;

    const gender = mapVal(MAP_GENDER, r[2]);  // C
    const education_level = String(r[3] ?? "").trim();  // D
    const urgency = mapVal(MAP_URGENCY, r[4]);  // E
    const support_mode = mapVal(MAP_SUPPORT, r[5]);  // F
    const support_years = support_mode === "recurring"
      ? Math.max(1, parseInt(r[6]) || 1)                // G
      : null;

    // ── needs จาก H-O (index 7-14) ─────────────────────
    // H=7 I=8 J=9 K=10 L=11 M=12 N=13 O=14
    const needDefs = [
      { typeId: 1, sizeKey: "chest", sizeIdx: 7, qtyIdx: 8 }, // เสื้อชาย
      { typeId: 3, sizeKey: "waist", sizeIdx: 9, qtyIdx: 10 }, // กางเกงชาย
      { typeId: 2, sizeKey: "chest", sizeIdx: 11, qtyIdx: 12 }, // เสื้อหญิง
      { typeId: 4, sizeKey: "waist", sizeIdx: 13, qtyIdx: 14 }, // กระโปรงหญิง
    ];

    const needs = [];
    for (const def of needDefs) {
      const sizeVal = String(r[def.sizeIdx] ?? "").trim();
      const qty = parseInt(r[def.qtyIdx]) || 0;
      if (sizeVal && qty > 0) {
        needs.push({
          uniform_type_id: def.typeId,
          size: JSON.stringify({ [def.sizeKey]: sizeVal }),
          quantity_needed: qty,
          quantity_received: 0,
          status: "pending",
          support_mode,
          support_years,
        });
      }
    }

    if (!needs.length) continue; // ไม่มีรายการชุด ข้ามแถว
    results.push({ student_name: name, gender, education_level, urgency, needs });
  }
  return results;
}

// ── validate ใช้ shared module ───────────────────────────
// validateStudent ครอบคลุม: ชื่อ (ห้ามตัวเลข, ต้องมีนามสกุล), เพศ, ระดับชั้น, ความเร่งด่วน, needs
function validate(s) { return validateStudent(s); }

export default function ExcelImportModal({ open, onClose, requestId, onDone }) {
  const inputRef = useRef();
  const [step, setStep] = useState("idle"); // idle | preview | importing | done
  const [students, setStudents] = useState([]);
  const [errors, setErrors] = useState([]);          // validation errors per row
  const [dupWarnings, setDupWarnings] = useState(new Map()); // dup warnings per row
  const [existingStudents, setExistingStudents] = useState([]);
  const [result, setResult] = useState(null);        // { created, updated, skipped, failed }
  const [importErr, setImportErr] = useState("");

  if (!open) return null;

  const reset = () => {
    setStep("idle");
    setStudents([]);
    setErrors([]);
    setResult(null);
    setImportErr("");
  };

  const handleClose = () => { reset(); onClose(); };

  // ── อ่านไฟล์ xlsx ─────────────────────────────────────
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(ws);

        // ── โหลด existing students จาก DB ──────────────────
        let existing = [];
        try {
          existing = await schoolRequestSvc.listStudents(requestId) || [];
          setExistingStudents(existing);
        } catch { /* ถ้าโหลดไม่ได้ก็ตรวจ dup เฉพาะในไฟล์ */ }

        // ── validate แต่ละแถว ──────────────────────────────
        const errs = [];
        parsed.forEach((s, i) => {
          const ve = validate(s);
          if (ve.length) errs.push({ index: i + 1, name: s.student_name, errors: ve });
        });

        // ── ตรวจ dup ระหว่างแถวในไฟล์ ──────────────────────
        const dupInFile = detectDuplicates(parsed);           // Map<index, {type,matchIndex,matchFields}>

        // ── ตรวจ dup กับ DB ────────────────────────────────
        const dupWithDb = detectDuplicatesWithExisting(parsed, existing); // Map<index, {type,existingStudent}>

        // รวม warnings (db ก่อน, file ทีหลัง)
        const allDups = new Map([...dupWithDb]);
        for (const [idx, info] of dupInFile.entries()) {
          if (!allDups.has(idx)) {
            allDups.set(idx, {
              ...info,
              existingStudent: parsed[info.matchIndex], // refer to row in file
              source: "file",
            });
          }
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

  // ── import เข้า DB (upsert) ──────────────────────────
  const doImport = async () => {
    setStep("importing");
    setImportErr("");

    // กรองเฉพาะแถวที่ valid (ไม่มี validation error)
    const errorIdxSet = new Set(errors.map(e => e.index - 1));
    const toImportWithIdx = students
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => !errorIdxSet.has(i));

    let created = 0, updated = 0, skipped = 0, failed = 0;
    const failedRows = [];
    // existingStudents โหลดแล้วจาก onFile
    const existingMap = new Map(
      existingStudents.map(s => [s.student_id, s])
    );

    for (const { s, i } of toImportWithIdx) {
      const dup = dupWarnings.get(i);
      try {
        if (dup?.type === "exact") {
          // ข้อมูลเหมือนกัน 100% → ข้าม
          skipped++;
        } else if (dup?.type === "update" && dup.existingStudent?.student_id) {
          // ชื่อ+เพศ+ระดับ+urgency ตรงกัน แต่ needs ต่าง → UPDATE
          await schoolRequestSvc.updateStudent(requestId, dup.existingStudent.student_id, {
            student_name: s.student_name,
            gender: s.gender,
            education_level: s.education_level,
            urgency: s.urgency,
            needs: s.needs,
          });
          updated++;
        } else {
          // สร้างใหม่
          await schoolRequestSvc.createStudent(requestId, s);
          created++;
        }
      } catch (e) {
        failed++;
        failedRows.push({ name: s.student_name, error: e?.data?.message || e.message });
      }
    }

    setResult({ created, updated, skipped: errors.length, failed, failedRows });
    setStep("done");
    if (created > 0 || updated > 0) onDone?.();
  };

  const validCount = students.length - errors.length;
  const hasErrors = errors.length > 0;

  return (
    <div className="eiOverlay" onMouseDown={handleClose}>
      <div className="eiModal" onMouseDown={(e) => e.stopPropagation()}>

        {/* Head */}
        <div className="eiHead">
          <div className="eiTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M15 13.3333C15 14.2538 14.2537 15 13.3333 15H1.66667C0.74625 15 0 14.2538 0 13.3333V9.58333C0 8.66292 0.329583 8.33333 1.25 8.33333H13.75C14.6704 8.33333 15 8.66292 15 9.58333V13.3333Z" fill="#D99E82"/>
<path d="M10.4167 8.33333C10.4167 9.94417 9.11083 11.25 7.5 11.25C5.88916 11.25 4.58333 9.94417 4.58333 8.33333H10.4167Z" fill="#662113"/>
<path d="M1.66667 15H13.3333C14.2537 15 15 14.2537 15 13.3333H0C0 14.2537 0.74625 15 1.66667 15Z" fill="#C1694F"/>
<path d="M11.1317 3.33333H9.13875V0.833333C9.13875 0.372917 8.76541 0 8.30541 0H6.63833C6.17833 0 5.80541 0.373333 5.80541 0.833333V3.33333H3.81166C3.30208 3.33333 3.18 3.59292 3.54041 3.95375L6.81666 7.23C7.17708 7.59042 7.76666 7.59042 8.1275 7.23L11.4037 3.95375C11.7633 3.59292 11.6417 3.33333 11.1317 3.33333Z" fill="#77B255"/>
</svg>
นำเข้าข้อมูลนักเรียนจาก Excel
          </div>
          <button className="eiClose" onClick={handleClose} type="button">✕</button>
        </div>

        <div className="eiBody">

          {/* ── STEP: idle ── */}
          {step === "idle" && (
            <div className="eiIdle">
              <div className="eiIconWrap"><svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M44.1176 1.47059H5.88235C3.44559 1.47059 1.47059 3.44559 1.47059 5.88235V44.1176C1.47059 46.5544 3.44559 48.5294 5.88235 48.5294H44.1176C46.5544 48.5294 48.5294 46.5544 48.5294 44.1176V5.88235C48.5294 3.44559 46.5544 1.47059 44.1176 1.47059Z" fill="#CCD6DD"/>
<path d="M44.1176 0H5.88235C2.63382 0 0 2.63382 0 5.88235V44.1176C0 47.3662 2.63382 50 5.88235 50H44.1176C47.3662 50 50 47.3662 50 44.1176V5.88235C50 2.63382 47.3662 0 44.1176 0ZM44.1176 2.94118C45.7397 2.94118 47.0588 4.26029 47.0588 5.88235V11.7647H38.2353V2.94118H44.1176ZM38.2353 26.4706H47.0588V35.2941H38.2353V26.4706ZM38.2353 23.5294V14.7059H47.0588V23.5294H38.2353ZM35.2941 2.94118V11.7647H26.4706V2.94118H35.2941ZM26.4706 14.7059H35.2941V23.5294H26.4706V14.7059ZM26.4706 26.4706H35.2941V35.2941H26.4706V26.4706ZM23.5294 2.94118V11.7647H14.7059V2.94118H23.5294ZM14.7059 14.7059H23.5294V23.5294H14.7059V14.7059ZM14.7059 26.4706H23.5294V35.2941H14.7059V26.4706ZM2.94118 5.88235C2.94118 4.26029 4.26029 2.94118 5.88235 2.94118H11.7647V11.7647H2.94118V5.88235ZM2.94118 14.7059H11.7647V23.5294H2.94118V14.7059ZM2.94118 26.4706H11.7647V35.2941H2.94118V26.4706ZM5.88235 47.0588C4.26029 47.0588 2.94118 45.7397 2.94118 44.1176V38.2353H11.7647V47.0588H5.88235ZM14.7059 47.0588V38.2353H23.5294V47.0588H14.7059ZM26.4706 47.0588V38.2353H35.2941V47.0588H26.4706ZM44.1176 47.0588H38.2353V38.2353H47.0588V44.1176C47.0588 45.7397 45.7397 47.0588 44.1176 47.0588Z" fill="#E1E8ED"/>
<path d="M17.6471 47.0588H8.82353V22.0588C8.82353 20.4353 10.1412 19.1176 11.7647 19.1176H14.7059C16.3294 19.1176 17.6471 20.4353 17.6471 22.0588V47.0588Z" fill="#5C913B"/>
<path d="M41.1765 47.0588H32.3529V11.7647C32.3529 10.1412 33.6706 8.82353 35.2941 8.82353H38.2353C39.8588 8.82353 41.1765 10.1412 41.1765 11.7647V47.0588Z" fill="#3B94D9"/>
<path d="M29.4118 47.0588H20.5882V32.3529C20.5882 30.7294 21.9059 29.4118 23.5294 29.4118H26.4706C28.0941 29.4118 29.4118 30.7294 29.4118 32.3529V47.0588Z" fill="#DD2E44"/>
</svg>
</div>
              <p className="eiDesc">
                ดาวน์โหลด Template กรอกข้อมูล แล้วอัพโหลดไฟล์ .xlsx กลับมา
              </p>
              <div className="eiActions">
                <a
                  className="eiBtnGhost"
                  href="/templates/unieed_template.xlsx"
                  download
                >
                  ⬇ ดาวน์โหลด Template
                </a>
                <label className="eiBtnPrimary">
                  📂 เลือกไฟล์ Excel
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={onFile}
                  />
                </label>
              </div>
              {importErr && <div className="eiErr">{importErr}</div>}
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === "preview" && (
            <div className="eiPreview">
              <div className="eiSummaryBar">
                <span className="eiSumOk">✅ พร้อม import: {validCount} คน</span>
                {[...dupWarnings.values()].filter(d => d.type === "update").length > 0 && (
                  <span className="eiSumUpdate">
                    🔄 อัปเดต: {[...dupWarnings.values()].filter(d => d.type === "update").length} คน
                  </span>
                )}
                {[...dupWarnings.values()].filter(d => d.type === "exact").length > 0 && (
                  <span className="eiSumSkip">
                    ↷ ซ้ำ (ข้าม): {[...dupWarnings.values()].filter(d => d.type === "exact").length} คน
                  </span>
                )}
                {[...dupWarnings.values()].filter(d => !["exact","update"].includes(d.type)).length > 0 && (
                  <span className="eiSumWarnDup">
                    ⚠️ คล้ายกับที่มีอยู่: {[...dupWarnings.values()].filter(d => !["exact","update"].includes(d.type)).length} คน
                  </span>
                )}
                {hasErrors && (
                  <span className="eiSumWarn">❌ ข้อมูลผิด: {errors.length} แถว (จะข้าม)</span>
                )}
              </div>

              {hasErrors && (
                <div className="eiErrList">
                  <div className="eiErrTitle">แถวที่มีปัญหา (จะถูกข้าม):</div>
                  {errors.map((e) => (
                    <div className="eiErrRow" key={e.index}>
                      <span className="eiErrName">แถว {e.index} — {e.name}</span>
                      <span className="eiErrMsg">{e.errors.join(", ")}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="eiPreviewTable">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>ชื่อ-นามสกุล</th>
                      <th>เพศ</th>
                      <th>ระดับ</th>
                      <th>เร่งด่วน</th>
                      <th>การรับ</th>
                      <th>รายการชุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => {
                      const hasErr = errors.find((e) => e.index === i + 1);
                      const dup    = dupWarnings.get(i);
                      const rowClass = hasErr ? "eiRowErr" :
                        dup?.type === "exact"  ? "eiRowExact" :
                        dup?.type === "update" ? "eiRowUpdate" :
                        dup                    ? "eiRowDup" : "";
                      return (
                        <tr key={i} className={rowClass} title={
                          hasErr ? hasErr.errors.join(", ") :
                          dup?.type === "exact"  ? "ซ้ำทั้งหมด — จะถูกข้าม" :
                          dup?.type === "update" ? "จะอัปเดตรายการชุดของนักเรียนที่มีอยู่" :
                          dup ? `คล้ายกับ "${dup.existingStudent?.student_name}" (${dup.matchFields?.join(", ")})` : ""
                        }>
                          <td>
                            {i + 1}
                            {hasErr && <span className="eiTagErr" title={hasErr.errors.join(", ")}>✕ Error</span>}
                            {!hasErr && dup?.type === "exact"  && <span className="eiTagExact">↷ ซ้ำ</span>}
                            {!hasErr && dup?.type === "update" && <span className="eiTagUpdate">↻ Update</span>}
                            {!hasErr && dup && !["exact","update"].includes(dup.type) && <span className="eiTagDup">⚠ คล้าย</span>}
                          </td>
                          <td>{s.student_name}</td>
                          <td>{s.gender === "male" ? "ชาย" : "หญิง"}</td>
                          <td>{s.education_level}</td>
                          <td>{
                            s.urgency === "very_urgent" ? "เร่งด่วนมาก" :
                              s.urgency === "urgent" ? "เร่งด่วน" : "รอได้"
                          }</td>
                          <td>{s.needs[0]?.support_mode === "recurring"
                            ? `ต่อเนื่อง ${s.needs[0].support_years} ปี`
                            : "ครั้งเดียว"}
                          </td>
                          <td>{s.needs.length} รายการ</td>
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
              <div className="eiDoneIcon">🎉</div>
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
                  <span className="eiDoneLabel">ข้ามไป</span>
                </div>
                {result.failed > 0 && (
                  <div className="eiDoneStat err">
                    <span className="eiDoneNum">{result.failed}</span>
                    <span className="eiDoneLabel">ล้มเหลว</span>
                  </div>
                )}
              </div>
              {result.failedRows?.length > 0 && (
                <div className="eiErrList" style={{ marginTop: 12 }}>
                  {result.failedRows.map((r, i) => (
                    <div className="eiErrRow" key={i}>
                      <span className="eiErrName">{r.name}</span>
                      <span className="eiErrMsg">{r.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Foot */}
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