// autocheck.service.js
import { db } from "../../config/db.js";
import crypto from "crypto";
import {
  genCertCode,
  buildCertHtml,
  renderCert,
  uploadBuffer,
  insertCert,
  getCertByDonation,
} from "../certificate/certificate.service.js";

// ── 1. Tracking Adapters ──────────────────────────────────────────────────────

const TRACKING_ADAPTERS = {

  // ── ไปรษณีย์ไทย ────────────────────────────────────────────────────────────
  // .env: THAILAND_POST_TOKEN=
  "ไปรษณีย์ไทย": async (trackingNumber) => {
    const TP_TOKEN = process.env.THAILAND_POST_TOKEN;
    if (!TP_TOKEN) return _mockAdapter(trackingNumber, "ไปรษณีย์ไทย");

    const res = await fetch("https://trackapi.thailandpost.co.th/post/api/v1/track", {
      method: "POST",
      headers: { Authorization: `Token ${TP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "all", language: "TH", barcode: [trackingNumber] }),
    });
    const json      = await res.json();
    const events    = json?.response?.items?.[trackingNumber] ?? [];
    const lastEvent = events[0];
    const delivered = lastEvent?.status === "106"; // 106 = นำจ่ายสำเร็จ
    return { delivered, status: lastEvent?.status_description ?? "unknown", checkedAt: new Date() };
  },

  // ── Flash Express ───────────────────────────────────────────────────────────
  // .env: FLASH_APP_ID=  FLASH_APP_SECRET=
  "Flash Express": async (trackingNumber) => {
    const FLASH_APP_ID     = process.env.FLASH_APP_ID;
    const FLASH_APP_SECRET = process.env.FLASH_APP_SECRET;
    if (!FLASH_APP_ID || !FLASH_APP_SECRET)
      return _mockAdapter(trackingNumber, "Flash Express");

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = crypto
      .createHmac("sha256", FLASH_APP_SECRET)
      .update(FLASH_APP_ID + timestamp)
      .digest("hex");

    const res = await fetch(
      `https://open-api.flashexpress.com/open/v3/parcel/${trackingNumber}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-APP-ID":    FLASH_APP_ID,
          "X-TIMESTAMP": timestamp,
          "X-SIGN":      sign,
        },
      }
    );
    const json      = await res.json();
    const delivered = json?.data?.pno_status === 3; // 3 = Delivered
    return { delivered, status: json?.data?.pno_status_name ?? "unknown", checkedAt: new Date() };
  },

  // ── J&T Express ─────────────────────────────────────────────────────────────
  // .env: JT_APP_KEY=  JT_APP_SECRET=  JT_CUSTOMER_CODE=
  "J&T Express": async (trackingNumber) => {
    const JT_APP_KEY       = process.env.JT_APP_KEY;
    const JT_APP_SECRET    = process.env.JT_APP_SECRET;
    const JT_CUSTOMER_CODE = process.env.JT_CUSTOMER_CODE;
    if (!JT_APP_KEY || !JT_APP_SECRET)
      return _mockAdapter(trackingNumber, "J&T Express");

    const timestamp  = Date.now().toString();
    const dataDigest = crypto
      .createHash("md5")
      .update(JT_APP_KEY + timestamp + JT_APP_SECRET)
      .digest("hex")
      .toUpperCase();

    const res = await fetch("https://openapi.jtexpress.co.th/open/track/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "appkey":     JT_APP_KEY,
        "timestamp":  timestamp,
        "dataDigest": dataDigest,
      },
      body: JSON.stringify({
        bizContent: JSON.stringify({ billCodes: [trackingNumber], customerCode: JT_CUSTOMER_CODE }),
      }),
    });
    const json     = await res.json();
    const detail   = json?.data?.[0];
    const lastScan = detail?.details?.[0]?.scanType ?? "";
    const delivered = ["SIGN", "SIGNED", "DELIVERED"].includes(lastScan.toUpperCase());
    return { delivered, status: detail?.details?.[0]?.desc ?? "unknown", checkedAt: new Date() };
  },

  // ── Kerry Express ───────────────────────────────────────────────────────────
  // .env: KERRY_CLIENT_ID=  KERRY_CLIENT_SECRET=
  "Kerry Express": async (trackingNumber) => {
    const KERRY_CLIENT_ID     = process.env.KERRY_CLIENT_ID;
    const KERRY_CLIENT_SECRET = process.env.KERRY_CLIENT_SECRET;
    if (!KERRY_CLIENT_ID || !KERRY_CLIENT_SECRET)
      return _mockAdapter(trackingNumber, "Kerry Express");

    // Step 1: Get access token
    const tokenRes = await fetch("https://api.kerryexpress.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     KERRY_CLIENT_ID,
        client_secret: KERRY_CLIENT_SECRET,
      }),
    });
    const tokenJson   = await tokenRes.json();
    const accessToken = tokenJson?.access_token;
    if (!accessToken) return { delivered: false, status: "auth_failed", checkedAt: new Date() };

    // Step 2: Track
    const res = await fetch(
      `https://api.kerryexpress.com/tracking/v1/shipments/${trackingNumber}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json      = await res.json();
    const delivered = json?.data?.status === "DELIVERED";
    return { delivered, status: json?.data?.status ?? "unknown", checkedAt: new Date() };
  },

  // ── Lazada Logistics ────────────────────────────────────────────────────────
  "Lazada Logistics": async () => ({ delivered: false, status: "no_api", checkedAt: new Date() }),
};

// ── 2. Mock Adapter ───────────────────────────────────────────────────────────
function _mockAdapter(trackingNumber, carrier) {
  console.warn(`[AutoCheck] ⚠️  No API key for "${carrier}" — MOCK (tracking: ${trackingNumber})`);
  return { delivered: true, status: "mock_delivered", checkedAt: new Date() };
}

// ── 3. checkTracking ─────────────────────────────────────────────────────────
async function checkTracking(carrier, trackingNumber) {
  const adapter = TRACKING_ADAPTERS[carrier];
  if (!adapter) {
    console.warn(`[AutoCheck] No adapter for: "${carrier}"`);
    return { delivered: false, status: "no_adapter", checkedAt: new Date() };
  }
  try {
    return await adapter(trackingNumber);
  } catch (err) {
    console.error(`[AutoCheck] Adapter error (${carrier}):`, err.message);
    return { delivered: false, status: "adapter_error", checkedAt: new Date() };
  }
}

// ── 4. Main Runner ────────────────────────────────────────────────────────────
export async function runAutoCheck() {
  console.log("[AutoCheck] ▶ Starting:", new Date().toISOString());

  const [overdueDonations] = await db.query(
    `SELECT
       dr.donation_id, dr.donor_id, dr.donor_name, dr.request_id,
       dr.shipping_carrier, dr.tracking_number, dr.created_at,
       TIMESTAMPDIFF(DAY, dr.created_at, NOW()) AS days_elapsed
     FROM donation_record dr
     WHERE dr.status          = 'pending'
       AND dr.delivery_method = 'parcel'
       AND dr.tracking_number IS NOT NULL
       AND TIMESTAMPDIFF(DAY, dr.created_at, DATE_ADD(NOW(), INTERVAL 7 HOUR)) >= 7
     ORDER BY dr.created_at ASC`
  );

  console.log(`[AutoCheck] Found ${overdueDonations.length} overdue donations`);

  let approved = 0;
  let skipped  = 0;

  for (const donation of overdueDonations) {
    const { donation_id, shipping_carrier, tracking_number } = donation;
    const result = await checkTracking(shipping_carrier, tracking_number);

    if (!result.delivered) {
      console.log(`[AutoCheck] ⏭  donation_id=${donation_id} not delivered (${result.status})`);
      skipped++;
      continue;
    }

    // 4.1 อัปเดต status → approved
    await db.query(
      `UPDATE donation_record
       SET status = 'approved', auto_approved = 1, auto_approved_at = NOW()
       WHERE donation_id = ?`,
      [donation_id]
    );

    // 4.2 ออก Certificate
    try {
      const existing = await getCertByDonation(donation_id);
      if (!existing) {
        // ดึงข้อมูลที่ต้องใช้
        const [donRows] = await db.query(
          `SELECT dr.donor_name, dr.donor_id, dr.items_snapshot,
                  req.request_title, s.school_name
           FROM donation_record dr
           JOIN donation_request req ON req.request_id = dr.request_id
           JOIN schools s             ON s.school_id    = req.school_id
           WHERE dr.donation_id = ? LIMIT 1`,
          [donation_id]
        );
        const don = donRows[0];

        if (don) {
          const items = typeof don.items_snapshot === "string"
            ? JSON.parse(don.items_snapshot)
            : (don.items_snapshot ?? []);

          const itemsSummary = items.length
            ? items.map(i => `${i.name} ${i.quantity} ชิ้น`).join(", ")
            : "สิ่งของ";

          const certCode = genCertCode();
          const issuedAt = new Date();

          const html = buildCertHtml({
            donor_name:       don.donor_name,
            items_summary:    itemsSummary,
            project_title:    don.request_title,
            issued_at:        issuedAt,
            certificate_code: certCode,
          });

          const { png, pdf } = await renderCert(html);

          const [imgRes, pdfRes] = await Promise.all([
            uploadBuffer(png, {
              folder:        "certificates",
              public_id:     `cert_${certCode}`,
              resource_type: "image",
            }),
            uploadBuffer(pdf, {
              folder:        "certificates",
              public_id:     `cert_${certCode}_pdf`,
              resource_type: "raw",
            }),
          ]);

          await insertCert({
            donation_id,
            user_id:               don.donor_id ?? null,
            donor_name:            don.donor_name,
            certificate_code:      certCode,
            items_summary:         itemsSummary,
            project_title:         don.request_title,
            school_name:           don.school_name,
            issued_at:             issuedAt,
            certificate_url:       imgRes.secure_url,
            certificate_public_id: imgRes.public_id,
            pdf_url:               pdfRes.secure_url,
            pdf_public_id:         pdfRes.public_id,
          });
        }
      }

      console.log(`[AutoCheck] ✅ Auto-approved & cert issued: donation_id=${donation_id}`);
      approved++;
    } catch (certErr) {
      console.error(`[AutoCheck] ❌ Cert error donation_id=${donation_id}:`, certErr.message);
    }
  }

  const summary = { total: overdueDonations.length, approved, skipped, runAt: new Date().toISOString() };
  console.log("[AutoCheck] ◀ Done:", summary);
  return summary;
}

// ── 5. Admin queries ──────────────────────────────────────────────────────────
export async function getOverdueDonations() {
  const [rows] = await db.query(
    `SELECT
       dr.donation_id, dr.donor_name, dr.shipping_carrier,
       dr.tracking_number, dr.created_at, dr.auto_approved, dr.auto_approved_at,
       dr.donation_pic,
       TIMESTAMPDIFF(DAY, dr.created_at, NOW()) AS days_elapsed,
       req.school_id, s.school_name
     FROM donation_record dr
     JOIN donation_request req ON req.request_id = dr.request_id
     JOIN schools s ON s.school_id    = req.school_id
     WHERE dr.status          = 'pending'
       AND dr.delivery_method = 'parcel'
       AND TIMESTAMPDIFF(DAY, dr.created_at, DATE_ADD(NOW(), INTERVAL 7 HOUR)) >= 7
     ORDER BY days_elapsed DESC`
  );
  return rows;
}

export async function getOverdueDonationsBySchool() {
  const rows = await getOverdueDonations();
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.school_id]) {
      grouped[row.school_id] = {
        school_id:   row.school_id,
        school_name: row.school_name,
        donations:   [],
      };
    }
    grouped[row.school_id].donations.push(row);
  }
  return Object.values(grouped).sort((a, b) => b.donations.length - a.donations.length);
}