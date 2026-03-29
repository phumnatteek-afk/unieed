// src/features/market/pages/MarketPage.jsx
// ── API endpoint เปลี่ยนจาก /api/products → /api/market
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faFilter } from "@fortawesome/free-solid-svg-icons";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import "../../../pages/styles/Homepage.css";
import "../styles/MarketPage.css";

const UNIFORM_TYPES = [
  { key: "shirt_m", category_id: 1, gender: "male",   type_name: "เสื้อนักเรียนชาย",  icon: <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M34 30.2222C34 32.3085 32.3085 34 30.2222 34H3.77778C1.6915 34 0 32.3085 0 30.2222V3.77778C0 1.6915 1.6915 0 3.77778 0H30.2222C32.3085 0 34 1.6915 34 3.77778V30.2222Z" fill="white"/>
<path d="M18.2668 33.4857C17.5698 34.1713 16.4308 34.1713 15.7347 33.4857L9.47022 27.3194C8.77417 26.6337 8.59 25.4003 9.06033 24.5767L16.1437 7.15456C16.6149 6.33194 17.3856 6.33194 17.8559 7.15456L24.9393 24.5767C25.4096 25.3993 25.2254 26.6337 24.5294 27.3184L18.2668 33.4857Z" fill="#053F5C"/>
<path d="M16.9996 13.8535C17.8959 13.8535 18.8923 12.9544 19.7376 11.7842L17.8553 7.15456C17.384 6.33194 16.6134 6.33194 16.143 7.15456L14.2607 11.7842C15.1079 12.9544 16.1034 13.8535 16.9996 13.8535Z" fill="#292F33"/>
<path d="M21.7228 5.45667C21.7228 7.31156 19.0868 12.1736 17.0005 12.1736C14.9143 12.1736 12.2783 7.31156 12.2783 5.45667C12.2783 3.77273 14.9143 2.83301 17.0005 2.83301C19.0868 2.83301 21.7228 3.77273 21.7228 5.45667Z" fill="#053F5C"/>
<path d="M0 3.77778V5.90656C1.95878 8.52267 6.40239 13.2269 7.55555 13.2269C9.64183 13.2269 17.9444 3.03072 17.9444 0.944444C17.9444 0 17 0 16.0556 0H3.77778C1.6915 0 0 1.6915 0 3.77778Z" fill="#D9D9D9"/>
<path d="M16.0547 0.944444C16.0547 3.03072 24.3573 13.2269 26.4436 13.2269C27.5967 13.2269 32.0404 8.52267 33.9991 5.90656V3.77778C33.9991 1.6915 32.3076 0 30.2214 0H17.9436C16.9991 0 16.0547 0 16.0547 0.944444Z" fill="#D9D9D9"/>
<path d="M3.77677 0C3.5246 0 3.27999 0.0273889 3.04199 0.0746111C4.15927 1.63956 9.97421 2.83333 16.999 2.83333C24.0238 2.83333 29.8387 1.63956 30.956 0.0746111C30.718 0.0273889 30.4734 0 30.2212 0H3.77677Z" fill="#181818" fill-opacity="0.533333"/>
</svg> },
  { key: "shirt_f", category_id: 1, gender: "female", type_name: "เสื้อนักเรียนหญิง", icon: <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M34 30.2222C34 32.3085 32.3085 34 30.2222 34H3.77778C1.6915 34 0 32.3085 0 30.2222V3.77778C0 1.6915 1.6915 0 3.77778 0H30.2222C32.3085 0 34 1.6915 34 3.77778V30.2222Z" fill="#FBF0F0"/>
<path d="M18.2665 33.4853C17.5695 34.1709 16.4305 34.1709 15.7344 33.4853L9.46994 27.319C8.77389 26.6333 8.58972 25.3999 9.06005 24.5763L16.1434 7.15417C16.6147 6.33156 17.3853 6.33156 17.8557 7.15417L24.939 24.5763C25.4093 25.3989 25.2252 26.6333 24.5291 27.3181L18.2665 33.4853Z" fill="#FF88C2"/>
<path d="M17 13.8531C17.8963 13.8531 18.8927 12.954 19.7379 11.7838L17.8557 7.15417C17.3844 6.33156 16.6137 6.33156 16.1434 7.15417L14.2611 11.7838C15.1083 12.954 16.1037 13.8531 17 13.8531Z" fill="#A0041E"/>
<path d="M21.7222 5.457C21.7222 7.31189 19.0863 12.1739 17 12.1739C14.9137 12.1739 12.2778 7.31189 12.2778 5.457C12.2778 3.77305 14.9137 2.83333 17 2.83333C19.0863 2.83333 21.7222 3.77305 21.7222 5.457Z" fill="#FF88C2"/>
<path d="M0 3.77778V5.90656C1.95878 8.52267 6.40239 13.2269 7.55556 13.2269C9.64183 13.2269 17.9444 3.03072 17.9444 0.944444C17.9444 0 17 0 16.0556 0H3.77778C1.6915 0 0 1.6915 0 3.77778Z" fill="#B5B5B5"/>
<path d="M16.0556 0.944444C16.0556 3.03072 24.3582 13.2269 26.4444 13.2269C27.5976 13.2269 32.0412 8.52267 34 5.90656V3.77778C34 1.6915 32.3085 0 30.2222 0H17.9444C17 0 16.0556 0 16.0556 0.944444Z" fill="#B5B5B5"/>
<path d="M3.77778 0C3.52561 0 3.281 0.0273889 3.043 0.0746111C4.16028 1.63956 9.97522 2.83333 17 2.83333C24.0248 2.83333 29.8397 1.63956 30.957 0.0746111C30.719 0.0273889 30.4744 0 30.2222 0H3.77778Z" fill="#383838"/>
</svg>
 },
  { key: "pants",   category_id: 2, gender: null,     type_name: "กางเกงนักเรียน",     icon: <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_2847_991)">
<path d="M29.2778 5.66656V1.84628C29.2778 1.34856 28.8736 0.944336 28.3758 0.944336H5.62417C5.12644 0.944336 4.72222 1.34856 4.72222 1.84628V5.66656L0 29.2777L13.2222 33.0554L17 23.0963L20.7778 33.0554L34 29.2777L29.2778 5.66656Z" fill="#8C5543"/>
<path d="M4.72259 3.77783H29.2782V5.66672H4.72259V3.77783ZM13.0167 5.66672H11.0579C9.75648 9.54556 5.90126 10.7658 3.62515 11.1511L3.22754 13.1411C6.63321 12.7557 11.6331 10.8716 13.0167 5.66672Z" fill="#662113"/>
<path d="M30.7729 13.1408L30.3753 11.1509C28.0992 10.7656 24.2449 9.54439 22.9426 5.6665H20.9838C22.3664 10.8713 27.3673 12.7555 30.7729 13.1408ZM16.0557 5.6665V25.5858L17.0001 23.0962L17.9446 25.5858V5.6665H16.0557Z" fill="#662113"/>
<path d="M17.1407 21.7222H17V19.8333H17.1407C18.6263 19.8333 19.8333 18.6263 19.8333 17.1407V4.72217H21.7222V17.1407C21.7222 19.6671 19.6671 21.7222 17.1407 21.7222Z" fill="#662113"/>
</g>
<defs>
<clipPath id="clip0_2847_991">
<rect width="34" height="34" fill="white"/>
</clipPath>
</defs>
</svg> },
  { key: "skirt",   category_id: 3, gender: null,     type_name: "กระโปรงนักเรียน",    icon: <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
<path opacity="0.8" d="M19.1667 10.5415H26.8334L30.5901 41.5493C28.0822 41.9699 25.543 42.1763 23.0001 42.1665C20.1347 42.1665 17.6085 41.9269 15.4062 41.5493L19.1667 10.5415Z" fill="#053F5C"/>
<path opacity="0.5" d="M11.1897 10.5415L3.98683 34.4098C3.57283 35.7821 3.98875 37.256 5.24033 38.0054C7.12633 39.1382 10.4479 40.6964 15.4063 41.5493L19.1649 10.5415H11.1897Z" fill="#053F5C"/>
<path opacity="0.9" d="M40.7595 38.0073C42.0092 37.256 42.427 35.7821 42.013 34.4098L34.8102 10.5415H26.833L30.5897 41.5493C35.5481 40.6983 38.8697 39.1401 40.7595 38.0073Z" fill="#053F5C"/>
<path d="M30.8755 3.8335H15.1263C13.271 3.8335 12.3433 3.8335 11.7664 4.39508C11.1895 4.95666 11.1895 5.85941 11.1895 7.66683V10.5418H34.8124V7.66683C34.8124 5.85941 34.8124 4.95666 34.2355 4.39508C33.6605 3.8335 32.7309 3.8335 30.8755 3.8335Z" fill="#053F5C"/>
</svg> },
];
const SORT_OPTIONS = [
  { value: "newest",     label: "ใหม่ล่าสุด" },
  { value: "price_asc",  label: "ราคา: น้อย → มาก" },
  { value: "price_desc", label: "ราคา: มาก → น้อย" },
];
const LEVELS = ["","อนุบาล","ประถมศึกษา","มัธยมต้น","มัธยมปลาย"];

