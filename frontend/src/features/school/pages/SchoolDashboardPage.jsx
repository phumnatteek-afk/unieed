import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/school.css";

export default function SchoolDashboardPage() {
  const { userName } = useAuth();
  return (
    <div className="schoolWrap">
      <div className="schoolHero">
        <h1>ยินดีต้อนรับ {userName || ""}</h1>
        <button className="primaryBtn">สร้างโพสต์ขอรับบริจาคของคุณที่นี่</button>
      </div>
    </div>
  );
}
