import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { request } from "../../../api/http.js";
import { formatOrderNo } from "../../../utils/orderNo.js";
import { NotSellerView } from "../layouts/SellerLayout.jsx";

const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString();
const fmtCount = (n) => Number(n || 0).toLocaleString();

const PERIOD_OPTIONS = [
  { value: "today", label: "วันนี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "3months", label: "3 เดือน" },
  { value: "6months", label: "6 เดือน" },
  { value: "year", label: "1 ปี" },
];

const PERIOD_LABELS = {
  today: "วันนี้",
  month: "เดือนนี้",
  "3months": "ย้อนหลัง 3 เดือน",
  "6months": "ย้อนหลัง 6 เดือน",
  year: "ย้อนหลัง 1 ปี",
  custom: "ช่วงวันที่กำหนด",
};

const BANK_LABELS = {
  kbank: "ธนาคารกสิกรไทย (KBank)",
  scb: "ธนาคารไทยพาณิชย์ (SCB)",
  bbl: "ธนาคารกรุงเทพ (BBL)",
  ktb: "ธนาคารกรุงไทย (KTB)",
  bay: "ธนาคารกรุงศรีอยุธยา (BAY)",
  ttb: "ธนาคารทีทีบี (TTB)",
  gsb: "ธนาคารออมสิน (GSB)",
};

const ORDER_STATUS_META = {
  pending: { label: "รอยืนยัน", cls: "slStatusPill--amber" },
  confirmed: { label: "รอจัดส่ง", cls: "slStatusPill--amber" },
  shipping: { label: "จัดส่งแล้ว", cls: "slStatusPill--blue" },
  delivered: { label: "สำเร็จ", cls: "slStatusPill--green" },
  cancelled: { label: "ยกเลิก", cls: "slStatusPill--red" },
};

const toInputDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
);

const fmtDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const parseItems = (items) => {
  if (Array.isArray(items)) return items;
  if (!items) return [];
  try { return JSON.parse(items); } catch { return []; }
};

const fmtTrend = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) < 0.05) return { label: "0.0%", tone: "flat", icon: "mdi:minus" };
  if (n > 0) return { label: `+${n.toFixed(1)}%`, tone: "up", icon: "mdi:arrow-top-right-thin" };
  return { label: `${n.toFixed(1)}%`, tone: "down", icon: "mdi:arrow-bottom-right-thin" };
};

