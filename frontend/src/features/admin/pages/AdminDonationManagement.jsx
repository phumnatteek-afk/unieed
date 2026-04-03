// AdminDonationManagement.jsx
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const formatDate = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// ── DaysBadge ─────────────────────────────────────────────────────────────────
function DaysBadge({ days }) {
  const color = days >= 14 ? "#dc2626" : days >= 10 ? "#d97706" : "#2563eb";
  const bg    = days >= 14 ? "#fee2e2" : days >= 10 ? "#fef3c7" : "#eff6ff";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:600, color, background:bg }}>
      <Icon icon="mdi:clock-alert-outline" width={13} />
      {days} วัน
    </span>
  );
}

// ── Confirm Popup ─────────────────────────────────────────────────────────────
function ConfirmPopup({ donation, onConfirm, onCancel, loading }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onCancel}>
      <div style={{ background:"#fff", borderRadius:16, padding:"28px 32px", maxWidth:420, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:32, textAlign:"center", marginBottom:12 }}>✅</div>
        <div style={{ fontWeight:700, fontSize:16, color:"#0f172a", textAlign:"center", marginBottom:8 }}>
          อนุมัติรายการบริจาค
        </div>
        <div style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:20 }}>
          อนุมัติการบริจาคจาก <strong>{donation.donor_name}</strong> และออกใบ Certificate ให้ผู้บริจาคทันที
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding:"9px 20px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            ยกเลิก
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding:"9px 20px", borderRadius:8, border:"none", background: loading ? "#94a3b8" : "#2563eb", color:"#fff", fontSize:13, fontWeight:600, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "กำลังอนุมัติ..." : "ยืนยันอนุมัติ"}
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Reject Popup ──────────────────────────────────────────────────────────────
function RejectPopup({ donation, onReject, onCancel, loading }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onCancel}>
      <div style={{ background:"#fff", borderRadius:16, padding:"28px 32px", maxWidth:460, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:32, textAlign:"center", marginBottom:12 }}>❌</div>
        <div style={{ fontWeight:700, fontSize:16, color:"#0f172a", textAlign:"center", marginBottom:8 }}>ไม่อนุมัติรายการบริจาค</div>
        <div style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:20 }}>จาก <strong>{donation.donor_name}</strong></div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:6 }}>
            เหตุผลที่ไม่อนุมัติ <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <textarea rows={4}
            placeholder="เช่น พัสดุถูกตีกลับ, ของที่บริจาคไม่ตรงความต้องการ, ไม่มีหลักฐานการส่ง..."
            value={reason} onChange={e => setReason(e.target.value)}
            style={{ width:"100%", boxSizing:"border-box", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#1e293b", resize:"vertical", outline:"none", fontFamily:"inherit", lineHeight:1.6 }}
            onFocus={e => e.target.style.borderColor="#dc2626"}
            onBlur={e => e.target.style.borderColor="#e2e8f0"}
          />
          {reason.trim() === "" && <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>กรุณากรอกเหตุผล</div>}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding:"9px 20px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer" }}>ยกเลิก</button>
          <button onClick={() => onReject(reason)} disabled={loading || !reason.trim()}
            style={{ padding:"9px 20px", borderRadius:8, border:"none", background:(loading || !reason.trim()) ? "#94a3b8" : "#dc2626", color:"#fff", fontSize:13, fontWeight:600, cursor:(loading || !reason.trim()) ? "not-allowed" : "pointer" }}>
            {loading ? "กำลังบันทึก..." : "ยืนยันไม่อนุมัติ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Image Preview Popup ───────────────────────────────────────────────────────
function ImagePopup({ url, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}>
      <div style={{ position:"relative", maxWidth:"90vw", maxHeight:"90vh" }} onClick={e => e.stopPropagation()}>
        <img src={url} alt="หลักฐาน" style={{ maxWidth:"90vw", maxHeight:"85vh", borderRadius:12, objectFit:"contain" }} />
        <button onClick={onClose}
          style={{ position:"absolute", top:-12, right:-12, width:32, height:32, borderRadius:"50%", background:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.2)" }}>
          <Icon icon="mdi:close" width={18} />
        </button>
      </div>
    </div>
  );
}

// ── Donation Row ──────────────────────────────────────────────────────────────
function DonationRow({ donation, onApprove, token }) {
  const [showConfirm, setShowConfirm]   = useState(false);
const [showReject, setShowReject]     = useState(false);
const [showImage, setShowImage]       = useState(false);
const [approving, setApproving]       = useState(false);
const [rejecting, setRejecting]       = useState(false);
const [approved, setApproved]         = useState(false);
const [rejected, setRejected]         = useState(false);
const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async () => {
    try {
      setApproving(true);
      await fetch(`${BASE}/donations/${donation.donation_id}/verify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          condition_status: "usable",
          thank_message: "แอดมินได้ตรวจสอบและอนุมัติการบริจาคของท่านเรียบร้อยแล้ว ขอขอบคุณสำหรับน้ำใจของท่าน",
        }),
      });
      setApproved(true);
      setShowConfirm(false);
      onApprove?.();
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (reason) => {
  try {
    setRejecting(true);
    await fetch(`${BASE}/donations/${donation.donation_id}/status`, {
      method: "PATCH",
      headers: { "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) },
      body: JSON.stringify({ status:"rejected", reject_reason: reason }),
    });
    setRejected(true);
    setRejectReason(reason);
    setShowReject(false);
    onApprove?.();
  } catch (e) { console.error(e); }
  finally { setRejecting(false); }
    };

  return (
    <>
      <tr style={{ background: approved ? "#f0fdf4" : "transparent", transition:"background 0.3s" }}>
        {/* วันที่ */}
        <td style={{ padding:"12px 16px", fontSize:13, color:"#475569", whiteSpace:"nowrap" }}>
          {formatDate(donation.created_at)}
        </td>

        {/* ผู้บริจาค */}
        <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#1e293b" }}>
          {donation.donor_name}
        </td>

        {/* ข้อมูลขนส่ง */}
        <td style={{ padding:"12px 16px" }}>
          <div style={{ fontSize:12, color:"#475569" }}>{donation.shipping_carrier}</div>
          <div style={{ fontSize:12, color:"#2563eb", fontFamily:"monospace" }}>
            #{donation.tracking_number}
          </div>
        </td>

        {/* หลักฐาน */}
        <td style={{ padding:"12px 16px" }}>
          {donation.donation_pic ? (
            <button onClick={() => setShowImage(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:8, border:"1.5px solid #bfdbfe", background:"#eff6ff", color:"#2563eb", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <Icon icon="mdi:image-outline" width={14} />
              ดูรูปภาพ
            </button>
          ) : (
            <span style={{ fontSize:12, color:"#cbd5e1" }}>ไม่มี</span>
          )}
        </td>

        {/* ผ่านมาแล้ว */}
        <td style={{ padding:"12px 16px" }}>
          <DaysBadge days={donation.days_elapsed} />
        </td>

        {/* สถานะ */}
        <td style={{ padding:"12px 16px" }}>
          {approved ? (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:"#16a34a", background:"#dcfce7", padding:"3px 10px", borderRadius:20 }}>
              <Icon icon="mdi:check" width={13} />อนุมัติแล้ว
            </span>
          ) : donation.auto_approved ? (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:"#16a34a", background:"#dcfce7", padding:"3px 10px", borderRadius:20 }}>
              <Icon icon="mdi:robot-outline" width={13} />Auto-approved
            </span>
          ) : (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:"#d97706", background:"#fef3c7", padding:"3px 10px", borderRadius:20 }}>
              <Icon icon="mdi:clock-outline" width={13} />รอ Auto-check
            </span>
          )}
        </td>

        {/* จัดการ */}
        <td style={{ padding:"12px 16px" }}>
                    {/* เป็น */}
            {!approved && !rejected && !donation.auto_approved && (
            <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setShowConfirm(true)}
                style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                <Icon icon="mdi:check-circle-outline" width={14} />อนุมัติ
                </button>
                <button onClick={() => setShowReject(true)}
                style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, border:"1.5px solid #fca5a5", background:"#fff5f5", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                <Icon icon="mdi:close-circle-outline" width={14} />ไม่อนุมัติ
                </button>
            </div>
            )}
        </td>
      </tr>

      {/* Popups */}
      {showConfirm && (
        <ConfirmPopup
          donation={donation}
          onConfirm={handleApprove}
          onCancel={() => setShowConfirm(false)}
          loading={approving}
        />
      )}

      {/* และเพิ่ม RejectPopup ต่อจาก ConfirmPopup */}
        {showReject && (
        <RejectPopup donation={donation} onReject={handleReject} onCancel={() => setShowReject(false)} loading={rejecting} />
        )}
      {showImage && donation.donation_pic && (
        <ImagePopup url={donation.donation_pic} onClose={() => setShowImage(false)} />
      )}
    </>
  );
}

// ── School Card ───────────────────────────────────────────────────────────────
function SchoolCard({ school, onSelect }) {
  const maxDays = Math.max(...school.donations.map(d => d.days_elapsed));
  const urgent  = maxDays >= 14;
  return (
    <div onClick={() => onSelect(school)}
      style={{ background:"#fff", border: urgent ? "1.5px solid #fca5a5" : "1.5px solid #e2e8f0", borderRadius:14, padding:"18px 20px", cursor:"pointer", transition:"box-shadow 0.15s, transform 0.15s", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none"; }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:44, height:44, borderRadius:12, background: urgent ? "#fee2e2" : "#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Icon icon="teenyicons:school-outline" width={22} color={urgent ? "#dc2626" : "#2563eb"} />
        </div>
        <div>
          <div style={{ fontWeight:600, fontSize:14, color:"#1e293b" }}>{school.school_name}</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>
            {school.donations.length} รายการรอดำเนินการ · รายการเก่าสุด <DaysBadge days={maxDays} />
          </div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {urgent && <span style={{ fontSize:11, fontWeight:600, color:"#dc2626", background:"#fee2e2", padding:"3px 9px", borderRadius:20 }}>เร่งด่วน</span>}
        <Icon icon="mdi:chevron-right" width={20} color="#94a3b8" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminDonationManagement() {
  const { token } = useAuth();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [schools, setSchools]           = useState([]);
  const [stats, setStats]               = useState({ total:0, schools:0, urgent:0 });
  const [loading, setLoading]           = useState(true);
  const [running, setRunning]           = useState(false);
  const [lastRun, setLastRun]           = useState(null);
  const [runResult, setRunResult]       = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [search, setSearch]             = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BASE}/admin/autocheck/overdue/by-school`, { headers });
      const json = await res.json();
      const list = json.schools ?? [];
      setSchools(list);
      const totalDonations = list.reduce((s, sc) => s + sc.donations.length, 0);
      const urgentSchools  = list.filter(sc => sc.donations.some(d => d.days_elapsed >= 14)).length;
      setStats({ total:totalDonations, schools:list.length, urgent:urgentSchools });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleRunAutoCheck = async () => {
    try {
      setRunning(true);
      setRunResult(null);
      const res  = await fetch(`${BASE}/admin/autocheck/run`, { method:"POST", headers });
      const json = await res.json();
      setRunResult(json.summary);
      setLastRun(new Date().toLocaleTimeString("th-TH"));
      await loadData();
    } catch (e) { console.error(e); }
    finally { setRunning(false); }
  };

  const filteredSchools = useMemo(() =>
    schools.filter(sc => !search || sc.school_name.toLowerCase().includes(search.toLowerCase())),
    [schools, search]
  );

  // sync selectedSchool หลัง loadData
  const syncSelectedSchool = () => {
    if (selectedSchool) {
      const updated = schools.find(sc => sc.school_id === selectedSchool.school_id);
      if (updated) setSelectedSchool(updated);
    }
  };

  const handleApproved = () => { loadData().then(syncSelectedSchool); };

  return (
    <div style={{ padding:"28px 32px", maxWidth:1200, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"#0f172a", margin:0 }}>จัดการการบริจาค</h1>
          <p style={{ fontSize:13, color:"#64748b", margin:"4px 0 0" }}>รายการที่เกิน 7 วันและยังไม่ได้รับการยืนยันจากโรงเรียน</p>
        </div>
        <button onClick={handleRunAutoCheck} disabled={running}
          style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", borderRadius:10, border:"none", background: running ? "#94a3b8" : "#2563eb", color:"#fff", fontSize:13, fontWeight:600, cursor: running ? "not-allowed" : "pointer" }}>
          <Icon icon={running ? "mdi:loading" : "mdi:robot-outline"} width={16} style={running ? { animation:"spin 1s linear infinite" } : {}} />
          {running ? "กำลังรัน..." : "รัน Auto-check ทันที"}
        </button>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"12px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10, fontSize:13, color:"#15803d" }}>
          <Icon icon="mdi:check-circle-outline" width={18} />
          <span>Auto-check เสร็จสิ้น · ตรวจสอบแล้ว <strong>{runResult.total}</strong> รายการ · Auto-approved <strong>{runResult.approved}</strong> รายการ {lastRun && `· รันเมื่อ ${lastRun}`}</span>
          <button onClick={() => setRunResult(null)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer" }}>
            <Icon icon="mdi:close" width={16} color="#15803d" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
        {[
          { label:"โรงเรียนที่รอดำเนินการ",    value:stats.schools, icon:"teenyicons:school-outline",   color:"#2563eb", bg:"#eff6ff" },
          { label:"รายการทั้งหมดที่เกิน 7 วัน", value:stats.total,   icon:"mdi:package-variant-closed",  color:"#d97706", bg:"#fef3c7" },
          { label:"โรงเรียนเร่งด่วน (≥14 วัน)", value:stats.urgent,  icon:"mdi:alert-circle-outline",    color:"#dc2626", bg:"#fee2e2" },
        ].map(card => (
          <div key={card.label} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:14, padding:"18px 20px", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:card.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon icon={card.icon} width={22} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize:24, fontWeight:700, color:card.color }}>{card.value}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail or List */}
      {selectedSchool ? (
        <div>
          <button onClick={() => setSelectedSchool(null)}
            style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#2563eb", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:16, padding:0 }}>
            <Icon icon="mdi:arrow-left" width={16} />
            กลับไปหน้ารายการโรงเรียน
          </button>

          <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:14, overflow:"hidden" }}>
            {/* School header */}
            <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon icon="teenyicons:school-outline" width={18} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:"#0f172a" }}>{selectedSchool.school_name}</div>
                <div style={{ fontSize:12, color:"#64748b" }}>{selectedSchool.donations.length} รายการที่เกิน 7 วันและยังไม่ได้รับการยืนยัน</div>
              </div>
            </div>

            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["วันที่บริจาค","ผู้บริจาค","ข้อมูลขนส่ง","หลักฐาน","ผ่านมาแล้ว","สถานะ","จัดการ"].map(h => (
                    <th key={h} style={{ padding:"10px 16px", fontSize:12, fontWeight:600, color:"#64748b", textAlign:"left", borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedSchool.donations.map(d => (
                  <DonationRow key={d.donation_id} donation={d} onApprove={handleApproved} token={token} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          {/* Search */}
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:10, padding:"9px 14px", marginBottom:16, maxWidth:400 }}>
            <Icon icon="mdi:magnify" width={18} color="#94a3b8" />
            <input style={{ border:"none", outline:"none", fontSize:13, flex:1, color:"#334155" }}
              placeholder="ค้นหาชื่อโรงเรียน..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div style={{ textAlign:"center", padding:48, color:"#94a3b8", fontSize:13 }}>กำลังโหลด...</div>
          ) : filteredSchools.length === 0 ? (
            <div style={{ textAlign:"center", padding:48, color:"#94a3b8", fontSize:13, background:"#fff", borderRadius:14, border:"1.5px solid #e2e8f0" }}>
              <Icon icon="mdi:check-circle-outline" width={36} color="#86efac" />
              <div style={{ marginTop:12 }}>ไม่มีรายการที่เกิน 7 วัน 🎉</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filteredSchools.map(school => (
                <SchoolCard key={school.school_id} school={school} onSelect={setSelectedSchool} />
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}