import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

const formatDate = (raw) => {
  if (!raw) return "-";
  return new Date(raw).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const parseJson = (val) => {
  if (!val) return [];
  try { return typeof val === "string" ? JSON.parse(val) : val; } catch { return []; }
};

export default function AdminWrongItemPage() {
  const { token } = useAuth();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [resetting, setResetting] = useState(null);
  const [expanded, setExpanded]   = useState(null);
  const [search, setSearch]       = useState("");
  const [resetTarget, setResetTarget] = useState(null); // { donor_id, donor_name, strike_count }

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BASE}/donations/wrong-items`, { headers });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleResetStrike = async () => {
    if (!resetTarget) return;
    try {
      setResetting(resetTarget.donor_id);
      setResetTarget(null);
      await fetch(`${BASE}/donations/users/${resetTarget.donor_id}/reset-strike`, { method: "PATCH", headers });
      load();
    } catch (e) { console.error(e); }
    finally { setResetting(null); }
  };

  const filtered = users.filter(u =>
    u.strike_count > 0 &&
    (!search || u.donor_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      {/* Header */}
      <div className="boTop" style={{ marginBottom: 24 }}>
        <div>
          <div className="boTitle">ตรวจสอบของไม่ตรง</div>
          <p style={{ fontSize: 13, color: "#fff", margin: "4px 0 0" }}>
            ผู้บริจาคที่มีประวัติส่งรายการไม่ตรงและยังมี strike คงเหลือ
          </p>
        </div>
        <div className="boAdmin">
          <NotificationBell />
          <div className="boAdminText"><ProfileDropdown /></div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px", marginBottom: 20, maxWidth: 380 }}>
        <Icon icon="mdi:magnify" width={18} color="#94a3b8" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อผู้บริจาค..."
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, flex: 1, color: "#1e293b" }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <Icon icon="mdi:check-circle-outline" width={40} color="#86efac" />
          <div style={{ marginTop: 12, fontSize: 14 }}>ไม่มีผู้บริจาคที่มี strike คงเหลือ</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(user => {
            const isSuspended = user.suspended_until && new Date(user.suspended_until) > new Date();
            const isExpanded  = expanded === user.donor_id;
            const cases       = parseJson(user.cases);

            return (
              <div key={user.donor_id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                {/* User row */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", flexWrap: "wrap" }}>

                  {/* Avatar + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon icon="mdi:account" width={22} style={{ color: "#fff" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{user.donor_name}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {user.total_cases} รายการที่ไม่ตรง
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 20, padding: "4px 12px" }}>
                      ⚠ strike {user.strike_count}/3
                    </span>
                    {isSuspended && (
                      <span style={{ fontSize: 11, color: "#7f1d1d", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 20, padding: "4px 10px" }}>
                        🚫 ระงับถึง {formatDate(user.suspended_until)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                    <button
                      onClick={() => setResetTarget({ donor_id: user.donor_id, donor_name: user.donor_name, strike_count: user.strike_count })}
                      disabled={resetting === user.donor_id}
                      style={{ fontSize: 13, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "7px 16px", cursor: resetting === user.donor_id ? "not-allowed" : "pointer", opacity: resetting === user.donor_id ? 0.6 : 1, whiteSpace: "nowrap" }}
                    >
                      {resetting === user.donor_id ? "กำลังรีเซ็ต..." : "รีเซ็ต Strike"}
                    </button>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : user.donor_id)}
                      style={{ fontSize: 13, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                    >
                      ดูรายการ
                      <Icon icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"} width={16} />
                    </button>
                  </div>
                </div>

                {/* Expanded cases */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    {cases.map((c, i) => {
                      const strikeNo = i + 1;
                      const snapItems = parseJson(c.items_snapshot);
                      const condSnap  = parseJson(c.items_condition_snapshot);
                      const condMap   = {};
                      for (const x of condSnap) condMap[x.uniform_type_id] = x.item_condition;

                      const wrongItems  = snapItems.filter(it => condMap[it.uniform_type_id] === "wrong_item");
                      const usableItems = snapItems.filter(it => condMap[it.uniform_type_id] === "usable");

                      return (
                        <div key={c.donation_id} style={{ padding: "14px 20px 14px 72px", borderBottom: i < cases.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                              {c.school_name}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                              Strike #{strikeNo}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                            {c.request_title} · ยืนยันเมื่อ {formatDate(c.updated_at)}
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {wrongItems.map((it, j) => (
                              <span key={j} style={{ fontSize: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#92400e", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                                <Icon icon="mdi:close-circle" width={12} color="#f97316" />
                                {String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim()} × {it.quantity}
                              </span>
                            ))}
                            {usableItems.map((it, j) => (
                              <span key={j} style={{ fontSize: 12, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                                <Icon icon="mdi:check-circle" width={12} color="#16a34a" />
                                {String(it.name || "").replace(/\s*\(.*?\)\s*/g, "").trim()} × {it.quantity}
                              </span>
                            ))}
                            {snapItems.length === 0 && (
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>ไม่มีข้อมูลรายละเอียดชิ้น</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Reset Strike Modal */}
      {resetTarget && (
        <div onClick={() => setResetTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 420, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>

            {/* Icon + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon icon="mdi:refresh" width={24} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>รีเซ็ต Strike</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{resetTarget.donor_name}</div>
              </div>
            </div>

            {/* Strike badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <Icon icon="mdi:alert-circle-outline" width={18} color="#d97706" />
              <span style={{ fontSize: 13, color: "#92400e" }}>
                ปัจจุบัน strike <strong>{resetTarget.strike_count}/3</strong> — หลังรีเซ็ตจะกลับเป็น <strong>0/3</strong>
              </span>
            </div>

            {/* Info */}
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 20 }}>
              หลังจากรีเซ็ต ผู้บริจาครายนี้จะสามารถ
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
                <li>บริจาคผ่านระบบพัสดุได้ตามปกติ</li>
                <li>นัด Drop-off กับโรงเรียนได้ตามปกติ</li>
                <li>หากถูกระงับชั่วคราวอยู่ จะถูกปลดล็อคทันที</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setResetTarget(null)}
                style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetStrike}
                style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                ยืนยันรีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
