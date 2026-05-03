/**
 * แปลง order_id (number) -> order number ที่แสดงผล
 * Pattern: #ORD-00<id>  เช่น 1 -> "#ORD-001", 45 -> "#ORD-0045"
 *
 * - ขั้นต่ำ 3 หลัก (#ORD-001)
 * - ขยายอัตโนมัติเมื่อตัวเลขเกิน เช่น 1234 -> "#ORD-1234"
 */
export function formatOrderNo(orderId) {
  if (orderId === null || orderId === undefined) return "";
  const n = Number(orderId);
  if (!Number.isFinite(n)) return String(orderId);
  return `#ORD-${String(n).padStart(3, "0")}`;
}

export default formatOrderNo;
