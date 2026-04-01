import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function FallbackRedirect() {
  const { role } = useAuth();

  if (role === "school_admin") return <Navigate to="/school/dashboard" replace />;
  if (role === "admin") return <Navigate to="/admin/backoffice" replace />;  // ← เพิ่ม

  return <Navigate to="/" replace />;
}