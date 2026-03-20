// certificate.service.js
import { db } from "../../config/db.js";
import { cloudinary } from "../../config/cloudinary.js";
import puppeteer from "puppeteer";

// ── generate certificate code ─────────────────────────────────────
export function genCertCode() {
  const yy  = new Date().getFullYear() + 543;
  const seq  = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `CERT-${yy}-${seq}`;
}

// ── HTML Template ─────────────────────────────────────────────────
export function buildCertHtml({ donor_name, items_summary, project_title, issued_at, certificate_code }) {
  const dateStr = new Date(issued_at).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    width:1122px;height:794px;overflow:hidden;
    font-family:font-family: 'Helvetica Neue', Arial, 'TH Sarabun New',sans-serif;
    background:linear-gradient(135deg,#e0f0ff 0%,#f0f8ff 50%,#fff8e7 100%);
    display:flex;align-items:center;justify-content:center;position:relative;
  }
  .corner-tl{position:absolute;top:0;left:0;width:200px;height:200px;
    background:linear-gradient(135deg,#29B6E8,#5285E8);clip-path:polygon(0 0,100% 0,0 100%)}
  .corner-br{position:absolute;bottom:0;right:0;width:200px;height:200px;
    background:linear-gradient(135deg,#FFBE1B,#f97316);clip-path:polygon(100% 0,100% 100%,0 100%)}
  .corner-bl{position:absolute;bottom:0;left:0;width:110px;height:110px;
    background:#FFBE1B;clip-path:polygon(0 0,100% 100%,0 100%);opacity:.6}
  .medal{position:absolute;top:24px;right:48px}
  .medal-circle{width:96px;height:96px;border-radius:50%;
    background:radial-gradient(circle at 35% 35%,#FFD700,#B8860B);
    border:4px solid #8B6914;display:flex;align-items:center;justify-content:center;
    font-size:36px;box-shadow:0 4px 16px rgba(0,0,0,.25)}
  .medal-ribbon{display:flex;justify-content:center;margin-top:-4px}
  .ribbon-l{width:20px;height:44px;background:#C0392B;clip-path:polygon(0 0,100% 0,80% 100%,20% 100%);margin-right:-2px}
  .ribbon-r{width:20px;height:44px;background:#922B21;clip-path:polygon(0 0,100% 0,80% 100%,20% 100%)}
  .content{text-align:center;z-index:10;padding:24px;max-width:780px;width:100%}
  .logo{height:60px;margin-bottom:10px}
  .intro{font-size:16px;color:#64748b;margin-bottom:10px}
  .donor-name{font-size:52px;font-weight:900;
    background:linear-gradient(90deg,#29B6E8,#5285E8);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
    margin-bottom:6px;line-height:1.2}
  .divider{width:420px;height:2px;background:linear-gradient(90deg,transparent,#29B6E8,transparent);
    margin:8px auto 14px}
  .items{font-size:18px;color:#374151;margin-bottom:6px}
  .project{font-size:19px;font-weight:700;color:#1e293b;margin-bottom:14px;line-height:1.5}
  .wish{font-size:15px;color:#555;line-height:1.9;margin-bottom:10px}
  .date{font-size:13px;color:#888;margin-bottom:18px}
  .sig-font{font-size:34px;font-weight:700;color:#1e293b;font-style:italic}
  .sig-line{width:180px;height:1px;background:#374151;margin:4px auto 4px}
  .sig-role{font-size:14px;font-weight:700;color:#374151}
  .cert-code{position:absolute;bottom:12px;right:18px;font-size:11px;color:#aaa;z-index:10}
</style>
</head>
<body>
  <div class="corner-tl"></div>
  <div class="corner-br"></div>
  <div class="corner-bl"></div>
  <div class="medal">
    <div class="medal-circle">🏅</div>
    <div class="medal-ribbon">
      <div class="ribbon-l"></div>
      <div class="ribbon-r"></div>
    </div>
  </div>
  <div class="content">
    <div class="intro">ขอมอบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า</div>
    <div class="donor-name">${donor_name}</div>
    <div class="divider"></div>
    <div class="items">ได้บริจาค${items_summary}</div>
    <div class="project">โครงการ &ldquo;${project_title}&rdquo;</div>
    <div class="wish">
      ขอให้ท่านประสบแต่ความสุข ความเจริญ<br/>
      และเป็นกำลังสำคัญในการสร้างสรรค์สังคมแห่งการแบ่งปันร่วมกับเราสืบไป
    </div>
    <div class="date">(ให้ ณ วันที่ ${dateStr})</div>
    <div class="sig-font">Unieed</div>
    <div class="sig-line"></div>
    <div class="sig-role">ผู้ก่อตั้งแพลตฟอร์ม Unieed</div>
  </div>
  <div class="cert-code">${certificate_code}</div>
</body>
</html>`;
}

// ── render PNG + PDF via Puppeteer ────────────────────────────────
export async function renderCert(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1122, height: 794 });

    // ✅ เปลี่ยนจาก networkidle0 เป็น domcontentloaded + timeout นานขึ้น
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // รอให้ font render เสร็จ
    await new Promise(r => setTimeout(r, 1500));

    const png = await page.screenshot({ type: "png", fullPage: false });
    const pdf = await page.pdf({ width: "1122px", height: "794px", printBackground: true });
    return { png, pdf };
  } finally {
    await browser.close();
  }
}

// ── upload buffer to Cloudinary ───────────────────────────────────
export function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, r) =>
      err ? reject(err) : resolve(r)
    );
    stream.end(buffer);
  });
}

// ── get existing certificate by donation_id ───────────────────────
export async function getCertByDonation(donation_id) {
  const [rows] = await db.query(
    "SELECT * FROM certificate WHERE donation_id = ? LIMIT 1",
    [donation_id]
  );
  return rows[0] || null;
}

// ── insert certificate ────────────────────────────────────────────
export async function insertCert({
  donation_id, user_id, donor_name, certificate_code,
  items_summary, project_title, school_name, issued_at,
  certificate_url, certificate_public_id, pdf_url, pdf_public_id,
}) {
  const [ins] = await db.query(
    `INSERT INTO certificate
       (donation_id, user_id, donor_name, certificate_code, certificate_name,
        items_summary, project_title, school_name, issued_at,
        certificate_url, certificate_public_id, pdf_url, pdf_public_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      donation_id, user_id ?? null, donor_name, certificate_code,
      `ใบเกียรติบัตร - ${donor_name}`,
      items_summary, project_title, school_name, issued_at,
      certificate_url, certificate_public_id,
      pdf_url, pdf_public_id,
    ]
  );
  return ins.insertId;
}