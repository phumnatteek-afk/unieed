import { useEffect, useMemo, useState } from "react";
import "../styles/studentModal.css";

const emptyNeed = () => ({
  uniform_type_id: "",
  size: {},                 // ✅ object
  quantity_needed: 1,
  quantity_received: 0,
  status: "pending",
  support_mode: "one_time",
  support_years: 1,
});


function getSchemaByType(uniformTypes = [], uniformTypeId) {
  if (!uniformTypeId) return [];

  const u = uniformTypes.find(
    (x) => x && Number(x.uniform_type_id) === Number(uniformTypeId)
  );
  if (!u) return [];

  const raw = u.size_schema;

  // size_schema อาจเป็น JSON string หรือ object/array อยู่แล้ว
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}


// ✅ helper: parse size ที่อาจเป็น string JSON หรือ object
function parseSize(rawSize) {
  if (!rawSize) return {};
  if (typeof rawSize === "object") return rawSize;
  if (typeof rawSize === "string") {
    try {
      const obj = JSON.parse(rawSize);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default function StudentModal({ open, onClose, onSave, uniformTypes = [], initial }) {
  const isEdit = !!initial;

  const [student_name, setName] = useState("");
  const [education_level, setGrade] = useState("ประถมศึกษา");
  const [gender, setGender] = useState("female");
  const [urgency, setUrgency] = useState("can_wait");
  const [needs, setNeeds] = useState([emptyNeed()]);

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setName(initial.student_name || "");
      setGrade(initial.education_level || "ประถมศึกษา");
      setGender(initial.gender || "female");
      setUrgency(initial.urgency || "can_wait");

      const ns =
        Array.isArray(initial.needs) && initial.needs.length
          ? initial.needs.map((n) => ({
              uniform_type_id: n.uniform_type_id ?? "",
              size: parseSize(n.size), // ✅ parse JSON string -> object
              quantity_needed: Number(n.quantity_needed || 1),
              quantity_received: Number(n.quantity_received || 0),
              status: n.status || "pending",
              support_mode: n.support_mode || "one_time",
              support_years: Number(n.support_years || 1),
            }))
          : [emptyNeed()];

      setNeeds(ns);
    } else {
      setName("");
      setGrade("ประถมศึกษา");
      setGender("female"); // ✅ ต้องเป็นค่าที่ select รองรับ
      setUrgency("can_wait");
      setNeeds([emptyNeed()]);
    }
  }, [open, initial]);

  const updateNeed = (idx, patch) => {
    setNeeds((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const addNeed = () => setNeeds((p) => [...p, emptyNeed()]);
  const removeNeed = (idx) => setNeeds((p) => p.filter((_, i) => i !== idx));

  // ✅ validate ตาม schema
  const canSave = useMemo(() => {
    if (!student_name.trim()) return false;
    if (!needs.length) return false;

    for (const n of needs) {
      if (!n.uniform_type_id) return false;
      if (!n.quantity_needed || Number(n.quantity_needed) <= 0) return false;

      const schema = getSchemaByType(uniformTypes, n.uniform_type_id);
      if (schema.length > 0) {
        // ต้องกรอก field ที่ required
        for (const f of schema) {
          if (f.required) {
            const v = n.size?.[f.key];
            if (v === undefined || v === null || String(v).trim() === "") return false;
          }
        }
      } else {
        // fallback ถ้าไม่มี schema ก็ต้องมีค่า size อย่างน้อย 1 ช่อง
        if (!n.size || Object.keys(n.size).length === 0) return false;
      }

      // received ต้องไม่เกิน needed
      const needQty = Number(n.quantity_needed || 0);
      const recvQty = Number(n.quantity_received || 0);
      if (recvQty < 0) return false;
      if (recvQty > needQty) return false;

      if (n.support_mode === "recurring" && (!n.support_years || Number(n.support_years) <= 0)) {
        return false;
      }
    }

    return true;
  }, [student_name, needs, uniformTypes]);

  if (!open) return null;

  const submit = () => {
    if (!canSave) return;

    onSave({
      student_name: student_name.trim(),
      education_level,
      gender,
      urgency,
      needs: needs.map((n) => ({
        ...n,
        uniform_type_id: Number(n.uniform_type_id),
        quantity_needed: Number(n.quantity_needed),
        quantity_received: Number(n.quantity_received || 0),
        // ✅ ส่ง size เป็น JSON string เข้า backend (เก็บลง DB ได้ทันที)
        size: JSON.stringify(n.size || {}),
        support_years: n.support_mode === "recurring" ? Number(n.support_years || 1) : null,
      })),
    });
  };

  return (
    <div className="smOverlay" onMouseDown={onClose}>
      <div className="smModal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="smHead">
          <div className="smTitle">{isEdit ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มรายชื่อนักเรียน"}</div>
          <button className="smClose" onClick={onClose} type="button">✕</button>
        </div>

        <div className="smBody">
          <div className="smGrid">
            <div className="smField">
              <label>ชื่อนักเรียน</label>
              <input value={student_name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เด็กชาย..." />
            </div>

            <div className="smField">
              <label>ระดับชั้น</label>
              <select value={education_level} onChange={(e) => setGrade(e.target.value)}>
                <option value="ประถมศึกษา">ประถมศึกษา</option>
                <option value="มัธยมศึกษา">มัธยมศึกษา</option>
              </select>
            </div>

            <div className="smField">
              <label>เพศ</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="female">หญิง</option>
                <option value="male">ชาย</option>
              </select>
            </div>

            <div className="smField">
              <label>ความเร่งด่วน</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="very_urgent">เร่งด่วนมาก (แดง)</option>
                <option value="urgent">เร่งด่วน (เหลือง)</option>
                <option value="can_wait">รอได้ (ฟ้า)</option>
              </select>
            </div>
          </div>

          <div className="smSection">
            <div className="smSectionHead">
              <div className="smSectionTitle">รายการความต้องการ</div>
              <button className="smBtnAdd" onClick={addNeed} type="button">+ เพิ่มรายการ</button>
            </div>

            {needs.map((n, idx) => {
              const schema = getSchemaByType(uniformTypes, n.uniform_type_id);

              return (
                <div className="smNeedCard" key={idx}>
                  <div className="smNeedGrid">
                    <div className="smField">
                      <label>ประเภทชุด</label>
                      <select
                        value={n.uniform_type_id}
                        onChange={(e) => {
                          const nextId = Number(e.target.value) || "";
                          // ✅ เปลี่ยนประเภทแล้ว reset size
                          updateNeed(idx, { uniform_type_id: nextId, size: {} });
                        }}
                      >
                        <option value="">
                          {uniformTypes.length === 0 ? "กำลังโหลด..." : "เลือกประเภท"}
                        </option>
                        {uniformTypes.map((u) => (
                          <option key={u.uniform_type_id} value={u.uniform_type_id}>
                            {u.uniform_type_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ✅ size fields ตาม schema */}
                    {schema.map((field) => (
                      <div className="smField" key={field.key}>
                        <label>
                          {field.label} {field.unit ? `(${field.unit})` : ""}
                        </label>
                        <input
                          type={field.type || "text"}
                          value={n.size?.[field.key] ?? ""}
                          required={!!field.required}
                          onChange={(e) =>
                            updateNeed(idx, {
                              size: {
                                ...(n.size || {}),
                                [field.key]: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ))}

                    <div className="smField">
                      <label>จำนวนที่ต้องการ</label>
                      <input
                        type="number"
                        min="1"
                        value={n.quantity_needed}
                        onChange={(e) => updateNeed(idx, { quantity_needed: e.target.value })}
                      />
                    </div>

                    <div className="smField">
                      <label>ได้รับแล้ว</label>
                      <input
                        type="number"
                        min="0"
                        max={Number(n.quantity_needed || 0)}
                        value={n.quantity_received ?? 0}
                        onChange={(e) => updateNeed(idx, { quantity_received: e.target.value })}
                      />
                    </div>

                    <div className="smField">
                      <label>สถานะ</label>
                      <select value={n.status} onChange={(e) => updateNeed(idx, { status: e.target.value })}>
                        <option value="pending">ยังไม่ได้รับ</option>
                        <option value="partial">ได้รับบางส่วน</option>
                        <option value="fulfilled">ได้รับครบแล้ว</option>
                      </select>
                    </div>
                  </div>

                  <div className="smSupportRow">
                    <div className="smToggle">
                      <label className="smRadio">
                        <input
                          type="radio"
                          name={`support_${idx}`}
                          checked={n.support_mode === "one_time"}
                          onChange={() => updateNeed(idx, { support_mode: "one_time" })}
                        />
                        สนับสนุนครั้งเดียว
                      </label>

                      <label className="smRadio">
                        <input
                          type="radio"
                          name={`support_${idx}`}
                          checked={n.support_mode === "recurring"}
                          onChange={() => updateNeed(idx, { support_mode: "recurring" })}
                        />
                        สนับสนุนต่อเนื่อง
                      </label>
                    </div>

                    {n.support_mode === "recurring" && (
                      <div className="smYears">
                        <span>ระยะเวลา</span>
                        <input
                          type="number"
                          min="1"
                          value={n.support_years || 1}
                          onChange={(e) => updateNeed(idx, { support_years: e.target.value })}
                        />
                        <span>ปี</span>
                      </div>
                    )}

                    {needs.length > 1 && (
                      <button className="smBtnRemove" onClick={() => removeNeed(idx)} type="button">
                        ลบรายการ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="smFoot">
          <button className="smBtnGhost" onClick={onClose} type="button">ยกเลิก</button>
          <button className="smBtnPrimary" disabled={!canSave} onClick={submit} type="button">
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
