import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { request } from "../../../api/http.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/admin.css";

export default function AdminSchoolDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [school, setSchool] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      const s = await request(`/admin/schools/${id}`, { token });
      setSchool(s);
      setNote(s.verification_note || "");
    })();
  }, [id, token]);

  const approve = async () => {
    await request(`/admin/schools/${id}/approve`, { method:"POST", token });
    alert("Approved");
    const s = await request(`/admin/schools/${id}`, { token });
    setSchool(s);
  };

  const reject = async () => {
    await request(`/admin/schools/${id}/reject`, { method:"POST", token, body:{ verification_note: note } });
    alert("Rejected");
    const s = await request(`/admin/schools/${id}`, { token });
    setSchool(s);
  };

  if (!school) return <div className="adminWrap">Loading…</div>;

  return (
    <div className="adminWrap">
      <h2>{school.school_name}</h2>
      <div className="card">
        <p>สถานะ: {school.verification_status}</p>
        <p>ที่อยู่: {school.school_address}</p>
        <p>โทร: {school.school_phone}</p>

        {school.school_doc_url && (
          <a href={school.school_doc_url} target="_blank" rel="noreferrer">
            ดูเอกสาร (Cloudinary)
          </a>
        )}

        <div className="actions">
          <button className="ok" onClick={approve}>Approve</button>
          <button className="bad" onClick={reject}>Reject</button>
        </div>

        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="หมายเหตุ/เหตุผล (กรณี Reject)" />
      </div>
    </div>
  );
}
