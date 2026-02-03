import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/school.css";

export default function SchoolPendingPage() {
  const { token } = useAuth();
  const { state } = useLocation();
  const nav = useNavigate();
  const [status, setStatus] = useState(state?.verification_status || "pending");
  const [note, setNote] = useState(state?.verification_note || "");

  useEffect(() => {
    // ทุกครั้งที่เข้า page ให้ดึงสถานะล่าสุดจากระบบ (เช็คเองในระบบ)
    (async () => {
      const me = await request("/school/me", { token });
      if (!me) return;

      setStatus(me.verification_status);
      setNote(me.verification_note || "");

      if (me.verification_status === "approved") {
        nav("/school/dashboard", { replace:true });
      }
    })();
  }, [token, nav]);

  return (
    <div className="schoolWrap">
      <div className="schoolCard">
        <h2>สถานะการยืนยันโรงเรียน</h2>

        {status === "pending" && (
          <>
            <div className="badge pending">รอการตรวจสอบ</div>
            <p className="desc">กรุณาเข้าสู่ระบบเพื่อตรวจสอบผลการพิจารณา</p>
          </>
        )}

        {status === "rejected" && (
          <>
            <div className="badge rejected">ไม่ผ่านการตรวจสอบ</div>
            {note && <p className="desc">เหตุผล: {note}</p>}
            <p className="desc">โปรดแก้ไขข้อมูล/เอกสาร แล้วส่งใหม่ (ทำได้ในเวอร์ชันถัดไป)</p>
          </>
        )}
      </div>
    </div>
  );
}
