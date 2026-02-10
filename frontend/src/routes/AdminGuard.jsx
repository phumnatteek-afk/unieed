import { Navigate, Outlet } from "react-router-dom"; // ✅ ต้องมี Outlet
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminGuard() {
  const { token, role } = useAuth();

  if (!token) return <Navigate to="/admin/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
}
