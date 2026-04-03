// donation.controller.js
import {
  uploadDonationPic,
  insertDonation,
  getDonationsByProject,
  getDonationById,
  setDonationStatus,
  isDonationOwnedBySchool,
} from "./donation.service.js";
import { db } from "../../config/db.js";

export async function createDonation(req, res, next) {
  try {
    const request_id = Number(req.params.requestId);
    const donor_id   = req.user?.user_id ?? null;

    const {
      donor_name, donor_phone,
      delivery_method = "parcel",
      donation_date, shipping_carrier,
      tracking_number, appoint_time,
    } = req.body;

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

    let items = [];
    try {
      items = typeof req.body.items === "string"
        ? JSON.parse(req.body.items) : (req.body.items || []);
    } catch {
      return res.status(400).json({ message: "รูปแบบ items ไม่ถูกต้อง" });
    }
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "กรุณาเลือกรายการชุดอย่างน้อย 1 รายการ" });

    const quantity = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    if (quantity <= 0)
      return res.status(400).json({ message: "จำนวนชุดต้องมากกว่า 0" });

    const [reqRows] = await db.query(
      `SELECT request_id FROM donation_request
       WHERE request_id = ? AND status = 'open' LIMIT 1`,
      [request_id]
    );
    if (!reqRows[0])
      return res.status(404).json({ message: "ไม่พบโครงการ หรือโครงการปิดรับบริจาคแล้ว" });

    let donation_pic = null, donation_pic_public_id = null;
    if (req.file) {
      const uploaded = await uploadDonationPic(req.file.buffer, request_id);
      donation_pic           = uploaded.url;
      donation_pic_public_id = uploaded.public_id;
    }

    const donation_time = delivery_method === "dropoff"
      ? (appoint_time || null)
      : new Date().toTimeString().slice(0, 8);

    const donation_id = await insertDonation({
      request_id, donor_id,
      donor_name:            donor_name.trim(),
      donor_phone:           donor_phone?.trim() || null,
      donation_date, delivery_method,
      shipping_carrier:      shipping_carrier?.trim() || null,
      tracking_number:       tracking_number?.trim()  || null,
      donation_pic, donation_pic_public_id,
      items, quantity, donation_time,
    });

    res.status(201).json({
      message: "บันทึกการบริจาคเรียบร้อย รอโรงเรียนยืนยัน",
      donation_id,
    });
  } catch (err) { next(err); }
}

export async function listDonationsByProject(req, res, next) {
  try {
    const request_id = Number(req.params.requestId);
    const school_id  = req.user.school_id;

    if (!school_id)
      return res.status(403).json({ message: "บัญชีนี้ไม่ได้ผูกกับโรงเรียน" });

    const [proj] = await db.query(
      `SELECT request_id FROM donation_request
       WHERE request_id = ? AND school_id = ? LIMIT 1`,
      [request_id, school_id]
    );
    if (!proj[0])
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงโครงการนี้" });

    const rows = await getDonationsByProject(request_id);
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getDonationDetail(req, res, next) {
  try {
    const donation_id = Number(req.params.donationId);
    const { role, school_id, user_id } = req.user;

    const donation = await getDonationById(donation_id);
    if (!donation)
      return res.status(404).json({ message: "ไม่พบรายการบริจาค" });

    if (role === "school_admin") {
      const owned = await isDonationOwnedBySchool(donation_id, school_id);
      if (!owned)
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    } else if (role !== "admin") {
      // donor เช็ค donor_id
      if (donation.donor_id && donation.donor_id !== user_id)
        return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
    }

    // ✅ เพิ่ม school_name เข้าไปด้วย
    const [schoolRows] = await db.query(
      `SELECT s.school_name FROM donation_request dr
       JOIN schools s ON s.school_id = dr.school_id
       WHERE dr.request_id = ? LIMIT 1`,
      [donation.request_id]
    );
    donation.school_name = schoolRows[0]?.school_name || "";

    res.json(donation);
  } catch (err) { next(err); }
}

export async function updateDonationStatus(req, res, next) {
  try {
    const donation_id = req.params.donationId;
    const school_id   = req.user.school_id;
    const { status }  = req.body;

    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ message: "status ต้องเป็น approved หรือ rejected" });

    const owned = await isDonationOwnedBySchool(donation_id, school_id);
    if (!owned)
      return res.status(403).json({ message: "ไม่พบรายการ หรือไม่มีสิทธิ์" });

    await setDonationStatus(donation_id, status);
    res.json({ message: `อัปเดตสถานะเป็น ${status} แล้ว` });
  } catch (err) { next(err); }
}

