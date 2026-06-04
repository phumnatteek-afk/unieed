// SchoolDonationPage.jsx  (UPDATED — auto-check UI patch)
// ─────────────────────────────────────────────────────────────────────────────
// การเปลี่ยนแปลงจากไฟล์เดิม:
//   1. เพิ่ม helper  isOverdue(created_at)  → true ถ้าเกิน 7 วัน
//   2. เพิ่ม column "สถานะ Auto-check" ในตาราง
//   3. แสดง badge "รอ Auto-check" / "Auto-approved โดยระบบ" แทน badge ปกติ
//   4. แสดง warning banner เมื่อมีรายการที่เกิน 7 วันและยังไม่ confirmed
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../styles/Schooldonationpage.css";
 
const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";
 
const TRACKING_URLS = {
  "ไปรษณีย์ไทย": (no) => `https://track.thailandpost.co.th/?trackNumber=${no}`,
  "Flash Express": (no) => `https://www.flashexpress.co.th/tracking/?se=${no}`,
  "J&T Express":  (no) => `https://www.jtexpress.co.th/service/track?waybillNo=${no}`,
  "Kerry Express":(no) => `https://th.kex-express.com/th/track/?track=${no}`,
};
 
const getTrackingUrl = (carrier, trackingNo) => {
  const fn = TRACKING_URLS[carrier];
  return fn
    ? fn(trackingNo)
    : `https://www.google.com/search?q=${encodeURIComponent((carrier || "") + " tracking " + trackingNo)}`;
};
 
const CONDITION_OPTIONS = [
  { value: "usable",     label: "ใช้งานได้",   color: "#16a34a", bg: "#dcfce7" },
  { value: "wrong_item", label: "รายการไม่ตรง", color: "#d97706", bg: "#fef3c7" },
  { value: "damaged",    label: "เสียหาย",      color: "#dc2626", bg: "#fee2e2" },
];
 
const STATUS_META = {
  pending:  { label: "รอตรวจสอบ", color: "#d97706", bg: "#fef3c7" },
  approved: { label: "ได้รับแล้ว", color: "#16a34a", bg: "#dcfce7" },
  rejected: { label: "ปฏิเสธ",    color: "#dc2626", bg: "#fee2e2" },
};
 
const CONDITION_META = {
  usable:     { label: "ใช้งานได้",    color: "#16a34a", bg: "#dcfce7" },
  wrong_item: { label: "รายการไม่ตรง", color: "#d97706", bg: "#fef3c7" },
  damaged:    { label: "เสียหาย",      color: "#dc2626", bg: "#fee2e2" },
};
 
const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const TH_DAYS   = ["อา","จ","อ","พ","พฤ","ศ","ส"];
 
const formatDate = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};
 
const parseItems = (snapshot) => {
  if (!snapshot) return [];
  try { return typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot; }
  catch { return []; }
};

const itemKey = (it) => `${it.uniform_type_id}__${JSON.stringify(it.size ?? "")}__${it.name ?? ""}`;
 
const isOverdue = (createdAt) => {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24) >= 7;
};
 
const getDaysElapsed = (createdAt) => {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
};

const cleanName = (raw) => String(raw || "").replace(/\s*\(.*?\)\s*/g, "").trim();

const displayName = (it) => {
  const base = cleanName(it.name);
  if (!it.size) return base;
  try {
    const s = typeof it.size === "string" ? JSON.parse(it.size) : it.size;
    if (s?.chest) return `${base} (อก ${s.chest}")`;
    if (s?.waist) return `${base} (เอว ${s.waist}")`;
  } catch { /* ignore */ }
  return base;
};

function buildVerifyThankMsg(donorName, items, itemConditions) {
  const n = donorName || "ผู้บริจาค";
  const nameList = (arr) => arr.map(it => displayName(it)).join(", ");
  const cond = (it) => itemConditions[itemKey(it)] ?? "usable";

  const usableItems  = items.filter(it => cond(it) === "usable");
  const wrongItems   = items.filter(it => cond(it) === "wrong_item");
  const damagedItems = items.filter(it => cond(it) === "damaged");

  if (wrongItems.length === 0 && damagedItems.length === 0) {
    return `ขอบคุณคุณ ${n} มากๆ ที่ได้บริจาคชุดนักเรียนให้กับทางโรงเรียน การมีส่วนร่วมของท่านช่วยให้เด็กๆ ได้มีโอกาสทางการศึกษาที่ดีขึ้น ขอบพระคุณอย่างสูง`;
  }
  if (wrongItems.length > 0 && usableItems.length === 0 && damagedItems.length === 0) {
    return `ขอบคุณคุณ ${n} ที่มีน้ำใจบริจาค ขออภัยที่รายการ (${nameList(wrongItems)}) ที่ได้รับไม่ตรงตามรายการที่โรงเรียนขอรับบริจาคไว้ ขอบพระคุณในน้ำใจของท่านอย่างสูง`;
  }
  const parts = [];
  if (usableItems.length > 0)  parts.push(`ได้รับ${nameList(usableItems)}เรียบร้อย`);
  if (wrongItems.length > 0)   parts.push(`${nameList(wrongItems)} ไม่ตรงตามรายการที่โรงเรียนขอรับบริจาคไว้`);
  if (damagedItems.length > 0) parts.push(`${nameList(damagedItems)} มีสภาพชำรุด`);
  return `ขอบคุณคุณ ${n} ที่มีน้ำใจบริจาค ทางโรงเรียนขอแจ้งให้ทราบว่า ${parts.join(" และ ")} ขอบพระคุณในน้ำใจของท่านอย่างสูง`;
}
 
