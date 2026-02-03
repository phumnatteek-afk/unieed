import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ allowRoles, children }) {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (allowRoles && !allowRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
}
