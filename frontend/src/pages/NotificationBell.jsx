import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
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
    if (!reason.trim()) return setErr("กรุณาระบุเหตุผลในการ appeal");
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
      onSuccess?.();
    } catch { setErr("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="nb-cert-modal-top" style={{ background: "#1d4ed8" }}>
          <div className="nb-cert-modal-emoji">📋</div>
          <div className="nb-cert-modal-title">ยื่น Appeal</div>
          <div className="nb-cert-modal-sub">โต้แย้งการถูกระงับการบริจาค</div>
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

// ── Strike Appeal Popup (admin) ────────────────────────────────────
function StrikeAppealPopup({ notif, onClose, token, onResolved }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }
  const [resetting, setResetting] = useState(false);

  const suspendedUntil = body.suspended_until
    ? new Date(body.suspended_until).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const handleReset = async () => {
    if (!body.donor_id) return;
    if (!window.confirm(`รีเซ็ต strike ของ "${body.donor_name}" ใช่มั้ย?`)) return;
    try {
      setResetting(true);
      await fetch(`${BASE}/donations/users/${body.donor_id}/reset-strike`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      onResolved?.();
      onClose();
    } catch { /* silent */ }
    finally { setResetting(false); }
  };

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="nb-cert-modal-top" style={{ background: "#1d4ed8" }}>
          <div className="nb-cert-modal-emoji">📋</div>
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
          <div className="nb-cert-actions">
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>ปิด</button>
            <button
              className="nb-cert-btn"
              onClick={handleReset}
              disabled={resetting}
              style={{ background: resetting ? "#94a3b8" : "#16a34a", color: "#fff", border: "none" }}
            >
              {resetting ? "กำลังรีเซ็ต..." : "✓ รีเซ็ต Strike"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Suspension Popup ───────────────────────────────────────────────
function SuspensionPopup({ notif, onClose, isAdmin, onAppeal }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }

  const suspendedUntil = body.suspended_until
    ? new Date(body.suspended_until).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()}>
        <div className="nb-cert-modal-top" style={{ background: "#7f1d1d" }}>
          <div className="nb-cert-modal-emoji">🚫</div>
          <div className="nb-cert-modal-title">
            {isAdmin ? `ผู้บริจาคถูกระงับอัตโนมัติ` : "ถูกระงับการบริจาคชั่วคราว"}
          </div>
          <div className="nb-cert-modal-sub">
            {isAdmin ? `${body.donor_name || "ผู้บริจาค"} — strike 3/3` : "ระงับ 30 วัน"}
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
            {!isAdmin && (
              <button
                className="nb-cert-btn"
                onClick={onAppeal}
                style={{ background: "#2563eb", color: "#fff", border: "none" }}
              >
                📋 ยื่น Appeal
              </button>
            )}
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>รับทราบ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Donation Issue Popup ───────────────────────────────────────────
function DonationIssuePopup({ notif, onClose, onNavigate }) {
  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }

  const isNotSent   = body.condition_status === "not_sent";
  const isWrongItem = body.condition_status === "wrong_item";

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      <div className="nb-cert-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nb-cert-modal-top" style={{ background: isNotSent ? "#7c3aed" : "#f97316" }}>
          <div className="nb-cert-modal-emoji">{isNotSent ? "📦" : "⚠️"}</div>
          <div className="nb-cert-modal-title">
            {isNotSent ? "ยังไม่ได้รับพัสดุ" : "รายการไม่ตรง"}
          </div>
          <div className="nb-cert-modal-sub">
            {body.school_name || "โรงเรียน"} แจ้งปัญหาเกี่ยวกับรายการบริจาคของคุณ
          </div>
        </div>

        {/* Body */}
        <div className="nb-cert-modal-body">

          {/* ประเภทปัญหา */}
          <div style={{
            background: isNotSent ? "#f5f3ff" : "#fff7ed",
            border: `1px solid ${isNotSent ? "#ddd6fe" : "#fed7aa"}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: isNotSent ? "#7c3aed" : "#c2410c", fontWeight: 600, marginBottom: (!isNotSent && body.wrong_items?.length) ? 8 : 0 }}>
              <Icon icon={isNotSent ? "mdi:package-variant-closed-remove" : "mdi:swap-horizontal"} width="16" />
              {isNotSent ? "พัสดุยังไม่ถึงโรงเรียน" : "รายการที่ไม่ตรงตามที่โครงการระบุ"}
            </div>
            {!isNotSent && body.wrong_items?.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#92400e", lineHeight: 1.8 }}>
                {body.wrong_items.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
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

          {/* Actions */}
          <div className="nb-cert-actions">
            <button
              className="nb-cert-btn"
              style={{ background: isNotSent ? "#7c3aed" : "#f97316", color: "#fff", border: "none" }}
              onClick={onNavigate}
            >
              ดูประวัติการบริจาค →
            </button>
            <button className="nb-cert-btn nb-cert-btn--close" onClick={onClose}>
              รับทราบ
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Certificate Popup ──────────────────────────────────────────────
function CertificatePopup({ notif, onClose }) {
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
                  {body.wrong_items.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
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
  const [notifs,    setNotifs]    = useState([]);
  const [open,      setOpen]      = useState(false);
  const [certPopup,         setCertPopup]         = useState(null);
  const [issuePopup,        setIssuePopup]        = useState(null);
  const [suspensionPopup,   setSuspensionPopup]   = useState(null);
  const [appealModal,       setAppealModal]       = useState(false);
  const [strikeAppealPopup, setStrikeAppealPopup] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const dropRef = useRef(null);
  const isAdmin = role === "admin";

  const unread = notifs.filter(n => !n.is_read).length;

  const fetchNotifs = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifs(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  // โหลดครั้งแรก + poll ทุก 30 วิ
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

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

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) await markRead(notif.notification_id);
    if (notif.type === "certificate") {
      setOpen(false);
      setCertPopup(notif);
    } else if (notif.type === "donation_issue") {
      setOpen(false);
      setIssuePopup(notif);
    } else if (notif.type === "suspension") {
      setOpen(false);
      setSuspensionPopup(notif);
    } else if (notif.type === "strike_appeal") {
      setOpen(false);
      setStrikeAppealPopup(notif);
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
              {loading && notifs.length === 0 ? (
                <div className="nb-loading">กำลังโหลด...</div>
              ) : notifs.length === 0 ? (
                <div className="nb-empty">
                  <div className="nb-empty-icon">🔔</div>
                  <div className="nb-empty-text">ยังไม่มีการแจ้งเตือน</div>
                </div>
              ) : notifs.map(notif => {
                const isCert       = notif.type === "certificate";
                const isSuspension = notif.type === "suspension";
                let body = {};
                try { body = JSON.parse(notif.body); } catch { /* noop */ }

                return (
                  <div
                    key={notif.notification_id}
                    className={`nb-item ${!notif.is_read ? "nb-item--unread" : ""}`}
                    onClick={() => handleNotifClick(notif)}
                  >
                    {/* Icon */}
                    <div className={`nb-item-icon ${isCert ? "nb-item-icon--cert" : isSuspension ? "nb-item-icon--suspension" : "nb-item-icon--default"}`}>
                      <Icon
                        icon={isCert ? "mdi:certificate-outline" : isSuspension ? "mdi:account-cancel" : "mdi:bell"}
                        width="18"
                        style={{ color: "#fff" }}
                      />
                    </div>

                    {/* Content */}
                    <div className="nb-item-body">
                      <div className={`nb-item-title ${!notif.is_read ? "nb-item-title--bold" : "nb-item-title--normal"}`}>
                        {notif.title}
                      </div>

                      {isCert && body.message && (
                        <div className="nb-item-preview">"{body.message}"</div>
                      )}

                      {isCert && (
                        <div className="nb-item-chip">
                          <Icon icon="mdi:download" width="11" />
                          รับใบประกาศนียบัตร
                        </div>
                      )}

                      <div className="nb-item-time">{timeAgo(notif.created_at)}</div>
                    </div>

                    {/* Unread dot */}
                    {!notif.is_read && <div className="nb-item-dot" />}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="nb-footer">
                <a href="/donations/history">ดูประวัติการบริจาคทั้งหมด →</a>
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
        />
      )}

      {/* Donation Issue Popup */}
      {issuePopup && (
        <DonationIssuePopup
          notif={issuePopup}
          onClose={() => setIssuePopup(null)}
          onNavigate={() => { setIssuePopup(null); navigate("/donations/history"); }}
        />
      )}

      {/* Suspension Popup */}
      {suspensionPopup && (
        <SuspensionPopup
          notif={suspensionPopup}
          onClose={() => setSuspensionPopup(null)}
          isAdmin={isAdmin}
          onAppeal={() => { setSuspensionPopup(null); setAppealModal(true); }}
        />
      )}

      {/* Appeal Modal (donor) */}
      {appealModal && (
        <AppealModal
          token={token}
          onClose={() => setAppealModal(false)}
          onSuccess={() => {}}
        />
      )}

      {/* Strike Appeal Popup (admin) */}
      {strikeAppealPopup && (
        <StrikeAppealPopup
          notif={strikeAppealPopup}
          token={token}
          onClose={() => setStrikeAppealPopup(null)}
          onResolved={fetchNotifs}
        />
      )}
    </>
  );
}