// ── Delivery cell — แยกตาม delivery_method ───────────────────────────────
function DeliveryCell({ d, onOpenTracking, onOpenAppt }) {
  // ── market_purchase ──────────────────────────────────────────────────────
  if (d.delivery_method === "market_purchase") {
    return (
      <div className="sdDelivery">
        <div className="sdDeliveryRow">
          {/* ไอคอนถุงช้อปปิ้ง + label */}
          <Icon icon="mdi:shopping-outline" width="14" color="#5285E8" />
          <span style={{ color: "#5285E8", fontWeight: 600 }}>ซื้อเพื่อบริจาค</span>
          {d.shipping_carrier && (
            <span style={{ color: "#64748b", fontSize: 12 }}>· {d.shipping_carrier}</span>
          )}
        </div>
 
        {d.tracking_number ? (
          // มีเลขพัสดุแล้ว → ลิ้งไปหน้า tracking
          <button
            className="sdTrackBtn"
            onClick={e => { e.stopPropagation(); onOpenTracking(d.shipping_carrier, d.tracking_number); }}
          >
            #{d.tracking_number}
          </button>
        ) : (
          // ยังไม่มีเลขพัสดุ
          <span className="sdTrackPending">รอร้านค้าอัปเดต</span>
        )}
 
        {/* order reference */}
        {d.market_order_id && (
          <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            คำสั่งซื้อ #{d.market_order_id}
          </span>
        )}
      </div>
    );
  }
 
  // ── parcel ───────────────────────────────────────────────────────────────
  if (d.delivery_method === "parcel") {
    return (
      <div className="sdDelivery">
        <div className="sdDeliveryRow">
          <Icon icon="mdi:package-variant-closed" width="14" />
          <span>ส่งพัสดุ : {d.shipping_carrier}</span>
        </div>
        {d.tracking_number ? (
          <button
            className="sdTrackBtn"
            onClick={e => { e.stopPropagation(); onOpenTracking(d.shipping_carrier, d.tracking_number); }}
          >
            #{d.tracking_number}
          </button>
        ) : (
          <span className="sdTrackPending">รอผู้บริจาคกรอกเลขพัสดุ</span>
        )}
      </div>
    );
  }
 
  // ── dropoff ──────────────────────────────────────────────────────────────
  return (
    <div className="sdDelivery">
      <div className="sdDeliveryRow">
        <Icon icon="mdi:calendar-clock" width="14" />
        <span>Drop-Off</span>
      </div>
      <span style={{ fontSize: 12, color: "#64748b" }}>
        {formatDate(d.donation_date)}
        {d.donation_time ? ` ${String(d.donation_time).slice(0,5)} น.` : ""}
      </span>
    </div>
  );
}
 
// ── Proof / Appointment cell ─────────────────────────────────────────────
function ProofCell({ d, onOpenAppt, onOpenImage }) {
  if (d.donation_pic) {
    return (
      <button className="sdProofBtn" onClick={() => onOpenImage(d.donation_pic, d.donor_name)}>
        <Icon icon="mdi:image-outline" width="14" /> ดูรูปภาพ
      </button>
    );
  }
  if (d.delivery_method === "dropoff") {
    return (
      <button className="sdApptBtn" onClick={() => onOpenAppt(d)}>
        <Icon icon="mdi:calendar-check-outline" width="14" /> ดูการนัด
      </button>
    );
  }
  // market_purchase: ไม่มีรูปหลักฐาน (ระบบ auto-receive จากระบบ payment)
  if (d.delivery_method === "market_purchase") {
    return (
      <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, color:"#5285E8", background:"#eff6ff", padding:"3px 8px", borderRadius:12 }}>
        <Icon icon="mdi:check-circle-outline" width={13} /> ชำระผ่านระบบ
      </span>
    );
  }
  return <span style={{ color: "#cbd5e1", fontSize: 13 }}>ไม่มี</span>;
}
 
