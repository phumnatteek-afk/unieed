import { useEffect, useState } from "react";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Link } from "react-router-dom";
import "../styles/admin.css";

export default function AdminSchoolsPage() {
  const { token } = useAuth();
  const [schools, setSchools] = useState([]);

  useEffect(() => {
    (async () => {
      const rows = await request("/admin/schools", { token });
      setSchools(rows);
    })();
  }, [token]);

  return (
    <div className="adminWrap">
      <h2>ตรวจสอบโรงเรียน</h2>

      <div className="table">
        <div className="thead">
          <div>ชื่อโรงเรียน</div>
          <div>สถานะ</div>
          <div>รายละเอียด</div>
        </div>

        {schools.map(s => (
      <div className="row" key={s.school_id}>
        <div>{s.school_name}</div>
        <div>
          <span className={`status ${s.verification_status}`}>
            {s.verification_status}
          </span>
        </div>
        <div className="actionsCell">
          <a className="tab" href={`/admin/schools/${s.school_id}`}>เปิด</a>
        </div>
      </div>
    ))}
  </div>
    </div>
  );
}
