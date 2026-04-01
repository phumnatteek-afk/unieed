import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RoleRedirect({ children }) {
  const { role } = useAuth();
  if (role === "school_admin") return <Navigate to="/school/welcome" replace />;
  return children;
}