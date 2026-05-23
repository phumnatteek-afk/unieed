// src/lib/notify.js — Centralised notification helper
// Inserts a row to the notifications table AND emits real-time socket event
import { db } from "../config/db.js";
import { emitToUser } from "../config/socket.js";

/**
 * sendNotification(userId, { type, title, body, ref_id })
 *   body — string or object (auto-serialised to JSON)
 *   ref_id — optional foreign key (donation_id, order_id, etc.)
 *
 * Returns the new notification_id (or null on failure)
 */
export async function sendNotification(userId, { type, title, body = null, ref_id = null }) {
  const bodyStr = body === null ? null
    : typeof body === "object" ? JSON.stringify(body) : String(body);

  let notifId = null;
  try {
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [userId, type, title, bodyStr, ref_id]
    );
    notifId = result.insertId;
  } catch (err) {
    console.error("[notify] DB insert failed:", err.message);
    return null;
  }

  // Push real-time via Socket.io (non-blocking)
  // ใช้เวลาไทย (UTC+7) ให้ตรงกับที่ DB บันทึก
  const thaiNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const thaiNowStr = thaiNow.toISOString().replace("Z", "+07:00");
  emitToUser(userId, "notification", {
    notification_id: notifId,
    user_id:  userId,
    type,
    title,
    body:     bodyStr,
    ref_id,
    is_read:  false,
    created_at: thaiNowStr,
  });

  return notifId;
}

/**
 * sendNotificationMany(userIds, payload)
 * Convenience: send same notification to multiple users
 */
export async function sendNotificationMany(userIds, payload) {
  return Promise.all(userIds.map(id => sendNotification(id, payload).catch(() => null)));
}
