import { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [token,    setToken]    = useState(localStorage.getItem("token"));
  const [role,     setRole]     = useState(localStorage.getItem("role"));
  const [userName, setUserName] = useState(localStorage.getItem("userName"));

  const login = ({ token, role, user_name }) => {
    localStorage.setItem("token",    token);
    localStorage.setItem("role",     role);
    localStorage.setItem("userName", user_name || "");

    setToken(token);
    setRole(role);
    setUserName(user_name || "");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userName");
    setToken(null);
    setRole(null);
    setUserName(null);
  };

  // เรียกหลัง batch post สำเร็จ — sync state + localStorage ให้ตรงกัน
  const updateRole = (newRole) => {
    localStorage.setItem("role", newRole);
    setRole(newRole);
  };

  const value = useMemo(
    () => ({ token, role, userName, login, logout, updateRole }),
    [token, role, userName]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}