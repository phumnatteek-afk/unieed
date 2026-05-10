// frontend/src/features/market/pages/CartPage.jsx
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import Navbar from "../../../pages/Navbar.jsx";
import "../styles/CartPage.css";

// ── helpers ──────────────────────────────────────────────
function getCategoryLabel(categoryId, gender) {
  const cid = Number(categoryId);
  if (cid === 1) return gender === "male" ? "เสื้อนักเรียนชาย" : "เสื้อนักเรียนหญิง";
  if (cid === 2) return "กางเกงนักเรียน";
  if (cid === 3) return "กระโปรงนักเรียน";
  return "ชุดนักเรียน";
}

function getSizeText(size, categoryId) {
  if (!size) return null;
  try {
    const s = JSON.parse(size);
    const cid = Number(categoryId);
    const parts = [];
    if (cid === 1) {
      if (s.chest  && s.chest  !== "0") parts.push(`อก ${s.chest}`);
      if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
    } else {
      if (s.waist  && s.waist  !== "0") parts.push(`เอว ${s.waist}`);
      if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
    }
    return parts.join(" / ") || null;
  } catch { return size; }
}

// ── Group items by seller ────────────────────────────────
function groupBySeller(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.seller_id || "unknown";
    if (!map.has(key)) {
      map.set(key, { seller_id: key, seller_name: item.seller_name || "ไม่ระบุ", items: [] });
    }
    map.get(key).items.push(item);
  }
  return Array.from(map.values());
}

function isItemBuyable(item) {
  return (
    item &&
    item.status === "available" &&
    Number(item.stock) > 0 &&
    Number(item.quantity) <= Number(item.stock)
  );
}

