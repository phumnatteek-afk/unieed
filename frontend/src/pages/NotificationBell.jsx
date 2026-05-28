import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import { getSocket } from "../lib/socket.js";
import {
  getNotifAction,
  parseNotifBody,
  NOTIF_ICONS,
  NOTIF_ICON_CLASS,
} from "../utils/notificationActions.js";
import "./styles/NotificationBell.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

// ── Confetti ───────────────────────────────────────────────────────
function ConfettiEffect() {
  const colors = ["#29B6E8", "#FFBE1B", "#f97316", "#16a34a", "#7c3aed", "#ec4899"];
  return (
    <div className="nb-confetti-wrap">
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          style={{
            position:     "absolute",
            top:          "-20px",
            left:         `${Math.random() * 100}%`,
            width:        `${6 + Math.random() * 8}px`,
            height:       `${10 + Math.random() * 12}px`,
            background:   colors[Math.floor(Math.random() * colors.length)],
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animation:    `confettiFall ${2 + Math.random() * 3}s ${Math.random() * 2}s linear forwards`,
            transform:    `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`@keyframes confettiFall { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`}</style>
    </div>
  );
}

// ── Appeal Modal ───────────────────────────────────────────────────
function AppealModal({ onClose, onSuccess, token }) {
  const [reason,      setReason]      = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [err,         setErr]         = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) return setErr("กรุณาระบุเหตุผล");
    try {
      setSubmitting(true);
      setErr("");
      const res = await fetch(`${BASE}/donations/appeal-strike`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return setErr(data?.message || "ส่งไม่สำเร็จ");
      setDone(true);
      onSuccess?.(reason.trim());
    } catch { setErr("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="nb-cert-modal-top" style={{ background: "#1d4ed8" }}>
          <div className="nb-cert-modal-emoji"><svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 56 56"><path fill="white" d="M15.555 53.125h24.89c4.852 0 7.266-2.461 7.266-7.336V24.508c0-3.024-.328-4.336-2.203-6.258L32.57 5.102c-1.78-1.829-3.234-2.227-5.882-2.227H15.555c-4.828 0-7.266 2.484-7.266 7.36v35.554c0 4.898 2.438 7.336 7.266 7.336m.187-3.773c-2.414 0-3.68-1.29-3.68-3.633V10.305c0-2.32 1.266-3.657 3.704-3.657h10.406v13.618c0 2.953 1.5 4.406 4.406 4.406h13.36v21.047c0 2.343-1.243 3.633-3.68 3.633ZM31 21.132c-.914 0-1.29-.374-1.29-1.312V7.375l13.5 13.758Zm5.625 9.985h-17.79c-.843 0-1.452.633-1.452 1.43c0 .82.61 1.453 1.453 1.453h17.789a1.43 1.43 0 0 0 1.453-1.453c0-.797-.633-1.43-1.453-1.43m0 8.18h-17.79c-.843 0-1.452.656-1.452 1.476c0 .797.61 1.407 1.453 1.407h17.789c.82 0 1.453-.61 1.453-1.407c0-.82-.633-1.476-1.453-1.476"/></svg></div>
          <div className="nb-cert-modal-title">ขอให้ทีมงานตรวจสอบ</div>
          <div className="nb-cert-modal-sub">ชี้แจงเหตุผลเพื่อขอปลดล็อคการบริจาค</div>
        </div>
        <div className="nb-cert-modal-body">
          {done ? (
            <>
              <div style={{ textAlign: "center", padding: "12px 0", fontSize: 14, color: "#16a34a" }}>
                ✓ ส่งคำร้องเรียบร้อยแล้ว ทีมงานจะตรวจสอบและติดต่อกลับ
              </div>
              <div className="nb-cert-actions">
                <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>ปิด</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                อธิบายเหตุผลที่คิดว่าการระงับนี้ไม่ถูกต้อง หรือสิ่งที่เกิดขึ้นจริง
              </div>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={4}
                placeholder="เช่น ของที่ส่งตรงตามที่โครงการระบุทุกอย่าง มีหลักฐานการซื้อ..."
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", marginBottom: 8 }}
              />
              {err && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{err}</div>}
              <div className="nb-cert-actions">
                <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose} disabled={submitting}>ยกเลิก</button>
                <button
                  className="nb-cert-btn"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ background: "#2563eb", color: "#fff", border: "none" }}
                >
                  {submitting ? "กำลังส่ง..." : "ส่งคำร้อง"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Strike Reset Popup (donor) ────────────────────────────────────
function StrikeResetPopup({ notif, onClose }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="nb-cert-modal-top" style={{ background: "#15803d" }}>
          <div className="nb-cert-modal-emoji">
            <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24"><path fill="white" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10S17.523 2 12 2m-1.177 13.823L7 12l1.414-1.414l2.409 2.409l5.763-5.763L18 8.646z"/></svg>
          </div>
          <div className="nb-cert-modal-title">{notif.title}</div>
        </div>
        <div className="nb-cert-modal-body">
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 14, color: "#14532d", lineHeight: 1.7 }}>
            {body.message}
          </div>
          <div className="nb-cert-actions">
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose} style={{ width: "100%" }}>รับทราบ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wrong Item Popup (admin) ───────────────────────────────────────
function WrongItemPopup({ notif, onClose }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }
  const navigate = useNavigate();
  const isClarify = notif.type === "donation_clarify";

  const handleGoReview = () => { onClose(); navigate("/admin/wrong-items"); };

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="nb-cert-modal-top" style={{ background: isClarify ? "#0369a1" : "#f97316" }}>
          <div className="nb-cert-modal-emoji">
            {isClarify
              ? <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" style={{ color: "#fff" }}><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" style={{ color: "#fff" }}><path fill="currentColor" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3M12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1m1 4h-2v-2h2z"/></svg>
            }
          </div>
          <div className="nb-cert-modal-title">{isClarify ? "ผู้บริจาคชี้แจงเหตุการณ์" : "รายการบริจาคไม่ตรง"}</div>
          <div className="nb-cert-modal-sub">
            {isClarify && body.user_name
              ? <>{body.user_name} <span style={{ opacity: 0.75, fontWeight: 400 }}>({body.donor_name})</span></>
              : body.donor_name || "ผู้บริจาค"
            }
            {body.school_name ? ` · ${body.school_name}` : ""}
          </div>
        </div>
        <div className="nb-cert-modal-body">
          {/* wrong_item_report: แสดงรายการที่ไม่ตรง */}
          {!isClarify && body.wrong_items?.length > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#c2410c", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:swap-horizontal" width={14} /> รายการที่ไม่ตรง
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#92400e", lineHeight: 1.8 }}>
                {body.wrong_items.map((item, i) => {
                  const name   = typeof item === "string" ? item : item.name;
                  const reason = typeof item === "object" ? item.reason : null;
                  const note   = typeof item === "object" ? item.note   : null;
                  return (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {name}
                      {reason && <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "1px 7px", marginLeft: 6 }}>{reason}</span>}
                      {note && <div style={{ fontSize: 12, color: "#78350f", marginTop: 2, paddingLeft: 2 }}><span style={{ fontWeight: 600 }}>เหตุผล:</span> {note}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {/* donation_clarify: เน้นข้อความชี้แจง */}
          {isClarify && body.message && (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:message-reply-outline" width={14} /> ข้อความชี้แจงจากผู้บริจาค
              </div>
              <div style={{ fontSize: 13, color: "#0c4a6e", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {body.message}
              </div>
            </div>
          )}
          {/* wrong_item_report: message จากโรงเรียน */}
          {!isClarify && body.message && (
            <div style={{ fontSize: 13, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", marginBottom: 12 }}>
              {body.message}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon icon="mdi:information-outline" width={14} />
            ดูรายละเอียดและจัดการได้ที่หน้า "ตรวจสอบของไม่ตรง"
          </div>
          <div className="nb-cert-actions">
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>ปิด</button>
            <button className="nb-cert-btn" onClick={handleGoReview} style={{ background: isClarify ? "#0369a1" : "#f97316", color: "#fff", border: "none" }}>
              ไปตรวจสอบ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Strike Appeal Popup (admin) ────────────────────────────────────
function StrikeAppealPopup({ notif, onClose }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }
  const navigate = useNavigate();

  const suspendedUntil = body.suspended_until
    ? new Date(body.suspended_until).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const handleGoReview = () => {
    onClose();
    navigate("/admin/wrong-items");
  };

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="nb-cert-modal-top" style={{ background: "#1d4ed8" }}>
          <div className="nb-cert-modal-emoji"><svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 56 56"><path fill="white" d="M15.555 53.125h24.89c4.852 0 7.266-2.461 7.266-7.336V24.508c0-3.024-.328-4.336-2.203-6.258L32.57 5.102c-1.78-1.829-3.234-2.227-5.882-2.227H15.555c-4.828 0-7.266 2.484-7.266 7.36v35.554c0 4.898 2.438 7.336 7.266 7.336m.187-3.773c-2.414 0-3.68-1.29-3.68-3.633V10.305c0-2.32 1.266-3.657 3.704-3.657h10.406v13.618c0 2.953 1.5 4.406 4.406 4.406h13.36v21.047c0 2.343-1.243 3.633-3.68 3.633ZM31 21.132c-.914 0-1.29-.374-1.29-1.312V7.375l13.5 13.758Zm5.625 9.985h-17.79c-.843 0-1.452.633-1.452 1.43c0 .82.61 1.453 1.453 1.453h17.789a1.43 1.43 0 0 0 1.453-1.453c0-.797-.633-1.43-1.453-1.43m0 8.18h-17.79c-.843 0-1.452.656-1.452 1.476c0 .797.61 1.407 1.453 1.407h17.789c.82 0 1.453-.61 1.453-1.407c0-.82-.633-1.476-1.453-1.476"/></svg></div>
          <div className="nb-cert-modal-title">คำร้อง Appeal จากผู้บริจาค</div>
          <div className="nb-cert-modal-sub">{body.donor_name || "ผู้บริจาค"}</div>
        </div>
        <div className="nb-cert-modal-body">
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
            strike: <strong style={{ color: "#dc2626" }}>{body.strike_count}/3</strong>
            {suspendedUntil && <> · ระงับถึง <strong style={{ color: "#1e293b" }}>{suspendedUntil}</strong></>}
          </div>
          {body.reason && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginTop: 10, marginBottom: 14, fontSize: 13, color: "#1e293b", lineHeight: 1.7 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>เหตุผลจากผู้บริจาค</div>
              {body.reason}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon icon="mdi:information-outline" width={14} />
            ตรวจสอบประวัติและล้างคำเตือนได้ที่หน้า "ตรวจสอบของไม่ตรง"
          </div>
          <div className="nb-cert-actions">
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>ปิด</button>
            <button
              className="nb-cert-btn"
              onClick={handleGoReview}
              style={{ background: "#2563eb", color: "#fff", border: "none" }}
            >
              ไปหน้าตรวจสอบ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Suspension Popup ───────────────────────────────────────────────
function SuspensionPopup({ notif, onClose, isAdmin, onAppeal, hasPendingAppeal, onViewAppeal, onAdminReview }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }

  const suspendedUntil = body.suspended_until
    ? new Date(body.suspended_until).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()}>
        <div className="nb-cert-modal-top" style={{ background: "#7f1d1d" }}>
          <div className="nb-cert-modal-emoji"><svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" style={{ color: "#fff" }}><path fill="currentColor" d="M12 20a8 8 0 1 0 0-16a8 8 0 0 0 0 16m0 2C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m-1-6h2v2h-2zm0-10h2v8h-2z"/></svg></div>
          <div className="nb-cert-modal-title">
            {isAdmin ? `ผู้บริจาคถูกระงับอัตโนมัติ` : "ถูกระงับการบริจาคชั่วคราว"}
          </div>
          <div className="nb-cert-modal-sub">
            {isAdmin ? `${body.donor_name || "ผู้บริจาค"} — คำเตือน 3/3` : "ระงับ 30 วัน"}
          </div>
        </div>
        <div className="nb-cert-modal-body">
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 10, padding: "12px 14px", marginBottom: 12,
            fontSize: 13, color: "#991b1b", lineHeight: 1.7,
          }}>
            {body.message}
          </div>
          {suspendedUntil && (
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
              ระงับถึง: <strong style={{ color: "#1e293b" }}>{suspendedUntil}</strong>
            </div>
          )}
          <div className="nb-cert-actions">
            {isAdmin && onAdminReview && (
              <button
                className="nb-cert-btn"
                onClick={onAdminReview}
                style={{ background: "#2563eb", color: "#fff", border: "none" }}
              >
                ไปตรวจสอบ →
              </button>
            )}
            {!isAdmin && (
              hasPendingAppeal ? (
                <button
                  className="nb-cert-btn"
                  onClick={onViewAppeal}
                  style={{ background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Icon icon="mdi:clock-outline" width={15} />รอการตรวจสอบ
                </button>
              ) : (
                <button
                  className="nb-cert-btn"
                  onClick={onAppeal}
                  style={{ background: "#2563eb", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 56 56" style={{ flexShrink: 0 }}><path fill="currentColor" d="M15.555 53.125h24.89c4.852 0 7.266-2.461 7.266-7.336V24.508c0-3.024-.328-4.336-2.203-6.258L32.57 5.102c-1.78-1.829-3.234-2.227-5.882-2.227H15.555c-4.828 0-7.266 2.484-7.266 7.36v35.554c0 4.898 2.438 7.336 7.266 7.336m.187-3.773c-2.414 0-3.68-1.29-3.68-3.633V10.305c0-2.32 1.266-3.657 3.704-3.657h10.406v13.618c0 2.953 1.5 4.406 4.406 4.406h13.36v21.047c0 2.343-1.243 3.633-3.68 3.633ZM31 21.132c-.914 0-1.29-.374-1.29-1.312V7.375l13.5 13.758Zm5.625 9.985h-17.79c-.843 0-1.452.633-1.452 1.43c0 .82.61 1.453 1.453 1.453h17.789a1.43 1.43 0 0 0 1.453-1.453c0-.797-.633-1.43-1.453-1.43m0 8.18h-17.79c-.843 0-1.452.656-1.452 1.476c0 .797.61 1.407 1.453 1.407h17.789c.82 0 1.453-.61 1.453-1.407c0-.82-.633-1.476-1.453-1.476"/></svg>
                  ขอให้ทีมงานตรวจสอบ
                </button>
              )
            )}
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>รับทราบ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Donation Issue Popup ───────────────────────────────────────────
function DonationIssuePopup({ notif, onClose, onNavigate, token, isSuspended, onAppeal, hasPendingAppeal }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }

  const clarifyKey = `clarified_${notif.ref_id}`;
  const [showClarify,    setShowClarify]    = useState(false);
  const [clarifyText,    setClarifyText]    = useState("");
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [clarifyDone,    setClarifyDone]    = useState(() => !!localStorage.getItem(clarifyKey));
  const [clarifyErr,     setClarifyErr]     = useState("");

  const handleClarify = async () => {
    if (!clarifyText.trim()) return setClarifyErr("กรุณาระบุข้อความชี้แจง");
    if (!notif.ref_id || isNaN(Number(notif.ref_id))) return setClarifyErr("ไม่พบรายการบริจาค");
    setClarifyLoading(true);
    setClarifyErr("");
    try {
      const res = await fetch(`${BASE}/donations/${notif.ref_id}/clarify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: clarifyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.message === "ชี้แจงไปแล้ว") {
          localStorage.setItem(clarifyKey, "1");
          setClarifyDone(true);
        } else {
          setClarifyErr(data?.message || "ส่งไม่สำเร็จ");
        }
        return;
      }
      localStorage.setItem(clarifyKey, "1");
      setClarifyDone(true);
    } catch { setClarifyErr("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setClarifyLoading(false); }
  };

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nb-cert-modal-top" style={{ background: "#f97316" }}>
          <div className="nb-cert-modal-emoji"><svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" style={{ color: "#fff" }}><path fill="currentColor" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3M12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1m1 4h-2v-2h2z"/></svg></div>
          <div className="nb-cert-modal-title">รายการไม่ตรง</div>
          <div className="nb-cert-modal-sub">
            {body.school_name || "โรงเรียน"} แจ้งปัญหาเกี่ยวกับรายการบริจาคของคุณ
          </div>
        </div>

        {/* Body */}
        <div className="nb-cert-modal-body">

          <div style={{
            background: "#fff7ed", border: "1px solid #fed7aa",
            borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c2410c", fontWeight: 600, marginBottom: body.wrong_items?.length ? 8 : 0 }}>
              <Icon icon="mdi:swap-horizontal" width="16" />
              รายการที่ไม่ตรงตามที่โครงการระบุ
            </div>
            {body.wrong_items?.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#92400e", lineHeight: 1.8 }}>
                {body.wrong_items.map((item, i) => {
                  const name   = typeof item === "string" ? item : item.name;
                  const reason = typeof item === "object" ? item.reason : null;
                  const note   = typeof item === "object" ? item.note   : null;
                  return (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <span>{name}</span>
                      {reason && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "1px 7px", marginLeft: 6, whiteSpace: "nowrap" }}>
                          {reason}
                        </span>
                      )}
                      {note && (
                        <span style={{ display: "block", fontSize: 11, color: "#78350f", marginTop: 2, paddingLeft: 2 }}>
                          <span style={{ fontWeight: 600 }}>เหตุผล:</span> {note}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ข้อความจากโรงเรียน */}
          {body.message && (
            <div className="nb-cert-thank">
              <div className="nb-cert-thank-label">
                <Icon icon="mdi:message-text" width="13" />
                ข้อความจาก {body.school_name || "โรงเรียน"}
              </div>
              <div className="nb-cert-thank-text">{body.message}</div>
            </div>
          )}

          {/* ชี้แจง — ซ่อนเมื่อถูก suspend แล้ว (รอบ 3) */}
          {isSuspended ? (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: "#991b1b", fontWeight: 600, marginBottom: 6 }}>คุณถูกระงับการบริจาคชั่วคราว</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>ยื่นคำร้องเพื่อขอให้ทีมงานตรวจสอบและพิจารณาปลดล็อค</div>
              {hasPendingAppeal ? (
                <div style={{ width: "100%", padding: "9px 0", borderRadius: 10, background: "#fef9c3", border: "1px solid #fde68a", color: "#92400e", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Icon icon="mdi:clock-outline" width="16" />
                  รอการตรวจสอบจากทีมงาน
                </div>
              ) : (
                <button
                  onClick={() => { onClose(); onAppeal?.(); }}
                  style={{ width: "100%", padding: "9px 0", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Icon icon="mdi:file-document-edit-outline" width="16" />
                  ยื่น Appeal การระงับ
                </button>
              )}
            </div>
          ) : !clarifyDone ? (
            !showClarify ? (
              <button
                onClick={() => setShowClarify(true)}
                style={{ width: "100%", padding: "9px 0", borderRadius: 10, border: "1.5px dashed #fed7aa", background: "#fff7ed", color: "#c2410c", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Icon icon="mdi:message-reply-outline" width="16" />
                ชี้แจงเหตุการณ์
              </button>
            ) : (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>ข้อความชี้แจง</div>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="อธิบายว่าเกิดอะไรขึ้น เช่น ส่งผิดพัสดุโดยไม่ตั้งใจ หรือเข้าใจผิดรายละเอียดโครงการ"
                  value={clarifyText}
                  onChange={e => setClarifyText(e.target.value)}
                  onFocus={e => { e.target.style.outline = "none"; e.target.style.boxShadow = "none"; }}
                  style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid #fcd34d", background: "#fff", resize: "none", outline: "none", boxShadow: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                />
                {clarifyErr && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{clarifyErr}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={handleClarify}
                    disabled={clarifyLoading}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", fontSize: 13, fontWeight: 600, cursor: clarifyLoading ? "not-allowed" : "pointer", opacity: clarifyLoading ? 0.7 : 1 }}
                  >
                    {clarifyLoading ? "กำลังส่ง..." : "ส่งข้อความชี้แจง"}
                  </button>
                  <button
                    onClick={() => { setShowClarify(false); setClarifyErr(""); }}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 13, cursor: "pointer" }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )
          ) : (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:check-circle-outline" width="18" />
              ส่งข้อความชี้แจงแล้ว — แอดมินจะตรวจสอบและติดต่อกลับ
            </div>
          )}

          {/* Actions */}
          {!showClarify && (
            <div className="nb-cert-actions">
              <button
                className="nb-cert-btn"
                style={{ background: "#f97316", color: "#fff", border: "none" }}
                onClick={onNavigate}
              >
                ดูประวัติการบริจาค →
              </button>
              <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>
                รับทราบ
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Certificate Popup ──────────────────────────────────────────────
function CertificatePopup({ notif, onClose, onViewAll }) {
  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setConfetti(false), 5000);
    return () => clearTimeout(t);
  }, []);

  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }

  const isPartial = body.condition_status === "wrong_item";

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      {!isPartial && confetti && <ConfettiEffect />}

      <div className="nb-cert-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nb-cert-modal-top" style={isPartial ? { background: "#92400e" } : {}}>
          <div className="nb-cert-modal-emoji">{isPartial ? "⚠️" : "🎉"}</div>
          <div className="nb-cert-modal-title">
            {isPartial ? "รับของบริจาคบางส่วน" : "โรงเรียนยืนยันรับของแล้ว!"}
          </div>
          <div className="nb-cert-modal-sub">
            {isPartial
              ? "มีบางรายการไม่ตรงตามที่ระบุ — ออกใบประกาศเฉพาะส่วนที่ถูกต้องแล้ว"
              : "ใบประกาศนียบัตรของคุณพร้อมแล้ว"}
          </div>
        </div>

        {/* Body */}
        <div className="nb-cert-modal-body">

          {/* Warning + รายการที่ไม่ตรง สำหรับ wrong_item partial */}
          {isPartial && (
            <div style={{
              background: "#fff7ed", border: "1px solid #fed7aa",
              borderRadius: 10, padding: "10px 14px", marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c2410c", fontWeight: 600, marginBottom: body.wrong_items?.length ? 8 : 0 }}>
                <Icon icon="mdi:swap-horizontal" width="16" />
                รายการที่ไม่ตรงตามที่โครงการระบุ
              </div>
              {body.wrong_items?.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#92400e", lineHeight: 1.8 }}>
                  {body.wrong_items.map((item, i) => {
                    const name   = typeof item === "string" ? item : item.name;
                    const reason = typeof item === "object" ? item.reason : null;
                    const note   = typeof item === "object" ? item.note   : null;
                    return (
                      <li key={i} style={{ marginBottom: 4 }}>
                        <span>{name}</span>
                        {reason && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "1px 7px", marginLeft: 6, whiteSpace: "nowrap" }}>
                            {reason}
                          </span>
                        )}
                        {note && (
                          <span style={{ display: "block", fontSize: 11, color: "#78350f", marginTop: 2, paddingLeft: 2 }}>
                            {note}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Certificate image */}
          {body.certificate_url && (
            <div className="nb-cert-img-wrap">
              <img src={body.certificate_url} alt="certificate" />
            </div>
          )}

          {/* Thank message */}
          {body.message && (
            <div className="nb-cert-thank">
              <div className="nb-cert-thank-label">
                <Icon icon="mdi:message-text" width="13" />
                ข้อความจาก {body.school_name || "โรงเรียน"}
              </div>
              <div className="nb-cert-thank-text">{body.message}</div>
            </div>
          )}

          {/* Meta */}
          <div className="nb-cert-meta">
            {body.project_title && (
              <span><strong>โครงการ:</strong> {body.project_title}</span>
            )}
            {body.issued_at && (
              <span>
                <strong>วันที่ออก:</strong>{" "}
                {new Date(body.issued_at).toLocaleDateString("th-TH")}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="nb-cert-actions">
            {body.certificate_url && (
              <a
                href={body.certificate_url}
                download="certificate.png"
                className="nb-cert-btn nb-cert-btn--png"
              >
                ⬇ ดาวน์โหลด PNG
              </a>
            )}
            {body.pdf_url && (
              <a
                href={body.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="nb-cert-btn nb-cert-btn--pdf"
              >
                ⬇ ดาวน์โหลด PDF
              </a>
            )}
            <button
              type="button"
              className="nb-cert-btn"
              style={{ background: "#29B6E8", color: "#fff", border: "none" }}
              onClick={() => { onClose(); onViewAll?.(); }}
            >
              ดูใบประกาศทั้งหมด →
            </button>
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>
              ปิด
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── NotificationBell ───────────────────────────────────────────────
export default function NotificationBell() {
  const { token, role } = useAuth();
  const navigate = useNavigate();
  const [notifs,        setNotifs]        = useState([]);
  const [synSuspNotif,  setSynSuspNotif]  = useState(null);
  const [suspendedUntil, setSuspendedUntil] = useState(null);
  const [isSuspended,   setIsSuspended]   = useState(false);
  const [open,      setOpen]      = useState(false);
  const [certPopup,         setCertPopup]         = useState(null);
  const [issuePopup,        setIssuePopup]        = useState(null);
  const [suspensionPopup,   setSuspensionPopup]   = useState(null);
  const [appealModal,       setAppealModal]       = useState(false);
  const [hasPendingAppeal,  setHasPendingAppeal]  = useState(false);
  const [appealViewModal,   setAppealViewModal]   = useState(false);
  const [appealViewReason,  setAppealViewReason]  = useState("");
  const [strikeResetPopup,  setStrikeResetPopup]  = useState(null);
  const [strikeAppealPopup, setStrikeAppealPopup] = useState(null);
  const [wrongItemPopup,    setWrongItemPopup]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const dropRef = useRef(null);
  const isAdmin = role === "admin";

  // merge synSuspNotif เข้า list แล้ว sort ตามเวลา (newest first)
  // ถ้ามี real suspension notification จาก period ปัจจุบันอยู่แล้ว → ไม่ใส่ synthetic ซ้ำ
  const displayNotifs = (() => {
    if (!synSuspNotif) return notifs;
    if (suspendedUntil) {
      const suspStart = new Date(new Date(suspendedUntil).getTime() - 31 * 24 * 60 * 60 * 1000);
      const hasRealNow = notifs.some(
        n => n.type === "suspension" && new Date(n.created_at) >= suspStart
      );
      if (hasRealNow) return notifs;
    }
    const merged = [synSuspNotif, ...notifs];
    merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return merged;
  })();
  const unread = displayNotifs.filter(n => !n.is_read).length;

  const fetchNotifs = useCallback(async () => {
    console.log("[NotifBell] fetchNotifs called, token:", token ? "ok" : "null");
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("[NotifBell] fetched:", data?.length, "items");
        const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
          const timeDiff = new Date(b.created_at) - new Date(a.created_at);
          // ถ้า timestamp ห่างกันไม่เกิน 5 นาที ให้ suspension ขึ้นก่อนเสมอ
          if (Math.abs(timeDiff) < 300000) {
            const w = t => t === "suspension" ? 1 : 0;
            const wDiff = w(b.type) - w(a.type);
            if (wDiff !== 0) return wDiff;
          }
          return timeDiff;
        });
        setNotifs(sorted);
      } else {
        console.warn("[NotifBell] fetch failed:", res.status);
      }
    } catch (e) { console.warn("[NotifBell] error:", e); }
    finally { setLoading(false); }
  }, [token]);

  // โหลดครั้งแรก + poll ทุก 60 วิ (fallback)
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // ── ถ้า user ถูก suspend → inject notification + แสดง popup ────────────────────
  useEffect(() => {
    if (!token || role === "admin" || role === "school_admin") return;
    fetch(`${BASE}/donations/my-suspension`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.is_suspended) return;
        setIsSuspended(true);
        setSuspendedUntil(data.suspended_until);
        setHasPendingAppeal(!!data.has_pending_appeal);
        if (data.appeal_reason) setAppealViewReason(data.appeal_reason);
        const ackKey  = `suspAck_${data.suspended_until}`;
        const synBody = JSON.stringify({
          message:         "เนื่องจากมีประวัติส่งรายการบริจาคไม่ตรง 3 ครั้ง คุณถูกระงับการบริจาคผ่านพัสดุและ drop-off เป็นเวลา 30 วัน",
          suspended_until: data.suspended_until,
          strike_count:    data.strike_count,
        });
        const synNotif = {
          notification_id: "synthetic_suspension",
          type:            "suspension",
          title:           "คุณถูกระงับการบริจาคชั่วคราว 30 วัน",
          body:            synBody,
          is_read:         !!localStorage.getItem(ackKey),
          created_at:      new Date().toISOString(),
          _ackKey:         ackKey,
        };
        // เก็บไว้ใน state แยก (ไม่โดนทับโดย fetchNotifs)
        setSynSuspNotif(synNotif);
        // แสดง popup ถ้ายังไม่เคย ack
        if (!localStorage.getItem(ackKey)) {
          setSuspensionPopup({ ...synNotif, _ackKey: ackKey });
        }
      })
      .catch(() => {});
  }, [token, role]);

  // ── Socket.io: รับ notification แบบ real-time ────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    if (!socket) return;

    const onNotification = (notif) => {
      // Prepend the incoming notification to the list (newest first)
      setNotifs(prev => {
        // Avoid duplicates if poll already fetched it
        if (prev.some(n => n.notification_id === notif.notification_id)) return prev;
        return [notif, ...prev];
      });
    };

    socket.on("notification", onNotification);
    return () => { socket.off("notification", onNotification); };
  }, [token]);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (notif_id) => {
    if (!token) return;
    try {
      await fetch(`${BASE}/notifications/${notif_id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifs(prev =>
        prev.map(n => n.notification_id === notif_id ? { ...n, is_read: true } : n)
      );
    } catch { /* silent */ }
  };

  const openNotifPopup = (notif) => {
    switch (notif.type) {
      case "certificate":
        setCertPopup(notif);
        break;
      case "donation_issue":
        setIssuePopup(notif);
        break;
      case "suspension":
        setSuspensionPopup(notif);
        fetch(`${BASE}/donations/my-suspension`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d) {
              setHasPendingAppeal(!!d.has_pending_appeal);
              if (d.appeal_reason) setAppealViewReason(d.appeal_reason);
            }
          })
          .catch(() => {});
        break;
      case "strike_reset":
        setStrikeResetPopup(notif);
        break;
      case "strike_appeal":
        setStrikeAppealPopup(notif);
        break;
      case "wrong_item_report":
      case "donation_clarify":
        setWrongItemPopup(notif);
        break;
      default:
        break;
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      if (notif.notification_id === "synthetic_suspension") {
        if (notif._ackKey) localStorage.setItem(notif._ackKey, "1");
        setSynSuspNotif(prev => prev ? { ...prev, is_read: true } : prev);
      } else {
        await markRead(notif.notification_id);
      }
    }

    setOpen(false);
    const action = getNotifAction(notif, role);

    if (action.mode === "popup") {
      openNotifPopup(notif);
      return;
    }
    if (action.mode === "navigate" && action.path) {
      navigate(action.path, action.state ? { state: action.state } : undefined);
      return;
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)  return "เมื่อสักครู่";
    if (m < 60) return `${m} นาทีที่แล้ว`;
    if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
    return `${d} วันที่แล้ว`;
  };

  if (!token) return null;

  return (
    <>
      <div ref={dropRef} className="nb-wrap">

        {/* Bell button */}
        <button
          className="nb-btn"
          onClick={() => { setOpen(o => !o); if (!open) fetchNotifs(); }}
          aria-label="การแจ้งเตือน"
        >
          <Icon icon="mdi:bell-outline" width="26" style={{ color: "#ffffff" }} />
          {unread > 0 && (
            <span className="nb-badge">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="nb-dropdown">

            {/* Header */}
            <div className="nb-dropdown-header">
              <span className="nb-dropdown-title">การแจ้งเตือน</span>
              {unread > 0 && (
                <span className="nb-unread-pill">{unread} ใหม่</span>
              )}
            </div>

            {/* List */}
            <div className="nb-list">
              {loading && displayNotifs.length === 0 ? (
                <div className="nb-loading">กำลังโหลด...</div>
              ) : displayNotifs.length === 0 ? (
                <div className="nb-empty">
                  <div className="nb-empty-icon">🔔</div>
                  <div className="nb-empty-text">ยังไม่มีการแจ้งเตือน</div>
                </div>
              ) : displayNotifs.map(notif => {
                const body   = parseNotifBody(notif);
                const action = getNotifAction(notif, role);
                const iconCls = NOTIF_ICON_CLASS[notif.type] || NOTIF_ICON_CLASS.default;
                const iconName = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default;
                const preview = body.message || (typeof notif.body === "string" && !notif.body.startsWith("{") ? notif.body : null);

                return (
                  <div
                    key={notif.notification_id}
                    className={`nb-item ${!notif.is_read ? "nb-item--unread" : ""}`}
                    onClick={() => handleNotifClick(notif)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleNotifClick(notif); } }}
                  >
                    <div className={`nb-item-icon ${iconCls}`}>
                      <Icon icon={iconName} width="18" style={{ color: "#fff" }} />
                    </div>
                    <div className="nb-item-body">
                      <div className={`nb-item-title ${!notif.is_read ? "nb-item-title--bold" : "nb-item-title--normal"}`}>
                        {notif.title}
                      </div>
                      {preview && (
                        <div className="nb-item-preview">"{preview}"</div>
                      )}
                      {action.chip && (
                        <div className="nb-item-chip">
                          <Icon icon="mdi:arrow-right-circle-outline" width="11" />
                          {action.chip}
                        </div>
                      )}
                      <div className="nb-item-time">{timeAgo(notif.created_at)}</div>
                    </div>
                    {!notif.is_read && <div className="nb-item-dot" />}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="nb-footer">
                {role === "school_admin" && (
                  <button type="button" className="nb-footer-link" onClick={() => { setOpen(false); navigate("/school/donations"); }}>
                    ดูรายการบริจาคทั้งหมด →
                  </button>
                )}
                {role === "seller" && (
                  <button type="button" className="nb-footer-link" onClick={() => { setOpen(false); navigate("/seller/orders"); }}>
                    ดูออเดอร์ทั้งหมด →
                  </button>
                )}
                {(!role || role === "donor" || role === "user") && (
                  <button type="button" className="nb-footer-link" onClick={() => { setOpen(false); navigate("/donations/history"); }}>
                    ดูประวัติการบริจาคทั้งหมด →
                  </button>
                )}
                {role === "admin" && (
                  <button type="button" className="nb-footer-link" onClick={() => { setOpen(false); navigate("/admin/wrong-items"); }}>
                    ไปหน้าตรวจสอบ →
                  </button>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Certificate Popup */}
      {certPopup && (
        <CertificatePopup
          notif={certPopup}
          onClose={() => setCertPopup(null)}
          onViewAll={() => navigate("/profile/certificates")}
        />
      )}

      {/* Donation Issue Popup */}
      {issuePopup && (
        <DonationIssuePopup
          notif={issuePopup}
          token={token}
          onClose={() => setIssuePopup(null)}
          onNavigate={() => { setIssuePopup(null); navigate("/donations/history"); }}
          isSuspended={isSuspended}
          hasPendingAppeal={hasPendingAppeal}
          onAppeal={() => setAppealModal(true)}
        />
      )}

      {/* Suspension Popup */}
      {suspensionPopup && (
        <SuspensionPopup
          notif={suspensionPopup}
          onClose={() => {
            if (suspensionPopup._ackKey) localStorage.setItem(suspensionPopup._ackKey, "1");
            setSuspensionPopup(null);
          }}
          isAdmin={isAdmin}
          hasPendingAppeal={hasPendingAppeal}
          onAppeal={() => { setSuspensionPopup(null); setAppealModal(true); }}
          onViewAppeal={() => { setSuspensionPopup(null); setAppealViewModal(true); }}
          onAdminReview={isAdmin ? () => { setSuspensionPopup(null); navigate("/admin/wrong-items"); } : undefined}
        />
      )}

      {/* Appeal Modal (donor) */}
      {appealModal && (
        <AppealModal
          token={token}
          onClose={() => setAppealModal(false)}
          onSuccess={(reason) => { setHasPendingAppeal(true); setAppealViewReason(reason || ""); }}
        />
      )}

      {/* Appeal View Modal (after submit from bell) */}
      {appealViewModal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setAppealViewModal(false)}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 400, overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: "#1d4ed8", padding: "20px 24px", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}><svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 56 56"><path fill="white" d="M15.555 53.125h24.89c4.852 0 7.266-2.461 7.266-7.336V24.508c0-3.024-.328-4.336-2.203-6.258L32.57 5.102c-1.78-1.829-3.234-2.227-5.882-2.227H15.555c-4.828 0-7.266 2.484-7.266 7.36v35.554c0 4.898 2.438 7.336 7.266 7.336m.187-3.773c-2.414 0-3.68-1.29-3.68-3.633V10.305c0-2.32 1.266-3.657 3.704-3.657h10.406v13.618c0 2.953 1.5 4.406 4.406 4.406h13.36v21.047c0 2.343-1.243 3.633-3.68 3.633ZM31 21.132c-.914 0-1.29-.374-1.29-1.312V7.375l13.5 13.758Zm5.625 9.985h-17.79c-.843 0-1.452.633-1.452 1.43c0 .82.61 1.453 1.453 1.453h17.789a1.43 1.43 0 0 0 1.453-1.453c0-.797-.633-1.43-1.453-1.43m0 8.18h-17.79c-.843 0-1.452.656-1.452 1.476c0 .797.61 1.407 1.453 1.407h17.789c.82 0 1.453-.61 1.453-1.407c0-.82-.633-1.476-1.453-1.476"/></svg></div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 4 }}>คำร้องของคุณ</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>ข้อความที่ส่งให้ทีมงานตรวจสอบ</div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", fontSize: 14, color: "#1e293b", lineHeight: 1.7, minHeight: 60, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {appealViewReason || "(ไม่ได้ระบุเหตุผล)"}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>
                ทีมงานกำลังตรวจสอบคำร้องของคุณ จะติดต่อผ่านทางแจ้งเตือน
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <button onClick={() => setAppealViewModal(false)} style={{ fontSize: 13, padding: "9px 28px", borderRadius: 10, border: "1px solid #e2e8f0", cursor: "pointer", background: "#f8fafc" }}>ปิด</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Strike Reset Popup (donor) */}
      {strikeResetPopup && (
        <StrikeResetPopup
          notif={strikeResetPopup}
          onClose={() => setStrikeResetPopup(null)}
        />
      )}

      {/* Strike Appeal Popup (admin) */}
      {strikeAppealPopup && (
        <StrikeAppealPopup
          notif={strikeAppealPopup}
          onClose={() => setStrikeAppealPopup(null)}
        />
      )}

      {/* Wrong Item Popup (admin) */}
      {wrongItemPopup && (
        <WrongItemPopup
          notif={wrongItemPopup}
          onClose={() => setWrongItemPopup(null)}
        />
      )}
    </>
  );
}