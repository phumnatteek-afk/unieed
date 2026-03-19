// donation.service.js
import { db }         from "../../config/db.js";
import { cloudinary } from "../../config/cloudinary.js";

// ─────────────────────────────────────────────────────────────────
// อัปโหลดรูปหลักฐานขึ้น Cloudinary folder "donation_pic"
// ─────────────────────────────────────────────────────────────────
export async function uploadDonationPic(fileBuffer, requestId) {
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        "donation_pic",
        public_id:     `req${requestId}_${Date.now()}`,
        overwrite:     false,
        resource_type: "image",
      },
      (err, r) => (err ? reject(err) : resolve(r))
    );
    stream.end(fileBuffer);
  });
  return {
    url:       result.secure_url,
    public_id: result.public_id,
  };
}

// ─────────────────────────────────────────────────────────────────
// บันทึก donation_record ลง DB
// ─────────────────────────────────────────────────────────────────
export async function insertDonation({
  request_id,
  donor_id,
  donor_name,
  donor_phone,
  donation_date,
  delivery_method,
  shipping_carrier,
  tracking_number,
  donation_pic,
  donation_pic_public_id,
  items,
  quantity,
  donation_time,
}) {
  const [ins] = await db.query(
    `INSERT INTO donation_record
       (request_id, donor_id, donor_name, donor_phone,
        donation_date,
        donation_time, delivery_method,
        shipping_carrier, tracking_number,
        donation_pic, donation_pic_public_id,
        items_snapshot, quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,'pending')`,
    [
      request_id,
      donor_id              ?? null,
      donor_name,
      donor_phone           ?? null,
      donation_date,
      donation_time         ?? null,
      delivery_method,
      shipping_carrier      ?? null,
      tracking_number       ?? null,
      donation_pic          ?? null,
      donation_pic_public_id ?? null,
      JSON.stringify(items),
      quantity,
    ]
  );
  return ins.insertId;
}

// ─────────────────────────────────────────────────────────────────
// ดึงรายการบริจาคทั้งหมดของโครงการ (school_admin)
// ─────────────────────────────────────────────────────────────────
export async function getDonationsByProject(request_id) {
  const [rows] = await db.query(
    `SELECT
       donation_id, donor_id, donor_name, donor_phone,
       donation_date, delivery_method,
       shipping_carrier, tracking_number,
       donation_pic, quantity, status, created_at
     FROM donation_record
     WHERE request_id = ?
     ORDER BY created_at DESC`,
    [request_id]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────
// ดึง donation เดี่ยวพร้อม items_snapshot
// ─────────────────────────────────────────────────────────────────
export async function getDonationById(donation_id) {
  const [rows] = await db.query(
    "SELECT * FROM donation_record WHERE donation_id = ? LIMIT 1",
    [donation_id]
  );
  const row = rows[0];
  if (!row) return null;

  if (row.items_snapshot) {
    try {
      row.items_snapshot =
        typeof row.items_snapshot === "string"
          ? JSON.parse(row.items_snapshot)
          : row.items_snapshot;
    } catch {
      row.items_snapshot = [];
    }
  }
  return row;
}

// ─────────────────────────────────────────────────────────────────
// อัปเดตสถานะ approved / rejected
// ─────────────────────────────────────────────────────────────────
export async function setDonationStatus(donation_id, status) {
  await db.query(
    "UPDATE donation_record SET status = ? WHERE donation_id = ?",
    [status, donation_id]
  );
}

// ─────────────────────────────────────────────────────────────────
// ตรวจสิทธิ์: donation นี้เป็นของโรงเรียนที่ school_id นี้ไหม
// ─────────────────────────────────────────────────────────────────
export async function isDonationOwnedBySchool(donation_id, school_id) {
  const [rows] = await db.query(
    `SELECT dr.donation_id
     FROM donation_record dr
     JOIN donation_request req ON req.request_id = dr.request_id
     WHERE dr.donation_id = ? AND req.school_id = ?
     LIMIT 1`,
    [donation_id, school_id]
  );
  return !!rows[0];
}