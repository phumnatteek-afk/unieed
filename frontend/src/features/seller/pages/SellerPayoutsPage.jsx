import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { request } from "../../../api/http.js";
import { NotSellerView } from "../layouts/SellerLayout.jsx";
import { FeeSummary } from "./SellerDashboardPage.jsx";

const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString();

const BANK_LIST = [
  { code: "kbank", name: "ธนาคารกสิกรไทย (KBank)", color: "#00994D", logo: "KBANK", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Kasikornbank_logo.svg/200px-Kasikornbank_logo.svg.png" },
  { code: "scb",   name: "ธนาคารไทยพาณิชย์ (SCB)", color: "#4A148C", logo: "SCB", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Siam_Commercial_Bank_logo.svg/200px-Siam_Commercial_Bank_logo.svg.png" },
  { code: "bbl",   name: "ธนาคารกรุงเทพ (BBL)", color: "#1E40AF", logo: "BBL", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Bangkok_Bank_logo.svg/200px-Bangkok_Bank_logo.svg.png" },
  { code: "ktb",   name: "ธนาคารกรุงไทย (KTB)", color: "#0EA5E9", logo: "KTB", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Krung_Thai_Bank_logo.svg/200px-Krung_Thai_Bank_logo.svg.png" },
  { code: "bay",   name: "ธนาคารกรุงศรีอยุธยา (BAY)", color: "#F59E0B", logo: "BAY", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Bank_of_Ayudhya_logo.svg/200px-Bank_of_Ayudhya_logo.svg.png" },
  { code: "ttb",   name: "ธนาคารทีทีบี (ttb)", color: "#2563EB", logo: "TTB", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/TMBThanachart_logo.svg/200px-TMBThanachart_logo.svg.png" },
  { code: "gsb",   name: "ธนาคารออมสิน (GSB)", color: "#EC4899", logo: "GSB", logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Government_Savings_Bank_logo.svg/200px-Government_Savings_Bank_logo.svg.png" },
];

const sanitizeName = (v) => String(v || "").trim().replace(/\s+/g, " ");
const sanitizeNumber = (v) => String(v || "").replace(/\D/g, "");
const formatNumber = (v) => {
  const num = sanitizeNumber(v);
  if (!num) return "";
  if (num.length <= 3) return num;
  if (num.length <= 7) return `${num.slice(0, 3)}-${num.slice(3)}`;
  return `${num.slice(0, 3)}-${num.slice(3, 4)}-${num.slice(4, 9)}-${num.slice(9)}`;
};

function BankLogo({ bank, size = 30 }) {
  const [imgErr, setImgErr] = useState(false);
  if (!bank) return <Icon icon="mdi:bank" width={24} />;
  if (!imgErr && bank.logo_url) {
    return (
      <img
        src={bank.logo_url}
        alt={bank.logo}
        onError={() => setImgErr(true)}
        style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: bank.color, color: "#fff", fontSize: 10, fontWeight: 700, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {bank.logo}
    </div>
  );
}

export default function SellerPayoutsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editingBank, setEditingBank] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await request("/seller/payouts");
      setData(d); setErr("");
    } catch (e) {
      setErr(e?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancel = false;
    (async () => { if (!cancel) await load(); })();
    return () => { cancel = true; };
  }, [load]);

  if (loading) return <Wrap><div className="slCard">กำลังโหลด...</div></Wrap>;
  if (err)     return <Wrap><div className="slCard" style={{color:"#b91c1c"}}>{err}</div></Wrap>;
  if (!data?.is_seller) return <Wrap><NotSellerView message={data?.message} /></Wrap>;

  const s    = data.stats;
  const bank = data.bank;
  const selectedBank = BANK_LIST.find(b => b.code === bank?.bank_code);

  return (
    <Wrap>
      {/* 3 cards */}
      <div className="slIncomeGrid">
        <Card label="รายได้สุทธิเดือนนี้" value={fmtBaht(s.this_month_net)} subtitle="หลังหักค่าธรรมเนียมทั้งหมด" cls="slBlue" />
        <Card label="รอระบบดำเนินการโอน" value={fmtBaht(s.pending_total)} subtitle={`${s.pending_count} รายการ`} cls="slAmber" />
        <Card label="โอนเข้าบัญชีแล้ว" value={fmtBaht(s.paid_total)} subtitle={`${s.paid_count} รายการ`} cls="slGreen" />
      </div>

      <div className="slIncomeColumns">
        {/* History */}
        <div className="slCard">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <strong>ประวัติการโอนเงิน</strong>
            <button className="slBtnPrimary slBtn">ดูทั้งหมด</button>
          </div>
          {data.history?.length === 0
            ? <div style={{ color:"#94a3b8", padding:20, textAlign:"center" }}>ยังไม่มีประวัติการโอน</div>
            : data.history.map(p => (
                <PayoutRow key={p.payout_id} p={p} />
              ))
          }
        </div>

        {/* Bank account + fee note */}
        <div>
          <div className="slBankCard">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h4>บัญชีรับเงิน</h4>
              <button className="slBankCard__editBtn" onClick={() => setEditingBank(true)}>แก้ไข</button>
            </div>
            <div className="slBankCard__row" style={{ marginTop:10 }}>
              <div className="slBankCard__icon">
                <BankLogo bank={selectedBank} size={30} />
              </div>
              <div>
                <div style={{ fontSize:12, color:"#64748b" }}>ธนาคาร</div>
                <div style={{ fontWeight:700 }}>
                  {BANK_LIST.find(b => b.code === bank?.bank_code)?.name || bank?.bank_code || "ยังไม่ได้ตั้งค่า"}
                </div>
                {bank?.bank_account_number && (
                  <>
                    <div style={{ fontSize:12, color:"#64748b", marginTop:6 }}>
                      เลขบัญชี: {bank.bank_account_number_masked || `xxxxx${String(bank.bank_account_number).slice(-4)}`}
                    </div>
                    <div style={{ fontSize:12, color:"#64748b" }}>ชื่อบัญชี: {bank.bank_account_name}</div>
                    <div style={{ fontSize:12, color: bank?.is_verified ? "#16a34a" : "#f59e0b", marginTop:4 }}>
                      สถานะยืนยันบัญชี: {bank?.is_verified ? "ยืนยันแล้ว" : "รอตรวจสอบ"}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="slCard" style={{ marginTop:14 }}>
            <strong>ความเข้าใจค่าธรรมเนียม</strong>
            <div className="slFeeNote">
              ค่าธรรมเนียมการใช้แพลตฟอร์มจะถูกหักจากราคาสินค้าก่อนโอนรายได้ให้ผู้ขายโดยมีเกณฑ์ดังนี้
              <ul>
                <li>สินค้าที่มีราคาตั้งแต่ ฿100 ขึ้นไป — หักค่าธรรมเนียม ร้อยละ 15 ของราคาสินค้า</li>
                <li>สินค้าที่มีราคา ไม่เกิน ฿100 — หักค่าธรรมเนียมคงที่ ฿20 ต่อรายการ</li>
              </ul>
              <div style={{ marginTop:10, padding:8, background:"#fff7ed", borderRadius:6 }}>
                ค่าจัดส่งไม่อยู่ภายใต้การคิดค่าธรรมเนียม — ผู้ขายจะได้รับค่าจัดส่งเต็มจำนวนทุกกรณี
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop:18 }}>
        <FeeSummary fee={data.fee_summary} />
      </div>

      {editingBank && (
        <BankModal initial={bank} onClose={() => setEditingBank(false)} onSaved={() => { setEditingBank(false); load(); }} />
      )}
    </Wrap>
  );
}

function Wrap({ children }) {
  return (
    <>
      <div className="slBreadcrumb">จัดการร้านค้า</div>
      <h1 className="slPageTitle">รายได้และการโอนเงิน</h1>
      {children}
    </>
  );
}

function Card({ label, value, subtitle, cls }) {
  return (
    <div className="slCard slIncomeCard">
      <div className="slIncomeCard__label">{label}</div>
      <div className={`slIncomeCard__value ${cls}`}>{value}</div>
      <div className="slStatSubtle">{subtitle}</div>
    </div>
  );
}

function PayoutRow({ p }) {
  const dateStr = new Date(p.created_at).toLocaleDateString("th-TH", { day:"2-digit", month:"short", year:"2-digit" });
  const isDone = p.status === "completed";
  const dot = isDone ? "#22c55e" : "#f59e0b";
  return (
    <div style={{ display:"flex", padding:"14px 4px", borderBottom:"1px solid #f1f5f9", gap:12, alignItems:"center" }}>
      <span style={{ width:10, height:10, borderRadius:"50%", background: dot }} />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, color:"#64748b" }}>
          {dateStr} · {isDone ? `ผ่าน ${p.method === "omise" ? "Omise Transfer" : "การโอนของระบบ"}` : "รอระบบโอนเงิน"}
        </div>
        <div style={{ fontSize:13, fontWeight:600 }}>
          {isDone ? "โอนเงิน" : "รอระบบโอนเงิน"} — รวม {p.order_count} ออเดอร์
        </div>
      </div>
      <div style={{ fontWeight:700, color: isDone ? "#22c55e" : "#f59e0b" }}>
        {isDone ? "+" : ""}{fmtBaht(p.net_amount)}
      </div>
    </div>
  );
}

function BankModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    bank_code: initial?.bank_code || "",
    bank_account_number: sanitizeNumber(initial?.bank_account_number || ""),
    bank_account_name: sanitizeName(initial?.bank_account_name || ""),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!form.bank_code) next.bank_code = "กรุณาเลือกธนาคาร";
    if (!/^\d{10,12}$/.test(form.bank_account_number)) next.bank_account_number = "เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก";
    if (!form.bank_account_name) next.bank_account_name = "กรุณากรอกชื่อบัญชี";
    else if (!/^[A-Za-zก-๙\s]+$/.test(form.bank_account_name)) next.bank_account_name = "ชื่อบัญชีรับเฉพาะภาษาไทย/อังกฤษ";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    setErr("");
    if (!validate()) return;
    setSaving(true); setErr("");
    try {
      await request("/seller/bank-account", {
        method: "PUT",
        body: {
          bank_code: form.bank_code,
          bank_account_number: sanitizeNumber(form.bank_account_number),
          bank_account_name: sanitizeName(form.bank_account_name),
        },
      });
      onSaved();
    } catch (e) { setErr(e?.data?.message || e.message); setSaving(false); }
  };

  const selectedBank = BANK_LIST.find(b => b.code === form.bank_code);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
      <div className="slCard" style={{ width:420 }}>
        <h3 style={{ marginTop:0 }}>แก้ไขบัญชีรับเงิน</h3>

        <label style={{ fontSize:13 }}>ธนาคาร</label>
        <select className="slSelect" style={{ width:"100%", marginBottom:10 }}
                value={form.bank_code}
                onChange={e => setForm(f => ({ ...f, bank_code: e.target.value }))}>
          <option value="">เลือกธนาคาร</option>
          {BANK_LIST.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        {errors.bank_code && <div style={{ color:"#b91c1c", fontSize:12, marginTop:-6, marginBottom:8 }}>{errors.bank_code}</div>}

        {selectedBank && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <BankLogo bank={selectedBank} size={28} />
            <div style={{ fontSize:12, color:"#64748b" }}>{selectedBank.name}</div>
          </div>
        )}

        <label style={{ fontSize:13 }}>เลขบัญชี</label>
        <input className="slOrderTrackInput" placeholder="กรอกเลขบัญชี"
               style={{ marginBottom:10 }}
               value={formatNumber(form.bank_account_number)}
               onChange={e => setForm(f => ({ ...f, bank_account_number: sanitizeNumber(e.target.value) }))} />
        {errors.bank_account_number && <div style={{ color:"#b91c1c", fontSize:12, marginTop:-6, marginBottom:8 }}>{errors.bank_account_number}</div>}

        <label style={{ fontSize:13 }}>ชื่อบัญชี</label>
        <input className="slOrderTrackInput" placeholder="ชื่อ-นามสกุล"
               style={{ marginBottom:10 }}
               value={form.bank_account_name}
               onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value.replace(/[^A-Za-zก-๙\s]/g, "") }))} />
        {errors.bank_account_name && <div style={{ color:"#b91c1c", fontSize:12, marginTop:-6, marginBottom:8 }}>{errors.bank_account_name}</div>}
        <div style={{ fontSize:12, color:"#64748b", marginBottom:10 }}>
          กรุณาตรวจสอบให้ชื่อบัญชีตรงกับเจ้าของบัญชีเพื่อให้ระบบยืนยันได้รวดเร็ว
        </div>

        {err && <div style={{ color:"#b91c1c", fontSize:13, marginBottom:8 }}>{err}</div>}

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="slBtn" onClick={onClose}>ยกเลิก</button>
          <button className="slBtnPrimary slBtn" disabled={saving} onClick={handleSave}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
