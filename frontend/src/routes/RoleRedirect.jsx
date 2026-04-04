import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RoleRedirect({ children }) {
  const { role } = useAuth();
  const location = useLocation();

  if (location.pathname.startsWith("/confirm/")) {
    return children;
  }

  if (role === "school_admin") return <Navigate to="/school/welcome" replace />;
  return children;
}