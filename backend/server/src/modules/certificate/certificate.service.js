import path from "path";
import { fileURLToPath } from "url";
import { db }         from "../../config/db.js";
import { cloudinary } from "../../config/cloudinary.js";
import puppeteer      from "puppeteer";
import fs from "fs";
import https from "https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR  = path.join(__dirname, "fonts");

const LOGO_URL     = "https://res.cloudinary.com/dfgjgs4ny/image/upload/v1774001257/Group_201_kh8yen.png";
const CHILDREN_URL = "https://res.cloudinary.com/dfgjgs4ny/image/upload/v1774000999/Photoroom_25690319_024144_1_p1rkpr.png";
const MEDAL_URL    = "https://res.cloudinary.com/dfgjgs4ny/image/upload/v1774000791/Blue_and_Gold_Modern_Completion_Certificate_A4-Photoroom_vsay5u.png";

// ── helpers ──────────────────────────────────────────────
function fontToBase64(filename) {
  return fs.readFileSync(path.join(FONT_DIR, filename)).toString("base64");
}
function imageToBase64(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const mime = res.headers["content-type"] || "image/png";
        resolve(`data:${mime};base64,${Buffer.concat(chunks).toString("base64")}`);
      });
      res.on("error", () => resolve(""));
    });
  });
}
export function genCertCode() {
  const yy  = new Date().getFullYear() + 543;
  const seq  = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `CERT-${yy}-${seq}`;
}