const TYPE_COLORS = {
  "เสื้อนักเรียนชาย": {bg: "#87c7eb", hover: "#5285E8"},
  "เสื้อนักเรียนหญิง": {bg: "#FFB6C1", hover: "#5285E8"},
  "กางเกงนักเรียน": {bg:"#E6FFBB", hover: "#5285E8"},
  "กระโปรงนักเรียน": {bg:"#FFEDBF", hover: "#5285E8"},
};

// ── Image Carousel ────────────────────────────────────
function CardCarousel({ images = [], title, quantity }) {
  console.log('CardCarousel quantity:', quantity, 'images:', images.length);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [images]);

  // ← ย้าย badge ออกมานอก เพื่อแสดงแม้ไม่มีรูป
  const stockBadge = quantity > 0 && (
    <span className="mkStockBadge">{quantity} ชิ้น</span>
  );

  if (!images.length) return (
    <div className="mkCarouselWrap">
      <div className="mkCarouselMain" style={{ position: 'relative' }}>
        <div className="mkCardThumbPlaceholder" />
        {stockBadge}
      </div>
    </div>
  );

  return (
    <div className="mkCarouselWrap" style={{ position: 'relative' }}>
       {quantity > 0 && (
      <span className="mkStockBadge">{quantity} ชิ้น</span>
    )}
      <div className="mkCarouselMain" >
      
        <img
          src={images[idx]?.image_url}
          alt={title}
          className="mkCarouselImg"
          loading="lazy"
        />
        {stockBadge}
        {images.length > 1 && (
          <>
            <button className="mkCarouselArrow mkCarouselArrowLeft"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}>
              <Icon icon="mdi:chevron-left" />
            </button>
            <button className="mkCarouselArrow mkCarouselArrowRight"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}>
              <Icon icon="mdi:chevron-right" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mkCarouselThumbs">
          {images.map((img, i) => (
            <div key={i}
              className={`mkCarouselThumb${i === idx ? ' mkCarouselThumbActive' : ''}`}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setIdx(i); }}>
              <img src={img.image_url} alt={`${title} ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ── Product Card ──────────────────────────────────────
function SizeDisplay({ size, categoryId }) {
  if (!size) return null;
  try {
    const s    = JSON.parse(size);
    const cid  = Number(categoryId);
    const parts = [];
    if (cid === 1) {
      if (s.chest  && s.chest  !== '0') parts.push({ label: 'อก',  val: s.chest });
      if (s.length && s.length !== '0') parts.push({ label: 'ยาว', val: s.length });
    } else {
      if (s.waist  && s.waist  !== '0') parts.push({ label: 'เอว', val: s.waist });
      if (s.length && s.length !== '0') parts.push({ label: 'ยาว', val: s.length });
    }
    if (!parts.length) return null;
    return (
      <div className="mkMetaRow">
        <span className="mkMetaLabel">ขนาด</span>
        <span className="mkMetaVal">
          {parts.map((p, i) => (
            <span key={i}>
              {i > 0 && <span className="mkMetaSep">|</span>}
              {p.label} {p.val}
            </span>
          ))}
        </span>
      </div>
    );
  } catch {
    return (
      <div className="mkMetaRow">
        <span className="mkMetaLabel">ขนาด</span>
        <span className="mkMetaVal">{size}</span>
      </div>
    );
  }
}

function ProductCard({ product }) {
  const navigate = useNavigate();

  const images = product.images?.length
    ? product.images
    : product.cover_image
      ? [{ image_url: product.cover_image }]
      : [];

  const categoryLabel = (() => {
  const cid = Number(product.category_id);
  if (cid === 1) return product.gender === 'male' ? 'เสื้อนักเรียนชาย' : 'เสื้อนักเรียนหญิง';
  if (cid === 2) return 'กางเกงนักเรียน';
  if (cid === 3) return 'กระโปรงนักเรียน';
  if (cid === 4) return 'ชุดนักเรียน';
  return 'ชุดนักเรียน';
})();

const typePart = product.type_name?.trim() || product.custom_type_name?.trim();
const displayTitle = typePart
  ? `${categoryLabel}: ${typePart}`
  : categoryLabel;

  const cardColor = TYPE_COLORS[categoryLabel]?.bg || "#f0f0f0";

  return (
    <div className="mkCard">
      {/* carousel ไม่มี Link ห่อ → กดลูกศรไม่เด้ง */}
      <div className="mkCardThumb">
        <CardCarousel images={images} title={displayTitle} quantity={product.quantity} />
      </div>
      {/* body คลิกแล้วไปหน้าสินค้า */}
      <div
        className="mkCardBody"
        onClick={() => navigate(`/market/${product.product_id}`)}
        style={{ cursor: 'pointer' }}
      >
        <div className="mkCardTitle">{displayTitle}</div>
        {product.school_name && (
          <div className="mkCardSchool">
            <Icon icon="mdi:school-outline" /> {product.school_name}
          </div>
        )}
        <div className="mkMeta">
          {product.level && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">ระดับ</span>
              <span className="mkMetaVal">
                <span className="mkBadgeLevel">{product.level}</span>
              </span>
            </div>
          )}
          <SizeDisplay size={product.size} categoryId={product.category_id} />
          {(product.condition_percent || product.condition_label) && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">สภาพ</span>
              <span className="mkMetaVal">
                <span className="mkBadgeCond">
                  {[
                    product.condition_percent ? `${product.condition_percent}%` : null,
                    product.condition_label
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
            </div>
          )}
        </div>
        <div className="mkCardDivider" />
        <div className="mkCardBottom">
          <div className="mkCardPrice">
            {Number(product.price).toLocaleString()}<span> บาท</span>
          </div>
          <button
            className="mkCartBtn"
            onClick={e => e.stopPropagation()}
            aria-label="เพิ่มลงตะกร้า"
          >
            <Icon icon="mdi:cart-plus" />
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Main Page ─────────────────────────────────────────
export default function MarketPage() {
  const { token }  = useAuth();
  const location   = useLocation();

  const [toast,         setToast]         = useState(location.state?.successMsg || "");
  const [search,        setSearch]        = useState("");
  const [activeFilter, setActiveFilter] = useState(null);
  const [level,         setLevel]         = useState("");
  const [minPrice,      setMinPrice]      = useState("");
  const [maxPrice,      setMaxPrice]      = useState("");
  const [sort,          setSort]          = useState("newest");
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [products,      setProducts]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalCount,    setTotalCount]    = useState(0);

  const [displaySearch, setDisplaySearch] = useState("");
  const [typedKeyword,  setTypedKeyword]  = useState("");

  const buildDisplayText = useCallback((filter, lvl, typed) => {
  const parts = [];
  // ถ้ามีการเลือกประเภทปุ่มวงกลม


  if (filter) {
    const typeObj = UNIFORM_TYPES.find(t => t.key === filter.key);
    if (typeObj) parts.push(typeObj.type_name);
  }
  // ถ้ามีการเลือกระดับชั้นใน select
  if (lvl) parts.push(lvl);
  // สิ่งที่ user พิมพ์เอง
  if (typed) parts.push(typed);
  
  return parts.join(' ').trim();
}, []);

  // const handleTypeToggle = (typeObj) => {
  // const isSame = activeFilter?.key === typeObj.key;
  // const newFilter = isSame ? null : typeObj;
  const handleTypeToggle = (typeObj) => {
  const isSame = activeFilter?.key === typeObj.key;
  const newFilter = isSame ? null : typeObj;
  setActiveFilter(newFilter);
  
  // สร้างข้อความที่จะแสดงในช่อง Search โดยเอาสิ่งที่เคยพิมพ์ค้างไว้ (typedKeyword) มาต่อท้าย
  const newDisplay = buildDisplayText(newFilter, level, typedKeyword);
  setDisplaySearch(newDisplay);
  
  fetchProducts(1, { activeFilter: newFilter });
};

const handleLevelChange = (e) => {
  const newLevel = e.target.value;
  setLevel(newLevel);
  
  const newDisplay = buildDisplayText(activeFilter, newLevel, typedKeyword);
  setDisplaySearch(newDisplay);
  
  fetchProducts(1, { level: newLevel });
};
const handleSearchInput = (e) => {
  const val = e.target.value;
  setDisplaySearch(val); // แสดงค่าที่พิมพ์ในกล่อง
  setTypedKeyword(val);  // เก็บค่าที่พิมพ์จริง
  setSearch(val);        // ค่านี้จะถูกส่งไป API

  // Debounce การค้นหา
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    fetchProducts(1, { search: val }); // ส่งค่าที่พิมพ์ไป API ทันที
  }, 400);
};

  const LIMIT = 12;

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // GET /api/market
const fetchProductsRef = useRef(null);

fetchProductsRef.current = async (p = 1, overrides = {}) => {
  setLoading(true);
  try {
    // ดึงค่าจาก overrides ถ้ามี ถ้าไม่มีให้ใช้จาก state
    const currentFilter = overrides.activeFilter !== undefined ? overrides.activeFilter : activeFilter;
    const currentLevel  = overrides.level  !== undefined ? overrides.level  : level;
    const currentSearch = overrides.search !== undefined ? overrides.search : search;
    const currentMinPrice = overrides.minPrice !== undefined ? overrides.minPrice : minPrice;
    const currentMaxPrice = overrides.maxPrice !== undefined ? overrides.maxPrice : maxPrice;
    
    // เพิ่มบรรทัดนี้: รองรับการเปลี่ยน Sort ทันที
    const currentSort = overrides.sort !== undefined ? overrides.sort : sort;

    const params = new URLSearchParams({
      page: p, 
      limit: LIMIT, 
      sort: currentSort, // ใช้ค่า currentSort ที่ผ่านการเช็คแล้ว
      ...(currentSearch && { search: currentSearch }),
      ...(currentFilter?.category_id && { category_id: currentFilter.category_id }),
      ...(currentFilter && currentFilter.gender !== null && { gender: currentFilter.gender }),
      ...(currentLevel && { level: currentLevel }),
      ...(currentMinPrice && { min_price: currentMinPrice }),
      ...(currentMaxPrice && { max_price: currentMaxPrice }),
    });

    console.log('URL:', `/api/market?${params.toString()}`);

    const res  = await fetch(`/api/market?${params}`);
    const data = await res.json();
    
    setProducts(p === 1 ? (data.products || []) : prev => [...prev, ...(data.products || [])]);
    setTotalPages(data.pagination?.pages || 1);
    setTotalCount(data.pagination?.total || 0);
    setPage(p);
  } catch (e) {
    console.error("Fetch Error:", e);
  } finally {
    setLoading(false);
  }
};

const fetchProducts = useCallback((...args) => fetchProductsRef.current(...args), []);


  useEffect(() => { fetchProducts(1); }, []);

  const debounceRef = useRef(null);
  const normalizeStr = (s) => (s || '').replace(/\s+/g, '').toLowerCase();

const fuzzyMatch = (text, query) => {
  if (!query) return true;
  const t = normalizeStr(text);
  const q = normalizeStr(query);
  if (t.includes(q)) return true;
  const words = query.trim().split(/\s+/);
  return words.every(w => t.includes(normalizeStr(w)));
};

  const handleReset = () => {
  setActiveFilter(null);
  setLevel("");
  setMinPrice("");
  setMaxPrice("");
  setSearch("");
  setDisplaySearch("");   // ← เพิ่ม
  setTypedKeyword("");    // ← เพิ่ม
  // ✅ เพิ่ม fetchProducts พร้อม override ทุก field
  fetchProducts(1, {
    activeFilter: null,
    level: "",
    search: "",
    minPrice: "",
    maxPrice: "",
  });
};

const handleMinPriceChange = (e) => {
  const val = e.target.value;
  setMinPrice(val);
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => fetchProducts(1, { minPrice: val }), 400);
};

const handleMaxPriceChange = (e) => {
  const val = e.target.value;
  setMaxPrice(val);
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => fetchProducts(1, { maxPrice: val }), 400);
};

  const getRightAccount = () => {
    if (!token)
      return (
        <div className="navAuth">
          <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
          <Link className="navBtn navBtnWhite"   to="/login">เข้าสู่ระบบ</Link>
        </div>
      );
    return <ProfileDropdown />;
  };

  return (
    <div className="homePage">
    {/* วางไว้ตรงนี้ได้เลยครับ */}
    <datalist id="price-suggestions">
      <option value="50" />
      <option value="100" />
      <option value="150" />
      <option value="200" />
      <option value="300" />
      <option value="500" />
    </datalist>
      {toast && (
        <div className="mkToast">
          <Icon icon="mdi:check-circle" /> {toast}
        </div>
      )}

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
            <button><Link to="/sell">ลงขาย</Link></button>
          </nav>
          {getRightAccount()}
        </div>
      </header>

      <section className="mkHero">
        <img className="mkHeroBg" src="/src/unieed_pic/market-hero.png" alt="" />
        <div className="mkHeroContent">
          <h1 className="mkHeroTitle">ตลาดชุดนักเรียนมือสอง</h1>
          <p  className="mkHeroSub">เลือกซื้อชุดนักเรียนคุณภาพดี ราคาย่อมเยา</p>
          <div className="mkHeroBtns">
            <Link to="/sell" className="mkHeroBtn mkHeroBtnYellow">
              <Icon icon="mdi:tag-plus-outline" /> ลงขายสินค้า
            </Link>
            <a href="#market-main" className="mkHeroBtn mkHeroBtnOutline">
              <Icon icon="mdi:magnify" /> ดูสินค้าทั้งหมด
            </a>
          </div>
        </div>
      </section>

      <div className="mkSearchSection">
        <div className="mkSearchRow">
          <div className="mkSearchBox">
            <Icon icon="mdi:magnify" className="mkSearchIcon" />
<input 
  placeholder="ค้นหาสินค้า โรงเรียน..." 
  value={displaySearch} 
  onChange={handleSearchInput} 
/>          </div>
          <button 
  className={`mkFilterBtn ${filterOpen ? "mkFilterBtnActive" : ""}`}
  onClick={() => setFilterOpen(o => !o)}
>
  {/* เปลี่ยนจาก <Icon ... /> เป็นตัวนี้ */}
  <FontAwesomeIcon icon={faFilter} style={{ }} />
</button>
        </div>

        <div className={`mkFilterPanel ${filterOpen ? "mkFilterPanelOpen" : ""}`}>
          <div className="mkFilterLabel">คุณต้องการซื้อสินค้าอะไร ?</div>
          <div className="mkFilterGroupLabel">ประเภทชุด</div>
        <div className="mkFilterRowContent">
          <div className="mkTypeRow">
            {UNIFORM_TYPES.map(t => {
  const colors = TYPE_COLORS[t.type_name] || {};
  const isActive = activeFilter?.key === t.key;
  return (
    <div key={t.key} className="mkTypeBtnWrap">
      <button
        className={`mkTypeBtn ${isActive ? "mkTypeBtnActive" : ""}`}
        onClick={() => handleTypeToggle(t)}
        style={{
          backgroundColor: isActive ? colors.hover : colors.bg,
        }}
      >
        <span className="mkTypeIcon">{t.icon}</span>
      </button>
      <span className="mkTypeLabel">{t.type_name}</span>
    </div>
  );
})}
          </div>

          <div className="mkFilterGrid" style={{ marginTop: 16 }}>
  {/* ระดับชั้น (คงเดิม) */}
  <div className="mkFilterGroup">
    <span className="mkFilterGroupLabel" style={{ marginLeft: 0 }}>ระดับชั้น</span>
    <select className="mkSelect" value={level} onChange={handleLevelChange}>
      <option value="">ทั้งหมด</option>
      {LEVELS.filter(Boolean).map(l => <option key={l}>{l}</option>)}
    </select>
  </div>
           {/* ราคาต่ำสุด */}
  <div className="mkFilterGroup">
    <span className="mkFilterGroupLabel" style={{ marginLeft: 0 }}>ราคาต่ำสุด (บาท)</span>
    <input 
      type="text" 
      list="price-suggestions" 
      className="mkSelect mkPriceInput" 
      placeholder="0" 
      value={minPrice} 
      onChange={handleMinPriceChange} 
    />
  </div>
            {/* ราคาสูงสุด - แก้ไข value และ onChange ตรงนี้ครับ! */}
  <div className="mkFilterGroup">
    <span className="mkFilterGroupLabel" style={{ marginLeft: 0 }}>ราคาสูงสุด (บาท)</span>
    <input 
      type="text" 
      list="price-suggestions" 
      className="mkSelect mkPriceInput" 
      placeholder="ไม่จำกัด" 
      value={maxPrice}             // เปลี่ยนจาก minPrice เป็น maxPrice
      onChange={handleMaxPriceChange} // เปลี่ยนจาก handleMin เป็น handleMax
    />
  </div>
          </div>
          </div> 
          <button className="mkResetBtn" onClick={handleReset}>ล้างตัวกรอง</button>
        </div>
      </div>

      <main id="market-main" className="mkMain">
        <div className="mkListHeader">
          <h2 className="mkListTitle">
            สินค้าทั้งหมด
            {!loading && <span className="mkListCount"> ({totalCount.toLocaleString()} รายการ)</span>}
          </h2>
          <select 
  className="mkSortSelect" 
  value={sort} 
  onChange={e => {
    const newSort = e.target.value;
    setSort(newSort);
    // เรียกดึงข้อมูลใหม่ทันทีโดยส่งค่า sort ตัวใหม่เข้าไป override
    fetchProducts(1, { sort: newSort }); 
  }}
>
  {SORT_OPTIONS.map(o => (
    <option key={o.value} value={o.value}>{o.label}</option>
  ))}
</select>
        </div>

        {loading && products.length === 0 ? (
          <div className="mkLoadingGrid">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="mkCardSkeleton" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="mkEmpty">
            <Icon icon="mdi:package-variant-remove" fontSize={56} />
            <p>ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
            <button className="mkResetBtn" onClick={handleReset} style={{ display:"inline-block" }}>ล้างตัวกรอง</button>
          </div>
        ) : (
          <div className="mkGrid">
            {products.map(p => <ProductCard key={p.product_id} product={p} />)}
          </div>
        )}

        {!loading && page < totalPages && (
          <div className="mkLoadMoreWrap">
            <button className="mkLoadMoreBtn" onClick={() => fetchProducts(page + 1)}>โหลดเพิ่มเติม</button>
          </div>
        )}
        {loading && products.length > 0 && (
          <div className="mkLoadingMore">
            <Icon icon="mdi:loading" className="mkSpinner" /> กำลังโหลด...
          </div>
        )}
      </main>
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
            <a href="#home">หน้าหลัก</a>
            <a href="#projects">โครงการ</a>
            <a href="#market">ร้านค้า</a>
            <a href="#sell">ลงขาย</a>
            <a href="#about">เกี่ยวกับเรา</a>
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