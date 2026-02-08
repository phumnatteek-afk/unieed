import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { request } from "../../../api/http.js";
import "../styles/admin.css";

export default function AdminSchoolDetailPage() {
  const { id } = useParams();
  const [school, setSchool] = useState(null);
  const [note, setNote] = useState("");

  const load = async () => {
 const s = await request(`/admin/schools/${id}`, {
  method: "GET",
  auth: true,
});
    setSchool(s);
    setNote(s.verification_note || "");
  };

  useEffect(() => {
    load();
  }, [id]);

  const approve = async () => {
    await request(`/admin/schools/${id}/approve`, {
  method: "POST",
  body: {},
  auth: true,
});
    alert("Approved");
    await load();
  };

  const reject = async () => {
    
await request(`/admin/schools/${id}/reject`, {
  method: "POST",
  body: { verification_note: note },
  auth: true,
});
    alert("Rejected");
    await load();
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

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ/เหตุผล (กรณี Reject)"
        />

        <div className="actions">
          <button className="ok" onClick={approve}>Approve</button>
          <button className="bad" onClick={reject}>Reject</button>
        </div>
      </div>
    </div>
  );
}
