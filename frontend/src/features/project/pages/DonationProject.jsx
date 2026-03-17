import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faFilter } from "@fortawesome/free-solid-svg-icons";
import "../../../pages/styles/Homepage.css";
import "../styles/DonationProject.css";

// ===== ข้อมูลไซส์ตามประเภทชุดและระดับชั้น =====
const SIZE_BY_TYPE = {
  เสื้อนักเรียน: { label: "รอบอก (นิ้ว)", sizes: [] },
  กางเกง: { label: "รอบเอว (นิ้ว)", sizes: [] },
  กระโปรง: { label: "รอบเอว (นิ้ว)", sizes: [] },
};

const SIZE_RANGES = {
  อนุบาล:     { chest: ["20","22","24","26","28"], waist: ["18","20","22","24","26"] },
  ประถมศึกษา: { chest: ["26","28","30","32","34","36"], waist: ["22","24","26","28","30","32"] },
  มัธยมต้น:   { chest: ["32","34","36","38","40","42"], waist: ["26","28","30","32","34","36"] },
  มัธยมปลาย:  { chest: ["36","38","40","42","44","46"], waist: ["28","30","32","34","36","38"] },
};

const UNIFORM_TYPES = [
  { key: "เสื้อนักเรียน", icon: "👔", label: "เสื้อนักเรียน" },
  { key: "กางเกง",       icon: "👖", label: "กางเกง" },
  { key: "กระโปรง",     icon: "👗", label: "กระโปรง" },
];

const GENDERS = ["ชาย", "หญิง"];
const LEVELS  = ["อนุบาล", "ประถมศึกษา", "มัธยมต้น", "มัธยมปลาย"];
const CONDITIONS = ["90%", "80%", "70%", "60%", "50% ขึ้นไป"];

