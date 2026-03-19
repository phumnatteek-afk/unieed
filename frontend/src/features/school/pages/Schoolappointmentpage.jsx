// SchoolAppointmentPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../styles/SchoolAppointmentPage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TH_MONTHS_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const TH_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const TH_DAYS = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const STATUS_META = {
  pending:  { label:"รอยืนยัน", color:"#d97706", bg:"#fef3c7" },
  approved: { label:"ยืนยันแล้ว", color:"#16a34a", bg:"#dcfce7" },
  rejected: { label:"ยกเลิก",  color:"#dc2626", bg:"#fee2e2" },
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

export default function SchoolAppointmentPage() {
  const { token } = useAuth();
  const [dropoffs,   setDropoffs]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [calYear,    setCalYear]    = useState(new Date().getFullYear());
  const [calMonth,   setCalMonth]   = useState(new Date().getMonth());
  const [selectedDay,setSelectedDay]= useState(null);
  const [detailPopup,setDetailPopup]= useState(null);

  const headers = token ? { Authorization:`Bearer ${token}` } : {};

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const projRes = await fetch(`${BASE}/school/projects/latest`, { headers });
        const proj    = await projRes.json();
        if (!proj?.request_id) { setDropoffs([]); return; }
        const res  = await fetch(`${BASE}/donations/project/${proj.request_id}`, { headers });
        const data = await res.json();
        const offs = (Array.isArray(data) ? data : []).filter(d => d.delivery_method === "dropoff");
        setDropoffs(offs);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
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
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const cellKey = (d) =>
    `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const todayKey = toDateKey(new Date().toISOString());
  const selectedKey = selectedDay ? cellKey(selectedDay) : null;
  const selectedItems = selectedKey ? (byDate[selectedKey] || []) : [];

  // upcoming (sorted)
  const upcoming = useMemo(() =>
    [...dropoffs]
      .filter(d => d.donation_date)
      .sort((a,b) => new Date(a.donation_date) - new Date(b.donation_date)),
  [dropoffs]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11); }
    else setCalMonth(m=>m-1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0); }
    else setCalMonth(m=>m+1);
    setSelectedDay(null);
  };

  return (
    <div className="sapPage">
      <div className="sapHeader">
        <h1 className="sapTitle">ติดตามการนัดหมาย</h1>
        <div className="sapTitleSub">รายการ Drop-off ที่นัดหมายไว้ทั้งหมด</div>
      </div>

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
                const count    = byDate[key]?.length || 0;
                return (
                  <div key={key}
                    className={`sapCalCell
                      ${hasAppt  ? "sapCalHasAppt"  : ""}
                      ${isToday  ? "sapCalToday"    : ""}
                      ${isSelect ? "sapCalSelected" : ""}
                    `}
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
                <span className="sapLegendDot" style={{ background:"#3b82f6" }} /> วันนัด
              </span>
              <span className="sapLegendItem">
                <span className="sapLegendDot" style={{ background:"#f59e0b", border:"2px solid #f59e0b" }} /> วันนี้
              </span>
            </div>
          </div>

          {/* ── RIGHT: Schedule panel ── */}
          <div className="sapRight">
            {/* Selected day appointments */}
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
                  <AppointCard key={d.donation_id} d={d}
                    onClick={() => setDetailPopup(d)} />
                ))}
              </div>
            )}

            {/* Upcoming all */}
            <div className="sapUpcomingPanel">
              <div className="sapUpcomingTitle">
                <Icon icon="mdi:clock-outline" width="16" />
                กำหนดการทั้งหมด ({upcoming.length})
              </div>
              {upcoming.length === 0 ? (
                <div className="sapEmpty">ยังไม่มีนัดหมาย</div>
              ) : upcoming.map(d => (
                <AppointCard key={d.donation_id} d={d}
                  onClick={() => setDetailPopup(d)} />
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
                marginLeft:"auto",
                color: STATUS_META[detailPopup.status]?.color,
                background: STATUS_META[detailPopup.status]?.bg
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
              {parseItems(detailPopup.items_snapshot).map((item,i) => (
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
    </div>
  );
}

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
      <span className="sdBadge sapCardBadge" style={{ color:sm.color, background:sm.bg }}>
        {sm.label}
      </span>
    </div>
  );
}