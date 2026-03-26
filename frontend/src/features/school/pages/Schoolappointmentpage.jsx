// SchoolAppointmentPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../styles/SchoolAppointmentPage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TH_MONTHS_FULL  = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const TH_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const TH_DAYS         = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const DAY_OPTIONS = [
  { key: "sunday",    label: "อาทิตย์" },
  { key: "monday",    label: "จันทร์" },
  { key: "tuesday",   label: "อังคาร" },
  { key: "wednesday", label: "พุธ" },
  { key: "thursday",  label: "พฤหัสบดี" },
  { key: "friday",    label: "ศุกร์" },
  { key: "saturday",  label: "เสาร์" },
];

// day index (0=อาทิตย์) → DAY_OPTIONS key
const DAY_INDEX_TO_KEY = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

const STATUS_META = {
  pending:  { label: "รอยืนยัน",   color: "#d97706", bg: "#fef3c7" },
  approved: { label: "ยืนยันแล้ว", color: "#16a34a", bg: "#dcfce7" },
  rejected: { label: "ยกเลิก",     color: "#dc2626", bg: "#fee2e2" },
};

const parseItems = (s) => {
  if (!s) return [];
  try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return []; }
};

const toDateKey = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const formatThaiDate = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()+543}`;
};

// ── ScheduleModal ─────────────────────────────────────────────────
function ScheduleModal({ schedule, onClose, onSaved }) {
  const { token } = useAuth();
  const [openDays,   setOpenDays]   = useState(schedule?.open_days  || []);
  const [timeStart,  setTimeStart]  = useState(schedule?.time_start?.slice(0,5) || "08:00");
  const [timeEnd,    setTimeEnd]    = useState(schedule?.time_end?.slice(0,5)   || "15:30");
  const [note,       setNote]       = useState(schedule?.note || "");
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const toggleDay = (key) =>
    setOpenDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );

  const handleSave = async () => {
    setErr("");
    if (openDays.length === 0) return setErr("กรุณาเลือกวันรับอย่างน้อย 1 วัน");
    if (timeStart >= timeEnd)  return setErr("เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด");

    try {
      setSaving(true);
      const res = await fetch(`${BASE}/donations/schedule/mine`, {
        method:  "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          open_days:  openDays,
          time_start: timeStart,
          time_end:   timeEnd,
          note:       note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "บันทึกไม่สำเร็จ");
      onSaved(data.schedule);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sapOverlay" onClick={onClose}>
      <div className="sapPopup sapScheduleModal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sapPopupHead" style={{ marginBottom: "16px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon icon="mdi:calendar-edit" width="20" color="#185FA5" />
          </div>
          <div>
            <div className="sapPopupName">ตั้งค่าวัน-เวลารับของ</div>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>
              ผู้บริจาคจะเห็นข้อมูลนี้ก่อนเลือกวันนัด Drop-off
            </div>
          </div>
          <button className="sapPopupClose" onClick={onClose}>
            <Icon icon="mdi:close" width="18" />
          </button>
        </div>

        {/* วันที่เปิดรับ */}
        <div className="sapScheduleSection">
          <div className="sapScheduleLabel">วันที่เปิดรับ</div>
          <div className="sapDayGrid">
            {DAY_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                className={`sapDayBtn ${openDays.includes(key) ? "sapDayBtnActive" : ""}`}
                onClick={() => toggleDay(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ช่วงเวลา */}
        <div className="sapScheduleSection">
          <div className="sapScheduleLabel">ช่วงเวลารับของ</div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px" }}>เวลาเริ่ม</div>
              <input
                type="time"
                className="sapTimeInput"
                value={timeStart}
                onChange={e => setTimeStart(e.target.value)}
              />
            </div>
            <span style={{ fontSize: "18px", color: "#ccc", paddingTop: "16px" }}>–</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px" }}>เวลาสิ้นสุด</div>
              <input
                type="time"
                className="sapTimeInput"
                value={timeEnd}
                onChange={e => setTimeEnd(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* หมายเหตุ */}
        <div className="sapScheduleSection">
          <div className="sapScheduleLabel">
            หมายเหตุ <span style={{ fontWeight: 400, color: "#aaa" }}>(ไม่บังคับ)</span>
          </div>
          <textarea
            className="sapNoteInput"
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="เช่น กรุณาแจ้งล่วงหน้า 1 วัน ติดต่อครูที่ห้องธุรการ"
          />
        </div>

        {err && <div className="sapErr">{err}</div>}

        <div className="sapPopupActions">
          <button className="sapPopupBtnGhost" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="sapPopupBtnPrimary" onClick={handleSave} disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ScheduleBanner ────────────────────────────────────────────────
// แสดงสถานะตาราง และปุ่มตั้งค่า/แก้ไข
function ScheduleBanner({ schedule, onEdit }) {
  if (!schedule) {
    return (
      <div className="sapScheduleBannerEmpty">
        <div className="sapScheduleBannerIcon">
          <Icon icon="mdi:calendar-alert" width="22" color="#185FA5" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="sapScheduleBannerTitle">ยังไม่ได้กำหนดวัน-เวลารับของ</div>
          <div className="sapScheduleBannerSub">
            ผู้บริจาคจะไม่เห็นตัวเลือกวันที่แนะนำเมื่อ Drop-off
          </div>
        </div>
        <button className="sapScheduleSetBtn" onClick={onEdit}>
          <Icon icon="mdi:calendar-edit" width="15" />
          ตั้งค่า
        </button>
      </div>
    );
  }

  const days = (schedule.open_days || [])
    .map(k => DAY_OPTIONS.find(d => d.key === k)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="sapScheduleBannerSet">
      <div className="sapScheduleBannerIcon">
        <Icon icon="mdi:calendar-check" width="22" color="#16a34a" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sapScheduleBannerTitle" style={{ color: "#14532d" }}>กำหนดการรับของ</div>
        <div className="sapScheduleBannerSub" style={{ color: "#16a34a" }}>
          {days} · {schedule.time_start?.slice(0,5)}–{schedule.time_end?.slice(0,5)} น.
        </div>
        {schedule.note && (
          <div className="sapScheduleBannerNote">{schedule.note}</div>
        )}
      </div>
      <button className="sapScheduleEditBtn" onClick={onEdit}>
        <Icon icon="mdi:pencil" width="14" />
        แก้ไข
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function SchoolAppointmentPage() {
  const { token } = useAuth();
  const [dropoffs,     setDropoffs]     = useState([]);
  const [schedule,     setSchedule]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [calYear,      setCalYear]      = useState(new Date().getFullYear());
  const [calMonth,     setCalMonth]     = useState(new Date().getMonth());
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [detailPopup,  setDetailPopup]  = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // โหลด donation list
        const projRes = await fetch(`${BASE}/school/projects/latest`, { headers });
        const proj    = await projRes.json();
        if (proj?.request_id) {
          const res  = await fetch(`${BASE}/donations/project/${proj.request_id}`, { headers });
          const data = await res.json();
          const offs = (Array.isArray(data) ? data : []).filter(d => d.delivery_method === "dropoff");
          setDropoffs(offs);
        }
        // โหลด schedule ของโรงเรียนนี้
        const schRes  = await fetch(`${BASE}/donations/schedule/mine`, { headers });
        const schData = schRes.ok ? await schRes.json() : null;
        setSchedule(schData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // group by date key
  const byDate = useMemo(() => {
    const map = {};
    dropoffs.forEach(d => {
      const key = toDateKey(d.donation_date);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [dropoffs]);

  // calendar grid
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const cellKey = (d) =>
    `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // วันที่โรงเรียนไม่รับ (ใช้ใน calendar highlight)
  const isClosedDay = (d) => {
    if (!schedule?.open_days?.length) return false;
    const dayOfWeek = new Date(calYear, calMonth, d).getDay();
    return !schedule.open_days.includes(DAY_INDEX_TO_KEY[dayOfWeek]);
  };

  const todayKey    = toDateKey(new Date().toISOString());
  const selectedKey = selectedDay ? cellKey(selectedDay) : null;
  const selectedItems = selectedKey ? (byDate[selectedKey] || []) : [];

  const upcoming = useMemo(() =>
    [...dropoffs]
      .filter(d => d.donation_date)
      .sort((a, b) => new Date(a.donation_date) - new Date(b.donation_date)),
  [dropoffs]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); }
    else setCalMonth(m => m-1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); }
    else setCalMonth(m => m+1);
    setSelectedDay(null);
  };

  return (
    <div className="sapPage">
      <div className="sapHeader">
        <h1 className="sapTitle">ติดตามการนัดหมาย</h1>
        <div className="sapTitleSub">รายการ Drop-off ที่นัดหมายไว้ทั้งหมด</div>
      </div>

      {/* ── Schedule CTA Banner ── */}
      {!loading && (
        <div style={{ marginBottom: "20px" }}>
          <ScheduleBanner schedule={schedule} onEdit={() => setScheduleOpen(true)} />
        </div>
      )}

      {loading ? (
        <div className="sapLoading">กำลังโหลด...</div>
      ) : (
        <div className="sapLayout">
          {/* ── LEFT: Calendar ── */}
          <div className="sapCalCard">
            <div className="sapCalNav">
              <button className="sapCalNavBtn" onClick={prevMonth}>
                <Icon icon="mdi:chevron-left" width="20" />
              </button>
              <span className="sapCalMonthLabel">
                {TH_MONTHS_FULL[calMonth]} {calYear + 543}
              </span>
              <button className="sapCalNavBtn" onClick={nextMonth}>
                <Icon icon="mdi:chevron-right" width="20" />
              </button>
            </div>

            <div className="sapCalGrid">
              {TH_DAYS.map(d => (
                <div key={d} className="sapCalDayLabel">{d}</div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`} />;
                const key      = cellKey(d);
                const hasAppt  = byDate[key]?.length > 0;
                const isToday  = key === todayKey;
                const isSelect = d === selectedDay;
                const isClosed = isClosedDay(d);
                const count    = byDate[key]?.length || 0;
                return (
                  <div key={key}
                    className={[
                      "sapCalCell",
                      hasAppt  ? "sapCalHasAppt"  : "",
                      isToday  ? "sapCalToday"    : "",
                      isSelect ? "sapCalSelected" : "",
                      isClosed ? "sapCalClosed"   : "",
                    ].join(" ")}
                    onClick={() => setSelectedDay(d === selectedDay ? null : d)}
                  >
                    <span className="sapCalNum">{d}</span>
                    {hasAppt && (
                      <span className="sapCalDot">
                        {count > 3 ? "●●●" : "●".repeat(count)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* legend */}
            <div className="sapCalLegend">
              <span className="sapLegendItem">
                <span className="sapLegendDot" style={{ background: "#3b82f6" }} /> วันนัด
              </span>
              <span className="sapLegendItem">
                <span className="sapLegendDot" style={{ background: "#f59e0b", border: "2px solid #f59e0b" }} /> วันนี้
              </span>
              {schedule?.open_days?.length > 0 && (
                <span className="sapLegendItem">
                  <span className="sapLegendDot" style={{ background: "#e5e7eb" }} /> ปิดรับ
                </span>
              )}
            </div>
          </div>

          {/* ── RIGHT: Schedule panel ── */}
          <div className="sapRight">
            {selectedDay && (
              <div className="sapDayPanel">
                <div className="sapDayPanelTitle">
                  <Icon icon="mdi:calendar-check" width="18" color="#3b82f6" />
                  นัดหมายวันที่ {selectedDay} {TH_MONTHS_SHORT[calMonth]} {calYear+543}
                  <span className="sapDayCount">{selectedItems.length} รายการ</span>
                </div>
                {selectedItems.length === 0 ? (
                  <div className="sapEmpty">ไม่มีนัดหมายวันนี้</div>
                ) : selectedItems.map(d => (
                  <AppointCard key={d.donation_id} d={d} onClick={() => setDetailPopup(d)} />
                ))}
              </div>
            )}

            <div className="sapUpcomingPanel">
              <div className="sapUpcomingTitle">
                <Icon icon="mdi:clock-outline" width="16" />
                กำหนดการทั้งหมด ({upcoming.length})
              </div>
              {upcoming.length === 0 ? (
                <div className="sapEmpty">ยังไม่มีนัดหมาย</div>
              ) : upcoming.map(d => (
                <AppointCard key={d.donation_id} d={d} onClick={() => setDetailPopup(d)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Popup ── */}
      {detailPopup && (
        <div className="sapOverlay" onClick={() => setDetailPopup(null)}>
          <div className="sapPopup" onClick={e => e.stopPropagation()}>
            <button className="sapPopupClose" onClick={() => setDetailPopup(null)}>
              <Icon icon="mdi:close" width="18" />
            </button>
            <div className="sapPopupHead">
              <div className="sapPopupAvatar">
                <Icon icon="mdi:account" width="28" color="#fff" />
              </div>
              <div>
                <div className="sapPopupName">{detailPopup.donor_name}</div>
                <div className="sapPopupMeta">
                  {detailPopup.donor_phone && (
                    <span><Icon icon="mdi:phone" width="13" /> {detailPopup.donor_phone}</span>
                  )}
                </div>
              </div>
              <span className="sdBadge" style={{
                marginLeft: "auto",
                color:      STATUS_META[detailPopup.status]?.color,
                background: STATUS_META[detailPopup.status]?.bg,
              }}>
                {STATUS_META[detailPopup.status]?.label}
              </span>
            </div>

            <div className="sapPopupInfoRow">
              <div className="sapPopupInfoItem">
                <Icon icon="mdi:calendar" width="16" color="#3b82f6" />
                <div>
                  <div className="sapPopupInfoLabel">วันที่นัด</div>
                  <div className="sapPopupInfoVal">{formatThaiDate(detailPopup.donation_date)}</div>
                </div>
              </div>
              {detailPopup.donation_time && (
                <div className="sapPopupInfoItem">
                  <Icon icon="mdi:clock" width="16" color="#7c3aed" />
                  <div>
                    <div className="sapPopupInfoLabel">เวลา</div>
                    <div className="sapPopupInfoVal">{String(detailPopup.donation_time).slice(0,5)} น.</div>
                  </div>
                </div>
              )}
              <div className="sapPopupInfoItem">
                <Icon icon="mdi:package-variant" width="16" color="#16a34a" />
                <div>
                  <div className="sapPopupInfoLabel">จำนวนชุด</div>
                  <div className="sapPopupInfoVal">{detailPopup.quantity} ชิ้น</div>
                </div>
              </div>
            </div>

            <div className="sapPopupItems">
              <div className="sapPopupItemsTitle">รายการชุดที่จะนำมาส่ง</div>
              {parseItems(detailPopup.items_snapshot).map((item, i) => (
                <div key={i} className="sapPopupItem">
                  <span className="sapPopupItemDot" />
                  <span>{item.name}</span>
                  <span className="sapPopupItemQty">{item.quantity} ชิ้น</span>
                </div>
              ))}
            </div>

            <div className="sapPopupActions">
              <button className="sapPopupBtnGhost" onClick={() => setDetailPopup(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Modal ── */}
      {scheduleOpen && (
        <ScheduleModal
          schedule={schedule}
          onClose={() => setScheduleOpen(false)}
          onSaved={(saved) => {
            setSchedule(saved);
            setScheduleOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── AppointCard (unchanged) ───────────────────────────────────────
function AppointCard({ d, onClick }) {
  const items = parseItems(d.items_snapshot);
  const sm    = STATUS_META[d.status] || STATUS_META.pending;
  return (
    <div className="sapCard" onClick={onClick}>
      <div className="sapCardLeft">
        <div className="sapCardDate">
          <span className="sapCardDay">{new Date(d.donation_date).getDate()}</span>
          <span className="sapCardMon">{TH_MONTHS_SHORT[new Date(d.donation_date).getMonth()]}</span>
        </div>
      </div>
      <div className="sapCardBody">
        <div className="sapCardName">{d.donor_name}</div>
        <div className="sapCardMeta">
          {d.donation_time && (
            <span className="sapCardMetaItem">
              <Icon icon="mdi:clock-outline" width="13" />
              {String(d.donation_time).slice(0,5)} น.
            </span>
          )}
          <span className="sapCardMetaItem">
            <Icon icon="mdi:package-variant-closed" width="13" />
            {d.quantity} ชิ้น · {items.length} รายการ
          </span>
        </div>
      </div>
      <span className="sdBadge sapCardBadge" style={{ color: sm.color, background: sm.bg }}>
        {sm.label}
      </span>
    </div>
  );
}