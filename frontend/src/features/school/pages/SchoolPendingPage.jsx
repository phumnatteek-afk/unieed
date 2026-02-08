import { useLocation, useNavigate } from "react-router-dom";

export default function SchoolPendingPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const status = state?.status || "pending";
  const note = state?.note || null;

  return (
    <div style={{ padding: 24 }}>
      <h2>สถานะการยืนยันโรงเรียน</h2>
      <p>สถานะ: {status}</p>
      {note && <p>หมายเหตุ: {note}</p>}

      <button onClick={() => navigate("/register/school")}>
        กลับไปยื่นเอกสาร/แก้ไข
      </button>
      <button onClick={() => navigate("/login")}>กลับไปหน้าเข้าสู่ระบบ</button>
    </div>
  );
}
