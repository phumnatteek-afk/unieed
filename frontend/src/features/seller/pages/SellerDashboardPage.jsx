import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { request } from "../../../api/http.js";
import { NotSellerView } from "../layouts/SellerLayout.jsx";

const fmtBaht  = (n) => "฿" + Number(n || 0).toLocaleString();
const fmtCount = (n) => Number(n || 0).toLocaleString();

export default function SellerDashboardPage() {
  const [data, setData]   = useState(null);
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    request("/seller/dashboard")
      .then(d => { if (!cancel) setData(d); })
      .catch(e => { if (!cancel) setErr(e?.data?.message || e.message); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  const chartData = useMemo(() => {
    const c = data?.chart;
    if (!c?.months) return [];
    return c.months.map((m, i) => ({ month: m, net: Number(c.net?.[i] || 0) }));
  }, [data]);

  if (loading) return <PageHeader title="Dashboard ร้านค้า"><div className="slCard">กำลังโหลด...</div></PageHeader>;
  if (err)     return <PageHeader title="Dashboard ร้านค้า"><div className="slCard" style={{color:"#b91c1c"}}>{err}</div></PageHeader>;
  if (!data?.is_seller) return <PageHeader title="Dashboard ร้านค้า"><NotSellerView message={data?.message} /></PageHeader>;

  const s = data.stats;
  const fee = data.fee_summary;
  const tasks = data.tasks || [];
  const maxBar = Math.max(...chartData.map(d => d.net), 0);
  const peak   = chartData.reduce((a, b) => b.net > (a?.net || 0) ? b : a, null);

  return (
    <>
      <PageHeader title="Dashboard ร้านค้า" right={
        <Link to="/sell" className="slBtnPrimary slBtn"><Icon icon="mdi:plus" /> เพิ่มสินค้า</Link>
      } />

      {/* 4 cards */}
      <div className="slStatGrid">
        <StatCard icon="lets-icons:order" label="คำสั่งซื้อวันนี้" value={`${fmtCount(s.orders_today)} รายการ`} pill={s.orders_pending>0 ? `รอยืนยัน ${s.orders_pending}` : null} />
        <StatCard icon="mdi:trending-up" label="รายได้เดือนนี้" value={fmtBaht(s.revenue_this_month)} subtle="หลังหักค่าธรรมเนียม" />
        <StatCard icon="lets-icons:order" label="รอระบบดำเนินการโอน" value={fmtBaht(s.payout_pending_total)} subtle={`${s.payout_pending_count} รายการ`} />
        <StatCard icon="mdi:package-variant" label="สินค้าทั้งหมด" value={`${fmtCount(s.products_total)} รายการ`} pill={s.products_sold>0 ? `ขายแล้ว ${s.products_sold}` : null} pillGreen />
      </div>

      {/* Chart + Pending */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14, marginBottom:18 }} className="slIncomeColumns">
        <div className="slCard">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:"#94a3b8" }}>รายได้รายเดือน</div>
            <select className="slSelect">
              <option>รายเดือน</option>
            </select>
          </div>
          <div style={{ width:"100%", height:280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={v => `฿${v}`} />
                <Tooltip formatter={v => fmtBaht(v)} />
                <Bar dataKey="net" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {peak?.net > 0 && (
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>สูงสุด: {fmtBaht(maxBar)} (เดือน{peak.month})</div>
          )}
        </div>

        <div className="slCard">
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <strong>รายการรอดำเนินงาน</strong>
            <span style={{ color:"#94a3b8", fontSize:12 }}>{tasks.length} รายการ</span>
          </div>
          {tasks.length === 0
            ? <div style={{ color:"#94a3b8", fontSize:13, padding:"10px 0" }}>ไม่มีรายการที่รอดำเนินการ</div>
            : tasks.map(t => (
                <Link key={t.key} to={t.url} className="slPendingItem" style={{ textDecoration:"none", color:"#0f172a" }}>
                  <span><span className="slPendingItem__dot" />{t.label}</span>
                  <Icon icon="mdi:chevron-right" />
                </Link>
              ))
          }
        </div>
      </div>

      {/* Fee summary */}
      <FeeSummary fee={fee} />
    </>
  );
}

/* ─── small helpers ─── */

function PageHeader({ title, right, children }) {
  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h1 className="slPageTitle" style={{ marginBottom:0 }}>{title}</h1>
        {right}
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
      <div style={{ padding:"14px 18px", fontWeight:700, borderBottom:"1px solid #f1f5f9" }}>
        สรุปค่าธรรมเนียม (เดือนนี้)
      </div>
      <div className="slFeeTable__row">
        <span>รายได้รวมจากคำสั่งซื้อ</span>
        <span className="slBlue" style={{ fontWeight:700 }}>{fmtBaht(fee.gross)}</span>
      </div>
      <div className="slFeeTable__row">
        <span>ค่าธรรมเนียมขั้นต่ำ (฿20)</span>
        <span className="slAmber" style={{ fontWeight:700 }}>{fmtBaht(fee.fee_min)}</span>
      </div>
      <div className="slFeeTable__row">
        <span>ค่าธรรมเนียมระบบ 15%</span>
        <span className="slAmber" style={{ fontWeight:700 }}>{fmtBaht(fee.fee_pct)}</span>
      </div>
      <div className="slFeeTable__row">
        <span>ค่าจัดส่ง</span>
        <span style={{ fontWeight:700 }}>{fmtBaht(fee.shipping_total)}</span>
      </div>
      <div className="slFeeTable__row">
        <span>รายได้สุทธิที่ได้รับ</span>
        <span className="slGreen" style={{ fontWeight:700 }}>{fmtBaht(fee.net)}</span>
      </div>
    </div>
  );
}
