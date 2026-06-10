import { createContext, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  // localStorage is per-tab → each tab can hold a different user session
  const [token,     setToken]     = useState(localStorage.getItem("token"));
  const [role,      setRole]      = useState(localStorage.getItem("role"));
  const [userName,  setUserName]  = useState(localStorage.getItem("userName"));
  const [userEmail, setUserEmail] = useState(localStorage.getItem("userEmail"));

  const login = ({ token, role, user_name, user_email }) => {
    localStorage.setItem("token",     token);
    localStorage.setItem("role",      role);
    localStorage.setItem("userName",  user_name  || "");
    localStorage.setItem("userEmail", user_email || "");

    setToken(token);
    setRole(role);
    setUserName(user_name   || "");
    setUserEmail(user_email || "");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    setToken(null);
    setRole(null);
    setUserName(null);
    setUserEmail(null);
  };

  // Handle auto-logout in this tab when any API call returns 401
  useEffect(() => {
    const onLogout = () => {
      setToken(null);
      setRole(null);
      setUserName(null);
      setUserEmail(null);
    };
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  // เรียกหลัง batch post สำเร็จ — sync state + localStorage ให้ตรงกัน
  const updateRole = (newRole) => {
    localStorage.setItem("role", newRole);
    setRole(newRole);
  };

  const updateUserName = (newName) => {
    localStorage.setItem("userName", newName);
    setUserName(newName);
  };

  // const value = useMemo(
  //   () => ({ token, role, userName, login, logout, updateRole }),
  //   [token, role, userName]
  // );

  const value = useMemo(
    () => ({ token, role, userName, userEmail, login, logout, updateRole, updateUserName }),
    [token, role, userName, userEmail]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}