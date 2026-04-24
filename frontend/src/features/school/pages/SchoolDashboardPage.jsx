import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { getJson } from "../../../api/http.js";
import "./SchoolDashboardPage.css";

const STATUS_COLORS = {
  approved: "#22C55E",
  pending:  "#FFBE1B",
  dropoff:  "#29B6E8",
  rejected: "#EF4444",
};
const DONUT_LABELS = {
  approved: "ยืนยันแล้ว",
  pending:  "รอดำเนินการ",
  dropoff:  "รอ drop-off",
  rejected: "ปฏิเสธ",
};

function StatusBadge({ status }) {
  const map = {
    open:   { label: "กำลังเปิดรับบริจาค", color: "#22C55E", bg: "#F0FDF4" },
    closed: { label: "ปิดรับบริจาคแล้ว",   color: "#6B7280", bg: "#F3F4F6" },
    paused: { label: "พักชั่วคราว",          color: "#F59E0B", bg: "#FFFBEB" },
  };
  const s = map[status] || map.closed;
  return (
    <span className="dbStatusBadge" style={{ color: s.color, background: s.bg }}>
      <span className="dbStatusDot" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export default function SchoolDashboardPage() {
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson("/school/dashboard", true)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="dbLoading">กำลังโหลด...</div>;
  if (!data)   return <div className="dbLoading">ไม่สามารถโหลดข้อมูลได้</div>;

  const { project, stats, chart_by_level, chart_by_status, action_items, testimonials } = data;

  const donutData = Object.entries(chart_by_status)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: DONUT_LABELS[key], value, color: STATUS_COLORS[key] }));
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  const totalActions =
    (action_items.pending_donations?.length || 0) +
    (action_items.overdue_dropoffs?.length || 0) +
    (action_items.today_appointments?.length || 0);

  return (
    <div className="dbPage">

      {/* ── Section 1: Project banner ── */}
      {project ? (
        <div className="dbProjectCard">
          <div className="dbProjectLeft">
            <div className="dbProjectTitle">{project.request_title}</div>
            <div className="dbProjectMeta">
              <StatusBadge status={project.status} />
              <span className="dbProjectDate">
                สิ้นสุด {project.end_date
                  ? new Date(project.end_date).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
                  : "—"}
                {project.days_remaining != null && project.days_remaining >= 0
                  ? ` · เหลืออีก ${project.days_remaining} วัน`
                  : project.days_remaining < 0 ? " · หมดเวลาแล้ว" : ""}
              </span>
            </div>
            <div className="dbProgressLabel">
              <span>ชุดที่ได้รับ</span>
              <span className="dbProgressCount">
                {project.total_fulfilled} / {project.total_needed} ชุด
              </span>
            </div>
            <div className="dbProgressBar">
              <div
                className="dbProgressFill"
                style={{ width: project.total_needed > 0 ? `${Math.min((project.total_fulfilled / project.total_needed) * 100, 100)}%` : "0%" }}
              />
            </div>
            <div className="dbProgressPct">
              ความคืบหน้า {project.total_needed > 0 ? Math.round((project.total_fulfilled / project.total_needed) * 100) : 0}%
              <span style={{ float: "right", color: "#6B7280" }}>เป้าหมาย {project.total_needed} ชุด</span>
            </div>
          </div>
          <button className="dbManageBtn" onClick={() => navigate(`/school/projects/${project.request_id}`)}>
            จัดการโครงการ →
          </button>
        </div>
      ) : (
        <div className="dbProjectCard dbProjectEmpty">
          <p>ยังไม่มีโครงการ</p>
          <button className="dbManageBtn" onClick={() => navigate("/school/projects/manage")}>
            สร้างโครงการใหม่
          </button>
        </div>
      )}

      {/* ── Section 2: Stat cards ── */}
      <div className="dbStatGrid">
        {[
          { label: "รอส่งมอบ",        value: stats.pending,          accent: "red",
            svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0"/><path d="M12 7v5l3 3"/></g></svg> },
          { label: "ส่งมอบสำเร็จ",    value: stats.approved,         accent: "green",
            svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 7h-1.21c.13-.41.21-.9.21-1.5C19 3.57 17.43 2 15.5 2c-1.62 0-2.7 1.48-3.4 3.09C11.41 3.58 10.27 2 8.5 2C6.57 2 5 3.57 5 5.5c0 .6.08 1.09.21 1.5H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2m-4.5-3c.83 0 1.5.67 1.5 1.5C17 7 16.37 7 16 7h-2.48c.51-1.58 1.25-3 1.98-3M7 5.5C7 4.67 7.67 4 8.5 4c.89 0 1.71 1.53 2.2 3H8c-.37 0-1 0-1-1.5M4 9h7v2H4zm2 11v-7h5v7zm12 0h-5v-7h5zm-5-9V9.08s.01-.06.02-.08H20v2z"/></svg> },
          { label: "นัดหมายวันนี้",   value: stats.dropoff_today,    accent: "orange",
            svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M8 2v3m8-3v3M3.5 9.09h17M21 8.5V17c0 3-1.5 5-5 5H8c-3.5 0-5-2-5-5V8.5c0-3 1.5-5 5-5h8c3.5 0 5 2 5 5"/><path d="M15.695 13.4h.009m-.009 3h.009M11.995 13.4h.01m-.01 3h.01M8.294 13.4h.01m-.01 3h.01"/></g></svg> },
          { label: "นักเรียนทั้งหมด", value: stats.students_waiting,  accent: "blue",
            svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M2.5 6L8 4l5.5 2L11 7.5V9s-.667-.5-3-.5S5 9 5 9V7.5zm0 0v4"/><path d="M11 8.5v.889c0 1.718-1.343 3.111-3 3.111s-3-1.393-3-3.111V8.5m10.318 2.53s.485-.353 2.182-.353s2.182.352 2.182.352m-4.364 0V10L13.5 9l4-1.5l4 1.5l-1.818 1v1.03m-4.364 0v.288a2.182 2.182 0 1 0 4.364 0v-.289M4.385 15.926c-.943.527-3.416 1.602-1.91 2.947C3.211 19.53 4.03 20 5.061 20h5.878c1.03 0 1.85-.47 2.586-1.127c1.506-1.345-.967-2.42-1.91-2.947c-2.212-1.235-5.018-1.235-7.23 0M16 20h3.705c.773 0 1.387-.376 1.939-.902c1.13-1.076-.725-1.936-1.432-2.357A5.34 5.34 0 0 0 16 16.214"/></g></svg> },
        ].map(s => (
          <div key={s.label} className={`dbStatCard dbStatCard--${s.accent}`}>
            <div className="dbStatIconWrap">{s.svg}</div>
            <div>
              <div className="dbStatValue">{s.value}</div>
              <div className="dbStatLabel">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 3: Charts ── */}
      <div className="dbChartRow">
        <div className="dbChartCard">
          <div className="dbChartTitle">ความคืบหน้าต่อระดับชั้น</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart_by_level} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="received" name="ได้รับแล้ว" fill="#29B6E8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="remaining" name="คงเหลือ" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dbChartCard">
          <div className="dbChartTitle">สัดส่วนสถานะบริจาค</div>
          {donutTotal > 0 ? (
            <>
              <div className="dbDonutLegend">
                {donutData.map(d => (
                  <span key={d.name} className="dbDonutLegendItem">
                    <span className="dbDonutDot" style={{ background: d.color }} />
                    {d.name} {d.value}
                  </span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="dbDonutCenter">{donutTotal}<br /><span>รายการทั้งหมด</span></div>
            </>
          ) : (
            <div className="dbChartEmpty">ยังไม่มีข้อมูลการบริจาค</div>
          )}
        </div>
      </div>

      {/* ── Section 4: Action items ── */}
      <div className="dbCard">
        <div className="dbCardHeader">
          <span className="dbCardTitle">รายการที่ต้องดำเนินการ</span>
          {totalActions > 0 && <span className="dbBadgeCount">{totalActions}</span>}
        </div>

        {totalActions === 0 ? (
          <div className="dbActionEmpty">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" style={{ color: "#22C55E" }}><path fill="currentColor" fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z" clipRule="evenodd"/></svg>
            <span>ไม่มีรายการรอดำเนินการ</span>
          </div>
        ) : (
          <div className="dbActionList">
            {action_items.pending_donations?.map(d => (
              <div key={d.donation_id} className="dbActionItem">
                <div className="dbActionIcon" style={{ background: "#FEF3C7" }}>⏳</div>
                <div className="dbActionBody">
                  <div className="dbActionTitle">มีคำขอบริจาครอการยืนยัน จาก {d.donor_name}</div>
                  <div className="dbActionSub">จำนวน {d.quantity} ชุด · {d.delivery_method === "shipping" ? "ส่งพัสดุ" : "drop-off"}</div>
                </div>
                <button className="dbActionBtn" onClick={() => navigate("/school/donations")}>ยืนยัน</button>
              </div>
            ))}
            {action_items.overdue_dropoffs?.map(d => (
              <div key={d.donation_id} className="dbActionItem">
                <div className="dbActionIcon" style={{ background: "#FEE2E2" }}>📦</div>
                <div className="dbActionBody">
                  <div className="dbActionTitle">นัดหมาย drop-off เกินกำหนด — {d.donor_name}</div>
                  <div className="dbActionSub">
                    กำหนด {d.donation_date ? new Date(d.donation_date).toLocaleDateString("th-TH") : "—"}
                    {d.donor_phone ? ` · ${d.donor_phone}` : ""}
                  </div>
                </div>
                <button className="dbActionBtn" onClick={() => navigate("/school/appointments")}>จัดการ</button>
              </div>
            ))}
            {action_items.today_appointments?.map(d => (
              <div key={d.donation_id} className="dbActionItem">
                <div className="dbActionIcon" style={{ background: "#E0F2FE" }}>📅</div>
                <div className="dbActionBody">
                  <div className="dbActionTitle">นัดหมายรับชุดวันนี้ · {d.donor_name}</div>
                  <div className="dbActionSub">
                    เวลา {d.donation_time ? d.donation_time.slice(0, 5) : "—"} น.
                    {d.donor_phone ? ` · ${d.donor_phone}` : ""}
                  </div>
                </div>
                <button className="dbActionBtn" onClick={() => navigate("/school/appointments")}>ดูรายละเอียด</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 5: Testimonials ── */}
      <div className="dbCard">
        <div className="dbCardHeader">
          <div>
            <span className="dbCardTitle">ความประทับใจที่โรงเรียนบันทึกไว้</span>
            <div className="dbCardSub">จากโครงการล่าสุด</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="dbSecBtn" onClick={() => navigate("/school/testimonials")}>ดูทั้งหมด →</button>
            <button className="dbPriBtn" onClick={() => navigate("/school/testimonials")}>+ บันทึกความประทับใจ</button>
          </div>
        </div>

        {testimonials?.length > 0 ? (
          <div className="dbTestiGrid">
            {testimonials.map(t => (
              <div key={t.testimonial_id} className="dbTestiCard">
                <div className="dbTestiQuote">"</div>
                <p className="dbTestiText">{t.review_text}</p>
                <div className="dbTestiMeta">
                  <span className="dbTestiProject">{t.project_title || "โครงการที่ไม่ระบุ"}</span>
                  <span className="dbTestiDate">
                    บันทึกเมื่อ {t.review_date}
                    {t.recorded_by_name ? ` · ${t.recorded_by_name}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dbActionEmpty">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 16 16" style={{ color: "#F9A8D4" }}><path fill="currentColor" d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7s-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6c-.097 1.016-.417 2.13-.771 2.966c-.079.186.074.394.273.362c2.256-.37 3.597-.938 4.18-1.234A9 9 0 0 0 8 15m0-9.007c1.664-1.711 5.825 1.283 0 5.132c-5.825-3.85-1.664-6.843 0-5.132"/></svg>
            <span>ยังไม่มีความประทับใจ</span>
            <button className="dbPriBtn" style={{ marginTop: 8 }} onClick={() => navigate("/school/testimonials")}>
              + บันทึกความประทับใจแรก
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