export default function SellerDashboardPage() {
  const today = useMemo(() => new Date(), []);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailTab, setDetailTab] = useState("orders");
  const [chartType, setChartType] = useState("bar");
  const detailRef = useRef(null);

  useEffect(() => {
    if (period === "custom" && (!startDate || !endDate)) return undefined;

    let cancel = false;
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("start_date", startDate);
      params.set("end_date", endDate);
    }

    request(`/seller/dashboard?${params.toString()}`)
      .then((next) => { if (!cancel) setData(next); })
      .catch((e) => { if (!cancel) setErr(e?.data?.message || e.message); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [period, startDate, endDate]);

  const chartData = useMemo(() => data?.income_chart?.points || [], [data]);
  const hasChartValue = chartData.some((point) => point.gross > 0);

  const selectCustomRange = () => {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    setLoading(true);
    setErr("");
    setStartDate((value) => value || toInputDate(monthStart));
    setEndDate((value) => value || toInputDate(today));
    setShowCustomRange(true);
    setPeriod("custom");
  };

  const changeStartDate = (value) => {
    if (value && endDate) {
      setLoading(true);
      setErr("");
    }
    setStartDate(value);
  };

  const changeEndDate = (value) => {
    if (value && startDate) {
      setLoading(true);
      setErr("");
    }
    setEndDate(value);
  };

  const openDetails = (nextTab) => {
    setDetailTab(nextTab);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (loading && !data) {
    return <DashboardHero title="Dashboard ร้านค้า" subtitle="กำลังโหลดข้อมูลรายได้..."><div className="slCard">กำลังโหลด...</div></DashboardHero>;
  }
  if (err && !data) {
    return <DashboardHero title="Dashboard ร้านค้า"><div className="slCard" style={{ color: "#b91c1c" }}>{err}</div></DashboardHero>;
  }
  if (!data?.is_seller) {
    return <DashboardHero title="Dashboard ร้านค้า"><NotSellerView message={data?.message} /></DashboardHero>;
  }

  const stats = data.stats || {};
  const tasks = data.tasks || [];
  const income = data.income_summary || {};
  const range = data.dashboard_range || { period, start_date: startDate, end_date: endDate };
  const rangeLabel = range.period === "custom"
    ? `${fmtDate(range.start_date)} - ${fmtDate(range.end_date)}`
    : PERIOD_LABELS[range.period] || PERIOD_LABELS.month;

  const trends = data.trends || {};
  const grossTrend = fmtTrend(trends.gross);
  const feeTrend = fmtTrend(trends.fee);
  const netTrend = fmtTrend(trends.net);

  return (
    <>
      <DashboardHero
        title="Dashboard ร้านค้า"
        subtitle={`สรุปยอดขาย รายได้ และสถานะการโอนเงินของคุณในช่วง ${rangeLabel}`}
        right={
          <>
            <Link to="/seller/payouts" className="slDashboardHero__ghost">
              <Icon icon="mdi:bank-transfer" /> ประวัติการโอน
            </Link>
            <Link to="/sell" className="slDashboardHero__cta">
              <Icon icon="mdi:plus" /> เพิ่มสินค้า
            </Link>
          </>
        }
      />

      <TimeFilter
        endDate={endDate}
        loading={loading}
        period={period}
        rangeLabel={rangeLabel}
        showCustomRange={showCustomRange}
        startDate={startDate}
        onChangeEnd={changeEndDate}
        onChangeStart={changeStartDate}
        onSelectCustom={selectCustomRange}
        onSelectPeriod={(next) => {
          setLoading(true);
          setErr("");
          setPeriod(next);
          setShowCustomRange(false);
        }}
      />

      {err && <div className="slDashboardError">{err}</div>}

      <section className="slRevenueSection">
        <div className="slSectionHead">
          <div>
            <div className="slSectionEyebrow">Income Summary</div>
            <h2>สรุปรายได้ {rangeLabel}</h2>
          </div>
          <div className="slSectionMeta">{fmtCount(income.order_count)} คำสั่งซื้อที่ชำระเงินแล้ว</div>
        </div>

        <div className="slRevenueShotGrid">
          <RevenueShot
            icon="mdi:cash-multiple"
            label="ยอดขายรวมทั้งหมด"
            note="ยอดจากคำสั่งซื้อก่อนหักค่าบริการ"
            tone="gross"
            value={fmtBaht(income.gross)}
            trend={grossTrend}
            onClick={() => openDetails("orders")}
          />
          <RevenueShot
            icon="mdi:receipt-text-minus-outline"
            label="ค่าบริการแพลตฟอร์มที่ถูกหัก"
            note="ค่าธรรมเนียมตามรายการขายในช่วงนี้"
            tone="fee"
            value={`-${fmtBaht(income.fee_total)}`}
            trend={feeTrend}
            onClick={() => openDetails("orders")}
          />
          <RevenueShot
            icon="mdi:wallet-outline"
            label="รายได้สุทธิ"
            note="ยอดที่ผู้ขายได้รับหลังหักค่าบริการ"
            tone="net"
            value={fmtBaht(income.net)}
            trend={netTrend}
            onClick={() => openDetails("orders")}
          />
        </div>
      </section>

      <div className="slDashboardRevenueGrid">
        <div className="slCard slIncomeChartCard">
          <div className="slChartHeader">
            <div>
              <strong>แนวโน้มรายได้</strong>
              <div className="slStatSubtle">รายได้สุทธิและค่าบริการประกอบกันเป็นยอดขายรวมในแต่ละช่วง</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="slChartTypeSwitch" role="group" aria-label="เลือกประเภทกราฟ">
                <button type="button" className={chartType === "bar" ? "active" : ""} onClick={() => setChartType("bar")}>
                  <Icon icon="mdi:chart-bar" /> แท่ง
                </button>
                <button type="button" className={chartType === "area" ? "active" : ""} onClick={() => setChartType("area")}>
                  <Icon icon="mdi:chart-areaspline" /> พื้นที่
                </button>
              </div>
              <div className="slChartLegend">
                <span><i className="slChartLegend__net" /> รายได้สุทธิ</span>
                <span><i className="slChartLegend__fee" /> ค่าบริการ</span>
              </div>
            </div>
          </div>
          <div className="slIncomeChartFrame">
            {hasChartValue ? (
              <ResponsiveContainer>
                {chartType === "bar" ? (
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value >= 1000 ? `฿${(value / 1000).toFixed(1)}K` : `฿${value}`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(59,130,246,0.08)" }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}
                      formatter={(value, name) => [fmtBaht(value), name === "net" ? "รายได้สุทธิ" : "ค่าบริการ"]}
                      labelFormatter={(label) => `ช่วง ${label}`}
                    />
                    <Bar dataKey="net" stackId="income" fill="#2563eb" radius={[0, 0, 6, 6]} />
                    <Bar dataKey="fee" stackId="income" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="slGradNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="slGradFee" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value >= 1000 ? `฿${(value / 1000).toFixed(1)}K` : `฿${value}`}
                    />
                    <Tooltip
                      cursor={{ stroke: "#bfdbfe", strokeWidth: 1 }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}
                      formatter={(value, name) => [fmtBaht(value), name === "net" ? "รายได้สุทธิ" : "ค่าบริการ"]}
                      labelFormatter={(label) => `ช่วง ${label}`}
                    />
                    <Area type="monotone" dataKey="net" stroke="#2563eb" strokeWidth={2.5} fill="url(#slGradNet)" />
                    <Area type="monotone" dataKey="fee" stroke="#f59e0b" strokeWidth={2.5} fill="url(#slGradFee)" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="slChartEmpty">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <Icon icon="mdi:chart-timeline-variant" style={{ fontSize: 36, color: "#cbd5e1" }} />
                  <div>ยังไม่มีรายได้ในช่วงเวลานี้</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>ลองเปลี่ยนช่วงเวลาเพื่อดูข้อมูลเพิ่มเติม</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <TransferStatusCard income={income} rangeLabel={rangeLabel} onOpen={() => openDetails("transfers")} />
      </div>

      <div ref={detailRef} className="slCard slRevenueDetails">
        <div className="slDetailHeader">
          <div>
            <div className="slSectionEyebrow">Drill-down</div>
            <h2>รายละเอียดรายได้ {rangeLabel}</h2>
          </div>
          <div className="slDetailTabs">
            <button
              type="button"
              className={detailTab === "orders" ? "active" : ""}
              onClick={() => setDetailTab("orders")}
            >
              <Icon icon="lets-icons:order" /> รายคำสั่งซื้อ
            </button>
            <button
              type="button"
              className={detailTab === "transfers" ? "active" : ""}
              onClick={() => setDetailTab("transfers")}
            >
              <Icon icon="mdi:bank-transfer" /> รายละเอียดการโอน
            </button>
          </div>
        </div>

        {detailTab === "orders"
          ? <TransactionTable rows={data.transactions || []} total={income.order_count} />
          : <TransferTable rows={data.transfers || []} income={income} />}
      </div>

      <div className="slDashboardOpsGrid">
        <div className="slStatGrid slStatGrid--dashboard">
          <StatCard
            icon="lets-icons:order"
            label="คำสั่งซื้อวันนี้"
            value={`${fmtCount(stats.orders_today)} รายการ`}
            pill={stats.orders_pending > 0 ? `รอดำเนินการ ${stats.orders_pending}` : null}
          />
          <StatCard
            icon="mdi:truck-fast-outline"
            label="ยอดรอตัดรอบ/โอน"
            value={fmtBaht(stats.payout_pending_total)}
            subtle={`${fmtCount(stats.payout_pending_count)} รายการพร้อมโอน`}
          />
          <StatCard
            icon="mdi:package-variant"
            label="สินค้าทั้งหมด"
            value={`${fmtCount(stats.products_total)} รายการ`}
            subtle={`พร้อมขาย ${fmtCount(stats.products_available)} รายการ`}
          />
          <StatCard
            icon="mdi:check-decagram-outline"
            label="สินค้าที่ขายแล้ว"
            value={`${fmtCount(stats.products_sold)} รายการ`}
            pill={stats.products_sold > 0 ? "มีประวัติการขาย" : null}
            pillGreen
          />
        </div>

        <div className="slCard slTaskCard">
          <div className="slTaskHeader">
            <strong>รายการรอดำเนินงาน</strong>
            <span>{tasks.length} รายการ</span>
          </div>
          {tasks.length === 0
            ? <div className="slTaskEmpty">ไม่มีรายการที่รอดำเนินการ</div>
            : tasks.map((task) => (
                <Link key={task.key} to={task.url} className="slPendingItem slTaskLink">
                  <span><span className="slPendingItem__dot" />{task.label}</span>
                  <Icon icon="mdi:chevron-right" />
                </Link>
              ))}
        </div>
      </div>
    </>
  );
}

function TimeFilter({
  endDate,
  loading,
  period,
  rangeLabel,
  showCustomRange,
  startDate,
  onChangeEnd,
  onChangeStart,
  onSelectCustom,
  onSelectPeriod,
}) {
  return (
    <div className="slCard slTimeFilter">
      <div className="slTimeFilter__chips">
        {PERIOD_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={period === item.value ? "active" : ""}
            onClick={() => onSelectPeriod(item.value)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className={period === "custom" ? "active custom" : "custom"}
          onClick={onSelectCustom}
        >
          <Icon icon="mdi:calendar-range" /> กำหนดเอง
        </button>
      </div>

      {showCustomRange && (
        <div className="slTimeFilter__range">
          <label>
            <span>เริ่มต้น</span>
            <input type="date" value={startDate} onChange={(event) => onChangeStart(event.target.value)} />
          </label>
          <label>
            <span>สิ้นสุด</span>
            <input type="date" value={endDate} onChange={(event) => onChangeEnd(event.target.value)} />
          </label>
        </div>
      )}

      <div className="slTimeFilter__label">
        <Icon icon={loading ? "mdi:loading" : "mdi:filter-variant"} className={loading ? "slSpin" : ""} />
        {rangeLabel}
      </div>
    </div>
  );
}

function RevenueShot({ icon, label, note, tone, value, trend, onClick }) {
  return (
    <button type="button" className={`slRevenueShot slRevenueShot--${tone}`} onClick={onClick}>
      <div className="slRevenueShot__top">
        <span>{label}</span>
        <Icon icon={icon} />
      </div>
      <strong>{value}</strong>
      {trend && (
        <span className={`slRevenueShot__trend slRevenueShot__trend--${trend.tone}`}>
          <Icon icon={trend.icon} /> {trend.label} <span style={{ opacity: 0.7, fontWeight: 600, marginLeft: 2 }}>จากช่วงก่อน</span>
        </span>
      )}
      <small>{note}</small>
      <span className="slRevenueShot__action">ดูรายการ <Icon icon="mdi:chevron-right" /></span>
    </button>
  );
}

function TransferStatusCard({ income, rangeLabel, onOpen }) {
  const pendingAmount = Number(income.pending_amount || 0);
  const paidAmount = Number(income.paid_amount || 0);
  const total = pendingAmount + paidAmount;
  const paidPct = total > 0 ? Math.round((paidAmount / total) * 100) : 0;

  // Donut math
  const radius = 52;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const paidStroke = (paidPct / 100) * circumference;

  return (
    <div className="slCard slTransferCard">
      <div className="slTransferCard__header">
        <div>
          <div className="slSectionEyebrow">Transfer Status</div>
          <strong>สถานะการโอนเงิน {rangeLabel}</strong>
        </div>
        <button type="button" className="slIconBtn" onClick={onOpen} title="ดูรายละเอียดการโอนเงิน">
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>

      <div className="slTransferDonut" aria-label={`โอนสำเร็จ ${paidPct}%`}>
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#fef3c7" strokeWidth={stroke} />
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="url(#slDonutGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${paidStroke} ${circumference - paidStroke}`}
          />
          <defs>
            <linearGradient id="slDonutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
        </svg>
        <div className="slTransferDonut__center">
          <div className="slTransferDonut__pct">{paidPct}%</div>
          <div className="slTransferDonut__label">โอนสำเร็จ</div>
        </div>
      </div>

      <div className="slTransferStatList">
        <button type="button" onClick={onOpen}>
          <span className="slTransferDot slTransferDot--pending" />
          <div>
            <small>ยอดเงินที่อยู่ระหว่างดำเนินการโอน</small>
            <strong>{fmtBaht(pendingAmount)}</strong>
            <em>{fmtCount(income.pending_count)} รายการรอตัดรอบหรือรอระบบโอน</em>
          </div>
          <Icon icon="mdi:chevron-right" />
        </button>
        <button type="button" onClick={onOpen}>
          <span className="slTransferDot slTransferDot--paid" />
          <div>
            <small>ยอดเงินที่โอนสำเร็จแล้ว</small>
            <strong>{fmtBaht(paidAmount)}</strong>
            <em>{fmtCount(income.paid_count)} รายการมีข้อมูลรอบโอนแล้ว</em>
          </div>
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>

      <Link to="/seller/payouts" className="slInlineLink">
        ดูประวัติการโอนทั้งหมด <Icon icon="mdi:arrow-right" />
      </Link>
    </div>
  );
}

function TransactionTable({ rows, total }) {
  if (!rows.length) return <div className="slRevenueEmpty">ยังไม่มีคำสั่งซื้อที่ชำระเงินในช่วงเวลานี้</div>;

  return (
    <>
      <div className="slRevenueTableNote">
        แสดง {fmtCount(rows.length)} จาก {fmtCount(total)} รายการล่าสุดในช่วงที่เลือก
      </div>
      <div className="slTableScroll">
        <table className="slTable slTxnTable">
          <thead>
            <tr>
              <th>คำสั่งซื้อ</th>
              <th>วันที่</th>
              <th>ปลายทาง</th>
              <th>การจัดส่ง</th>
              <th>ยอดขาย</th>
              <th>ค่าบริการ</th>
              <th>สุทธิ</th>
              <th>การโอน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => <TransactionRow key={row.order_id} row={row} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TransactionRow({ row }) {
  const [open, setOpen] = useState(false);
  const items = parseItems(row.items);
  const orderStatus = ORDER_STATUS_META[row.order_status] || ORDER_STATUS_META.pending;
  const payoutStatus = getPayoutStatusMeta(row.payout_status);
  const isSchool = row.order_type === "donation";
  const destinationName = isSchool ? row.school_name || row.recipient_name : row.recipient_name;

  return (
    <>
      <tr className="slTxnRow">
        <td>
          <button type="button" className="slTxnToggle" onClick={() => setOpen((value) => !value)}>
            <Icon icon={open ? "mdi:chevron-down" : "mdi:chevron-right"} />
            {formatOrderNo(row.order_id)}
          </button>
        </td>
        <td>{fmtDateTime(row.created_at)}</td>
        <td>
          <div className="slTxnDestination">
            <span>{isSchool ? "โรงเรียน" : "บ้าน"}</span>
            <strong>{destinationName || "-"}</strong>
          </div>
        </td>
        <td><span className={`slStatusPill ${orderStatus.cls}`}>{orderStatus.label}</span></td>
        <td>{fmtBaht(row.gross_amount)}</td>
        <td className="slAmber">-{fmtBaht(row.fee_amount)}</td>
        <td className="slBlue"><strong>{fmtBaht(row.net_amount)}</strong></td>
        <td><span className={`slStatusPill ${payoutStatus.cls}`}>{payoutStatus.label}</span></td>
      </tr>
      {open && (
        <tr className="slTxnExpandRow">
          <td colSpan={8}>
            <div className="slTxnExpand">
              <div className="slTxnExpand__title">
                <Icon icon="mdi:information-outline" /> รายละเอียดคำสั่งซื้อ
              </div>
              <div className="slTxnExpand__meta">
                <div>
                  <small>ที่อยู่จัดส่ง</small>
                  <strong>{row.shipping_address || "-"} {row.shipping_province || ""} {row.shipping_postcode || ""}</strong>
                </div>
                <div>
                  <small>Tracking / ขนส่ง</small>
                  <strong>{row.tracking_number || "-"} · {row.shipping_provider_name || "ยังไม่ระบุขนส่ง"}</strong>
                </div>
                <div>
                  <small>ยืนยันรับสินค้า</small>
                  <strong>{row.completed_at ? fmtDateTime(row.completed_at) : "ยังไม่สำเร็จ"}</strong>
                </div>
                <div>
                  <small>วันที่ผูกกับรอบโอน</small>
                  <strong>{row.payout_date ? fmtDateTime(row.payout_date) : "ยังไม่ตัดรอบโอน"}</strong>
                </div>
              </div>
              {items.length > 0 && (
                <>
                  <div className="slTxnExpand__title" style={{ marginTop: 6 }}>
                    <Icon icon="mdi:package-variant" /> รายการสินค้าในคำสั่งซื้อ
                  </div>
                  <div className="slTxnItems">
                    {items.map((item, index) => (
                      <span key={`${row.order_id}-${item.product_id || index}`}>
                        {item.title || `สินค้า #${item.product_id}`} x{item.qty} · {fmtBaht(Number(item.price || 0) * Number(item.qty || 0))}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TransferTable({ rows, income }) {
  if (!rows.length) {
    return (
      <div className="slRevenueEmpty">
        {Number(income.pending_amount || 0) > 0
          ? "ยอดช่วงนี้ยังอยู่ระหว่างตัดรอบหรือรอระบบโอน"
          : "ยังไม่มีรอบโอนเงินในช่วงเวลานี้"}
      </div>
    );
  }

  return (
    <div className="slTableScroll">
      <table className="slTable slTransferTable">
        <thead>
          <tr>
            <th>รอบโอน</th>
            <th>ธนาคารรับเงิน</th>
            <th>วันที่โอน</th>
            <th>ยอดจากช่วงที่เลือก</th>
            <th>หลักฐาน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.payout_id}>
              <td>
                <strong>#{row.payout_id}</strong>
                <div className="slTableSubtle">
                  {getTransferStatusLabel(row.status)} · {fmtCount(row.selected_order_count)} จาก {fmtCount(row.order_count)} ออเดอร์
                </div>
              </td>
              <td>
                <strong>{BANK_LABELS[row.bank_code] || row.bank_code?.toUpperCase() || "ยังไม่ระบุธนาคาร"}</strong>
                <div className="slTableSubtle">
                  {row.bank_account_name || "-"} · {row.bank_account_number_masked || "ไม่พบเลขบัญชี"}
                </div>
              </td>
              <td>
                <strong>{row.completed_at ? fmtDateTime(row.completed_at) : "รอดำเนินการ"}</strong>
                <div className="slTableSubtle">สร้างรอบ {fmtDate(row.created_at)}</div>
              </td>
              <td>
                <strong className="slGreen">{fmtBaht(row.selected_net_amount)}</strong>
                <div className="slTableSubtle">ยอดรวมรอบโอน {fmtBaht(row.net_amount)}</div>
              </td>
              <td>
                {row.slip_url ? (
                  <a className="slInlineLink" href={row.slip_url} target="_blank" rel="noreferrer">
                    ดูหลักฐาน <Icon icon="mdi:open-in-new" />
                  </a>
                ) : (
                  <div className="slTableSubtle">
                    {row.omise_transfer_id ? `อ้างอิง ${row.omise_transfer_id}` : "ยังไม่มีหลักฐานแนบ"}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getPayoutStatusMeta(status) {
  if (status === "paid") return { label: "โอนแล้ว", cls: "slStatusPill--green" };
  if (status === "pending") return { label: "รอระบบโอน", cls: "slStatusPill--amber" };
  return { label: "รอตัดรอบ", cls: "slStatusPill--blue" };
}

function getTransferStatusLabel(status) {
  if (status === "completed") return "โอนสำเร็จ";
  if (status === "failed") return "โอนไม่สำเร็จ";
  return "กำลังดำเนินการ";
}

function PageHeader({ title, right, children }) {
  return (
    <>
      <div className="slDashboardHeader">
        <h1 className="slPageTitle">{title}</h1>
        {right}
      </div>
      {children}
    </>
  );
}

function DashboardHero({ title, subtitle, right, children }) {
  return (
    <>
      <div className="slDashboardHero">
        <div className="slDashboardHero__inner">
          <div className="slDashboardHero__left">
            <span className="slDashboardHero__eyebrow">
              <Icon icon="mdi:chart-line" /> Seller Dashboard
            </span>
            <h1 className="slDashboardHero__title">{title}</h1>
            {subtitle && <div className="slDashboardHero__sub">{subtitle}</div>}
          </div>
          {right && <div className="slDashboardHero__right">{right}</div>}
        </div>
      </div>
      {children}
    </>
  );
}

function StatCard({ icon, label, value, subtle, pill, pillGreen }) {
  return (
    <div className="slCard slStatCard">
      <div className="slStatHeader">
        <span>{label}</span>
        <span className="slStatIcon"><Icon icon={icon} /></span>
      </div>
      <div className="slStatValue">{value}</div>
      {subtle && <div className="slStatSubtle">{subtle}</div>}
      {pill && <span className={`slStatPill ${pillGreen ? "slStatPill--green" : ""}`}>{pill}</span>}
    </div>
  );
}

export function FeeSummary({ fee }) {
  if (!fee) return null;
  return (
    <div className="slCard slFeeTable">
      <div style={{ padding: "14px 18px", fontWeight: 700, borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>สรุปรายได้และค่าบริการ (เดือนนี้)</span>
        <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>ค่าธรรมเนียม 15% (ขั้นต่ำ ฿20 ต่อออเดอร์)</span>
      </div>
      <div className="slFeeTable__row">
        <span>ยอดขายรวม (Gross)</span>
        <span className="slBlue" style={{ fontWeight: 700 }}>{fmtBaht(fee.gross)}</span>
      </div>
      <div className="slFeeTable__row" style={{ background: "#fffbeb" }}>
        <span style={{ color: "#92400e" }}>
          ค่าบริการแพลตฟอร์มที่ถูกหัก
          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>
            (ที่ใช้ขั้นต่ำ ฿20: {fmtBaht(fee.fee_min)} / ที่คิด 15%: {fmtBaht(fee.fee_pct)})
          </span>
        </span>
        <span className="slAmber" style={{ fontWeight: 700 }}>-{fmtBaht(fee.fee_total)}</span>
      </div>
      <div className="slFeeTable__row">
        <span>ค่าจัดส่ง (ได้รับเต็มจำนวน)</span>
        <span style={{ fontWeight: 700 }}>+{fmtBaht(fee.shipping_total)}</span>
      </div>
      <div className="slFeeTable__row" style={{ borderTop: "2px solid #e2e8f0" }}>
        <span style={{ fontWeight: 700 }}>รายได้สุทธิเดือนนี้</span>
        <span className="slGreen" style={{ fontWeight: 700, fontSize: 15 }}>{fmtBaht(fee.net)}</span>
      </div>
      <div className="slFeeTable__row" style={{ background: "#fefce8" }}>
        <span style={{ color: "#92400e" }}>
          ยอดเงินระหว่างดำเนินการโอน
          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>({fee.pending_count ?? 0} ออเดอร์รอตัดรอบ)</span>
        </span>
        <span className="slAmber" style={{ fontWeight: 700 }}>{fmtBaht(fee.pending_amount)}</span>
      </div>
      <div className="slFeeTable__row" style={{ background: "#f0fdf4" }}>
        <span style={{ color: "#166534" }}>
          ยอดเงินที่โอนสำเร็จแล้ว (ทั้งหมด)
          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>({fee.paid_count ?? 0} รอบ)</span>
        </span>
        <span className="slGreen" style={{ fontWeight: 700 }}>{fmtBaht(fee.paid_amount)}</span>
      </div>
      <div style={{ padding: "10px 18px", textAlign: "right" }}>
        <Link to="/seller/payouts" style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>
          ดูรายละเอียดรายได้และประวัติการโอนทั้งหมด →
        </Link>
      </div>
    </div>
  );
}
