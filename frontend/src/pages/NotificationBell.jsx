import { useEffect, useState, useRef, useCallback } from "react";
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

// ── Certificate Popup ──────────────────────────────────────────────
function CertificatePopup({ notif, onClose }) {
  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setConfetti(false), 5000);
    return () => clearTimeout(t);
  }, []);

  let body = {};
  try { body = JSON.parse(notif.body); } catch { /* noop */ }

  return (
    <div className="nb-cert-overlay" onClick={onClose}>
      {confetti && <ConfettiEffect />}

      <div className="nb-cert-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nb-cert-modal-top">
          <div className="nb-cert-modal-emoji">🎉</div>
          <div className="nb-cert-modal-title">โรงเรียนยืนยันรับของแล้ว!</div>
          <div className="nb-cert-modal-sub">ใบประกาศนียบัตรของคุณพร้อมแล้ว</div>
        </div>

        {/* Body */}
        <div className="nb-cert-modal-body">

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
  const { token } = useAuth();
  const [notifs,    setNotifs]    = useState([]);
  const [open,      setOpen]      = useState(false);
  const [certPopup, setCertPopup] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const dropRef = useRef(null);

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
                const isCert = notif.type === "certificate";
                let body = {};
                try { body = JSON.parse(notif.body); } catch { /* noop */ }

                return (
                  <div
                    key={notif.notification_id}
                    className={`nb-item ${!notif.is_read ? "nb-item--unread" : ""}`}
                    onClick={() => handleNotifClick(notif)}
                  >
                    {/* Icon */}
                    <div className={`nb-item-icon ${isCert ? "nb-item-icon--cert" : "nb-item-icon--default"}`}>
                      <Icon
                        icon={isCert ? "mdi:certificate-outline" : "mdi:bell"}
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
                <a href="/my-donations">ดูประวัติการบริจาคทั้งหมด →</a>
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
    </>
  );
}