import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { verifyEmail } from "../services/auth.service.js";
import "../styles/auth.css";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("ลิงก์ไม่ถูกต้อง");
      return;
    }

    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((e) => {
        setStatus("error");
        setMessage(e?.data?.message || e?.message || "เกิดข้อผิดพลาด");
      });
  }, [token]);

  return (
    <div className="lgPage">
      <div className="lgCard">
        <div className="lgHeader">
          <h2 className="lgTitle">ยืนยันอีเมล</h2>
        </div>

        {status === "loading" && (
          <div className="lgAlert">กำลังยืนยันอีเมล...</div>
        )}

        {status === "success" && (
          <>
            <div className="lgAlert lgAlert--success">
              ยืนยันอีเมลสำเร็จ! คุณสามารถเข้าสู่ระบบได้แล้ว
            </div>
            <div className="lgFooter" style={{ marginTop: "16px" }}>
              <Link to="/login" className="lgBtn" style={{ display: "inline-block" }}>
                ไปหน้าเข้าสู่ระบบ
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="lgAlert lgAlert--error">{message}</div>
            <div className="lgFooter" style={{ marginTop: "16px" }}>
              <Link to="/resend-verification" className="lgLink">
                ขอส่งอีเมลยืนยันใหม่
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}