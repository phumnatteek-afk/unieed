import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getJson } from "../api/http.js";
import "./styles/Homepage.css";
import "../features/market/styles/MarketPage.css"
import Navbar from "./Navbar.jsx";
import { useAddToCart } from "../features/market/hooks/useAddToCart.js";


// icon
import { Icon } from "@iconify/react";

<link
  rel="stylesheet"
  href="https://cdn-uicons.flaticon.com/3.0.0/uicons-regular-rounded/css/uicons-regular-rounded.css"
></link>;

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ── helper: จัดกลุ่ม items ตามประเภท (name) รวมจำนวน + เก็บรูปแรก
function groupItems(items = []) {
  const map = {};
  items.forEach(item => {
    const key = item.name || "อื่นๆ";
    if (!map[key]) {
      map[key] = { name: key, total: 0, needed: 0, image_url: item.image_url || item.uniform_image_url || null };
    }
    map[key].total  += Number(item.quantity_remaining ?? item.quantity_needed ?? item.quantity ?? 0);
    map[key].needed += Number(item.quantity_needed ?? item.quantity ?? 0);
    if (!map[key].image_url) map[key].image_url = item.image_url || item.uniform_image_url || null;
  });
  return Object.values(map);
}

const COLLECTION_BADGE_CONFIG = {
  "แนะนำ":           { bg: "#ef4444", label: "ต้องการความช่วยเหลือ", icon: <Icon icon="mdi:hand-heart-outline" width="24" height="24" /> },
  "ใหม่ล่าสุด":      { bg: "#3b82f6", label: "ใหม่ล่าสุด", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 36 36"><path fill="currentColor" d="m34.11 24.49l-3.92-6.62l3.88-6.35a1 1 0 0 0-.85-1.52H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h31.25a1 1 0 0 0 .86-1.51m-23.6-3.31H9.39l-3.26-4.34v4.35H5V15h1.13l3.27 4.35V15h1.12ZM16.84 16h-3.53v1.49h3.2v1h-3.2v1.61h3.53v1h-4.66V15h4.65Zm8.29 5.16H24l-1.55-4.59l-1.55 4.61h-1.12l-2-6.18H19l1.32 4.43L21.84 15h1.22l1.46 4.43L25.85 15h1.23Z"/><path fill="none" d="M0 0h36v36H0z"/></svg> },
  "ใกล้เวลาปิด":     { bg: "#f97316", label: "ใกล้เวลาปิด", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  "ใกล้ถึงเป้าหมาย": { bg: "#10b981", label: "ใกล้ถึงเป้าหมาย", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8a8 8 0 0 1-8 8zm0-12a4 4 0 1 0 4 4a4 4 0 0 0-4-4zm0 6a2 2 0 1 1 2-2a2 2 0 0 1-2 2z"/></svg> },
};

function ProjCard({ p, navigate, details, collectionLabel }) {
  const [hovered, setHovered] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef(null);

  useEffect(() => {
  const handleScroll = () => setHovered(false);
  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => window.removeEventListener("scroll", handleScroll);
}, []);

  const items    = details || [];
  const grouped  = useMemo(() => groupItems(items).filter(g => g.total > 0).slice(0, 3), [items]);
  const itemRows = useMemo(() => items.slice(0, 3), [items]);
  const hasMore  = items.length > 3;

  const itemsTotalNeeded  = items.length > 0
    ? items.reduce((sum, item) => sum + Number(item.quantity_needed ?? item.quantity ?? 0), 0)
    : Number(p.total_needed || 0);
  const totalNeeded = items.length > 0
    ? items.reduce((sum, item) => sum + Number(item.quantity_remaining ?? item.quantity_needed ?? item.quantity ?? 0), 0)
    : Math.max(Number(p.total_needed || 0) - Number(p.total_fulfilled || 0), 0);
  const totalFulfilled = itemsTotalNeeded - totalNeeded;
  const goalMet = items.length > 0 && totalNeeded === 0 && itemsTotalNeeded > 0;

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const popupW = Math.min(360, rect.width, window.innerWidth - 16);
      const rawLeft = rect.left + rect.width / 2;
      const clampedLeft = Math.max(popupW / 2 + 8, Math.min(window.innerWidth - popupW / 2 - 8, rawLeft));
      setPopupPos({
        top:  rect.top,
        left: clampedLeft,
        width: popupW,
      });
    }
    setHovered(true);
  };

  return (
    <div
      ref={cardRef}
      className="projCard"
      onClick={() => navigate(`/projects/${p.request_id}`)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative" }}
    >

      <div className="thumb" style={{ position: "relative" }}>
        {p.request_image_url
          ? <img src={p.request_image_url} alt={p.request_title} />
          : <div className="dpCardImgPlaceholder" />}
        {goalMet && (
          <div className="dpSliderTag" style={{ background: "#f0fdf4", color: "#4ade80", border: "1.5px solid #86efac", borderRadius: 6, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z" clipRule="evenodd"/></svg>
            ได้รับครบแล้ว
          </div>
        )}
        {/* top-left: collection badge */}
        {collectionLabel && COLLECTION_BADGE_CONFIG[collectionLabel] && (
          <div style={{ position: "absolute", top: 10, left: 10, background: COLLECTION_BADGE_CONFIG[collectionLabel].bg, color: "#fff", borderRadius: 20, padding: "4px 10px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            {COLLECTION_BADGE_CONFIG[collectionLabel].icon}
            {COLLECTION_BADGE_CONFIG[collectionLabel].label || collectionLabel}
          </div>
        )}
        {/* top-right: countdown badge */}
        {p.end_date && (() => {
          const d = Math.ceil((new Date(p.end_date) - new Date()) / 86400000);
          if (d < 0 || d > 30) return null;
          const bg = d <= 3 ? "#ef4444" : d <= 7 ? "#FC8D1F" : "#34d399";
          const label = d === 0 ? "วันสุดท้าย!" : `เหลือ ${d} วัน`;
          return (
            <div style={{ position: "absolute", top: 10, right: 10, background: bg, color: "#fff", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {label}
            </div>
          );
        })()}
      </div>

      <div className="projBody">
        <div className="dpCardTitle" style={{ marginTop: 4 }}>{p.request_title}</div>
        <div className="dpCardSchool">{p.school_name}</div>
        <div className="dpCardAddr">
          <Icon icon="fluent:location-20-filled" width="14"
            style={{ flexShrink: 0, marginTop: "2px" }} />
          {p.school_address}
        </div>
        <div className="dpCardBottom">
          <div className="dpCardFulfilled"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ส่งถึงโรงเรียนแล้ว <strong>{totalFulfilled}</strong> ตัว
          </div>
          <button
            className="dpCardBtn"
            onClick={e => { e.stopPropagation(); navigate(`/projects/${p.request_id}`); }}
          >
            ส่งต่อ
          </button>
        </div>
      </div>

      {/* Popup fixed — rendered via portal to escape transform stacking context */}
      {hovered && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            top:  popupPos.top,
            left: popupPos.left,
            transform: "translate(-50%, -100%)",
            width: popupPos.width || 360,
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            padding: "16px",
            zIndex: 9999,
            pointerEvents: "auto",
            animation: "dpHoverIn 0.15s ease",
          }}
        >
          <div className="dpHoverHeader">
            <div className="dpHoverSchool">{p.school_name}</div>
            <div className="dpHoverMeta">
              <span className="dpHoverNeed">ต้องการอีก {totalNeeded} ชิ้น</span>
              <span className="dpHoverSep">·</span>
              <span className="dpHoverGot">ได้รับแล้ว {totalFulfilled} ชิ้น</span>
              <span className="dpHoverSep">·</span>
              <span style={{ color: "#64748b" }}>ทั้งหมด {itemsTotalNeeded} ชิ้น</span>
            </div>
          </div>
          <div className="dpHoverLine" />
          <div className="dpHoverSection">รายละเอียดชุดที่ต้องการ</div>
          <div className="dpHoverImgRow">
            {grouped.length > 0 ? grouped.map((g, i) => (
              <div key={i} className="dpHoverImgItem">
                <div className="dpHoverImgBox">
                  {g.image_url
                    ? <img src={g.image_url} alt={g.name} />
                    : <div className="dpHoverImgPlaceholder">{g.name?.charAt(0)}</div>}
                </div>
                <div className="dpHoverImgName">{g.name}</div>
                <div className="dpHoverImgQty">{g.needed - g.total}/{g.needed} ชิ้น</div>
              </div>
            )) : <div className="dpHoverEmpty">ยังไม่มีข้อมูล</div>}
          </div>
          <button
            className="dpHoverDetailBtn"
            onClick={e => { e.stopPropagation(); navigate(`/projects/${p.request_id}#uniform-details`); }}
          >
            ดูรายละเอียด →
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function HomePage() {
  const { token, role, userName, logout } = useAuth();
  const navigate = useNavigate();
  const { addToCart, loadingId, toastMsg } = useAddToCart(); 

  const [stats, setStats] = useState({
    products_total: 0,
    schools_approved: 0,
    total_paid: 0,
  });
  const [projects, setProjects] = useState([]);
  const [closedProjects, setClosedProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [tsIdx, setTsIdx] = useState(0);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");

  const [projectDetails, setProjectDetails] = useState({});
  const detailsFetchedRef = useRef(false);
  const [donationMatchedIds, setDonationMatchedIds] = useState(new Set());
  const matchedFetchedRef = useRef(false);

  // ===== Meilisearch inline search =====
  const MEILI_BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";
  const [searchHitIds, setSearchHitIds] = useState(null); // null = ไม่ได้ค้นหา
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);

  useEffect(() => {
    if (!q.trim()) { setSearchHitIds(null); setSearchTotal(0); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ q: q.trim(), limit: "6" });
        const res = await fetch(`${MEILI_BASE}/api/search/projects?${params}`);
        const data = await res.json();
        if (Array.isArray(data.hits)) {
          setSearchHitIds(data.hits.map(h => h.request_id));
          setSearchTotal(data.estimatedTotalHits ?? data.hits.length);
        } else {
          setSearchHitIds([]);
        }
      } catch {
        setSearchHitIds(null); // offline fallback: ไม่แสดงผล search
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, MEILI_BASE]);

  // project map สำหรับ lookup เร็ว
  const projectMap = useMemo(() => {
    const m = {};
    projects.forEach(p => { m[p.request_id] = p; });
    return m;
  }, [projects]);

  // ผลลัพธ์ค้นหา: เรียงตาม Meilisearch ranking, กรองเฉพาะที่มีใน projects
  const searchResults = useMemo(() => {
    if (!searchHitIds) return null;
    return searchHitIds.map(id => projectMap[id]).filter(Boolean);
  }, [searchHitIds, projectMap]);

  function formatThaiDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }


  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson("/home", false);

        setStats(data.stats || {});

        // ✅ projects: set once + randomize once after load
        const list = Array.isArray(data.projects) ? data.projects : [];
        setProjects(list);
        setClosedProjects(Array.isArray(data.closed_projects) ? data.closed_projects : []);
        setProducts(Array.isArray(data.products) ? data.products : []);
        setTestimonials(Array.isArray(data.testimonials) ? data.testimonials : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  // ── ดึง uniform_items สำหรับ ProjCard popup ──────────────────────────────
  useEffect(() => {
    if (projects.length === 0 || detailsFetchedRef.current) return;
    detailsFetchedRef.current = true;
    const fetchDetails = async () => {
      const map = {};
      for (const p of projects) {
        try {
          const d = await getJson(`/school/projects/public/${p.request_id}`, false);
          if (d?.request_id) map[d.request_id] = d.uniform_items || [];
        } catch (e) { /* ignore */ }
      }
      setProjectDetails(map);
    };
    fetchDetails();
  }, [projects]);

  // ── ดึง product_id ทั้งหมดที่ตรงกับโครงการ (สำหรับ donation badge) ─────
  useEffect(() => {
    if (projects.length === 0 || matchedFetchedRef.current) return;
    matchedFetchedRef.current = true;
    const fetchMatchedIds = async () => {
      const ids = new Set();
      await Promise.all(projects.map(async (p) => {
        try {
          const d = await getJson(`/api/market/matched?project_id=${p.request_id}`, false);
          (d?.products || []).forEach(prod => ids.add(prod.product_id));
        } catch (e) { /* ignore */ }
      }));
      if (ids.size > 0) setDonationMatchedIds(ids);
    };
    fetchMatchedIds();
  }, [projects]);



  const [homeTab, setHomeTab] = useState("ใหม่ล่าสุด"); // bottom row tab
  const [navHover, setNavHover] = useState(false);
  const [faqOpen, setFaqOpen] = useState(null);

  // ── แท็บ "โครงการใกล้ฉัน" ─────────────────────────────────
  const NEARBY_TAB = "โครงการใกล้ฉัน";
  const [nearbyProvince, setNearbyProvince]       = useState(() => localStorage.getItem("unieed_province") || "");
  const [nearbyProjects, setNearbyProjects]       = useState([]);
  const [nearbyLoading,  setNearbyLoading]        = useState(false);
  const [nearbyGpsError, setNearbyGpsError]       = useState("");
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [provinceInput, setProvinceInput]         = useState("");
  const PROVINCES_LIST = [
    "กระบี่","กรุงเทพมหานคร","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร",
    "ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร",
    "เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม",
    "นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน",
    "บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี",
    "พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี",
    "เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร",
    "ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย",
    "ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร",
    "สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์",
    "หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี",
  ];

  // โหลด projects ตามจังหวัด
  const loadNearbyProjects = async (province) => {
    if (!province) return;
    setNearbyLoading(true);
    setNearbyProjects([]);
    try {
      const data = await getJson(`/projects/by-province?province=${encodeURIComponent(province)}`, false);
      setNearbyProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch { setNearbyProjects([]); }
    finally { setNearbyLoading(false); }
  };

  // เมื่อเปลี่ยนแท็บมา "ใกล้ฉัน" → ขอ GPS ทุกครั้ง
  useEffect(() => {
    if (homeTab !== NEARBY_TAB) return;
    // ขอ GPS ทุกครั้งที่เปิดแท็บนี้ (ไม่ใช้ cache ข้ามขั้นตอน)
    setNearbyLoading(true);
    setNearbyGpsError("");
    setShowProvincePicker(false);
    if (!navigator.geolocation) {
      setNearbyLoading(false);
      setShowProvincePicker(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=th`
          );
          const geoData = await r.json();
          const raw = geoData?.address?.state || geoData?.address?.province || "";
          // normalize "จังหวัดเชียงใหม่" → "เชียงใหม่"
          const prov = raw.replace(/^จังหวัด/, "").trim();
          if (prov) {
            localStorage.setItem("unieed_province", prov);
            setNearbyProvince(prov);
            loadNearbyProjects(prov);
          } else {
            setShowProvincePicker(true);
          }
        } catch {
          setShowProvincePicker(true);
        } finally {
          setNearbyLoading(false);
        }
      },
      () => {
        setNearbyLoading(false);
        setNearbyGpsError("ไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง");
        setShowProvincePicker(true);
      },
      { timeout: 8000 }
    );
  }, [homeTab]); // eslint-disable-line

  const handleSelectProvince = (prov) => {
    localStorage.setItem("unieed_province", prov);
    setNearbyProvince(prov);
    setShowProvincePicker(false);
    setProvinceInput("");
    loadNearbyProjects(prov);
  };

  const handleChangeProvince = () => {
    setShowProvincePicker(true);
    setProvinceInput("");
  };

  // ── High-demand fallback (แสดงเมื่อจังหวัดใกล้ไม่มีโครงการ) ──────────────
  const [demandFallback, setDemandFallback] = useState([]); // [{province, still_needed, top_items}]
  const [demandFallbackProjects, setDemandFallbackProjects] = useState([]); // projects from top demand province
  const [demandFallbackProvince, setDemandFallbackProvince] = useState("");
  const [demandFallbackLoading, setDemandFallbackLoading] = useState(false);

  // โหลด demand insight เมื่อ nearby เสร็จโหลดแล้วแต่ว่างเปล่า
  useEffect(() => {
    if (homeTab !== NEARBY_TAB) return;
    if (nearbyLoading) return;
    if (nearbyProjects.length > 0) return; // มีโครงการแล้ว ไม่ต้องโหลด fallback
    if (!nearbyProvince) return; // ยังไม่รู้จังหวัด ยังไม่ต้อง fallback
    // โหลด high-demand provinces (public endpoint)
    (async () => {
      try {
        const dm = await getJson(`/projects/high-demand?exclude=${encodeURIComponent(nearbyProvince)}&limit=3`, false);
        const topProvs = dm?.provinces || [];
        setDemandFallback(topProvs);
        if (topProvs.length > 0) {
          const bestProv = topProvs[0].province;
          setDemandFallbackProvince(bestProv);
          setDemandFallbackLoading(true);
          const data = await getJson(`/projects/by-province?province=${encodeURIComponent(bestProv)}`, false);
          setDemandFallbackProjects(Array.isArray(data.projects) ? data.projects.slice(0, 3) : []);
          setDemandFallbackLoading(false);
        }
      } catch { /* ไม่แสดง error — fallback เสริม */ }
    })();
  }, [homeTab, nearbyLoading, nearbyProjects.length, nearbyProvince]); // eslint-disable-line

  const handleLoadDemandProvince = async (province) => {
    setDemandFallbackProvince(province);
    setDemandFallbackLoading(true);
    try {
      const data = await getJson(`/projects/by-province?province=${encodeURIComponent(province)}`, false);
      setDemandFallbackProjects(Array.isArray(data.projects) ? data.projects.slice(0, 3) : []);
    } catch { setDemandFallbackProjects([]); }
    finally { setDemandFallbackLoading(false); }
  };
  // ── end nearby ────────────────────────────────────────────


  // แถวบน: fairProjects top-6 เหมือน DonationProject
  // แล้วกรองออกโครงการที่ qualify collection priority สูงกว่า (เหมือนที่หน้าโครงการแสดง badge อื่นแทน)
  const [urgentProjects, setUrgentProjects] = useState([]);
  useEffect(() => {
    if (!projects.length) return;
    const today = new Date();

    const top80scored = [...projects]
      .filter(p => {
        const totalNeeded   = Number(p.total_needed)  || 0;
        const totalReceived = Number(p.total_received) || 0;
        if (totalNeeded > 0 && totalReceived >= totalNeeded) return false;
        return true;
      })
      .map(p => {
        const totalNeeded   = Number(p.total_needed)  || 0;
        const totalReceived = Number(p.total_received) || 0;
        // ปัจจัย 1: สัดส่วนความต้องการที่ยังไม่ได้รับการช่วยเหลือ (35%)
        const deficitRatio = totalNeeded > 0 ? Math.max((totalNeeded - totalReceived) / totalNeeded, 0) : 0;

        // ปัจจัย 2: จำนวนชุดที่ยังขาด (25%)
        const remaining = totalNeeded - totalReceived;
        const absoluteDeficit = remaining > 40 ? 1.0 : remaining >= 10 ? 0.5 : 0;

        // ปัจจัย 3: ระยะเวลาคงเหลือก่อนปิดโครงการ (20%) — binary
        let deadlineScore = 0;
        if (p.end_date) {
          const daysLeft = Math.ceil((new Date(p.end_date) - today) / 86400000);
          if (daysLeft >= 0 && daysLeft <= 7) deadlineScore = 1.0;
        }

        // ปัจจัย 4: ระยะเวลาที่ไม่มีการบริจาค (10%)
        let neglectScore = 0;
        if (p.last_donation_at) {
          const daysSince = Math.ceil((today - new Date(p.last_donation_at)) / 86400000);
          if (daysSince > 14)      neglectScore = 1.0;
          else if (daysSince >= 7) neglectScore = 0.5;
        }

        // ปัจจัย 5: จำนวนนักเรียนที่ต้องการชุด (10%)
        const studentCount = Number(p.student_count) || 0;
        const studentScore = studentCount > 30 ? 1.0 : studentCount >= 10 ? 0.5 : 0;

        const _fairScore = (deficitRatio    * 0.35)
          + (absoluteDeficit * 0.25)
          + (deadlineScore   * 0.20)
          + (neglectScore    * 0.10)
          + (studentScore    * 0.10);
        return { ...p, _fairScore };
      })
      .sort((a, b) => b._fairScore - a._fairScore)
      .slice(0, 80);

    const groupA = shuffle(top80scored.filter(p => p._fairScore >= 0.7));
    const groupB = shuffle(top80scored.filter(p => p._fairScore >= 0.4 && p._fairScore < 0.7));
    const groupC = shuffle(top80scored.filter(p => p._fairScore < 0.4));
    const top20scored = [...groupA, ...groupB, ...groupC];

    // คอลเลคชัน priority สูงกว่า "แนะนำ"
    const closingIds = new Set(
      projects.filter(p => {
        if (!p.end_date) return false;
        const d = Math.ceil((new Date(p.end_date) - today) / 86400000);
        return d >= 0 && d <= 7;
      }).map(p => p.request_id)
    );
    const nearGoalIds = new Set(
      projects.filter(p => {
        const needed = Number(p.total_needed);
        const fulfilled = Number(p.total_fulfilled);
        return needed > 0 && fulfilled / needed >= 0.7;
      }).map(p => p.request_id)
    );
    const newestIds = new Set(
      projects.filter(p => {
        const ref = p.start_date || p.created_at;
        if (!ref) return false;
        return Math.ceil((today - new Date(ref)) / 86400000) <= 30;
      }).map(p => p.request_id)
    );

    // filter badge อื่นออกก่อน แล้วค่อย slice(0,6) — ให้ได้ 6 เสมอ
    const urgentOnly = top20scored
      .filter(p =>
        !closingIds.has(p.request_id) &&
        !nearGoalIds.has(p.request_id) &&
        !newestIds.has(p.request_id)
      )
      .slice(0, 6);

    setUrgentProjects(urgentOnly);
  }, [projects]);

  // badge priority map — เหมือน DonationProject
  const BADGE_PRIORITY = ["ใกล้เวลาปิด", "ใกล้ถึงเป้าหมาย", "ใหม่ล่าสุด", "แนะนำ"];
  const projectAllCollections = useMemo(() => {
    const today = new Date();
    const urgentIds = new Set(urgentProjects.map(p => p.request_id));
    const newestIds = new Set(
      projects.filter(p => {
        const ref = p.start_date || p.created_at;
        if (!ref) return false;
        return Math.ceil((today - new Date(ref)) / 86400000) <= 30;
      }).map(p => p.request_id)
    );
    const closingIds = new Set(
      projects.filter(p => {
        if (!p.end_date) return false;
        const d = Math.ceil((new Date(p.end_date) - today) / 86400000);
        return d >= 0 && d <= 7;
      }).map(p => p.request_id)
    );
    const nearGoalIds = new Set(
      projects.filter(p => {
        const needed = Number(p.total_needed);
        const fulfilled = Number(p.total_fulfilled);
        return needed > 0 && fulfilled / needed >= 0.7;
      }).map(p => p.request_id)
    );
    const map = {};
    projects.forEach(p => {
      const id = p.request_id;
      const cols = [];
      if (closingIds.has(id))  cols.push("ใกล้เวลาปิด");
      if (nearGoalIds.has(id)) cols.push("ใกล้ถึงเป้าหมาย");
      if (newestIds.has(id))   cols.push("ใหม่ล่าสุด");
      if (urgentIds.has(id))   cols.push("แนะนำ");
      map[id] = cols;
    });
    return map;
  }, [projects, urgentProjects]);

  // shuffle urgentProjects สำหรับ render อย่างเดียว — ไม่กระทบ badge assignment
  const displayUrgentProjects = useMemo(() => shuffle(urgentProjects), [urgentProjects]);

  // แถวล่าง: ตาม homeTab
  const displayProjects = useMemo(() => {
    if (homeTab === NEARBY_TAB) return nearbyProjects.slice(0, 3);
    if (!projects.length) return [];
    const today = new Date();
    const urgentIds = new Set(urgentProjects.map(p => p.request_id));

    if (homeTab === "ใหม่ล่าสุด") {
      const top10 = projects.filter(p => {
        if (urgentIds.has(p.request_id)) return false;
        const ref = p.start_date || p.created_at;
        if (!ref) return false;
        return Math.ceil((today - new Date(ref)) / 86400000) <= 30;
      }).sort((a, b) => new Date(b.start_date || b.created_at) - new Date(a.start_date || a.created_at)).slice(0, 10);
      return shuffle(top10).slice(0, 3);
    }

    if (homeTab === "ใกล้เวลาปิด") {
      const top10 = projects.filter(p => {
        if (urgentIds.has(p.request_id)) return false;
        if (!p.end_date) return false;
        const d = Math.ceil((new Date(p.end_date) - today) / 86400000);
        return d >= 0 && d <= 7;
      }).sort((a, b) => new Date(a.end_date) - new Date(b.end_date)).slice(0, 10);
      return shuffle(top10).slice(0, 3);
    }

    if (homeTab === "ใกล้ถึงเป้าหมาย") {
      const top10 = [...projects]
        .filter(p => {
          if (urgentIds.has(p.request_id)) return false;
          const needed = Number(p.total_needed);
          const fulfilled = Number(p.total_fulfilled);
          return needed > 0 && fulfilled / needed >= 0.7;
        })
        .sort((a, b) => (Number(b.total_fulfilled) / Number(b.total_needed)) - (Number(a.total_fulfilled) / Number(a.total_needed)))
        .slice(0, 10);
      return shuffle(top10).slice(0, 3);
    }

    return projects.filter(p => !urgentIds.has(p.request_id)).slice(0, 3);
  }, [projects, homeTab, nearbyProjects, urgentProjects]);

  // Badge map สำหรับ "ใกล้ฉัน" — ใช้ algorithm เดียวกับ DonationProject.jsx
  const nearbyBadgeMap = useMemo(() => {
    if (!nearbyProjects.length) return {};
    const today = new Date();

    const fairIds = new Set(
      [...nearbyProjects]
        .filter(p => {
          const n = Number(p.total_needed) || 0;
          const r = Number(p.total_received) || 0;
          return !(n > 0 && r >= n);
        })
        .map(p => {
          const n = Number(p.total_needed) || 0;
          const r = Number(p.total_received) || 0;
          const ref = p.start_date || p.created_at;
          const daysWaiting = ref ? Math.ceil((today - new Date(ref)) / 86400000) : 0;
          const deficitRatio = n > 0 ? Math.max((n - r) / n, 0) : 0;
          const waitScore = Math.min(daysWaiting / 60, 1);
          let deadlineScore = 0;
          if (p.end_date) {
            const dl = Math.ceil((new Date(p.end_date) - today) / 86400000);
            if (dl <= 7) deadlineScore = 1.0;
            else if (dl <= 14) deadlineScore = 0.6;
            else if (dl <= 30) deadlineScore = 0.3;
          }
          let completionBonus = 0;
          if (n > 0) { const ratio = r / n; if (ratio >= 0.8) completionBonus = 1.0; else if (ratio >= 0.6) completionBonus = 0.5; }
          let neglectModifier = 0;
          if (p.last_donation_at) {
            const ds = Math.ceil((today - new Date(p.last_donation_at)) / 86400000);
            if (ds > 14) neglectModifier = 1.0; else if (ds > 7) neglectModifier = 0.5; else if (ds <= 3) neglectModifier = -1.0;
          } else { neglectModifier = 0.8; }
          return { ...p, _s: (deficitRatio * 0.40) + (waitScore * 0.25) + (deadlineScore * 0.20) + (completionBonus * 0.10) + (neglectModifier * 0.05) };
        })
        .sort((a, b) => b._s - a._s)
        .slice(0, 6)
        .map(p => p.request_id)
    );

    const newestIds = new Set(
      nearbyProjects.filter(p => {
        const ref = p.start_date || p.created_at;
        return ref && Math.ceil((today - new Date(ref)) / 86400000) <= 30;
      }).map(p => p.request_id)
    );
    const closingIds = new Set(
      nearbyProjects.filter(p => {
        if (!p.end_date) return false;
        const d = Math.ceil((new Date(p.end_date) - today) / 86400000);
        return d >= 0 && d <= 7;
      }).map(p => p.request_id)
    );
    const nearGoalIds = new Set(
      [...nearbyProjects].filter(p => {
        const n = Number(p.total_needed);
        const r = Number(p.total_received);
        return n > 0 && r / n >= 0.5;
      })
        .sort((a, b) => (Number(b.total_received) / Number(b.total_needed)) - (Number(a.total_received) / Number(a.total_needed)))
        .slice(0, 6).map(p => p.request_id)
    );

    const map = {};
    nearbyProjects.forEach(p => {
      const id = p.request_id;
      if (closingIds.has(id))       map[id] = "ใกล้เวลาปิด";
      else if (nearGoalIds.has(id)) map[id] = "ใกล้ถึงเป้าหมาย";
      else if (newestIds.has(id))   map[id] = "ใหม่ล่าสุด";
      else if (fairIds.has(id))     map[id] = "แนะนำ";
      else                          map[id] = "แนะนำ";
    });
    return map;
  }, [nearbyProjects]);

  const steps = [
    {
      no: 1,
      icon: (
        <>
          <svg
            width="70"
            height="70"
            viewBox="0 0 70 70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M54.6875 10.9375H49.0301L45.2977 7.20234C45.0944 6.99927 44.853 6.83824 44.5875 6.72845C44.3219 6.61867 44.0374 6.56227 43.75 6.5625H26.25C25.9626 6.56227 25.6781 6.61867 25.4125 6.72845C25.147 6.83824 24.9056 6.99927 24.7023 7.20234L20.9699 10.9375H15.3125C14.1522 10.9375 13.0394 11.3984 12.2189 12.2189C11.3984 13.0394 10.9375 14.1522 10.9375 15.3125V56.875C10.9375 58.0353 11.3984 59.1481 12.2189 59.9686C13.0394 60.7891 14.1522 61.25 15.3125 61.25H54.6875C55.8478 61.25 56.9606 60.7891 57.7811 59.9686C58.6016 59.1481 59.0625 58.0353 59.0625 56.875V15.3125C59.0625 14.1522 58.6016 13.0394 57.7811 12.2189C56.9606 11.3984 55.8478 10.9375 54.6875 10.9375ZM35 17.932L30.3516 10.9375H39.6758L35 17.932ZM44.0891 12.1898L45.9375 14.0301V28.4375L37.8902 21.4813L44.0891 12.1898ZM24.0625 14.0301L25.9109 12.1844L32.1098 21.4813L24.0625 28.4375V14.0301ZM15.3125 15.3125H19.6875V28.4375C19.6824 29.27 19.9171 30.0864 20.3637 30.7891C20.8103 31.4917 21.4499 32.0508 22.2059 32.3996C22.7873 32.6709 23.4209 32.8118 24.0625 32.8125C25.0831 32.8104 26.0704 32.4494 26.8516 31.7926C26.8629 31.785 26.873 31.7758 26.8816 31.7652L32.8125 26.6547V56.875H15.3125V15.3125ZM54.6875 56.875H37.1875V26.6547L43.1074 31.768C43.116 31.7785 43.1262 31.7877 43.1375 31.7953C43.9219 32.4535 44.9135 32.8138 45.9375 32.8125C46.5834 32.8108 47.221 32.6671 47.8051 32.3914C48.5577 32.0416 49.1941 31.4831 49.6386 30.7822C50.0831 30.0813 50.317 29.2675 50.3125 28.4375V15.3125H54.6875V56.875Z"
              fill="#5285E8"
            />
          </svg>
          <svg
            width="70"
            height="70"
            viewBox="0 0 70 70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M49.5837 52.5002C51.1308 52.5002 52.6145 53.1147 53.7084 54.2087C54.8024 55.3027 55.417 56.7864 55.417 58.3335C55.417 59.8806 54.8024 61.3643 53.7084 62.4583C52.6145 63.5522 51.1308 64.1668 49.5837 64.1668C48.0366 64.1668 46.5528 63.5522 45.4589 62.4583C44.3649 61.3643 43.7503 59.8806 43.7503 58.3335C43.7503 55.096 46.3462 52.5002 49.5837 52.5002ZM2.91699 5.8335H12.4545L15.1962 11.6668H58.3337C59.1072 11.6668 59.8491 11.9741 60.3961 12.5211C60.943 13.0681 61.2503 13.8099 61.2503 14.5835C61.2503 15.0793 61.1045 15.5752 60.9003 16.0418L50.4587 34.9127C49.467 36.6918 47.542 37.9168 45.3545 37.9168H23.6253L21.0003 42.671L20.9128 43.021C20.9128 43.2144 20.9896 43.3999 21.1264 43.5366C21.2631 43.6733 21.4486 43.7502 21.642 43.7502H55.417V49.5835H20.417C18.8699 49.5835 17.3862 48.9689 16.2922 47.875C15.1982 46.781 14.5837 45.2973 14.5837 43.7502C14.5837 42.7293 14.8462 41.7668 15.2837 40.9502L19.2503 33.8043L8.75033 11.6668H2.91699V5.8335ZM20.417 52.5002C21.9641 52.5002 23.4478 53.1147 24.5418 54.2087C25.6357 55.3027 26.2503 56.7864 26.2503 58.3335C26.2503 59.8806 25.6357 61.3643 24.5418 62.4583C23.4478 63.5522 21.9641 64.1668 20.417 64.1668C18.8699 64.1668 17.3862 63.5522 16.2922 62.4583C15.1982 61.3643 14.5837 59.8806 14.5837 58.3335C14.5837 55.096 17.1795 52.5002 20.417 52.5002ZM46.667 32.0835L54.7753 17.5002H17.9087L24.792 32.0835H46.667Z"
              fill="#5285E8"
            />
          </svg>
        </>
      ),
      title: "เตรียมชุดนักเรียน / เลือกซื้อชุดนักเรียนเพื่อบริจาค",
    },
    {
      no: 2,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 48 48"><g fill="none" stroke="#F7AD19" strokeWidth="4"><path strokeLinejoin="round" d="M4 33a2 2 0 0 1 2-2h6v-7l12-8l12 8v7h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z"/><path strokeLinecap="round" d="M24 6v10"/><path strokeLinecap="round" strokeLinejoin="round" d="M36 12V6s-1.5 3-6 0s-6 0-6 0v6s1.5-3 6 0s6 0 6 0m-8 32V31h-8v13m-2 0h12"/></g></svg>
      ),
      title: "เลือกโรงเรียนที่ต้องการส่งไปบริจาค",
    },
    {
      no: 3,
      icon: (
        <>
          <svg
            width="70"
            height="70"
            viewBox="0 0 70 70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M34.9997 3.646C33.2351 3.646 31.6105 4.0835 29.8343 4.8185C28.1163 5.53016 26.1213 6.57725 23.6393 7.881L17.6076 11.0456C14.5597 12.6439 12.1243 13.9243 10.2372 15.1814C8.28884 16.4852 6.78384 17.856 5.69009 19.7139C4.59926 21.566 4.10926 23.5727 3.87301 25.9614C3.64551 28.2802 3.64551 31.1297 3.64551 34.7172V35.2831C3.64551 38.8706 3.64551 41.7202 3.87301 44.0389C4.10926 46.4306 4.60217 48.4343 5.69009 50.2864C6.78384 52.1443 8.28592 53.5152 10.2401 54.8189C12.1213 56.076 14.5597 57.3564 17.6076 58.9547L23.6393 62.1193C26.1213 63.4231 28.1163 64.4702 29.8343 65.1818C31.6134 65.9168 33.2351 66.3543 34.9997 66.3543C36.7643 66.3543 38.3888 65.9168 40.1651 65.1818C41.883 64.4702 43.878 63.4231 46.3601 62.1193L52.3918 58.9577C55.4397 57.3564 57.8751 56.076 59.7593 54.8189C61.7134 53.5152 63.2155 52.1443 64.3093 50.2864C65.4001 48.4343 65.8901 46.4277 66.1263 44.0389C66.3538 41.7202 66.3538 38.8706 66.3538 35.286V34.7143C66.3538 31.1297 66.3538 28.2802 66.1263 25.9614C65.8901 23.5697 65.3972 21.566 64.3093 19.7139C63.2155 17.856 61.7134 16.4852 59.7593 15.1814C57.878 13.9243 55.4397 12.6439 52.3918 11.0456L46.3601 7.881C43.878 6.57725 41.883 5.53016 40.1651 4.8185C38.3859 4.0835 36.7643 3.646 34.9997 3.646ZM25.5788 11.801C28.1747 10.4389 29.9947 9.48808 31.5055 8.86391C32.9755 8.25433 34.0109 8.021 34.9997 8.021C35.9913 8.021 37.0238 8.25433 38.4938 8.86391C40.0047 9.48808 41.8218 10.4389 44.4176 11.801L50.2509 14.8635C53.4301 16.5289 55.6613 17.7043 57.3326 18.8185C58.1551 19.3697 58.7997 19.8802 59.3247 20.3935L49.6093 25.2497L24.8176 12.2006L25.5788 11.801ZM20.2559 14.5952L19.7484 14.8635C16.5693 16.5289 14.338 17.7043 12.6697 18.8185C11.9583 19.2807 11.2915 19.808 10.6776 20.3935L34.9997 32.556L44.7909 27.656L20.8568 15.0618C20.6323 14.9402 20.4293 14.7825 20.2559 14.5952ZM8.56884 24.2289C8.42301 24.8531 8.30926 25.5618 8.22759 26.3872C8.02342 28.4697 8.02051 31.1035 8.02051 34.8281V35.1693C8.02051 38.8968 8.02051 41.5306 8.22759 43.6102C8.42884 45.6431 8.81092 46.9585 9.46134 48.0668C10.1088 49.1664 11.0451 50.0968 12.6697 51.1818C14.338 52.296 16.5693 53.4714 19.7484 55.1368L25.5818 58.1993C28.1776 59.5614 29.9947 60.5122 31.5055 61.1364C31.98 61.3328 32.4155 61.4932 32.8122 61.6177V36.3506L8.56884 24.2289ZM37.1872 61.6147C37.5838 61.4922 38.0194 61.3328 38.4938 61.1364C40.0047 60.5122 41.8218 59.5614 44.4176 58.1993L50.2509 55.1368C53.4301 53.4685 55.6613 52.296 57.3326 51.1818C58.9543 50.0968 59.8905 49.1664 60.5409 48.0668C61.1913 46.9585 61.5705 45.646 61.7718 43.6102C61.9759 41.5306 61.9788 38.8968 61.9788 35.1722V34.831C61.9788 31.1035 61.9788 28.4697 61.7718 26.3902C61.7031 25.6643 61.5891 24.9435 61.4305 24.2318L51.7705 29.0589V37.9168C51.7705 38.497 51.54 39.0534 51.1298 39.4636C50.7196 39.8739 50.1632 40.1043 49.583 40.1043C49.0028 40.1043 48.4464 39.8739 48.0362 39.4636C47.626 39.0534 47.3955 38.497 47.3955 37.9168V31.2493L37.1872 36.3535V61.6147Z"
              fill="#92CC2C"
            />
          </svg>
          <svg
            width="70"
            height="70"
            viewBox="0 0 70 70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M52.4997 23.3335H46.6663V20.4168C46.6663 18.8697 46.0518 17.386 44.9578 16.292C43.8638 15.1981 42.3801 14.5835 40.833 14.5835H11.6663C10.1192 14.5835 8.63551 15.1981 7.54155 16.292C6.44759 17.386 5.83301 18.8697 5.83301 20.4168V49.5835H11.6663C11.6663 50.7326 11.8927 51.8704 12.3324 52.932C12.7721 53.9936 13.4166 54.9582 14.2292 55.7707C15.0417 56.5832 16.0063 57.2277 17.0679 57.6674C18.1295 58.1072 19.2673 58.3335 20.4163 58.3335C21.5654 58.3335 22.7032 58.1072 23.7648 57.6674C24.8264 57.2277 25.791 56.5832 26.6035 55.7707C27.416 54.9582 28.0606 53.9936 28.5003 52.932C28.94 51.8704 29.1663 50.7326 29.1663 49.5835H40.833C40.833 51.9041 41.7549 54.1297 43.3958 55.7707C45.0368 57.4116 47.2624 58.3335 49.583 58.3335C51.9037 58.3335 54.1293 57.4116 55.7702 55.7707C57.4111 54.1297 58.333 51.9041 58.333 49.5835H64.1663V35.0002L52.4997 23.3335ZM20.4163 53.9585C19.8416 53.9583 19.2726 53.8449 18.7417 53.6248C18.2108 53.4047 17.7284 53.0822 17.3221 52.6756C16.9159 52.2691 16.5937 51.7865 16.3739 51.2555C16.1542 50.7244 16.0411 50.1553 16.0413 49.5806C16.0415 49.0059 16.1549 48.4368 16.375 47.9059C16.5952 47.375 16.9177 46.8926 17.3242 46.4864C17.7307 46.0801 18.2133 45.7579 18.7443 45.5382C19.2754 45.3184 19.8445 45.2054 20.4193 45.2056C21.58 45.206 22.693 45.6674 23.5135 46.4884C24.3339 47.3095 24.7946 48.4228 24.7943 49.5835C24.7939 50.7442 24.3324 51.8572 23.5114 52.6777C22.6904 53.4982 21.5771 53.9589 20.4163 53.9585ZM11.6663 40.8335V20.4168H40.833V40.8335H11.6663ZM49.583 53.9585C49.0083 53.9583 48.4392 53.8449 47.9083 53.6248C47.3774 53.4047 46.8951 53.0822 46.4888 52.6756C46.0826 52.2691 45.7603 51.7865 45.5406 51.2555C45.3208 50.7244 45.2078 50.1553 45.208 49.5806C45.2082 49.0059 45.3216 48.4368 45.5417 47.9059C45.7618 47.375 46.0843 46.8926 46.4909 46.4864C46.8974 46.0801 47.38 45.7579 47.911 45.5382C48.4421 45.3184 49.0112 45.2054 49.5859 45.2056C50.7466 45.206 51.8596 45.6674 52.6801 46.4884C53.5006 47.3095 53.9613 48.4228 53.9609 49.5835C53.9605 50.7442 53.4991 51.8572 52.6781 52.6777C51.857 53.4982 50.7437 53.9589 49.583 53.9585Z"
              fill="#FF6767"
            />
          </svg>
        </>
      ),
      title: "เลือกช่องทางการส่งต่อ",
      desc: (
        <>
          • จัดส่งพัสดุ <br /> • ไปส่งเอง (Drop-off)
        </>
      ),
    },
    {
      no: 4,
      icon: (
        <svg
          width="70"
          height="70"
          viewBox="0 0 70 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21.875 28.4375C21.875 27.8573 22.1055 27.3009 22.5157 26.8907C22.9259 26.4805 23.4823 26.25 24.0625 26.25H45.9375C46.5177 26.25 47.0741 26.4805 47.4843 26.8907C47.8945 27.3009 48.125 27.8573 48.125 28.4375C48.125 29.0177 47.8945 29.5741 47.4843 29.9843C47.0741 30.3945 46.5177 30.625 45.9375 30.625H24.0625C23.4823 30.625 22.9259 30.3945 22.5157 29.9843C22.1055 29.5741 21.875 29.0177 21.875 28.4375ZM24.0625 37.1875C23.4823 37.1875 22.9259 37.418 22.5157 37.8282C22.1055 38.2384 21.875 38.7948 21.875 39.375C21.875 39.9552 22.1055 40.5116 22.5157 40.9218C22.9259 41.332 23.4823 41.5625 24.0625 41.5625H35C35.5802 41.5625 36.1366 41.332 36.5468 40.9218C36.957 40.5116 37.1875 39.9552 37.1875 39.375C37.1875 38.7948 36.957 38.2384 36.5468 37.8282C36.1366 37.418 35.5802 37.1875 35 37.1875H24.0625ZM21.875 50.3125C21.875 49.7323 22.1055 49.1759 22.5157 48.7657C22.9259 48.3555 23.4823 48.125 24.0625 48.125H39.0644L34.7266 52.5H24.0625C23.4823 52.5 22.9259 52.2695 22.5157 51.8593C22.1055 51.4491 21.875 50.8927 21.875 50.3125ZM30.4872 61.25H18.5937C17.7235 61.25 16.8889 60.9043 16.2736 60.2889C15.6582 59.6736 15.3125 58.839 15.3125 57.9688V16.4063C15.3125 15.536 15.6582 14.7014 16.2736 14.0861C16.8889 13.4707 17.7235 13.125 18.5937 13.125H22.2469C22.6994 14.405 23.5379 15.5132 24.6466 16.2968C25.7553 17.0803 27.0798 17.5007 28.4375 17.5H41.5625C42.9202 17.5007 44.2446 17.0803 45.3534 16.2968C46.4621 15.5132 47.3006 14.405 47.7531 13.125H51.4062C52.2765 13.125 53.1111 13.4707 53.7264 14.0861C54.3418 14.7014 54.6875 15.536 54.6875 16.4063V32.9087C56.0301 32.1686 57.53 31.7599 59.0625 31.7166V16.4063C59.0625 14.3757 58.2559 12.4283 56.82 10.9925C55.3842 9.55664 53.4368 8.75 51.4062 8.75H47.7531C47.3006 7.46997 46.4621 6.36181 45.3534 5.57825C44.2446 4.79468 42.9202 4.37429 41.5625 4.375H28.4375C27.0798 4.37429 25.7553 4.79468 24.6466 5.57825C23.5379 6.36181 22.6994 7.46997 22.2469 8.75H18.5937C16.5632 8.75 14.6158 9.55664 13.18 10.9925C11.7441 12.4283 10.9375 14.3757 10.9375 16.4063V57.9688C10.9375 59.9993 11.7441 61.9467 13.18 63.3825C14.6158 64.8184 16.5632 65.625 18.5937 65.625H29.5312C29.5312 65.1744 29.591 64.715 29.7106 64.2469L30.4872 61.25ZM28.4375 8.75H41.5625C42.1427 8.75 42.6991 8.98047 43.1093 9.39071C43.5195 9.80094 43.75 10.3573 43.75 10.9375C43.75 11.5177 43.5195 12.0741 43.1093 12.4843C42.6991 12.8945 42.1427 13.125 41.5625 13.125H28.4375C27.8573 13.125 27.3009 12.8945 26.8907 12.4843C26.4805 12.0741 26.25 11.5177 26.25 10.9375C26.25 10.3573 26.4805 9.80094 26.8907 9.39071C27.3009 8.98047 27.8573 8.75 28.4375 8.75ZM63.7525 45.7712L44.9181 64.4591C44.1485 65.2209 43.1907 65.7652 42.1422 66.0362L35.5359 67.7381C35.1674 67.8325 34.7805 67.8291 34.4136 67.7283C34.0468 67.6275 33.7125 67.4327 33.4439 67.1633C33.1753 66.8938 32.9817 66.5589 32.8821 66.1917C32.7824 65.8245 32.7803 65.4376 32.8759 65.0694L34.6041 58.3975C34.8621 57.4009 35.3799 56.4905 36.1047 55.7594L54.845 36.8594C55.4409 36.2587 56.1517 35.7843 56.935 35.4643C57.7183 35.1444 58.5579 34.9855 59.404 34.9971C60.25 35.0088 61.085 35.1907 61.8592 35.5321C62.6333 35.8734 63.3308 36.3673 63.91 36.9841C65.0337 38.1806 65.6459 39.7685 65.6165 41.4097C65.5871 43.0508 64.9183 44.6157 63.7525 45.7712Z"
            fill="#DD2E44"
          />
        </svg>
      ),
      title: "ส่งของ / นัดหมาย",
      desc: (
        <>
          • จัดส่งพัสดุ: กรอกเลข Tracking <br /> • Drop-off: กดนัดหมายวันเวลา
        </>
      ),
    },
    {
      no: 5,
      icon: (
        <svg
          width="70"
          height="70"
          viewBox="0 0 70 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M37.9163 61.25L43.7497 58.3333L49.583 61.25V40.8333H37.9163M49.583 26.25V20.4167L43.7497 23.3333L37.9163 20.4167V26.25L32.083 29.1667L37.9163 32.0833V37.9167L43.7497 35L49.583 37.9167V32.0833L55.4163 29.1667M58.333 8.75H11.6663C10.1192 8.75 8.63551 9.36458 7.54155 10.4585C6.44759 11.5525 5.83301 13.0362 5.83301 14.5833V43.75C5.83301 45.2971 6.44759 46.7808 7.54155 47.8748C8.63551 48.9688 10.1192 49.5833 11.6663 49.5833H32.083V43.75H11.6663V14.5833H58.333V43.75H55.4163V49.5833H58.333C59.8801 49.5833 61.3638 48.9688 62.4578 47.8748C63.5518 46.7808 64.1663 45.2971 64.1663 43.75V14.5833C64.1663 13.0362 63.5518 11.5525 62.4578 10.4585C61.3638 9.36458 59.8801 8.75 58.333 8.75ZM32.083 23.3333H14.583V17.5H32.083M26.2497 32.0833H14.583V26.25H26.2497M32.083 40.8333H14.583V35H32.083V40.8333Z"
            fill="#FCAB40"
          />
        </svg>
      ),
      title: "รับใบประกาศเกียรติคุณ",
      desc: (
        <>
          รับ E-Certificate <br /> แห่งความภูมิใจ
        </>
      ),
    },
  ];

  return (
    <div className="homePage">
       {toastMsg && (
        <div className="mkToast">
          <Icon icon="mdi:check-circle" /> {toastMsg}
        </div>
      )}
      {/* ===== Top Header ===== */}
      <Navbar activeLink="home" />

      {/* ===== Hero ===== */}
      <section id="home" className="hero">
        <div className="searchRow">
          {/* <div className="searchBox">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาโครงการหรือสิ่งของที่ต้องการบริจาค..."
            />
            <button className="searchBtn" type="button" aria-label="search">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </button>
          </div> */}
        </div>

        <div className="heroInner">
          <div className="heroLeft">
            <h1>เสื้อตัวเก่าของคุณ...</h1>
            <p className="heroSub">
              คือ <span>ชุดเก่งตัวใหม่ของน้อง</span>
            </p>

            <button
              className="heroSearchBtn"
              onClick={() => navigate("/projects", { state: { focusSearch: true } })}
            >
              ค้นหาโครงการ
              <span className="heroSearchArrow">›</span>
            </button>

            <div className="heroActions">
              <a className="pill pillYellow" href="#projects">
                {" "}
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 59 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M54.0827 45.2471C54.0827 48.5436 51.1327 51.2408 47.5271 51.2408H11.4716C7.86602 51.2408 4.91602 48.5436 4.91602 45.2471V19.7736C4.91602 16.477 7.86602 13.7798 11.4716 13.7798H47.5271C51.1327 13.7798 54.0827 16.477 54.0827 19.7736V45.2471Z"
                    fill="#FDD888"
                  />
                  <path
                    d="M59 15.2779C59 18.5745 56.05 21.2717 52.4444 21.2717H6.55556C2.95 21.2717 0 18.5745 0 15.2779C0 11.9814 2.95 9.28418 6.55556 9.28418H52.4444C56.05 9.28418 59 11.9814 59 15.2779Z"
                    fill="#FDD888"
                  />
                  <path
                    d="M4.91602 21.272H54.0827V24.2689H4.91602V21.272Z"
                    fill="#FCAB40"
                  />
                  <path
                    d="M31.1398 3.29053H27.862C25.1463 3.29053 22.9453 5.30294 22.9453 7.78585V51.2407H36.0564V7.78585C36.0564 5.30443 33.8554 3.29053 31.1398 3.29053Z"
                    fill="#DA2F47"
                  />
                  <path
                    d="M26.2228 9.28415C28.0256 9.28415 28.2927 8.51096 26.8144 7.56544L15.7978 0.513772C14.3196 -0.431745 12.3808 -0.0346578 11.4859 1.39635L8.18192 6.68286C7.28709 8.11387 8.03114 9.28415 9.83392 9.28415H26.2228ZM32.7784 9.28415C30.9756 9.28415 30.7084 8.51096 32.1867 7.56544L43.205 0.513772C44.6816 -0.431745 46.6221 -0.0346578 47.5169 1.39635L50.8209 6.68136C51.7141 8.11387 50.97 9.28415 49.1673 9.28415H32.7784Z"
                    fill="#DA2F47"
                  />
                </svg>{" "}
                <div className="text-ban">
                  <a style={{ display: "flex", alignItems: "center", gap: 8 }}>ส่งต่อชุดให้น้อง <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 12l-6-6m6 6l-6 6m6-6H5"/></svg></a>
                </div>
              </a>
              <a className="pill pillWhite" href="#market">
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 59 60"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M53.4689 36.3636H16.5938L12.9062 14.5454H57.1564L53.4689 36.3636Z"
                    fill="#CCD6DD"
                  />
                  <path
                    d="M57.1269 45.4545H16.5643C14.5472 45.4545 12.9063 43.8345 12.9063 41.8473C12.9063 39.86 14.5767 38.1818 16.5938 38.1818L16.6067 38.18L16.6215 38.1818H53.4689C54.3705 38.1818 55.1394 37.5382 55.2869 36.6618L58.9744 14.8436C59.0647 14.3164 58.9135 13.7782 58.5614 13.3691C58.2129 12.9618 57.6985 12.7273 57.1564 12.7273H14.4126L12.4951 1.51636C12.3495 0.656364 11.6028 0.0763636 10.7583 0.0363636C10.7288 0.0309091 10.7085 0 10.679 0H1.84376C0.826003 0 0 0.814546 0 1.81818C0 2.82182 0.826003 3.63636 1.84376 3.63636H9.11922L14.4716 34.9382C11.4442 35.8345 9.21878 38.5745 9.21878 41.8473C9.21878 45.8418 12.5154 49.0909 16.5643 49.0909H57.1269C58.1465 49.0909 58.9707 48.2782 58.9707 47.2727C58.9707 46.2673 58.1465 45.4545 57.1269 45.4545ZM53.1371 27.2727H47.0398L47.5431 23.6364H53.7492L53.1371 27.2727ZM43.3172 27.2727H36.8751V23.6364H43.8206L43.3172 27.2727ZM33.1876 27.2727H26.7455L26.2422 23.6364H33.1876V27.2727ZM23.0248 27.2727H16.9275L16.3136 23.6364H22.5215L23.0248 27.2727ZM18.1555 34.5455L17.5415 30.9091H23.5282L24.0315 34.5455H18.1555ZM27.7541 34.5455L27.2507 30.9091H33.1876V34.5455H27.7541ZM36.8751 34.5455V30.9091H42.812L42.3087 34.5455H36.8751ZM46.0331 34.5455L46.5364 30.9091H52.5231L51.9091 34.5455H46.0331ZM54.979 16.3636L54.365 20H48.0483L48.5516 16.3636H54.979ZM44.8291 16.3636L44.3257 20H36.8751V16.3636H44.8291ZM33.1876 16.3636V20H25.737L25.2336 16.3636H33.1876ZM21.5111 16.3636L22.0144 20H15.6959L15.0819 16.3636H21.5111Z"
                    fill="#66757F"
                  />
                  <path
                    d="M22.125 58.182C25.1799 58.182 27.6563 55.74 27.6563 52.7275C27.6563 49.715 25.1799 47.2729 22.125 47.2729C19.0702 47.2729 16.5938 49.715 16.5938 52.7275C16.5938 55.74 19.0702 58.182 22.125 58.182Z"
                    fill="#E1E8ED"
                  />
                  <path
                    d="M22.125 60C18.0577 60 14.75 56.7382 14.75 52.7273C14.75 48.7164 18.0577 45.4546 22.125 45.4546C26.1924 45.4546 29.5 48.7164 29.5 52.7273C29.5 56.7382 26.1924 60 22.125 60ZM22.125 49.091C20.0914 49.091 18.4375 50.7219 18.4375 52.7273C18.4375 54.7328 20.0914 56.3637 22.125 56.3637C24.1587 56.3637 25.8125 54.7328 25.8125 52.7273C25.8125 50.7219 24.1587 49.091 22.125 49.091Z"
                    fill="#292F33"
                  />
                  <path
                    d="M47.9375 58.182C50.9924 58.182 53.4688 55.74 53.4688 52.7275C53.4688 49.715 50.9924 47.2729 47.9375 47.2729C44.8827 47.2729 42.4062 49.715 42.4062 52.7275C42.4062 55.74 44.8827 58.182 47.9375 58.182Z"
                    fill="#E1E8ED"
                  />
                  <path
                    d="M47.9375 60C43.8702 60 40.5625 56.7382 40.5625 52.7273C40.5625 48.7164 43.8702 45.4546 47.9375 45.4546C52.0049 45.4546 55.3125 48.7164 55.3125 52.7273C55.3125 56.7382 52.0049 60 47.9375 60ZM47.9375 49.091C45.9039 49.091 44.25 50.7219 44.25 52.7273C44.25 54.7328 45.9039 56.3637 47.9375 56.3637C49.9712 56.3637 51.625 54.7328 51.625 52.7273C51.625 50.7219 49.9712 49.091 47.9375 49.091Z"
                    fill="#292F33"
                  />
                </svg>
                <div className="text-ban">
                  <a>เลือกซื้อเพื่อบริจาค</a>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Stats ===== */}
      <section className="stats">
        <h2>ร่วมสร้างการเปลี่ยนแปลงไปกับ Unieed</h2>
        <p className="sub">
          ตัวเลขแหล่งการแบ่งปันที่เกิดขึ้นจริงจากทุกคนในปี 2569
        </p>

        <div className="statGrid">
           <div className="statCard statYellow">
            <div className="statIcon2">
<svg width="85" height="85" viewBox="0 0 85 85" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.5 48.1993C12.5 53.6188 9.7025 58.0128 6.25 58.0128C2.7975 58.0128 0 53.6188 0 48.1993C0 42.7798 2.7975 38.3857 6.25 38.3857C9.7025 38.3857 12.5 42.7798 12.5 48.1993ZM85 48.1993C85 53.6188 82.2025 58.0128 78.75 58.0128C75.2975 58.0128 72.5 53.6188 72.5 48.1993C72.5 42.7798 75.2975 38.3857 78.75 38.3857C82.2025 38.3857 85 42.7798 85 48.1993Z" fill="#F7DECE"/>
<path d="M7.5 49.578C7.5 28.6604 23.17 11.7026 42.5 11.7026C61.83 11.7026 77.5 28.6604 77.5 49.578C77.5 70.4955 61.83 84.9999 42.5 84.9999C23.17 84.9999 7.5 70.4955 7.5 49.578Z" fill="#F7DECE"/>
<path d="M27.5 53.1065C26.12 53.1065 25 52.0098 25 50.6531V45.7464C25 44.3921 26.12 43.293 27.5 43.293C28.88 43.293 30 44.3921 30 45.7464V50.6531C30 52.0098 28.88 53.1065 27.5 53.1065ZM57.5 53.1065C56.1175 53.1065 55 52.0098 55 50.6531V45.7464C55 44.3921 56.1175 43.293 57.5 43.293C58.8825 43.293 60 44.3921 60 45.7464V50.6531C60 52.0098 58.8825 53.1065 57.5 53.1065Z" fill="#662113"/>
<path d="M42.4996 72.7328C32.0296 72.7328 26.6071 70.1322 26.3821 70.0218C25.1471 69.4158 24.6471 67.9413 25.2646 66.7293C25.8821 65.5223 27.3721 65.0316 28.6071 65.6278C28.7346 65.6867 33.4196 67.826 42.4996 67.826C51.6621 67.826 56.3496 65.6474 56.3971 65.6253C57.6371 65.0341 59.1321 65.5419 59.7371 66.7465C60.3446 67.956 59.8496 69.4183 58.6196 70.0218C58.3896 70.1322 52.9696 72.7328 42.4996 72.7328ZM44.9996 60.4659H39.9996C38.6196 60.4659 37.4996 59.3692 37.4996 58.0125C37.4996 56.6557 38.6196 55.5591 39.9996 55.5591H44.9996C46.3821 55.5591 47.4996 56.6557 47.4996 58.0125C47.4996 59.3692 46.3821 60.4659 44.9996 60.4659Z" fill="#C1694F"/>
<path d="M42.499 0C19.424 0 4.99902 15.8538 4.99902 29.0628C4.99902 42.2743 7.88402 47.5589 10.769 42.2743L16.539 31.7051C16.539 31.7051 26.0165 31.4009 31.7865 26.1163C31.7865 26.1163 29.109 35.9298 48.2715 26.4205C48.2715 26.4205 47.8565 35.9298 61.249 26.1163C61.249 26.1163 71.3465 29.0628 74.2265 42.2743C75.0265 45.9396 79.999 42.2743 79.999 29.0628C79.999 15.8538 68.4615 0 42.499 0Z" fill="#292F33"/>
</svg>

<svg width="85" height="85" viewBox="0 0 85 85" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M74.0162 56.8547C84.6623 66.9273 84.7756 85.0002 82.0825 85.0002C79.3893 85.0002 71.2387 80.2329 66.0922 74.8659C60.9457 69.5014 61.4807 57.4184 61.4807 57.4184L65.6601 46.3008C65.6601 46.2982 63.3701 46.7822 74.0162 56.8547Z" fill="#292F33"/>
<path d="M66.1115 56.8547C76.7576 66.9273 76.871 85.0002 74.1778 85.0002C71.4847 85.0002 63.3341 80.2329 58.1876 74.8659C53.0411 69.5014 53.576 57.4184 53.576 57.4184L57.7554 46.3008C57.7554 46.2982 55.4654 46.7822 66.1115 56.8547ZM2.97277 84.9461C0.337601 84.9461 0.337601 66.9273 10.8783 56.6308C21.419 46.3343 18.7838 46.3343 18.7838 46.3343L24.0542 56.6308C24.0542 56.6308 24.0542 69.5014 18.7838 74.6496C13.5135 79.7979 5.60795 84.9461 2.97277 84.9461Z" fill="#292F33"/>
<path d="M10.8771 84.9459C8.2419 84.9459 8.2419 66.927 18.7826 56.6305C29.3233 46.334 26.6881 46.334 26.6881 46.334L31.9585 56.6305C31.9585 56.6305 31.9585 69.5011 26.6881 74.6494C21.4178 79.7976 13.5122 84.9459 10.8771 84.9459Z" fill="#292F33"/>
<path d="M13.2867 44.6693C11.782 39.1761 7.71065 35.4668 4.19532 36.3884C0.680002 37.3099 -0.943265 42.5096 0.561419 48.0002C2.0661 53.496 6.13745 57.2002 9.65277 56.2812C13.1681 55.3597 14.794 50.1599 13.2867 44.6693ZM84.439 48.0002C85.9437 42.5071 84.3178 37.3073 80.8025 36.3858C77.2898 35.4694 73.2184 39.1736 71.7137 44.6693C70.2064 50.1625 71.8323 55.3597 75.3477 56.2812C78.863 57.2027 82.9343 53.4934 84.439 48.0002Z" fill="#F7DECE"/>
<path d="M76.7567 46.3344C76.7567 22.166 61.42 5.14844 42.4994 5.14844C23.5789 5.14844 8.24219 22.166 8.24219 46.3344C8.24219 70.5029 23.5789 84.9463 42.4994 84.9463C61.42 84.9463 76.7567 70.5029 76.7567 46.3344Z" fill="#F7DECE"/>
<path d="M42.5015 68.6034C36.1243 68.6034 31.2387 66.835 31.0332 66.7629C29.6708 66.2635 28.9804 64.7783 29.4942 63.4474C30.0055 62.1166 31.5207 61.4422 32.8831 61.9416C32.9252 61.957 37.1257 63.4551 42.5015 63.4551C47.8798 63.4551 52.0803 61.957 52.1198 61.9416C53.4796 61.4422 55.0027 62.1243 55.506 63.4526C56.0146 64.7834 55.3295 66.2635 53.9671 66.7629C53.7642 66.8376 48.8812 68.6034 42.5015 68.6034Z" fill="#DF1F32"/>
<path d="M45.134 56.6307H39.8637C38.4091 56.6307 37.2285 55.48 37.2285 54.0565C37.2285 52.6331 38.4091 51.4824 39.8637 51.4824H45.134C46.5913 51.4824 47.7692 52.6331 47.7692 54.0565C47.7692 55.48 46.5913 56.6307 45.134 56.6307Z" fill="#C1694F"/>
<path d="M26.6889 48.9088C25.2343 48.9088 24.0537 47.7582 24.0537 46.3347V41.1864C24.0537 39.7655 25.2343 38.6123 26.6889 38.6123C28.1435 38.6123 29.3241 39.7655 29.3241 41.1864V46.3347C29.3241 47.7582 28.1435 48.9088 26.6889 48.9088ZM58.311 48.9088C56.8537 48.9088 55.6758 47.7582 55.6758 46.3347V41.1864C55.6758 39.7655 56.8537 38.6123 58.311 38.6123C59.7682 38.6123 60.9461 39.7655 60.9461 41.1864V46.3347C60.9461 47.7582 59.7682 48.9088 58.311 48.9088Z" fill="#662113"/>
<path d="M79.3922 23.1671C74.1218 5.14825 60.9459 0 53.0404 0C47.7701 0 42.4997 5.14825 42.4997 5.14825C42.4997 5.14825 37.2294 0 31.959 0C24.0535 0 10.8776 5.14825 5.60728 23.1671C1.26451 38.0173 8.24245 51.4825 8.24245 51.4825C8.24245 43.7576 13.5128 28.3154 26.6887 28.3154C39.8645 28.3154 42.4997 18.0189 42.4997 18.0189C42.4997 18.0189 44.571 28.3154 57.7468 28.3154C70.9227 28.3154 76.757 43.7601 76.757 51.4825C76.757 51.4825 83.7349 38.0173 79.3922 23.1671Z" fill="#292F33"/>
</svg>
            </div>
            <div className="statValue">
              {Number(stats.students_total || 0).toLocaleString()}
            </div>
            <div className="statLabel">นักเรียนที่ต้องการชุด</div>
          </div>
          

          <div className="statCard statGreen">
            <div className="statIcon2">
              <svg
                width="93"
                height="93"
                viewBox="0 0 93 93"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M87.1875 46.5288H5.8125L10.8113 34.0029C11.3053 32.7532 12.4969 31.9395 13.8338 31.9395H79.1662C80.5031 31.9395 81.6947 32.7532 82.1888 34.0029L87.1875 46.5288Z"
                  fill="#8C5543"
                />
                <path
                  d="M50.8887 9.67773H58.7065C59.1715 9.67773 59.5493 10.0555 59.5493 10.5205V14.6474C59.5493 15.1124 59.1715 15.4902 58.7065 15.4902H52.6615C51.7024 15.4902 50.9177 14.7055 50.9177 13.7465V9.67773H50.8887Z"
                  fill="#C3EF3C"
                />
                <path
                  d="M55.5094 12.584H46.5V6.77148H55.5094C56.1488 6.77148 56.6719 7.29461 56.6719 7.93398V11.3924C56.7009 12.0609 56.1778 12.584 55.5094 12.584Z"
                  fill="#00F397"
                />
                <path
                  opacity="0.7"
                  d="M5.8125 46.5H26.1562V87.1875H5.8125V46.5ZM87.1875 46.5H66.8438V87.1875H87.1875V46.5Z"
                  fill="#FFDEA7"
                />
                <path
                  d="M66.0302 40.5711L48.1568 22.9592C47.9435 22.7448 47.6898 22.5747 47.4105 22.4586C47.1313 22.3425 46.8318 22.2827 46.5293 22.2827C46.2268 22.2827 45.9273 22.3425 45.648 22.4586C45.3687 22.5747 45.1151 22.7448 44.9018 22.9592L27.0284 40.5711C26.5002 41.0946 26.1977 41.8038 26.1855 42.5473V87.2164H37.7146L46.4741 83.7086L55.2335 87.2164H66.873V42.5183C66.844 41.7917 66.5534 41.0942 66.0302 40.5711Z"
                  fill="#FFCE7C"
                />
                <path
                  d="M13.7175 61.0312H9.5325C9.09656 61.0312 8.71875 60.6534 8.71875 60.2175V53.1263C8.71875 52.6903 9.09656 52.3125 9.5325 52.3125H13.7175C14.1534 52.3125 14.5312 52.6903 14.5312 53.1263V60.2175C14.5312 60.6825 14.1825 61.0312 13.7175 61.0312ZM23.25 60.2175V53.1263C23.25 52.6903 22.8722 52.3125 22.4362 52.3125H18.2513C17.8153 52.3125 17.4375 52.6903 17.4375 53.1263V60.2175C17.4375 60.6534 17.8153 61.0312 18.2513 61.0312H22.4362C22.9012 61.0312 23.25 60.6825 23.25 60.2175ZM14.5312 71.8425V64.7513C14.5312 64.3153 14.1534 63.9375 13.7175 63.9375H9.5325C9.09656 63.9375 8.71875 64.3153 8.71875 64.7513V71.8425C8.71875 72.2784 9.09656 72.6562 9.5325 72.6562H13.7175C14.1825 72.6562 14.5312 72.3075 14.5312 71.8425ZM23.25 71.8425V64.7513C23.25 64.3153 22.8722 63.9375 22.4362 63.9375H18.2513C17.8153 63.9375 17.4375 64.3153 17.4375 64.7513V71.8425C17.4375 72.2784 17.8153 72.6562 18.2513 72.6562H22.4362C22.9012 72.6562 23.25 72.3075 23.25 71.8425ZM74.7487 61.0312H70.5638C70.1278 61.0312 69.75 60.6534 69.75 60.2175V53.1263C69.75 52.6903 70.1278 52.3125 70.5638 52.3125H74.7487C75.1847 52.3125 75.5625 52.6903 75.5625 53.1263V60.2175C75.5625 60.6825 75.2137 61.0312 74.7487 61.0312ZM79.2825 61.0312H83.4675C83.9325 61.0312 84.2812 60.6825 84.2812 60.2175V53.1263C84.2812 52.6903 83.9034 52.3125 83.4675 52.3125H79.2825C78.8466 52.3125 78.4688 52.6903 78.4688 53.1263V60.2175C78.4688 60.6534 78.8466 61.0312 79.2825 61.0312ZM74.7487 72.6562H70.5638C70.1278 72.6562 69.75 72.2784 69.75 71.8425V64.7513C69.75 64.3153 70.1278 63.9375 70.5638 63.9375H74.7487C75.1847 63.9375 75.5625 64.3153 75.5625 64.7513V71.8425C75.5625 72.3075 75.2137 72.6562 74.7487 72.6562ZM79.2825 72.6562H83.4675C83.9325 72.6562 84.2812 72.3075 84.2812 71.8425V64.7513C84.2812 64.3153 83.9034 63.9375 83.4675 63.9375H79.2825C78.8466 63.9375 78.4688 64.3153 78.4688 64.7513V71.8425C78.4688 72.2784 78.8466 72.6562 79.2825 72.6562Z"
                  fill="#83CBFF"
                />
                <path
                  d="M46.5 52.3125C48.8124 52.3125 51.03 51.3939 52.6651 49.7588C54.3002 48.1238 55.2187 45.9061 55.2188 43.5938C55.2187 41.2814 54.3002 39.0637 52.6651 37.4287C51.03 35.7936 48.8124 34.875 46.5 34.875C44.1876 34.875 41.97 35.7936 40.3349 37.4287C38.6998 39.0637 37.7812 41.2814 37.7812 43.5938C37.7812 45.9061 38.6998 48.1238 40.3349 49.7588C41.97 51.3939 44.1876 52.3125 46.5 52.3125Z"
                  fill="white"
                />
                <path
                  d="M45.0759 18.0187V7.17844C45.0759 6.42281 45.6862 5.8125 46.4419 5.8125H46.6163C47.3719 5.8125 47.9822 6.42281 47.9822 7.17844V18.0565C48.1178 18.1457 48.2437 18.2493 48.36 18.3675L68.7909 38.7984C69.4013 39.4088 69.75 40.2225 69.75 41.0944L69.7209 46.3838C69.75 46.4128 69.75 46.4709 69.75 46.5291C69.75 47.3428 69.1106 47.9822 68.2969 47.9822C67.4831 47.9822 66.8438 47.3428 66.8438 46.5291C66.8457 46.5 66.8505 46.4758 66.8583 46.4564C66.868 46.4351 66.8728 46.4109 66.8728 46.3838H66.8438V42.8672C66.8438 42.1116 66.5241 41.385 66.0009 40.8619L48.1275 22.9884C47.9142 22.774 47.6606 22.6039 47.3813 22.4878C47.102 22.3717 46.8025 22.3119 46.5 22.3119C46.1975 22.3119 45.898 22.3717 45.6187 22.4878C45.3394 22.6039 45.0858 22.774 44.8725 22.9884L26.9991 40.8619C26.4469 41.385 26.1562 42.1116 26.1562 42.8672V46.3838H26.1272C26.1272 46.4109 26.132 46.4351 26.1417 46.4564L26.1562 46.5291C26.1562 47.3428 25.5169 47.9822 24.7031 47.9822C23.8894 47.9822 23.25 47.3428 23.25 46.5291C23.25 46.5 23.2548 46.4758 23.2645 46.4564L23.2791 46.3838H23.25V41.0944C23.25 40.2516 23.5987 39.4088 24.2091 38.7984L44.64 18.3675C44.7738 18.2375 44.9198 18.1207 45.0759 18.0187ZM45.0469 43.3322C45.0469 43.3845 45.0498 43.4368 45.0556 43.4891C45.0341 43.7052 45.0613 43.9234 45.1353 44.1276C45.2092 44.3318 45.328 44.5168 45.4828 44.6691L49.7841 48.9703C50.0456 49.2609 50.4234 49.4062 50.8012 49.4062C51.1791 49.4062 51.5278 49.2609 51.8475 48.9703C52.4288 48.3891 52.4288 47.4881 51.8475 46.9069L47.9531 43.0125V39.2344C47.9531 38.4206 47.3138 37.7812 46.5 37.7812C45.6862 37.7812 45.0469 38.4206 45.0469 39.2344V43.3322ZM55.2478 87.1875H37.665V71.7844C37.665 70.6509 38.5659 69.75 39.6994 69.75H53.2134C54.3469 69.75 55.2478 70.6509 55.2478 71.7844V87.1875Z"
                  fill="#7D4533"
                />
              </svg>
            </div>
            <div className="statValue">{stats.schools_approved || 0}</div>
            <div className="statLabel">โรงเรียนที่เข้าร่วมโครงการ</div>
          </div>

          <div className="statCard statBlue">
            <div className="statIcon1">
              <svg
                width="70"
                height="70"
                viewBox="0 0 70 70"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M70 62.2222C70 66.5175 66.5175 70 62.2222 70H7.77778C3.4825 70 0 66.5175 0 62.2222V7.77778C0 3.4825 3.4825 0 7.77778 0H62.2222C66.5175 0 70 3.4825 70 7.77778V62.2222Z"
                  fill="white"
                />
                <path
                  d="M37.608 68.9403C36.173 70.352 33.828 70.352 32.395 68.9403L19.4975 56.245C18.0644 54.8334 17.6852 52.2939 18.6536 50.5984L33.2369 14.7292C34.2072 13.0356 35.7938 13.0356 36.7622 14.7292L51.3455 50.5984C52.3138 52.292 51.9347 54.8334 50.5016 56.2431L37.608 68.9403Z"
                  fill="#053F5C"
                />
                <path
                  d="M34.9992 28.5211C36.8445 28.5211 38.8959 26.67 40.6362 24.2609L36.7609 14.7292C35.7906 13.0356 34.204 13.0356 33.2356 14.7292L29.3604 24.2609C31.1045 26.67 33.154 28.5211 34.9992 28.5211Z"
                  fill="#292F33"
                />
                <path
                  d="M44.7218 11.2352C44.7218 15.0541 39.2948 25.0641 34.9996 25.0641C30.7043 25.0641 25.2773 15.0541 25.2773 11.2352C25.2773 7.76822 30.7043 5.8335 34.9996 5.8335C39.2948 5.8335 44.7218 7.76822 44.7218 11.2352Z"
                  fill="#053F5C"
                />
                <path
                  d="M0 7.77778V12.1606C4.03278 17.5467 13.1814 27.2319 15.5556 27.2319C19.8508 27.2319 36.9444 6.23972 36.9444 1.94444C36.9444 0 35 0 33.0556 0H7.77778C3.4825 0 0 3.4825 0 7.77778Z"
                  fill="#D9D9D9"
                />
                <path
                  d="M33.0547 1.94444C33.0547 6.23972 50.1483 27.2319 54.4436 27.2319C56.8177 27.2319 65.9664 17.5467 69.9991 12.1606V7.77778C69.9991 3.4825 66.5166 0 62.2214 0H36.9436C34.9991 0 33.0547 0 33.0547 1.94444Z"
                  fill="#D9D9D9"
                />
                <path
                  d="M7.77743 0C7.25826 0 6.75465 0.0563889 6.26465 0.153611C8.56493 3.37556 20.5369 5.83333 34.9996 5.83333C49.4624 5.83333 61.4344 3.37556 63.7346 0.153611C63.2446 0.0563889 62.741 0 62.2219 0H7.77743Z"
                  fill="#181818"
                  fill-opacity="0.533333"
                />
              </svg>
            </div>
            <div className="statValue1">
  {Number(stats.uniforms_fulfilled || 0).toLocaleString()}
</div>
            <div className="statLabel">ชุดนักเรียนที่ส่งต่อแล้ว</div>
          </div>

        </div>
      </section>

      {/* ===== Projects ===== */}
      <section id="projects" className="section sectionBlue">
        {/* Title + Search bar */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h3 className="projSectionTitle">โครงการที่กำลังเปิดรับบริจาค</h3>
          {/* Search bar — พิมพ์ได้, Enter/ปุ่มค้นหา → navigate */}
          <form
            className="projSearchBar"
            onSubmit={e => e.preventDefault()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="projSearchInput"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ค้นหาโครงการ โรงเรียน หรือจังหวัด..."
            />
            <button type="submit" className="projSearchBtn">ค้นหา</button>
          </form>
        </div>

        <style>{`@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>

        {/* ── Search results mode ── */}
        {searchResults !== null ? (
          <>
            <div className="projRowHeader">
              <div className="projRowLabel" style={{ color: "#374151" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {searchLoading
                  ? "กำลังค้นหา..."
                  : searchResults.length
                    ? `ผลการค้นหา "${q.trim()}" — ${searchTotal} โครงการ`
                    : `ไม่พบโครงการที่ตรงกับ "${q.trim()}"`}
              </div>
              {searchTotal > 6 && (
                <button onClick={() => navigate("/projects", { state: { focusSearch: true, q: q.trim() } })} className="projRowSeeAll">
                  ดูทั้งหมด {searchTotal} รายการ →
                </button>
              )}
            </div>

            {searchLoading ? (
              <div className="projGrid">
                {[0,1,2].map(i => <div key={i} style={{ height: 340, borderRadius: 14, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.4s ease infinite" }} />)}
              </div>
            ) : searchResults.length ? (
              <div className="projGrid">
                {searchResults.map(p => (
                  <ProjCard key={p.request_id} p={p} navigate={navigate} details={projectDetails[p.request_id]} collectionLabel={null} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontFamily: "Mitr, sans-serif" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, color: "#cbd5e1" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>ไม่พบโครงการที่ตรงกัน</div>
                <div style={{ fontSize: 13 }}>ลองค้นหาด้วยคำอื่น หรือ</div>
                <button onClick={() => navigate("/projects", { state: { focusSearch: true, q: q.trim() } })} style={{ marginTop: 12, background: "#5285E8", color: "#fff", border: "none", borderRadius: 99, padding: "8px 20px", fontSize: 14, cursor: "pointer", fontFamily: "Mitr, sans-serif", fontWeight: 500 }}>
                  ค้นหาขั้นสูงเพิ่มเติม
                </button>
              </div>
            )}
          </>
        ) : loading ? (
          <div className="projGrid" style={{ marginBottom: 0 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 340, borderRadius: 14, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.4s ease infinite" }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── แถวบน: ต้องการความช่วยเหลือ (fixed) ── */}
            <div className="projRowHeader">
              <div className="projRowLabel">
                <span style={{ background: "#fef2f2", borderRadius: 8, padding: "4px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                  <Icon icon="mdi:hand-heart-outline" width="18" height="18" style={{color:"#ef4444"}} />
                  <span style={{color:"#ef4444"}}>ต้องการความช่วยเหลือ</span>
                </span>
              </div>
              <Link to="/projects" state={{ collection: "แนะนำ" }} className="projRowSeeAll">ดูทั้งหมด →</Link>
            </div>
            <div className="projGrid">
              {displayUrgentProjects.length ? displayUrgentProjects.map(p => (
                <ProjCard key={p.request_id} p={p} navigate={navigate} details={projectDetails[p.request_id]} collectionLabel="แนะนำ" />
              )) : (
                <div className="muted" style={{ gridColumn: "1/-1", padding: "32px 0", textAlign: "center" }}>ไม่มีโครงการในขณะนี้</div>
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <Link to="/projects" state={{ collection: "แนะนำ" }} className="projSeeAllMobile">
                ดูโครงการทั้งหมด →
              </Link>
            </div>

            {/* ── divider ── */}
            <div style={{ maxWidth: 1240, margin: "40px auto 0", width: "100%" }}>
              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent)" }} />
            </div>

            {/* ── แถวล่าง: switchable tab ── */}
            <div className="projRowHeader" style={{ marginTop: 28 }}>
              <div className="projTabRow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {[
                  { key: "ใหม่ล่าสุด", label: "ใหม่ล่าสุด", color: "#3b82f6", icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 36 36"><path fill="currentColor" d="m34.11 24.49l-3.92-6.62l3.88-6.35a1 1 0 0 0-.85-1.52H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h31.25a1 1 0 0 0 .86-1.51m-23.6-3.31H9.39l-3.26-4.34v4.35H5V15h1.13l3.27 4.35V15h1.12ZM16.84 16h-3.53v1.49h3.2v1h-3.2v1.61h3.53v1h-4.66V15h4.65Zm8.29 5.16H24l-1.55-4.59l-1.55 4.61h-1.12l-2-6.18H19l1.32 4.43L21.84 15h1.22l1.46 4.43L25.85 15h1.23Z"/><path fill="none" d="M0 0h36v36H0z"/></svg> },
                  { key: "ใกล้เวลาปิด", label: "ใกล้เวลาปิด", color: "#f97316", icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                  { key: "ใกล้ถึงเป้าหมาย", label: "ใกล้ถึงเป้าหมาย", color: "#10b981", icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8a8 8 0 0 1-8 8zm0-12a4 4 0 1 0 4 4a4 4 0 0 0-4-4zm0 6a2 2 0 1 1 2-2a2 2 0 0 1-2 2z"/></svg> },
                  { key: "โครงการใกล้ฉัน", label: "ใกล้ฉัน", color: "#8b5cf6", icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C7.589 2 4 5.589 4 9.995C3.971 16.44 11.696 21.784 12 22c0 0 8.029-5.56 8-12c0-4.411-3.589-8-8-8m0 12c-2.21 0-4-1.79-4-4s1.79-4 4-4s4 1.79 4 4s-1.79 4-4 4"/></svg> },
                ].map(tab => {
                  const active = homeTab === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setHomeTab(tab.key)} style={{
                      padding: "6px 16px", borderRadius: 99,
                      border: `1.5px solid ${active ? tab.color : "#e5e7eb"}`,
                      background: active ? tab.color : "#fff",
                      color: active ? "#fff" : "#6b7280",
                      fontWeight: 500, fontSize: 13, cursor: "pointer", fontFamily: "Mitr, sans-serif",
                      display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s", flexShrink: 0,
                    }}>
                      {tab.icon}{tab.label}
                    </button>
                  );
                })}
              </div>
              {homeTab !== NEARBY_TAB && (
                <Link to="/projects" state={{ collection: homeTab }} className="projRowSeeAll">ดูทั้งหมด →</Link>
              )}
            </div>

            {/* Province picker modal */}
            {homeTab === NEARBY_TAB && showProvincePicker && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px 24px", width: "min(92vw,420px)", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", fontFamily: "Mitr, sans-serif" }}>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 17, color: "#1e293b" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="#8b5cf6" d="M12 2C7.589 2 4 5.589 4 9.995C3.971 16.44 11.696 21.784 12 22c0 0 8.029-5.56 8-12c0-4.411-3.589-8-8-8m0 12c-2.21 0-4-1.79-4-4s1.79-4 4-4s4 1.79 4 4s-1.79 4-4 4"/></svg>
                      เลือกจังหวัดของคุณ
                    </div>
                    {nearbyGpsError && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4, marginLeft: 30 }}>{nearbyGpsError}</div>}
                    {!nearbyGpsError && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, marginLeft: 30 }}>เพื่อแสดงโครงการในจังหวัดของคุณ</div>}
                  </div>
                  <input type="text" placeholder="พิมพ์ชื่อจังหวัด…" value={provinceInput} onChange={e => setProvinceInput(e.target.value)}
                    style={{ width: "100%", padding: "9px 14px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "Mitr, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 12 }} autoFocus />
                  <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {PROVINCES_LIST.filter(p => !provinceInput || p.includes(provinceInput)).map(prov => (
                      <button key={prov} onClick={() => handleSelectProvince(prov)}
                        style={{ padding: "6px 14px", borderRadius: 99, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#334155", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "Mitr, sans-serif", transition: "background 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#8b5cf6"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#8b5cf6"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#334155"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                      >{prov}</button>
                    ))}
                  </div>
                  {nearbyProvince && (
                    <button onClick={() => setShowProvincePicker(false)} style={{ marginTop: 16, width: "100%", padding: "9px", border: "none", background: "#f1f5f9", borderRadius: 8, color: "#475569", fontSize: 14, cursor: "pointer", fontFamily: "Mitr, sans-serif" }}>ยกเลิก</button>
                  )}
                </div>
              </div>
            )}

            {homeTab === NEARBY_TAB && nearbyProvince && !showProvincePicker && (
              <div className="projRowHeader" style={{ marginTop: 10, marginBottom: 12 }}>
                <span style={{ background: "#ede9fe", color: "#6d28d9", padding: "5px 16px", borderRadius: 99, fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 5 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C7.589 2 4 5.589 4 9.995C3.971 16.44 11.696 21.784 12 22c0 0 8.029-5.56 8-12c0-4.411-3.589-8-8-8m0 12c-2.21 0-4-1.79-4-4s1.79-4 4-4s4 1.79 4 4s-1.79 4-4 4"/></svg>
                  โครงการในจังหวัด{nearbyProvince}
                </span>
                <button onClick={handleChangeProvince} style={{ background: "none", border: "1.5px solid #c4b5fd", color: "#7c3aed", borderRadius: 99, padding: "5px 14px", fontSize: 13, cursor: "pointer", fontFamily: "Mitr, sans-serif", fontWeight: 500 }}>เปลี่ยนจังหวัด</button>
              </div>
            )}

            <div className="projGrid" id="tabProjGrid">
              {(homeTab === NEARBY_TAB && nearbyLoading) ? (
                [0,1,2].map(i => <div key={i} style={{ height: 280, borderRadius: 14, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.4s ease infinite" }} />)
              ) : !displayProjects.length ? (
                <div style={{ gridColumn: "1/-1" }}>
                  {homeTab === NEARBY_TAB ? (
                    <div style={{ fontFamily: "Mitr, sans-serif" }}>

                      {/* ── Row 1: notice (compact inline) ── */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{ color: "#a78bfa", flexShrink: 0 }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 48 48"><g fill="none" stroke="currentColor" strokeWidth="4"><path strokeLinejoin="round" d="M4 33a2 2 0 0 1 2-2h6v-7l12-8l12 8v7h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z"/><path strokeLinecap="round" d="M24 6v10"/><path strokeLinecap="round" strokeLinejoin="round" d="M36 12V6s-1.5 3-6 0s-6 0-6 0v6s1.5-3 6 0s6 0 6 0m-8 32V31h-8v13m-2 0h12"/></g></svg>
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>ยังไม่มีโครงการในจังหวัด{nearbyProvince}</div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>มีพื้นที่อื่นที่ต้องการความช่วยเหลือเร่งด่วน</div>
                        </div>
                      </div>

                      {/* ── Row 2: Province chips ── */}
                      {demandFallback.length > 0 && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                          {demandFallback.map((dp) => {
                            const active = demandFallbackProvince === dp.province;
                            return (
                              <button
                                key={dp.province}
                                onClick={() => handleLoadDemandProvince(dp.province)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  background: active ? "#ede9fe" : "#f8fafc",
                                  color: active ? "#5b21b6" : "#475569",
                                  border: `1.5px solid ${active ? "#c4b5fd" : "#e2e8f0"}`,
                                  borderRadius: 99, padding: "6px 14px", cursor: "pointer",
                                  fontFamily: "Mitr, sans-serif", fontSize: 13, fontWeight: active ? 700 : 500,
                                  transition: "all 0.15s",
                                }}
                              >
                                <Icon icon="mdi:map-marker" style={{ fontSize: 14, color: active ? "#7c3aed" : "#a78bfa", flexShrink: 0 }} />
                                {dp.province}
                                <span style={{
                                  fontSize: 11, fontWeight: 600,
                                  background: active ? "#ddd6fe" : "#f1f5f9",
                                  color: active ? "#5b21b6" : "#94a3b8",
                                  borderRadius: 99, padding: "1px 7px",
                                }}>
                                  {(dp.still_needed || 0).toLocaleString()} ชิ้น
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Row 3: Project cards ── */}
                      {demandFallbackProvince && (
                        <div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
                            <Icon icon="mdi:map-marker" style={{ color: "#a78bfa", fontSize: 14 }} />
                            โครงการในจังหวัด{demandFallbackProvince}
                          </div>
                          {demandFallbackLoading ? (
                            <div className="projGrid">
                              {[0,1,2].map(i => (
                                <div key={i} style={{ borderRadius: 14, background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.4s ease infinite", minHeight: 280 }} />
                              ))}
                            </div>
                          ) : demandFallbackProjects.length === 0 ? (
                            <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "24px 0" }}>ไม่มีโครงการในจังหวัดนี้</div>
                          ) : (
                            <div className="projGrid">
                              {demandFallbackProjects.map(p => (
                                <ProjCard key={p.request_id} p={p} navigate={navigate} details={projectDetails[p.request_id]} collectionLabel={(() => {
                                  const cols = projectAllCollections[p.request_id];
                                  if (cols?.length) return BADGE_PRIORITY.find(b => cols.includes(b)) || "แนะนำ";
                                  return nearbyBadgeMap[p.request_id] || "แนะนำ";
                                })()} />
                              ))}
                            </div>
                          )}
                          <div style={{ textAlign: "center", marginTop: 14 }}>
                            <Link to="/projects" className="projRowSeeAll">ดูโครงการทั้งหมด →</Link>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="muted" style={{ textAlign: "center", padding: "48px 0" }}>ไม่มีโครงการในหมวดนี้</div>
                  )}
                </div>
              ) : displayProjects.map(p => (
                <ProjCard key={p.request_id} p={p} navigate={navigate} details={projectDetails[p.request_id]} collectionLabel={homeTab === NEARBY_TAB ? (() => {
                    const cols = projectAllCollections[p.request_id];
                    if (cols?.length) return BADGE_PRIORITY.find(b => cols.includes(b)) || "แนะนำ";
                    return nearbyBadgeMap[p.request_id] || null;
                  })() : homeTab} />
              ))}
            </div>
            {homeTab !== NEARBY_TAB && (
              <div style={{ textAlign: "center" }}>
                <Link to="/projects" state={{ collection: homeTab }} className="projSeeAllMobile">
                  ดูโครงการทั้งหมด →
                </Link>
              </div>
            )}
          </>
        )}
      </section>


      {/* ===== Steps + FAQ ===== */}
      <section className="steps">
        <div className="stepsWrap">
          <div className="stepsSide">
            <div className="stepsBig">
              5 ขั้นตอน !<br />
              บริจาคง่ายๆ
            </div>
          </div>

          <div className="stepsCards">
            {steps.map((s) => (
              <div className="stepCard" key={s.no}>
                <div className="stepPic">{s.icon}</div>
                <div className="stepTitle">
                  {s.no}. {s.title}
                </div>
                <div className="stepDesc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ===== FAQ ===== */}
      <section className="faqSection">
        <div className="faqWrap">
          <div className="faqTitle">
            คำถามที่พบบ่อย
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 512 512"><path fill="currentColor" fillRule="evenodd" d="M334.434 206.171c0 13.516-3.435 25.318-10.288 35.397c-5.65 8.47-15.12 17.649-28.436 27.534c-7.664 5.247-12.711 10.184-15.126 14.823c-3.04 5.648-4.54 14.113-4.54 25.409h-42.666c0-17.137 1.824-29.64 5.454-37.504c4.23-9.483 13.407-19.064 27.521-28.743c6.664-5.045 11.503-10.183 14.529-15.425c3.625-5.852 5.449-12.503 5.449-19.966c0-11.899-3.539-20.766-10.594-26.624c-5.636-4.228-12.502-6.345-20.569-6.345c-13.108 0-22.59 4.339-28.436 13.009c-4.236 6.45-6.36 14.719-6.36 24.8v.304h-45.361c0-26.422 8.36-46.382 25.09-59.898c14.12-11.283 31.574-16.94 52.34-16.94c18.16 0 34.092 3.533 47.798 10.588c22.803 11.703 34.195 31.572 34.195 59.581m134.9 49.83c0 117.82-95.513 213.333-213.334 213.333c-117.82 0-213.333-95.513-213.333-213.334S138.18 42.667 256 42.667S469.334 138.179 469.334 256m-42.667 0c0-94.107-76.561-170.667-170.667-170.667S85.334 161.894 85.334 256S161.894 426.667 256 426.667S426.667 350.106 426.667 256m-170.668 69.333c-14.728 0-26.667 11.938-26.667 26.666s11.94 26.667 26.667 26.667s26.667-11.939 26.667-26.667s-11.94-26.666-26.667-26.666"/></svg>
          </div>
          {[
            { q: "ชุดมือสองส่งได้มั้ย หรือต้องเป็นชุดใหม่?", a: "ชุดมือสองส่งได้เลย ขอแค่ซักสะอาดและอยู่ในสภาพที่ใส่ได้ ไม่จำเป็นต้องเป็นชุดใหม่" },
            { q: "รู้ได้ยังไงว่าโรงเรียนต้องการขนาดอะไร?", a: "แต่ละโครงการจะระบุขนาดและประเภทชุดที่ต้องการไว้ชัดเจน สามารถเลือกบริจาคได้โดยตรงกับชุดที่มีเลย" },
            { q: "ของที่ส่งไปถึงโรงเรียนจริงมั้ย?", a: "เมื่อโรงเรียนยืนยันรับของแล้ว ระบบจะแจ้งเตือนพร้อมส่งใบรับรองการบริจาคให้คุณโดยตรง" },
            { q: "ถ้าไม่มีชุด แต่อยากช่วย ทำได้มั้ย?", a: "คุณสามารถซื้อชุดมือสองในราคาถูกจากร้านค้าของเราแล้วบริจาคต่อได้เลย ไม่จำเป็นต้องมีชุดอยู่ก่อน" },
          ].map((item, i) => (
            <div key={i} className={`faqItem${faqOpen === i ? " faqItemOpen" : ""}`}>
              <button className="faqQ" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                <span>{item.q}</span>
                <svg className="faqChevron" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div className="faqA">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 15 15" style={{flexShrink:0,color:"#5285E8"}}><path fill="currentColor" d="M8.293 2.293a1 1 0 0 1 1.414 0l4.5 4.5a1 1 0 0 1 0 1.414l-4.5 4.5a1 1 0 0 1-1.414-1.414L11 8.5H1.5a1 1 0 0 1 0-2H11L8.293 3.707a1 1 0 0 1 0-1.414"/></svg>
                {item.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Market ===== */}
      <section id="market" className="section">
        <div className="sectionHead marketSectionHead">
          <div>
            <h3 className="marketTitle">ตลาดชุดนักเรียนมือสอง</h3>
            <p className="marketSub">ชุดมือสองคุณภาพดี • ราคาประหยัด • ส่งถึงมือน้องได้จริง</p>
          </div>
          <div>
            <Link className="btnGhost" to="/market">ดูทั้งหมด</Link>
          </div>
        </div>

        {loading ? (
  <div className="muted">กำลังโหลด…</div>
) : (
  <div className="grid3">
    {products.map((x) => {
      // สร้าง title จาก category
      const categoryLabel = (() => {
        const cid = Number(x.category_id);
        if (cid === 1) return x.gender === 'male' ? 'เสื้อนักเรียนชาย' : 'เสื้อนักเรียนหญิง';
        if (cid === 2) return 'กางเกงนักเรียน';
        if (cid === 3) return 'กระโปรงนักเรียน';
        return 'ชุดนักเรียน';
      })();
      const typePart     = x.type_name?.trim();
      const displayTitle = `${categoryLabel}${typePart ? ': ' + typePart : ''}`;

      // แปลง size
      const sizeText = (() => {
  console.log('raw size:', x.size, typeof x.size);
  if (!x.size) return null;
  try {
    const s = JSON.parse(x.size);
    console.log('parsed:', s);
    const cid = Number(x.category_id);
    const parts = [];
    if (cid === 1) {
      if (s.chest  && s.chest  !== '0') parts.push(`อก ${s.chest}`);
      if (s.length && s.length !== '0') parts.push(`ยาว ${s.length}`);
    } else {
      if (s.waist  && s.waist  !== '0') parts.push(`เอว ${s.waist}`);
      if (s.length && s.length !== '0') parts.push(`ยาว ${s.length}`);
    }
    console.log('parts:', parts, 'cid:', cid);
    return parts.join(' | ') || null;
  } catch(e) {
    console.log('parse error:', e);
    return x.size;
  }
})();

      const condText = [
        x.condition_percent ? `${x.condition_percent}%` : null,
        x.condition_label || null,
      ].filter(Boolean).join(' · ');

      const isDonationMatch = donationMatchedIds.size > 0 && donationMatchedIds.has(x.product_id);
      return (
  <div key={x.product_id} className="mkCard" style={{ position: 'relative' }}>
    {/* donation badge */}
    {isDonationMatch && (
      <div className="mkDonateBadge">
        <Icon icon="tabler:heart-handshake" style={{ fontSize: '15px', flexShrink: 0 }} />
        ซื้อเพื่อร่วมบริจาคได้
      </div>
    )}
    {/* stock badge */}
    {x.quantity > 0 && (
      <span className="mkStockBadge">{x.quantity} ชิ้น</span>
    )}
    <div
      className="mkCardThumb"
      onClick={() => navigate(`/market/${x.product_id}`)}
      style={{ cursor: 'pointer' }}
    >
      {x.images?.length ? (
        <img src={x.images[0].image_url} alt={displayTitle} className="mkCarouselImg" />
      ) : (
        <div className="mkCardThumbPlaceholder" />
      )}
    </div>
    <div
      className="mkCardBody"
      onClick={() => navigate(`/market/${x.product_id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="mkCardTitle">{displayTitle}</div>
      {x.school_name && (
        <div className="mkCardSchool">
          <Icon icon="mdi:school-outline" /> {x.school_name}
        </div>
      )}
      <div className="mkMeta">
        {x.level && (
          <div className="mkMetaRow">
            <span className="mkMetaLabel">ระดับ</span>
            <span className="mkMetaVal">
              <span className="mkBadgeLevel">{x.level}</span>
            </span>
          </div>
        )}
        <div className="mkMetaRow">
          <span className="mkMetaLabel">ขนาด</span>
          <span className="mkMetaVal">
            {sizeText || <span style={{ color: '#aaa' }}>ไม่ระบุ</span>}
          </span>
        </div>
        {condText && (
          <div className="mkMetaRow">
            <span className="mkMetaLabel">สภาพ</span>
            <span className="mkMetaVal">
              <span className="mkBadgeCond">{condText}</span>
            </span>
          </div>
        )}
      </div>
      <div className="mkCardDivider" />
      <div className="mkCardBottom">
        <div className="mkCardPrice">
          {Number(x.price).toLocaleString()}<span> บาท</span>
        </div>
        <button
          className="mkCartBtn"
          onClick={e => {
          e.stopPropagation();
          addToCart(x.product_id); // ✅ แก้ตรงนี้
        }}
        disabled={loadingId === x.product_id}
        type="button"
        >
          <Icon
          icon={loadingId === x.product_id ? "mdi:loading" : "mdi:cart-plus"}
          className={loadingId === x.product_id ? "mkSpinner" : ""}
        />
        </button>
      </div>
    </div>
  </div>
);
    })}
    {!products.length && <div className="muted">ยังไม่มีสินค้าในระบบ</div>}
  </div>
)}
      </section>

      {/* ===== Closed Projects ===== */}
      {closedProjects.length > 0 && (() => {
        const totalFulfilled = closedProjects.reduce((sum, p) => sum + (p.total_fulfilled || 0), 0);
        return (
          <section className="section closedSection">
            <div className="closedSecHead">
              <div className="closedSecTitle">ผลลัพธ์จากการร่วมส่งต่อของทุกคน</div>
              <div className="closedSecSub">ทุกชุดที่ท่านร่วมส่งต่อ ทำให้เกิดสิ่งเหล่านี้...</div>
            </div>


            <div className="closedScroll">
              {closedProjects.map(p => {
                const pct = p.total_needed > 0 ? Math.min(Math.round((p.total_fulfilled / p.total_needed) * 100), 100) : 0;
                return (
                  <div key={p.request_id} className="closedCard" onClick={() => navigate(`/projects/${p.request_id}`)}>
                    <span className="closedCardArrow"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10m0 0v10m0-10L7 17"/></svg></span>
                    <div className="closedCardImg">
                      {p.request_image_url
                        ? <img src={p.request_image_url} alt={p.school_name} />
                        : <div className="closedCardImgEmpty">🎒</div>}
                      <span className="closedBadge"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 14 14"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M2.5.5v13m0-13l9 4.5l-9 4.5" strokeWidth="1"/></svg>ปิดโครงการ</span>
                    </div>
                    <div className="closedCardBody">
                      <div className="closedCardSchool">{p.school_name}</div>
                      <div className="closedCardTitle">{p.request_title}</div>
                      <div className="closedCardBar">
                        <div className="closedCardBarFill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="closedCardPct">ส่งต่อแล้ว {p.total_fulfilled} / {p.total_needed} ชุด ({pct}%)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ===== Testimonials ===== */}
      {lightboxImg && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} onClick={e => e.stopPropagation()} alt="ความประทับใจ" />
        </div>,
        document.body
      )}
      {testimonials.length > 0 && (() => {
        const total = testimonials.length;
        const displayCount = Math.min(3, total);
        const display = Array.from({ length: displayCount }, (_, i) =>
          testimonials[(tsIdx + i) % total]
        );
        const stageStyle = displayCount === 1
          ? { gridTemplateColumns: "1fr", maxWidth: 420 }
          : displayCount === 2
            ? { gridTemplateColumns: "1fr 1fr" }
            : {};
        return (
          <section className="sectionSoftBlue" style={{ marginTop: 100 }}>
            <div className="tsHead">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="tsQuoteMark">❝</span>
                <h2 className="tsTitle">ความประทับใจจากโรงเรียน</h2>
              </div>
              {total > 1 && (
                <div className="tsControls">
                  <button className="tsNav" onClick={() => setTsIdx(i => (i - 1 + total) % total)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button className="tsNav" onClick={() => setTsIdx(i => (i + 1) % total)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
            </div>
            <div className="tsStage" style={stageStyle}>
              {display.map((t, i) => {
                const isMain = displayCount < 3 || i === 1;
                return (
                  <div key={`${t.testimonial_id}-${i}`} className={`tsCard${isMain ? " tsCardMain" : " tsCardSide"}`}>
                    <div
                      className="tsImageWrap"
                      style={t.image_url ? { cursor: "zoom-in" } : {}}
                      onClick={() => t.image_url && setLightboxImg(t.image_url)}
                    >
                      {t.image_url
                        ? <img src={t.image_url} alt={t.school_name} />
                        : <div className="tsImgPlaceholder" />}
                    </div>
                    <div className="tsCardInner">
                      <p className="tsTextQuote">❝ {t.review_text} ❞</p>
                      {t.review_title && <div className="tsName">{t.review_title}</div>}
                      <div className="tsName" style={{ fontSize: 15, marginTop: t.review_title ? 4 : 14 }}>{t.school_name}</div>
                      <div className="tsSub">{t.review_date}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ===== School CTA ===== */}
      <section className="schoolCta">
        <div className="schoolCtaInner">
          <div className="schoolCtaLeft">
            <span className="schoolCtaTag">สำหรับโรงเรียน</span>
            <h2 className="schoolCtaTitle">
              โรงเรียนของคุณ<br />
              ต้องการชุดนักเรียนอยู่มั้ย?
            </h2>
            <p className="schoolCtaSub">
              ขอแค่มีความต้องการ ก็สามารถเปิดโครงการขอรับบริจาคชุดนักเรียน
              ให้กับนักเรียนของคุณได้ทันที ผ่านแพลตฟอร์มออนไลน์ของเรา
            </p>
            <Link to="/register/school" className="schoolCtaBtn">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              สมัครรับบริจาค
            </Link>
          </div>
          <div className="schoolCtaRight">
            <img src="/src/unieed_pic/BannerDonation.png" alt="นักเรียน" className="schoolCtaImg" />
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer id="about" className="footer">
        <div className="footerInner">
          <div className="footBrand">
            <div>
              <Link to="/" onClick={() => window.scrollTo(0, 0)}>
                <img
                  className="footLogo"
                  src="/src/unieed_pic/logo.png"
                  alt="Unieed"
                />
              </Link>
              <div className="footDesc">
                แพลตฟอร์มส่งต่อแบ่งปันชุดนักเรียน
                <br />
                เพื่อมอบโอกาสทางการศึกษาให้กับนักเรียน
              </div>
            </div>
          </div>

          <div className="footCol">
            <div className="footTitle">เมนูลัด</div>
            <Link to="/" onClick={() => window.scrollTo(0, 0)}>หน้าหลัก</Link>
            <Link to="/projects">โครงการ</Link>
            <Link to="/market">ร้านค้า</Link>
            <Link to="/sell">ลงขาย</Link>
            <Link to="/about">เกี่ยวกับเรา</Link>
          </div>

          <div className="footCol">
            <div className="footTitle">ติดต่อเรา</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M9.55537 3.40517C11.5837 1.3885 14.9237 1.74684 16.622 4.01684L18.7254 6.8235C20.1087 8.67017 19.9854 11.2502 18.3437 12.8818L17.947 13.2785C17.9021 13.445 17.8975 13.6199 17.9337 13.7885C18.0387 14.4685 18.607 15.9085 20.987 18.2752C23.367 20.6418 24.817 21.2085 25.507 21.3152C25.6809 21.3501 25.8605 21.345 26.032 21.3002L26.712 20.6235C28.172 19.1735 30.412 18.9018 32.2187 19.8835L35.402 21.6168C38.1304 23.0968 38.8187 26.8035 36.5854 29.0252L34.217 31.3785C33.4704 32.1202 32.467 32.7385 31.2437 32.8535C28.227 33.1352 21.1987 32.7752 13.8104 25.4302C6.91537 18.5735 5.59204 12.5935 5.4237 9.64684C5.34037 8.15684 6.0437 6.89684 6.94037 6.00684L9.55537 3.40517ZM14.622 5.51517C13.777 4.38684 12.2037 4.29684 11.317 5.1785L8.70037 7.7785C8.15037 8.32517 7.88704 8.9285 7.92037 9.50517C8.0537 11.8468 9.12037 17.2418 15.5737 23.6585C22.3437 30.3885 28.5954 30.5902 31.012 30.3635C31.5054 30.3185 31.9954 30.0618 32.4537 29.6068L34.8204 27.2518C35.7837 26.2952 35.572 24.5518 34.2087 23.8118L31.0254 22.0802C30.1454 21.6035 29.1154 21.7602 28.4754 22.3968L27.717 23.1518L26.8337 22.2652C27.717 23.1518 27.7154 23.1535 27.7137 23.1535L27.712 23.1568L27.707 23.1618L27.6954 23.1718L27.6704 23.1952C27.6 23.2605 27.5242 23.3196 27.4437 23.3718C27.3104 23.4602 27.1337 23.5585 26.912 23.6402C26.462 23.8085 25.8654 23.8985 25.1287 23.7852C23.6837 23.5635 21.7687 22.5785 19.2237 20.0485C16.6804 17.5185 15.687 15.6152 15.4637 14.1718C15.3487 13.4352 15.4404 12.8385 15.6104 12.3885C15.7039 12.1353 15.8379 11.8989 16.007 11.6885L16.0604 11.6302L16.0837 11.6052L16.0937 11.5952L16.0987 11.5902L16.102 11.5868L16.582 11.1102C17.2954 10.3985 17.3954 9.22017 16.7237 8.32184L14.622 5.51517Z"
                  fill="white"
                />
              </svg>

              <div id="contactfooter">062-379-0000</div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M36.6663 10.0003C36.6663 8.16699 35.1663 6.66699 33.333 6.66699H6.66634C4.83301 6.66699 3.33301 8.16699 3.33301 10.0003V30.0003C3.33301 31.8337 4.83301 33.3337 6.66634 33.3337H33.333C35.1663 33.3337 36.6663 31.8337 36.6663 30.0003V10.0003ZM33.333 10.0003L19.9997 18.3337L6.66634 10.0003H33.333ZM33.333 30.0003H6.66634V13.3337L19.9997 21.667L33.333 13.3337V30.0003Z"
                  fill="white"
                />
              </svg>
              <div id="contactfooter">contact@unieed.com</div>
            </div>
            <div className="connect">
              <div>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g clip-path="url(#clip0_2661_754)">
                    <path
                      d="M40.0001 20.1221C40.0001 9.00707 31.0451 -0.00292969 20.0001 -0.00292969C8.95012 -0.000429687 -0.00488281 9.00707 -0.00488281 20.1246C-0.00488281 30.1671 7.31012 38.4921 16.8701 40.0021V25.9396H11.7951V20.1246H16.8751V15.6871C16.8751 10.6446 19.8626 7.85957 24.4301 7.85957C26.6201 7.85957 28.9076 8.25207 28.9076 8.25207V13.2021H26.3851C23.9026 13.2021 23.1276 14.7546 23.1276 16.3471V20.1221H28.6726L27.7876 25.9371H23.1251V39.9996C32.6851 38.4896 40.0001 30.1646 40.0001 20.1221Z"
                      fill="white"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_2661_754">
                      <rect width="40" height="40" fill="white" />
                    </clipPath>
                  </defs>
                </svg>{" "}
              </div>
              <div>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M8.33366 1.66699C6.56555 1.66699 4.86986 2.36937 3.61961 3.61961C2.36937 4.86986 1.66699 6.56555 1.66699 8.33366V31.667C1.66699 33.4351 2.36937 35.1308 3.61961 36.381C4.86986 37.6313 6.56555 38.3337 8.33366 38.3337H31.667C33.4351 38.3337 35.1308 37.6313 36.381 36.381C37.6313 35.1308 38.3337 33.4351 38.3337 31.667V8.33366C38.3337 6.56555 37.6313 4.86986 36.381 3.61961C35.1308 2.36937 33.4351 1.66699 31.667 1.66699H8.33366ZM20.0003 8.06699C13.2153 8.06699 7.50033 12.5403 7.50033 18.2953C7.50033 23.5603 12.2953 27.7587 18.2903 28.4287C18.3936 28.4372 18.4924 28.4747 18.5753 28.537C18.5987 28.5535 18.6182 28.5749 18.6325 28.5996C18.6469 28.6243 18.6558 28.6519 18.6587 28.6803C18.7162 29.5216 18.6051 30.3659 18.332 31.1637C18.2992 31.2498 18.2879 31.3425 18.2991 31.434C18.3102 31.5254 18.3435 31.6128 18.396 31.6885C18.4486 31.7642 18.5188 31.8259 18.6005 31.8683C18.6823 31.9107 18.7732 31.9326 18.8653 31.932C19.0237 31.932 19.2053 31.8837 19.3553 31.8387C19.557 31.7754 19.7556 31.7025 19.9503 31.6203C20.4003 31.4353 20.9737 31.167 21.6237 30.8253C22.9237 30.1453 24.5503 29.162 26.1453 27.952C27.737 26.7437 29.3153 25.2937 30.5003 23.677C31.6837 22.0603 32.5003 20.237 32.5003 18.2953C32.5003 12.5403 26.7853 8.06699 20.0003 8.06699ZM11.1937 21.4203V15.4537H12.8987V19.7153H15.4553V21.4203H11.1937ZM16.307 15.4537V21.4203H18.012V15.4537H16.307ZM18.5803 21.4203V15.4537H20.512L21.9887 18.2253V15.4553H23.6937V21.422H21.7603L20.2853 18.6503V21.4203H18.5803ZM27.9553 15.4537H24.262V21.4203H27.9553V19.717H25.9653V19.292H27.9553V17.5837H25.9653V17.157H27.9553V15.4537Z"
                    fill="white"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
