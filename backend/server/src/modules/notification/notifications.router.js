// notification.router.js
import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { db } from "../../config/db.js";

const r = Router();

// GET /notifications
r.get("/", auth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT notification_id, user_id, type, title, body, is_read, ref_id,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, notification_id DESC
       LIMIT 50`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PATCH /notifications/:id/read
r.patch("/:id/read", auth, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = 1
       WHERE notification_id = ? AND user_id = ?`,
      [req.params.id, req.user.user_id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default r;