// src/features/market/hooks/useAddToCart.js
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

export function useAddToCart() {
  const { token } = useAuth();
  const navigate  = useNavigate();
  const { refreshCart }      = useCart();  
  const [loadingId, setLoadingId] = useState(null); // product_id ที่กำลังโหลด
  const [toastMsg,  setToastMsg]  = useState("");

  const addToCart = async (productId) => {
    if (!token) {
      navigate("/login");
      return;
    }

    setLoadingId(productId);
    try {
      const res  = await fetch("/api/cart", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: Number(productId), quantity: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");

      await refreshCart(); 
      setToastMsg("เพิ่มลงตะกร้าแล้ว! 🛒");
    } catch (e) {
      setToastMsg(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoadingId(null);
      setTimeout(() => setToastMsg(""), 2500);
    }
  };

  return { addToCart, loadingId, toastMsg };
}