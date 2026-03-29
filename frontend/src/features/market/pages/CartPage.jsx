// frontend/src/features/market/pages/CartPage.jsx
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
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
      // select all by default
      const all = new Set((data.items || []).map(i => i.cart_item_id));
      setSelected(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

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
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (!cart) return;
    if (selected.size === cart.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cart.items.map(i => i.cart_item_id)));
    }
  };

  // คำนวณยอด
  // ✅ ใหม่
const selectedItems = (cart?.items || []).filter(i => selected.has(i.cart_item_id));
const subtotal      = selectedItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
const shippingTotal = selectedItems.reduce((s, i) => s + Number(i.shipping_price || 0), 0);
const total         = subtotal + shippingTotal;
const groups        = groupBySeller(cart?.items || []);

  if (!token) return null;

  return (
    <div className="cpPage">
      {/* Navbar */}
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>
          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/projects">โครงการ</Link>
            <Link to="/market">ร้านค้า</Link>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><Link to="/sell">ลงขาย</Link></button>
          </nav>
          <ProfileDropdown />
        </div>
      </header>

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
                    checked={selected.size === cart.items.length}
                    onChange={toggleSelectAll}
                  />
                  <span>เลือกทั้งหมด ({cart.items.length} รายการ)</span>
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

                    return (
                      <div
                        key={item.cart_item_id}
                        className={`cpItem${isSelected ? " cpItemSelected" : ""}`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          className="cpItemCheck"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.cart_item_id)}
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
                          <div className="cpItemStock">
                            {item.stock > 0 ? `มีสินค้า ${item.stock} ชิ้น` : "สินค้าหมด"}
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
                              disabled={isUpdating}
                            >−</button>
                            <span className="cpQty">{item.quantity}</span>
                            <button
                              className="cpQtyBtn"
                              onClick={() => updateQty(item.cart_item_id, item.quantity + 1)}
                              disabled={isUpdating || item.quantity >= item.stock}
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
                    const ids = [...selected].join(",");
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