// ── Main ─────────────────────────────────────────────────
export default function CartPage() {
  const { token } = useAuth();
  const navigate  = useNavigate();

  const [cart,     setCart]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(new Set()); // cart_item_id
  const [updating, setUpdating] = useState(null);

  const fetchCart = useCallback(async () => {
    if (!token) { navigate("/login"); return; }
    try {
      const res  = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCart(data);
      // select only buyable items by default
      const all = new Set((data.items || []).filter(isItemBuyable).map(i => i.cart_item_id));
      setSelected(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  useEffect(() => {
    if (!cart?.items) return;
    const buyableIdSet = new Set(cart.items.filter(isItemBuyable).map(i => i.cart_item_id));
    setSelected(prev => {
      const next = new Set([...prev].filter(id => buyableIdSet.has(id)));
      return next;
    });
  }, [cart]);

  const updateQty = async (cartItemId, qty) => {
    setUpdating(cartItemId);
    try {
      const res  = await fetch(`/api/cart/${cartItemId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ quantity: qty }),
      });
      const data = await res.json();
      setCart(data);
      if (qty < 1) setSelected(prev => { const s = new Set(prev); s.delete(cartItemId); return s; });
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (cartItemId) => {
    setUpdating(cartItemId);
    try {
      const res  = await fetch(`/api/cart/${cartItemId}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCart(data);
      setSelected(prev => { const s = new Set(prev); s.delete(cartItemId); return s; });
    } finally {
      setUpdating(null);
    }
  };

  const toggleSelect = (id) => {
    const item = cart?.items?.find(i => i.cart_item_id === id);
    if (!isItemBuyable(item)) return;
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (!cart) return;
    const buyableItems = cart.items.filter(isItemBuyable);
    if (selected.size === buyableItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(buyableItems.map(i => i.cart_item_id)));
    }
  };

  // คำนวณยอด
  // ✅ ใหม่
const selectedItems = (cart?.items || []).filter(i => selected.has(i.cart_item_id) && isItemBuyable(i));
const subtotal      = selectedItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
const shippingTotal = selectedItems.reduce((s, i) => s + Number(i.shipping_price || 0), 0);
const total         = subtotal + shippingTotal;
const groups        = groupBySeller(cart?.items || []);
const buyableCount  = (cart?.items || []).filter(isItemBuyable).length;

  if (!token) return null;

  return (
    <div className="cpPage">
      {/* Navbar */}
      <Navbar activeLink="market" />

      <div className="cpContainer">
        <div className="cpHeader">
          <h1 className="cpTitle">
            <Icon icon="mdi:cart-outline" /> ตะกร้าสินค้า
          </h1>
          {!loading && cart && (
            <span className="cpCount">{cart.items.length} รายการ</span>
          )}
        </div>

        {loading ? (
          <div className="cpLoading">
            <Icon icon="mdi:loading" className="cpSpinner" /> กำลังโหลด...
          </div>
        ) : !cart?.items?.length ? (
          <div className="cpEmpty">
            <Icon icon="mdi:cart-off" fontSize={64} />
            <p>ตะกร้าของคุณว่างเปล่า</p>
            <Link to="/market" className="cpShopBtn">
              <Icon icon="mdi:store-outline" /> ไปช้อปปิ้ง
            </Link>
          </div>
        ) : (
          <div className="cpLayout">
            {/* Items */}
            <div className="cpItems">
              {/* Select all */}
              <div className="cpSelectAll">
                <label className="cpCheckLabel">
                  <input
                    type="checkbox"
                    checked={buyableCount > 0 && selected.size === buyableCount}
                    onChange={toggleSelectAll}
                    disabled={buyableCount === 0}
                  />
                  <span>เลือกทั้งหมด ({buyableCount} รายการที่สั่งซื้อได้)</span>
                </label>
              </div>

              {/* Group by seller */}
              {groups.map(group => (
                <div key={group.seller_id} className="cpGroup">
                  <div className="cpGroupHeader">
                    <div className="cpSellerAvatar">
                      {group.seller_name[0].toUpperCase()}
                    </div>
                    <span className="cpSellerName">{group.seller_name}</span>
                  </div>

                  {group.items.map(item => {
                    const catLabel = getCategoryLabel(item.category_id, item.gender);
                    const typePart = item.type_name?.trim();
                    const title    = typePart ? `${catLabel}: ${typePart}` : catLabel;
                    const sizeText = getSizeText(item.size, item.category_id);
                    const isSelected = selected.has(item.cart_item_id);
                    const isUpdating = updating === item.cart_item_id;
                    const buyable = isItemBuyable(item);
                    const soldOut = item.status !== "available" || Number(item.stock) <= 0;

                    return (
                      <div
                        key={item.cart_item_id}
                        className={`cpItem${isSelected ? " cpItemSelected" : ""}`}
                        style={!buyable ? { opacity: 0.72 } : undefined}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          className="cpItemCheck"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.cart_item_id)}
                          disabled={!buyable}
                        />

                        {/* Image */}
                        <Link to={`/market/${item.product_id}`} className="cpItemImg">
                          {item.cover_image
                            ? <img src={item.cover_image} alt={title} loading="lazy" />
                            : <div className="cpItemPlaceholder"><Icon icon="mdi:tshirt-crew" /></div>
                          }
                        </Link>

                        {/* Info */}
                        <div className="cpItemInfo">
                          <Link to={`/market/${item.product_id}`} className="cpItemTitle">
                            {title}
                          </Link>
                          {item.school_name && (
                            <div className="cpItemMeta">
                              <Icon icon="mdi:school-outline" /> {item.school_name}
                            </div>
                          )}
                          {sizeText && (
                            <div className="cpItemMeta">ขนาด: {sizeText}</div>
                          )}
                          {item.shipping_name && (
  <div className="cpItemMeta">
    <Icon icon="mdi:truck-outline" /> {item.shipping_name}
    {item.shipping_price > 0 && ` · ฿${Number(item.shipping_price).toLocaleString()}`}
  </div>
)}
                          <div className={`cpItemStock${!buyable ? " cpItemStockWarn" : ""}`}>
                            {soldOut
                              ? "สินค้าหมด"
                              : Number(item.quantity) > Number(item.stock)
                                ? `เหลือ ${item.stock} ชิ้น (ในตะกร้าเกินจำนวน)`
                                : `มีสินค้า ${item.stock} ชิ้น`}
                          </div>
                        </div>

                        {/* Price + Qty */}
                        <div className="cpItemRight">
                          <div className="cpItemPrice">
                            {Number(item.price).toLocaleString()} บาท
                          </div>
                          <div className="cpQtyRow">
                            <button
                              className="cpQtyBtn"
                              onClick={() => updateQty(item.cart_item_id, item.quantity - 1)}
                              disabled={isUpdating || !buyable}
                            >−</button>
                            <span className="cpQty">{item.quantity}</span>
                            <button
                              className="cpQtyBtn"
                              onClick={() => updateQty(item.cart_item_id, item.quantity + 1)}
                              disabled={isUpdating || !buyable || item.quantity >= item.stock}
                            >+</button>
                          </div>
                          <div className="cpItemSubtotal">
                            รวม: <b>{(Number(item.price) * item.quantity).toLocaleString()}</b> บาท
                          </div>
                          <button
                            className="cpRemoveBtn"
                            onClick={() => removeItem(item.cart_item_id)}
                            disabled={isUpdating}
                          >
                            <Icon icon="mdi:trash-can-outline" /> ลบ
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="cpSummary">
              <div className="cpSummaryCard">
                <div className="cpSummaryTitle">สรุปคำสั่งซื้อ</div>

                <div className="cpSummaryRows">
  <div className="cpSummaryRow">
    <span>สินค้าที่เลือก</span>
    <span>{selectedItems.length} รายการ</span>
  </div>
  <div className="cpSummaryRow">
    <span>ยอดสินค้า</span>
    <span>{subtotal.toLocaleString()} บาท</span>
  </div>
  <div className="cpSummaryRow">
    <span>ค่าจัดส่ง</span>
    <span>{shippingTotal.toLocaleString()} บาท</span>
  </div>
</div>

<div className="cpSummaryDivider" />

<div className="cpSummaryTotal">
  <span>ยอดรวม</span>
  <span className="cpTotalPrice">{total.toLocaleString()} บาท</span>
</div>

                <button
                  className="cpCheckoutBtn"
                  disabled={selectedItems.length === 0}
                  onClick={() => {
                    const ids = selectedItems.map(i => i.cart_item_id).join(",");
                    navigate(`/checkout?items=${ids}`);
                  }}
                >
                  <Icon icon="mdi:credit-card-outline" />
                  ดำเนินการสั่งซื้อ ({selectedItems.length})
                </button>

                <Link to="/market" className="cpContinueBtn">
                  <Icon icon="mdi:arrow-left" /> ช้อปต่อ
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}