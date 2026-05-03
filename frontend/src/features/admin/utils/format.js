// Utility ฟอร์แมตเงิน/วันที่/ค่าธรรมเนียม สำหรับหน้า admin
// ใช้ พ.ศ. (Buddhist year) ทุกที่เพื่อความสม่ำเสมอ

export const formatBaht = (n) =>
  "฿" +
  Number(n ?? 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export const formatNumber = (n) => Number(n ?? 0).toLocaleString("th-TH");

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const formatThaiDate = (input) => {
  if (!input) return "-";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};

export const formatThaiDateTime = (input) => {
  if (!input) return "-";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatThaiDate(d)} ${hh}:${mm}`;
};

/**
 * คำนวณค่าธรรมเนียมแบบ max(percent, minimum)
 * เลือกเปอร์เซ็นต์หรือขั้นต่ำ อันที่สูงกว่า — ไม่หักทั้งสองอย่างพร้อมกัน
 */
export const calcFee = (gross, feeRate = 0.15, minimumFee = 20) => {
  const g = Number(gross || 0);
  const percent = Math.round(g * feeRate * 100) / 100;
  const fee = Math.max(percent, minimumFee);
  return {
    gross: g,
    percent,
    minimumFee,
    fee,
    applied: percent >= minimumFee ? "percent" : "minimum",
    net: Math.round((g - fee) * 100) / 100,
  };
};

/* ───────────── สถานะ ───────────── */
// สีสำหรับ class name (ใช้กับ admStatus / admBadge)

export const ORDER_STATUS = {
  pending:   { label: "รอดำเนินการ", tone: "amber" },
  shipping:  { label: "กำลังจัดส่ง", tone: "blue" },
  delivered: { label: "จัดส่งสำเร็จ", tone: "green" },
  cancelled: { label: "ยกเลิก",       tone: "red" },
};

export const PAYOUT_STATUS = {
  pending:   { label: "รอโอน",        tone: "amber" },
  completed: { label: "โอนสำเร็จ",    tone: "green" },
  failed:    { label: "โอนไม่สำเร็จ", tone: "red" },
};
