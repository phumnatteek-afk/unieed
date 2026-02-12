import { useLocation, useNavigate } from "react-router-dom";
import "../styles/school.css";
// icon
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { faCircleXmark, faClock } from "@fortawesome/free-solid-svg-icons";


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

  const statusConfig = {
    rejected: {
      label: "ไม่ผ่านการยืนยัน",
      icon: <FontAwesomeIcon icon={faCircleXmark} />,
      className: "status-rejected"
    },
    pending: {
      label: "รอการตรวจสอบ",
      icon: <FontAwesomeIcon icon={faClock} />,
      className: "status-pending"
    }
  };
  const currentStatus = statusConfig[status] || statusConfig.pending;
  return (
    <div className="pendingPage">
      <div className="pendingCard">
        <h2 className="pendingTitle">สถานะการยืนยันโรงเรียน</h2>

        <div className={`pendingStatus ${status} flex items-center gap-2`}>
          {currentStatus.icon}
          <span>สถานะ: {currentStatus.label}</span>
        </div>

        {status === "pending" && (
          <p className="pendingDesc">
            การลงทะเบียนของท่านอยู่ระหว่างการตรวจสอบเอกสาร
            ระบบจะใช้ระยะเวลาในการพิจารณาประมาณ <b>3–5 วันทำการ</b>
            กรุณารอผลการตรวจสอบ และท่านจะได้รับการแจ้งผลเมื่อการพิจารณาเสร็จสิ้น
          </p>
        )}


        {status === "rejected" && (
          <p className="pendingDesc">
            การยืนยันโรงเรียนของท่าน <b>ไม่ผ่านการตรวจสอบ</b> กรุณาดูเหตุผลด้านล่าง
            และสามารถกลับไปแก้ไข/ยื่นเอกสารใหม่ได้
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