export default function DonationProject() {
  const { token, userName, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy] = useState("newest");

  // ===== filter state =====
  const [selType, setSelType]       = useState("");
  const [selGender, setSelGender]   = useState("");
  const [selLevel, setSelLevel]     = useState("");
  const [selSize, setSelSize]       = useState("");
  const [selCond, setSelCond]       = useState("");
  const [searchQ, setSearchQ]       = useState("");

  // ===== โหลดโครงการ =====
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson("/home", false);
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ===== คำนวณ search query อัตโนมัติ =====
  const autoQuery = useMemo(() => {
    const parts = [];
    if (selType)   parts.push(selType);
    if (selGender) parts.push(selGender);
    if (selLevel)  parts.push(selLevel);
    if (selSize) {
      const sizeLabel = selType === "เสื้อนักเรียน" ? `รอบอก ${selSize}"` : `รอบเอว ${selSize}"`;
      parts.push(sizeLabel);
    }
    if (selCond)   parts.push(`สภาพ ${selCond}`);
    return parts.join(" ");
  }, [selType, selGender, selLevel, selSize, selCond]);

  // ===== ไซส์ที่แสดงตามประเภท+ระดับชั้น =====
  const availableSizes = useMemo(() => {
    if (!selLevel) {
      if (!selType) return [];
      // รวมทุกระดับ
      const all = new Set();
      Object.values(SIZE_RANGES).forEach(r => {
        const arr = selType === "เสื้อนักเรียน" ? r.chest : r.waist;
        arr.forEach(s => all.add(s));
      });
      return [...all].sort((a,b) => Number(a)-Number(b));
    }
    const r = SIZE_RANGES[selLevel];
    if (!r) return [];
    return selType === "เสื้อนักเรียน" ? r.chest : r.waist;
  }, [selType, selLevel]);

  const sizeLabel = selType === "เสื้อนักเรียน" ? "รอบอก (นิ้ว)" : selType ? "รอบเอว (นิ้ว)" : "ไซส์";

  // ===== filter + sort projects =====
  const displayProjects = useMemo(() => {
    const q = (searchQ || autoQuery).toLowerCase();
    let list = [...projects];

    if (q) {
      list = list.filter(p =>
        (p.school_name || "").toLowerCase().includes(q) ||
        (p.request_title || "").toLowerCase().includes(q) ||
        (p.school_address || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === "most") {
        return (b.total_fulfilled || 0) - (a.total_fulfilled || 0);
      }
      return 0;
    });

    return list;
  }, [projects, searchQ, autoQuery, sortBy]);

  // ===== reset size เมื่อเปลี่ยนประเภท/ระดับ =====
  useEffect(() => { setSelSize(""); }, [selType, selLevel]);

  const rightAccount = () => {
    if (!token) {
      return (
        <div className="navAuth">
          <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
          <Link className="navBtn navBtnWhite" to="/login">เข้าสู่ระบบ</Link>
        </div>
      );
    }
    return (
      <div className="navAuth">
        <span className="hello">
          <span className="iconBorder">
            <Icon icon="fluent:person-circle-28-filled" width="30" height="30" />
          </span>
          <span className="userNameText">{userName || "ผู้ใช้"}</span>
        </span>
        <button className="navBtn navBtnOutline" onClick={logout}>ออกจากระบบ</button>
      </div>
    );
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
            <Link to="/projects" className="active">โครงการ</Link>
            <a href="#market">ร้านค้า</a>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><a href="#" className="sell">ลงขาย</a></button>
          </nav>
          {rightAccount()}
        </div>
      </header>

      {/* ===== Hero Banner ===== */}
      <div className="dpHero">
        <div className="dpHeroOverlay" />
        <div className="dpHeroContent">
          <h1 className="dpHeroTitle">เริ่มต้นการเปลี่ยนแปลง</h1>
          <p className="dpHeroSub">สร้างโอกาสทางการศึกษา ผ่านการส่งต่อชุดนักเรียน</p>
        </div>
      </div>

      {/* ===== Search + Filter ===== */}
      <div className="dpSearchSection">
        {/* Search bar */}
        <div className="dpSearchRow">
          <div className="dpSearchBox">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="dpSearchIcon" />
            <input
              value={searchQ || autoQuery}
              onChange={e => {
                setSearchQ(e.target.value);
                if (!e.target.value) {
                  setSelType(""); setSelGender(""); setSelLevel("");
                  setSelSize(""); setSelCond("");
                }
              }}
              placeholder="ค้นหาสินค้า ระบุประเภท ขนาด ที่ตามหา..."
            />
          </div>
          <button
            className={`dpFilterBtn ${showFilter ? "dpFilterBtnActive" : ""}`}
            onClick={() => setShowFilter(f => !f)}
          >
            <FontAwesomeIcon icon={faFilter} />
          </button>
        </div>

        {/* Smart filter */}
        <div className={`dpFilterPanel ${showFilter ? "dpFilterPanelOpen" : ""}`}>
          <div className="dpFilterLabel">คุณต้องการบริจาคอะไร?</div>
          <div className="dpFilterGrid">

            {/* ประเภทชุด */}
            <div className="dpFilterGroup">
              <div className="dpFilterGroupLabel">ประเภทชุด</div>
              <div className="dpTypeRow">
                {UNIFORM_TYPES.map(t => (
                  <button
                    key={t.key}
                    className={`dpTypeBtn ${selType === t.key ? "dpTypeBtnActive" : ""}`}
                    onClick={() => setSelType(prev => prev === t.key ? "" : t.key)}
                  >
                    <span className="dpTypeIcon">{t.icon}</span>
                    <span className="dpTypeLabel">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* เพศ */}
            <div className="dpFilterGroup">
              <div className="dpFilterGroupLabel">เพศ</div>
              <select
                className="dpSelect"
                value={selGender}
                onChange={e => setSelGender(e.target.value)}
              >
                <option value="">เพศ</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* ระดับชั้น */}
            <div className="dpFilterGroup">
              <div className="dpFilterGroupLabel">ระดับชั้น</div>
              <select
                className="dpSelect"
                value={selLevel}
                onChange={e => setSelLevel(e.target.value)}
              >
                <option value="">ระดับชั้น</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* ไซส์ */}
            <div className="dpFilterGroup">
              <div className="dpFilterGroupLabel">{sizeLabel}</div>
              <select
                className="dpSelect"
                value={selSize}
                onChange={e => setSelSize(e.target.value)}
                disabled={!selType}
              >
                <option value="">{selType ? sizeLabel : "เลือกประเภทก่อน"}</option>
                {availableSizes.map(s => <option key={s} value={s}>{s}"</option>)}
              </select>
            </div>

            {/* สภาพ */}
            <div className="dpFilterGroup">
              <div className="dpFilterGroupLabel">สภาพ</div>
              <select
                className="dpSelect"
                value={selCond}
                onChange={e => setSelCond(e.target.value)}
              >
                <option value="">สภาพ</option>
                {CONDITIONS.map(c => <option key={c} value={c}>สภาพ {c}</option>)}
              </select>
            </div>

          </div>

          {/* reset */}
          {(selType || selGender || selLevel || selSize || selCond) && (
            <button className="dpResetBtn" onClick={() => {
              setSelType(""); setSelGender(""); setSelLevel("");
              setSelSize(""); setSelCond(""); setSearchQ("");
            }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* ===== Project List ===== */}
      <div className="dpMain">
        <div className="dpListHeader">
          <h2 className="dpListTitle">โครงการโรงเรียนขอรับบริจาคทั้งหมด</h2>
          <select
            className="dpSortSelect"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="newest">เรียงตาม : ล่าสุด</option>
            <option value="most">เรียงตาม : ได้รับมากที่สุด</option>
          </select>
        </div>

        {loading ? (
          <div className="muted" style={{ textAlign: "center", padding: "60px" }}>กำลังโหลด…</div>
        ) : !displayProjects.length ? (
          <div className="muted" style={{ textAlign: "center", padding: "60px" }}>ไม่พบโครงการที่ตรงกับเงื่อนไข</div>
        ) : (
          <div className="dpGrid">
            {displayProjects.map(p => (
              <div
                key={p.request_id}
                className="dpCard"
                onClick={() => navigate(`/projects/${p.request_id}`)}
              >
                <div className="dpCardImg">
                  {p.request_image_url
                    ? <img src={p.request_image_url} alt={p.request_title} />
                    : <div className="dpCardImgPlaceholder" />}
                </div>
                <div className="dpCardBody">
                  <div className="dpCardBadge">โครงการ</div>
                  <div className="dpCardTitle">{p.request_title}</div>
                  <div className="dpCardSchool">{p.school_name}</div>
                  <div className="dpCardAddr">
                    <Icon icon="fluent:location-20-filled" width="14" />
                    {p.school_address}
                  </div>
                  <div className="dpCardBottom">
                    <div className="dpCardFulfilled">
                      ยอดบริจาคชุดปัจจุบัน <strong>{p.total_fulfilled || 0}</strong> ชิ้น
                    </div>
                    <button
                      className="dpCardBtn"
                      onClick={e => { e.stopPropagation(); navigate(`/projects/${p.request_id}`); }}
                    >
                      ส่งต่อ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {displayProjects.length > 0 && (
          <div style={{ textAlign: "center", margin: "40px 0" }}>
            <button className="btnGhost" style={{ padding: "0 40px", height: "48px", fontSize: "18px" }}>
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
