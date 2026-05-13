import { createContext, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  // sessionStorage is per-tab → each tab can hold a different user session
  const [token,     setToken]     = useState(sessionStorage.getItem("token"));
  const [role,      setRole]      = useState(sessionStorage.getItem("role"));
  const [userName,  setUserName]  = useState(sessionStorage.getItem("userName"));
  const [userEmail, setUserEmail] = useState(sessionStorage.getItem("userEmail"));

  const login = ({ token, role, user_name, user_email }) => {
    sessionStorage.setItem("token",     token);
    sessionStorage.setItem("role",      role);
    sessionStorage.setItem("userName",  user_name  || "");
    sessionStorage.setItem("userEmail", user_email || "");

    setToken(token);
    setRole(role);
    setUserName(user_name   || "");
    setUserEmail(user_email || "");
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userEmail");
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

  // เรียกหลัง batch post สำเร็จ — sync state + sessionStorage ให้ตรงกัน
  const updateRole = (newRole) => {
    sessionStorage.setItem("role", newRole);
    setRole(newRole);
  };

  const updateUserName = (newName) => {
    sessionStorage.setItem("userName", newName);
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