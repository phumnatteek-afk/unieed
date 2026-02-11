import { useLocation, useNavigate } from "react-router-dom";
import "../styles/school.css";
// icon
import { Icon } from "@iconify/react";

export default function SchoolPendingPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const status = state?.status || "pending";
  const note = state?.note || null;

  const statusLabel =
    status === "approved"
      ? "อนุมัติแล้ว"
      : status === "rejected"
      ? "ไม่ผ่านการยืนยัน"
      : "รอการตรวจสอบ";

  return (
    <div className="pendingPage">
      <div className="pendingCard">
        <h2 className="pendingTitle">สถานะการยืนยันโรงเรียน</h2>

        <div className={`pendingStatus ${status}`}>
          <Icon icon="ic:outline-pending-actions" /> สถานะ: {statusLabel}
        </div>

        {status === "pending" && (
          <p className="pendingDesc">
            การลงทะเบียนของท่านอยู่ระหว่างการตรวจสอบเอกสาร
            ระบบจะใช้ระยะเวลาในการพิจารณาประมาณ <b>3–5 วันทำการ</b>
            กรุณารอผลการตรวจสอบ และท่านจะได้รับการแจ้งผลเมื่อการพิจารณาเสร็จสิ้น
          </p>
        )}

        {note && <div className="pendingNote">หมายเหตุ: {note}</div>}

        <div className="pendingActions">
          <button
            className="btn btnPrimary"
            onClick={() => navigate("/register/school")}
          >
            กลับไปยื่นเอกสาร/แก้ไข
          </button>

          <button className="btn btnGhost" onClick={() => navigate("/login")}>
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
