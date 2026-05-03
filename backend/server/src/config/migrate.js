/**
 * migrate.js — รัน ALTER TABLE อัตโนมัติตอน server start
 * เพิ่ม column ที่ขาดโดยไม่กระทบ column ที่มีอยู่แล้ว
 */
import { db } from "./db.js";

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
  const exists = await columnExists(table, column);
  if (!exists) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[migrate] Added ${table}.${column}`);
  }
}

export async function runMigrations() {
  try {
    // ── orders ────────────────────────────────────────────
    await addColumnIfMissing("orders", "seller_id",            "INT NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "platform_fee",         "DECIMAL(10,2) NOT NULL DEFAULT 0");
    await addColumnIfMissing("orders", "seller_payout_amount", "DECIMAL(10,2) NOT NULL DEFAULT 0");
    await addColumnIfMissing("orders", "payout_status",        "ENUM('none','pending','paid') NOT NULL DEFAULT 'none'");
    await addColumnIfMissing("orders", "payout_id",            "INT NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "payout_date",          "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "tracking_number",      "VARCHAR(100) NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "shipping_date",        "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "completed_at",         "DATETIME NULL DEFAULT NULL");
    await addColumnIfMissing("orders", "request_id",           "INT NULL DEFAULT NULL");

    // ── users (bank account) ──────────────────────────────
    await addColumnIfMissing("users", "bank_code",             "VARCHAR(20) NULL DEFAULT NULL");
    await addColumnIfMissing("users", "bank_account_number",   "TEXT NULL DEFAULT NULL");
    await addColumnIfMissing("users", "bank_account_name",     "VARCHAR(200) NULL DEFAULT NULL");

    // ── payouts ───────────────────────────────────────────
    // สร้าง table payouts ถ้ายังไม่มี
    await db.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        payout_id       INT AUTO_INCREMENT PRIMARY KEY,
        seller_id       INT NOT NULL,
        net_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
        fee_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
        order_count     INT NOT NULL DEFAULT 0,
        status          ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
        omise_transfer_id VARCHAR(100) NULL,
        slip_url        TEXT NULL,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at    DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("[migrate] ✅ All migrations applied");
  } catch (err) {
    console.error("[migrate] ❌ Migration error:", err.message);
    throw err;
  }
}
