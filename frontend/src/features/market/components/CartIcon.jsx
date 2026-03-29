// frontend/src/features/market/components/CartIcon.jsx
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import "../styles/CartIcon.css";

export default function CartIcon() {
  const { token }     = useAuth();
  const { cartCount } = useCart();

  if (!token) return null;

  return (
    <Link to="/cart" className="cartIconWrap">
      <Icon icon="mdi:cart-outline" fontSize={24} />
      {cartCount > 0 && (
        <span className="cartIconBadge">{cartCount > 99 ? "99+" : cartCount}</span>
      )}
    </Link>
  );
}