export async function createDonationFromOrder(req, res, next) {
  try {
    const donor_id = req.user?.user_id ?? null;
 
    const {
      order_id,
      project_id,
      donor_name,
      donor_phone,
      shipping_carrier = null,
      tracking_number  = null,
      items            = [],
    } = req.body;
 
    // ── Validation ──────────────────────────────────────────────────────────
    if (!order_id)
      return res.status(400).json({ message: "กรุณาระบุ order_id" });
    if (!project_id)
      return res.status(400).json({ message: "กรุณาระบุ project_id" });
    if (!donor_name?.trim())
      return res.status(400).json({ message: "กรุณากรอกชื่อผู้บริจาค" });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "ไม่มีรายการสินค้า" });
 
    const request_id = Number(project_id);
 
    // ── ตรวจว่า project ยังเปิดอยู่ ────────────────────────────────────────
    const [reqRows] = await db.query(
      `SELECT request_id FROM donation_request
       WHERE request_id = ? AND status = 'open' LIMIT 1`,
      [request_id]
    );
    if (!reqRows[0])
      return res.status(404).json({ message: "ไม่พบโครงการ หรือโครงการปิดรับบริจาคแล้ว" });
 
    // ── ป้องกัน duplicate: ถ้า order_id นี้เคย insert แล้วให้คืน donation_id เดิม ──
    const [existing] = await db.query(
      `SELECT donation_id FROM donation_record
       WHERE market_order_id = ? AND request_id = ? LIMIT 1`,
      [String(order_id), request_id]
    );
    if (existing[0]) {
      return res.status(200).json({
        message: "บันทึกการบริจาคแล้ว (duplicate)",
        donation_id: existing[0].donation_id,
      });
    }
 
    const quantity = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const today    = new Date().toISOString().slice(0, 10);
 
    // ── Insert donation_record ──────────────────────────────────────────────
    const [ins] = await db.query(
      `INSERT INTO donation_record
         (request_id, donor_id, donor_name, donor_phone,
          donation_date, donation_time,
          delivery_method,
          shipping_carrier, tracking_number,
          market_order_id,
          items_snapshot, quantity, status)
       VALUES (?, ?, ?, ?, ?, NOW(), 'market_purchase', ?, ?, ?, ?, ?, 'pending')`,
      [
        request_id,
        donor_id,
        donor_name.trim(),
        donor_phone?.trim() || null,
        today,
        shipping_carrier || null,
        tracking_number  || null,
        String(order_id),
        JSON.stringify(items),
        quantity,
      ]
    );
 
    const donation_id = ins.insertId;
 
    // ── แจ้งเตือน school_admin ────────────────────────────────────────────
    try {
      // หา school_id จาก donation_request
      const [projInfo] = await db.query(
        `SELECT dr.school_id, s.school_name
         FROM donation_request dr
         JOIN schools s ON s.school_id = dr.school_id
         WHERE dr.request_id = ? LIMIT 1`,
        [request_id]
      );
      if (projInfo[0]) {
        const { school_id } = projInfo[0];
        // หา user_id ของ school_admin ทุกคนใน school นี้
        const [admins] = await db.query(
          `SELECT user_id FROM users
           WHERE school_id = ? AND role = 'school_admin'`,
          [school_id]
        );
        for (const admin of admins) {
          await db.query(
            `INSERT INTO notifications
               (user_id, type, title, message, ref_id, ref_type, created_at)
             VALUES (?, 'donation_received',
               'มีการบริจาคผ่านการซื้อสินค้า',
               ?, ?, 'donation', NOW())`,
            [
              admin.user_id,
              `${donor_name.trim()} ได้ซื้อสินค้าเพื่อบริจาคให้โรงเรียน (คำสั่งซื้อ #${order_id})`,
              donation_id,
            ]
          );
        }
      }
    } catch (notifErr) {
      // ไม่ให้ notification error ทำให้ response พัง
      console.error("[createDonationFromOrder] notification error:", notifErr.message);
    }
 
    res.status(201).json({
      message: "บันทึกการบริจาคเรียบร้อย รอโรงเรียนยืนยัน",
      donation_id,
    });
  } catch (err) { next(err); }
}
 
/**
 * PATCH /donations/:donationId/tracking
 * ร้านค้า/ระบบ อัปเดต shipping_carrier + tracking_number ทีหลัง
 * (เรียกเมื่อร้านค้า fulfill order และกรอกเลขพัสดุ)
 *
 * Body: { shipping_carrier, tracking_number }
 */
export async function updateDonationTracking(req, res, next) {
  try {
    const donation_id      = req.params.donationId;
    const { shipping_carrier, tracking_number } = req.body;
 
    if (!tracking_number?.trim())
      return res.status(400).json({ message: "กรุณากรอกเลขพัสดุ" });
 
    await db.query(
      `UPDATE donation_record
       SET shipping_carrier = ?, tracking_number = ?
       WHERE donation_id = ?`,
      [shipping_carrier?.trim() || null, tracking_number.trim(), donation_id]
    );
 
    // แจ้งเตือนผู้บริจาคว่าพัสดุถูกจัดส่งแล้ว
    try {
      const [donRows] = await db.query(
        "SELECT donor_id, donor_name FROM donation_record WHERE donation_id = ? LIMIT 1",
        [donation_id]
      );
      if (donRows[0]?.donor_id) {
        await db.query(
          `INSERT INTO notifications
             (user_id, type, title, message, ref_id, ref_type, created_at)
           VALUES (?, 'donation_shipped',
             'สินค้าที่คุณบริจาคถูกจัดส่งแล้ว',
             ?, ?, 'donation', NOW())`,
          [
            donRows[0].donor_id,
            `${shipping_carrier || "บริษัทขนส่ง"} · เลขพัสดุ ${tracking_number.trim()}`,
            donation_id,
          ]
        );
      }
    } catch (notifErr) {
      console.error("[updateDonationTracking] notification error:", notifErr.message);
    }
 
    res.json({ message: "อัปเดตข้อมูลการจัดส่งเรียบร้อย" });
  } catch (err) { next(err); }
}
 