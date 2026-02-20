import { useEffect, useMemo, useState } from "react";
import "../styles/schoolDetailModal.css";
import { Icon } from "@iconify/react";

export default function SchoolDetailModal({
  open,
  school,
  onClose,
  onEditSave,
  onApprove,
  onReject,
  onRemove,
  busy = false,
}) {
  const s = school || {};
  const status = s.verification_status || "pending";

  const statusBadge = useMemo(() => {
    if (status === "approved") return <span className="sdBadge sdBadge--ok">อนุมัติแล้ว</span>;
    if (status === "rejected") return <span className="sdBadge sdBadge--bad">ระงับบัญชี</span>;
    return <span className="sdBadge sdBadge--wait">รอตรวจสอบ</span>;
  }, [status]);

  const [editMode, setEditMode] = useState(false);
  const [e, setE] = useState("");

  // ✅ เพิ่มฟิลด์ผู้ประสานงาน + แอดมินโรงเรียน
  const [f, setF] = useState({
    // school
    school_name: "",
    school_code: "",
    school_address: "",
    school_phone: "",
    school_intent: "",

    // coordinator (users)
    coordinator_name: "",
    coordinator_email: "",
    coordinator_phone: "",

    // school admin (users)
    admin_name: "",
    admin_email: "",
    admin_phone: "",
  });

  useEffect(() => {
    if (!open || !school) return;
    setEditMode(false);
    setE("");
    setF({
      // school
      school_name: school.school_name || "",
      school_code: school.school_code || "",
      school_address: school.school_address || "",
      school_phone: school.school_phone || "",
      school_intent: school.school_intent || "",

      // coordinator
      coordinator_name: school.coordinator_name || "",
      coordinator_email: school.coordinator_email || "",
      coordinator_phone: school.coordinator_phone || "",

      // school admin
      admin_name: school.admin_name || "",
      admin_email: school.admin_email || "",
      admin_phone: school.admin_phone || "",
    });
  }, [open, school]);

  const onChange = (ev) => {
    const { name, value } = ev.target;
    setF((prev) => ({ ...prev, [name]: value }));
  };

  const normalizePhone = (input) => {
    let raw = String(input || "").replace(/\D/g, "");
    if (raw.startsWith("66") && raw.length === 11) raw = "0" + raw.slice(2);
    if (raw.length === 9) raw = "0" + raw;
    return raw;
  };

  const isValidEmail = (email) => {
    const v = String(email || "").trim();
    if (!v) return true; // อนุญาตเว้นว่าง
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };

  const save = async () => {
    if (busy) return;
    setE("");

    // ✅ school_code optional for admin
    const codeRaw = String(f.school_code ?? "").trim();
    const codeDigits = codeRaw.replace(/\D/g, "");
    if (codeRaw !== "" && !/^\d{10}$/.test(codeDigits)) {
      setE("รหัสสถานศึกษาต้องเป็นตัวเลข 10 หลักพอดี (หรือเว้นว่างเพื่อไม่แก้ไข)");
      return;
    }

    // school phone required
    const schoolPhone = normalizePhone(f.school_phone);
    if (!/^0\d{9}$/.test(schoolPhone)) {
      setE("เบอร์โทรโรงเรียนต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0");
      return;
    }

    if (!String(f.school_name || "").trim() || !String(f.school_address || "").trim()) {
      setE("กรุณากรอกข้อมูลโรงเรียนให้ครบ");
      return;
    }

    // coordinator validate (optional)
    const coordEmail = String(f.coordinator_email || "").trim();
    if (coordEmail && !isValidEmail(coordEmail)) {
      setE("อีเมลผู้ประสานงานไม่ถูกต้อง");
      return;
    }
    const coordPhoneRaw = String(f.coordinator_phone || "").trim();
    const coordPhone = normalizePhone(coordPhoneRaw);
    if (coordPhoneRaw && !/^0\d{9}$/.test(coordPhone)) {
      setE("เบอร์ผู้ประสานงานต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0");
      return;
    }

    // school admin validate (optional)
    const adminEmail = String(f.admin_email || "").trim();
    if (adminEmail && !isValidEmail(adminEmail)) {
      setE("อีเมลแอดมินโรงเรียนไม่ถูกต้อง");
      return;
    }
    const adminPhoneRaw = String(f.admin_phone || "").trim();
    const adminPhone = normalizePhone(adminPhoneRaw);
    if (adminPhoneRaw && !/^0\d{9}$/.test(adminPhone)) {
      setE("เบอร์แอดมินโรงเรียนต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0");
      return;
    }

    // ✅ payload ส่งทั้ง 3 ส่วน
    const payload = {
      // school
      school_name: String(f.school_name).trim(),
      school_address: String(f.school_address).trim(),
      school_phone: schoolPhone,
      school_intent: f.school_intent || "",

      // coordinator
      coordinator_name: String(f.coordinator_name || "").trim(),
      coordinator_email: coordEmail,
      coordinator_phone: coordPhoneRaw ? coordPhone : "",

      // school admin
      admin_name: String(f.admin_name || "").trim(),
      admin_email: adminEmail,
      admin_phone: adminPhoneRaw ? adminPhone : "",
    };

    if (codeRaw !== "") payload.school_code = codeDigits;

    try {
      await onEditSave?.(school.school_id, payload);
      setEditMode(false);
    } catch (err) {
      setE(err?.data?.message || err?.message || "บันทึกไม่สำเร็จ");
    }
  };

  const cancelEdit = () => {
    if (!school) return;
    setE("");
    setEditMode(false);
    setF({
      school_name: school.school_name || "",
      school_code: school.school_code || "",
      school_address: school.school_address || "",
      school_phone: school.school_phone || "",
      school_intent: school.school_intent || "",

      coordinator_name: school.coordinator_name || "",
      coordinator_email: school.coordinator_email || "",
      coordinator_phone: school.coordinator_phone || "",

      admin_name: school.admin_name || "",
      admin_email: school.admin_email || "",
      admin_phone: school.admin_phone || "",
    });
  };

  if (!open || !school) return null;

  return (
    <div className="sdOverlay" onMouseDown={onClose}>
      <div className="sdModal" onMouseDown={(ev) => ev.stopPropagation()}>
        {/* Header */}
        <div className="sdHead">
          <div className="sdTitleWrap">
            <div className="sdTitle">
              {editMode ? (
                <input className="sdInputTitle" name="school_name" value={f.school_name} onChange={onChange} disabled={busy} />
              ) : (
                school.school_name || "-"
              )}
            </div>

            <div className="sdSub">
              รหัสสถานศึกษา:{" "}
              {editMode ? (
                <input
                  className="sdInputMini"
                  name="school_code"
                  value={f.school_code}
                  onChange={onChange}
                  maxLength={10}
                  placeholder="เว้นว่างได้ (ไม่แก้ไข)"
                  disabled={busy}
                />
              ) : (
                <b>{school.school_code || "-"}</b>
  )}

  {!editMode && (
    <>
      {" "}• {statusBadge}
    </>
  )}
            </div>
          </div>

          <div className="sdHeadActions">
            {!editMode ? (
              <button className="sdIconBtn" onClick={() => setEditMode(true)} title="แก้ไขข้อมูล" type="button" disabled={busy}>
                <Icon icon="iconamoon:edit-light" width="24" height="24" />
              </button>
            ) : (
              <button className="sdIconBtn" onClick={cancelEdit} title="ยกเลิกแก้ไข" type="button" disabled={busy}>
                ↶
              </button>
            )}
            <button className="sdIconBtn" onClick={onClose} title="ปิด" type="button">✕</button>
          </div>
        </div>

        {e && <div className="sdInlineError">{e}</div>}

        {/* Body */}
        <div className="sdBody">
          <div className="sdGrid">
            <div className="sdLogoCard">
              <div className="sdLogoLabel">ตราโรงเรียน</div>
              {school.school_logo_url ? (
                <img className="sdLogoImg" src={school.school_logo_url} alt="school logo" />
              ) : (
                <div className="sdLogoEmpty">ไม่มีตราโรงเรียน</div>
              )}
            </div>

            <div className="sdInfoCard">
              {/* ===== โรงเรียน ===== */}
              <div className="sdSectionTitle">ข้อมูลโรงเรียน</div>

              <div className="sdInfoRow">
                <div className="sdKey">ที่อยู่</div>
                <div className="sdVal">
                  {editMode ? (
                    <input className="sdInput" name="school_address" value={f.school_address} onChange={onChange} disabled={busy} />
                  ) : (
                    school.school_address || "-"
                  )}
                </div>
              </div>

              <div className="sdInfoRow">
                <div className="sdKey">เบอร์โทรโรงเรียน</div>
                <div className="sdVal">
                  {editMode ? (
                    <input className="sdInput" name="school_phone" value={f.school_phone} onChange={onChange} disabled={busy} />
                  ) : (
                    school.school_phone || "-"
                  )}
                </div>
              </div>

              <div className="sdInfoRow">
                <div className="sdKey">ความประสงค์</div>
                <div className="sdVal sdVal--pre">
                  {editMode ? (
                    <textarea className="sdTextarea" name="school_intent" value={f.school_intent} onChange={onChange} rows={4} disabled={busy} />
                  ) : (
                    school.school_intent || "-"
                  )}
                </div>
              </div>

              {/* ===== ผู้ประสานงาน ===== */}
              <div className="sdSectionTitle" style={{ marginTop: 12 }}>ผู้ประสานงาน</div>

              <div className="sdInfoRow">
                <div className="sdKey">ชื่อ</div>
                <div className="sdVal">
                  {editMode ? (
                    <input className="sdInput" name="coordinator_name" value={f.coordinator_name} onChange={onChange} disabled={busy} />
                  ) : (
                    school.coordinator_name || "-"
                  )}
                </div>
              </div>

              <div className="sdInfoRow">
                <div className="sdKey">อีเมล</div>
                <div className="sdVal">
                  {editMode ? (
                    <input className="sdInput" name="coordinator_email" value={f.coordinator_email} onChange={onChange} disabled={busy} />
                  ) : (
                    school.coordinator_email || "-"
                  )}
                </div>
              </div>

              <div className="sdInfoRow">
                <div className="sdKey">เบอร์โทร</div>
                <div className="sdVal">
                  {editMode ? (
                    <input className="sdInput" name="coordinator_phone" value={f.coordinator_phone} onChange={onChange} disabled={busy} placeholder="เว้นว่างได้" />
                  ) : (
                    school.coordinator_phone || "-"
                  )}
                </div>
              </div>


              {/* ===== เอกสาร/หมายเหตุ ===== */}
              <div className="sdInfoRow">
                <div className="sdKey">เอกสาร</div>
                <div className="sdVal">
                  {school.school_doc_url ? (
                    <a className="sdLink" href={school.school_doc_url} target="_blank" rel="noreferrer">
                      เปิดเอกสารยืนยัน
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
              </div>

              <div className="sdInfoRow">
                <div className="sdKey">หมายเหตุการตรวจสอบ</div>
                <div className="sdVal sdVal--pre">{school.verification_note || "-"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sdFooter">
          <button className="sdBtn" onClick={onClose} disabled={busy} type="button">ปิด</button>

          {editMode ? (
            <div className="sdFooterRight">
              <button className="sdBtn" onClick={cancelEdit} disabled={busy} type="button">ยกเลิก</button>
              <button className="sdBtn sdBtn--ok" onClick={save} disabled={busy} type="button">
                {busy ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          ) : (
            <div className="sdFooterRight">
              {status === "pending" && (
                <>
                  <button className="sdBtn sdBtn--bad" onClick={() => onReject?.(school)} disabled={busy} type="button">ปฏิเสธ</button>
                  <button className="sdBtn sdBtn--ok" onClick={() => onApprove?.(school)} disabled={busy} type="button">อนุมัติ</button>
                </>
              )}
              {status === "rejected" && (
                <button className="sdBtn sdBtn--ok" onClick={() => onApprove?.(school)} disabled={busy} type="button">อนุมัติแทน</button>
              )}
              {status === "approved" && (
                <button className="sdBtn sdBtn--warn" onClick={() => onRemove?.(school)} disabled={busy} type="button">ระงับบัญชี</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
