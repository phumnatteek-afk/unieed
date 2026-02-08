import "dotenv/config";
import bcrypt from "bcrypt";
import { db } from "../config/db.js";

async function main() {
  try {
    const user_name = "UnieedAdmin";
    const user_email = "admin01@unieed.com";
    const plainPassword = "admin1234";

    const password_hash = await bcrypt.hash(plainPassword, 10);

    // ปรับชื่อคอลัมน์ให้ตรงกับตาราง users ของคุณ
    // ถ้าคุณใช้ password_hash อยู่แล้ว ใช้ตามนี้ได้เลย
    await db.execute(
      `INSERT INTO users (user_name, user_email, password_hash, role)
       VALUES (?, ?, ?, 'admin')`,
      [user_name, user_email, password_hash]
    );

    console.log("✅ Created admin:", user_email, "password:", plainPassword);
    process.exit(0);
  } catch (err) {
    if (String(err?.message).includes("Duplicate")) {
      console.log("⚠️ Admin already exists:", "admin@unieed.com");
      process.exit(0);
    }
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
