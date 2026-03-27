// SchoolDonationPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../styles/Schooldonationpage.css";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const TRACKING_URLS = {
  "ไปรษณีย์ไทย": (no) => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  "Flash Express": (no) => `https://www.flashexpress.co.th/tracking/?se=${no}`,

  // ✅ แก้ J&T — URL จริงคือ /service/track?waybillNo=
  "J&T Express": (no) => `https://www.jtexpress.co.th/service/track?waybillNo=${no}`,

  // ✅ แก้ Kerry — เว็บ th.kerryexpress.com เปลี่ยน path แล้ว ใช้ /th/track/?track=
  "Kerry Express": (no) => `https://th.kex-express.com/th/track/?track=${no}`,

  "Lazada Logistics": () => `https://www.lazada.co.th/helpcenter/`,
};

const CONDITION_OPTIONS = [
  { value: "usable", label: "ใช้งานได้", color: "#16a34a", bg: "#dcfce7" },
  { value: "wrong_item", label: "รายการไม่ตรง", color: "#d97706", bg: "#fef3c7" },
  { value: "damaged", label: "เสียหาย", color: "#dc2626", bg: "#fee2e2" },
];

const STATUS_META = {
  pending: { label: "รอตรวจสอบ", color: "#d97706", bg: "#fef3c7" },
  approved: { label: "ได้รับแล้ว", color: "#16a34a", bg: "#dcfce7" },
  rejected: { label: "ปฏิเสธ", color: "#dc2626", bg: "#fee2e2" },
};

const CONDITION_META = {
  usable: { label: "ใช้งานได้", color: "#16a34a", bg: "#dcfce7" },
  wrong_item: { label: "รายการไม่ตรง", color: "#d97706", bg: "#fef3c7" },
  damaged: { label: "เสียหาย", color: "#dc2626", bg: "#fee2e2" },
};

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const formatDate = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "-";
  const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return local.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const parseItems = (snapshot) => {
  if (!snapshot) return [];
  try { return typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot; }
  catch { return []; }
};

