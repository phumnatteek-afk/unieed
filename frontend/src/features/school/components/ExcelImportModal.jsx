import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { schoolRequestSvc } from "../services/schoolRequest.service.js";
import "../styles/excelImport.css";

// ── map ภาษาไทย → ค่า DB ─────────────────────────────────
const MAP_GENDER   = { "ชาย": "male", "หญิง": "female" };
const MAP_URGENCY  = { "เร่งด่วนมาก": "very_urgent", "เร่งด่วน": "urgent", "รอได้": "can_wait" };
const MAP_SUPPORT  = { "รับครั้งเดียว": "one_time", "รับต่อเนื่อง": "recurring" };

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

    const gender          = mapVal(MAP_GENDER,  r[2]);  // C
    const education_level = String(r[3] ?? "").trim();  // D
    const urgency         = mapVal(MAP_URGENCY, r[4]);  // E
    const support_mode    = mapVal(MAP_SUPPORT, r[5]);  // F
    const support_years   = support_mode === "recurring"
      ? Math.max(1, parseInt(r[6]) || 1)                // G
      : null;

    // ── needs จาก H-O (index 7-14) ─────────────────────
    // H=7 I=8 J=9 K=10 L=11 M=12 N=13 O=14
    const needDefs = [
      { typeId: 1, sizeKey: "chest", sizeIdx: 7,  qtyIdx: 8  }, // เสื้อชาย
      { typeId: 3, sizeKey: "waist", sizeIdx: 9,  qtyIdx: 10 }, // กางเกงชาย
      { typeId: 2, sizeKey: "chest", sizeIdx: 11, qtyIdx: 12 }, // เสื้อหญิง
      { typeId: 4, sizeKey: "waist", sizeIdx: 13, qtyIdx: 14 }, // กระโปรงหญิง
    ];

    const needs = [];
    for (const def of needDefs) {
      const sizeVal = String(r[def.sizeIdx] ?? "").trim();
      const qty     = parseInt(r[def.qtyIdx]) || 0;
      if (sizeVal && qty > 0) {
        needs.push({
          uniform_type_id  : def.typeId,
          size             : JSON.stringify({ [def.sizeKey]: sizeVal }),
          quantity_needed  : qty,
          quantity_received: 0,
          status           : "pending",
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

// ── validate student ─────────────────────────────────────
function validate(s) {
  const errs = [];
  if (!["male","female"].includes(s.gender))
    errs.push(`เพศไม่ถูกต้อง: "${s.gender}" (ใส่ ชาย หรือ หญิง)`);
  if (!["ประถมศึกษา","มัธยมศึกษา"].includes(s.education_level))
    errs.push(`ระดับชั้นไม่ถูกต้อง: "${s.education_level}"`);
  if (!["very_urgent","urgent","can_wait"].includes(s.urgency))
    errs.push(`ความเร่งด่วนไม่ถูกต้อง: "${s.urgency}"`);
  return errs;
}

export default function ExcelImportModal({ open, onClose, requestId, onDone }) {
  const inputRef = useRef();
  const [step, setStep]         = useState("idle"); // idle | preview | importing | done
  const [students, setStudents] = useState([]);
  const [errors, setErrors]     = useState([]);     // validation errors
  const [result, setResult]     = useState(null);   // { created, updated, failed }
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
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const parsed = parseRows(ws);
        const errs   = [];
        parsed.forEach((s, i) => {
          const ve = validate(s);
          if (ve.length) errs.push({ index: i + 1, name: s.student_name, errors: ve });
        });

        setStudents(parsed);
        setErrors(errs);
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

    // กรองเฉพาะแถวที่ valid
    const validIdx = new Set(
      students
        .map((_, i) => i)
        .filter((i) => !errors.find((e) => e.index === i + 1))
    );
    const toImport = students.filter((_, i) => validIdx.has(i));

    // ── ดึงรายชื่อที่มีอยู่แล้ว เพื่อ detect dup ──────
    let existingMap = new Map();
    try {
      const existing = await schoolRequestSvc.listStudents(requestId);
      existingMap = new Map(
        (existing || []).map((s) => [
          `${s.student_name.trim().toLowerCase()}|${s.gender}|${s.education_level}`,
          s,
        ])
      );
    } catch {
      // ถ้าโหลดไม่ได้ก็ create ทั้งหมด
    }

    let created = 0, updated = 0, failed = 0;
    const failedRows = [];

    for (const s of toImport) {
      const key = `${s.student_name.trim().toLowerCase()}|${s.gender}|${s.education_level}`;
      const dup = existingMap.get(key);
      try {
        if (dup) {
          // UPDATE — นักเรียนมีอยู่แล้ว อัปเดต urgency + needs
          await schoolRequestSvc.updateStudent(requestId, dup.student_id, {
            student_name   : s.student_name,
            gender         : s.gender,
            education_level: s.education_level,
            urgency        : s.urgency,
            needs          : s.needs,
          });
          updated++;
        } else {
          // CREATE — นักเรียนใหม่
          await schoolRequestSvc.createStudent(requestId, s);
          created++;
          existingMap.set(key, s);
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

  const validCount   = students.length - errors.length;
  const hasErrors    = errors.length > 0;

  return (
    <div className="eiOverlay" onMouseDown={handleClose}>
      <div className="eiModal" onMouseDown={(e) => e.stopPropagation()}>

        {/* Head */}
        <div className="eiHead">
          <div className="eiTitle">
            📥  นำเข้าข้อมูลนักเรียนจาก Excel
          </div>
          <button className="eiClose" onClick={handleClose} type="button">✕</button>
        </div>

        <div className="eiBody">

          {/* ── STEP: idle ── */}
          {step === "idle" && (
            <div className="eiIdle">
              <div className="eiIconWrap">📊</div>
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
                {hasErrors && (
                  <span className="eiSumWarn">⚠️ มีปัญหา: {errors.length} แถว (จะข้าม)</span>
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
                      return (
                        <tr key={i} className={hasErr ? "eiRowErr" : ""}>
                          <td>{i + 1}</td>
                          <td>{s.student_name}</td>
                          <td>{s.gender === "male" ? "ชาย" : "หญิง"}</td>
                          <td>{s.education_level}</td>
                          <td>{
                            s.urgency === "very_urgent" ? "เร่งด่วนมาก" :
                            s.urgency === "urgent"      ? "เร่งด่วน" : "รอได้"
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