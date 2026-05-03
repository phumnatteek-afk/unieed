import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import "../styles/studentModal.css";
import { validateName, validateStudent, detectDuplicatesWithExisting } from "../../../utils/studentValidation.js";

const emptyNeed = () => ({
  uniform_type_id: "",
  size: {},
  quantity_needed: 1,
  quantity_received: 0,
  status: "pending",
});

function getSchemaByType(uniformTypes = [], uniformTypeId) {
  if (!uniformTypeId) return [];
  const u = uniformTypes.find((x) => x && Number(x.uniform_type_id) === Number(uniformTypeId));
  if (!u) return [];
  const raw = u.size_schema;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

function parseSize(rawSize) {
  if (!rawSize) return {};
  if (typeof rawSize === "object") return rawSize;
  if (typeof rawSize === "string") {
    try { const o = JSON.parse(rawSize); return o && typeof o === "object" ? o : {}; } catch { return {}; }
  }
  return {};
}

const URGENCY_OPTIONS = [
  { value: "very_urgent", label: "เร่งด่วนมาก", color: "#EF4444", bg: "#FEF2F2", dot: "#EF4444" },
  { value: "urgent", label: "เร่งด่วน", color: "#F59E0B", bg: "#FFFBEB", dot: "#F59E0B" },
  { value: "can_wait", label: "รอได้", color: "#29B6E8", bg: "#E0F7FF", dot: "#29B6E8" },
];

export default function StudentModal({ open, onClose, onSave, uniformTypes = [], initial, existingStudents = [] }) {
  const isEdit = !!initial;
  const [student_name, setName] = useState("");
  const [education_level, setGrade] = useState("ประถมศึกษา");
  const [gender, setGender] = useState("female");
  const [urgency, setUrgency] = useState("can_wait");
  const [support_mode, setSupportMode] = useState("one_time");
  const [support_years, setSupportYears] = useState(1);
  const [needs, setNeeds] = useState([emptyNeed()]);
  const [activeNeed, setActiveNeed] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.student_name || "");
      setGrade(initial.education_level || "ประถมศึกษา");
      setGender(initial.gender || "female");
      setUrgency(initial.urgency || "can_wait");
      const firstNeed = Array.isArray(initial.needs) ? initial.needs[0] : null;
      setSupportMode(firstNeed?.support_mode || "one_time");
      setSupportYears(Number(firstNeed?.support_years || 1));
      const ns = Array.isArray(initial.needs) && initial.needs.length
        ? initial.needs.map((n) => ({
          uniform_type_id: n.uniform_type_id ?? "",
          size: parseSize(n.size),
          quantity_needed: Number(n.quantity_needed || 1),
          quantity_received: Number(n.quantity_received || 0),
          status: n.status || "pending",
        }))
        : [emptyNeed()];
      setNeeds(ns);
      setActiveNeed(0);
    } else {
      setName(""); setGrade("ประถมศึกษา"); setGender("female"); setUrgency("can_wait");
      setSupportMode("one_time"); setSupportYears(1);
      setNeeds([emptyNeed()]); setActiveNeed(0);
    }
  }, [open, initial]);

  const updateNeed = (idx, patch) =>
    setNeeds((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const addNeed = () => { setNeeds((p) => [...p, emptyNeed()]); setActiveNeed(needs.length); };
  const removeNeed = (idx) => {
    setNeeds((p) => p.filter((_, i) => i !== idx));
    setActiveNeed((a) => Math.max(0, a >= idx ? a - 1 : a));
  };

  const nameErrors = useMemo(() => validateName(student_name), [student_name]);

  const dupWarning = useMemo(() => {
    if (!student_name.trim() || nameErrors.length) return null;
    const othersInDB = existingStudents.filter(s =>
      !isEdit || s.student_id !== initial?.student_id
    );
    const candidate = [{ student_name, gender, education_level, urgency, needs }];
    const dups = detectDuplicatesWithExisting(candidate, othersInDB);
    return dups.get(0) || null;
  }, [student_name, gender, education_level, urgency, needs, existingStudents, isEdit, initial, nameErrors]);

  const [submitErrors, setSubmitErrors] = useState([]);

  const canSave = useMemo(() => {
    if (nameErrors.length) return false;
    if (!student_name.trim() || !needs.length) return false;
    if (support_mode === "recurring" && (!support_years || Number(support_years) <= 0)) return false;
    for (const n of needs) {
      if (!n.uniform_type_id || !n.quantity_needed || Number(n.quantity_needed) <= 0) return false;
      const schema = getSchemaByType(uniformTypes, n.uniform_type_id);
      if (schema.length > 0) {
        for (const f of schema) {
          if (f.required) {
            const v = n.size?.[f.key];
            if (v === undefined || v === null || String(v).trim() === "") return false;
          }
        }
      } else if (!n.size || Object.keys(n.size).length === 0) return false;
      const nq = Number(n.quantity_needed || 0), rq = Number(n.quantity_received || 0);
      if (rq < 0 || rq > nq) return false;
    }
    return true;
  }, [student_name, nameErrors, needs, uniformTypes, support_mode, support_years]);

  if (!open) return null;

  const submit = () => {
    setSubmitErrors([]);
    if (!canSave) return;

    const studentData = {
      student_name: student_name.trim(), gender, education_level, urgency,
      needs: needs.map(n => ({
        ...n,
        uniform_type_id: Number(n.uniform_type_id),
        quantity_needed: Number(n.quantity_needed),
        support_mode,
        support_years: support_mode === "recurring" ? Number(support_years || 1) : null,
      })),
      support_mode,
      support_years: support_mode === "recurring" ? Number(support_years) : null,
    };
    const errs = validateStudent(studentData);
    if (errs.length) { setSubmitErrors(errs); return; }

    if (dupWarning) {
      const typeLabel = dupWarning.type === "exact"
        ? "ข้อมูลซ้ำกันทั้งหมด — ยืนยันบันทึกซ้ำ?"
        : dupWarning.type === "update"
        ? `พบนักเรียน "${dupWarning.existingStudent.student_name}" ที่ข้อมูลตรงกัน — ยืนยันอัปเดตข้อมูล?`
        : `ข้อมูลคล้ายกับ "${dupWarning.existingStudent.student_name}" (${dupWarning.matchFields.join(", ")}) — ยืนยันบันทึก?`;
      if (!window.confirm(typeLabel)) return;
    }

    onSave({
      student_name: student_name.trim(), education_level, gender, urgency,
      needs: needs.map((n) => ({
        ...n,
        uniform_type_id: Number(n.uniform_type_id),
        quantity_needed: Number(n.quantity_needed),
        quantity_received: Number(n.quantity_received || 0),
        size: JSON.stringify(n.size || {}),
        support_mode,
        support_years: support_mode === "recurring" ? Number(support_years || 1) : null,
      })),
    });
  };

  const selectedUrgency = URGENCY_OPTIONS.find((o) => o.value === urgency);

  const displayTypes = uniformTypes.filter(u => u.is_default === 1);

  return (
    <div className="smOverlay" onMouseDown={onClose}>
      <div className="smModal" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────── */}
        <div className="smHead">
          <div className="smHeadLeft">
            <div className="smHeadIcon">
              <Icon icon={isEdit ? "mdi:pencil-outline" : "mdi:account-plus-outline"} width="22" color="white" />
            </div>
            <div>
              <div className="smTitle">{isEdit ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มรายชื่อนักเรียน"}</div>
              {/* ✅ แสดงรหัสนักเรียนใน header เมื่อเป็นโหมดแก้ไข */}
              {isEdit && initial?.student_code ? (
                <div className="smSubtitle" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(255,255,255,0.18)", borderRadius: 6,
                    padding: "2px 8px", fontSize: 12, fontWeight: 600,
                    color: "#fff", letterSpacing: "0.5px",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}>
                    <Icon icon="mdi:identifier" width="13" style={{ opacity: 0.85 }} />
                    {initial.student_code}
                  </span>
                </div>
              ) : (
                <div className="smSubtitle">กรอกข้อมูลให้ครบถ้วนก่อนบันทึก</div>
              )}
            </div>
          </div>
          <button className="smClose" onClick={onClose} type="button">
            <Icon icon="mdi:close" width="24" />
          </button>
        </div>

        <div className="smBody">

          {/* ── Section 1: ข้อมูลนักเรียน ──────────────── */}
          <div className="smSection">
            <div className="smSectionLabel">
              <span className="smSectionNum">1</span> ข้อมูลนักเรียน
            </div>

            <div className="smGrid4">
              {/* ชื่อ */}
              <div className="smField smFieldFull">
                <label className="smLabel">ชื่อ-นามสกุล <span className="smReq">*</span></label>
                <input
                  className={`smInput ${nameErrors.length ? "smInputErr" : dupWarning ? "smInputWarn" : ""}`}
                  value={student_name}
                  onChange={(e) => { setName(e.target.value); setSubmitErrors([]); }}
                  placeholder="เช่น สมชาย ใจดี"
                />
                {nameErrors.length > 0 && (
                  <div className="smFieldErrList">
                    {nameErrors.map((e, i) => (
                      <div key={i} className="smFieldErr">
                        <Icon icon="mdi:alert-circle-outline" width="13" /> {e}
                      </div>
                    ))}
                  </div>
                )}    
              </div>

              {/* เพศ */}
              <div className="smField">
                <label className="smLabel">เพศ <span className="smReq">*</span></label>
                <div className="smToggleGroup">
                  <button type="button"
                    className="smToggleBtn"
                    style={gender === "male" ? { background: "#F0F7FF", borderColor: "#A8C4F0", color: "#5285E8" } : {}}
                    onClick={() => setGender("male")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 48 48"><path fill="currentColor" fillRule="evenodd" d="M24 9.952c-3.393 7.667-10.766 13.18-19.5 13.915V24c0 10.77 8.73 19.5 19.5 19.5S43.5 34.77 43.5 24v-.133C34.766 23.131 27.393 17.62 24 9.952m19.058.296A23.4 23.4 0 0 1 47.5 24c0 12.979-10.521 23.5-23.5 23.5S.5 36.979.5 24c0-6.22 2.417-11.877 6.363-16.08A23.43 23.43 0 0 1 23.895.5h.21c7.61.033 14.366 3.684 18.638 9.321q.159.212.315.427M17.854 32.676a2 2 0 0 0-3.344 2.195c2.156 3.285 5.914 4.811 9.49 4.811s7.334-1.526 9.49-4.811a2 2 0 1 0-3.344-2.195c-1.264 1.927-3.614 3.006-6.146 3.006s-4.882-1.08-6.146-3.006m-.695-11.653a2 2 0 0 1 2 2v1.955a2 2 0 0 1-4 0v-1.955a2 2 0 0 1 2-2m11.682 2a2 2 0 0 1 4 0v1.955a2 2 0 1 1-4 0z" clipRule="evenodd"/></svg>
                    ชาย
                  </button>
                  <button type="button"
                    className="smToggleBtn"
                    style={gender === "female" ? { background: "#FFF0F6", borderColor: "#F0A8C8", color: "#E8528A" } : {}}
                    onClick={() => setGender("female")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"><path fill="currentColor" d="M13.75 13a1.25 1.25 0 1 1 2.5 0a1.25 1.25 0 0 1-2.5 0M22 12v10H2V12C2 6.5 6.5 2 12 2s10 4.5 10 10M4 12c0 4.41 3.59 8 8 8s8-3.59 8-8c0-.79-.12-1.55-.33-2.26A9.97 9.97 0 0 1 9.26 5.77c-.98 2.39-2.85 4.32-5.21 5.37c-.05.28-.05.57-.05.86m5 2.25a1.25 1.25 0 1 0 0-2.5a1.25 1.25 0 0 0 0 2.5"/></svg>
                    หญิง
                  </button>
                </div>
              </div>

              {/* ระดับชั้น */}
              <div className="smField">
                <label className="smLabel">ระดับชั้น <span className="smReq">*</span></label>
                <div className="smToggleGroup smToggleGroup3">
                  {[
                    { v: "อนุบาล", l: "อนุบาล" },
                    { v: "ประถมศึกษา", l: "ประถม" },
                    { v: "มัธยมตอนต้น", l: "ม.ต้น" },
                    { v: "มัธยมตอนปลาย", l: "ม.ปลาย" },
                  ].map(({ v, l }) => (
                    <button key={v} type="button"
                      className={`smToggleBtn ${education_level === v ? "smToggleActive" : ""}`}
                      onClick={() => setGrade(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* ความเร่งด่วน */}
              <div className="smField smFieldFull">
                <label className="smLabel">ความเร่งด่วน <span className="smReq">*</span></label>
                <div className="smUrgencyGroup">
                  {URGENCY_OPTIONS.map((o) => (
                    <button
                      key={o.value} type="button"
                      className={`smUrgencyBtn ${urgency === o.value ? "smUrgencyActive" : ""}`}
                      style={urgency === o.value ? { background: o.bg, borderColor: o.color, color: o.color } : {}}
                      onClick={() => setUrgency(o.value)}
                    >
                      <span className="smUrgencyDot" style={{ background: o.dot }} />
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* รูปแบบการสนับสนุน */}
              <div className="smField smFieldFull">
                <label className="smLabel">
                  <Icon icon="mdi:hand-heart-outline" width="14" style={{ verticalAlign: "middle", marginRight: 4 }} />
                  รูปแบบการสนับสนุน <span className="smReq">*</span>
                </label>
                <div className="smSupportGroup">
                  <div className="smSupportChipRow">
                    {[
                      { v: "one_time",  l: "รับครั้งเดียว", icon: "mdi:gift-outline",   activeBg: "#FFF8E7", activeBorder: "#F5A623", activeColor: "#92400E" },
                      { v: "recurring", l: "รับต่อเนื่อง",  icon: "mdi:calendar-sync",  activeBg: "#EEF2FD", activeBorder: "#5285E8", activeColor: "#2d5cbf" },
                    ].map(({ v, l, icon, activeBg, activeBorder, activeColor }) => (
                      <button key={v} type="button"
                        className="smSupportChip"
                        style={support_mode === v
                          ? { background: activeBg, borderColor: activeBorder, color: activeColor, fontWeight: 600 }
                          : {}}
                        onClick={() => setSupportMode(v)}>
                        <Icon icon={icon} width="15" />
                        {l}
                      </button>
                    ))}
                  </div>
                  {support_mode === "recurring" && (
                    <div className="smYearsRow">
                      <Icon icon="mdi:calendar-range-outline" width="15" style={{ color: "var(--um-text-sub)" }} />
                      <span>ระยะเวลา</span>
                      <button type="button" className="smQtyBtn"
                        onClick={() => setSupportYears((y) => Math.max(1, Number(y) - 1))}>−</button>
                      <input className="smQtyInput" type="number" min="1"
                        value={support_years}
                        onChange={(e) => setSupportYears(e.target.value)}
                        style={{ width: 52 }} />
                      <button type="button" className="smQtyBtn"
                        onClick={() => setSupportYears((y) => Number(y) + 1)}>+</button>
                      <span>ปี</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: รายการความต้องการ ───────────── */}
          <div className="smSection">
            <div className="smSectionLabel">
              <span className="smSectionNum">2</span> รายการความต้องการ
              <button className="smBtnAddNeed" onClick={addNeed} type="button">
                <Icon icon="mdi:plus" width="14" /> เพิ่มรายการ
              </button>
            </div>

            {/* Tabs */}
            {needs.length > 1 && (
              <div className="smNeedTabs">
                {needs.map((n, idx) => {
                  const found = uniformTypes.find(
                    (u) => Number(u.uniform_type_id) === Number(n.uniform_type_id)
                  );
                  const typeName = found?.uniform_type_name || found?.type_name || "ไม่ระบุ";
                  return (
                    <button
                      key={idx} type="button"
                      className={`smNeedTab ${activeNeed === idx ? "smNeedTabActive" : ""}`}
                      onClick={() => setActiveNeed(idx)}
                    >
                      {typeName || `รายการ ${idx + 1}`}
                    </button>
                  );
                })}
              </div>
            )}

            {needs.map((n, idx) => {
              const schema = getSchemaByType(uniformTypes, n.uniform_type_id);
              if (idx !== activeNeed && needs.length > 1) return null;
              return (
                <div className="smNeedCard" key={idx}>
                  <div className="smNeedGrid">

                    {/* ประเภทชุด */}
                    <div className="smField smFieldFull">
                      <label className="smLabel">ประเภทชุด <span className="smReq">*</span></label>
                      <select
                        className="smSelect"
                        value={n.uniform_type_id}
                        onChange={(e) => updateNeed(idx, { uniform_type_id: Number(e.target.value) || "", size: {} })}
                      >
                        <option value="">{displayTypes.length === 0 ? "กำลังโหลด..." : "— เลือกประเภทชุด —"}</option>
                        {displayTypes.map((u) => (
                          <option key={u.uniform_type_id} value={u.uniform_type_id}>{u.type_name || u.uniform_type_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Size fields */}
                    {schema.map((field) => (
                      <div className="smField" key={field.key}>
                        <label className="smLabel">
                          {field.label}{field.unit ? <span className="smUnit"> ({field.unit})</span> : ""}
                          {field.required && <span className="smReq"> *</span>}
                        </label>
                        <input
                          className="smInput"
                          type={field.type || "text"}
                          value={n.size?.[field.key] ?? ""}
                          placeholder="กรอกขนาด"
                          onChange={(e) => updateNeed(idx, { size: { ...(n.size || {}), [field.key]: e.target.value } })}
                        />
                      </div>
                    ))}

                    {/* จำนวน + ได้รับ + สถานะ */}
                    <div className="smField">
                      <label className="smLabel">จำนวนที่ต้องการ <span className="smReq">*</span></label>
                      <div className="smQtyRow">
                        <button type="button" className="smQtyBtn"
                          onClick={() => updateNeed(idx, { quantity_needed: Math.max(1, Number(n.quantity_needed) - 1) })}>−</button>
                        <input
                          className="smQtyInput"
                          type="number" min="1"
                          value={n.quantity_needed}
                          onChange={(e) => updateNeed(idx, { quantity_needed: e.target.value })}
                        />
                        <button type="button" className="smQtyBtn"
                          onClick={() => updateNeed(idx, { quantity_needed: Number(n.quantity_needed) + 1 })}>+</button>
                        <span className="smQtyUnit">ตัว</span>
                      </div>
                    </div>

                    <div className="smField">
                      <label className="smLabel">ได้รับแล้ว</label>
                      <div className="smQtyRow">
                        <button type="button" className="smQtyBtn"
                          onClick={() => updateNeed(idx, { quantity_received: Math.max(0, Number(n.quantity_received) - 1) })}>−</button>
                        <input
                          className="smQtyInput"
                          type="number" min="0" max={Number(n.quantity_needed || 0)}
                          value={n.quantity_received ?? 0}
                          onChange={(e) => updateNeed(idx, { quantity_received: e.target.value })}
                        />
                        <button type="button" className="smQtyBtn"
                          onClick={() => updateNeed(idx, { quantity_received: Math.min(Number(n.quantity_needed), Number(n.quantity_received) + 1) })}>+</button>
                        <span className="smQtyUnit">ตัว</span>
                      </div>
                    </div>

                    <div className="smField">
                      <label className="smLabel">สถานะ</label>
                      <select className="smSelect" value={n.status}
                        onChange={(e) => updateNeed(idx, { status: e.target.value })}>
                        <option value="pending">ยังไม่ได้รับ</option>
                        <option value="partial">ได้รับบางส่วน</option>
                        <option value="fulfilled">ได้รับครบแล้ว</option>
                      </select>
                    </div>
                  </div>

                  {needs.length > 1 && (
                    <div className="smNeedFooter">
                      <button className="smBtnRemove" onClick={() => removeNeed(idx)} type="button">
                        <Icon icon="mdi:trash-can-outline" width="14" /> ลบรายการนี้
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Submit Errors ──────────────────────────────── */}
        {submitErrors.length > 0 && (
          <div className="smSubmitErrBox">
            <Icon icon="mdi:alert-circle" width="16" />
            <div>
              {submitErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────── */}
        <div className="smFoot">
          {selectedUrgency && (
            <div className="smUrgencyBadge" style={{ background: selectedUrgency.bg, color: selectedUrgency.color }}>
              <span className="smUrgencyDot" style={{ background: selectedUrgency.dot }} />
              {selectedUrgency.label}
            </div>
          )}
          <div className="smFootActions">
            <button className="smBtnGhost" onClick={onClose} type="button">
              <Icon icon="mdi:close" width="15" /> ยกเลิก
            </button>
            <button className="smBtnPrimary" disabled={!canSave} onClick={submit} type="button">
              <Icon icon={isEdit ? "mdi:content-save-outline" : "mdi:check"} width="15" />
              {isEdit ? "บันทึกการแก้ไข" : "เพิ่มนักเรียน"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}