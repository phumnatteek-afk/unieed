import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faFilter } from "@fortawesome/free-solid-svg-icons";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import "../../../pages/styles/Homepage.css";
import "../styles/MarketPage.css";

// ===== Filter constants (copy มาจาก DonationProject) =====
const SIZE_RANGES = {
  อนุบาล:     { chest: ["20","22","24","26","28"], waist: ["18","20","22","24","26"] },
  ประถมศึกษา: { chest: ["26","28","30","32","34","36"], waist: ["22","24","26","28","30","32"] },
  มัธยมศึกษา: { chest: ["32","34","36","38","40","42","46","48","50","52"], waist: ["26","28","30","32","34","36","38","40","42","44"] },
};
 
const UNIFORM_TYPES = [
  { key: "เสื้อนักเรียน", label: "เสื้อนักเรียน", icon: <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 30.2222C34 32.3085 32.3085 34 30.2222 34H3.77778C1.6915 34 0 32.3085 0 30.2222V3.77778C0 1.6915 1.6915 0 3.77778 0H30.2222C32.3085 0 34 1.6915 34 3.77778V30.2222Z" fill="white"/><path d="M18.2668 33.4857C17.5698 34.1713 16.4308 34.1713 15.7347 33.4857L9.47022 27.3194C8.77417 26.6337 8.59 25.4003 9.06033 24.5767L16.1437 7.15456C16.6149 6.33194 17.3856 6.33194 17.8559 7.15456L24.9393 24.5767C25.4096 25.3993 25.2254 26.6337 24.5294 27.3184L18.2668 33.4857Z" fill="#053F5C"/><path d="M16.9996 13.8535C17.8959 13.8535 18.8923 12.9544 19.7376 11.7842L17.8553 7.15456C17.384 6.33194 16.6134 6.33194 16.143 7.15456L14.2607 11.7842C15.1079 12.9544 16.1034 13.8535 16.9996 13.8535Z" fill="#292F33"/><path d="M21.7228 5.45667C21.7228 7.31156 19.0868 12.1736 17.0005 12.1736C14.9143 12.1736 12.2783 7.31156 12.2783 5.45667C12.2783 3.77273 14.9143 2.83301 17.0005 2.83301C19.0868 2.83301 21.7228 3.77273 21.7228 5.45667Z" fill="#053F5C"/><path d="M0 3.77778V5.90656C1.95878 8.52267 6.40239 13.2269 7.55555 13.2269C9.64183 13.2269 17.9444 3.03072 17.9444 0.944444C17.9444 0 17 0 16.0556 0H3.77778C1.6915 0 0 1.6915 0 3.77778Z" fill="#D9D9D9"/><path d="M16.0547 0.944444C16.0547 3.03072 24.3573 13.2269 26.4436 13.2269C27.5967 13.2269 32.0404 8.52267 33.9991 5.90656V3.77778C33.9991 1.6915 32.3076 0 30.2214 0H17.9436C16.9991 0 16.0547 0 16.0547 0.944444Z" fill="#D9D9D9"/><path d="M3.77677 0C3.5246 0 3.27999 0.0273889 3.04199 0.0746111C4.15927 1.63956 9.97421 2.83333 16.999 2.83333C24.0238 2.83333 29.8387 1.63956 30.956 0.0746111C30.718 0.0273889 30.4734 0 30.2212 0H3.77677Z" fill="#181818" fillOpacity="0.533333"/></svg> },
  { key: "กางเกง", label: "กางเกง", icon: <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"><g clipPath="url(#clip_pants)"><path d="M29.2778 5.66656V1.84628C29.2778 1.34856 28.8736 0.944336 28.3758 0.944336H5.62417C5.12644 0.944336 4.72222 1.34856 4.72222 1.84628V5.66656L0 29.2777L13.2222 33.0554L17 23.0963L20.7778 33.0554L34 29.2777L29.2778 5.66656Z" fill="#8C5543"/><path d="M4.72259 3.77783H29.2782V5.66672H4.72259V3.77783ZM13.0167 5.66672H11.0579C9.75648 9.54556 5.90126 10.7658 3.62515 11.1511L3.22754 13.1411C6.63321 12.7557 11.6331 10.8716 13.0167 5.66672Z" fill="#662113"/><path d="M30.7729 13.1408L30.3753 11.1509C28.0992 10.7656 24.2449 9.54439 22.9426 5.6665H20.9838C22.3664 10.8713 27.3673 12.7555 30.7729 13.1408ZM16.0557 5.6665V25.5858L17.0001 23.0962L17.9446 25.5858V5.6665H16.0557Z" fill="#662113"/><path d="M17.1407 21.7222H17V19.8333H17.1407C18.6263 19.8333 19.8333 18.6263 19.8333 17.1407V4.72217H21.7222V17.1407C21.7222 19.6671 19.6671 21.7222 17.1407 21.7222Z" fill="#662113"/></g><defs><clipPath id="clip_pants"><rect width="34" height="34" fill="white"/></clipPath></defs></svg> },
  { key: "กระโปรง", label: "กระโปรง", icon: <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.8" d="M19.1667 10.5415H26.8334L30.5901 41.5493C28.0822 41.9699 25.543 42.1763 23.0001 42.1665C20.1347 42.1665 17.6085 41.9269 15.4062 41.5493L19.1667 10.5415Z" fill="#053F5C"/><path opacity="0.5" d="M11.1897 10.5415L3.98683 34.4098C3.57283 35.7821 3.98875 37.256 5.24033 38.0054C7.12633 39.1382 10.4479 40.6964 15.4063 41.5493L19.1649 10.5415H11.1897Z" fill="#053F5C"/><path opacity="0.9" d="M40.7595 38.0073C42.0092 37.256 42.427 35.7821 42.013 34.4098L34.8102 10.5415H26.833L30.5897 41.5493C35.5481 40.6983 38.8697 39.1401 40.7595 38.0073Z" fill="#053F5C"/><path d="M30.8755 3.8335H15.1263C13.271 3.8335 12.3433 3.8335 11.7664 4.39508C11.1895 4.95666 11.1895 5.85941 11.1895 7.66683V10.5418H34.8124V7.66683C34.8124 5.85941 34.8124 4.95666 34.2355 4.39508C33.6605 3.8335 32.7309 3.8335 30.8755 3.8335Z" fill="#053F5C"/></svg> },
];
 
const TYPE_COLORS = {
  "เสื้อนักเรียน": { bg: "#87c7eb", hover: "#5285E8" },
  "กางเกง":        { bg: "#E6FFBB", hover: "#5285E8" },
  "กระโปรง":      { bg: "#FFEDBF", hover: "#5285E8" },
};
 
const GENDERS    = ["ชาย", "หญิง"];
const LEVELS     = ["อนุบาล", "ประถมศึกษา", "มัธยมศึกษา"];
const CONDITIONS = ["90%", "80%", "70%", "60%", "50% ขึ้นไป"];
const SORT_OPTIONS = [
  { value: "newest",    label: "ล่าสุด" },
  { value: "price_asc", label: "ราคาต่ำ-สูง" },
  { value: "price_desc",label: "ราคาสูง-ต่ำ" },
  { value: "condition", label: "สภาพดีที่สุด" },
];
 
export default function MarketPage() {
  const { token, userName, logout } = useAuth();
  const navigate = useNavigate();
 
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy]       = useState("newest");
 
  // ===== Filter state =====
  const [searchQ,   setSearchQ]   = useState("");
  const [selType,   setSelType]   = useState("");
  const [selGender, setSelGender] = useState("");
  const [selLevel,  setSelLevel]  = useState("");
  const [selSize,   setSelSize]   = useState("");
  const [selCond,   setSelCond]   = useState("");
  const [hoveredType, setHoveredType] = useState("");
 
  // ===== Load products =====
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson("/home", false);
        setProducts(Array.isArray(data.products) ? data.products : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
 
  // ===== Auto query from filters =====
  const autoQuery = useMemo(() => {
    const parts = [];
    if (selType)   parts.push(selType);
    if (selGender) parts.push(selGender);
    if (selLevel)  parts.push(selLevel);
    if (selSize) {
      const label = selType === "เสื้อนักเรียน" ? `อก ${selSize}` : `เอว ${selSize}`;
      parts.push(label);
    }
    if (selCond) parts.push(`สภาพ ${selCond}`);
    return parts.join(" ");
  }, [selType, selGender, selLevel, selSize, selCond]);
 
  // ===== Available sizes (เหมือน DonationProject) =====
  const availableSizes = useMemo(() => {
    if (!selLevel) {
      if (!selType) return [];
      const all = new Set();
      Object.values(SIZE_RANGES).forEach(r => {
        const arr = selType === "เสื้อนักเรียน" ? r.chest : r.waist;
        arr.forEach(s => all.add(s));
      });
      return [...all].sort((a, b) => Number(a) - Number(b));
    }
    const r = SIZE_RANGES[selLevel];
    if (!r) return [];
    return selType === "เสื้อนักเรียน" ? r.chest : r.waist;
  }, [selType, selLevel]);
 
  const sizeLabel = selType === "เสื้อนักเรียน" ? "รอบอก (นิ้ว)" : selType ? "รอบเอว (นิ้ว)" : "ไซส์";
 
  // ===== Filter + Sort =====
  const displayProducts = useMemo(() => {
    const q = (searchQ || autoQuery).toLowerCase().trim();
    let list = [...products];
 
    if (q) {
      list = list.filter(p =>
        (p.product_title || "").toLowerCase().includes(q) ||
        (p.size_label || "").toLowerCase().includes(q) ||
        (p.condition || "").toLowerCase().includes(q) ||
        (p.school_name || "").toLowerCase().includes(q)
      );
    }
 
    list.sort((a, b) => {
      if (sortBy === "price_asc")  return (a.price || 0) - (b.price || 0);
      if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sortBy === "condition")  return (b.condition_percent || 0) - (a.condition_percent || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
 
    return list;
  }, [products, searchQ, autoQuery, sortBy]);
 
  useEffect(() => { setSelSize(""); }, [selType, selLevel]);
 
  // ===== rightAccount =====
  const rightAccount = () => {
    if (!token) {
      return (
        <div className="navAuth">
          <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
          <Link className="navBtn navBtnWhite" to="/login">เข้าสู่ระบบ</Link>
        </div>
      );
    }
    return <ProfileDropdown />;
  };
 
  return (
    <div className="homePage">
 
      {/* ===== Header ===== */}
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>
          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/projects">โครงการ</Link>
            <Link to="/market" className="active">ร้านค้า</Link>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><Link to="/sell" className="sell">ลงขาย</Link></button>
          </nav>
          {rightAccount()}
        </div>
      </header>
 
      {/* ===== Hero Banner ===== */}
      <div className="mkHero">
        <div className="mkHeroOverlay" />
        <div className="mkHeroContent">
          <h1 className="mkHeroTitle">ตลาดชุดนักเรียนมือสอง</h1>
          <p className="mkHeroSub">ซื้อ-ขายราคาประหยัด เข้าถึงชุดนักเรียนได้อย่างเท่าเทียม</p>
          <div className="mkHeroBtns">
            <button className="mkHeroBtn mkHeroBtnYellow" onClick={() => document.getElementById("mk-products")?.scrollIntoView({ behavior: "smooth" })}>
              <svg width="22" height="22" viewBox="0 0 59 60" fill="none"><path d="M53.4689 36.3636H16.5938L12.9062 14.5454H57.1564L53.4689 36.3636Z" fill="#CCD6DD"/><path d="M57.1269 45.4545H16.5643C14.5472 45.4545 12.9063 43.8345 12.9063 41.8473C12.9063 39.86 14.5767 38.1818 16.5938 38.1818L16.6067 38.18L16.6215 38.1818H53.4689C54.3705 38.1818 55.1394 37.5382 55.2869 36.6618L58.9744 14.8436C59.0647 14.3164 58.9135 13.7782 58.5614 13.3691C58.2129 12.9618 57.6985 12.7273 57.1564 12.7273H14.4126L12.4951 1.51636C12.3495 0.656364 11.6028 0.0763636 10.7583 0.0363636C10.7288 0.0309091 10.7085 0 10.679 0H1.84376C0.826003 0 0 0.814546 0 1.81818C0 2.82182 0.826003 3.63636 1.84376 3.63636H9.11922L14.4716 34.9382C11.4442 35.8345 9.21878 38.5745 9.21878 41.8473C9.21878 45.8418 12.5154 49.0909 16.5643 49.0909H57.1269C58.1465 49.0909 58.9707 48.2782 58.9707 47.2727C58.9707 46.2673 58.1465 45.4545 57.1269 45.4545Z" fill="#66757F"/></svg>
              เลือกซื้อราคาประหยัด
            </button>
            <Link to="/sell" className="mkHeroBtn mkHeroBtnOutline">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              ลงขายสินค้าที่นี่
            </Link>
            
          </div>
          
        </div>
        <div className="mkHero">
            <img src="/src/unieed_pic/Banmarket1.png" className="mkHeroBg" />
        </div>  
      </div>
      
 
      {/* ===== Search + Filter ===== */}
      <div className="mkSearchSection">
        <div className="mkSearchRow">
          <div className="mkSearchBox">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="mkSearchIcon" />
            <input
              value={searchQ || autoQuery}
              onChange={e => {
                setSearchQ(e.target.value);
                if (!e.target.value) {
                  setSelType(""); setSelGender(""); setSelLevel("");
                  setSelSize(""); setSelCond("");
                }
              }}
              placeholder="ค้นหาสินค้า ระบุประเภท ขนาด ที่ต้องการหา..."
            />
          </div>
          <button
            className={`mkFilterBtn ${showFilter ? "mkFilterBtnActive" : ""}`}
            onClick={() => setShowFilter(f => !f)}
          >
            <FontAwesomeIcon icon={faFilter} />
          </button>
        </div>
 
        {/* Filter Panel */}
        <div className={`mkFilterPanel ${showFilter ? "mkFilterPanelOpen" : ""}`}>
          <div className="mkFilterLabel">คุณต้องการซื้ออะไร?</div>
          <div className="mkFilterGrid">
 
            <div className="mkFilterGroup">
              <div className="mkFilterGroupLabel">ประเภทชุด</div>
              <div className="mkTypeRow">
                {UNIFORM_TYPES.map(t => (
                  <div key={t.key} className="mkTypeBtnWrap">
                    <button
                      style={{
                        background: selType === t.key
                          ? TYPE_COLORS[t.key]?.hover
                          : hoveredType === t.key
                            ? TYPE_COLORS[t.key]?.hover
                            : TYPE_COLORS[t.key]?.bg || "#87c7eb"
                      }}
                      className={`mkTypeBtn ${selType === t.key ? "mkTypeBtnActive" : ""}`}
                      onMouseEnter={() => setHoveredType(t.key)}
                      onMouseLeave={() => setHoveredType("")}
                      onClick={() => {
                        const newType = selType === t.key ? "" : t.key;
                        setSelType(newType);
                        if (newType === "กระโปรง") setSelGender("หญิง");
                        else if (newType === "กางเกง") setSelGender("ชาย");
                        else setSelGender("");
                      }}
                    >
                      <span className="mkTypeIcon">{t.icon}</span>
                    </button>
                    <span className="mkTypeLabel">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
 
            <div className="mkFilterGroup">
              <div className="mkFilterGroupNarrow">
                <div className="mkFilterGroupLabel">เพศ</div>
              </div>
              <select className="mkSelect" value={selGender} onChange={e => setSelGender(e.target.value)}>
                <option value="">เพศ</option>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
 
            <div className="mkFilterGroup">
              <div className="mkFilterGroupNarrow">
                <div className="mkFilterGroupLabel">ระดับชั้น</div>
              </div>
              <select className="mkSelect" value={selLevel} onChange={e => setSelLevel(e.target.value)}>
                <option value="">ระดับชั้น</option>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
 
            <div className="mkFilterGroup">
              <div className="mkFilterGroupNarrow">
                <div className="mkFilterGroupLabel">{sizeLabel}</div>
              </div>
              <select className="mkSelect" value={selSize} onChange={e => setSelSize(e.target.value)} disabled={!selType}>
                <option value="">{selType ? sizeLabel : "เลือกประเภทก่อน"}</option>
                {availableSizes.map(s => <option key={s} value={s}>{s}"</option>)}
              </select>
            </div>
 
            <div className="mkFilterGroup">
              <div className="mkFilterGroupNarrow">
                <div className="mkFilterGroupLabel">สภาพ</div>
              </div>
              <select className="mkSelect" value={selCond} onChange={e => setSelCond(e.target.value)}>
                <option value="">สภาพ</option>
                {CONDITIONS.map(c => <option key={c} value={c}>สภาพ {c}</option>)}
              </select>
            </div>
 
          </div>
 
          {(selType || selGender || selLevel || selSize || selCond) && (
            <button className="mkResetBtn" onClick={() => {
              setSelType(""); setSelGender(""); setSelLevel("");
              setSelSize(""); setSelCond(""); setSearchQ("");
            }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>
 
      {/* ===== Product List ===== */}
      <div className="mkMain" id="mk-products">
        <div className="mkListHeader">
          <h2 className="mkListTitle">ตลาดชุดนักเรียนมือสอง</h2>
          <select className="mkSortSelect" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>เรียงตาม : {o.label}</option>
            ))}
          </select>
        </div>
 
        {loading ? (
          <div className="muted" style={{ textAlign: "center", padding: "60px" }}>กำลังโหลด…</div>
        ) : !displayProducts.length ? (
          <div className="muted" style={{ textAlign: "center", padding: "60px" }}>ไม่พบสินค้าที่ตรงกับเงื่อนไข</div>
        ) : (
          <div className="mkGrid">
            {displayProducts.map(x => (
              <div className="mkCard" key={x.product_id}>
                <div className="mkCardThumb">
                  {x.cover_image
                    ? <img src={x.cover_image} alt={x.product_title} />
                    : <div className="mkCardThumbPlaceholder" />}
                </div>
                <div className="mkCardBody">
                  <div className="mkCardTitle">{x.product_title}</div>
                  <div className="mkCardSchool">{x.school_name || ""}</div>
                  <div className="mkCardMeta">
                    {x.size_label && <span>Size : {x.size_label}</span>}
                    {x.condition_percent && <span>สภาพ : {x.condition_percent}% {x.condition || ""}</span>}
                  </div>
                  <div className="mkCardBottom">
                    <div className="mkCardPrice">{Number(x.price || 0).toLocaleString()} <span>บาท</span></div>
                    <button className="mkCartBtn" type="button" aria-label="cart">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
 
        {displayProducts.length > 0 && (
          <div style={{ textAlign: "center", margin: "40px 0" }}>
            <button className="btnGhost" style={{ padding: "0 48px", height: "48px", fontSize: "18px" }}>
              ดูทั้งหมด
            </button>
          </div>
        )}
      </div>
 
      {/* ===== Footer ===== */}
      <footer id="about" className="footer">
        <div className="footerInner">
          <div className="footBrand">
            <div>
              <Link to="/" onClick={() => window.scrollTo(0, 0)}>
                <img className="footLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
              </Link>
              <div className="footDesc">
                แพลตฟอร์มส่งต่อแบ่งปันชุดนักเรียน<br />
                เพื่อมอบโอกาสทางการศึกษาให้กับนักเรียน
              </div>
            </div>
          </div>
          <div className="footCol">
            <div className="footTitle">เมนูลัด</div>
            <Link to="/">หน้าหลัก</Link>
            <Link to="/projects">โครงการ</Link>
            <Link to="/market">ร้านค้า</Link>
            <Link to="/sell">ลงขาย</Link>
            <a href="#about">เกี่ยวกับเรา</a>
          </div>
          <div className="footCol">
            <div className="footTitle">ติดต่อเรา</div>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9.55537 3.40517C11.5837 1.3885 14.9237 1.74684 16.622 4.01684L18.7254 6.8235C20.1087 8.67017 19.9854 11.2502 18.3437 12.8818L17.947 13.2785C17.9021 13.445 17.8975 13.6199 17.9337 13.7885C18.0387 14.4685 18.607 15.9085 20.987 18.2752C23.367 20.6418 24.817 21.2085 25.507 21.3152C25.6809 21.3501 25.8605 21.345 26.032 21.3002L26.712 20.6235C28.172 19.1735 30.412 18.9018 32.2187 19.8835L35.402 21.6168C38.1304 23.0968 38.8187 26.8035 36.5854 29.0252L34.217 31.3785C33.4704 32.1202 32.467 32.7385 31.2437 32.8535C28.227 33.1352 21.1987 32.7752 13.8104 25.4302C6.91537 18.5735 5.59204 12.5935 5.4237 9.64684C5.34037 8.15684 6.0437 6.89684 6.94037 6.00684L9.55537 3.40517ZM14.622 5.51517C13.777 4.38684 12.2037 4.29684 11.317 5.1785L8.70037 7.7785C8.15037 8.32517 7.88704 8.9285 7.92037 9.50517C8.0537 11.8468 9.12037 17.2418 15.5737 23.6585C22.3437 30.3885 28.5954 30.5902 31.012 30.3635C31.5054 30.3185 31.9954 30.0618 32.4537 29.6068L34.8204 27.2518C35.7837 26.2952 35.572 24.5518 34.2087 23.8118L31.0254 22.0802C30.1454 21.6035 29.1154 21.7602 28.4754 22.3968L27.717 23.1518L26.8337 22.2652C27.717 23.1518 27.7154 23.1535 27.7137 23.1535L27.712 23.1568L27.707 23.1618L27.6954 23.1718L27.6704 23.1952C27.6 23.2605 27.5242 23.3196 27.4437 23.3718C27.3104 23.4602 27.1337 23.5585 26.912 23.6402C26.462 23.8085 25.8654 23.8985 25.1287 23.7852C23.6837 23.5635 21.7687 22.5785 19.2237 20.0485C16.6804 17.5185 15.687 15.6152 15.4637 14.1718C15.3487 13.4352 15.4404 12.8385 15.6104 12.3885C15.7039 12.1353 15.8379 11.8989 16.007 11.6885L16.0604 11.6302L16.0837 11.6052L16.0937 11.5952L16.0987 11.5902L16.102 11.5868L16.582 11.1102C17.2954 10.3985 17.3954 9.22017 16.7237 8.32184L14.622 5.51517Z" fill="white"/></svg>
              <div id="contactfooter">062-379-0000</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M36.6663 10.0003C36.6663 8.16699 35.1663 6.66699 33.333 6.66699H6.66634C4.83301 6.66699 3.33301 8.16699 3.33301 10.0003V30.0003C3.33301 31.8337 4.83301 33.3337 6.66634 33.3337H33.333C35.1663 33.3337 36.6663 31.8337 36.6663 30.0003V10.0003ZM33.333 10.0003L19.9997 18.3337L6.66634 10.0003H33.333ZM33.333 30.0003H6.66634V13.3337L19.9997 21.667L33.333 13.3337V30.0003Z" fill="white"/></svg>
              <div id="contactfooter">contact@unieed.com</div>
            </div>
            <div className="connect">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><g clipPath="url(#fb)"><path d="M40 20.1221C40 9.00707 31.045 -0.003 20 -0.003C8.95 -0.0005 -0.005 9.00707 -0.005 20.1246C-0.005 30.1671 7.31 38.4921 16.87 40.0021V25.9396H11.795V20.1246H16.875V15.6871C16.875 10.6446 19.8625 7.85957 24.43 7.85957C26.62 7.85957 28.9075 8.25207 28.9075 8.25207V13.2021H26.385C23.9025 13.2021 23.1275 14.7546 23.1275 16.3471V20.1221H28.6725L27.7875 25.9371H23.125V39.9996C32.685 38.4896 40 30.1646 40 20.1221Z" fill="white"/></g><defs><clipPath id="fb"><rect width="40" height="40" fill="white"/></clipPath></defs></svg>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M8.33366 1.66699C6.56555 1.66699 4.86986 2.36937 3.61961 3.61961C2.36937 4.86986 1.66699 6.56555 1.66699 8.33366V31.667C1.66699 33.4351 2.36937 35.1308 3.61961 36.381C4.86986 37.6313 6.56555 38.3337 8.33366 38.3337H31.667C33.4351 38.3337 35.1308 37.6313 36.381 36.381C37.6313 35.1308 38.3337 33.4351 38.3337 31.667V8.33366C38.3337 6.56555 37.6313 4.86986 36.381 3.61961C35.1308 2.36937 33.4351 1.66699 31.667 1.66699H8.33366ZM20.0003 8.06699C13.2153 8.06699 7.50033 12.5403 7.50033 18.2953C7.50033 23.5603 12.2953 27.7587 18.2903 28.4287C18.5753 28.537 18.5987 28.5535 18.6182 28.5749C18.6325 28.5996 18.6469 28.6243 18.6558 28.6519C18.6587 28.6803 18.7162 29.5216 18.6051 30.3659C18.332 31.1637 18.2992 31.2498 18.2879 31.3425C18.3102 31.5254 18.3435 31.6128 18.396 31.6885C18.4486 31.7642 18.5188 31.8259 18.6005 31.8683C18.6823 31.9107 18.7732 31.9326 18.8653 31.932C19.0237 31.932 19.2053 31.8837 19.3553 31.8387C19.557 31.7754 19.7556 31.7025 19.9503 31.6203C20.4003 31.4353 20.9737 31.167 21.6237 30.8253C22.9237 30.1453 24.5503 29.162 26.1453 27.952C27.737 26.7437 29.3153 25.2937 30.5003 23.677C31.6837 22.0603 32.5003 20.237 32.5003 18.2953C32.5003 12.5403 26.7853 8.06699 20.0003 8.06699ZM11.1937 21.4203V15.4537H12.8987V19.7153H15.4553V21.4203H11.1937ZM16.307 15.4537V21.4203H18.012V15.4537H16.307ZM18.5803 21.4203V15.4537H20.512L21.9887 18.2253V15.4553H23.6937V21.422H21.7603L20.2853 18.6503V21.4203H18.5803ZM27.9553 15.4537H24.262V21.4203H27.9553V19.717H25.9653V19.292H27.9553V17.5837H25.9653V17.157H27.9553V15.4537Z" fill="white"/></svg>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}