import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";
import "../../../pages/styles/Homepage.css";
import "../styles/ProjectDetail.css";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import CartIcon from "../../market/components/CartIcon.jsx";


export default function ProjectDetailPage() {
  const { token, userName, logout } = useAuth();
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("detail");
  const [selectedMethod, setSelectedMethod] = useState("parcel");
  const [activeLevel, setActiveLevel] = useState(null);

  // ── Uniform filter states ──
  const [activeGender, setActiveGender] = useState("male");   // "male" | "female"
  const [activeCategory, setActiveCategory] = useState(null);

  // ── Donate qty map: key = index ใน uniform_items array ──
  const [donateQty, setDonateQty] = useState({});

  useEffect(() => {
    if (!project?.uniform_items?.length) return;
    const levels = [...new Set(project.uniform_items.map(i => i.education_level).filter(Boolean))];
    if (levels.length > 0) setActiveLevel(levels[0]);
  }, [project]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson(`/school/projects/public/${requestId}`, false);
        console.log("🔥 API RESPONSE:", data);
        console.log("🎯 uniform_items:", data.uniform_items);
        setProject(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const formatSize = (size) => {
    if (!size) return "";
    try {
      const obj = typeof size === "string" ? JSON.parse(size) : size;
      const parts = [];
      if (obj.chest) parts.push(`อก ${obj.chest}`);
      if (obj.waist) parts.push(`เอว ${obj.waist}`);
      if (obj.length) parts.push(`ยาว ${obj.length}`);
      return parts.length > 0 ? parts.join(" / ") : String(size);
    } catch {
      return String(size);
    }
  };

  // ── gender helper ──
  const genderOf = (name = "") => {
    if (name.includes("ชาย") || name.includes("เด็กชาย")) return "male";
    if (name.includes("หญิง") || name.includes("เด็กหญิง")) return "female";
    return "all";
  };

  // ── key unique ต่อ item ใช้ index ──
  const itemKey = (item) => {
    return `${item.uniform_type_id}_${item.education_level}_${item.size?.chest || item.size?.waist || ""}`;
  };

  const changeQty = (item, delta) => {
    const key = itemKey(item);
    setDonateQty(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min((prev[key] || 0) + delta, item.quantity)),
    }));
  };

  const setQtyDirect = (item, val) => {
    const key = itemKey(item);
    setDonateQty(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(Number(val) || 0, item.quantity)),
    }));
  };

  const totalSelected = Object.values(donateQty).reduce((a, b) => a + b, 0);

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
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <NotificationBell />
      <ProfileDropdown />
      <CartIcon />
    </div>
    );
  };

  const needed = project?.total_needed || 0;
  const fulfilled = project?.total_fulfilled || 0;
  const remaining = Math.max(needed - fulfilled, 0);
  const pct = needed > 0 ? Math.min(Math.round((fulfilled / needed) * 100), 100) : 0;

  // ── UniformBlock ──
  const UniformBlock = () => {
    if (!project?.uniform_items?.length) return null;

    const allItems = project.uniform_items;

    // levels — เฉพาะที่โรงเรียนขอมา (มี quantity > 0 หรือมีรูป school custom)
    const levels = [...new Set(
      allItems
        .filter(i => i.quantity > 0)
        .map(i => i.education_level)
        .filter(Boolean)
    )];

    // กรองตาม level ก่อน
    const levelItems = activeLevel
      ? allItems.filter(i => i.education_level === activeLevel)
      : allItems;

    // ✅ ใช้ item.gender โดยตรง (ไม่ตรวจจาก item.name ซึ่งอาจเป็นชื่อ custom ของโรงเรียน)
    const hasMale = levelItems.some(i => i.gender === "male");
    const hasFemale = levelItems.some(i => i.gender === "female");

    // กรองตาม gender
    const genderItems = levelItems.filter(i => i.gender === activeGender && i.quantity > 0);

    // ✅ typeLabelMap: key = uniform_category, label = subtype_name (โรงเรียน) หรือ name (default)
    // priority: item ที่มี subtype_name ก่อน
    const typeLabelMap = new Map();
    for (const item of genderItems) {
      const cat = item.uniform_category || "อื่นๆ";
      if (!typeLabelMap.has(cat)) {
        typeLabelMap.set(cat, cat); // ✅ ใช้ชื่อ category หลักเป็น label ของ tab เช่น "เสื้อ", "กางเกง"
      }
    }
    const getTypeLabel = (cat) => typeLabelMap.get(cat) || cat;
    const types = [...typeLabelMap.keys()];

    const currentType = types.includes(activeCategory)
      ? activeCategory
      : (types[0] ?? null);

    // กรองตาม type (uniform_category)
    const typeItems = currentType
      ? genderItems.filter(i => i.uniform_category === currentType)
      : genderItems;

    // ✅ แสดงเฉพาะ item ที่มี quantity > 0 ใน stepper list (item quantity=0 มีไว้แค่แสดงรูป)
    const donateItems = typeItems.filter(i => i.quantity > 0);

    // thumbMap: รูปต่อ category — priority item ที่มี uniform_subtype_name (school custom)
    const thumbMap = new Map();
    for (const item of genderItems) {
      const cat = item.uniform_category || "อื่นๆ";
      if (!item.image_url) continue;
      // ✅ แสดงเฉพาะที่โรงเรียนอัปโหลดเอง หรือมีนักเรียนจริงๆ
      if (!item.uniform_subtype_name?.trim() && item.quantity === 0) continue;
      const existing = thumbMap.get(cat);
      const isCustom = !!item.uniform_subtype_name?.trim();
      const existingIsCustom = !!existing?.uniform_subtype_name?.trim();
      if (!existing || (isCustom && !existingIsCustom)) {
        thumbMap.set(cat, item);
      }
    }
    const thumbItems = [...thumbMap.values()];

    return (
      <div className="pdUniformBox">
        <div className="pdUniformTitle">รายละเอียดชุดที่ต้องการ</div>

        {/* ── Tab เพศ ── */}
        <div className="pdGenderTabs">
          {hasMale && (
            <button
              className={`pdGenderTab pdGenderTabMale ${activeGender === "male" ? "pdGenderTabMaleActive" : ""}`}
              onClick={() => { setActiveGender("male"); setActiveCategory(null); }}
            >
              <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.8327 5.20866V9.37533C20.8327 9.67046 20.7327 9.91803 20.5327 10.118C20.3327 10.318 20.0855 10.4177 19.791 10.417C19.4966 10.4163 19.2494 10.3163 19.0494 10.117C18.8494 9.91769 18.7494 9.67046 18.7494 9.37533V7.7347L14.6087 11.8493C14.9386 12.3354 15.1903 12.8521 15.3639 13.3993C15.5375 13.9465 15.6243 14.5149 15.6243 15.1045C15.6243 16.7017 15.0688 18.0559 13.9577 19.167C12.8466 20.2781 11.4924 20.8337 9.89518 20.8337C8.29796 20.8337 6.94379 20.2781 5.83268 19.167C4.72157 18.0559 4.16602 16.7017 4.16602 15.1045C4.16602 13.5073 4.72157 12.1531 5.83268 11.042C6.94379 9.93088 8.29796 9.37533 9.89518 9.37533C10.4681 9.37533 11.0323 9.45762 11.5879 9.6222C12.1434 9.78678 12.6556 10.043 13.1244 10.391L17.265 6.25033H15.6243C15.3292 6.25033 15.082 6.15033 14.8827 5.95033C14.6834 5.75033 14.5834 5.5031 14.5827 5.20866C14.582 4.91421 14.682 4.66699 14.8827 4.46699C15.0834 4.26699 15.3306 4.16699 15.6243 4.16699H19.791C20.0862 4.16699 20.3337 4.26699 20.5337 4.46699C20.7337 4.66699 20.8334 4.91421 20.8327 5.20866ZM7.31706 12.5264C6.60525 13.2382 6.24935 14.0975 6.24935 15.1045C6.24935 16.1114 6.60525 16.9708 7.31706 17.6826C8.02886 18.3944 8.88824 18.7503 9.89518 18.7503C10.9021 18.7503 11.7615 18.3944 12.4733 17.6826C13.1851 16.9708 13.541 16.1114 13.541 15.1045C13.541 14.0975 13.1851 13.2382 12.4733 12.5264C11.7615 11.8146 10.9021 11.4587 9.89518 11.4587C8.88824 11.4587 8.02886 11.8146 7.31706 12.5264Z" fill="currentColor" />
              </svg>
              เพศชาย
            </button>
          )}
          {hasFemale && (
            <button
              className={`pdGenderTab pdGenderTabFemale ${activeGender === "female" ? "pdGenderTabFemaleActive" : ""}`}
              onClick={() => { setActiveGender("female"); setActiveCategory(null); }}
            >
              <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.459 19.792H10.4173C10.1222 19.792 9.87496 19.692 9.67565 19.492C9.47635 19.292 9.37635 19.0448 9.37565 18.7503C9.37496 18.4559 9.47496 18.2087 9.67565 18.0087C9.87635 17.8087 10.1236 17.7087 10.4173 17.7087H11.459V15.5212C10.0875 15.2781 8.96315 14.6225 8.08607 13.5545C7.20899 12.4864 6.77079 11.2496 6.77149 9.84408C6.77149 8.26421 7.33155 6.92324 8.45169 5.82116C9.57183 4.71908 10.9215 4.16769 12.5007 4.16699C14.0798 4.1663 15.4298 4.71769 16.5507 5.82116C17.6715 6.92463 18.2312 8.2656 18.2298 9.84408C18.2298 11.2503 17.7913 12.4875 16.9142 13.5555C16.0371 14.6236 14.9132 15.2788 13.5423 15.5212V17.7087H14.584C14.8791 17.7087 15.1267 17.8087 15.3267 18.0087C15.5267 18.2087 15.6263 18.4559 15.6257 18.7503C15.625 19.0448 15.525 19.2923 15.3257 19.493C15.1263 19.6937 14.8791 19.7934 14.584 19.792H13.5423V20.8337C13.5423 21.1288 13.4423 21.3764 13.2423 21.5764C13.0423 21.7764 12.7951 21.876 12.5007 21.8753C12.2062 21.8746 11.959 21.7746 11.759 21.5753C11.559 21.376 11.459 21.1288 11.459 20.8337V19.792ZM15.0788 12.4743C15.7906 11.7625 16.1465 10.9031 16.1465 9.89616C16.1465 8.88922 15.7906 8.02984 15.0788 7.31803C14.367 6.60623 13.5076 6.25033 12.5007 6.25033C11.4937 6.25033 10.6343 6.60623 9.92253 7.31803C9.21072 8.02984 8.85482 8.88922 8.85482 9.89616C8.85482 10.9031 9.21072 11.7625 9.92253 12.4743C10.6343 13.1861 11.4937 13.542 12.5007 13.542C13.5076 13.542 14.367 13.1861 15.0788 12.4743Z" fill="currentColor" />
              </svg>
              เพศหญิง
            </button>
          )}
        </div>

        {/* ── Tab ระดับชั้น (underline style) ── */}
        {levels.length > 1 && (
          <div className="pdLevelTabs">
            {levels.map(lv => (
              <button
                key={lv}
                className={`pdLevelTab ${activeLevel === lv ? "pdLevelTabActive" : ""}`}
                onClick={() => { setActiveLevel(lv); setActiveCategory(null); }}
              >
                {lv}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab ประเภทชุด (pill) ── */}
        {types.length > 1 && (
          <div className="pdTypeTabs">
            {types.map((cat) => (
              <button
                key={cat}
                className={`pdTypeTab ${currentType === cat ? "pdTypeTabActive" : ""}`}
                onClick={() => setActiveCategory(cat === currentType ? null : cat)}
              >
                {getTypeLabel(cat)}
              </button>
            ))}
          </div>
        )}

        {/* ── รูปชุด ── */}
        <div className="pdUniformImgs">
          {thumbItems.map(item => (
            <div
              key={`${item.uniform_type_id}_${item.education_level}`}
              className="pdUniformImgWrap"
            >
              <div
                className={`pdUniformImgBtn ${currentType === item.uniform_category ? "pdUniformImgBtnActive" : ""}`}
                onClick={() => setActiveCategory(prev => prev === item.uniform_category ? null : item.uniform_category)}
              >
                <img src={item.image_url} alt={item.name} className="pdUniformImg" />
              </div>
              {/* ✅ label ใต้รูป: ชื่อที่โรงเรียนตั้ง หรือ type name default */}
              <span className="pdUniformImgLabel">
                {item.uniform_subtype_name?.trim() || item.name}
              </span>
            </div>
          ))}
        </div>

        {/* ── รายการชุด + stepper (เฉพาะที่มี quantity > 0) ── */}
        <div className="pdUniformList">
          {donateItems.map((item, i) => {
            const key = itemKey(item);
            const qty = donateQty[key] || 0;
            return (
              <div className="pdUniformRow" key={`${item.uniform_type_id}-${i}`}>
                <span className="pdUniformName">
                  {item.uniform_subtype_name?.trim() || item.name}
                  {item.size && (
                    <span className="pdUniformSize">{formatSize(item.size)}</span>
                  )}
                </span>
                <div className="pdUniformRowRight">
                  <span className="pdUniformQty">{item.quantity} ชิ้น</span>
                  <div className="pdQtyStepper">
                    <button className="pdQtyBtn" onClick={() => changeQty(item, -1)} disabled={qty <= 0}>−</button>
                    <input
                      className="pdQtyInput"
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={qty}
                      onChange={e => setQtyDirect(item, e.target.value)}
                    />
                    <button className="pdQtyBtn" onClick={() => changeQty(item, 1)} disabled={qty >= item.quantity}>+</button>
                  </div>
                </div>
              </div>
            );
          })}
          {donateItems.length === 0 && (
            <div className="pdUniformEmpty">ยังไม่มีรายการชุดในระดับชั้นนี้</div>
          )}
        </div>

        {/* สรุป */}
        {totalSelected > 0 && (
          <div className="pdQtySummary">
            เลือกบริจาคแล้ว <strong>{totalSelected} ชิ้น</strong>
          </div>
        )}
      </div>
    );
  };

  const handleDonate = () => {
    // 🟢 BUY MODE (ไม่ต้องเลือก qty)
  if (selectedMethod === "buy") {
    navigate(`/donate/${requestId}/market`, {
      state: {
        requestId,
        mode: "buy"
      }
    });
    return;
  }

    const items = Object.entries(donateQty)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => {
        // k คือ itemKey เช่น "5_ประถมศึกษา_30"
        // ต้อง lookup กลับหา item เพื่อเอา uniform_type_id
        const item = project.uniform_items.find(i => itemKey(i) === k);
        if (!item) return null;
        return {
          uniform_type_id: item.uniform_type_id,
          education_level: item.education_level,
          size: item.size,
          qty: v,
        };
      })
      .filter(Boolean);

    navigate(`/donate/${requestId}?method=${selectedMethod}`, {
      state: { donateItems: items },
    });
  };

  return (
    <div className="homePage">
      {/* Header */}
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>
          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/projects" className="active">โครงการ</Link>
            <Link to="/market">ร้านค้า</Link>
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
              {/* Left */}
              <div className="pdLeft">
                <div className="pdImgWrap">
                  {project.request_image_url
                    ? <img src={project.request_image_url} alt={project.school_name} />
                    : <div className="pdImgPlaceholder" />}
                </div>
                <div className="pdProgressBlock">
                  <div className="pdProgressTopRow">
                    <span className="pdProgressCount">
                      {/* ยอดบริจาคปัจจุบัน: <strong>{fulfilled}</strong> / {needed} ชุด */}

                      ยอดที่โรงเรียนยืนยันรับแล้ว: <strong>{fulfilled}</strong> / {needed} ชุด
                    </span>
                    <span className="pdProgressPct">{pct}%</span>
                  </div>
                  <div className="pdProgressTrack">
                    <div className="pdProgressFill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="pdProgressRemaining">
                    เหลืออีก <strong>{remaining} ชุด</strong> เพียงช่วยคนละนิดก็ใกล้บรรลุเป้าหมายแล้ว!
                  </div>
                </div>
                {project.request_description && (
                  <blockquote className="pdQuote">"{project.request_description}"</blockquote>
                )}
              </div>

              {/* Right */}
              <div className="pdRight">
                {localStorage.getItem(`donateDraft_${requestId}`) && (
                  <button
                    onClick={() => {
                      const draft = JSON.parse(localStorage.getItem(`donateDraft_${requestId}`));
                      navigate(`/donate/${requestId}?method=${draft.donateMethod || "parcel"}`, {
                        state: { donateItems: draft.donateItems || [] }
                      });
                    }}
                    style={{
                      width: "100%",
                      marginTop: "8px",
                      padding: "10px",
                      borderRadius: "12px",
                      border: "1.5px solid #FFBE1B",
                      background: "#fffbeb",
                      color: "#92400e",
                      fontSize: "15px",
                      cursor: "pointer",
                      fontFamily: "Kanit, sans-serif",
                      display: "inline-flex",   // ← เพิ่ม
                      alignItems: "center",     // ← เพิ่ม
                      justifyContent: "center", // ← เพิ่ม
                      gap: "8px"
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M5 21h14c1.1 0 2-.9 2-2v-7h-2v7H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2" /><path fill="currentColor" d="M7 13v3c0 .55.45 1 1 1h3c.27 0 .52-.11.71-.29l9-9a.996.996 0 0 0 0-1.41l-3-3a.996.996 0 0 0-1.41 0l-9.01 8.99A1 1 0 0 0 7 13m10-7.59L18.59 7L17.5 8.09L15.91 6.5zm-8 8l5.5-5.5l1.59 1.59l-5.5 5.5H9z" /></svg> ดูฉบับร่างที่บันทึกไว้
                  </button>
                )}
                <div className="pdBadge">โครงการขอรับบริจาคชุดนักเรียน</div>

                <h1 className="pdSchoolName">{project.school_name}</h1>
                <p className="pdTitle">{project.request_title}</p>
                <div className="pdLocation">
                  <Icon icon="fluent:location-20-filled" width="20" />
                  <span>{project.school_address || "-"}</span>
                </div>


                <UniformBlock />

                <div className="pdProgressLabel"><span>ช่องทางการส่งต่อ</span></div>
                <div className="pdChannels">
                  <div className={`pdChannel ${selectedMethod === "parcel" ? "pdChannelActive" : ""}`} onClick={() => setSelectedMethod("parcel")}>
                    <svg width="43" height="31" viewBox="0 0 43 31" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M43 21.8149C43 24.3511 40.8607 26.4075 38.2222 26.4075H4.77778C2.13925 26.4075 0 24.3511 0 21.8149V18.3705C0 15.8343 2.13925 13.778 4.77778 13.778H38.2222C40.8607 13.778 43 15.8343 43 18.3705V21.8149Z" fill="#DD2E44" /><path d="M22.6944 5.74067L21.5251 4.59253H8.5355C4.77778 4.59253 3.58333 6.8888 3.58333 6.8888L0 13.7305V19.5183H22.6944V5.74067Z" fill="#FFEEC3" /><path d="M10.7498 13.7779H2.38867L4.77756 9.18531C4.77756 9.18531 5.97201 6.88904 8.36089 6.88904H10.7498V13.7779Z" fill="#55ACEE" /><path d="M10.7504 31C13.3891 31 15.5282 28.9439 15.5282 26.4075C15.5282 23.8711 13.3891 21.8149 10.7504 21.8149C8.11174 21.8149 5.97266 23.8711 5.97266 26.4075C5.97266 28.9439 8.11174 31 10.7504 31Z" fill="#292F33" /><path d="M10.7502 28.7034C12.0696 28.7034 13.1391 27.6753 13.1391 26.4071C13.1391 25.1389 12.0696 24.1108 10.7502 24.1108C9.43087 24.1108 8.36133 25.1389 8.36133 26.4071C8.36133 27.6753 9.43087 28.7034 10.7502 28.7034Z" fill="#CCD6DD" /><path d="M32.2504 31C34.8891 31 37.0282 28.9439 37.0282 26.4075C37.0282 23.8711 34.8891 21.8149 32.2504 21.8149C29.6117 21.8149 27.4727 23.8711 27.4727 26.4075C27.4727 28.9439 29.6117 31 32.2504 31Z" fill="#292F33" /><path d="M32.2502 28.7034C33.5696 28.7034 34.6391 27.6753 34.6391 26.4071C34.6391 25.1389 33.5696 24.1108 32.2502 24.1108C30.9309 24.1108 29.8613 25.1389 29.8613 26.4071C29.8613 27.6753 30.9309 28.7034 32.2502 28.7034Z" fill="#CCD6DD" /><path d="M38.2218 0.00012207H20.3051C17.6666 0.00012207 15.5273 2.05643 15.5273 4.59267V19.5184H42.9996V4.59267C42.9996 2.05643 40.8603 0.00012207 38.2218 0.00012207Z" fill="#CCD6DD" /></svg>
                    <span>จัดส่งพัสดุ</span>
                  </div>
                  <div className={`pdChannel ${selectedMethod === "dropoff" ? "pdChannelActive" : ""}`} onClick={() => setSelectedMethod("dropoff")}>
                    <svg width="41" height="44" viewBox="0 0 41 44" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.00195312 13.5022V28.7514C0.00195312 31.2677 1.60232 31.8124 1.60232 31.8124L18.549 43.0247C21.2167 44.7893 20.5008 41.0741 20.5008 41.0741V27.0571L0.00195312 13.5022Z" fill="#662113" /><path d="M41 13.5022V28.7514C41 31.2677 39.4435 31.8124 39.4435 31.8124C39.4435 31.8124 25.1427 41.2601 22.4764 43.0247C19.8071 44.7893 20.5012 41.0741 20.5012 41.0741V27.0571L41 13.5022Z" fill="#C1694F" /><path d="M22.3869 0.56376C21.2843 -0.18792 19.4761 -0.18792 18.3721 0.56376L0.828005 12.306C-0.276002 13.0577 -0.276002 14.2862 0.828005 15.0367L18.4321 26.9231C19.5361 27.6735 21.3444 27.6735 22.4484 26.9231L40.1711 14.9332C41.2751 14.1827 41.2751 12.9542 40.1711 12.2025L22.3869 0.56376Z" fill="#D99E82" /><path d="M20.4994 43.9999C19.6911 43.9999 19.0352 43.406 19.0352 42.6715V26.7421C19.0352 26.0076 19.6911 25.4137 20.4994 25.4137C21.3091 25.4137 21.9636 26.0076 21.9636 26.7421V42.6715C21.9636 43.406 21.3091 43.9999 20.4994 43.9999Z" fill="#D99E82" /><path d="M35.1426 23.1575C35.1426 24.5179 35.2949 25.1858 33.6784 26.1667L30.0633 28.4809C28.4468 29.463 27.8216 28.6201 27.8216 27.2585V23.6097C27.8216 23.3719 27.7835 23.1168 27.4146 22.8605C23.6398 20.242 8.9832 10.4442 6.3125 8.63529L13.0844 4.10303C14.9381 5.2441 28.829 14.2717 34.6404 18.1225C34.9288 18.3147 35.1426 18.5266 35.1426 18.7583V23.1575Z" fill="#99AAB5" /><path d="M34.6389 18.1225C28.829 14.2717 14.9381 5.2441 13.0844 4.10303L10.5645 5.78876L6.3125 8.63529C8.98467 10.4442 23.6398 20.242 27.4146 22.8605C27.6356 23.0145 27.7323 23.1686 27.7777 23.3177L35.0006 18.4305C34.9127 18.3233 34.7868 18.2198 34.6389 18.1225Z" fill="#CCD6DD" /><path d="M35.1423 23.1575V18.7583C35.1423 18.5267 34.9285 18.3159 34.6386 18.1225C28.8287 14.2717 14.9378 5.2441 13.0841 4.10303L10.0488 6.13503C15.0169 9.42393 28.3235 18.0646 31.8068 20.396C32.1817 20.6474 32.2139 20.9074 32.2139 21.1452V27.1044L33.6781 26.1667C35.2946 25.1846 35.1423 24.5179 35.1423 23.1575Z" fill="#CCD6DD" /><path d="M34.6386 18.1225C28.8287 14.2716 14.9378 5.2441 13.0841 4.10303L10.0488 6.13503C15.0169 9.42393 28.3235 18.0645 31.8068 20.396C31.861 20.4317 31.8947 20.4687 31.9342 20.5044L35.0003 18.4305C34.9124 18.3233 34.7865 18.2198 34.6386 18.1225Z" fill="#E1E8ED" /></svg>
                    <span>Drop-off</span>
                  </div>
                  <div className={`pdChannel ${selectedMethod === "buy" ? "pdChannelActive" : ""}`} onClick={() => setSelectedMethod("buy")}>
                    <svg width="43" height="43" viewBox="0 0 43 43" fill="none" xmlns="http://www.w3.org/2000/svg"><g clipPath="url(#clip0_2661_950)"><path d="M21.5 42.9982C33.3743 42.9982 43 33.3725 43 21.4982C43 9.62662 33.3743 0 21.5 0C9.62573 0 0 9.62573 0 21.4991C0 33.3725 9.62573 42.9982 21.5 42.9982Z" fill="#32BEA6" /><path d="M30.8721 17.5189C30.8542 17.3247 30.7645 17.1443 30.6205 17.0129C30.4765 16.8814 30.2886 16.8086 30.0936 16.8085H12.7574C12.5621 16.8077 12.3737 16.8803 12.2293 17.0118C12.085 17.1434 11.9953 17.3243 11.9781 17.5189L10.5582 33.1547C10.5479 33.2631 10.5604 33.3724 10.595 33.4756C10.6295 33.5788 10.6853 33.6736 10.7587 33.754C10.8322 33.8343 10.9216 33.8984 11.0213 33.9421C11.121 33.9858 11.2287 34.0081 11.3375 34.0076H31.5153C31.6239 34.0074 31.7312 33.9846 31.8306 33.9407C31.9299 33.8968 32.019 33.8327 32.0922 33.7525C32.1654 33.6723 32.2211 33.5777 32.2558 33.4748C32.2905 33.3719 32.3035 33.2629 32.2938 33.1547L30.8721 17.5189Z" fill="#FACB1B" /><path d="M12.7592 16.8085C12.5641 16.8083 12.3759 16.8811 12.2317 17.0125C12.0875 17.144 11.9977 17.3246 11.9798 17.5189L10.5599 33.1547C10.5451 33.3156 10.5807 33.4772 10.6618 33.617C10.7428 33.7568 10.8653 33.8679 11.0123 33.935L28.1388 16.8085H12.7592Z" fill="#FBE158" /><path d="M17.9933 17.7482C17.5962 17.6293 17.1681 17.6729 16.8031 17.8694C16.4381 18.066 16.166 18.3994 16.0467 18.7964C15.7986 19.6241 16.62 22.326 16.62 22.326C16.62 22.326 18.7933 20.5226 19.0415 19.6949C19.1005 19.4983 19.1202 19.2919 19.0994 19.0877C19.0787 18.8834 19.0179 18.6852 18.9206 18.5045C18.8233 18.3237 18.6913 18.1639 18.5322 18.0341C18.3731 17.9044 18.19 17.8072 17.9933 17.7482Z" fill="#5B5C5F" /><path d="M17.5898 19.1529C17.797 19.1529 17.9958 19.0706 18.1424 18.9241C18.2891 18.7777 18.3716 18.579 18.3718 18.3717V13.6811C18.3725 12.8519 18.7022 12.0567 19.2885 11.4702C19.8748 10.8838 20.6699 10.5538 21.4992 10.5529C22.328 10.5541 23.1225 10.8839 23.7086 11.4699C24.2947 12.056 24.6245 12.8505 24.6256 13.6794V18.3708C24.6256 18.5782 24.708 18.7772 24.8547 18.9238C25.0014 19.0705 25.2003 19.1529 25.4077 19.1529C25.6151 19.1529 25.814 19.0705 25.9607 18.9238C26.1074 18.7772 26.1898 18.5782 26.1898 18.3708V13.6802C26.1658 12.4521 25.661 11.2824 24.784 10.4223C23.9069 9.56222 22.7276 9.08044 21.4992 9.08044C20.2708 9.08044 19.0914 9.56222 18.2144 10.4223C17.3373 11.2824 16.8326 12.4521 16.8086 13.6802V18.3708C16.8086 18.5781 16.8909 18.7769 17.0373 18.9235C17.1838 19.0702 17.3825 19.1527 17.5898 19.1529Z" fill="#84462D" /><path d="M18.3735 26.9718C18.3735 27.1792 18.2911 27.3781 18.1444 27.5248C17.9977 27.6715 17.7988 27.7539 17.5914 27.7539H16.0282C15.9254 27.7542 15.8235 27.7342 15.7285 27.695C15.6334 27.6559 15.5471 27.5983 15.4744 27.5256C15.4017 27.4529 15.3441 27.3665 15.3049 27.2715C15.2657 27.1764 15.2457 27.0746 15.2461 26.9718V22.2812C15.2461 22.1785 15.2663 22.0768 15.3056 21.9819C15.3449 21.887 15.4025 21.8008 15.4752 21.7282C15.5478 21.6556 15.634 21.598 15.7289 21.5587C15.8238 21.5194 15.9255 21.4991 16.0282 21.4991H17.5914C17.7988 21.4991 17.9977 21.5815 18.1444 21.7282C18.2911 21.8749 18.3735 22.0738 18.3735 22.2812V26.9718Z" fill="white" /></g><defs><clipPath id="clip0_2661_950"><rect width="43" height="43" fill="white" /></clipPath></defs></svg>
                    <span>ซื้อเพื่อบริจาค</span>
                  </div>
                </div>

                <button
                  className="pdDonateBtn"
                  disabled={selectedMethod !== "buy" && totalSelected === 0}
                  onClick={handleDonate}
                  style={{ opacity: totalSelected === 0 ? 0.5 : 1, cursor: totalSelected === 0 ? "not-allowed" : "pointer" }}
                >
                  {totalSelected > 0 ? `ส่งต่อ ${totalSelected} ชิ้น` : "ส่งต่อ"}
                </button>

                <p className="pdNote">*รับเกียรติบัตรออนไลน์ เพียงอัปโหลดหลักฐานการส่งต่อของท่าน*</p>
              </div>
            </div>

            {/* Tabs */}
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
                      <svg width="45" height="45" viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M40.0407 9.24955L23.1657 3.62455C22.7336 3.47867 22.2655 3.47867 21.8333 3.62455L4.95829 9.24955C4.55564 9.38291 4.20254 9.63456 3.94509 9.97166C3.68764 10.3088 3.5378 10.7156 3.51513 11.1392C3.51319 11.1761 3.51319 11.213 3.51513 11.2499V25.3124C3.51513 25.8719 3.73736 26.4084 4.13295 26.804C4.52853 27.1996 5.06506 27.4218 5.6245 27.4218C6.18394 27.4218 6.72047 27.1996 7.11606 26.804C7.51164 26.4084 7.73388 25.8719 7.73388 25.3124V14.1767L11.9017 15.5654C10.6082 18.0412 10.2238 20.8923 10.8154 23.6223C11.407 26.3523 12.9372 28.7885 15.1395 30.5068C12.2575 31.928 9.81834 34.1094 8.08544 36.8156C7.92939 37.0475 7.82099 37.3081 7.76656 37.5823C7.71212 37.8565 7.71273 38.1388 7.76835 38.4128C7.82397 38.6867 7.93349 38.9469 8.09054 39.1782C8.24759 39.4094 8.44905 39.6072 8.68319 39.7599C8.91733 39.9126 9.1795 40.0172 9.45445 40.0677C9.72939 40.1183 10.0116 40.1136 10.2848 40.0541C10.5579 39.9945 10.8165 39.8813 11.0455 39.721C11.2745 39.5606 11.4693 39.3564 11.6186 39.1201C14.127 35.2599 18.105 33.0468 22.4995 33.0468C26.894 33.0468 30.872 35.2599 33.3892 39.1201C33.5385 39.3564 33.7333 39.5606 33.9623 39.721C34.1913 39.8813 34.4499 39.9945 34.723 40.0541C34.9962 40.1136 35.2784 40.1183 35.5533 40.0677C35.8283 40.0172 36.0905 39.9126 36.3246 39.7599C36.5587 39.6072 36.7602 39.4094 36.9173 39.1782C37.0743 38.9469 37.1838 38.6867 37.2394 38.4128C37.2951 38.1388 37.2957 37.8565 37.2412 37.5823C37.1868 37.3081 37.0784 37.0475 36.9224 36.8156C35.1878 34.1063 32.7454 31.9228 29.8595 30.5015C32.0618 28.7832 33.592 26.347 34.1836 23.617C34.7752 20.887 34.3908 18.036 33.0974 15.5601L40.0407 13.2451C40.4602 13.1047 40.8249 12.8361 41.0834 12.4771C41.3418 12.1181 41.4808 11.687 41.4808 11.2447C41.4808 10.8023 41.3418 10.3712 41.0834 10.0122C40.8249 9.65326 40.4602 9.38461 40.0407 9.24427V9.24955ZM22.4995 7.8433L32.7036 11.2499L22.4995 14.6513L12.3042 11.2499L22.4995 7.8433ZM30.2339 21.0937C30.2341 22.295 29.9545 23.4799 29.4172 24.5544C28.8798 25.6289 28.0996 26.5635 27.1383 27.284C26.177 28.0045 25.0611 28.4912 23.879 28.7055C22.697 28.9198 21.4812 28.8557 20.3282 28.5185C19.1751 28.1812 18.1165 27.58 17.2362 26.7625C16.356 25.945 15.6782 24.9336 15.2567 23.8086C14.8353 22.6836 14.6817 21.4759 14.8081 20.2813C14.9345 19.0866 15.3375 17.9378 15.9851 16.9259L21.8333 18.8753C22.2656 19.0206 22.7334 19.0206 23.1657 18.8753L29.014 16.9259C29.8116 18.1695 30.2351 19.6162 30.2339 21.0937Z" fill="#F7AD19" />
                      </svg>
                      <span>นักเรียนในโครงการ</span>
                    </div>
                    <div className="pdStudentBox">
                      <div className="pdStudentLabel">จำนวนนักเรียนที่ต้องการชุด</div>
                      <div className="pdStudentVal">
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.0465 6C18.3559 6 21.0465 8.69063 21.0465 12C21.0465 15.3094 18.3559 18 15.0465 18C11.7371 18 9.04647 15.3094 9.04647 12C9.04647 8.69063 11.7371 6 15.0465 6ZM8.29647 51V43.5H6.62772C5.60585 43.5 4.88397 42.4969 5.20272 41.5219L8.12772 32.7656L5.4371 36.3094C4.43397 37.6313 2.5496 37.8844 1.2371 36.8906C-0.0754016 35.8969 -0.347277 34.0031 0.655848 32.6906L6.17772 25.4063C8.27772 22.6313 11.5684 21 15.0465 21C18.5246 21 21.8152 22.6313 23.9152 25.4063L29.4371 32.6906C30.4402 34.0125 30.1777 35.8969 28.8559 36.8906C27.534 37.8844 25.6496 37.6313 24.6559 36.3094L21.9652 32.7656L24.8809 41.5219C25.209 42.4969 24.4777 43.5 23.4559 43.5H21.7871V51C21.7871 52.6594 20.4465 54 18.7871 54C17.1277 54 15.7871 52.6594 15.7871 51V43.5H14.2871V51C14.2871 52.6594 12.9465 54 11.2871 54C9.62772 54 8.2871 52.6594 8.2871 51H8.29647ZM45.0465 6C48.3559 6 51.0465 8.69063 51.0465 12C51.0465 15.3094 48.3559 18 45.0465 18C41.7371 18 39.0465 15.3094 39.0465 12C39.0465 8.69063 41.7371 6 45.0465 6ZM44.2965 42V51C44.2965 52.6594 42.9559 54 41.2965 54C39.6371 54 38.2965 52.6594 38.2965 51V34.1719L37.0871 36.0938C36.2059 37.5 34.3496 37.9125 32.9527 37.0313C31.5559 36.15 31.134 34.2938 32.0152 32.8969L36.8621 25.2C38.5121 22.5844 41.3902 20.9906 44.4746 20.9906H45.6277C48.7215 20.9906 51.5996 22.575 53.2402 25.2L58.0871 32.9063C58.9683 34.3125 58.5465 36.1594 57.1496 37.0406C55.7527 37.9219 53.8965 37.5 53.0152 36.1031L51.8058 34.1813V51.0094C51.8058 52.6688 50.4652 54.0094 48.8058 54.0094C47.1465 54.0094 45.8059 52.6688 45.8059 51.0094V42.0094H44.3059L44.2965 42Z" fill="white" /></svg>
                        {project.student_count || "-"} คน
                      </div>
                    </div>
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
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span className="pdPersonSchool">{project.school_name}</span>
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
              <Link to="/" onClick={() => window.scrollTo(0, 0)}>
                <img className="footLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
              </Link>
              <div className="footDesc">แพลตฟอร์มส่งต่อแบ่งปันชุดนักเรียน<br />เพื่อมอบโอกาสทางการศึกษาให้กับนักเรียน</div>
            </div>
          </div>
          <div className="footCol">
            <div className="footTitle">เมนูลัด</div>
            <a href="#home">หน้าหลัก</a><a href="#projects">โครงการ</a>
            <a href="#market">ร้านค้า</a><a href="#sell">ลงขาย</a><a href="#about">เกี่ยวกับเรา</a>
          </div>
          <div className="footCol">
            <div className="footTitle">ติดต่อเรา</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M9.55537 3.40517C11.5837 1.3885 14.9237 1.74684 16.622 4.01684L18.7254 6.8235C20.1087 8.67017 19.9854 11.2502 18.3437 12.8818L17.947 13.2785C17.9021 13.445 17.8975 13.6199 17.9337 13.7885C18.0387 14.4685 18.607 15.9085 20.987 18.2752C23.367 20.6418 24.817 21.2085 25.507 21.3152C25.6809 21.3501 25.8605 21.345 26.032 21.3002L26.712 20.6235C28.172 19.1735 30.412 18.9018 32.2187 19.8835L35.402 21.6168C38.1304 23.0968 38.8187 26.8035 36.5854 29.0252L34.217 31.3785C33.4704 32.1202 32.467 32.7385 31.2437 32.8535C28.227 33.1352 21.1987 32.7752 13.8104 25.4302C6.91537 18.5735 5.59204 12.5935 5.4237 9.64684C5.34037 8.15684 6.0437 6.89684 6.94037 6.00684L9.55537 3.40517Z" fill="white" /></svg>
              <div id="contactfooter">062-379-0000</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M36.6663 10.0003C36.6663 8.16699 35.1663 6.66699 33.333 6.66699H6.66634C4.83301 6.66699 3.33301 8.16699 3.33301 10.0003V30.0003C3.33301 31.8337 4.83301 33.3337 6.66634 33.3337H33.333C35.1663 33.3337 36.6663 31.8337 36.6663 30.0003V10.0003ZM33.333 10.0003L19.9997 18.3337L6.66634 10.0003H33.333ZM33.333 30.0003H6.66634V13.3337L19.9997 21.667L33.333 13.3337V30.0003Z" fill="white" /></svg>
              <div id="contactfooter">contact@unieed.com</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}