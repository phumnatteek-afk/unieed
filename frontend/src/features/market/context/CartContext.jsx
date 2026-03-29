// src/features/market/context/CartContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";


const CartContext = createContext();

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    if (!token) { setCartCount(0); return; }
    try {
      const res  = await fetch("/api/cart/count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCartCount(data.count || 0);
    } catch {}
  }, [token]);

  // โหลดครั้งแรก / token เปลี่ยน
  useEffect(() => { refreshCart(); }, [refreshCart]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}