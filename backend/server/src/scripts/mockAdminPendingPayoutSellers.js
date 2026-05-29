import { db } from "../config/db.js";

const BUYER_ID = 80;
const MOCK_PREFIX = "mock-admin-pending-payout";

const SELLERS = [
  { name: "ร้านคุณจิมมี่", email: "mock.pending.seller01@unieed.local", bank: "0123456789", bankCode: "kbank", account: "จิรภัทร แสงทอง", price: 180, orders: 3 },
  { name: "ร้านลินินฟ้า", email: "mock.pending.seller02@unieed.local", bank: "1234567890", bankCode: "scb", account: "ลินดา ใจดี", price: 120, orders: 2 },
  { name: "ร้านสมุดชุดเรียน", email: "mock.pending.seller03@unieed.local", bank: "2345678901", bankCode: "bbl", account: "สมชาย พร้อมส่ง", price: 220, orders: 4 },
  { name: "ร้านแม่แก้ว", email: "mock.pending.seller04@unieed.local", bank: "3456789012", bankCode: "ttb", account: "แก้วตา สุขศรี", price: 95, orders: 2 },
  { name: "ร้านบ้านยูนิฟอร์ม", email: "mock.pending.seller05@unieed.local", bank: "4567890123", bankCode: "bay", account: "อารีย์ วงศ์ดี", price: 260, orders: 3 },
];

const PRODUCTS = [
  { title: "เสื้อนักเรียนชาย คอปก ผ้าดี", categoryId: 1, gender: "male", size: '{"chest":"36","length":"24"}', level: "มัธยมต้น" },
  { title: "กระโปรงนักเรียนหญิง จีบรอบ", categoryId: 3, gender: "female", size: '{"waist":"26","length":"22"}', level: "มัธยมปลาย" },
  { title: "กางเกงนักเรียน เอวยางยืด", categoryId: 2, gender: "male", size: '{"waist":"28","length":"36"}', level: "ประถมศึกษา" },
  { title: "เสื้อนักเรียนหญิง คอบัว", categoryId: 1, gender: "female", size: '{"chest":"34","length":"23"}', level: "ประถมศึกษา" },
  { title: "ชุดนักเรียนสภาพดี พร้อมส่ง", categoryId: 4, gender: null, size: '{"chest":"38","waist":"30","length":"25"}', level: "มัธยมปลาย" },
];

const RECIPIENTS = [
  "กัญญารัตน์ ภูมินัทธี",
  "ปาริชาติ เรืองรอง",
  "ธนกร ใจกล้า",
  "นภัสสร พิพัฒน์",
  "สุชาดา ใจใส",
];

const SELLER_CYCLE_OFFSETS = [-1, -1, -2, 0, 0];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(date) {
  return [
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
  ].join(" ");
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function cycleBaseDate(now, sellerIndex, orderIndex) {
  const monthOffset = SELLER_CYCLE_OFFSETS[sellerIndex] ?? 0;
  const day = monthOffset < 0 ? 12 + sellerIndex * 2 + orderIndex : Math.max(1, now.getDate() - 1 - orderIndex);
  return new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 10 + orderIndex, 10 + sellerIndex * 3, 0, 0);
}

function platformFee(itemsTotal) {
  return itemsTotal > 0 ? Math.max(Math.round(itemsTotal * 0.15 * 100) / 100, 20) : 0;
}

