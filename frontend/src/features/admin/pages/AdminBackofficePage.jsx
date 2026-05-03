import { useEffect, useMemo, useState } from "react";
import * as svc from "../services/admin.service.js";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import { formatBaht, formatNumber } from "../utils/format.js";
import "../styles/admin.css";
import "../styles/adminPages.css";
import { Icon } from "@iconify/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const OVERVIEW_CARDS = [
  { key: "total_users",     label: "ยอดผู้ใช้งานรวม",   icon: "material-symbols:person-rounded", bg: "#bce3f6" },
  { key: "total_schools",   label: "โรงเรียน",           icon: "teenyicons:school-outline",         bg: "#bdf2ce" },
  { key: "total_donations", label: "โครงการขอบริจาค",   icon: "mdi:hand-heart-outline",            bg: "#ffe2c2" },
  { key: "total_products",  label: "รายการสินค้า",       icon: "icon-park-outline:ad-product",      bg: "#fff1be" },
  { key: "total_orders",    label: "รายการสั่งซื้อสินค้า", icon: "lets-icons:order",                 bg: "#ffd6d6" },
];

export default function AdminBackofficePage() {
  const [stats, setStats] = useState({
    total_users: 0,
    total_schools: 0,
    total_donations: 0,
    total_products: 0,
    total_orders: 0,
  });
  const [revenue, setRevenue] = useState({ platform_revenue: 0, fee_revenue: 0, fee_count: 0 });
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
          total_users: Number(ov?.total_users || 0),
          total_schools: Number(ov?.total_schools || 0),
          total_donations: Number(ov?.total_donations || 0),
          total_products: Number(ov?.total_products || 0),
          total_orders: Number(ov?.total_orders || 0),
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
          platform_revenue: Number(r?.platform_revenue || 0),
          fee_revenue: Number(r?.fee_revenue || 0),
          fee_count: Number(r?.fee_count || 0),
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

  const netRevenue = revenue.platform_revenue - revenue.fee_revenue;

  return (
    <div className="boPage">
      <div className="boTop">
        <div className="boTitle">Dashboard</div>
        <div className="boAdmin">
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
            {OVERVIEW_CARDS.map((c) => (
              <div key={c.key} className="boStatColorCard" style={{ background: c.bg }}>
                <div className="boStatColorCard__label">{c.label}</div>
                <div className="boStatColorCard__iconWrap">
                  <Icon icon={c.icon} width="32" height="32" />
                </div>
                <div className="boStatColorCard__value">{formatNumber(stats[c.key])}</div>
                <div className="boStatColorCard__change">+5% จากเดือนที่แล้ว</div>
              </div>
            ))}
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
          <div className="boRevCard">
            <div className="boRevCard__label">รายได้รวมแพลตฟอร์ม</div>
            <div className="boRevCard__value boRevCard__value--blue">{formatBaht(revenue.platform_revenue)}</div>
            <div className="boRevCard__sub boRevCard__sub--green">+5% จากเดือนที่แล้ว</div>
          </div>
          <div className="boRevCard">
            <div className="boRevCard__label">ค่าธรรมเนียม 15%</div>
            <div className="boRevCard__value boRevCard__value--amber">{formatBaht(revenue.fee_revenue)}</div>
            <div className="boRevCard__sub boRevCard__sub--muted">{formatNumber(revenue.fee_count)} รายการ</div>
          </div>
          <div className="boRevCard boRevCard--highlight">
            <div className="boRevCard__label">รายได้สุทธิหลังหักค่าธรรมเนียม</div>
            <div className="boRevCard__value boRevCard__value--amber">{formatBaht(netRevenue)}</div>
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

            <PendingItem
              label="โรงเรียนรออนุมัติ"
              count={tasks.pending_schools}
              link="/admin/schools"
              bg="#fff8d8"
              labelColor="#92400e"
              btnLabel="อนุมัติ"
            />
            <PendingItem
              label="รายการสินค้าค้างส่ง"
              count={tasks.pending_shipments}
              link="/admin/orders"
              bg="#ffe2e2"
              labelColor="#991b1b"
              btnLabel="จัดการ"
            />
            <PendingItem
              label="บริจาคไม่ถูกยืนยัน"
              count={tasks.pending_donations}
              link="/admin/donations"
              bg="#ffe2e2"
              labelColor="#991b1b"
              btnLabel="จัดการ"
            />
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
