import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";

export default function AdminBackofficePage() {
  const { user_name } = useAuth();

  return (
    <div className="adminWrap">
      <h2>Backoffice</h2>
      <p>สวัสดี {user_name || "Admin"}</p>

      <div className="tabBar">
        <Link to="/admin/schools" className="tab">โรงเรียน</Link>
        <Link to="/admin/users" className="tab">ผู้ใช้</Link>
        <Link to="/admin/products" className="tab">สินค้า</Link>
      </div>

      <div className="card">
        <p>ภาพรวมระบบ (ใส่จำนวนโรงเรียน/ผู้ใช้/สินค้าได้ทีหลัง)</p>
        <p>เริ่มจากเมนู “โรงเรียน” เพื่ออนุมัติคำขอ</p>
      </div>
    </div>
  );
}
