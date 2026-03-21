// donation.controller.js
import {
  uploadDonationPic,
  insertDonation,
  getDonationsByProject,
  getDonationById,
  setDonationStatus,
  isDonationOwnedBySchool,
  insertFulfillment,
} from "./donation.service.js";
import { db } from "../../config/db.js";

// ─────────────────────────────────────────────────────────────────
// POST /donations/:requestId
// multipart/form-data:
//   donor_name, donor_phone?, delivery_method, donation_date,
//   shipping_carrier?, tracking_number?, appoint_time?,
//   items   (JSON string)
//   image   (file — optional)
// ─────────────────────────────────────────────────────────────────
export async function createDonation(req, res, next) {
  try {
    const request_id = Number(req.params.requestId);
    const donor_id   = req.user?.user_id ?? null;

    const {
      donor_name,
      donor_phone,
      delivery_method = "parcel",
      donation_date,
      shipping_carrier,
      tracking_number,
      appoint_time,
    } = req.body;

    // ── validate ──────────────────────────────────────────────────
    if (!donor_name?.trim())
      return res.status(400).json({ message: "กรุณากรอกชื่อผู้บริจาค" });
    if (!donation_date)
      return res.status(400).json({ message: "กรุณาระบุวันที่บริจาค" });
    if (!["parcel", "dropoff"].includes(delivery_method))
      return res.status(400).json({ message: "delivery_method ไม่ถูกต้อง" });
    if (delivery_method === "parcel") {
      if (!shipping_carrier?.trim())
        return res.status(400).json({ message: "กรุณาเลือกบริการขนส่ง" });
      if (!tracking_number?.trim())
        return res.status(400).json({ message: "กรุณากรอกเลขพัสดุ" });
    }

    // ── parse items ───────────────────────────────────────────────
    let items = [];
    try {
      items = typeof req.body.items === "string"
        ? JSON.parse(req.body.items)
        : (req.body.items || []);
    } catch {
      return res.status(400).json({ message: "รูปแบบ items ไม่ถูกต้อง" });
    }
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "กรุณาเลือกรายการชุดอย่างน้อย 1 รายการ" });

    const quantity = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    if (quantity <= 0)
      return res.status(400).json({ message: "จำนวนชุดต้องมากกว่า 0" });

    // ── ตรวจว่า request เปิดรับอยู่ ──────────────────────────────
    const [reqRows] = await db.query(
      `SELECT request_id FROM donation_request
       WHERE request_id = ? AND status = 'open' LIMIT 1`,
      [request_id]
    );
    if (!reqRows[0])
      return res.status(404).json({ message: "ไม่พบโครงการ หรือโครงการปิดรับบริจาคแล้ว" });

    // ── upload รูปหลักฐาน (ถ้ามี) ────────────────────────────────
    let donation_pic           = null;
    let donation_pic_public_id = null;

    if (req.file) {
      const uploaded = await uploadDonationPic(req.file.buffer, request_id);
      donation_pic           = uploaded.url;
      donation_pic_public_id = uploaded.public_id;
    }

    // ── INSERT ────────────────────────────────────────────────────
// สร้าง donation_time
  // parcel = เวลา NOW(), dropoff = appoint_time ที่ผู้ใช้เลือก
  const donation_time = delivery_method === "dropoff"
    ? (appoint_time || null)
    : new Date().toTimeString().slice(0, 8); // "HH:MM:SS"
