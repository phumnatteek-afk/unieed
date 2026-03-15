import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import "../styles/studentModal.css";

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
  { value: "urgent",      label: "เร่งด่วน",     color: "#F59E0B", bg: "#FFFBEB", dot: "#F59E0B" },
  { value: "can_wait",    label: "รอได้",          color: "#29B6E8", bg: "#E0F7FF", dot: "#29B6E8" },
];

export default function StudentModal({ open, onClose, onSave, uniformTypes = [], initial }) {
  const isEdit = !!initial;
  const [student_name, setName]             = useState("");
  const [education_level, setGrade]         = useState("ประถมศึกษา");
  const [gender, setGender]                 = useState("female");
  const [urgency, setUrgency]               = useState("can_wait");
  const [support_mode, setSupportMode]      = useState("one_time");
  const [support_years, setSupportYears]    = useState(1);
  const [needs, setNeeds]                   = useState([emptyNeed()]);
  const [activeNeed, setActiveNeed]         = useState(0);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.student_name || "");
      setGrade(initial.education_level || "ประถมศึกษา");
      setGender(initial.gender || "female");
      setUrgency(initial.urgency || "can_wait");
      // support_mode/years อยู่ระดับนักเรียน — ดึงจาก need แรก
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

  const canSave = useMemo(() => {
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
  }, [student_name, needs, uniformTypes, support_mode, support_years]);

  if (!open) return null;

  const submit = () => {
    if (!canSave) return;
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

  return (
    <div className="smOverlay" onMouseDown={onClose}>
      <div className="smModal" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────── */}
        <div className="smHead">
          <div className="smHeadLeft">
            <div className="smHeadIcon">
              <Icon icon={isEdit ? "mdi:pencil-outline" : "mdi:account-plus-outline"} width="22" />
            </div>
            <div>
              <div className="smTitle">{isEdit ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มรายชื่อนักเรียน"}</div>
              <div className="smSubtitle">กรอกข้อมูลให้ครบถ้วนก่อนบันทึก</div>
            </div>
          </div>
          <button className="smClose" onClick={onClose} type="button">
            <Icon icon="mdi:close" width="18" />
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
                  className="smInput"
                  value={student_name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น เด็กชายสมชาย ใจดี"
                />
              </div>

              {/* เพศ */}
              <div className="smField">
                <label className="smLabel">เพศ <span className="smReq">*</span></label>
                <div className="smToggleGroup">
                  {[
                    { v: "male",   l: "ชาย",  icon: "mdi:human-male"   },
                    { v: "female", l: "หญิง", icon: "mdi:human-female" },
                  ].map(({ v, l, icon }) => (
                    <button key={v} type="button"
                      className={`smToggleBtn ${gender === v ? "smToggleActive" : ""}`}
                      onClick={() => setGender(v)}>
                      <Icon icon={icon} width="16" /> {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* ระดับชั้น */}
              <div className="smField">
                <label className="smLabel">ระดับชั้น <span className="smReq">*</span></label>
                <div className="smToggleGroup smToggleGroup3">
                  {[
                    { v: "อนุบาล",     l: "อนุบาล"  },
                    { v: "ประถมศึกษา", l: "ประถม"   },
                    { v: "มัธยมศึกษา", l: "มัธยม"   },
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
                  {[
                    { v: "one_time",  l: "รับครั้งเดียว",  icon: "mdi:gift-outline"   },
                    { v: "recurring", l: "รับต่อเนื่อง",    icon: "mdi:calendar-sync"  },
                  ].map(({ v, l, icon }) => (
                    <button key={v} type="button"
                      className={`smSupportChip ${support_mode === v ? "smSupportChipActive" : ""}`}
                      onClick={() => setSupportMode(v)}>
                      <Icon icon={icon} width="15" />
                      {l}
                    </button>
                  ))}
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
                  const typeName = uniformTypes.find(
                    (u) => Number(u.uniform_type_id) === Number(n.uniform_type_id)
                  )?.uniform_type_name;
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
                        <option value="">{uniformTypes.length === 0 ? "กำลังโหลด..." : "— เลือกประเภทชุด —"}</option>
                        {uniformTypes.map((u) => (
                          <option key={u.uniform_type_id} value={u.uniform_type_id}>{u.uniform_type_name}</option>
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