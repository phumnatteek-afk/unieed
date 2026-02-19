import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";

export default function SchoolEntryGatePage() {
  const nav = useNavigate();
  const { token, role } = useAuth();

  useEffect(() => {
    (async () => {
      // กันหลุด role
      if (!token || role !== "school_admin") {
        nav("/login");
        return;
      }

      // เช็คว่ามีโครงการแล้วไหม
      const latest = await getJson("/school/projects/latest", true);

      if (!latest) {
        // ✅ ครั้งแรก (ยังไม่มีโพสต์/โครงการ)
        nav("/school/welcome");
        return;
      }

      // ✅ มีแล้ว -> เข้า dashboard ตามภาพ
      nav("/school/dashboard");
    })();
  }, [token, role, nav]);

  return null; // หรือทำ loading ก็ได้
}