async function main() {
  const reset = process.argv.includes("--reset");
  const conn = await db.getConnection();

  try {
    const [[existing]] = await conn.query(
      "SELECT COUNT(*) AS c FROM orders WHERE omise_charge_id LIKE ?",
      [`${MOCK_PREFIX}-%`]
    );

    if (Number(existing.c) > 0 && !reset) {
      throw new Error(`พบ mock pending payout เดิม ${existing.c} รายการแล้ว ถ้าต้องการสร้างใหม่ให้รันพร้อม --reset`);
    }

    await conn.beginTransaction();

    if (reset) {
      const [orders] = await conn.query(
        "SELECT order_id FROM orders WHERE omise_charge_id LIKE ?",
        [`${MOCK_PREFIX}-%`]
      );
      const orderIds = orders.map((row) => row.order_id);
      if (orderIds.length) {
        await conn.query("DELETE FROM order_shipping WHERE order_id IN (?)", [orderIds]);
        await conn.query("DELETE FROM order_items WHERE order_id IN (?)", [orderIds]);
        await conn.query("DELETE FROM orders WHERE order_id IN (?)", [orderIds]);
      }
      await conn.query("DELETE FROM products WHERE product_title LIKE ?", [`[${MOCK_PREFIX}]%`]);
      await conn.query("DELETE FROM users WHERE user_email LIKE 'mock.pending.seller%@unieed.local'");
    }

    const [[buyer]] = await conn.query("SELECT user_id FROM users WHERE user_id = ? LIMIT 1", [BUYER_ID]);
    if (!buyer) throw new Error(`ไม่พบ buyer_id ${BUYER_ID}`);

    const [[provider]] = await conn.query(
      "SELECT provider_id, name, base_price, price_per_item FROM shipping_provider WHERE is_active = 1 ORDER BY provider_id LIMIT 1"
    );
    if (!provider) throw new Error("ไม่พบ shipping_provider ที่ active");

    const baseDate = new Date();
    let totalOrders = 0;

    for (let sellerIndex = 0; sellerIndex < SELLERS.length; sellerIndex += 1) {
      const seller = SELLERS[sellerIndex];
      const productSeed = PRODUCTS[sellerIndex % PRODUCTS.length];

      await conn.query(
        `INSERT INTO users
          (user_name, user_email, role, status, bank_account_number, bank_code, bank_account_name, bank_account_verified)
         VALUES (?, ?, 'seller', 'active', ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
          user_name = VALUES(user_name),
          role = 'seller',
          status = 'active',
          bank_account_number = VALUES(bank_account_number),
          bank_code = VALUES(bank_code),
          bank_account_name = VALUES(bank_account_name),
          bank_account_verified = 1`,
        [seller.name, seller.email, seller.bank, seller.bankCode, seller.account]
      );

      const [[sellerRow]] = await conn.query("SELECT user_id FROM users WHERE user_email = ? LIMIT 1", [seller.email]);

      const [productResult] = await conn.query(
        `INSERT INTO products
          (seller_id, product_title, product_description, size, level, school_name,
           condition_percent, condition_label, price, quantity, status, category_id, gender, weight)
         VALUES (?, ?, 'mock data สำหรับแสดงรายการรอโอนใน admin dashboard', ?, ?, 'โรงเรียนสาธิตยูนีด',
           90, 'สภาพดี', ?, 20, 'available', ?, ?, 0.50)`,
        [
          sellerRow.user_id,
          `[${MOCK_PREFIX}] ${productSeed.title}`,
          productSeed.size,
          productSeed.level,
          seller.price,
          productSeed.categoryId,
          productSeed.gender,
        ]
      );
      const productId = productResult.insertId;

      for (let orderIndex = 0; orderIndex < seller.orders; orderIndex += 1) {
        const createdAt = cycleBaseDate(baseDate, sellerIndex, orderIndex);
        const quantity = orderIndex % 2 === 0 ? 1 : 2;
        const itemTotal = seller.price * quantity;
        const shippingPrice = Number(provider.base_price || 0) + Math.max(0, quantity - 1) * Number(provider.price_per_item || 0);
        const fee = platformFee(itemTotal);
        const totalPrice = itemTotal + shippingPrice;
        const sellerPayout = totalPrice - fee;
        const completedAt = addDays(createdAt, 1);

        const [orderResult] = await conn.query(
          `INSERT INTO orders
            (buyer_id, seller_id, total_price, platform_fee, seller_payout_amount,
             order_status, tracking_number, shipping_provider, shipping_date,
             created_at, completed_at, recipient_name, shipping_address,
             shipping_province, shipping_postcode, shipping_phone, payment_status,
             payout_status, order_type, payment_method, omise_charge_id)
           VALUES (?, ?, ?, ?, ?, 'delivered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid',
             'pending', 'purchase', 'card', ?)`,
          [
            BUYER_ID,
            sellerRow.user_id,
            totalPrice,
            fee,
            sellerPayout,
            `ADM${String(sellerIndex + 1).padStart(2, "0")}${String(orderIndex + 1).padStart(3, "0")}TH`,
            provider.name,
            formatDateTime(createdAt),
            formatDateTime(createdAt),
            formatDateTime(completedAt),
            RECIPIENTS[(sellerIndex + orderIndex) % RECIPIENTS.length],
            `${80 + sellerIndex}/${orderIndex + 1} หมู่ ${(orderIndex % 6) + 1} ตำบลตัวอย่าง อำเภอเมือง`,
            "นครปฐม",
            "73000",
            `089${String(1000000 + sellerIndex * 1000 + orderIndex * 37).slice(-7)}`,
            `${MOCK_PREFIX}-${sellerIndex + 1}-${orderIndex + 1}`,
          ]
        );

        await conn.query(
          "INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)",
          [orderResult.insertId, productId, quantity, seller.price]
        );
        await conn.query(
          "INSERT INTO order_shipping (order_id, seller_id, provider_id, shipping_price) VALUES (?, ?, ?, ?)",
          [orderResult.insertId, sellerRow.user_id, provider.provider_id, shippingPrice]
        );
        totalOrders += 1;
      }
    }

    await conn.commit();

    const [pendingRows] = await db.query(
      `SELECT o.seller_id, u.user_name AS seller_name, COUNT(*) AS order_count,
              COALESCE(SUM(o.seller_payout_amount), 0) AS net_amount,
              COALESCE(SUM(o.platform_fee), 0) AS fee_amount
       FROM orders o
       LEFT JOIN users u ON u.user_id = o.seller_id
       WHERE o.omise_charge_id LIKE ?
       GROUP BY o.seller_id, u.user_name
       ORDER BY o.seller_id`,
      [`${MOCK_PREFIX}-%`]
    );

    console.log(JSON.stringify({ created_orders: totalOrders, sellers: pendingRows }, null, 2));
  } catch (error) {
    await conn.rollback();
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end();
  }
}

main();
