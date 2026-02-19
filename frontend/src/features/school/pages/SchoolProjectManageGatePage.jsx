import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getJson } from "../../../api/http";

export default function SchoolProjectManageGatePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        setLoading(true);

        const projects = await getJson("/school/projects", true); // ต้องมี auth=true
        if (!alive) return;

        if (!projects || projects.length === 0) nav("/school/welcome", { replace: true });
        else nav(`/school/projects/${projects[0].request_id}`, { replace: true });
      } catch (e) {
        if (!alive) return;
        setErr(e?.data?.message || e.message || "โหลดไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [loc.key]); // ✅ สำคัญ: เข้า route เดิมซ้ำก็ re-run ได้

  if (loading) return <div>กำลังโหลด…</div>;
  if (err) return <div style={{color:"crimson"}}>{err}</div>;
  return null;
}
