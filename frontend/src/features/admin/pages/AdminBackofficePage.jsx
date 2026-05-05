import { useEffect, useMemo, useState } from "react";
import * as svc from "../services/admin.service.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import { formatBaht, formatNumber } from "../utils/format.js";
import "../styles/admin.css";
import "../styles/adminPages.css";
import { Icon } from "@iconify/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const OVERVIEW_CARDS = [
  { key: "total_users",     pctKey: "pct_users",     label: "ยอดผู้ใช้งานรวม",      icon: "material-symbols:person-rounded", bg: "#bce3f6" },
  { key: "total_schools",   pctKey: "pct_schools",   label: "โรงเรียน",              icon: "teenyicons:school-outline",       bg: "#bdf2ce" },
  { key: "total_donations", pctKey: "pct_donations", label: "โครงการขอบริจาค",      icon: "mdi:hand-heart-outline",          bg: "#ffe2c2" },
  { key: "total_products",  pctKey: "pct_products",  label: "รายการสินค้า",          icon: "icon-park-outline:ad-product",    bg: "#fff1be" },
  { key: "total_orders",    pctKey: "pct_orders",    label: "รายการสั่งซื้อสินค้า", icon: "lets-icons:order",                bg: "#ffd6d6" },
];

function pctLabel(pct) {
  if (pct === null || pct === undefined) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% จากเดือนที่แล้ว`;
}

export default function AdminBackofficePage() {
  const [stats, setStats] = useState({
    total_users: 0, total_schools: 0, total_donations: 0, total_products: 0, total_orders: 0,
    pct_users: null, pct_schools: null, pct_donations: null, pct_products: null, pct_orders: null,
  });
  const [revenue, setRevenue] = useState({
    platform_revenue: 0, fee_revenue: 0,
    fee_15_revenue: 0, fee_min_revenue: 0,
    fee_15_count: 0, fee_min_count: 0, fee_count: 0,
    pct_platform_revenue: null, pct_fee_15: null, pct_fee_min: null,
  });
  const [chart, setChart] = useState({ months: [], sales: [], fees: [], donation_open_pct: 0 });
  const [tasks, setTasks] = useState({ pending_schools: 0, pending_shipments: 0, pending_donations: 0 });
  const [period, setPeriod] = useState("week");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
        const [ov, tk, ch] = await Promise.all([
          svc.getOverview(),
          svc.getPendingTasks(),
          svc.getChart(6),
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
    svc.getRevenue(period)
      .then((r) => {
        if (cancelled) return;
        setRevenue({
          platform_revenue:     Number(r?.platform_revenue  || 0),
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
  }, [period]);

  const chartData = useMemo(
    () => (chart.months || []).map((m, i) => ({
      month: m,
      sales: Number(chart.sales?.[i] || 0),
      fees: Number(chart.fees?.[i] || 0),
    })),
    [chart],
  );

  const donationData = useMemo(() => {
    const open = Number(chart.donation_open_pct || 0);
    return [
      { name: "เปิดอยู่", value: open,        color: "#22c55e" },
      { name: "ปิดแล้ว", value: 100 - open,  color: "#f59e0b" },
    ];
  }, [chart.donation_open_pct]);

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

        {/* ===== Period tabs ===== */}
        <div className="boTopDateRow" style={{ padding: "0 0 12px" }}>
          <div /> {/* spacer */}
          <div className="boPeriodTabs">
            {[
              { v: "week",  l: "สัปดาห์นี้" },
              { v: "month", l: "เดือนนี้" },
              { v: "year",  l: "ปีนี้" },
            ].map((t) => (
              <button
                key={t.v}
                type="button"
                className={`boPeriodTab ${period === t.v ? "active" : ""}`}
                onClick={() => setPeriod(t.v)}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* ===== Revenue cards ===== */}
        <div className="boRevGrid3">
          {/* Card 1: รายได้รวม — ธีม gradient เดียวกับ header */}
          <div className="boRevCard" style={{ background: "linear-gradient(90deg,#1d4ed8 0%,#5285e8 55%,#7dd3fc 100%)", border: "none", position: "relative", overflow: "hidden" }}>
            {/* decorative circle */}
            <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "absolute", right: 20, bottom: -30, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon icon="mdi:currency-usd" style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }} />
              <div className="boRevCard__label" style={{ color: "rgba(255,255,255,0.82)", marginBottom: 0 }}>รายได้รวมแพลตฟอร์ม</div>
            </div>
            <div className="boRevCard__value" style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{formatBaht(revenue.platform_revenue)}</div>
            {revenue.pct_platform_revenue !== null && (
              <div className="boRevCard__sub" style={{ color: revenue.pct_platform_revenue >= 0 ? "#86efac" : "#fca5a5" }}>
                {pctLabel(revenue.pct_platform_revenue)}
              </div>
            )}
          </div>

          {/* Card 2: ค่าธรรมเนียม 15% */}
          <div className="boRevCard" style={{ borderTop: "3px solid #f59e0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>15%</span>
              <div className="boRevCard__label" style={{ marginBottom: 0 }}>ค่าธรรมเนียม</div>
            </div>
            <div className="boRevCard__value boRevCard__value--amber">{formatBaht(revenue.fee_15_revenue)}</div>
            <div className="boRevCard__sub boRevCard__sub--muted">{formatNumber(revenue.fee_15_count)} รายการ · ยอด ≥ 100 บาท</div>
            {revenue.pct_fee_15 !== null && (
              <div className="boRevCard__sub" style={{ color: revenue.pct_fee_15 >= 0 ? "#16a34a" : "#dc2626", marginTop: 2 }}>
                {pctLabel(revenue.pct_fee_15)}
              </div>
            )}
          </div>

          {/* Card 3: ค่าธรรมเนียมขั้นต่ำ 20 บาท */}
          <div className="boRevCard" style={{ borderTop: "3px solid #f59e0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>฿20 min</span>
              <div className="boRevCard__label" style={{ marginBottom: 0 }}>ค่าธรรมเนียมขั้นต่ำ</div>
            </div>
            <div className="boRevCard__value boRevCard__value--amber">{formatBaht(revenue.fee_min_revenue)}</div>
            <div className="boRevCard__sub boRevCard__sub--muted">{formatNumber(revenue.fee_min_count)} รายการ · ยอด &lt; 100 บาท</div>
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
            <div className="boChartCard__title">ยอดขายรวม vs ค่าธรรมเนียมที่ได้รับ — ย้อนหลัง 6 เดือน</div>
            <div className="boChartLegend">
              <div className="boChartLegend__item">
                <span className="boChartLegend__dot" style={{ background: "#fcd34d" }} />
                ยอดขายสินค้ารวม
              </div>
              <div className="boChartLegend__item">
                <span className="boChartLegend__dot" style={{ background: "#60a5fa" }} />
                รายได้ค่าธรรมเนียม
              </div>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
                  <Tooltip formatter={(v) => formatBaht(v)} />
                  <Line type="monotone" dataKey="sales" stroke="#fcd34d" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="fees" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
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

        {/* ===== Donation status ===== */}
        <div className="boDonutCard">
          <div className="boDonutCard__title">สถานะโครงการขอรับบริจาค</div>
          <div className="boDonutCard__inner">
            <div style={{ width: 160, height: 160 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donationData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
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
                  <span style={{ fontWeight: 800, fontSize: 22, color: d.color }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
