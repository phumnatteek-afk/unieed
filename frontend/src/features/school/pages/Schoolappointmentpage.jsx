// SchoolAppointmentPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
const LOCATION_PRESETS = ["ป้อมยาม", "ห้องธุรการ", "ห้องประชาสัมพันธ์", "หน้าโรงเรียน"];

function ScheduleModal({ schedule, onClose, onSaved }) {
  const { token } = useAuth();
  const [openDays,   setOpenDays]   = useState(schedule?.open_days  || []);
  const [timeStart,  setTimeStart]  = useState(schedule?.time_start?.slice(0,5) || "08:00");
  const [timeEnd,    setTimeEnd]    = useState(schedule?.time_end?.slice(0,5)   || "15:30");
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const [locationValue, setLocationValue] = useState(schedule?.note || "");
  const [locationOpen,  setLocationOpen]  = useState(false);

  const toggleDay = (key) =>
    setOpenDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );

  const handleSave = async () => {
    setErr("");
    if (openDays.length === 0)    return setErr("กรุณาเลือกวันรับอย่างน้อย 1 วัน");
    if (timeStart >= timeEnd)     return setErr("เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด");
    if (!locationValue.trim())    return setErr("กรุณาระบุสถานที่นัดรับ");

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
          note:       locationValue.trim() || null,
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

        {/* สถานที่นัดรับ */}
        <div className="sapScheduleSection" style={{ position: "relative" }}>
          <div className="sapScheduleLabel">
            สถานที่นัดรับ
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="sapTimeInput"
              style={{ width: "100%", boxSizing: "border-box", paddingRight: 36 }}
              value={locationValue}
              onChange={e => setLocationValue(e.target.value)}
              onFocus={() => setLocationOpen(true)}
              onBlur={() => setTimeout(() => setLocationOpen(false), 150)}
              placeholder="เลือกหรือพิมพ์สถานที่นัดรับ..."
            />
            <Icon
              icon={locationOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
              width="18"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}
            />
            {locationOpen && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10,
                background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10,
                boxShadow: "0 -4px 12px rgba(0,0,0,.1)", overflow: "hidden",
              }}>
                {LOCATION_PRESETS.map(p => (
                  <div
                    key={p}
                    onMouseDown={() => { setLocationValue(p); setLocationOpen(false); }}
                    style={{
                      padding: "10px 14px", fontSize: 14, cursor: "pointer",
                      background: locationValue === p ? "#EEF2FF" : "#fff",
                      color: locationValue === p ? "#5285E8" : "#374151",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = locationValue === p ? "#EEF2FF" : "#fff"}
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <div className="sapScheduleBannerNote">
            <span style={{ color: "#6B7280" }}>สถานที่นัดรับ : </span>{schedule.note}
          </div>
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
  const navigate = useNavigate();
  const [dropoffs,     setDropoffs]     = useState([]);
  const [schedule,     setSchedule]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [calYear,      setCalYear]      = useState(new Date().getFullYear());
  const [calMonth,     setCalMonth]     = useState(new Date().getMonth());
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [detailPopup,  setDetailPopup]  = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [verifyPopup,    setVerifyPopup]    = useState(null);
  const [itemConditions, setItemConditions] = useState({});
  const [thankMsg,       setThankMsg]       = useState("");
  const [verifying,      setVerifying]      = useState(false);

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

  const deriveOverallCondition = (conditions) => {
    const vals = Object.values(conditions);
    if (vals.includes("wrong_item")) return "wrong_item";
    if (vals.includes("not_sent"))   return "not_sent";
    if (vals.includes("damaged"))    return "damaged";
    return "usable";
  };

  const buildThankMsg = (donation, conditions) => {
    const items = parseItems(donation.items_snapshot);
    const name  = donation.donor_name;

    const wrongItems    = items.filter(it => conditions[it.uniform_type_id] === "wrong_item");
    const usableItems   = items.filter(it => conditions[it.uniform_type_id] === "usable");
    const notSentItems  = items.filter(it => conditions[it.uniform_type_id] === "not_sent");
    const damagedItems  = items.filter(it => conditions[it.uniform_type_id] === "damaged");
    const cleanName     = (n) => String(n || "").replace(/\s*\(.*?\)\s*/g, "").trim();

    const allUsable  = wrongItems.length === 0 && notSentItems.length === 0 && damagedItems.length === 0;
    const allWrong   = wrongItems.length === items.length;
    const hasWrong   = wrongItems.length > 0;
    const hasUsable  = usableItems.length > 0;

    if (allUsable) {
      return `ขอบคุณคุณ ${name} มากๆ ที่ได้บริจาคชุดนักเรียนให้กับทางโรงเรียน การมีส่วนร่วมของท่านช่วยให้เด็กๆ ได้มีโอกาสทางการศึกษาที่ดีขึ้น ขอบพระคุณอย่างสูง`;
    }
    if (allWrong) {
      const list = wrongItems.map(it => cleanName(it.name)).join(", ");
      return `ขอบคุณคุณ ${name} ที่มีน้ำใจบริจาค ขออภัยที่รายการบริจาคไม่ตรงกับความต้องการของโรงเรียนในขณะนี้ (${list}) ทางโรงเรียนจึงไม่สามารถรับของได้ในครั้งนี้ ขอบพระคุณอย่างสูงสำหรับความตั้งใจดีของท่าน`;
    }
    // mixed
    const wrongList  = wrongItems.map(it => cleanName(it.name)).join(", ");
    const usableList = usableItems.map(it => cleanName(it.name)).join(", ");
    let msg = `ขอบคุณคุณ ${name} มากที่บริจาคชุดนักเรียนให้กับทางโรงเรียน`;
    if (hasUsable)  msg += ` ทางโรงเรียนได้รับ ${usableList} เรียบร้อยแล้ว`;
    if (hasWrong)   msg += ` อย่างไรก็ตามรายการ ${wrongList} ไม่ตรงกับความต้องการของโรงเรียนในขณะนี้ ขออภัยด้วยนะคะ`;
    msg += ` ขอบพระคุณสำหรับน้ำใจของท่านอย่างสูง`;
    return msg;
  };

  const openVerifyPopup = (donation) => {
    setDetailPopup(null);
    setVerifyPopup(donation);
    // ไม่ reset itemConditions — ใช้ค่าที่ตั้งจาก detail popup แล้ว
    setThankMsg(buildThankMsg(donation, itemConditions));
  };

  const handleVerify = async () => {
    const snapItems = parseItems(verifyPopup?.items_snapshot);
    const allSet = snapItems.length === 0 || snapItems.every(it => itemConditions[it.uniform_type_id]);
    if (!allSet) return alert("กรุณาเลือกสภาพชุดให้ครบทุกรายการ");
    try {
      setVerifying(true);
      const overall = snapItems.length > 0 ? deriveOverallCondition(itemConditions) : "usable";
      const items_received = snapItems.map(it => ({
        uniform_type_id: it.uniform_type_id,
        qty_received: it.quantity,
        item_condition: itemConditions[it.uniform_type_id] ?? "usable",
      }));
      const res = await fetch(`${BASE}/donations/${verifyPopup.donation_id}/verify`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ condition_status: overall, thank_message: thankMsg, items_received }),
      });
      if (!res.ok) throw new Error("ยืนยันไม่สำเร็จ");
      setVerifyPopup(null);
      setItemConditions({});
      setThankMsg("");
      // reload dropoffs
      const projRes = await fetch(`${BASE}/school/projects/latest`, { headers });
      const proj    = await projRes.json();
      if (proj?.request_id) {
        const r    = await fetch(`${BASE}/donations/project/${proj.request_id}`, { headers });
        const data = await r.json();
        setDropoffs((Array.isArray(data) ? data : []).filter(d => d.delivery_method === "dropoff"));
      }
    } catch (e) { alert(e.message); }
    finally { setVerifying(false); }
  };

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
                  <AppointCard key={d.donation_id} d={d} onClick={() => { setDetailPopup(d); setCheckedItems({}); }} />
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
                <AppointCard key={d.donation_id} d={d} onClick={() => { setDetailPopup(d); setCheckedItems({}); }} />
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
              {detailPopup.is_overdue ? (
                <span className="sdBadge" style={{ marginLeft: "auto", color: "#dc2626", background: "#fee2e2" }}>
                  <Icon icon="mdi:clock-alert-outline" width="13" style={{ marginRight: 3 }} />
                  เกินกำหนดยืนยันรับ
                </span>
              ) : (() => {
                const condBadge = detailPopup.status === "approved" && detailPopup.condition_status && detailPopup.condition_status !== "usable"
                  ? (CONDITION_BADGE[detailPopup.condition_status] || { label: detailPopup.condition_status, color: "#64748b", bg: "#f1f5f9" })
                  : STATUS_META[detailPopup.status];
                return (
                  <span className="sdBadge" style={{ marginLeft: "auto", color: condBadge?.color, background: condBadge?.bg }}>
                    {condBadge?.label}
                  </span>
                );
              })()}
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
                  <div className="sapPopupInfoVal">{detailPopup.quantity} ตัว</div>
                </div>
              </div>
            </div>

            <div className="sapPopupItems">
              <div className="sapPopupItemsTitle">
                {detailPopup.status === "pending"
                  ? "ตรวจสอบรายการที่ได้รับ"
                  : "รายการชุดที่นำมาส่ง"}
              </div>

              {detailPopup.status === "pending" ? (() => {
                const items = parseItems(detailPopup.items_snapshot);
                const allChecked = items.length > 0 && items.every((_, i) => checkedItems[i]);
                const isOverdue = detailPopup.is_overdue;
                return (
                  <>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                      ติ๊กถูกทุกรายการที่ได้รับครบแล้ว
                    </div>
                    {items.map((item, i) => {
                      const isChecked = !!checkedItems[i];
                      const COND_OPTS = [
                        { value: "usable",     label: "ใช้งานได้",     color: "#16a34a", bg: "#dcfce7" },
                        { value: "wrong_item", label: "รายการไม่ตรง",  color: "#d97706", bg: "#fef3c7" },
                        { value: "damaged",    label: "เสียหาย",        color: "#dc2626", bg: "#fee2e2" },
                        { value: "not_sent",   label: "ไม่ได้รับ",     color: "#7c3aed", bg: "#f5f3ff" },
                      ];
                      const cond = itemConditions[item.uniform_type_id];
                      const condMeta = COND_OPTS.find(o => o.value === cond);
                      return (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <label style={{
                            display: "flex", alignItems: "center", gap: 10,
                            background: isChecked ? "#f0fdf4" : "#f9fafb",
                            border: `1.5px solid ${isChecked ? "#86efac" : "#e5e7eb"}`,
                            borderRadius: isChecked ? "10px 10px 0 0" : 10,
                            padding: "10px 14px",
                            cursor: isOverdue ? "not-allowed" : "pointer",
                            opacity: isOverdue ? 0.5 : 1,
                            transition: "all 0.15s",
                          }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isOverdue}
                              onChange={isOverdue ? undefined : e => {
                                const checked = e.target.checked;
                                setCheckedItems(prev => ({ ...prev, [i]: checked }));
                                setItemConditions(prev => {
                                  const next = { ...prev };
                                  if (checked) { next[item.uniform_type_id] = next[item.uniform_type_id] || "usable"; }
                                  else { delete next[item.uniform_type_id]; }
                                  return next;
                                });
                              }}
                              style={{ width: 18, height: 18, accentColor: "#16a34a", cursor: isOverdue ? "not-allowed" : "pointer" }}
                            />
                            <span style={{ flex: 1, fontSize: 14, color: "#1a1a2e" }}>{item.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: isChecked ? "#16a34a" : "#378ADD", background: isChecked ? "#dcfce7" : "#eff6ff", padding: "2px 10px", borderRadius: 20 }}>
                              {item.quantity} ตัว
                            </span>
                          </label>
                          {isChecked && (
                            <div style={{ background: "#fff", border: "1.5px solid #86efac", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "10px 14px" }}>
                              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>ประเมินสภาพ</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {COND_OPTS.map(opt => (
                                  <button key={opt.value}
                                    onClick={() => setItemConditions(prev => ({ ...prev, [item.uniform_type_id]: opt.value }))}
                                    style={{
                                      fontSize: 12, padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                                      border: cond === opt.value ? `1.5px solid ${opt.color}` : "1.5px solid #e5e7eb",
                                      background: cond === opt.value ? opt.bg : "#f8fafc",
                                      color: cond === opt.value ? opt.color : "#64748b",
                                      fontWeight: cond === opt.value ? 700 : 400,
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              {condMeta && cond !== "usable" && (
                                <div style={{ marginTop: 6, fontSize: 11, color: condMeta.color, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Icon icon="mdi:alert-circle-outline" width={12} />
                                  {cond === "wrong_item" ? "รายการนี้จะนับเป็น strike" : condMeta.label}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!allChecked && items.length > 0 && (
                      <div style={{
                        fontSize: 12, color: "#d97706",
                        display: "flex", alignItems: "center", gap: 6, marginTop: 4,
                      }}>
                        <Icon icon="mdi:information-outline" width="14" />
                        ติ๊กครบทุกรายการก่อนกดยืนยัน
                      </div>
                    )}
                    {allChecked && (
                      <div style={{
                        fontSize: 12, color: "#16a34a",
                        display: "flex", alignItems: "center", gap: 6, marginTop: 4,
                      }}>
                        <Icon icon="mdi:check-circle-outline" width="14" />
                        ตรวจสอบครบแล้ว พร้อมยืนยัน
                      </div>
                    )}
                  </>
                );
              })() : parseItems(detailPopup.items_snapshot).map((item, i) => (
                <div key={i} className="sapPopupItem">
                  <span className="sapPopupItemDot" />
                  <span>{item.name}</span>
                  <span className="sapPopupItemQty">{item.quantity} ตัว</span>
                </div>
              ))}
            </div>

            <div className="sapPopupActions">
              {/* <button className="sapPopupBtnGhost" onClick={() => setDetailPopup(null)}>ปิด</button> */}
              {detailPopup.status === "pending" && (() => {
                if (detailPopup.is_overdue) {
                  return (
                    <div style={{
                      fontSize: 12, color: "#92400e", background: "#fffbeb",
                      border: "1px solid #fde68a", borderRadius: 8,
                      padding: "10px 14px", lineHeight: 1.6,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, fontWeight:600, marginBottom:2 }}>
                        <Icon icon="mdi:shield-account-outline" width="14" color="#d97706" />
                        ยังไม่ได้ยืนยันรับของภายใน 3 วันหลังวันนัด
                      </div>
                      <div style={{ color:"#78350f" }}>Admin จะเข้ามาดำเนินการตรวจสอบให้</div>
                    </div>
                  );
                }
                const items = parseItems(detailPopup.items_snapshot);
                const allChecked = items.length > 0 && items.every((_, i) => checkedItems[i]);
                return (
                  <button
                    className="sapPopupBtnPrimary"
                    disabled={!allChecked}
                    style={{ opacity: allChecked ? 1 : 0.45, cursor: allChecked ? "pointer" : "not-allowed" }}
                    onClick={() => openVerifyPopup(detailPopup)}
                  >
                    <Icon icon="mdi:check-circle-outline" width="16" />
                    ยืนยันรับของ
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Verify Popup ── */}
      {verifyPopup && (
        <div className="sapOverlay" onClick={() => setVerifyPopup(null)}>
          <div className="sapPopup" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <button className="sapPopupClose" onClick={() => setVerifyPopup(null)}>
              <Icon icon="mdi:close" width="18" />
            </button>
            <div className="sapPopupHead">
              <div className="sapPopupAvatar">
                <Icon icon="mdi:certificate-outline" width="24" color="#fff" />
              </div>
              <div>
                <div className="sapPopupName">ยืนยันรับบริจาค + ออกใบประกาศนียบัตร</div>
                <div className="sapPopupMeta">จาก {verifyPopup.donor_name}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:message-text-outline" width="16" />
                ข้อความขอบคุณ (ส่งให้ผู้บริจาคพร้อมใบประกาศ)
              </div>
              <textarea
                rows={4}
                value={thankMsg}
                onChange={e => setThankMsg(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* สรุปผลประเมินสภาพจาก detail popup */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon="mdi:clipboard-check-outline" width="16" />
                ผลการประเมินสภาพชุด
              </div>
              {(() => {
                const COND_META = {
                  usable:     { label: "ใช้งานได้",    color: "#16a34a", bg: "#dcfce7", icon: "mdi:check-circle-outline" },
                  wrong_item: { label: "รายการไม่ตรง", color: "#d97706", bg: "#fef3c7", icon: "mdi:swap-horizontal" },
                  damaged:    { label: "เสียหาย",       color: "#dc2626", bg: "#fee2e2", icon: "mdi:alert-circle-outline" },
                  not_sent:   { label: "ไม่ได้รับ",    color: "#7c3aed", bg: "#f5f3ff", icon: "mdi:package-variant-remove" },
                };
                return parseItems(verifyPopup.items_snapshot).map(it => {
                  const cond = itemConditions[it.uniform_type_id] || "usable";
                  const meta = COND_META[cond] || COND_META.usable;
                  return (
                    <div key={it.uniform_type_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#1e293b" }}>{it.name} <span style={{ color: "#64748b" }}>× {it.quantity} ตัว</span></span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, background: meta.bg, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                        <Icon icon={meta.icon} width={13} />
                        {meta.label}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#eff6ff", border: "0.5px solid #bfdbfe", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#1e40af", marginBottom: 20 }}>
              <Icon icon="mdi:certificate-outline" width="16" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>เมื่อยืนยัน ระบบจะ<strong> ออกใบประกาศนียบัตรอัตโนมัติ</strong> และส่ง notification พร้อมข้อความขอบคุณให้ผู้บริจาคทันที</span>
            </div>

            <div className="sapPopupActions">
              <button className="sapPopupBtnGhost" onClick={() => setVerifyPopup(null)}>ยกเลิก</button>
              <button
                className="sapPopupBtnPrimary"
                onClick={handleVerify}
                disabled={verifying}
                style={{ opacity: verifying ? 0.6 : 1, cursor: verifying ? "not-allowed" : "pointer" }}
              >
                {verifying ? "กำลังบันทึก..." : "ยืนยัน + ออกใบประกาศ"}
              </button>
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
const CONDITION_BADGE = {
  wrong_item: { label: "รายการไม่ตรง", color: "#d97706", bg: "#fef3c7" },
  damaged:    { label: "เสียหาย",      color: "#dc2626", bg: "#fee2e2" },
  not_sent:   { label: "ไม่ได้รับ",    color: "#7c3aed", bg: "#f5f3ff" },
};

function AppointCard({ d, onClick }) {
  const items = parseItems(d.items_snapshot);

  const getBadge = () => {
    if (d.is_overdue)
      return { label: "เกินกำหนดยืนยันรับ", color: "#dc2626", bg: "#fee2e2", icon: "mdi:clock-alert-outline" };
    if (d.status === "approved" && d.condition_status && d.condition_status !== "usable")
      return { ...(CONDITION_BADGE[d.condition_status] || { label: d.condition_status, color: "#64748b", bg: "#f1f5f9" }) };
    return STATUS_META[d.status] || STATUS_META.pending;
  };

  const badge = getBadge();

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
            {d.quantity} ตัว · {items.length} รายการ
          </span>
        </div>
      </div>
      <span className="sdBadge sapCardBadge" style={{ color: badge.color, background: badge.bg }}>
        {badge.icon && <Icon icon={badge.icon} width="13" style={{ marginRight: 3 }} />}
        {badge.label}
      </span>
    </div>
  );
}