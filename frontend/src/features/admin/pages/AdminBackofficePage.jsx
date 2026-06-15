import { useEffect, useMemo, useRef, useState } from "react";
import * as svc from "../services/admin.service.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import { formatBaht, formatNumber } from "../utils/format.js";
import "../styles/admin.css";
import "../styles/adminPages.css";
import { Icon } from "@iconify/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

/* ── Time filter options ────────────────────────────────────── */
const TIME_FILTERS = [
  { v: "today",   l: "วันนี้",   icon: "mdi:weather-sunny" },
  { v: "month",   l: "เดือนนี้", icon: "mdi:calendar-month" },
  { v: "3months", l: "3 เดือน",  icon: "mdi:calendar-range" },
  { v: "6months", l: "6 เดือน",  icon: "mdi:calendar-range" },
  { v: "year",    l: "1 ปี",     icon: "mdi:calendar-year" },
];

const PERIOD_LABEL_MAP = {
  today: "วันนี้",
  month: "เดือนนี้",
  "3months": "ย้อนหลัง 3 เดือน",
  "6months": "ย้อนหลัง 6 เดือน",
  year: "ย้อนหลัง 1 ปี",
  custom: "กำหนดเอง",
};

/* ── Chart type options (bar only) ─────────────────────────── */

const OVERVIEW_CARDS = [
  { key: "total_users",     pctKey: "pct_users",     label: "ยอดผู้ใช้งานรวม",      icon: "material-symbols:person-rounded", bg: "#bce3f6" },
  { key: "total_schools",   pctKey: "pct_schools",   label: "โรงเรียน",              icon: "teenyicons:school-outline",       bg: "#bdf2ce" },
  { key: "total_donations", pctKey: "pct_donations", label: "โครงการขอบริจาค",      icon: "mdi:hand-heart-outline",          bg: "#ffe2c2" },
  { key: "total_products",  pctKey: "pct_products",  label: "รายการสินค้า",          icon: "icon-park-outline:ad-product",    bg: "#fff1be" },
  { key: "total_orders",    pctKey: "pct_orders",    label: "รายการสั่งซื้อสินค้า", icon: "lets-icons:order",                bg: "#ffd6d6" },
];

