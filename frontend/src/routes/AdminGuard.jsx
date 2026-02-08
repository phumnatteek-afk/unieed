import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminGuard({ children }) {
  const { token, role } = useAuth();

  if (!token) return <Navigate to="/admin/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;

  return children;
}