// ส่งเข้า insertDonation
    const donation_id = await insertDonation({
      request_id,
      donor_id,
      donor_name:            donor_name.trim(),
      donor_phone:           donor_phone?.trim() || null,
      donation_date,
      delivery_method,
      shipping_carrier:      shipping_carrier?.trim() || null,
      tracking_number:       tracking_number?.trim()  || null,
      donation_pic,
      donation_pic_public_id,
      items,
      quantity,
      donation_time,
    });

    res.status(201).json({
      message: "บันทึกการบริจาคเรียบร้อย รอโรงเรียนยืนยัน",
      donation_id,
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /donations/project/:requestId  (school_admin)
// ─────────────────────────────────────────────────────────────────
export async function listDonationsByProject(req, res, next) {
  try {
    const request_id = Number(req.params.requestId);
    const school_id  = req.user.school_id;

    // ตรวจสิทธิ์
    const [proj] = await db.query(
      `SELECT request_id FROM donation_request
       WHERE request_id = ? AND school_id = ? LIMIT 1`,
      [request_id, school_id]
    );
    if (!proj[0])
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงโครงการนี้" });

    const rows = await getDonationsByProject(request_id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /donations/:donationId  (school_admin — ดูรายละเอียด)
// ─────────────────────────────────────────────────────────────────
export async function getDonationDetail(req, res, next) {
  try {
    const donation_id = Number(req.params.donationId);
    const { user_id, role, school_id } = req.user;

    const donation = await getDonationById(donation_id);
    if (!donation)
      return res.status(404).json({ message: "ไม่พบรายการบริจาค" });

    if (role === "school_admin") {
      // ตรวจว่าเป็นโครงการของโรงเรียนนี้
      const owned = await isDonationOwnedBySchool(donation_id, school_id);
      if (!owned)
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });

    } else {
      // donor ดูได้เฉพาะของตัวเอง
      if (donation.donor_id !== user_id)
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    }

    res.json(donation);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// PATCH /donations/:donationId/status  (school_admin)
// body: { status: "approved" | "rejected" }
// ─────────────────────────────────────────────────────────────────
export async function updateDonationStatus(req, res, next) {
  try {
    const donation_id = Number(req.params.donationId);
    const school_id   = req.user.school_id;
    const { status }  = req.body;

    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ message: "status ต้องเป็น approved หรือ rejected" });

    const owned = await isDonationOwnedBySchool(donation_id, school_id);
    if (!owned)
      return res.status(403).json({ message: "ไม่พบรายการ หรือไม่มีสิทธิ์" });

    await setDonationStatus(donation_id, status);
    res.json({ message: `อัปเดตสถานะเป็น ${status} แล้ว` });
  } catch (err) {
    next(err);
  }
}

// ── เพิ่มใน donation.controller.js ──────────────────────────────
 
// PATCH /donations/:donationId/verify  (school_admin)
// body: { condition_status: "usable"|"damaged"|"wrong_item", thank_message?: string }
export async function verifyDonation(req, res, next) {
  try {
    const donation_id = Number(req.params.donationId);
    const school_id   = req.user.school_id;
    const { condition_status, thank_message } = req.body;

    console.log("=== verifyDonation ===");
    console.log("donation_id:", donation_id);
    console.log("condition_status:", condition_status);

    const VALID = ["usable", "damaged", "wrong_item"];
    if (!VALID.includes(condition_status))
      return res.status(400).json({ message: "condition_status ไม่ถูกต้อง" });

    const owned = await isDonationOwnedBySchool(donation_id, school_id);
    console.log("owned:", owned);
    if (!owned)
      return res.status(403).json({ message: "ไม่พบรายการ หรือไม่มีสิทธิ์" });

    const [[donation]] = await db.query(
      `SELECT request_id, quantity, items_snapshot
       FROM donation_record WHERE donation_id = ?`,
      [donation_id]
    );
    console.log("donation:", donation);

    if (!donation)
      return res.status(404).json({ message: "ไม่พบรายการบริจาค" });

    let items_snapshot = [];
    try {
      items_snapshot = typeof donation.items_snapshot === "string"
        ? JSON.parse(donation.items_snapshot)
        : (donation.items_snapshot || []);
    } catch {
      items_snapshot = [];
    }
    console.log("items_snapshot:", items_snapshot);

    console.log("getting connection...");
    const conn = await db.getConnection();
    console.log("got connection");
    
    try {
      await conn.beginTransaction();
      console.log("transaction started");

      await conn.query(
        `UPDATE donation_record
         SET status = 'approved', condition_status = ?
         WHERE donation_id = ?`,
        [condition_status, donation_id]
      );
      console.log("updated donation_record");

      if (condition_status === "usable") {
  console.log("inserting fulfillment, items:", items_snapshot.length);
  for (const item of items_snapshot) {
    // ✅ เปลี่ยนมา lookup จาก student_need แทน request_item
    const [snRows] = await conn.query(
      `SELECT sn.student_need_id
       FROM student_need sn
       JOIN students st ON st.student_id = sn.student_id
       WHERE st.request_id = ? AND sn.uniform_type_id = ?
       LIMIT 1`,
      [donation.request_id, item.uniform_type_id]
    );
    console.log("student_need_id:", snRows[0]?.student_need_id);

    await conn.query(
      `INSERT INTO fulfillment
         (donation_id, request_id, request_item_id, quantity_fulfilled, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [donation_id, donation.request_id, snRows[0]?.student_need_id ?? null, item.quantity]
    );
  }
}

      await conn.commit();
      console.log("committed");
    } catch (err) {
      await conn.rollback();
      console.error("transaction error:", err.message);
      throw err;
    } finally {
      conn.release();
    }

    res.json({ message: "บันทึกผลตรวจสอบเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("verifyDonation error:", err.message);
    next(err);
  }
}