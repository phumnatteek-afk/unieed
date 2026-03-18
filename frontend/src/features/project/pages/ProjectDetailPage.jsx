import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import "../../../pages/styles/Homepage.css";
import "../styles/ProjectDetail.css";

const LEVEL_MAP = {
  "อนุบาล": "อนุบาล",
  "ประถมศึกษา": "ประถม",
  "มัธยมศึกษา": "มัธยม",
};
// ── ลำดับ tab ──────────────────────────────────────────────────────────────
const LEVEL_ORDER = ["อนุบาล", "ประถมศึกษา", "มัธยมศึกษา"];

// ── แปลง size JSON → ข้อความไทย ──────────────────────────────────────────
function formatSize(size) {
  if (!size) return "";
  try {
    const obj = typeof size === "string" ? JSON.parse(size) : size;
    const parts = [];
    if (obj.chest) parts.push(`อก ${obj.chest}`);
    if (obj.waist) parts.push(`เอว ${obj.waist}`);
    if (obj.length) parts.push(`ยาว ${obj.length}`);
    return parts.length > 0 ? parts.join(" / ") : String(size);
  } catch { return String(size); }
}
function getCategoryIcon(category) {
  switch (category) {
    case "เสื้อ": return "👔";
    case "กางเกง": return "👖";
    case "กระโปรง": return "👗";
    default: return "👕";
  }
}


