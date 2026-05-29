import { db } from "../config/db.js";

const BUYER_ID = 80;
const SELLER_ID = 88;
const MOCK_PREFIX = "mock-seller88-dashboard";
const BANK = {
  bank_account_number: "98765432100",
  bank_code: "ttb",
  bank_account_name: "วรรณนา สุจสี",
};

const THAI_PROVINCES = [
  "กรุงเทพมหานคร",
  "นครปฐม",
  "นนทบุรี",
  "ปทุมธานี",
  "สมุทรปราการ",
  "ชลบุรี",
  "เชียงใหม่",
  "ขอนแก่น",
];

const RECIPIENTS = [
  "กัญญารัตน์ ภูมินัทธี",
  "ปวีณา แสงดี",
  "ณัฐวุฒิ ใจตรง",
  "สิริพร มั่นคง",
  "ธนพล สุขใจ",
  "อรทัย ดีมาก",
  "ภัทรพล จันทร์หอม",
  "ศิริลักษณ์ วงศ์คำ",
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function parseDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date, minutes) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function atTime(date, hour, minute, second = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, second, 0);
  return next;
}

function monthDate(base, monthOffset, day, hour, minute) {
  return new Date(base.getFullYear(), base.getMonth() + monthOffset, day, hour, minute, 0, 0);
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function payoutCycleDate(orderDate, seed = 0) {
  const payoutDate = new Date(orderDate.getFullYear(), orderDate.getMonth() + 1, 1 + (seed % 7), 10 + (seed % 4), 30, 0, 0);
  return payoutDate;
}

function payoutCycleKey(orderDate) {
  const payoutDate = payoutCycleDate(orderDate);
  return `${payoutDate.getFullYear()}-${pad2(payoutDate.getMonth() + 1)}`;
}

function makeDateSlots(localToday, dbToday) {
  const slots = [];

  // Local "today" for admin filters. Keep times before the current early-morning demo window.
  for (let i = 0; i < 6; i += 1) {
    slots.push(atTime(localToday, 0, 5 + i * 8));
  }

  // DB CURDATE() for seller widgets that use SQL CURDATE().
  for (let i = 0; i < 8; i += 1) {
    slots.push(atTime(dbToday, 9 + i, 10 + (i % 4) * 7));
  }

  // Current month, but not today.
  const currentMonthDays = [3, 5, 8, 11, 14, 17, 20, 21, 22, 24, 25, 26, 27, 28];
  currentMonthDays.forEach((day, i) => {
    slots.push(new Date(localToday.getFullYear(), localToday.getMonth(), day, 8 + (i % 9), 15 + (i % 3) * 10, 0));
  });

  // Previous periods for 3/6/12 month filters and charts.
  const olderSpecs = [
    [-1, 4], [-1, 9], [-1, 16], [-1, 22], [-1, 27], [-1, 28],
    [-2, 6], [-2, 13], [-2, 20], [-2, 25],
    [-3, 7], [-3, 18], [-3, 26],
    [-5, 5], [-5, 19], [-5, 28],
    [-8, 8], [-8, 21],
    [-10, 11], [-10, 23],
    [-11, 9], [-11, 24],
  ];
  olderSpecs.forEach(([offset, day], i) => {
    slots.push(monthDate(localToday, offset, day, 9 + (i % 8), 20 + (i % 4) * 6));
  });

  return slots.slice(0, 50);
}

function makeStatusPlans() {
  const plans = [
    ...Array.from({ length: 6 }, () => ({ order_status: "pending", payment_status: "paid", payout_status: "pending" })),
    ...Array.from({ length: 6 }, () => ({ order_status: "confirmed", payment_status: "paid", payout_status: "pending" })),
    ...Array.from({ length: 8 }, () => ({ order_status: "shipping", payment_status: "paid", payout_status: "pending" })),
    ...Array.from({ length: 18 }, () => ({ order_status: "delivered", payment_status: "paid", payout_status: "pending" })),
    ...Array.from({ length: 10 }, () => ({ order_status: "delivered", payment_status: "paid", payout_status: "paid" })),
    ...Array.from({ length: 2 }, () => ({ order_status: "cancelled", payment_status: "unpaid", payout_status: "pending" })),
  ];

  // Mix the statuses through the timeline so every dashboard range has useful examples.
  const order = [
    0, 6, 12, 20, 38, 1, 7, 13, 21, 39,
    2, 8, 14, 22, 40, 3, 9, 15, 23, 41,
    4, 10, 16, 24, 42, 5, 11, 17, 25, 43,
    18, 26, 44, 19, 27, 45, 28, 46, 29, 47,
    30, 48, 31, 49, 32, 33, 34, 35, 36, 37,
  ];

  return order.map((idx) => plans[idx]);
}

function calculateAmounts(product, quantity, provider) {
  const itemSubtotal = Number(product.price) * quantity;
  const shippingPrice = Number(provider.base_price || 0) + Math.max(0, quantity - 1) * Number(provider.price_per_item || 0);
  const platformFee = itemSubtotal > 0 ? Math.max(Math.round(itemSubtotal * 0.15 * 100) / 100, 20) : 0;
  return {
    itemSubtotal,
    shippingPrice,
    totalPrice: itemSubtotal + shippingPrice,
    platformFee,
    sellerPayoutAmount: itemSubtotal + shippingPrice - platformFee,
  };
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
      throw new Error(`พบ mock orders เดิม ${existing.c} รายการแล้ว ถ้าต้องการสร้างใหม่ให้รันพร้อม --reset`);
    }

    await conn.beginTransaction();

    if (reset) {
      const [taggedOrders] = await conn.query(
        "SELECT order_id FROM orders WHERE omise_charge_id LIKE ?",
        [`${MOCK_PREFIX}-%`]
      );
      const orderIds = taggedOrders.map((row) => row.order_id);
      if (orderIds.length) {
        await conn.query("DELETE FROM order_shipping WHERE order_id IN (?)", [orderIds]);
        await conn.query("DELETE FROM order_items WHERE order_id IN (?)", [orderIds]);
        await conn.query("DELETE FROM orders WHERE order_id IN (?)", [orderIds]);
      }
      await conn.query("DELETE FROM payouts WHERE omise_transfer_id LIKE ?", [`${MOCK_PREFIX}-%`]);
    }

    const [[buyer]] = await conn.query("SELECT user_id FROM users WHERE user_id = ? LIMIT 1", [BUYER_ID]);
    const [[seller]] = await conn.query("SELECT user_id FROM users WHERE user_id = ? LIMIT 1", [SELLER_ID]);
    if (!buyer) throw new Error(`ไม่พบ buyer_id ${BUYER_ID}`);
    if (!seller) throw new Error(`ไม่พบ seller_id ${SELLER_ID}`);

    await conn.query(
      `UPDATE users
       SET bank_account_number = ?, bank_code = ?, bank_account_name = ?, bank_account_verified = 1
       WHERE user_id = ?`,
      [BANK.bank_account_number, BANK.bank_code, BANK.bank_account_name, SELLER_ID]
    );

    const [products] = await conn.query(
      `SELECT product_id, product_title, price
       FROM products
       WHERE seller_id = ?
       ORDER BY status = 'available' DESC, product_id ASC`,
      [SELLER_ID]
    );
    if (!products.length) throw new Error(`ไม่พบสินค้า seller_id ${SELLER_ID}`);

    const [providers] = await conn.query(
      `SELECT provider_id, name, base_price, price_per_item
       FROM shipping_provider
       WHERE is_active = 1
       ORDER BY provider_id ASC`
    );
    if (!providers.length) throw new Error("ไม่พบ shipping_provider ที่ active");

    const [[dbClock]] = await conn.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS db_today");
    const localToday = new Date();
    const dbToday = parseDate(dbClock.db_today);
    const dateSlots = makeDateSlots(localToday, dbToday);
    const statusPlans = makeStatusPlans();
    const paidDeliveredOrders = [];

    for (let i = 0; i < 50; i += 1) {
      const product = products[i % products.length];
      const provider = providers[i % providers.length];
      const quantity = i % 5 === 0 ? 2 : 1;
      const plan = { ...statusPlans[i] };
      const createdAt = dateSlots[i];
      if (plan.order_status === "delivered") {
        // รอบปัจจุบันยังไม่ถึงวันตัดรอบสิ้นเดือน จึงต้องรอโอนอยู่
        plan.payout_status = isSameMonth(createdAt, localToday) ? "pending" : "paid";
      }
      const statusChangedAt = addMinutes(createdAt, 90 + (i % 5) * 35);
      const isShipped = ["shipping", "delivered"].includes(plan.order_status);
      const isDelivered = plan.order_status === "delivered";
      const amounts = calculateAmounts(product, quantity, provider);
      const paymentMethod = plan.payment_status === "paid" ? "card" : null;
      const trackingNumber = isShipped ? `MOCK88${String(i + 1).padStart(5, "0")}TH` : null;
      const shippingDate = isShipped ? formatDateTime(statusChangedAt) : null;
      const completedAt = isDelivered ? formatDateTime(addDays(createdAt, 1 + (i % 3))) : null;
      const recipient = RECIPIENTS[i % RECIPIENTS.length];
      const province = THAI_PROVINCES[i % THAI_PROVINCES.length];
      const paymentIsPaid = plan.payment_status === "paid";
      const platformFee = paymentIsPaid ? amounts.platformFee : 0;
      const sellerPayoutAmount = paymentIsPaid ? amounts.sellerPayoutAmount : 0;
      const totalPrice = paymentIsPaid ? amounts.totalPrice : amounts.itemSubtotal;

      const [orderResult] = await conn.query(
        `INSERT INTO orders
          (buyer_id, seller_id, total_price, platform_fee, seller_payout_amount,
           order_status, tracking_number, shipping_provider, shipping_date,
           created_at, recipient_name, shipping_address, shipping_province,
           shipping_postcode, shipping_phone, payment_status, payout_status,
           payout_date, order_type, payment_method, omise_charge_id, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'purchase', ?, ?, ?)`,
        [
          BUYER_ID,
          SELLER_ID,
          totalPrice,
          platformFee,
          sellerPayoutAmount,
          plan.order_status,
          trackingNumber,
          provider.name,
          shippingDate,
          formatDateTime(createdAt),
          recipient,
          `${100 + i}/${(i % 9) + 1} หมู่ ${(i % 12) + 1} ตำบลตัวอย่าง อำเภอเมือง`,
          province,
          String(73000 + (i % 80)).padStart(5, "0"),
          `08${String(80000000 + i * 137).slice(-8)}`,
          plan.payment_status,
          plan.payout_status,
          paymentMethod,
          `${MOCK_PREFIX}-${String(i + 1).padStart(2, "0")}`,
          completedAt,
        ]
      );
      const orderId = orderResult.insertId;

      await conn.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)",
        [orderId, product.product_id, quantity, product.price]
      );

      await conn.query(
        "INSERT INTO order_shipping (order_id, seller_id, provider_id, shipping_price) VALUES (?, ?, ?, ?)",
        [orderId, SELLER_ID, provider.provider_id, paymentIsPaid ? amounts.shippingPrice : 0]
      );

      if (plan.order_status === "delivered" && plan.payout_status === "paid") {
        const payoutDate = payoutCycleDate(createdAt, i);
        paidDeliveredOrders.push({
          order_id: orderId,
          net: sellerPayoutAmount,
          fee: platformFee,
          payoutDate,
          cycle: payoutCycleKey(createdAt),
        });
      }
    }

    const payoutGroups = new Map();
    for (const order of paidDeliveredOrders) {
      const group = payoutGroups.get(order.cycle) || [];
      group.push(order);
      payoutGroups.set(order.cycle, group);
    }

    let payoutGroupIndex = 0;
    for (const [cycle, orders] of payoutGroups.entries()) {
      const latestPayoutDate = orders
        .map((order) => order.payoutDate)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const netAmount = orders.reduce((sum, order) => sum + Number(order.net || 0), 0);
      const feeAmount = orders.reduce((sum, order) => sum + Number(order.fee || 0), 0);

      const [payoutResult] = await conn.query(
        `INSERT INTO payouts
          (seller_id, net_amount, fee_amount, order_count, status,
           omise_transfer_id, created_at, completed_at)
         VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`,
        [
          SELLER_ID,
          netAmount,
          feeAmount,
          orders.length,
          `${MOCK_PREFIX}-transfer-${cycle}-${payoutGroupIndex + 1}`,
          formatDateTime(latestPayoutDate),
          formatDateTime(latestPayoutDate),
        ]
      );
      payoutGroupIndex += 1;

      await conn.query(
        "UPDATE orders SET payout_id = ?, payout_date = ? WHERE order_id IN (?)",
        [payoutResult.insertId, formatDateTime(latestPayoutDate), orders.map((order) => order.order_id)]
      );
    }

    await conn.commit();

    const [[summary]] = await db.query(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(payment_status = 'paid') AS paid_orders,
         SUM(order_status IN ('pending','confirmed') AND payment_status = 'paid') AS to_ship,
         SUM(order_status = 'shipping') AS shipping,
         SUM(order_status = 'delivered' AND payout_status = 'pending') AS delivered_pending_payout,
         SUM(order_status = 'delivered' AND payout_status = 'paid') AS delivered_paid,
         SUM(order_status = 'cancelled') AS cancelled,
         COALESCE(SUM(platform_fee), 0) AS fee_total,
         COALESCE(SUM(seller_payout_amount), 0) AS seller_payout_total
       FROM orders
       WHERE omise_charge_id LIKE ?`,
      [`${MOCK_PREFIX}-%`]
    );
    const [[payoutSummary]] = await db.query(
      `SELECT COUNT(*) AS payout_count, COALESCE(SUM(net_amount), 0) AS paid_total
       FROM payouts
       WHERE omise_transfer_id LIKE ?`,
      [`${MOCK_PREFIX}-%`]
    );

    console.log(JSON.stringify({ orders: summary, payouts: payoutSummary }, null, 2));
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