// ── เปลี่ยนเป็น async เพราะต้องใช้ await ──────────────────
export function buildCertHtml({ donor_name, items_summary, project_title, issued_at, certificate_code }) {
  const promptRegular  = fontToBase64("Prompt-Regular.ttf");
  const promptBold     = fontToBase64("Prompt-Bold.ttf");
  const charmonmanBold = fontToBase64("Charmonman-Bold.ttf");

  const d = new Date(issued_at);
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const dateStr = `${d.getDate()} ${months[d.getMonth()]} พุทธศักราช ${d.getFullYear() + 543}`;

  const esc = (str) => String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"/>
<style>
  @font-face {
    font-family: 'Prompt';
    src: url('data:font/truetype;base64,${promptRegular}');
    font-weight: 400;
  }
  @font-face {
    font-family: 'Prompt';
    src: url('data:font/truetype;base64,${promptBold}');
    font-weight: 700;
  }
  @font-face {
    font-family: 'Charmonman';
    src: url('data:font/truetype;base64,${charmonmanBold}');
    font-weight: 700;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;font-family:'Prompt',sans-serif;background:#fff;position:relative}
  .bg{position:absolute;inset:0;background:#7bc0eb;z-index:0}
  .tri-tl{position:absolute;top:0;left:0;width:0;height:0;border-style:solid;border-width:240px 200px 0 0;border-color:#29B6E8 transparent transparent transparent;z-index:3}
  .tri-tr{position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 180px 160px 0;border-color:transparent #5bc8f5 transparent transparent;z-index:1;opacity:.5}
  .strip-l{position:absolute;top:0;left:0;width:18px;height:100%;background:linear-gradient(180deg,#FFBE1B 0%,#f59e0b 100%);z-index:42}
  .strip-t{position:absolute;top:0;left:100px;right:0;height:14px;background:linear-gradient(90deg,#FFBE1B,#f59e0b);z-index:2}
  .tri-bl{position:absolute;bottom:0;left:18px;width:0;height:0;border-style:solid;border-width:0 0 180px 150px;border-color:transparent transparent #FFBE1B transparent;z-index:1}
  .tri-br{position:absolute;bottom:0;right:0;width:0;height:0;border-style:solid;border-width:0 260px 220px 0;border-color:transparent #29B6E8 transparent transparent;z-index:1}
  .card{position:absolute;top:22px;left:46px;right:46px;bottom:22px;background:#fff;border-radius:6px;z-index:3;box-shadow:0 2px 24px rgba(0,0,0,.07);border:7px solid #F8C457}
  .medal{position:absolute;top:-22px;right:-120px;z-index:10;width:400px}
  .medal img{width:100%;height:auto}
  .children{position:absolute;bottom:0;left:-8px;z-index:8;height:240px;pointer-events:none}
  .children img{height:100%;width:auto}
  .content{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 100px 20px 160px;text-align:center}
  .logo{height:150px;margin-bottom:8px;object-fit:contain}
  .intro{font-size:20px;color:#0E477D;font-weight:300;margin-bottom:8px}
  .donor{font-size:50px;font-weight:500;color:#F2A922;line-height:1.15;margin-bottom:4px}
  .divider{width:500px;height:1.5px;background:linear-gradient(90deg,transparent,#29B6E8 25%,#5285E8 75%,transparent);margin:2px auto 12px}
  .items{font-size:16px;color:#374151;font-weight:400;margin-bottom:4px}
  .project{font-size:24px;font-weight:700;color:#0E477D;line-height:1.55;margin-bottom:10px;max-width:760px}
  .wish{font-size:16px;color:#0E477D;font-weight:400;line-height:2;margin-bottom:4px}
  .date{font-size:13px;color:#888;font-weight:300;margin-bottom:14px}
  .sig-text{font-family:'Charmonman',cursive;font-size:38px;font-weight:700;color:#1e293b;line-height:1;margin-top:10px}
  .sig-line{width:210px;height:1px;background:#374151;margin:4px auto 5px}
  .sig-role{font-size:14px;font-weight:600;color:#374151}
  .cert-code{position:absolute;bottom:8px;right:14px;font-size:9.5px;color:#ccc;z-index:6}
</style>
</head>
<body>
  <div class="bg"></div>
  <div class="tri-tl"></div><div class="tri-tr"></div>
  <div class="strip-l"></div><div class="strip-t"></div>
  <div class="tri-bl"></div><div class="tri-br"></div>
  <div class="card">
    <div class="medal"><img src="${MEDAL_URL}" /></div>
    <div class="children"><img src="${CHILDREN_URL}" /></div>
    <div class="content">
      <img class="logo" src="${LOGO_URL}" alt="Unieed" />
      <div class="intro">ขอมอบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า</div>
      <div class="donor">${esc(donor_name)}</div>
      <div class="divider"></div>
      <div class="items">ได้บริจาค${esc(items_summary)}</div>
      <div class="project">โครงการ &ldquo;${esc(project_title)}&rdquo;</div>
      <div class="wish">
        ขอให้ท่านประสบแต่ความสุข ความเจริญ<br/>
        และเป็นกำลังสำคัญในการสร้างสรรค์สังคมแห่งการแบ่งปันร่วมกับเราสืบไป
      </div>
      <div class="date">(ให้ ณ วันที่ ${dateStr})</div>
      <div class="sig-text">Unieed</div>
      <div class="sig-line"></div>
      <div class="sig-role">ผู้ก่อตั้งแพลตฟอร์ม Unieed</div>
    </div>
    <div class="cert-code">${esc(certificate_code)}</div>
  </div>
</body>
</html>`;
}

export async function renderCert(html) {
  // แปลงรูปทั้ง 3 เป็น base64 ก่อน
  const [logoB64, childrenB64, medalB64] = await Promise.all([
    imageToBase64(LOGO_URL),
    imageToBase64(CHILDREN_URL),
    imageToBase64(MEDAL_URL),
  ]);

  html = html
    .replace(LOGO_URL, logoB64)
    .replace(CHILDREN_URL, childrenB64)
    .replace(MEDAL_URL, medalB64);

  const browser = await puppeteer.launch({
    headless: true,
    timeout: 60000,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1122, height: 794 });
    await page.setContent(html, { 
      waitUntil: "domcontentloaded",  // เปลี่ยนจาก networkidle0
      timeout: 30000 
    });
    await new Promise(r => setTimeout(r, 500));
    const png = await page.screenshot({ type: "png", fullPage: false });
    const pdf = await page.pdf({ printBackground: true, margin: { top:0, right:0, bottom:0, left:0 } });
    return { png, pdf };
  } finally {
    await browser.close();
  }
}

export function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, r) =>
      err ? reject(err) : resolve(r)
    );
    stream.end(buffer);
  });
}

export async function getCertByDonation(donation_id) {
  const [rows] = await db.query(
    "SELECT * FROM certificate WHERE donation_id = ? LIMIT 1",
    [donation_id]
  );
  return rows[0] || null;
}

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