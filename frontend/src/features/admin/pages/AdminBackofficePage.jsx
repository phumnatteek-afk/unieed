import { useEffect, useMemo, useState } from "react";
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
const RANK_MEDAL   = ["🥇", "🥈", "🥉"];
const CARD_THEMES  = [
  { grad: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)", light: "#dbeafe", accent: "#1d4ed8", border: "#93c5fd" },
  { grad: "linear-gradient(135deg,#0369a1 0%,#38bdf8 100%)", light: "#e0f2fe", accent: "#0284c7", border: "#7dd3fc" },
  { grad: "linear-gradient(135deg,#0f766e 0%,#2dd4bf 100%)", light: "#ccfbf1", accent: "#0d9488", border: "#5eead4" },
];
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

function sizeLabel(sz) {
  if (!sz) return null;
  const p = [];
  if (sz.chest && sz.chest !== "0") p.push(`อก ${sz.chest}`);
  if (sz.waist && sz.waist !== "0") p.push(`เอว ${sz.waist}`);
  if (!p.length && sz.length && sz.length !== "0") p.push(`ยาว ${sz.length}`);
  return p.length ? p.join(" / ") : null;
}

function urgencyMeta(stillNeeded, totalNeeded) {
  const pct = totalNeeded > 0 ? Math.round((stillNeeded / totalNeeded) * 100) : 0;
  // ใช้สีธีมหลัก (blue) สำหรับ label — เก็บ accent สีแดงไว้เฉพาะ % text
  if (pct >= 70) return { label: "ขาดมาก",     pctColor: "#dc2626", badgeBg: "rgba(255,255,255,0.22)", badgeColor: "#fff" };
  if (pct >= 40) return { label: "ขาดปานกลาง", pctColor: "#ea580c", badgeBg: "rgba(255,255,255,0.22)", badgeColor: "#fff" };
  return              { label: "ขาดน้อย",      pctColor: "#16a34a", badgeBg: "rgba(255,255,255,0.22)", badgeColor: "#fff" };
}

function fmtProjectDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
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
  const [chartMonths, setChartMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [projectModalStatus, setProjectModalStatus] = useState(null);
  const [projectLists, setProjectLists] = useState({ open: null, closed: null });
  const [projectListLoading, setProjectListLoading] = useState(false);
  const [projectListErr, setProjectListErr] = useState("");
  const [expandedProvince, setExpandedProvince] = useState(null);
  const [campaignModalProvince, setCampaignModalProvince] = useState(null);
  const [provinceSearch, setProvinceSearch] = useState("");
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [allOpenProjects, setAllOpenProjects] = useState([]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  // โหลด overview / chart / tasks ครั้งแรก
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const [ov, tk, ch, dm, openProj] = await Promise.all([
          svc.getOverview(),
          svc.getPendingTasks(),
          svc.getChart(6),
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
        setChart(ch || {});
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

  // โหลด revenue ตาม period ที่เลือก
  useEffect(() => {
    let cancelled = false;
    svc.getRevenue({ period, start_date: period === "custom" ? startDate : null, end_date: period === "custom" ? endDate : null })
      .then((r) => {
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
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [period, startDate, endDate]);

  useEffect(() => {
    const map = { today: 3, month: 3, "3months": 3, "6months": 6, year: 12, custom: 6 };
    const m = map[period] || 6;
    setChartMonths(m);
    svc.getChart(m).then((ch) => setChart(ch || {})).catch(() => {});
  }, [period]);

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

  // ── Province search + region grouping ──────────────────────────────────────
  const filteredProvinces = useMemo(() => {
    const all = demand.province_demand || [];
    if (!provinceSearch.trim()) return all;
    const q = provinceSearch.trim().toLowerCase();
    return all.filter(p =>
      p.province?.toLowerCase().includes(q) ||
      p.region?.toLowerCase().includes(q)
    );
  }, [demand.province_demand, provinceSearch]);

  const regionGroups = useMemo(() => {
    const all = demand.province_demand || [];
    const map = {};
    all.forEach((p) => {
      const r = p.region || "อื่นๆ";
      if (!map[r]) map[r] = { region: r, count: 0, still_needed: 0, provinces: [] };
      map[r].count += 1;
      map[r].still_needed += p.still_needed || 0;
      map[r].provinces.push(p);
    });
    // sort by still_needed desc
    return Object.values(map).sort((a, b) => b.still_needed - a.still_needed);
  }, [demand.province_demand]);

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
                  รายได้ค่าธรรมเนียม — ย้อนหลัง {chartMonths} เดือน
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>ค่าธรรมเนียมที่เก็บจากผู้ขาย (15% ขั้นต่ำ ฿20/ออเดอร์)</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"4px 10px", fontSize:12, color:"#1d4ed8", fontWeight:600 }}>
                <Icon icon="mdi:chart-bar" style={{ fontSize:14 }} /> กราฟแท่ง
              </div>
            </div>
            <div style={{ width: "100%", height: 280 }}>
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
                    📂 {demand.open_projects} โครงการเปิดอยู่
                  </span>
                )}
                {/* Legend — % bar colors only */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[["#fca5a5","ขาดมาก ≥70%"],["#fed7aa","ปานกลาง 40–70%"],["#bbf7d0","น้อย <40%"]].map(([c,l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, border: "1px solid #e2e8f0", display: "inline-block" }} />{l}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Top 3 cards (horizontal) ── */}
            {demand.top3_types.length === 0 ? (
              <div className="boDonutCard" style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>
                ไม่มีโครงการที่เปิดอยู่ หรือยังไม่มีข้อมูลความต้องการ
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
                {demand.top3_types.map((item) => {
                  const theme  = CARD_THEMES[item.rank - 1];
                  const meta   = urgencyMeta(item.still_needed, item.total_needed);
                  const pct    = item.total_needed > 0 ? Math.round((item.still_needed / item.total_needed) * 100) : 0;
                  return (
                    <div key={item.uniform_type_id} style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(30,58,138,0.10)", border: `1px solid ${theme.border}` }}>

                      {/* Gradient header */}
                      <div style={{ background: theme.grad, padding: "16px 18px 14px", position: "relative" }}>
                        <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, lineHeight: 1 }}>
                          {RANK_MEDAL[item.rank - 1]}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.22)", color: "#fff", padding: "2px 9px", borderRadius: 20 }}>
                            {item.category_name}
                          </span>
                          {item.gender_label && (
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)" }}>({item.gender_label})</span>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", paddingRight: 36, marginBottom: 8, lineHeight: 1.3 }}>
                          {item.type_name}
                        </div>
                        {/* Progress inside header */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                          <span>ยังขาด {item.still_needed} / {item.total_needed} ชิ้น</span>
                          <span style={{ fontWeight: 800, color: pct >= 70 ? "#fca5a5" : pct >= 40 ? "#fed7aa" : "#bbf7d0" }}>{pct}%</span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#fff", borderRadius: 4, opacity: 0.9 }} />
                        </div>
                      </div>

                      {/* White body */}
                      <div style={{ background: "#fff", padding: "14px 16px 16px" }}>

                        {/* Sizes */}
                        {item.top_sizes.filter(sz => sizeLabel(sz)).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                              <Icon icon="mdi:ruler" style={{ fontSize: 13, color: theme.accent }} />
                              ไซส์ที่ขาดมากที่สุด
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {item.top_sizes.map((sz, si) => {
                                const lbl = sizeLabel(sz);
                                if (!lbl) return null;
                                return (
                                  <div key={si} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    background: si === 0 ? theme.light : "#f8fafc",
                                    borderRadius: 8, padding: "5px 10px", fontSize: 12,
                                    border: `1px solid ${si === 0 ? theme.border : "#f1f5f9"}`,
                                  }}>
                                    <span style={{ fontWeight: si === 0 ? 700 : 500, color: si === 0 ? theme.accent : "#475569" }}>
                                      {si === 0 ? "★ " : "  "}{lbl}
                                    </span>
                                    <span style={{ fontWeight: 700, color: si === 0 ? theme.accent : "#94a3b8", fontSize: 11 }}>
                                      {sz.count} ชิ้น
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Education levels */}
                        {item.levels && item.levels.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                              <Icon icon="mdi:school-outline" style={{ fontSize: 13, color: theme.accent }} />
                              ระดับชั้นที่ขาด
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {item.levels.slice(0, 5).map((lv, li) => (
                                <span key={li} style={{
                                  fontSize: 11, borderRadius: 20, padding: "2px 10px",
                                  background: li === 0 ? theme.light : "#f1f5f9",
                                  border: `1px solid ${li === 0 ? theme.border : "#e2e8f0"}`,
                                  color: li === 0 ? theme.accent : "#475569",
                                  fontWeight: li === 0 ? 700 : 500,
                                }}>
                                  {lv.level} <span style={{ color: li === 0 ? theme.accent : "#94a3b8", fontWeight: 700 }}>{lv.count}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Province + Donut + Completed — 2-col layout ── */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 8 }}>

              {/* LEFT — Province demand (full height) */}
              <div className="boDonutCard" style={{ margin: 0 }}>
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon icon="mdi:map-marker-multiple" style={{ color: "#1d4ed8", fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>พื้นที่ที่ต้องการชุดมากที่สุด</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>จัดอันดับตามจำนวนชุดที่ยังขาด</div>
                  </div>
                </div>

                {/* Region summary pills — 2-col grid */}
                {demand.region_demand.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
                    {demand.region_demand.map((r) => {
                      const rs = REGION_STYLE[r.region] || REGION_STYLE["อื่นๆ"];
                      return (
                        <div key={r.region} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: rs.bg, border: `1px solid ${rs.border}`, borderRadius: 10, padding: "7px 12px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: rs.color }}>ภาค{r.region}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: rs.color }}>
                            {r.still_needed.toLocaleString()} <span style={{ fontSize: 10, fontWeight: 500, color: rs.color + "bb" }}>ชิ้น</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Search + Region breakdown */}
                {demand.province_demand.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 16 }}>ยังไม่มีข้อมูลจังหวัด</div>
                ) : (
                  <>
                    {/* Search box */}
                    <div style={{ position: "relative", marginBottom: 12 }}>
                      <Icon icon="mdi:magnify" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 16 }} />
                      <input
                        type="text"
                        value={provinceSearch}
                        onChange={(e) => setProvinceSearch(e.target.value)}
                        placeholder="ค้นหาชื่อจังหวัด หรือภาค (เช่น เชียงใหม่, เหนือ)…"
                        style={{
                          width: "100%", boxSizing: "border-box",
                          paddingLeft: 32, paddingRight: provinceSearch ? 32 : 12,
                          paddingTop: 8, paddingBottom: 8,
                          border: "1.5px solid #e2e8f0", borderRadius: 10,
                          fontSize: 13, color: "#1e293b", background: "#f8fafc",
                          fontFamily: "inherit", outline: "none",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "#1d4ed8"; e.target.style.boxShadow = "0 0 0 3px rgba(29,78,216,0.10)"; e.target.style.background = "#fff"; }}
                        onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; e.target.style.background = "#f8fafc"; }}
                      />
                      {provinceSearch && (
                        <button
                          type="button"
                          onClick={() => setProvinceSearch("")}
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, display: "flex", alignItems: "center" }}
                        >
                          <Icon icon="mdi:close-circle" style={{ fontSize: 16 }} />
                        </button>
                      )}
                    </div>

                    {/* Region accordion (show when not searching) */}
                    {!provinceSearch && (
                      <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
                          <Icon icon="mdi:map-legend" style={{ fontSize: 13 }} />
                          จัดกลุ่มตามภาค — ไล่จากความต้องการมากสุด
                        </div>
                        {regionGroups.map((rg) => {
                          const rs = REGION_STYLE[rg.region] || REGION_STYLE["อื่นๆ"];
                          const isOpen = expandedRegion === rg.region;
                          const maxNeeded = Math.max(...regionGroups.map(r => r.still_needed), 1);
                          const barW = Math.round((rg.still_needed / maxNeeded) * 100);
                          return (
                            <div key={rg.region} style={{ borderRadius: 10, border: `1px solid ${isOpen ? rs.border : "#e2e8f0"}`, background: isOpen ? rs.bg : "#fafafa", overflow: "hidden" }}>
                              {/* Region row */}
                              <div
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer" }}
                                onClick={() => setExpandedRegion(isOpen ? null : rg.region)}
                              >
                                <span style={{ minWidth: 52, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: rs.bg, color: rs.color, border: `1px solid ${rs.border}`, textAlign: "center" }}>
                                  ภาค{rg.region}
                                </span>
                                <div style={{ flex: 1, minWidth: 0, background: "#e2e8f0", borderRadius: 4, height: 6, overflow: "hidden" }}>
                                  <div style={{ width: `${barW}%`, height: "100%", borderRadius: 4, background: rs.color, opacity: 0.7, transition: "width 0.5s" }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: rs.color, whiteSpace: "nowrap" }}>
                                  {rg.still_needed.toLocaleString()} ชิ้น
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 600, background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" }}>
                                  {rg.count} จังหวัด
                                </span>
                                <Icon icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"} style={{ fontSize: 14, color: "#94a3b8", flexShrink: 0 }} />
                              </div>
                              {/* Province sub-list inside region */}
                              {isOpen && (
                                <div style={{ borderTop: `1px solid ${rs.border}`, padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                                  {rg.provinces.sort((a, b) => b.still_needed - a.still_needed).map((p, pi) => (
                                    <div
                                      key={p.province}
                                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "#fff", border: "1px solid #f1f5f9", cursor: "pointer" }}
                                      onClick={() => setExpandedProvince(expandedProvince === p.province ? null : p.province)}
                                    >
                                      <span style={{ fontSize: 11, fontWeight: 700, color: pi === 0 ? rs.color : "#94a3b8", minWidth: 18 }}>#{pi + 1}</span>
                                      <span style={{ fontSize: 13, fontWeight: pi === 0 ? 700 : 500, color: "#1e293b", flex: 1 }}>{p.province}</span>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: pi === 0 ? rs.color : "#64748b" }}>{p.still_needed.toLocaleString()} ชิ้น</span>
                                      <Icon icon={expandedProvince === p.province ? "mdi:chevron-up" : "mdi:chevron-down"} style={{ fontSize: 14, color: "#94a3b8" }} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Province flat list (shows always, or when searching) */}
                    {(provinceSearch || !expandedRegion) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {!provinceSearch && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
                            <Icon icon="mdi:format-list-numbered" style={{ fontSize: 13 }} />
                            รายชื่อจังหวัดทั้งหมด — ไล่จากขาดมากสุด
                          </div>
                        )}
                        {filteredProvinces.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: 13 }}>ไม่พบจังหวัดที่ค้นหา</div>
                        ) : filteredProvinces.map((p, pi) => {
                          const rs = REGION_STYLE[p.region] || REGION_STYLE["อื่นๆ"];
                          const isExpanded = expandedProvince === p.province;
                          const barColor = pi === 0 ? "#1d4ed8" : pi < 3 ? "#3b82f6" : "#93c5fd";
                          return (
                            <div key={p.province} style={{ borderRadius: 12, border: `1px solid ${isExpanded ? "#bfdbfe" : "#f1f5f9"}`, background: isExpanded ? "#f8faff" : "#fff", overflow: "hidden", transition: "all 0.2s" }}>
                              <div
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }}
                                onClick={() => setExpandedProvince(isExpanded ? null : p.province)}
                              >
                                <span style={{ minWidth: 22, fontSize: 12, fontWeight: 700, textAlign: "center", color: pi < 3 ? "#1d4ed8" : "#94a3b8" }}>
                                  #{pi + 1}
                                </span>
                                <span style={{ minWidth: 40, fontSize: 10, fontWeight: 700, textAlign: "center", padding: "2px 5px", borderRadius: 7, background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}>
                                  {p.region}
                                </span>
                                <span style={{ minWidth: 80, fontSize: 13, fontWeight: pi < 3 ? 700 : 500, color: pi < 3 ? "#1e293b" : "#475569" }}>
                                  {p.province}
                                </span>
                                <div style={{ flex: 1, minWidth: 0, background: "#e2e8f0", borderRadius: 6, height: 8, overflow: "hidden" }}>
                                  <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 6, background: barColor, transition: "width 0.5s ease" }} />
                                </div>
                                <span style={{ minWidth: 58, fontSize: 12, fontWeight: 700, textAlign: "right", color: pi < 3 ? "#1d4ed8" : "#64748b" }}>
                                  {p.still_needed.toLocaleString()} ชิ้น
                                </span>
                                <Icon icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"} style={{ fontSize: 16, color: "#94a3b8", flexShrink: 0 }} />
                              </div>
                              {isExpanded && (
                                <div style={{ borderTop: "1px solid #e0e7ff", padding: "10px 14px 12px", background: "#eff6ff" }}>
                                  {p.top_items && p.top_items.length > 0 ? (
                                    <div style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                                        <Icon icon="mdi:tag-multiple-outline" style={{ fontSize: 12, marginRight: 4, verticalAlign: "middle" }} />
                                        สิ่งของที่ขาดมากที่สุด
                                      </div>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {p.top_items.map((item, ii) => (
                                          <div key={ii} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: ii === 0 ? "#dbeafe" : "#f0f9ff", borderRadius: 8, padding: "5px 10px", border: `1px solid ${ii === 0 ? "#93c5fd" : "#e0f2fe"}` }}>
                                            <span style={{ fontSize: 12, fontWeight: ii === 0 ? 700 : 500, color: ii === 0 ? "#1d4ed8" : "#0369a1" }}>
                                              {ii === 0 ? "★ " : `${ii + 1}. `}{item.label}
                                            </span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: ii === 0 ? "#1d4ed8" : "#0284c7" }}>
                                              {item.still_needed.toLocaleString()} ชิ้น
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>ไม่มีรายละเอียดสิ่งของ</div>
                                  )}
                                  {/* โครงการที่เปิดอยู่ในจังหวัดนี้ */}
                                  {(() => {
                                    const provProjects = allOpenProjects.filter(pr =>
                                      (pr.school_province || "").includes(p.province) ||
                                      p.province.includes(pr.school_province || "~~")
                                    );
                                    if (provProjects.length === 0) return null;
                                    return (
                                      <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                          <Icon icon="mdi:folder-open-outline" style={{ fontSize: 13 }} />
                                          โครงการที่เปิดอยู่ในจังหวัดนี้ ({provProjects.length})
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                          {provProjects.slice(0, 5).map((pr, pi) => {
                                            const prog = pr.total_needed > 0 ? Math.min(100, Math.round((Number(pr.total_fulfilled||0)/Number(pr.total_needed||1))*100)) : 0;
                                            return (
                                              <div key={pr.request_id} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 9, padding: "8px 10px" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                                                  <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{pr.request_title || "ไม่ระบุชื่อ"}</div>
                                                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                                      <Icon icon="teenyicons:school-outline" style={{ fontSize: 10, marginRight: 3, verticalAlign: "middle" }} />
                                                      {pr.school_name || "-"}
                                                    </div>
                                                  </div>
                                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 20, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>{prog}%</span>
                                                </div>
                                                <div style={{ marginTop: 6, background: "#e2e8f0", borderRadius: 6, height: 5, overflow: "hidden" }}>
                                                  <div style={{ width: `${prog}%`, height: "100%", background: prog >= 70 ? "#22c55e" : prog >= 40 ? "#f59e0b" : "#3b82f6", borderRadius: 6, transition: "width 0.5s" }} />
                                                </div>
                                                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>ส่งมอบ {formatNumber(pr.total_fulfilled||0)} / {formatNumber(pr.total_needed||0)} ชิ้น · {pr.student_count||0} นักเรียน</div>
                                              </div>
                                            );
                                          })}
                                          {provProjects.length > 5 && (
                                            <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", padding: "4px 0" }}>และอีก {provProjects.length - 5} โครงการ…</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  <button
                                    type="button"
                                    onClick={() => setCampaignModalProvince(p)}
                                    style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(90deg,#1d4ed8,#2563eb)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}
                                  >
                                    <Icon icon="mdi:bullhorn-outline" style={{ fontSize: 14 }} />
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
      <div className="boProjectModal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
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
          <button type="button" className="boProjectModal__close" onClick={onClose} style={{ color: "#fff", background: "rgba(255,255,255,0.15)" }}>
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
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