// ── Mini Calendar component ────────────────────────────────────────
function MiniCalendar({ markedDate }) {
  const target = markedDate ? new Date(markedDate) : new Date();
  const year = target.getFullYear();
  const month = target.getMonth();
  const marked = markedDate
    ? `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`
    : null;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isMarked = (d) => {
    if (!d || !marked) return false;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return key === marked;
  };

  return (
    <div className="sdCal">
      <div className="sdCalHeader">
        <span className="sdCalMonth">{TH_MONTHS[month]} {year + 543}</span>
      </div>
      <div className="sdCalGrid">
        {TH_DAYS.map(d => (
          <div key={d} className="sdCalDayLabel">{d}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className={`sdCalCell ${isMarked(d) ? "sdCalMarked" : ""} ${!d ? "sdCalEmpty" : ""}`}>
            {d || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SchoolDonationPage() {
  const { token } = useAuth();

  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("all");

  // popups
  const [confirmPopup, setConfirmPopup] = useState(null);
  const [verifyPopup, setVerifyPopup] = useState(null);
  const [apptPopup, setApptPopup] = useState(null);
  const [thankMsg, setThankMsg] = useState("");
  const [condition, setCondition] = useState("");
  const [verifying, setVerifying] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const loadDonations = async () => {
    try {
      setLoading(true);
      const projRes = await fetch(`${BASE}/school/projects/latest`, { headers });
      const proj = await projRes.json();
      if (!proj?.request_id) { setDonations([]); return; }
      const res = await fetch(`${BASE}/donations/project/${proj.request_id}`, { headers });
      const data = await res.json();
      setDonations(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDonations(); }, []);

  const summary = useMemo(() => ({
    usable: donations.filter(d => d.condition_status === "usable").length,
    wrong_item: donations.filter(d => d.condition_status === "wrong_item").length,
    damaged: donations.filter(d => d.condition_status === "damaged").length,
    approved: donations.filter(d => d.status === "approved").length,
    pending: donations.filter(d => d.status === "pending").length,
  }), [donations]);

  const filtered = useMemo(() => donations.filter(d => {
    const matchMethod = filterMethod === "all" || d.delivery_method === filterMethod;
    const matchSearch = !search ||
      d.donor_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.tracking_number?.toLowerCase().includes(search.toLowerCase());
    return matchMethod && matchSearch;
  }), [donations, filterMethod, search]);

  const openTracking = (carrier, trackingNo) => {
    const fn = TRACKING_URLS[carrier];
    const url = fn ? fn(trackingNo) : `https://www.google.com/search?q=${encodeURIComponent(carrier + " tracking " + trackingNo)}`;
    window.open(url, "_blank");
  };

  const handleConfirm = async (donation) => {
    try {
      await fetch(`${BASE}/donations/${donation.donation_id}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      setConfirmPopup(null);
      loadDonations();
    } catch (e) { console.error(e); }
  };

  const handleVerify = async () => {
    if (!condition) return alert("กรุณาเลือกสภาพชุด");
    try {
      setVerifying(true);
      await fetch(`${BASE}/donations/${verifyPopup.donation_id}/verify`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          condition_status: condition,
          thank_message: thankMsg,   // ← ส่ง thank_message ให้ backend ด้วย
        }),
      });
      setVerifyPopup(null);
      setCondition("");
      setThankMsg("");
      loadDonations();
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  const openVerifyPopup = (donation) => {
    setVerifyPopup(donation);
    setCondition("");
    setThankMsg(
      `ขอบคุณคุณ ${donation.donor_name} มากๆ ที่ได้บริจาคชุดนักเรียนให้กับทางโรงเรียน ` +
      `การมีส่วนร่วมของท่านช่วยให้เด็กๆ ได้มีโอกาสทางการศึกษาที่ดีขึ้น ขอบพระคุณอย่างสูง`
    );
  };

  return (
    <div className="sdPage">
      <h1 className="sdTitle">ติดตามการบริจาค</h1>

      {/* Summary cards */}
      <div className="sdSummaryRow">
        <div className="sdSummaryCard" style={{ borderColor: "#2563eb" }}>
          <span className="sdSummaryLabel">ใช้งานได้</span>
          <span className="sdSummaryVal" style={{ color: "#2563eb" }}>{summary.usable}</span>
        </div>
        <div className="sdSummaryCard" style={{ borderColor: "#d97706" }}>
          <span className="sdSummaryLabel">รายการไม่ตรง</span>
          <span className="sdSummaryVal" style={{ color: "#d97706" }}>{summary.wrong_item}</span>
        </div>
        <div className="sdSummaryCard" style={{ borderColor: "#dc2626" }}>
          <span className="sdSummaryLabel">เสียหาย</span>
          <span className="sdSummaryVal" style={{ color: "#dc2626" }}>{summary.damaged}</span>
        </div>
        <div className="sdSummaryCard" style={{ borderColor: "#16a34a" }}>
          <span className="sdSummaryDot" style={{ background: "#16a34a" }} />
          <span className="sdSummaryLabel">ได้รับแล้ว</span>
          <span className="sdSummaryVal" style={{ color: "#16a34a" }}>{summary.approved}</span>
        </div>
        <div className="sdSummaryCard" style={{ borderColor: "#d97706" }}>
          <span className="sdSummaryDot" style={{ background: "#d97706" }} />
          <span className="sdSummaryLabel">รอตรวจสอบ</span>
          <span className="sdSummaryVal" style={{ color: "#d97706" }}>{summary.pending}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sdToolbar">
        <div className="sdSearchWrap">
          <Icon icon="mdi:magnify" width="18" color="#aaa" />
          <input className="sdSearch" placeholder="ค้นหาชื่อผู้บริจาค หรือ เลขพัสดุ......"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="sdFilterGroup">
          {[["all", "ทั้งหมด"], ["parcel", "จัดส่งพัสดุ"], ["dropoff", "Drop-Off"]].map(([v, l]) => (
            <label key={v} className="sdRadio">
              <input type="radio" name="method" value={v}
                checked={filterMethod === v} onChange={() => setFilterMethod(v)} />
              {l}
            </label>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="sdTableWrap">
        <table className="sdTable">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>ผู้บริจาค</th>
              <th>ข้อมูลการจัดส่ง / นัดหมาย</th>
              <th>หลักฐาน</th>
              <th>รายการบริจาค</th>
              <th>สถานะ</th>
              <th>การใช้งาน</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>ยังไม่มีรายการ</td></tr>
            ) : filtered.map(d => {
              const isExpanded = expandedRow === d.donation_id;
              const items = parseItems(d.items_snapshot);
              const statusMeta = STATUS_META[d.status] || STATUS_META.pending;
              const conditionMeta = d.condition_status ? CONDITION_META[d.condition_status] : null;

              return (
                <>
                  <tr key={d.donation_id}
                    className={`sdRow ${isExpanded ? "sdRowExpanded" : ""}`}
                    onClick={() => setExpandedRow(isExpanded ? null : d.donation_id)}
                  >
                    {/* วันที่ */}
                    <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDate(d.created_at)}</td>

                    {/* ผู้บริจาค */}
                    <td className="sdDonorName">{d.donor_name}</td>

                    {/* การจัดส่ง */}
                    <td>
                      {d.delivery_method === "parcel" ? (
                        <div className="sdDelivery">
                          <div className="sdDeliveryRow">
                            <Icon icon="mdi:package-variant-closed" width="14" />
                            <span>ส่งพัสดุ : {d.shipping_carrier}</span>
                          </div>
                          {d.tracking_number && (
                            <button className="sdTrackBtn"
                              onClick={e => { e.stopPropagation(); openTracking(d.shipping_carrier, d.tracking_number); }}>
                              #{d.tracking_number}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="sdDelivery">
                          <div className="sdDeliveryRow">
                            <Icon icon="mdi:calendar-clock" width="14" />
                            <span>Drop-Off</span>
                          </div>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {formatDate(d.donation_date)}
                            {d.donation_time ? ` ${String(d.donation_time).slice(0, 5)} น.` : ""}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* หลักฐาน */}
                    <td onClick={e => e.stopPropagation()}>
                      {d.donation_pic ? (
                        <button className="sdProofBtn"
                          onClick={() => window.open(d.donation_pic, "_blank")}>
                          <Icon icon="mdi:image-outline" width="14" />
                          ดูรูปภาพ
                        </button>
                      ) : d.delivery_method === "dropoff" ? (
                        <button className="sdApptBtn"
                          onClick={() => setApptPopup(d)}>
                          <Icon icon="mdi:calendar-check-outline" width="14" />
                          ดูการนัด
                        </button>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: 13 }}>ไม่มี</span>
                      )}
                    </td>

                    {/* รายการ */}
                    <td>
                      <span className="sdItemCount">

                        {items.length} รายการ · {d.quantity} ชิ้น
                      </span>
                    </td>

                    {/* สถานะ */}
                    <td>
                      <span className="sdBadge"
                        style={{ color: statusMeta.color, background: statusMeta.bg }}>
                        {d.status === "approved" && <Icon icon="mdi:check" width="13" />}
                        {statusMeta.label}
                      </span>
                    </td>

                    {/* การใช้งาน */}
                    <td>
                      {conditionMeta ? (
                        <span className="sdBadge"
                          style={{ color: conditionMeta.color, background: conditionMeta.bg }}>
                          {conditionMeta.label}
                        </span>
                      ) : <span style={{ color: "#e2e8f0" }}>—</span>}
                    </td>

                    {/* จัดการ */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="sdActions">
                        {d.status === "pending" && (
                          <>
                            <button className="sdBtnConfirm" onClick={() => openVerifyPopup(d)}>ยืนยัน</button>
                            <button className="sdBtnVerify"
                              onClick={() => openVerifyPopup(d)}>
                              ตรวจสอบ
                            </button>
                          </>
                        )}
                        {d.status === "approved" && !d.condition_status && (
                          <button className="sdBtnVerify" onClick={() => openVerifyPopup(d)}>
                            ตรวจสอบ
                          </button>
                        )}
                        {d.status === "approved" && d.condition_status && (
                          <button className="sdBtnMore">
                            <Icon icon="mdi:dots-vertical" width="18" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${d.donation_id}-exp`} className="sdExpandRow">
                      <td colSpan={8}>
                        <div className="sdExpandInner">
                          {items.length === 0 ? (
                            <span style={{ color: "#94a3b8", fontSize: 13 }}>ไม่มีข้อมูลรายการ</span>
                          ) : items.map((item, i) => (
                            <div key={i} className="sdExpandItem">
                              <span className="sdExpandDot" />
                              <span className="sdExpandName">{item.name}</span>
                              {item.education_level && (
                                <span className="sdExpandLevel">{item.education_level}</span>
                              )}
                              <span className="sdExpandQty">{item.quantity} ชิ้น</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Popup: ยืนยัน ── */}
      {confirmPopup && (
        <div className="sdOverlay" onClick={() => setConfirmPopup(null)}>
          <div className="sdPopup" onClick={e => e.stopPropagation()}>
            <div className="sdPopupIcon">✅</div>
            <div className="sdPopupTitle">ยืนยันการรับบริจาค</div>
            <div className="sdPopupBody">
              ระบบจะส่งคำขอบคุณถึง <strong>{confirmPopup.donor_name}</strong> โดยอัตโนมัติ
              และบันทึกสถานะเป็น "ได้รับแล้ว"
            </div>
            <div className="sdPopupActions" style={{ justifyContent: "center" }}>
              <button className="sdPopupBtnGhost" onClick={() => setConfirmPopup(null)}>ยกเลิก</button>
              <button className="sdPopupBtnPrimary" onClick={() => handleConfirm(confirmPopup)}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup: ตรวจสอบ ── */}
      {verifyPopup && (
        <div className="sdOverlay" onClick={() => setVerifyPopup(null)}>
          <div className="sdPopup sdPopupLg" onClick={e => e.stopPropagation()}>
            <button className="sdPopupClose" onClick={() => setVerifyPopup(null)}>
              <Icon icon="mdi:close" width="18" />
            </button>
            <div className="sdPopupTitle">ยืนยันรับบริจาค + ออกใบประกาศนียบัตร</div>
            <div className="sdPopupSubtitle">
              จาก {verifyPopup.donor_name} · {formatDate(verifyPopup.created_at)}
            </div>

            {/* ── ข้อความขอบคุณ ── */}
            <div className="sdVerifySection">
              <label className="sdVerifyLabel">
                <Icon icon="mdi:message-text-outline" width="16" />
                ข้อความขอบคุณ (ส่งให้ผู้บริจาคพร้อมใบประกาศ)
              </label>
              <textarea
                className="sdVerifyTextarea"
                rows={4}
                value={thankMsg}
                onChange={e => setThankMsg(e.target.value)}
              />
            </div>

            {/* ── สภาพชุด ── */}
            <div className="sdVerifySection">
              <label className="sdVerifyLabel">
                <Icon icon="mdi:tshirt-crew-outline" width="16" />
                ประเมินสภาพชุดที่ได้รับ
                <span style={{ color: "#ef4444" }}> *</span>
              </label>
              <div className="sdConditionGroup">
                {CONDITION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`sdConditionBtn ${condition === opt.value ? "sdConditionActive" : ""}`}
                    style={
                      condition === opt.value
                        ? { background: opt.bg, borderColor: opt.color, color: opt.color }
                        : {}
                    }
                    onClick={() => setCondition(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── note ── */}
            <div className="sdVerifyNote" style={{
              background: "#eff6ff",
              border: "0.5px solid #bfdbfe",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "12px",
              color: "#1e40af",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              marginBottom: "16px",
            }}>
              <Icon icon="mdi:certificate-outline" width="16" style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>
                เมื่อยืนยัน ระบบจะ<strong> ออกใบประกาศนียบัตรอัตโนมัติ</strong>{" "}
                และส่ง notification พร้อมข้อความขอบคุณให้ผู้บริจาคทันที
              </span>
            </div>

            <div className="sdPopupActions">
              <button className="sdPopupBtnGhost" onClick={() => setVerifyPopup(null)}>
                ยกเลิก
              </button>
              <button
                className="sdPopupBtnPrimary"
                onClick={handleVerify}
                disabled={verifying || !condition}
              >
                {verifying ? "กำลังบันทึก..." : "ยืนยัน + ออกใบประกาศ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup: ดูการนัดหมาย drop-off ── */}
      {apptPopup && (
        <div className="sdOverlay" onClick={() => setApptPopup(null)}>
          <div className="sdPopup sdPopupLg sdPopupAppt" onClick={e => e.stopPropagation()}>
            <button className="sdPopupClose" onClick={() => setApptPopup(null)}>
              <Icon icon="mdi:close" width="18" />
            </button>
            <div className="sdPopupTitle">รายละเอียดการนัดหมาย</div>
            <div className="sdPopupSubtitle">Drop-Off โดย {apptPopup.donor_name}</div>

            <div className="sdApptLayout">
              {/* ปฏิทิน */}
              <MiniCalendar markedDate={apptPopup.donation_date} />

              {/* Schedule */}
              <div className="sdSchedule">
                <div className="sdScheduleTitle">
                  <Icon icon="mdi:clock-outline" width="16" />
                  กำหนดการ
                </div>

                <div className="sdScheduleCard">
                  <div className="sdScheduleDate">
                    <Icon icon="mdi:calendar" width="15" color="#2563eb" />
                    <span>{formatDate(apptPopup.donation_date)}</span>
                  </div>
                  {apptPopup.donation_time && (
                    <div className="sdScheduleTime">
                      <Icon icon="mdi:clock" width="15" color="#7c3aed" />
                      <span>เวลา {String(apptPopup.donation_time).slice(0, 5)} น.</span>
                    </div>
                  )}
                  <div className="sdScheduleDetail">
                    <Icon icon="mdi:account" width="15" color="#16a34a" />
                    <span>ผู้บริจาค: {apptPopup.donor_name}</span>
                  </div>
                  {apptPopup.donor_phone && (
                    <div className="sdScheduleDetail">
                      <Icon icon="mdi:phone" width="15" color="#16a34a" />
                      <span>เบอร์: {apptPopup.donor_phone}</span>
                    </div>
                  )}
                  <div className="sdScheduleDivider" />
                  <div className="sdScheduleItems">
                    <div className="sdScheduleItemsTitle">
                      <Icon icon="mdi:package-variant-closed" width="14" />
                      รายการที่จะนำมาส่ง ({apptPopup.quantity} ชิ้น)
                    </div>
                    {parseItems(apptPopup.items_snapshot).map((item, i) => (
                      <div key={i} className="sdScheduleItem">
                        <span className="sdScheduleItemDot" />
                        <span>{item.name}</span>
                        <span className="sdScheduleItemQty">{item.quantity} ชิ้น</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sdScheduleStatus">
                  <span className="sdBadge"
                    style={{ color: STATUS_META[apptPopup.status]?.color, background: STATUS_META[apptPopup.status]?.bg }}>
                    {apptPopup.status === "approved" && <Icon icon="mdi:check" width="13" />}
                    {STATUS_META[apptPopup.status]?.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="sdPopupActions">
              <button className="sdPopupBtnGhost" onClick={() => setApptPopup(null)}>ปิด</button>
              {apptPopup.status === "pending" && (
                <button className="sdPopupBtnPrimary" onClick={() => {
  setApptPopup(null);
  openVerifyPopup(apptPopup);  // ← ไปใช้ verify path → insert fulfillment
}}>
                  ยืนยันรับ
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}