// ── Mini Calendar ─────────────────────────────────────────────────────────
function MiniCalendar({ markedDate }) {
  const target      = markedDate ? new Date(markedDate) : new Date();
  const year        = target.getFullYear();
  const month       = target.getMonth();
  const marked      = markedDate
    ? `${year}-${String(month+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`
    : null;
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const isMarked = (d) => {
    if (!d || !marked) return false;
    return `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}` === marked;
  };
  return (
    <div className="sdCal">
      <div className="sdCalHeader">
        <span className="sdCalMonth">{TH_MONTHS[month]} {year+543}</span>
      </div>
      <div className="sdCalGrid">
        {TH_DAYS.map(d => <div key={d} className="sdCalDayLabel">{d}</div>)}
        {cells.map((d,i) => (
          <div key={i} className={`sdCalCell ${isMarked(d) ? "sdCalMarked" : ""} ${!d ? "sdCalEmpty" : ""}`}>{d||""}</div>
        ))}
      </div>
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
export default function SchoolDonationPage() {
  const { token } = useAuth();
  const location = useLocation();
 
  const [donations,    setDonations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [expandedRow,  setExpandedRow]  = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterMethod, setFilterMethod] = useState("all");
 
  const [projectStatus, setProjectStatus] = useState(null);
  const [projectFulfilled, setProjectFulfilled] = useState(0);
  const [latestRequestId, setLatestRequestId] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [confirmPopup, setConfirmPopup] = useState(null);
  const [verifyPopup,  setVerifyPopup]  = useState(null);
  const [apptPopup,    setApptPopup]    = useState(null);
  const [imagePopup,   setImagePopup]   = useState(null); // { src, name }
  const [thankMsg,       setThankMsg]       = useState("");
  const [itemConditions, setItemConditions] = useState({});
  const [itemReasons,    setItemReasons]    = useState({});
  const [itemNotes,      setItemNotes]      = useState({});
  const [checkedSet,     setCheckedSet]     = useState(new Set());
  const [verifying,      setVerifying]      = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const PAGE_SIZE = 15;
 
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
 
  const loadDonations = async ({ checkCleared = false } = {}) => {
    try {
      setLoading(true);
      const projRes = await fetch(`${BASE}/school/projects/latest`, { headers });
      const proj    = await projRes.json();
      if (!proj?.request_id) { setDonations([]); return; }
      setProjectStatus(proj.status);
      setProjectFulfilled(Number(proj.total_fulfilled) || 0);
      setLatestRequestId(proj.request_id);
      const res  = await fetch(`${BASE}/donations/project/${proj.request_id}`, { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setDonations(list);
      if (checkCleared) setBannerDismissed(false);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
 
  useEffect(() => { loadDonations(); }, []);

  const summary = useMemo(() => ({
    usable_qty: projectFulfilled,
    wrong_item: donations.filter(d => d.condition_status === "wrong_item").length,
    damaged:    donations.filter(d => d.condition_status === "damaged").length,
    approved:   donations.filter(d => d.status === "approved").length,
    pending:    donations.filter(d => d.status === "pending").length,
    market:     donations.filter(d => d.delivery_method === "market_purchase").length,
  }), [donations, projectFulfilled]);
 
  const showClearedBanner = projectStatus === "closed" && summary.pending === 0 && donations.length > 0 && !bannerDismissed;

  // เมื่อเคลียร์หมดแล้ว → บอก SchoolRequestManagePage ผ่าน sessionStorage แทนการแสดง banner ที่นี่
  useEffect(() => {
    if (showClearedBanner && latestRequestId) {
      sessionStorage.setItem(`canOpenBanner_${latestRequestId}`, "1");
    }
  }, [showClearedBanner, latestRequestId]);

  const overdueCount = useMemo(() =>
    donations.filter(d =>
      d.status === "pending" && (
        (d.delivery_method === "dropoff" && d.is_overdue) ||
        (d.delivery_method !== "dropoff" && isOverdue(d.created_at))
      )
    ).length,
  [donations]);
 
  const filtered = useMemo(() => {
    setCurrentPage(1);
    return donations.filter(d => {
      const matchMethod = filterMethod === "all" || d.delivery_method === filterMethod;
      const matchSearch = !search ||
        d.donor_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.tracking_number?.toLowerCase().includes(search.toLowerCase()) ||
        d.market_order_id?.toLowerCase().includes(search.toLowerCase());
      return matchMethod && matchSearch;
    });
  }, [donations, filterMethod, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // เปิดจากการแจ้งเตือน (คลิก donation_received / admin_approved)
  useEffect(() => {
    const openId = location.state?.openDonationId;
    if (!openId || !donations.length) return;
    const target = donations.find(d => Number(d.donation_id) === Number(openId));
    if (!target) return;
    setExpandedRow(target.donation_id);
    const pageIdx = filtered.findIndex(d => d.donation_id === target.donation_id);
    if (pageIdx >= 0) setCurrentPage(Math.floor(pageIdx / PAGE_SIZE) + 1);
  }, [location.state, donations, filtered]);
 
  const openTracking = (carrier, trackingNo) => {
    window.open(getTrackingUrl(carrier, trackingNo), "_blank");
  };

  const openImage = (src, name) => setImagePopup({ src, name });
 
  const handleConfirm = async (donation) => {
    try {
      await fetch(`${BASE}/donations/${donation.donation_id}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      setConfirmPopup(null);
      loadDonations({ checkCleared: true });
    } catch (e) { console.error(e); }
  };

 
  const resolveItemCond = (uid) => {
    const c = itemConditions[uid];
    if (c === "issue") return "wrong_item";
    return c || "usable";
  };

  const handleVerify = async () => {
    const snapItems = parseItems(verifyPopup?.items_snapshot);
    if (checkedSet.size === 0) return alert("กรุณาติ๊กรายการที่ได้รับอย่างน้อย 1 รายการ");
    const issueNeedReason = snapItems.filter(it =>
      checkedSet.has(itemKey(it)) &&
      itemConditions[itemKey(it)] === "issue" &&
      !(itemReasons[itemKey(it)]?.length > 0)
    );
    if (issueNeedReason.length > 0) return alert("กรุณาระบุสาเหตุของรายการที่ไม่ตรงให้ครบ");
    try {
      setVerifying(true);
      const items_received = snapItems.map(it => {
        const key = itemKey(it);
        const isChecked = checkedSet.has(key);
        const resolved = isChecked ? resolveItemCond(key) : "not_received";
        return {
          uniform_type_id: it.uniform_type_id,
          name: it.name ?? null,
          size: it.size ?? null,
          qty_received: isChecked ? it.quantity : 0,
          item_condition: resolved,
          ...(resolved === "wrong_item" && itemReasons[key]?.length > 0 ? { reason: itemReasons[key].join(", "), note: itemNotes[key] || "" } : {}),
        };
      });
      const resolvedConditions = Object.fromEntries(
        snapItems.filter(it => checkedSet.has(itemKey(it)))
          .map(it => [itemKey(it), resolveItemCond(itemKey(it))])
      );
      const overall = snapItems.length > 0 ? deriveOverallCondition(resolvedConditions) : "usable";
      await fetch(`${BASE}/donations/${verifyPopup.donation_id}/verify`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ condition_status: overall, thank_message: thankMsg, items_received }),
      });
      setVerifyPopup(null);
      setItemConditions({});
      setItemReasons({});
      setItemNotes({});
      setCheckedSet(new Set());
      setThankMsg("");
      loadDonations({ checkCleared: true });
    } catch (e) { console.error(e); }
    finally { setVerifying(false); }
  };
 
  const openVerifyPopup = (donation) => {
    setVerifyPopup(donation);
    const snapItems = parseItems(donation.items_snapshot);
    const allUids = snapItems.map(itemKey);
    setCheckedSet(new Set(allUids));
    setItemConditions(Object.fromEntries(allUids.map(uid => [uid, "usable"])));
    setItemReasons({});
    setThankMsg(buildVerifyThankMsg(donation.donor_name, parseItems(donation.items_snapshot), {}));
  };

  const deriveOverallCondition = (resolvedConditions) => {
    const vals = Object.values(resolvedConditions);
    if (vals.includes("wrong_item")) return "wrong_item";
    if (vals.includes("damaged"))    return "damaged";
    return "usable";
  };

  useEffect(() => {
    if (!verifyPopup) return;
    const items = parseItems(verifyPopup.items_snapshot);
    if (items.length === 0) return;
    const resolved = Object.fromEntries(
      items.map(it => [itemKey(it), checkedSet.has(itemKey(it)) ? resolveItemCond(itemKey(it)) : "not_received"])
    );
    setThankMsg(buildVerifyThankMsg(verifyPopup.donor_name, items.filter(it => checkedSet.has(itemKey(it))), resolved));
  }, [itemConditions, checkedSet, verifyPopup]);
 
  return (
    <div className="sdPage">
      {/* Page header */}
      <div className="sdPageHeader">
        <div>
          <h1 className="sdTitle">ติดตามการบริจาค</h1>
          <p className="sdTitleSub">
            {loading ? "กำลังโหลด..." : `${donations.length} รายการทั้งหมด`}
          </p>
        </div>
      </div>


      {/* Warning: รายการเกิน 7 วัน */}
      {overdueCount > 0 && (
        <div className="sdOverdueBanner">
          <Icon icon="mdi:clock-alert-outline" width={20} color="#d97706" style={{ flexShrink:0 }} />
          <span>มี <strong>{overdueCount} รายการ</strong> ที่เกินระยะเวลาและยังไม่ได้รับการยืนยัน — แอดมินจะทำการตรวจสอบและดำเนินการให้ภายหลัง</span>
          <Icon icon="mdi:robot-outline" width={18} color="#d97706" className="sdOverdueBannerIcon" />
        </div>
      )}

      {/* ── Summary Dashboard ── */}
      <div className="sdSummaryRow">
        {[
          { color:"#2563eb", bg:"#eff6ff", icon:"mdi:check-circle-outline",          label:"ใช้งานได้",           val: summary.usable_qty, unit:"ตัว"    },
          { color:"#16a34a", bg:"#dcfce7", icon:"mdi:package-variant-closed-check",  label:"ได้รับแล้ว",          val: summary.approved,   unit:"รายการ" },
          { color:"#d97706", bg:"#fef3c7", icon:"mdi:clock-outline",                 label:"รอตรวจสอบ",           val: summary.pending,    unit:"รายการ" },
          { color:"#dc2626", bg:"#fee2e2", icon:"mdi:alert-circle-outline",          label:"เสียหาย",             val: summary.damaged,    unit:"รายการ" },
          { color:"#d97706", bg:"#fef3c7", icon:"mdi:swap-horizontal-circle-outline",label:"รายการไม่ตรง",        val: summary.wrong_item, unit:"รายการ" },
          ...(summary.market > 0  ? [{ color:"#5285E8", bg:"#eff6ff", icon:"mdi:shopping-outline",    label:"ซื้อเพื่อบริจาค",       val: summary.market,     unit:"รายการ" }] : []),
          ...(overdueCount  > 0   ? [{ color:"#7c3aed", bg:"#f3e8ff", icon:"mdi:robot-outline",        label:"รอแอดมินตรวจสอบ",       val: overdueCount,       unit:"รายการ" }] : []),
        ].map((s, i) => (
          <div key={i} className="sdSummaryCard" style={{ color: s.color }}>
            <div className="sdSummaryTop">
              <div className="sdSummaryIcon" style={{ background: s.bg }}>
                <Icon icon={s.icon} color={s.color} width={20} />
              </div>
            </div>
            <span className="sdSummaryLabel">{s.label}</span>
            <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
              <span className="sdSummaryVal" style={{ color: s.color }}>{s.val}</span>
              <span className="sdSummaryUnit" style={{ color: s.color }}>{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar — filter tabs */}
      <div className="sdToolbar">
        <div className="sdSearchWrap">
          <Icon icon="mdi:magnify" width="18" color="#94a3b8" />
          <input className="sdSearch" placeholder="ค้นหาชื่อผู้บริจาค หรือ เลขพัสดุ / คำสั่งซื้อ..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", display:"flex", padding:0 }}>
              <Icon icon="mdi:close-circle" width={16} />
            </button>
          )}
        </div>
        <div className="sdFilterTabs">
          {[
            ["all",             "ทั้งหมด"],
            ["parcel",          "พัสดุ"],
            ["dropoff",         "Drop-Off"],
            ["market_purchase", "ซื้อเพื่อบริจาค"],
          ].map(([v, l]) => (
            <button key={v}
              className={`sdFilterTab ${filterMethod === v ? "sdFilterTabActive" : ""}`}
              onClick={() => setFilterMethod(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
 
      {/* Table */}
      <div className="sdTableWrap">
        <table className="sdTable">
          <colgroup>
            <col className="sdColDate" />
            <col className="sdColDonor" />
            <col className="sdColDelivery" />
            <col className="sdColProof" />
            <col className="sdColItems" />
            <col className="sdColStatus" />
            <col className="sdColCond" />
            <col className="sdColAction" />
          </colgroup>
          <thead>
            <tr>
              <th>วันที่</th>
              <th>ผู้บริจาค</th>
              <th>ข้อมูลการจัดส่ง / นัดหมาย</th>
              <th>หลักฐาน</th>
              <th>รายการบริจาค</th>
              <th>สถานะ</th>
              <th>ผลประเมิน</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"56px 20px", color:"#94a3b8" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", border:"3px solid #bfdbfe", borderTopColor:"#3b6fd4", animation:"sdSpin 0.7s linear infinite" }} />
                    <span style={{ fontSize:13 }}>กำลังโหลดข้อมูล...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:"56px 20px", color:"#94a3b8" }}>
                    <Icon icon="mdi:inbox-outline" width={40} style={{ opacity:0.35 }} />
                    <span style={{ fontSize:13, fontWeight:500 }}>
                      {donations.length === 0 ? "ยังไม่มีรายการบริจาค" : "ไม่พบรายการที่ตรงกับตัวกรอง"}
                    </span>
                  </div>
                </td>
              </tr>
            ) : paginated.map(d => {
              const isExpanded    = expandedRow === d.donation_id;
              const items         = parseItems(d.items_snapshot);
              const statusMeta    = STATUS_META[d.status] || STATUS_META.pending;
              const conditionMeta = (d.status === "approved" && d.condition_status)
                ? CONDITION_META[d.condition_status] : null;
              const overdueStatuses = (
                d.status === "pending" ||
                (d.status === "approved" && Number(d.auto_approved) === 1) ||
                (d.status === "rejected" && Number(d.auto_approved) === 1)
              );
              const isParcelOverdue  = d.delivery_method !== "dropoff" && isOverdue(d.created_at) && overdueStatuses;
              const isDropoffOverdue = d.delivery_method === "dropoff"  && !!d.is_overdue          && overdueStatuses;
              const overdue = isParcelOverdue || isDropoffOverdue;
                            
              // market_purchase rows: ไฮไลต์สีฟ้าอ่อน
              const isMarket = d.delivery_method === "market_purchase";
 
              return (
                <>
                  <tr key={d.donation_id}
                    className={`sdRow ${isExpanded ? "sdRowExpanded" : ""}`}
                    style={
                      isExpanded ? {} :
                      isMarket   ? { background:"#f5f8ff" } :
                      overdue    ? { background:"#fffdf0" } : {}
                    }
                    onClick={() => setExpandedRow(isExpanded ? null : d.donation_id)}
                  >
                    {/* วันที่ */}
                    <td className="sdDateCell" style={{ whiteSpace:"nowrap" }}>
                      {formatDate(d.created_at)}
                      {overdue && (
                        <div style={{ marginTop:4 }}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#fef3c7", color:"#b45309", border:"1px solid #fcd34d", whiteSpace:"nowrap" }}>
                            <Icon icon="mdi:clock-alert-outline" width={12} />
                            เกิน {isDropoffOverdue ? "3" : "7"} วัน
                          </span>
                        </div>
                      )}
                      {isMarket && (
                        <div style={{ fontSize:10, color:"#5285E8", marginTop:2, fontWeight:600 }}>ซื้อบริจาค</div>
                      )}
                    </td>
 
                    {/* ผู้บริจาค */}
                    <td className="sdDonorName">
                      {d.donor_name}
                      {d.donor_phone && (
                        <div style={{ fontSize:11, color:"#94a3b8", marginTop:2, display:"flex", alignItems:"center", gap:3 }}>
                          <Icon icon="mdi:phone-outline" width={11} />
                          {d.donor_phone}
                        </div>
                      )}
                    </td>
 
                    {/* การจัดส่ง */}
                    <td>
                      <DeliveryCell
                        d={d}
                        onOpenTracking={openTracking}
                        onOpenAppt={setApptPopup}
                      />
                    </td>
 
                    {/* หลักฐาน */}
                    <td onClick={e => e.stopPropagation()}>
                      <ProofCell d={d} onOpenAppt={setApptPopup} onOpenImage={openImage} />
                    </td>
 
                    {/* รายการ */}
                    <td>
                      {items.length > 0 ? (
                        <span className="sdItemCount" style={{ whiteSpace:"nowrap"}}>
                          {items.length} รายการ · {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} ตัว
                        </span>
                      ) : (
                        <span className="sdItemCount">
                          {d.quantity ? `${d.quantity} ตัว` : '—'}
                        </span>
                      )}
                    </td>
 
                    {/* สถานะ */}
                    <td>
                      <span className="sdBadge" style={{ color:statusMeta.color, background:statusMeta.bg }}>
                        {d.status === "approved" && <Icon icon="mdi:check" width="13" />}
                        {statusMeta.label}
                      </span>
                    </td>
 
                    {/* การใช้งาน */}
                    <td>
                      {conditionMeta ? (
                        <span className="sdBadge" style={{ color:conditionMeta.color, background:conditionMeta.bg }}>
                          {conditionMeta.label}
                        </span>
                      ) : <span style={{ color:"#e2e8f0" }}>—</span>}
                    </td>
 

 
                    
                 {/* จัดการ */}
                <td onClick={e => e.stopPropagation()}>
                <div className="sdActions">

                  {/* pending + ยังไม่เกิน limit → แสดงปุ่ม */}
                  {d.status === "pending" && !overdue && (
                    <button className="sdBtnVerify" onClick={() => openVerifyPopup(d)}>ตรวจสอบ</button>
                  )}

                  {/* pending + เกินกำหนดแล้ว → รอแอดมิน */}
                  {d.status === "pending" && overdue && (
                    <span style={{ fontSize:11, color:"#d97706", background:"#fef3c7", padding:"3px 9px", borderRadius:20, fontWeight:600, display:"inline-flex", alignItems:"center", gap:4 , whiteSpace:"nowrap"}}>
                      <Icon icon="mdi:clock-outline" width={13} />
                      รอแอดมินตรวจสอบ
                    </span>
                  )}

                  {/* approved โรงเรียนเอง + ยังไม่ตรวจสภาพ */}
                  {d.status === "approved" && !d.condition_status && !Number(d.auto_approved) && (
                    <button className="sdBtnVerify" onClick={() => openVerifyPopup(d)}>ตรวจสอบ</button>
                  )}

                  {/* Admin อนุมัติแล้ว — แสดงเฉพาะ approved เท่านั้น */}
                  {d.status === "approved" && Number(d.auto_approved) === 1 && (
                    <span style={{ fontSize:11, color:"#16a34a", background:"#dcfce7", padding:"3px 9px", borderRadius:20, fontWeight:600, display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>
                      <Icon icon="mdi:check-circle-outline" width={13} />
                      แอดมินอนุมัติแล้ว
                    </span>
                  )}

                  {/* Admin ไม่อนุมัติ */}
                  {d.status === "rejected" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <span style={{ fontSize:11, color:"#dc2626", background:"#fee2e2", padding:"3px 9px", borderRadius:20, fontWeight:600, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:4 }}>
                      <Icon icon="mdi:close-circle-outline" width={13} />แอดมินไม่อนุมัติ
                    </span>
                    {d.reject_reason && (
                      <span style={{ fontSize:11, color:"#64748b", background:"#f8fafc", border:"1px solid #e2e8f0", padding:"3px 8px", borderRadius:8, maxWidth:160 }}>
                        {d.reject_reason}
                      </span>
                    )}
                  </div>
                )}

                </div>
              </td>
                  </tr>
 
                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${d.donation_id}-exp`} className="sdExpandRow">
                      <td colSpan={8}>
                        <div className="sdExpandInner">
                          {/* market_purchase: แสดง order reference */}
                          {isMarket && d.market_order_id && (
                            <div style={{ marginBottom:8, fontSize:12, color:"#5285E8", display:"flex", alignItems:"center", gap:6 }}>
                              <Icon icon="mdi:shopping-outline" width={14} />
                              คำสั่งซื้อ #{d.market_order_id}
                            </div>
                          )}
                          {(() => {
                            const condSnap = (() => {
                              if (!d.items_condition_snapshot) return null;
                              try { return typeof d.items_condition_snapshot === "string" ? JSON.parse(d.items_condition_snapshot) : d.items_condition_snapshot; }
                              catch { return null; }
                            })();
                            const condMap = condSnap
                              ? condSnap.reduce((acc, r) => {
                                  const ck3 = `${r.uniform_type_id}__${JSON.stringify(r.size ?? "")}__${r.name ?? ""}`;
                                  const ck2 = `${r.uniform_type_id}__${JSON.stringify(r.size ?? "")}`;
                                  acc[ck3] = r;
                                  if (!acc[ck2]) acc[ck2] = r;
                                  if (!acc[r.uniform_type_id]) acc[r.uniform_type_id] = r;
                                  return acc;
                                }, {})
                              : null;
                            const ITEM_COND = {
                              usable:       { label: "ใช้งานได้",      color: "#16a34a", icon: "mdi:check-circle-outline" },
                              damaged:      { label: "เสียหาย",         color: "#dc2626", icon: "mdi:close-circle-outline" },
                              wrong_item:   { label: "รายการไม่ตรง",   color: "#d97706", icon: "mdi:swap-horizontal" },
                              partial:      { label: "ได้รับบางส่วน",  color: "#d97706", icon: "mdi:alert-circle-outline" },
                              not_received: { label: "ไม่รับ",          color: "#7c3aed", icon: "mdi:minus-circle-outline" },
                            };
                            return items.length === 0
                              ? <span style={{ color:"#94a3b8", fontSize:13 }}>ไม่มีข้อมูลรายการ</span>
                              : items.map((item, i) => {
                                const ck3 = `${item.uniform_type_id}__${JSON.stringify(item.size ?? "")}__${item.name ?? ""}`;
                                const ck2 = `${item.uniform_type_id}__${JSON.stringify(item.size ?? "")}`;
                                const cond = condMap?.[ck3] ?? condMap?.[ck2] ?? condMap?.[item.uniform_type_id];
                                const meta = cond ? ITEM_COND[cond.item_condition] : null;
                                return (
                                  <div key={i} className="sdExpandItem" style={{ alignItems: "center" }}>
                                    <span className="sdExpandDot" />
                                    <span className="sdExpandName">{item.name}</span>
                                    {item.education_level && <span className="sdExpandLevel">{item.education_level}</span>}
                                    <span className="sdExpandQty">{item.quantity} ตัว</span>
                                    {meta && (
                                      <>
                                        <span style={{
                                          display: "inline-flex", alignItems: "center", gap: 4,
                                          fontSize: 11, fontWeight: 600, color: meta.color,
                                          marginLeft: 8,
                                        }}>
                                          <Icon icon={meta.icon} width={13} />
                                          {meta.label}
                                        </span>
                                        {cond.reason && (
                                          <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "1px 7px", marginLeft: 4, whiteSpace: "nowrap" }}>
                                            {cond.reason}
                                          </span>
                                        )}
                                        {cond.note && (
                                          <span style={{ fontSize: 10, color: "#78350f", background: "#fffbeb", borderRadius: 6, padding: "1px 7px", marginLeft: 4 }}>
                                            {cond.note}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              });
                          })()}
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
 
      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="sdPagination">
          <button
            className="sdPageBtn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹ ก่อนหน้า
          </button>
          <div className="sdPageNumbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`sdPageNum ${currentPage === page ? "sdPageNumActive" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            className="sdPageBtn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            ถัดไป ›
          </button>
          <span className="sdPageInfo">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} จาก {filtered.length} รายการ
          </span>
        </div>
      )}

      {/* ── Popup: ดูรูปภาพหลักฐาน ── */}
      {imagePopup && (
        <div className="sdOverlay" onClick={() => setImagePopup(null)}>
          <div className="sdImagePopup" onClick={e => e.stopPropagation()}>
            <button className="sdImagePopupClose" onClick={() => setImagePopup(null)}>
              <Icon icon="mdi:close" width="18" />
            </button>
            <img
              className="sdImagePopupImg"
              src={imagePopup.src}
              alt={`หลักฐานการบริจาคจาก ${imagePopup.name}`}
            />
            {imagePopup.name && (
              <div className="sdImagePopupCaption">
                หลักฐานการบริจาคจาก {imagePopup.name}
              </div>
            )}
          </div>
        </div>
      )}

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
            <div className="sdPopupActions" style={{ justifyContent:"center" }}>
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
              {verifyPopup.delivery_method === "market_purchase" && (
                <span style={{ marginLeft:8, fontSize:11, color:"#5285E8", background:"#eff6ff", padding:"2px 8px", borderRadius:12 }}>
                  ซื้อเพื่อบริจาค
                </span>
              )}
            </div>
 
            {isOverdue(verifyPopup.created_at) && verifyPopup.delivery_method === "parcel" && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 12px", marginBottom:14, fontSize:12, color:"#92400e" }}>
                <Icon icon="mdi:clock-alert-outline" width={16} color="#d97706" />
                <span>รายการนี้ผ่านมาเกิน 7 วันแล้ว — แอดมินจะเข้ามาตรวจสอบและดำเนินการให้ หากโรงเรียนได้รับของแล้วสามารถยืนยันได้เลยค่ะ</span>
              </div>
            )}
 
            {(() => {
              const snapItems = parseItems(verifyPopup.items_snapshot);
              const allChecked = snapItems.length > 0 && snapItems.every(it => checkedSet.has(itemKey(it)));
              const resolvedConditions = Object.fromEntries(
                snapItems.filter(it => checkedSet.has(itemKey(it)))
                  .map(it => [itemKey(it), resolveItemCond(itemKey(it))])
              );
              const overallCond = checkedSet.size > 0 ? deriveOverallCondition(resolvedConditions) : null;
              const COND_OPTS = [
                { value: "usable",  label: "ใช้งานได้", icon: "mdi:check-circle",    color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
                { value: "damaged", label: "เสียหาย",   icon: "mdi:alert-circle",    color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
                { value: "issue",   label: "รายการไม่ตรง", icon: "mdi:swap-horizontal", color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
              ];
              const RESULT_META = {
                usable:     { label: "ใช้งานได้",    icon: "mdi:check-circle-outline",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
                wrong_item: { label: "รายการไม่ตรง", icon: "mdi:swap-horizontal-circle", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
                damaged:    { label: "เสียหาย",      icon: "mdi:close-circle-outline",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
              };
              const resultMeta = overallCond ? RESULT_META[overallCond] : null;
              return (
                <>
                  {/* รายการชุดนักเรียน */}
                  <div className="sdVerifySection">
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                      <Icon icon="mdi:tshirt-crew-outline" width="16" color="#2563eb" />
                      <span className="sdVerifyLabel" style={{ margin:0 }}>รายการชุดนักเรียน</span>
                      <span style={{ fontSize:12, fontWeight:600, color:"#2563eb", background:"#eff6ff", padding:"1px 8px", borderRadius:20 }}>{snapItems.reduce((s,it)=>s+it.quantity,0)} ชิ้น</span>
                      <label style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, cursor:"pointer", userSelect:"none", padding:"3px 10px", borderRadius:20, background: allChecked ? "#dcfce7" : "#f3f4f6", border:`1.5px solid ${allChecked ? "#86efac" : "#d1d5db"}` }}>
                        <input type="checkbox" checked={allChecked}
                          onChange={() => {
                            const allKeys = snapItems.map(itemKey);
                            if (allChecked) {
                              setCheckedSet(new Set());
                              setItemConditions({});
                              setItemReasons({});
                            } else {
                              setCheckedSet(new Set(allKeys));
                              setItemConditions(prev => Object.fromEntries(allKeys.map(k => [k, prev[k] || "usable"])));
                            }
                          }}
                          style={{ width:14, height:14, accentColor:"#16a34a", cursor:"pointer" }}
                        />
                        <span style={{ fontSize:11, fontWeight:600, color: allChecked ? "#16a34a" : "#6b7280", whiteSpace:"nowrap" }}>รับครบทุกรายการ</span>
                      </label>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {snapItems.map(it => {
                        const uid = itemKey(it);
                        const isChecked = checkedSet.has(uid);
                        const cond = itemConditions[uid] || "usable";
                        const activeMeta = COND_OPTS.find(o => o.value === cond) || COND_OPTS[0];
                        return (
                          <div key={uid}>
                            <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background: isChecked ? "#f0fdf4" : "#f8fafc", borderRadius: isChecked ? "10px 10px 0 0" : 10, padding:"8px 12px", border:`1.5px solid ${isChecked ? "#86efac" : "#e2e8f0"}`, cursor:"pointer" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <input type="checkbox" checked={isChecked}
                                  onChange={() => {
                                    setCheckedSet(prev => {
                                      const next = new Set(prev);
                                      if (next.has(uid)) {
                                        next.delete(uid);
                                        setItemConditions(p => { const n={...p}; delete n[uid]; return n; });
                                        setItemReasons(p => { const n={...p}; delete n[uid]; return n; });
                                        setItemNotes(p => { const n={...p}; delete n[uid]; return n; });
                                      } else {
                                        next.add(uid);
                                        setItemConditions(p => ({ ...p, [uid]: p[uid] || "usable" }));
                                      }
                                      return next;
                                    });
                                  }}
                                  style={{ width:15, height:15, accentColor:"#16a34a", cursor:"pointer", flexShrink:0 }}
                                />
                                <span style={{ fontSize:13, color:"#1e293b" }}>{it.name}</span>
                              </div>
                              <span style={{ fontSize:11, fontWeight:600, color:"#1d4ed8", background:"#dbeafe", padding:"2px 8px", borderRadius:20 }}>{it.quantity} ชิ้น</span>
                            </label>
                            {isChecked && (
                              <div style={{ background:"#fff", border:`1.5px solid ${activeMeta.border}`, borderTop:"none", borderRadius:"0 0 10px 10px", padding:"10px 12px" }}>
                                <div style={{ fontSize:11, color:"#6b7280", marginBottom:6 }}>ประเมินสภาพ</div>
                                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
                                  {COND_OPTS.map(opt => (
                                    <button key={opt.value} type="button"
                                      onClick={() => {
                                        setItemConditions(p => ({ ...p, [uid]: opt.value }));
                                        if (opt.value !== "issue") setItemReasons(p => { const n={...p}; delete n[uid]; return n; });
                                      }}
                                      style={{ padding:"6px 4px", borderRadius:8, textAlign:"center", cursor:"pointer", border:`1.5px solid ${cond===opt.value ? opt.border : "#e5e7eb"}`, background: cond===opt.value ? opt.bg : "#f9fafb", color: cond===opt.value ? opt.color : "#9ca3af", fontSize:10, fontWeight: cond===opt.value ? 700 : 500, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                                      <Icon icon={opt.icon} width="15" />
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                                {cond === "issue" && (
                                  <div style={{ marginTop:8, padding:"8px 10px", background:"#fffbeb", border:"1px dashed #fcd34d", borderRadius:8 }}>
                                    <div style={{ fontSize:10, color:"#92400e", fontWeight:600, marginBottom:6 }}>สาเหตุ <span style={{ color:"#dc2626" }}>*</span></div>
                                    <div style={{ display:"flex", gap:5, marginBottom:8 }}>
                                      {["ผิดไซส์", "ผิดประเภท"].map(r => {
                                        const selected = (itemReasons[uid] || []).includes(r);
                                        return (
                                          <button key={r} type="button"
                                            onClick={() => setItemReasons(p => {
                                              const cur = p[uid] || [];
                                              return { ...p, [uid]: cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r] };
                                            })}
                                            style={{ padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", border:`1.5px solid ${selected ? "#d97706" : "#e5e7eb"}`, background: selected ? "#fef3c7" : "#fff", color: selected ? "#92400e" : "#9ca3af" }}
                                          >{r}</button>
                                        );
                                      })}
                                    </div>
                                    <textarea
                                      rows={2}
                                      maxLength={150}
                                      placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ) เช่น ส่งบิกินี่มาแทนเสื้อนักเรียน"
                                      value={itemNotes[uid] || ""}
                                      onChange={e => setItemNotes(p => ({ ...p, [uid]: e.target.value }))}
                                      onFocus={e => { e.target.style.outline = "none"; e.target.style.boxShadow = "none"; }}
                                      style={{ width:"100%", fontSize:11, padding:"6px 8px", borderRadius:6, border:"1px solid #fcd34d", background:"#fff", resize:"none", outline:"none", boxShadow:"none", boxSizing:"border-box", color:"#1e293b", WebkitAppearance:"none" }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ผลการประเมิน */}
                  {resultMeta && (
                    <div className="sdVerifySection">
                      <label className="sdVerifyLabel"><Icon icon="mdi:clipboard-check-outline" width="16" />ผลการประเมิน</label>
                      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, background:resultMeta.bg, border:`1px solid ${resultMeta.border}` }}>
                        <Icon icon={resultMeta.icon} width="22" color={resultMeta.color} style={{ flexShrink:0 }} />
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:resultMeta.color }}>{resultMeta.label}</div>
                          <div style={{ fontSize:11, color:resultMeta.color, opacity:.8, marginTop:2, display:"flex", alignItems:"center", gap:4 }}>
                            <Icon icon={overallCond==="wrong_item" ? "mdi:close-circle-outline" : "mdi:certificate-outline"} width="13" />
                            {overallCond==="wrong_item" ? "ไม่ออกใบเกียรติบัตร" : "ผู้บริจาคจะได้รับใบเกียรติบัตร"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ข้อความขอบคุณ */}
                  <div className="sdVerifySection">
                    <label className="sdVerifyLabel">
                      <Icon icon="mdi:message-text-outline" width="16" />
                      {overallCond === "wrong_item" ? "ข้อความแจ้งผู้บริจาค" : "ข้อความขอบคุณ (ส่งให้ผู้บริจาคพร้อมใบประกาศ)"}
                    </label>
                    <textarea className="sdVerifyTextarea" rows={4} value={thankMsg} onChange={e => setThankMsg(e.target.value)} />
                  </div>

                  <div className="sdVerifyNote" style={{ background:"#eff6ff", border:"0.5px solid #bfdbfe", borderRadius:"8px", padding:"10px 12px", fontSize:"12px", color:"#1e40af", display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"16px" }}>
                    <Icon icon="mdi:certificate-outline" width="16" style={{ flexShrink:0, marginTop:"1px" }} />
                    <span>เมื่อยืนยัน ระบบจะ<strong> ออกใบประกาศนียบัตรอัตโนมัติ</strong> และส่ง notification พร้อมข้อความขอบคุณให้ผู้บริจาคทันที</span>
                  </div>

                  <div className="sdPopupActions">
                    <button className="sdPopupBtnGhost" onClick={() => setVerifyPopup(null)}>ยกเลิก</button>
                    <button className="sdPopupBtnPrimary" onClick={handleVerify} disabled={verifying}>
                      {verifying ? "กำลังบันทึก..." : "ยืนยัน"}
                    </button>
                  </div>
                </>
              );
            })()}
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
              <MiniCalendar markedDate={apptPopup.donation_date} />
              <div className="sdSchedule">
                <div className="sdScheduleTitle">
                  <Icon icon="mdi:clock-outline" width="16" />กำหนดการ
                </div>
                <div className="sdScheduleCard">
                  <div className="sdScheduleDate">
                    <Icon icon="mdi:calendar" width="15" color="#2563eb" />
                    <span>{formatDate(apptPopup.donation_date)}</span>
                  </div>
                  {apptPopup.donation_time && (
                    <div className="sdScheduleTime">
                      <Icon icon="mdi:clock" width="15" color="#7c3aed" />
                      <span>เวลา {String(apptPopup.donation_time).slice(0,5)} น.</span>
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
                      รายการที่จะนำมาส่ง ({apptPopup.quantity} ตัว)
                    </div>
                    {parseItems(apptPopup.items_snapshot).map((item,i) => (
                      <div key={i} className="sdScheduleItem">
                        <span className="sdScheduleItemDot" />
                        <span>{item.name}</span>
                        <span className="sdScheduleItemQty">{item.quantity} ตัว</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sdScheduleStatus">
                  {apptPopup.is_overdue ? (
                    <span className="sdBadge" style={{ color: "#dc2626", background: "#fee2e2" }}>
                      <Icon icon="mdi:clock-alert-outline" width="13" />
                      เกินกำหนดยืนยันรับ
                    </span>
                  ) : (
                    <span className="sdBadge" style={{ color:STATUS_META[apptPopup.status]?.color, background:STATUS_META[apptPopup.status]?.bg }}>
                      {apptPopup.status === "approved" && <Icon icon="mdi:check" width="13" />}
                      {STATUS_META[apptPopup.status]?.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
 
            <div className="sdPopupActions">
              <button className="sdPopupBtnGhost" onClick={() => setApptPopup(null)}>ปิด</button>
              {apptPopup.status === "pending" && (
                apptPopup.is_overdue ? (
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
                ) : (
                  <button className="sdPopupBtnPrimary" onClick={() => { setApptPopup(null); openVerifyPopup(apptPopup); }}>
                    ยืนยันรับ
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}