export default function ProjectDetailPage() {
  const { token, userName, logout } = useAuth();
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("detail");
  const [levelTab, setLevelTab] = useState(null);
//   const availableTabs = Array.from(
//   new Set(currentImages.map(i => i.education_level))
// )
//   .filter(Boolean)
//   .map(level => ({
//     key: level,
//     label: LEVEL_MAP[level] || level,
//   }));

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson(`/school/projects/public/${requestId}`, false);
        setProject(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const needed = Number(project?.total_needed) || 0;
  const fulfilled = Number(project?.total_fulfilled) || 0;
  const remaining = Math.max(needed - fulfilled, 0);

  // จัดกลุ่มตาม education_level (= education_level_group จาก backend)
  // ค่าที่เป็นไปได้: "อนุบาล" | "ประถมศึกษา" | "มัธยมศึกษา" | null
  const levelGroups = useMemo(() => {
    const groups = {};
    for (const item of project?.uniform_items || []) {
      const key = item.education_level || "ทั่วไป";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [project]);

  // tabs เรียงตาม LEVEL_ORDER + ทั่วไปท้ายสุด
const availableTabs = useMemo(() => {
  const tabs = LEVEL_ORDER
    .filter(k => levelGroups[k]?.length > 0)
    .map(k => ({
      key: k,
      label: LEVEL_MAP[k] || k // ✅ แก้ตรงนี้
    }));

  if (levelGroups["ทั่วไป"]?.length > 0)
    tabs.push({ key: "ทั่วไป", label: "ทั่วไป" });

  return tabs;
}, [levelGroups]);

  // set default tab แรก
  useEffect(() => {
    if (availableTabs.length > 0 && (!levelTab || !availableTabs.find(t => t.key === levelTab)))
      setLevelTab(availableTabs[0].key);
  }, [availableTabs]);


  const currentItems = useMemo(() => levelGroups[levelTab] || [], [levelGroups, levelTab]);

  // dedupe รูปตาม uniform_type_id ของ tab นั้น
  const currentImages = useMemo(() => {
    const seen = new Set();
    return currentItems.reduce((acc, item) => {
      if (item.image_url && !seen.has(item.uniform_type_id)) {
        seen.add(item.uniform_type_id);
        acc.push({ uniform_type_id: item.uniform_type_id, name: item.name, image_url: item.image_url,
          education_level: item.education_level
         });
      }
      return acc;
    }, []);
  }, [currentItems]);
  
  const rightAccount = () => {
    if (!token) return (
      <div className="navAuth">
        <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
        <Link className="navBtn navBtnWhite" to="/login">เข้าสู่ระบบ</Link>
      </div>
    );
    return (
      <div className="navAuth">
        <span className="hello">
          <span className="iconBorder"><Icon icon="fluent:person-circle-28-filled" width="30" height="30" /></span>
          <span className="userNameText">{userName || "ผู้ใช้"}</span>
        </span>
        <button className="navBtn navBtnOutline" onClick={logout}>ออกจากระบบ</button>
      </div>
    );
  };

  return (
    <div className="homePage">
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand"><img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" /></Link>
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
      <div className="pdTopStrip" />

      <div className="pdWrapper">
        {loading ? (
          <div className="muted" style={{ padding: "60px", textAlign: "center" }}>กำลังโหลด…</div>
        ) : !project ? (
          <div className="muted" style={{ padding: "60px", textAlign: "center" }}>ไม่พบโครงการนี้</div>
        ) : (
          <>
            {/* Hero Card */}
            <div className="pdHeroCard">
              <div className="pdLeft">
                <div className="pdImgWrap">
                  {project.request_image_url
                    ? <img src={project.request_image_url} alt={project.school_name} />
                    : <div className="pdImgPlaceholder" />}
                </div>
                <div className="pdStatRow">
                  <div className="pdStatLabel">ยอดบริจาคชุดปัจจุบัน</div>
                  <div className="pdStatValue">{fulfilled} ชิ้น</div>
                </div>
                <div className="pdStatBoxes">
                  <div className="pdStatBox pdStatBoxBlue">
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M46.875 9.375H42.0258L38.8266 6.17344C38.6523 5.99937 38.4455 5.86135 38.2178 5.76724C37.9902 5.67314 37.7463 5.62481 37.5 5.625H22.5C22.2537 5.62481 22.0098 5.67314 21.7822 5.76724C21.5545 5.86135 21.3477 5.99937 21.1734 6.17344L17.9742 9.375H13.125C12.1304 9.375 11.1766 9.77009 10.4733 10.4733C9.77009 11.1766 9.375 12.1304 9.375 13.125V48.75C9.375 49.7446 9.77009 50.6984 10.4733 51.4016C11.1766 52.1049 12.1304 52.5 13.125 52.5H46.875C47.8696 52.5 48.8234 52.1049 49.5266 51.4016C50.2299 50.6984 50.625 49.7446 50.625 48.75V13.125C50.625 12.1304 50.2299 11.1766 49.5266 10.4733C48.8234 9.77009 47.8696 9.375 46.875 9.375ZM30 15.3703L26.0156 9.375H34.0078L30 15.3703ZM37.7906 10.4484L39.375 12.0258V24.375L32.4773 18.4125L37.7906 10.4484ZM20.625 12.0258L22.2094 10.4438L27.5227 18.4125L20.625 24.375V12.0258ZM13.125 13.125H16.875V24.375C16.8706 25.0886 17.0718 25.7884 17.4546 26.3906C17.8374 26.9929 18.3856 27.4722 19.0336 27.7711C19.5319 28.0036 20.0751 28.1244 20.625 28.125C21.4998 28.1232 22.3461 27.8137 23.0156 27.2508C23.0253 27.2443 23.034 27.2364 23.0414 27.2273L28.125 22.8469V48.75H13.125V13.125ZM46.875 48.75H31.875V22.8469L36.9492 27.2297C36.9566 27.2387 36.9653 27.2466 36.975 27.2531C37.6474 27.8173 38.4973 28.1261 39.375 28.125C39.9286 28.1236 40.4751 28.0003 40.9758 27.7641C41.6209 27.4643 42.1664 26.9855 42.5474 26.3847C42.9284 25.7839 43.1289 25.0864 43.125 24.375V13.125H46.875V48.75Z" fill="white" /></svg>
                    <div><div className="pdBoxSub">จำนวนชุดที่ต้องการทั้งหมด</div><div className="pdBoxVal">{needed} ชิ้น</div></div>
                  </div>
                  <div className="pdStatBox pdStatBoxYellow">
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M46.875 9.375H42.0258L38.8266 6.17344C38.6523 5.99937 38.4455 5.86135 38.2178 5.76724C37.9902 5.67314 37.7463 5.62481 37.5 5.625H22.5C22.2537 5.62481 22.0098 5.67314 21.7822 5.76724C21.5545 5.86135 21.3477 5.99937 21.1734 6.17344L17.9742 9.375H13.125C12.1304 9.375 11.1766 9.77009 10.4733 10.4733C9.77009 11.1766 9.375 12.1304 9.375 13.125V48.75C9.375 49.7446 9.77009 50.6984 10.4733 51.4016C11.1766 52.1049 12.1304 52.5 13.125 52.5H46.875C47.8696 52.5 48.8234 52.1049 49.5266 51.4016C50.2299 50.6984 50.625 49.7446 50.625 48.75V13.125C50.625 12.1304 50.2299 11.1766 49.5266 10.4733C48.8234 9.77009 47.8696 9.375 46.875 9.375ZM30 15.3703L26.0156 9.375H34.0078L30 15.3703ZM37.7906 10.4484L39.375 12.0258V24.375L32.4773 18.4125L37.7906 10.4484ZM20.625 12.0258L22.2094 10.4438L27.5227 18.4125L20.625 24.375V12.0258ZM13.125 13.125H16.875V24.375C16.8706 25.0886 17.0718 25.7884 17.4546 26.3906C17.8374 26.9929 18.3856 27.4722 19.0336 27.7711C19.5319 28.0036 20.0751 28.1244 20.625 28.125C21.4998 28.1232 22.3461 27.8137 23.0156 27.2508C23.0253 27.2443 23.034 27.2364 23.0414 27.2273L28.125 22.8469V48.75H13.125V13.125ZM46.875 48.75H31.875V22.8469L36.9492 27.2297C36.9566 27.2387 36.9653 27.2466 36.975 27.2531C37.6474 27.8173 38.4973 28.1261 39.375 28.125C39.9286 28.1236 40.4751 28.0003 40.9758 27.7641C41.6209 27.4643 42.1664 26.9855 42.5474 26.3847C42.9284 25.7839 43.1289 25.0864 43.125 24.375V13.125H46.875V48.75Z" fill="white" /></svg>
                    <div><div className="pdBoxSub">ต้องการชุดอีก</div><div className="pdBoxVal">{remaining} ชิ้น</div></div>
                  </div>
                </div>
              </div>

              <div className="pdRight">
                <div className="pdBadge">โครงการขอรับบริจาคชุดนักเรียน</div>
                <h1 className="pdSchoolName">{project.school_name}</h1>
                <p className="pdTitle">{project.request_title}</p>
                <div className="pdLocation">
                  <Icon icon="fluent:location-20-filled" width="20" />
                  <span>{project.school_address || "-"}</span>
                </div>
                {project.request_description && (
                  <blockquote className="pdQuote">"{project.request_description}"</blockquote>
                )}
                <div className="pdProgressLabel"><span>ช่องทางการส่งต่อ</span></div>
                <div className="pdChannels">
                  <div className="pdChannel">
                    <svg width="43" height="31" viewBox="0 0 43 31" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M43 21.8149C43 24.3511 40.8607 26.4075 38.2222 26.4075H4.77778C2.13925 26.4075 0 24.3511 0 21.8149V18.3705C0 15.8343 2.13925 13.778 4.77778 13.778H38.2222C40.8607 13.778 43 15.8343 43 18.3705V21.8149Z" fill="#DD2E44" /><path d="M22.6944 5.74067L21.5251 4.59253H8.5355C4.77778 4.59253 3.58333 6.8888 3.58333 6.8888L0 13.7305V19.5183H22.6944V5.74067Z" fill="#FFEEC3" /><path d="M10.7498 13.7779H2.38867L4.77756 9.18531C4.77756 9.18531 5.97201 6.88904 8.36089 6.88904H10.7498V13.7779Z" fill="#55ACEE" /><path d="M10.7504 31C13.3891 31 15.5282 28.9439 15.5282 26.4075C15.5282 23.8711 13.3891 21.8149 10.7504 21.8149C8.11174 21.8149 5.97266 23.8711 5.97266 26.4075C5.97266 28.9439 8.11174 31 10.7504 31Z" fill="#292F33" /><path d="M32.2504 31C34.8891 31 37.0282 28.9439 37.0282 26.4075C37.0282 23.8711 34.8891 21.8149 32.2504 21.8149C29.6117 21.8149 27.4727 23.8711 27.4727 26.4075C27.4727 28.9439 29.6117 31 32.2504 31Z" fill="#292F33" /><path d="M38.2218 0.00012207H20.3051C17.6666 0.00012207 15.5273 2.05643 15.5273 4.59267V19.5184H42.9996V4.59267C42.9996 2.05643 40.8603 0.00012207 38.2218 0.00012207Z" fill="#CCD6DD" /></svg>
                    <span>จัดส่งพัสดุ</span>
                  </div>
                  <div className="pdChannel">
                    <svg width="41" height="44" viewBox="0 0 41 44" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.00195312 13.5022V28.7514C0.00195312 31.2677 1.60232 31.8124 1.60232 31.8124L18.549 43.0247C21.2167 44.7893 20.5008 41.0741 20.5008 41.0741V27.0571L0.00195312 13.5022Z" fill="#662113" /><path d="M41 13.5022V28.7514C41 31.2677 39.4435 31.8124 39.4435 31.8124C39.4435 31.8124 25.1427 41.2601 22.4764 43.0247C19.8071 44.7893 20.5012 41.0741 20.5012 41.0741V27.0571L41 13.5022Z" fill="#C1694F" /><path d="M22.3869 0.56376C21.2843 -0.18792 19.4761 -0.18792 18.3721 0.56376L0.828005 12.306C-0.276002 13.0577 -0.276002 14.2862 0.828005 15.0367L18.4321 26.9231C19.5361 27.6735 21.3444 27.6735 22.4484 26.9231L40.1711 14.9332C41.2751 14.1827 41.2751 12.9542 40.1711 12.2025L22.3869 0.56376Z" fill="#D99E82" /></svg>
                    <span>Drop-off</span>
                  </div>
                  <div className="pdChannel">
                    <svg width="43" height="43" viewBox="0 0 43 43" fill="none" xmlns="http://www.w3.org/2000/svg"><g clipPath="url(#c1)"><path d="M21.5 42.9982C33.3743 42.9982 43 33.3725 43 21.4982C43 9.62662 33.3743 0 21.5 0C9.62573 0 0 9.62573 0 21.4991C0 33.3725 9.62573 42.9982 21.5 42.9982Z" fill="#32BEA6" /><path d="M17.5898 19.1529C17.797 19.1529 17.9958 19.0706 18.1424 18.9241C18.2891 18.7777 18.3716 18.579 18.3718 18.3717V13.6811C18.3725 12.8519 18.7022 12.0567 19.2885 11.4702C19.8748 10.8838 20.6699 10.5538 21.4992 10.5529C22.328 10.5541 23.1225 10.8839 23.7086 11.4699C24.2947 12.056 24.6245 12.8505 24.6256 13.6794V18.3708C24.6256 18.5782 24.708 18.7772 24.8547 18.9238C25.0014 19.0705 25.2003 19.1529 25.4077 19.1529C25.6151 19.1529 25.814 19.0705 25.9607 18.9238C26.1074 18.7772 26.1898 18.5782 26.1898 18.3708V13.6802C26.1658 12.4521 25.661 11.2824 24.784 10.4223C23.9069 9.56222 22.7276 9.08044 21.4992 9.08044C20.2708 9.08044 19.0914 9.56222 18.2144 10.4223C17.3373 11.2824 16.8326 12.4521 16.8086 13.6802V18.3708C16.8086 18.5781 16.8909 18.7769 17.0373 18.9235C17.1838 19.0702 17.3825 19.1527 17.5898 19.1529Z" fill="#84462D" /></g><defs><clipPath id="c1"><rect width="43" height="43" fill="white" /></clipPath></defs></svg>
                    <span>ซื้อเพื่อบริจาค</span>
                  </div>
                </div>
                <button className="pdDonateBtn" onClick={() => navigate(`/donate/${requestId}`)}>ส่งต่อ</button>
                <p className="pdNote">*รับเกียรติบัตรออนไลน์ เพียงอัปโหลดหลักฐานการส่งต่อของท่าน*</p>
              </div>
            </div>

            {/* Main Tabs */}
            <div className="pdTabs">
              <button className={`pdTab ${activeTab === "detail" ? "pdTabActive" : ""}`} onClick={() => setActiveTab("detail")}>รายละเอียด</button>
              <button className={`pdTab ${activeTab === "review" ? "pdTabActive" : ""}`} onClick={() => setActiveTab("review")}>ความประทับใจจากโรงเรียน</button>
            </div>
            <div className="pdTabLine" />

            {activeTab === "detail" && (
              <div className="pdDetailGrid">
                <div className="pdDetailLeft">
                  <div className="pdDetailSection">
                    <div className="pdDetailSectionTitle">
                      <svg width="55" height="55" viewBox="0 0 55 55" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M48.9391 11.3051L28.3141 4.43011C27.7859 4.25181 27.2138 4.25181 26.6856 4.43011L6.06057 11.3051C5.56843 11.4681 5.13687 11.7757 4.82221 12.1877C4.50755 12.5997 4.32441 13.097 4.2967 13.6147C4.29433 13.6598 4.29433 13.7049 4.2967 13.75V30.9375C4.2967 31.6213 4.56832 32.2771 5.05182 32.7605C5.53531 33.244 6.19106 33.5157 6.87482 33.5157C7.55859 33.5157 8.21434 33.244 8.69783 32.7605C9.18133 32.2771 9.45295 31.6213 9.45295 30.9375V17.3272L14.5469 19.0244C12.966 22.0505 12.4962 25.5351 13.2193 28.8718C13.9423 32.2085 15.8125 35.186 18.5043 37.2862C14.9818 39.0232 12.0006 41.6894 9.88264 44.9969C9.69191 45.2804 9.55942 45.5989 9.49289 45.9341C9.42636 46.2692 9.42711 46.6142 9.49508 46.9491C9.56306 47.2839 9.69692 47.6019 9.88887 47.8845C10.0808 48.1672 10.327 48.4089 10.6132 48.5955C10.8994 48.7822 11.2198 48.9101 11.5559 48.9718C11.8919 49.0335 12.2369 49.0279 12.5707 48.9551C12.9045 48.8823 13.2206 48.7439 13.5005 48.548C13.7803 48.352 14.0185 48.1023 14.201 47.8135C17.2668 43.0955 22.1287 40.3907 27.4998 40.3907C32.8709 40.3907 37.7328 43.0955 40.8094 47.8135C40.9919 48.1023 41.2301 48.352 41.5099 48.548C41.7898 48.7439 42.1059 48.8823 42.4397 48.9551C42.7735 49.0279 43.1185 49.0335 43.4545 48.9718C43.7906 48.9101 44.111 48.7822 44.3972 48.5955C44.6833 48.4089 44.9296 48.1672 45.1215 47.8845C45.3135 47.6019 45.4473 47.2839 45.5153 46.9491C45.5833 46.6142 45.584 46.2692 45.5175 45.9341C45.451 45.5989 45.3185 45.2804 45.1278 44.9969C43.0077 41.6856 40.0226 39.0169 36.4953 37.2797C39.1871 35.1796 41.0573 32.2021 41.7804 28.8654C42.5035 25.5287 42.0337 22.0441 40.4528 19.018L48.9391 16.1885C49.4518 16.017 49.8976 15.6886 50.2134 15.2499C50.5293 14.8111 50.6992 14.2842 50.6992 13.7436C50.6992 13.203 50.5293 12.676 50.2134 12.2373C49.8976 11.7985 49.4518 11.4702 48.9391 11.2987V11.3051ZM27.4998 9.58636L39.9715 13.75L27.4998 17.9073L15.0389 13.75L27.4998 9.58636ZM36.9529 25.7813C36.9532 27.2496 36.6115 28.6978 35.9547 30.0111C35.298 31.3243 34.3444 32.4666 33.1695 33.3472C31.9946 34.2279 30.6307 34.8227 29.1859 35.0846C27.7412 35.3465 26.2553 35.2682 24.846 34.856C23.4367 34.4438 22.1429 33.709 21.067 32.7098C19.9911 31.7106 19.1627 30.4745 18.6476 29.0995C18.1324 27.7246 17.9447 26.2485 18.0992 24.7883C18.2537 23.3282 18.7462 21.9241 19.5377 20.6873L26.6856 23.07C27.2139 23.2475 27.7858 23.2475 28.3141 23.07L35.4619 20.6873C36.4369 22.2073 36.9544 23.9755 36.9529 25.7813Z" fill="#F7AD19" /></svg>
                      <span>นักเรียนในโครงการ</span>
                    </div>

                    <div className="pdStudentBox">
                      <div className="pdStudentLabel">จำนวนนักเรียนที่ต้องการชุด</div>
                      <div className="pdStudentVal">
                        <svg width="40" height="40" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.0465 6C18.3559 6 21.0465 8.69063 21.0465 12C21.0465 15.3094 18.3559 18 15.0465 18C11.7371 18 9.04647 15.3094 9.04647 12C9.04647 8.69063 11.7371 6 15.0465 6ZM8.29647 51V43.5H6.62772C5.60585 43.5 4.88397 42.4969 5.20272 41.5219L8.12772 32.7656L5.4371 36.3094C4.43397 37.6313 2.5496 37.8844 1.2371 36.8906C-0.0754016 35.8969 -0.347277 34.0031 0.655848 32.6906L6.17772 25.4063C8.27772 22.6313 11.5684 21 15.0465 21C18.5246 21 21.8152 22.6313 23.9152 25.4063L29.4371 32.6906C30.4402 34.0125 30.1777 35.8969 28.8559 36.8906C27.534 37.8844 25.6496 37.6313 24.6559 36.3094L21.9652 32.7656L24.8809 41.5219C25.209 42.4969 24.4777 43.5 23.4559 43.5H21.7871V51C21.7871 52.6594 20.4465 54 18.7871 54C17.1277 54 15.7871 52.6594 15.7871 51V43.5H14.2871V51C14.2871 52.6594 12.9465 54 11.2871 54C9.62772 54 8.2871 52.6594 8.2871 51H8.29647ZM45.0465 6C48.3559 6 51.0465 8.69063 51.0465 12C51.0465 15.3094 48.3559 18 45.0465 18C41.7371 18 39.0465 15.3094 39.0465 12C39.0465 8.69063 41.7371 6 45.0465 6ZM44.2965 42V51C44.2965 52.6594 42.9559 54 41.2965 54C39.6371 54 38.2965 52.6594 38.2965 51V34.1719L37.0871 36.0938C36.2059 37.5 34.3496 37.9125 32.9527 37.0313C31.5559 36.15 31.134 34.2938 32.0152 32.8969L36.8621 25.2C38.5121 22.5844 41.3902 20.9906 44.4746 20.9906H45.6277C48.7215 20.9906 51.5996 22.575 53.2402 25.2L58.0871 32.9063C58.9683 34.3125 58.5465 36.1594 57.1496 37.0406C55.7527 37.9219 53.8965 37.5 53.0152 36.1031L51.8058 34.1813V51.0094C51.8058 52.6688 50.4652 54.0094 48.8058 54.0094C47.1465 54.0094 45.8059 52.6688 45.8059 51.0094V42.0094H44.3059L44.2965 42Z" fill="white" /></svg>
                        {project.student_count || 0} คน
                      </div>
                    </div>

                    {availableTabs.length > 0 && (
                      <div className="pdUniformBox">
                        <div className="pdUniformTitle">รายละเอียดชุดที่ต้องการ</div>

                        {/* Level Tabs */}
                        <div className="pdLevelTabs">
                          {availableTabs.map(t => (
                            <button
                              key={t.key}
                              className={`pdLevelTab ${levelTab === t.key ? "pdLevelTabActive" : ""}`}
                              onClick={() => setLevelTab(t.key)}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        {/* รูปชุด */}
                        {currentImages.length > 0 && (
                          <div className="pdUniformImgs">
                            {currentImages.map(img => (
                              <div key={img.uniform_type_id} className="pdUniformImgWrap">
                                <img src={img.image_url} alt={img.name} className="pdUniformImg" />
                                <span className="pdUniformImgLabel">{img.name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* รายการ */}
                        <div className="pdUniformList">
                          {currentItems.map((item, i) => (
                            <div className="pdUniformRow" key={i}>
                              <span className="pdUniformName">
                                {item.name}
                                {item.size && <span className="pdUniformSize">{formatSize(item.size)}</span>}
                              </span>
                              
                               
                             
                              <span className="pdUniformQty">{item.quantity} ชิ้น</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pdDetailRight">
                  <div className="pdContactItem">
                    <svg width="45" height="45" viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.5002 3.75C14.2295 3.75 7.50015 10.4794 7.50015 18.7406C7.44578 30.825 21.9302 40.845 22.5002 41.25C22.5002 41.25 37.5545 30.825 37.5002 18.75C37.5002 10.4794 30.7708 3.75 22.5002 3.75ZM22.5002 26.25C18.3564 26.25 15.0002 22.8938 15.0002 18.75C15.0002 14.6062 18.3564 11.25 22.5002 11.25C26.6439 11.25 30.0002 14.6062 30.0002 18.75C30.0002 22.8938 26.6439 26.25 22.5002 26.25Z" fill="#F7AD19" /></svg>
                    <div><div className="pdContactTitle">ที่อยู่โรงเรียน</div><div className="pdContactVal">{project.school_full_address || project.school_address || "-"}</div></div>
                  </div>
                  <div className="pdContactItem">
                    <svg width="45" height="45" viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.4125 20.2312C15.1125 25.5375 19.4625 29.8687 24.7688 32.5875L28.8937 28.4625C29.4 27.9563 30.15 27.7875 30.8063 28.0125C32.9063 28.7062 35.175 29.0813 37.5 29.0813C38.5313 29.0813 39.375 29.925 39.375 30.9563V37.5C39.375 38.5313 38.5313 39.375 37.5 39.375C19.8937 39.375 5.625 25.1063 5.625 7.5C5.625 6.46875 6.46875 5.625 7.5 5.625H14.0625C15.0938 5.625 15.9375 6.46875 15.9375 7.5C15.9375 9.84375 16.3125 12.0938 17.0062 14.1938C17.2125 14.85 17.0625 15.5813 16.5375 16.1063L12.4125 20.2312Z" fill="#F7AD19" /></svg>
                    <div><div className="pdContactTitle">เบอร์ติดต่อ</div><div className="pdContactVal">{project.school_phone || "-"}</div></div>
                  </div>
                  <div className="pdContactItem">
                    <svg width="45" height="45" viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M37.5 7.5H7.5C5.4375 7.5 3.76875 9.1875 3.76875 11.25L3.75 33.75C3.75 35.8125 5.4375 37.5 7.5 37.5H37.5C39.5625 37.5 41.25 35.8125 41.25 33.75V11.25C41.25 9.1875 39.5625 7.5 37.5 7.5ZM37.5 15L22.5 24.375L7.5 15V11.25L22.5 20.625L37.5 11.25V15Z" fill="#F7AD19" /></svg>
                    <div><div className="pdContactTitle">E-mail</div><div className="pdContactVal">{project.school_email || "-"}</div></div>
                  </div>
                  {project.contact_person && (
                    <div className="pdContactPerson">
                      <div className="pdContactTitle">ผู้รับผิดชอบโครงการ</div>
                      <div className="pdPersonRow">
                        {project.school_logo_url
                          ? <img src={project.school_logo_url} alt={project.school_name} className="pdAvatar" />
                          : <div className="pdAvatarPlaceholder"><Icon icon="fluent:person-circle-28-filled" width="44" color="#87C7EB" /></div>}
                        <div className="pdPersonInfo">
                          <span className="pdPersonSchool">{project.school_name}</span>
                          <br />
                          <span className="pdPersonName">โดย {project.contact_person}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "review" && (
              <div className="pdReviews">
                {project.reviews?.length ? (
                  project.reviews.map((r, i) => (
                    <div className="pdReviewCard" key={i}>
                      <p className="pdReviewText">"{r.text}"</p>
                      <div className="pdReviewMeta">{r.author} · {r.date}</div>
                    </div>
                  ))
                ) : (
                  <div className="muted" style={{ padding: "40px", textAlign: "center" }}>ยังไม่มีความประทับใจจากโรงเรียนนี้</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <footer id="about" className="footer">
        <div className="footerInner">
          <div className="footBrand">
            <div>
              <Link to="/" onClick={() => window.scrollTo(0, 0)}><img className="footLogo" src="/src/unieed_pic/logo.png" alt="Unieed" /></Link>
              <div className="footDesc">แพลตฟอร์มส่งต่อแบ่งปันชุดนักเรียน<br />เพื่อมอบโอกาสทางการศึกษาให้กับนักเรียน</div>
            </div>
          </div>
          <div className="footCol">
            <div className="footTitle">เมนูลัด</div>
            <Link to="/">หน้าหลัก</Link><Link to="/projects">โครงการ</Link>
            <a href="#market">ร้านค้า</a><a href="#about">เกี่ยวกับเรา</a>
          </div>
          <div className="footCol">
            <div className="footTitle">ติดต่อเรา</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}><Icon icon="fluent:call-20-filled" width="24" color="#fff" /><span>062-379-0000</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}><Icon icon="fluent:mail-20-filled" width="24" color="#fff" /><span>contact@unieed.com</span></div>
            <div className="connect"><Icon icon="logos:facebook" width="36" /><Icon icon="simple-icons:line" width="36" color="#fff" /></div>
          </div>
        </div>
      </footer>
    </div>
  );
}