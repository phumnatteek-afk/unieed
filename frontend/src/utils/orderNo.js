export function formatOrderNo(orderId) {
  if (orderId === null || orderId === undefined) return "";
  const n = Number(orderId);
  if (!Number.isFinite(n)) return String(orderId);
  return `#ORD-${String(n).padStart(3, "0")}`;
}

export default formatOrderNo;