const PROJECT_STATUS_META = {
  open: {
    label: "เปิดอยู่",
    title: "โครงการที่เปิดอยู่",
    empty: "ไม่มีโครงการที่เปิดอยู่",
    icon: "mdi:folder-open-outline",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  closed: {
    label: "ปิดแล้ว",
    title: "โครงการที่ปิดแล้ว",
    empty: "ไม่มีโครงการที่ปิดแล้ว",
    icon: "mdi:folder-check-outline",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fed7aa",
  },
};

function pctLabel(pct) {
  if (pct === null || pct === undefined) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% จากเดือนที่แล้ว`;
}

// ── Demand Insight helpers ──────────────────────────────────────────────────
// สีประจำภาค — รวม yellow สำหรับอีสาน
const REGION_STYLE = {
  "เหนือ":      { bg: "#ecfdf5", color: "#059669", border: "#6ee7b7" },
  "อีสาน":      { bg: "#fefce8", color: "#b45309", border: "#fcd34d" }, // เหลือง
  "กลาง":       { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
  "ตะวันออก":   { bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
  "ตะวันตก":    { bg: "#fff7ed", color: "#d97706", border: "#fbbf24" }, // ส้มเหลือง
  "ใต้":        { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc" },
  "อื่นๆ":      { bg: "#f8fafc", color: "#64748b", border: "#cbd5e1" },
};

function fmtProjectDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function normalizeProvinceName(name) {
  return String(name || "").replace(/^จังหวัด/, "").trim().toLowerCase();
}

function provinceMatchesProject(provinceName, schoolProvince) {
  const a = normalizeProvinceName(provinceName);
  const b = normalizeProvinceName(schoolProvince);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function getProjectsForProvince(projects, provinceName) {
  return (projects || []).filter((pr) => provinceMatchesProject(provinceName, pr.school_province));
}

function projectProgress(project) {
  const needed = Number(project.total_needed || 0);
  if (needed <= 0) return 0;
  return Math.min(100, Math.round((Number(project.total_fulfilled || 0) / needed) * 100));
}

export default function AdminBackofficePage() {
  const [stats, setStats] = useState({
    total_users: 0, total_schools: 0, total_donations: 0, total_products: 0, total_orders: 0,
    pct_users: null, pct_schools: null, pct_donations: null, pct_products: null, pct_orders: null,
  });
  const [revenue, setRevenue] = useState({
    platform_revenue: 0, order_volume: 0, fee_revenue: 0,
    fee_15_revenue: 0, fee_min_revenue: 0,
    fee_15_count: 0, fee_min_count: 0, fee_count: 0,
    pct_platform_revenue: null, pct_fee_15: null, pct_fee_min: null,
  });
  const [chart, setChart] = useState({ months: [], sales: [], fees: [], donation_open_pct: 0 });
  const [tasks, setTasks] = useState({ pending_schools: 0, pending_shipments: 0, pending_donations: 0 });
  const [demand, setDemand] = useState({
    top3_types: [], province_demand: [], region_demand: [], open_projects: 0,
    completed_stats: { closed_projects: 0, school_count: 0, total_uniforms: 0, students_helped: 0 },
  });
  const [period, setPeriod] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [err, setErr] = useState("");
  const [projectModalStatus, setProjectModalStatus] = useState(null);
  const [projectLists, setProjectLists] = useState({ open: null, closed: null });
  const [projectListLoading, setProjectListLoading] = useState(false);
  const [projectListErr, setProjectListErr] = useState("");
  const [expandedProvince, setExpandedProvince] = useState(null);
  const [campaignModalProvince, setCampaignModalProvince] = useState(null);
  const [provinceRegionFilter, setProvinceRegionFilter] = useState("all");
  const [provinceProjectsModal, setProvinceProjectsModal] = useState(null);
  const [allOpenProjects, setAllOpenProjects] = useState([]);
  const provinceCardRefs = useRef({});
  const provinceListRef = useRef(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  // โหลด overview / tasks ครั้งแรก
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const [ov, tk, dm, openProj] = await Promise.all([
          svc.getOverview(),
          svc.getPendingTasks(),
          svc.getDemandInsight(),
          svc.listProjectStatusProjects("open"),
        ]);
        if (cancelled) return;
        setStats({
          total_users:     Number(ov?.total_users     || 0),
          total_schools:   Number(ov?.total_schools   || 0),
          total_donations: Number(ov?.total_donations || 0),
          total_products:  Number(ov?.total_products  || 0),
          total_orders:    Number(ov?.total_orders    || 0),
          pct_users:       ov?.pct_users     ?? null,
          pct_schools:     ov?.pct_schools   ?? null,
          pct_donations:   ov?.pct_donations ?? null,
          pct_products:    ov?.pct_products  ?? null,
          pct_orders:      ov?.pct_orders    ?? null,
        });
        setTasks({
          pending_schools: Number(tk?.pending_schools || 0),
          pending_shipments: Number(tk?.pending_shipments || 0),
          pending_donations: Number(tk?.pending_donations || 0),
        });
        setDemand(dm || { top3_types: [], open_projects: 0 });
        setAllOpenProjects(Array.isArray(openProj?.rows) ? openProj.rows : []);
      } catch (e) {
        if (!cancelled) setErr(e?.data?.message || e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // โหลด revenue และ chart ตาม period ที่เลือก
  useEffect(() => {
    if (period === "custom" && (!startDate || !endDate)) return;
    let cancelled = false;
    const params = {
      period,
      start_date: period === "custom" ? startDate : null,
      end_date: period === "custom" ? endDate : null,
    };
    setChartLoading(true);
    Promise.all([
      svc.getRevenue(params),
      svc.getChart(params),
    ])
      .then(([r, ch]) => {
        if (cancelled) return;
        setRevenue({
          platform_revenue:     Number(r?.platform_revenue  || 0),
          order_volume:         Number(r?.order_volume      || 0),
          fee_revenue:          Number(r?.fee_revenue       || 0),
          fee_15_revenue:       Number(r?.fee_15_revenue    || 0),
          fee_min_revenue:      Number(r?.fee_min_revenue   || 0),
          fee_15_count:         Number(r?.fee_15_count      || 0),
          fee_min_count:        Number(r?.fee_min_count     || 0),
          fee_count:            Number(r?.fee_count         || 0),
          pct_platform_revenue: r?.pct_platform_revenue ?? null,
          pct_fee_15:           r?.pct_fee_15           ?? null,
          pct_fee_min:          r?.pct_fee_min          ?? null,
        });
        setChart(ch || {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => { cancelled = true; };
  }, [period, startDate, endDate]);

  const chartRangeLabel = period === "custom" && startDate && endDate
    ? `${startDate} → ${endDate}`
    : PERIOD_LABEL_MAP[period] || "เดือนนี้";

  const chartData = useMemo(
    () => (chart.months || []).map((m, i) => ({
      month: m,
      sales: Number(chart.sales?.[i] || 0),
      fees: Number(chart.fees?.[i] || 0),
    })),
    [chart],
  );

  const projectStatusCounts = useMemo(() => {
    const open = Number(demand?.open_projects || 0);
    const closed = Number(demand?.completed_stats?.closed_projects || 0);
    return { open, closed, total: open + closed };
  }, [demand]);

  const donationData = useMemo(() => {
    const open = projectStatusCounts.total > 0
      ? Math.round((projectStatusCounts.open / projectStatusCounts.total) * 100)
      : 0;
    return [
      { name: "เปิดอยู่", value: open, count: projectStatusCounts.open, color: "#22c55e" },
      { name: "ปิดแล้ว", value: projectStatusCounts.total > 0 ? 100 - open : 0, count: projectStatusCounts.closed, color: "#f59e0b" },
    ];
  }, [projectStatusCounts]);

  const regionGroups = useMemo(() => {
    const all = demand.province_demand || [];
    const map = {};
    all.forEach((p) => {
      const r = p.region || "อื่นๆ";
      if (!map[r]) map[r] = { region: r, count: 0, still_needed: 0 };
      map[r].count += 1;
      map[r].still_needed += p.still_needed || 0;
    });
    return Object.values(map).sort((a, b) => b.still_needed - a.still_needed);
  }, [demand.province_demand]);

  const displayedProvinces = useMemo(() => {
    const sorted = [...(demand.province_demand || [])].sort((a, b) => (b.still_needed || 0) - (a.still_needed || 0));
    if (provinceRegionFilter === "all") return sorted;
    return sorted.filter((p) => (p.region || "อื่นๆ") === provinceRegionFilter);
  }, [demand.province_demand, provinceRegionFilter]);

  const provinceListMaxNeeded = useMemo(
    () => Math.max(...displayedProvinces.map((p) => p.still_needed || 0), 1),
    [displayedProvinces],
  );

  const scrollProvinceCardIntoView = (provinceName) => {
    const card = provinceCardRefs.current[provinceName];
    const list = provinceListRef.current;
    if (!card || !list) return;

    const listRect = list.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    let nextScroll = list.scrollTop;

    if (cardRect.top < listRect.top + 8) {
      nextScroll += cardRect.top - listRect.top - 8;
    }
    if (cardRect.bottom > listRect.bottom - 8) {
      nextScroll += cardRect.bottom - listRect.bottom + 12;
    }

    if (nextScroll !== list.scrollTop) {
      list.scrollTo({ top: nextScroll, behavior: "smooth" });
    }
  };

  const toggleProvinceExpand = (provinceName) => {
    const willExpand = expandedProvince !== provinceName;
    setExpandedProvince(willExpand ? provinceName : null);
    if (!willExpand) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollProvinceCardIntoView(provinceName));
    });
  };

  const openProjectStatusModal = async (status) => {
    setProjectModalStatus(status);
    setProjectListErr("");
    if (projectLists[status]) return;
    setProjectListLoading(true);
    try {
      const data = await svc.listProjectStatusProjects(status);
      setProjectLists((prev) => ({
        ...prev,
        [status]: Array.isArray(data?.rows) ? data.rows : [],
      }));
    } catch (e) {
      setProjectListErr(e?.data?.message || e.message || "โหลดรายการโครงการไม่สำเร็จ");
    } finally {
      setProjectListLoading(false);
    }
  };

  return (
    <div className="boPage">
      <div className="boTop">
        <div className="boTitle">Dashboard</div>
        <div className="boAdmin">
          <NotificationBell />
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      <div className="boPageInner">
        {/* date */}
        <div className="admDateRight">{dateStr} · {timeStr}</div>

        {/* ===== System Overview ===== */}
        <div className="admCardTitle" style={{ marginBottom: 12 }}>System Overview</div>

        {loading && <div className="boMuted">กำลังโหลด…</div>}
        {err && <div className="boError">{err}</div>}

        {!loading && !err && (
          <div className="boStatGrid5" style={{ marginBottom: 22 }}>
            {OVERVIEW_CARDS.map((c) => {
              const pct = stats[c.pctKey];
              const label = pctLabel(pct);
              const isUp = pct !== null && pct >= 0;
              return (
                <div key={c.key} className="boStatColorCard" style={{ background: c.bg }}>
                  <div className="boStatColorCard__label">{c.label}</div>
                  <div className="boStatColorCard__iconWrap">
                    <Icon icon={c.icon} width="32" height="32" />
                  </div>
                  <div className="boStatColorCard__value">{formatNumber(stats[c.key])}</div>
                  {label && (
                    <div className="boStatColorCard__change" style={{ color: isUp ? "#16a34a" : "#dc2626" }}>
                      {label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== Advanced Time Filter ===== */}
        <AdminTimeFilter
          period={period}
          showPicker={showPicker}
          startDate={startDate}
          endDate={endDate}
          onSelectPeriod={(v) => { setPeriod(v); setShowPicker(false); }}
          onTogglePicker={() => { setShowPicker(!showPicker); if (!showPicker) setPeriod("custom"); }}
          onChangeStart={setStartDate}
          onChangeEnd={setEndDate}
        />

        {/* ===== Revenue cards ===== */}
        <div className="boRevGrid3">
          {/* Card 1: รายได้รวม — ธีม gradient เดียวกับ header */}
          <div className="boRevCard" style={{ background: "linear-gradient(90deg,#1d4ed8 0%,#5285e8 55%,#7dd3fc 100%)", border: "none", position: "relative", overflow: "hidden" }}>
            {/* decorative circle */}
            <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "absolute", right: 20, bottom: -30, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon icon="mdi:currency-usd" style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }} />
              <div className="boRevCard__label" style={{ color: "rgba(255,255,255,0.82)", marginBottom: 0 }}>รายได้ค่าธรรมเนียมรวม</div>
            </div>
            <div className="boRevCard__value" style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{formatBaht(revenue.platform_revenue)}</div>
            <div className="boRevCard__sub" style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginBottom: 2 }}>ผลรวมค่าธรรมเนียมที่เก็บจากผู้ขายทั้งหมด</div>
            {revenue.pct_platform_revenue !== null && (
              <div className="boRevCard__sub" style={{ color: revenue.pct_platform_revenue >= 0 ? "#86efac" : "#fca5a5" }}>
                {pctLabel(revenue.pct_platform_revenue)}
              </div>
            )}
          </div>

          {/* Card 2: ค่าธรรมเนียม 15% (ออเดอร์ที่ยอด > ฿133.33 → 15% เกินขั้นต่ำ) */}
          <div className="boRevCard" style={{ borderTop: "3px solid #f59e0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>15%</span>
              <div className="boRevCard__label" style={{ marginBottom: 0 }}>ค่าธรรมเนียม</div>
            </div>
            <div className="boRevCard__value boRevCard__value--amber">{formatBaht(revenue.fee_15_revenue)}</div>
            <div className="boRevCard__sub boRevCard__sub--muted">{formatNumber(revenue.fee_15_count)} รายการ · ยอด &gt; ฿133.33</div>
            {revenue.pct_fee_15 !== null && (
              <div className="boRevCard__sub" style={{ color: revenue.pct_fee_15 >= 0 ? "#16a34a" : "#dc2626", marginTop: 2 }}>
                {pctLabel(revenue.pct_fee_15)}
              </div>
            )}
          </div>

          {/* Card 3: ค่าธรรมเนียมขั้นต่ำ ฿20 (ออเดอร์ที่ยอด ≤ ฿133.33 → 15% < ฿20 → ใช้ขั้นต่ำ) */}
          <div className="boRevCard" style={{ borderTop: "3px solid #f59e0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>฿20 min</span>
              <div className="boRevCard__label" style={{ marginBottom: 0 }}>ค่าธรรมเนียมขั้นต่ำ</div>
            </div>
            <div className="boRevCard__value boRevCard__value--amber">{formatBaht(revenue.fee_min_revenue)}</div>
            <div className="boRevCard__sub boRevCard__sub--muted">{formatNumber(revenue.fee_min_count)} รายการ · ยอด ≤ ฿133.33</div>
            {revenue.pct_fee_min !== null && (
              <div className="boRevCard__sub" style={{ color: revenue.pct_fee_min >= 0 ? "#16a34a" : "#dc2626", marginTop: 2 }}>
                {pctLabel(revenue.pct_fee_min)}
              </div>
            )}
          </div>
        </div>

        {/* ===== Chart + Pending tasks ===== */}
        <div className="boChartRow">
          <div className="boChartCard">
            {/* Chart header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div className="boChartCard__title" style={{ marginBottom: 2 }}>
                  รายได้ค่าธรรมเนียม — {chartRangeLabel}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>ค่าธรรมเนียมที่เก็บจากผู้ขาย (15% ขั้นต่ำ ฿20/ออเดอร์)</div>
              </div>
            </div>
            <div style={{ width: "100%", height: 280, position: "relative" }}>
              {chartLoading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.62)", zIndex: 2, color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>
                  <Icon icon="mdi:loading" style={{ marginRight: 6, animation: "spin 0.8s linear infinite" }} /> กำลังอัปเดตกราฟ
                </div>
              )}
              {chartData.some((row) => row.fees > 0) ? (
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barSize={28}>
                    <defs>
                      <linearGradient id="feeBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1d4ed8" stopOpacity={1} />
                        <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => v >= 1000 ? `฿${(v/1000).toFixed(1)}K` : `฿${v}`} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #bfdbfe", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", padding: "10px 14px" }}
                      formatter={(v) => [formatBaht(v), "ค่าธรรมเนียม"]}
                      labelStyle={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}
                      cursor={{ fill: "rgba(29,78,216,0.05)" }}
                    />
                    <Bar dataKey="fees" fill="url(#feeBarGrad)" radius={[6, 6, 0, 0]} name="fees" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", border: "1px dashed #cbd5e1", borderRadius: 12, background: "#f8fafc", gap: 6 }}>
                  <Icon icon="mdi:chart-bar" style={{ fontSize: 32 }} />
                  <strong style={{ color: "#64748b", fontSize: 13 }}>ไม่มีค่าธรรมเนียมในช่วงเวลานี้</strong>
                  <span style={{ fontSize: 12 }}>ลองเลือกช่วงเวลาอื่นเพื่อดูข้อมูล</span>
                </div>
              )}
            </div>
          </div>

          <div className="boPendingCard">
            <div className="boPendingCard__header">
              <div className="boPendingCard__title">รายการรอดำเนินงาน</div>
              <div className="boPendingCard__count">
                {tasks.pending_schools + tasks.pending_shipments + tasks.pending_donations} รายการ
              </div>
            </div>

            {tasks.pending_schools === 0 && tasks.pending_shipments === 0 && tasks.pending_donations === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: "16px 4px" }}>ไม่มีรายการรอดำเนินงาน</div>
            ) : (
              <>
                {tasks.pending_schools > 0 && (
                  <PendingItem
                    label="โรงเรียนรออนุมัติ"
                    count={tasks.pending_schools}
                    link="/admin/schools"
                    bg="#fff8d8"
                    labelColor="#92400e"
                    btnLabel="อนุมัติ"
                  />
                )}
                {tasks.pending_shipments > 0 && (
                  <PendingItem
                    label="รายการสินค้าค้างส่ง"
                    count={tasks.pending_shipments}
                    link="/admin/orders"
                    bg="#ffe2e2"
                    labelColor="#991b1b"
                    btnLabel="จัดการ"
                  />
                )}
                {tasks.pending_donations > 0 && (
                  <PendingItem
                    label="บริจาคไม่ถูกยืนยัน"
                    count={tasks.pending_donations}
                    link="/admin/donations"
                    bg="#ffe2e2"
                    labelColor="#991b1b"
                    btnLabel="จัดการ"
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ===== Demand Insight ===== */}
        {!loading && !err && (
          <>
            {/* ── Section header ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, marginTop: 8 }}>
              <div className="admCardTitle" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon icon="mdi:chart-timeline-variant-shimmer" style={{ color: "#6366f1", fontSize: 22 }} />
                Demand Insight
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {demand.open_projects > 0 && (
                  <span style={{ fontSize: 12, color: "#1d4ed8", background: "#dbeafe", borderRadius: 20, padding: "3px 12px", fontWeight: 600 }}>
                    {demand.open_projects} โครงการเปิดอยู่
                  </span>
                )}
              </div>
            </div>

            {/* ── Province + Donut + Completed — 2-col layout ── */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 8 }}>

              {/* LEFT — Province demand */}
              <div className="boDonutCard boProvinceDemand" style={{ margin: 0 }}>
                <div className="boProvinceDemand__header">
                  <div className="boProvinceDemand__iconWrap">
                    <Icon icon="mdi:map-marker-multiple" />
                  </div>
                  <div>
                    <div className="boProvinceDemand__title">พื้นที่ที่ต้องการชุดมากที่สุด</div>
                    <div className="boProvinceDemand__sub">เลือกภาค → เลือกจังหวัด → ดูโครงการที่เปิดอยู่</div>
                  </div>
                </div>

                {demand.region_demand.length > 0 && (
                  <div className="boProvinceDemand__regionGrid">
                    {demand.region_demand.map((r) => {
                      const rs = REGION_STYLE[r.region] || REGION_STYLE["อื่นๆ"];
                      return (
                        <div key={r.region} className="boProvinceDemand__regionStat" style={{ background: rs.bg, borderColor: rs.border }}>
                          <span style={{ color: rs.color }}>ภาค{r.region}</span>
                          <strong style={{ color: rs.color }}>{r.still_needed.toLocaleString()} <small>ชิ้น</small></strong>
                        </div>
                      );
                    })}
                  </div>
                )}

                {demand.province_demand.length === 0 ? (
                  <div className="boProvinceDemand__empty">ยังไม่มีข้อมูลจังหวัด</div>
                ) : (
                  <>
                    <div className="boProvinceDemand__filterLabel">
                      <Icon icon="mdi:filter-variant" />
                      เลือกภาคเพื่อดูจังหวัด
                    </div>
                    <div className="boProvinceDemand__filters" role="tablist" aria-label="กรองตามภาค">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={provinceRegionFilter === "all"}
                        className={`boProvinceDemand__filterBtn${provinceRegionFilter === "all" ? " is-active" : ""}`}
                        onClick={() => { setProvinceRegionFilter("all"); setExpandedProvince(null); }}
                      >
                        ทั้งประเทศ
                      </button>
                      {regionGroups.map((rg) => {
                        const rs = REGION_STYLE[rg.region] || REGION_STYLE["อื่นๆ"];
                        const active = provinceRegionFilter === rg.region;
                        return (
                          <button
                            key={rg.region}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`boProvinceDemand__filterBtn${active ? " is-active" : ""}`}
                            style={active ? { background: rs.bg, borderColor: rs.border, color: rs.color } : undefined}
                            onClick={() => { setProvinceRegionFilter(rg.region); setExpandedProvince(null); }}
                          >
                            ภาค{rg.region}
                            <span className="boProvinceDemand__filterCount">{rg.count}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="boProvinceDemand__listHint">
                      {provinceRegionFilter === "all"
                        ? `จังหวัดที่ขาดมากสุดทั่วประเทศ · ${displayedProvinces.length} จังหวัด`
                        : `จังหวัดในภาค${provinceRegionFilter} · ${displayedProvinces.length} จังหวัด`}
                    </div>

                    {displayedProvinces.length === 0 ? (
                      <div className="boProvinceDemand__empty">ไม่มีจังหวัดในภาคนี้</div>
                    ) : (
                      <div className="boProvinceDemand__list" ref={provinceListRef}>
                        {displayedProvinces.map((p, pi) => {
                          const rs = REGION_STYLE[p.region] || REGION_STYLE["อื่นๆ"];
                          const isExpanded = expandedProvince === p.province;
                          const barW = Math.round(((p.still_needed || 0) / provinceListMaxNeeded) * 100);
                          const provProjects = getProjectsForProvince(allOpenProjects, p.province);
                          const previewProjects = provProjects.slice(0, 2);

                          return (
                            <div
                              key={p.province}
                              ref={(el) => { provinceCardRefs.current[p.province] = el; }}
                              className={`boProvinceCard${isExpanded ? " is-expanded" : ""}`}
                            >
                              <button
                                type="button"
                                className="boProvinceCard__row"
                                aria-expanded={isExpanded}
                                onClick={() => toggleProvinceExpand(p.province)}
                              >
                                <span className={`boProvinceCard__rank${pi < 3 ? " is-top" : ""}`}>{pi + 1}</span>
                                <div className="boProvinceCard__main">
                                  <div className="boProvinceCard__titleRow">
                                    <span className="boProvinceCard__name">{p.province}</span>
                                    <span className="boProvinceCard__region" style={{ background: rs.bg, color: rs.color, borderColor: rs.border }}>
                                      ภาค{p.region}
                                    </span>
                                  </div>
                                  <div className="boProvinceCard__bar">
                                    <span style={{ width: `${barW}%`, background: rs.color }} />
                                  </div>
                                </div>
                                <div className="boProvinceCard__stat">
                                  <strong>{p.still_needed.toLocaleString()}</strong>
                                  <span>ชิ้นที่ยังขาด</span>
                                  {provProjects.length > 0 && (
                                    <em>{provProjects.length} โครงการเปิดอยู่</em>
                                  )}
                                </div>
                                <Icon icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"} className="boProvinceCard__chev" />
                              </button>

                              {isExpanded && (
                                <div className="boProvinceCard__detail">
                                  {p.top_items?.length > 0 && (
                                    <div className="boProvinceCard__section">
                                      <div className="boProvinceCard__sectionTitle">สิ่งของที่ขาดมาก</div>
                                      <div className="boProvinceCard__tags">
                                        {p.top_items.map((item, ii) => (
                                          <span key={ii} className={`boProvinceCard__tag${ii === 0 ? " is-primary" : ""}`}>
                                            {item.label}
                                            <b>{item.still_needed.toLocaleString()}</b>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="boProvinceCard__section">
                                    <div className="boProvinceCard__sectionTitle">
                                      <Icon icon="mdi:folder-open-outline" />
                                      โครงการที่เปิดอยู่
                                    </div>
                                    {provProjects.length === 0 ? (
                                      <p className="boProvinceCard__noProject">ยังไม่มีโครงการเปิดในจังหวัดนี้</p>
                                    ) : (
                                      <>
                                        <div className="boProvinceCard__projects">
                                          {previewProjects.map((pr) => {
                                            const prog = projectProgress(pr);
                                            return (
                                              <div key={pr.request_id} className="boProvinceCard__project">
                                                <div className="boProvinceCard__projectTop">
                                                  <div className="boProvinceCard__projectText">
                                                    <strong>{pr.request_title || "ไม่ระบุชื่อโครงการ"}</strong>
                                                    <span>{pr.school_name || "ไม่ระบุโรงเรียน"}</span>
                                                  </div>
                                                  <span className="boProvinceCard__projectPct">{prog}%</span>
                                                </div>
                                                <div className="boProvinceCard__projectBar">
                                                  <span style={{ width: `${prog}%` }} />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <button
                                          type="button"
                                          className="boProvinceCard__viewAll"
                                          onClick={() => setProvinceProjectsModal({ province: p, projects: provProjects })}
                                        >
                                          ดูโครงการทั้งหมด {provProjects.length} รายการ
                                          <Icon icon="mdi:arrow-right" />
                                        </button>
                                      </>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    className="boProvinceCard__campaign"
                                    onClick={() => setCampaignModalProvince(p)}
                                  >
                                    <Icon icon="mdi:bullhorn-outline" />
                                    สร้างแคมเปญช่วยเหลือ{p.province}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT — Donut (top) + Completed (bottom) stacked */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Donut card */}
                <div className="boDonutCard" style={{ margin: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon icon="mdi:chart-donut" style={{ color: "#16a34a", fontSize: 20 }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>สถานะโครงการขอรับบริจาค</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>ภาพรวมโครงการทั้งหมด</div>
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                    <div className="boDonutCard__inner">
                      <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={donationData} dataKey="value" innerRadius={40} outerRadius={62} paddingAngle={2}>
                              {donationData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip formatter={(v) => `${v}%`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="boDonutCard__legend">
                        {donationData.map((d) => (
                          <div key={d.name} className="boDonutCard__legendItem">
                            <span className="boDonutCard__legendDot" style={{ background: d.color }} />
                            <span className="boDonutCard__legendText">{d.name}</span>
                            <span className="boDonutCard__legendCount">{formatNumber(d.count)} โครงการ</span>
                            <span style={{ fontWeight: 800, fontSize: 20, color: d.color }}>{d.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="boProjectStatusGrid">
                      {["open", "closed"].map((status) => {
                        const meta = PROJECT_STATUS_META[status];
                        const count = projectStatusCounts[status];
                        return (
                          <button
                            key={status}
                            type="button"
                            className="boProjectStatusBtn"
                            onClick={() => openProjectStatusModal(status)}
                            style={{ "--status-color": meta.color, "--status-bg": meta.bg, "--status-border": meta.border }}
                          >
                            <span className="boProjectStatusBtn__icon">
                              <Icon icon={meta.icon} />
                            </span>
                            <span className="boProjectStatusBtn__body">
                              <span className="boProjectStatusBtn__label">{meta.label}</span>
                              <strong>{formatNumber(count)}</strong>
                            </span>
                            <span className="boProjectStatusBtn__view">
                              ดูรายการ <Icon icon="mdi:chevron-right" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Completed Projects card */}
                {!loading && !err && (
                  <div className="boDonutCard" style={{ margin: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fefce8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon icon="mdi:check-decagram" style={{ color: "#d97706", fontSize: 20 }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>โครงการที่สำเร็จแล้ว</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>ข้อมูลจริงจากโครงการที่ปิดแล้ว</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #f1f5f9" }}>
                      {[
                        { label: "โครงการที่สำเร็จ",  value: demand.completed_stats.closed_projects, icon: "mdi:folder-check-outline", unit: "โครงการ", accent: "#1d4ed8" },
                        { label: "โรงเรียนที่ได้รับ",  value: demand.completed_stats.school_count,    icon: "teenyicons:school-outline", unit: "แห่ง",    accent: "#0d9488" },
                        { label: "ชุดที่ส่งมอบแล้ว",   value: demand.completed_stats.total_uniforms,  icon: "mdi:tshirt-crew-outline",   unit: "ชิ้น",    accent: "#d97706" },
                        { label: "นักเรียนที่ได้รับ",   value: demand.completed_stats.students_helped, icon: "mdi:account-group-outline", unit: "คน",      accent: "#0284c7" },
                      ].map(({ label, value, icon, unit, accent }, idx, arr) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: idx < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: accent + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon icon={icon} style={{ color: accent, fontSize: 15 }} />
                            </div>
                            <span style={{ fontSize: 13, color: "#475569" }}>{label}</span>
                          </div>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: 20, color: accent }}>{formatNumber(value)}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>{unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {projectModalStatus && (
        <ProjectStatusModal
          status={projectModalStatus}
          projects={projectLists[projectModalStatus] || []}
          loading={projectListLoading}
          error={projectListErr}
          onRetry={() => openProjectStatusModal(projectModalStatus)}
          onClose={() => setProjectModalStatus(null)}
        />
      )}
      {campaignModalProvince && (
        <CampaignModal
          province={campaignModalProvince}
          onClose={() => setCampaignModalProvince(null)}
        />
      )}
      {provinceProjectsModal && (
        <ProvinceProjectsModal
          province={provinceProjectsModal.province}
          projects={provinceProjectsModal.projects}
          onClose={() => setProvinceProjectsModal(null)}
        />
      )}
    </div>
  );
}

/* ─── AdminTimeFilter component ─────────────────────────────────────────── */
function AdminTimeFilter({ period, showPicker, startDate, endDate, onSelectPeriod, onTogglePicker, onChangeStart, onChangeEnd }) {
  const activeLabel = period === "custom" && startDate && endDate
    ? `${startDate} → ${endDate}`
    : PERIOD_LABEL_MAP[period] || "เดือนนี้";

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 16,
      padding: "14px 18px",
      marginBottom: 18,
      boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
    }}>
      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        {/* icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon icon="mdi:clock-time-four-outline" style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>ช่วงเวลา</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>กรองข้อมูลรายได้ตามช่วงเวลาที่เลือก</div>
          </div>
        </div>

        {/* active period badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "5px 12px" }}>
          <Icon icon="mdi:calendar-check" style={{ color: "#1d4ed8", fontSize: 14 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>{activeLabel}</span>
        </div>
      </div>

      {/* filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {TIME_FILTERS.map((t) => {
          const isActive = period === t.v && !showPicker;
          return (
            <button
              key={t.v}
              type="button"
              onClick={() => onSelectPeriod(t.v)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: 20, border: "1.5px solid",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                transition: "all 0.15s ease",
                background: isActive ? "#1d4ed8" : "#f8fafc",
                color: isActive ? "#fff" : "#475569",
                borderColor: isActive ? "#1d4ed8" : "#e2e8f0",
                boxShadow: isActive ? "0 2px 8px rgba(29,78,216,0.22)" : "none",
                transform: isActive ? "translateY(-1px)" : "none",
              }}
            >
              <Icon icon={t.icon} style={{ fontSize: 13 }} />
              {t.l}
            </button>
          );
        })}
        {/* Custom range button */}
        <button
          type="button"
          onClick={onTogglePicker}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 20, border: "1.5px solid",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            transition: "all 0.15s ease",
            background: showPicker ? "#2563eb" : "#f8fafc",
            color: showPicker ? "#fff" : "#475569",
            borderColor: showPicker ? "#2563eb" : "#e2e8f0",
            boxShadow: showPicker ? "0 2px 8px rgba(37,99,235,0.22)" : "none",
            transform: showPicker ? "translateY(-1px)" : "none",
          }}
        >
          <Icon icon="mdi:calendar-edit" style={{ fontSize: 13 }} />
          กำหนดเอง
        </button>
      </div>

      {/* Custom date range picker */}
      {showPicker && (
        <div style={{
          marginTop: 12, padding: "12px 16px",
          background: "linear-gradient(135deg,#eff6ff,#f0f9ff)",
          borderRadius: 12, border: "1px solid #bfdbfe",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon icon="mdi:calendar-start" style={{ color: "#fff", fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>วันเริ่มต้น</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onChangeStart(e.target.value)}
                style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", fontFamily: "inherit", cursor: "pointer" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", paddingTop: 14 }}>
            <Icon icon="mdi:arrow-right" style={{ color: "#2563eb", fontSize: 18 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon icon="mdi:calendar-end" style={{ color: "#fff", fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>วันสิ้นสุด</div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onChangeEnd(e.target.value)}
                style={{ border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "5px 10px", fontSize: 13, color: "#1e293b", background: "#fff", fontFamily: "inherit", cursor: "pointer" }}
              />
            </div>
          </div>
          {startDate && endDate && (
            <div style={{ marginLeft: "auto", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon icon="mdi:check-circle" style={{ fontSize: 14 }} />
              {startDate} → {endDate}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PendingItem({ label, count, link, bg, labelColor, btnLabel }) {
  return (
    <div className="boPendingItem" style={{ background: bg }}>
      <div>
        <div className="boPendingItem__label" style={{ color: labelColor }}>{label}</div>
        <div className="boPendingItem__sub">{count} รายการ</div>
      </div>
      <a href={link} className="boPendingItem__btn">
        {btnLabel} <Icon icon="material-symbols:arrow-outward" />
      </a>
    </div>
  );
}

function ProvinceProjectsModal({ province, projects, onClose }) {
  const rs = REGION_STYLE[province.region] || REGION_STYLE["อื่นๆ"];

  return (
    <div className="boProjectModalOverlay" onClick={onClose}>
      <div className="boProjectModal boProvinceProjectsModal" onClick={(e) => e.stopPropagation()}>
        <div className="boProjectModal__header">
          <div className="boProjectModal__titleWrap">
            <div className="boProjectModal__icon" style={{ background: rs.bg, color: rs.color, borderColor: rs.border }}>
              <Icon icon="mdi:map-marker-radius" />
            </div>
            <div>
              <div className="boProjectModal__title">โครงการเปิดอยู่ · {province.province}</div>
              <div className="boProjectModal__sub">
                ภาค{province.region} · ขาด {province.still_needed.toLocaleString()} ชิ้น · {projects.length} โครงการ
              </div>
            </div>
          </div>
          <button type="button" className="boProjectModal__close" onClick={onClose} aria-label="ปิด">
            <Icon icon="mdi:close" />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="boProjectModal__state">ไม่มีโครงการที่เปิดอยู่ในจังหวัดนี้</div>
        ) : (
          <div className="boProjectModal__list">
            {projects.map((project) => {
              const progress = projectProgress(project);
              return (
                <div key={project.request_id} className="boProjectModalItem">
                  <div className="boProjectModalItem__thumb">
                    {project.request_image_url ? (
                      <img src={project.request_image_url} alt={project.request_title || "โครงการ"} />
                    ) : (
                      <Icon icon="mdi:image-off-outline" />
                    )}
                  </div>
                  <div className="boProjectModalItem__main">
                    <div className="boProjectModalItem__top">
                      <div>
                        <div className="boProjectModalItem__title">{project.request_title || "ไม่ระบุชื่อโครงการ"}</div>
                        <div className="boProjectModalItem__school">
                          <Icon icon="teenyicons:school-outline" />
                          {project.school_name || "ไม่ระบุโรงเรียน"}
                        </div>
                      </div>
                      <span className="boProjectModalItem__badge" style={{ background: "#f0fdf4", color: "#16a34a", borderColor: "#bbf7d0" }}>
                        {progress}%
                      </span>
                    </div>
                    <div className="boProjectModalItem__meta">
                      <span>เริ่ม {fmtProjectDate(project.start_date || project.created_at)}</span>
                      <span>{formatNumber(project.student_count)} นักเรียน</span>
                      <span>ส่งมอบ {formatNumber(project.total_fulfilled)} / {formatNumber(project.total_needed)} ชิ้น</span>
                    </div>
                    <div className="boProjectModalItem__bar">
                      <span style={{ width: `${progress}%`, background: "#16a34a" }} />
                    </div>
                  </div>
                  <a className="boProjectModalItem__link" href={`/projects/${project.request_id}`} target="_blank" rel="noreferrer">
                    เปิดดู
                    <Icon icon="mdi:open-in-new" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignModal({ province, onClose }) {
  const [title, setTitle] = useState(`แคมเปญช่วยเหลือ${province.province}`);
  const [msg, setMsg] = useState(
    `📣 จังหวัด${province.province} ต้องการชุดนักเรียนเพิ่มเติม ${province.still_needed.toLocaleString()} ชิ้น` +
    (province.top_items?.length
      ? `\n\nสิ่งของที่ขาดมากที่สุด:\n${province.top_items.map((it, i) => `${i + 1}. ${it.label} — ${it.still_needed.toLocaleString()} ชิ้น`).join("\n")}`
      : "") +
    `\n\nร่วมบริจาคเพื่อเด็กๆ ในพื้นที่นี้ได้เลย 💙`
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${title}\n\n${msg}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const items = province.top_items || [];

  return (
    <div className="boProjectModalOverlay" onClick={onClose}>
      <div className="boProjectModal" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0,maxWidth: 560 , display: "flex",
    flexDirection: "column"  }}>
        {/* Header */}
        <div className="boProjectModal__header" style={{ background: "linear-gradient(90deg,#1d4ed8,#3b82f6)", borderRadius: "12px 12px 0 0", padding: "16px 20px" }}>
          <div className="boProjectModal__titleWrap">
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon icon="mdi:bullhorn-outline" style={{ color: "#fff", fontSize: 20 }} />
            </div>
            <div>
              <div className="boProjectModal__title" style={{ color: "#fff" }}>สร้างแคมเปญกระตุ้นการบริจาค</div>
              <div className="boProjectModal__sub" style={{ color: "rgba(255,255,255,0.75)" }}>จังหวัด{province.province} · {province.still_needed.toLocaleString()} ชิ้นที่ยังขาด</div>
            </div>
          </div>
          <button type="button" className="boProjectModal__close" onClick={onClose} style={{ color: "#fff" }}>
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto",    // ✅ เพิ่ม
    flex: 1     }}>
          {/* Summary chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
              📍 {province.province} · ภาค{province.region}
            </span>
            <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
              🎽 ขาด {province.still_needed.toLocaleString()} ชิ้น
            </span>
          </div>

          {/* Item breakdown */}
          {items.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>สิ่งของที่ขาดมากที่สุด</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {items.map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: i === 0 ? "#dbeafe" : "#f8fafc", border: `1px solid ${i === 0 ? "#93c5fd" : "#e2e8f0"}`, borderRadius: 8, padding: "6px 12px" }}>
                    <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#1d4ed8" : "#475569" }}>{i === 0 ? "★ " : `${i+1}. `}{it.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#1d4ed8" : "#64748b" }}>{it.still_needed.toLocaleString()} ชิ้น</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campaign title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>ชื่อแคมเปญ</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {/* Campaign message */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>ข้อความแคมเปญ</label>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={7}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: copied ? "#16a34a" : "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} style={{ fontSize: 15 }} />
              {copied ? "คัดลอกแล้ว!" : "คัดลอกข้อความแคมเปญ"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "10px 20px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}
            >
              ปิด
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
            คัดลอกข้อความแล้วนำไปโพสต์บนโซเชียลมีเดีย หรือส่งผ่านช่องทางประชาสัมพันธ์ของแพลตฟอร์ม
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectStatusModal({ status, projects, loading, error, onRetry, onClose }) {
  const meta = PROJECT_STATUS_META[status] || PROJECT_STATUS_META.open;

  return (
    <div className="boProjectModalOverlay" onClick={onClose}>
      <div className="boProjectModal" onClick={(e) => e.stopPropagation()}>
        <div className="boProjectModal__header">
          <div className="boProjectModal__titleWrap">
            <div className="boProjectModal__icon" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
              <Icon icon={meta.icon} />
            </div>
            <div>
              <div className="boProjectModal__title">{meta.title}</div>
              <div className="boProjectModal__sub">{formatNumber(projects.length)} รายการที่แสดงในขณะนี้</div>
            </div>
          </div>
          <button type="button" className="boProjectModal__close" onClick={onClose} aria-label="ปิด">
            <Icon icon="mdi:close" />
          </button>
        </div>

        {loading && <div className="boProjectModal__state">กำลังโหลดรายการโครงการ...</div>}

        {!loading && error && (
          <div className="boProjectModal__state boProjectModal__state--error">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>ลองใหม่</button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="boProjectModal__state">{meta.empty}</div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="boProjectModal__list">
            {projects.map((project) => {
              const progress = project.total_needed > 0
                ? Math.min(100, Math.round((Number(project.total_fulfilled || 0) / Number(project.total_needed || 0)) * 100))
                : 0;
              const dateLabel = status === "open"
                ? `เริ่ม ${fmtProjectDate(project.start_date || project.created_at)}`
                : `สิ้นสุด ${fmtProjectDate(project.end_date || project.created_at)}`;

              return (
                <div key={project.request_id} className="boProjectModalItem">
                  <div className="boProjectModalItem__thumb">
                    {project.request_image_url ? (
                      <img src={project.request_image_url} alt={project.request_title || "โครงการ"} />
                    ) : (
                      <Icon icon="mdi:image-off-outline" />
                    )}
                  </div>
                  <div className="boProjectModalItem__main">
                    <div className="boProjectModalItem__top">
                      <div>
                        <div className="boProjectModalItem__title">{project.request_title || "ไม่ระบุชื่อโครงการ"}</div>
                        <div className="boProjectModalItem__school">
                          <Icon icon="teenyicons:school-outline" />
                          {project.school_name || "ไม่ระบุโรงเรียน"}
                          {project.school_province ? ` · ${project.school_province}` : ""}
                        </div>
                      </div>
                      <span className="boProjectModalItem__badge" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="boProjectModalItem__meta">
                      <span>{dateLabel}</span>
                      <span>{formatNumber(project.student_count)} นักเรียน</span>
                      <span>ส่งมอบ {formatNumber(project.total_fulfilled)} / {formatNumber(project.total_needed)} ชิ้น</span>
                    </div>

                    <div className="boProjectModalItem__bar">
                      <span style={{ width: `${progress}%`, background: meta.color }} />
                    </div>
                  </div>
                  <a className="boProjectModalItem__link" href={`/projects/${project.request_id}`} target="_blank" rel="noreferrer">
                    เปิดดู
                    <Icon icon="mdi:open-in-new" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
