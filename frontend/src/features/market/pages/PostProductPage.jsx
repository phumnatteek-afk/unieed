// frontend/src/modules/market/pages/PostProductPage.jsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../../../pages/styles/Homepage.css";
import "../styles/PostProductPage.css";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
 
const SIZE_LABELS = { chest: "อก", waist: "เอว", length: "ยาว" };
 
const MAIN_CATEGORIES = [
  { key: "shirt_m", category_id: 1, gender: "male",   label: "เสื้อ (ชาย)",  icon: "mdi:tshirt-crew",                   sizeKeys: ["chest", "length"] },
  { key: "shirt_f", category_id: 1, gender: "female", label: "เสื้อ (หญิง)", icon: "mdi:tshirt-crew-outline",            sizeKeys: ["chest", "length"] },
  { key: "pants_m", category_id: 2, gender: "male",   label: "กางเกง",        icon: "mdi:hanger",                         sizeKeys: ["waist", "length"] },
  { key: "skirt_f", category_id: 3, gender: "female", label: "กระโปรง",       icon: "mdi:skirt",                          sizeKeys: ["waist", "length"] },
  { key: "other",   category_id: 4, gender: null,     label: "อื่นๆ",         icon: "mdi:dots-horizontal-circle-outline", sizeKeys: ["chest"] },
];
 
const LEVELS           = ["ทุกระดับชั้น", "อนุบาล", "ประถมศึกษา", "มัธยมต้น", "มัธยมปลาย"];
const CONDITION_PERCENTS = ["10","20","30","40","50","60","70","80","90","100"];
const CONDITION_LABELS   = ["มีตำหนิ","พอใช้ได้","สภาพดี","สภาพดีมาก","ใหม่มาก"];
const MAX_IMAGES         = 4;
 
// โลโก้ขนส่ง — ใช้ URL จาก CDN สาธารณะ (fallback เป็น icon ถ้าโหลดไม่ได้)
const SHIPPING_LOGOS = {
  "ไปรษณีย์ไทย":   "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Thailand_Post_logo.svg/200px-Thailand_Post_logo.svg.png",
  "Kerry Express":  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Kerry_Express_logo.svg/200px-Kerry_Express_logo.svg.png",
  "Flash Express":  "https://companieslogo.com/img/orig/FLASH.BK-5e0d2d86.png",
  "J&T Express":    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/J%26T_Express_logo.svg/200px-J%26T_Express_logo.svg.png",
  "Ninja Van":      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Ninjavan-logo.svg/200px-ninjavan-logo.svg.png",
  "Shopee Express": "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/cb0479f3c6a5e4e82b56.png",
  "Lazada Express": "https://lzd-img-global.slatic.net/g/tsp/tb/img/logo/lazada_logo_160.png",
};
 
const makeItem = () => ({
  _id:              Math.random().toString(36).slice(2),
  category_id:      1,
  gender:           "male",
  uniform_type_id:  null,
  custom_type_name: "",
  school_name:      "",
  level:            "",
  sizes:            { chest: "", waist: "", length: "" },
  condition:        "80",
  conditionLabel:   "สภาพดี",
  price:            "",
  quantity:         1,
  description:      "",
  images:           [],
  // น้ำหนักอยู่ที่ item ระดับ item (step 1)
  weight:           "",
});
 
// ── ShippingLogo component ────────────────────────────────
function ShippingLogo({ name, size = 36 }) {
  const [error, setError] = useState(false);
  const src = SHIPPING_LOGOS[name];
  if (!src || error) {
    return (
      <div style={{
        width: size, height: size,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.55,
      }}>
        🚚
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setError(true)}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
 
export default function PostProductPage() {
  const { token, updateRole } = useAuth();
  const navigate = useNavigate();
 
  const [uniformTypes, setUniformTypes]   = useState([]);
  const [typesLoading, setTypesLoading]   = useState(true);
  const [shippingProviders, setShippingProviders] = useState([]);
 
  useEffect(() => {
    fetch("/api/checkout/shipping")
      .then(res => res.json())
      .then(data => setShippingProviders(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
 
  useEffect(() => {
    fetch("/api/market/uniform-types")
      .then(r => r.json())
      .then(rows => setUniformTypes(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => setTypesLoading(false));
  }, []);
 
  const [step,              setStep]              = useState(1);
  const [items,             setItems]             = useState([makeItem()]);
  const [openIdx,           setOpenIdx]           = useState(0);
  // selectedProviders: provider_id[] — เลือกร่วมกันทุกสินค้า
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [submitting,        setSubmitting]        = useState(false);
  const [err,               setErr]               = useState("");
  const fileInputRefs = useRef({});
 
  const updateItem = (idx, patch) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
 
  const addItem = () => {
    setItems(prev => [...prev, makeItem()]);
    setOpenIdx(items.length);
  };
 
  const removeItem = (idx) => {
    items[idx].images.forEach(img => img?.url && URL.revokeObjectURL(img.url));
    setItems(prev => prev.filter((_, i) => i !== idx));
    setOpenIdx(prev => (prev >= idx ? Math.max(0, prev - 1) : prev));
  };
 
  const handleCategoryChange = (idx, catId, gender) => {
    updateItem(idx, { category_id: catId, gender, uniform_type_id: null, custom_type_name: "" });
  };
 
  const handleFileDrop = (itemIdx, files) => {
    const remaining = MAX_IMAGES - items[itemIdx].images.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(files).slice(0, remaining).map(file => ({
      file, url: URL.createObjectURL(file),
    }));
    updateItem(itemIdx, { images: [...items[itemIdx].images, ...toAdd] });
  };
 
  const removeImage = (itemIdx, imgIdx) => {
    URL.revokeObjectURL(items[itemIdx].images[imgIdx]?.url);
    updateItem(itemIdx, { images: items[itemIdx].images.filter((_, i) => i !== imgIdx) });
  };
 
  const triggerFileInput = (itemIdx) =>
    fileInputRefs.current[`item_${itemIdx}`]?.click();
 
  const getSizeKeys = (catId, gender) =>
    MAIN_CATEGORIES.find(c => c.category_id === catId && (c.gender === gender || c.gender === null))?.sizeKeys || ["chest"];
 
  const getItemSummary = (item) => {
    const typeObj  = uniformTypes.find(t => t.uniform_type_id === item.uniform_type_id);
    const sizeKeys = getSizeKeys(item.category_id, item.gender);
    const sizeStr  = sizeKeys.map(k => `${SIZE_LABELS[k]}${item.sizes[k]}`).join(" / ");
    const typeName = item.custom_type_name?.trim() || typeObj?.type_name || "ยังไม่เลือกประเภท";
    return { typeName, sizeStr };
  };
 
  // ── validate step 1 ──────────────────────────────────────
  const goToStep2 = () => {
    setErr("");
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.uniform_type_id && !it.custom_type_name?.trim())
        return setErr(`รายการที่ ${i + 1}: กรุณาเลือกหรือกรอกประเภทชุด`);
      if (!it.price || isNaN(Number(it.price)))
        return setErr(`รายการที่ ${i + 1}: กรุณากรอกราคา`);
    }
    setStep(2);
    setOpenIdx(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
 
  // ── submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    setErr("");
    if (!selectedProviders.length)
      return setErr("กรุณาเลือกขนส่งอย่างน้อย 1 รายการ");
 
    setSubmitting(true);
    try {
      const formData = new FormData();
      const itemsMeta = items.map(item => {
        const typeObj = uniformTypes.find(t => t.uniform_type_id === item.uniform_type_id);
        const sizeObj = {};
        const cid     = Number(item.category_id);
        if (cid === 1) {
          if (item.sizes.chest)  sizeObj.chest  = item.sizes.chest;
          if (item.sizes.length) sizeObj.length = item.sizes.length;
        } else {
          if (item.sizes.waist)  sizeObj.waist  = item.sizes.waist;
          if (item.sizes.length) sizeObj.length = item.sizes.length;
        }
        return {
          uniform_type_id:       item.uniform_type_id,
          type_name:             item.custom_type_name?.trim() || typeObj?.type_name || "",
          school_name:           item.school_name || "",
          level:                 item.level,
          category_id:           item.category_id,
          gender:                item.gender,
          sizes:                 sizeObj,
          condition:             item.condition,
          conditionLabel:        item.conditionLabel,
          price:                 item.price,
          quantity:              item.quantity,
          description:           item.description,
          weight:                parseFloat(item.weight) || 0,
          // ✅ ส่ง provider_ids ที่เลือกร่วมกันจาก step 2
          shipping_provider_ids: selectedProviders,
        };
      });
 
      formData.append("items", JSON.stringify(itemsMeta));
      items.forEach((item, i) => {
        item.images.forEach(img => {
          if (img?.file) formData.append(`item${i}_images`, img.file);
        });
      });
 
      const res  = await fetch("/api/market/batch", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
 
      if (data.newRole && typeof updateRole === "function") updateRole(data.newRole);
      navigate("/market", { state: { successMsg: `ลงขายสำเร็จ ${data.products.length} รายการ! 🎉` } });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
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
      {/* Header */}
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>
          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/projects">โครงการ</Link>
            <Link to="/market">ร้านค้า</Link>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><Link to="/sell" className="active">ลงขาย</Link></button>
          </nav>
          {getRightAccount()}
        </div>
      </header>
 
      <div className="ppAccentBar" />
 
      <div className="ppWrapper">
 
        {/* ── Step Indicator ── */}
        <div className="ppStepBar">
          <div className={`ppStep ${step >= 1 ? "ppStepDone" : ""} ${step === 1 ? "ppStepActive" : ""}`}>
            <div className="ppStepCircle">
              {step > 1 ? <Icon icon="mdi:check" /> : <Icon icon="mdi:tag-multiple-outline" />}
            </div>
            <div className="ppStepInfo">
              <span className="ppStepNum">ขั้นตอนที่ 1</span>
              <span className="ppStepName">ข้อมูลสินค้า</span>
            </div>
          </div>
          <div className={`ppStepLine ${step >= 2 ? "ppStepLineDone" : ""}`} />
          <div className={`ppStep ${step >= 2 ? "ppStepActive" : ""}`}>
            <div className="ppStepCircle">
              <Icon icon="mdi:truck-delivery-outline" />
            </div>
            <div className="ppStepInfo">
              <span className="ppStepNum">ขั้นตอนที่ 2</span>
              <span className="ppStepName">การจัดส่ง</span>
            </div>
          </div>
        </div>
 
        {/* ══════════════════════════════════════
            STEP 1 — ข้อมูลสินค้า
        ══════════════════════════════════════ */}
        {step === 1 && (
          <>
            <div className="ppPageHeader">
              <h1 className="ppPageTitle">
                <Icon icon="mdi:tag-multiple-outline" style={{ marginRight: 8, verticalAlign: "middle" }} />
                ข้อมูลสินค้า
              </h1>
              <p className="ppPageSub">กรอกข้อมูลสินค้าที่ต้องการลงขาย — แต่ละรายการจะแสดงเป็นการ์ดแยกกันในตลาด</p>
            </div>
 
            <div className="ppItemsArea">
              {items.map((item, idx) => {
                const isOpen   = openIdx === idx;
                const sizeKeys = getSizeKeys(item.category_id, item.gender);
                const summary  = getItemSummary(item);
 
                const filteredTypes = (() => {
                  const filtered = uniformTypes.filter(t =>
                    t.category_id === item.category_id &&
                    (item.gender === null || t.gender === item.gender || !t.gender)
                  );
                  const uniqueMap = new Map();
                  filtered.forEach(t => {
                    const key = t.type_name.trim();
                    if (!uniqueMap.has(key)) uniqueMap.set(key, t);
                  });
                  return Array.from(uniqueMap.values()).sort((a, b) =>
                    a.type_name.localeCompare(b.type_name, "th")
                  );
                })();
 
                return (
                  <div key={item._id} className={`ppItemCard ${isOpen ? "ppItemCardOpen" : ""}`}>
 
                    {/* Card header */}
                    <div className="ppItemHeader" onClick={() => setOpenIdx(isOpen ? -1 : idx)}>
                      <div className="ppItemHeaderLeft">
                        <div className="ppItemNumBadge">{idx + 1}</div>
                        <div>
                          {isOpen ? (
                            <span className="ppItemLabel">รายการที่ {idx + 1}</span>
                          ) : (
                            <>
                              <div className="ppItemSummaryName">{summary.typeName}</div>
                              <div className="ppItemSummaryMeta">
                                {summary.sizeStr}
                                {item.price && ` · ${Number(item.price).toLocaleString()} บาท`}
                                {item.weight && ` · ${item.weight} kg`}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ppItemHeaderRight">
                        {items.length > 1 && (
                          <button className="ppRemoveBtn" onClick={e => { e.stopPropagation(); removeItem(idx); }}>
                            <Icon icon="mdi:trash-can-outline" />
                          </button>
                        )}
                        <Icon icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"} className="ppItemChevron" />
                      </div>
                    </div>
 
                    {/* Card body */}
                    {isOpen && (
                      <div className="ppItemBody">
 
                        {/* ══ ① รูปภาพ ══ */}
                        <div className="ppSection">
                          <div className="ppSectionHeader">
                            <span className="ppSectionDot ppDotBlue" />
                            <span className="ppSectionTitle">รูปภาพสินค้า</span>
                            <span className="ppImgCount">{item.images.length}/{MAX_IMAGES}</span>
                            <span className="ppOptionalBadge">ภาพแรก = ภาพปก</span>
                          </div>
                          {item.images.length === 0 ? (
                            <div
                              className="ppDropZone"
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.preventDefault(); handleFileDrop(idx, e.dataTransfer.files); }}
                              onClick={() => triggerFileInput(idx)}
                            >
                              <Icon icon="mdi:image-plus-outline" className="ppDropIcon" />
                              <span className="ppDropText">คลิกหรือลากรูปมาวาง</span>
                              <small className="ppDropHint">JPG / PNG / WEBP ไม่เกิน 5MB ต่อภาพ</small>
                            </div>
                          ) : (
                            <div className="ppImgRow">
                              {item.images.map((img, imgIdx) => (
                                <div key={imgIdx} className={`ppImgSlot ${imgIdx === 0 ? "ppImgCover" : ""}`}>
                                  <img src={img.url} alt="" className="ppImgPreview" />
                                  {imgIdx === 0 && <span className="ppCoverBadge">ปก</span>}
                                  <button className="ppImgRemove" onClick={e => { e.stopPropagation(); removeImage(idx, imgIdx); }}>
                                    <Icon icon="mdi:close" />
                                  </button>
                                </div>
                              ))}
                              {item.images.length < MAX_IMAGES && (
                                <div className="ppImgAddSlot" onClick={() => triggerFileInput(idx)}>
                                  <Icon icon="mdi:plus" />
                                </div>
                              )}
                            </div>
                          )}
                          <input
                            type="file" accept="image/*" multiple style={{ display: "none" }}
                            ref={el => fileInputRefs.current[`item_${idx}`] = el}
                            onChange={e => handleFileDrop(idx, e.target.files)}
                          />
                        </div>
 
                        {/* ══ ② ประเภทชุด ══ */}
                        <div className="ppSection">
                          <div className="ppSectionHeader">
                            <span className="ppSectionDot ppDotPurple" />
                            <span className="ppSectionTitle">ประเภทชุด</span>
                            <span className="ppReqBadge">จำเป็น</span>
                          </div>
 
                          <div className="ppFieldBlock">
                            <label className="ppFieldLabel"><Icon icon="mdi:shape-outline" /> หมวดหมู่</label>
                            <div className="ppCatTabs">
                              {MAIN_CATEGORIES.map(cat => {
                                const isActive = item.category_id === cat.category_id && item.gender === cat.gender;
                                return (
                                  <button
                                    key={cat.key}
                                    className={`ppCatTab ${isActive ? "ppCatTabActive" : ""}`}
                                    onClick={() => handleCategoryChange(idx, cat.category_id, cat.gender)}
                                  >
                                    <Icon icon={cat.icon} />
                                    {cat.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
 
                          <div className="ppFieldBlock">
                            <label className="ppFieldLabel"><Icon icon="mdi:format-list-bulleted" /> เลือกจากระบบ</label>
                            {typesLoading ? (
                              <p className="ppLoadingHint">กำลังโหลดประเภทชุด...</p>
                            ) : (
                              <div className="ppSelectWrap">
                                <select
                                  className="ppSelect"
                                  value={item.uniform_type_id || ""}
                                  onChange={e => {
                                    const selId = e.target.value ? Number(e.target.value) : null;
                                    updateItem(idx, {
                                      uniform_type_id:  selId,
                                      custom_type_name: selId ? "" : item.custom_type_name,
                                    });
                                  }}
                                >
                                  <option value="">— เลือกประเภทชุดที่มีในระบบ —</option>
                                  {filteredTypes.length === 0 && <option disabled>ไม่มีประเภทชุดในหมวดนี้</option>}
                                  {filteredTypes.map(t => (
                                    <option key={t.uniform_type_id} value={t.uniform_type_id}>
                                      {t.type_name}
                                      {t.gender === "male" ? " (ชาย)" : t.gender === "female" ? " (หญิง)" : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="ppOrDivider"><span />หรือกรอกชื่อประเภทเอง<span /></div>
                            <input
                              className="ppInput"
                              placeholder="เช่น คอฮาวาย, ชุดพละ, รุ่นพิเศษ..."
                              value={item.custom_type_name || ""}
                              disabled={!!item.uniform_type_id}
                              onChange={e => updateItem(idx, { custom_type_name: e.target.value, uniform_type_id: null })}
                            />
                            {item.uniform_type_id && <p className="ppHint">ล้างตัวเลือก dropdown ก่อนถึงจะกรอกเองได้</p>}
                          </div>
                        </div>
 
                        {/* ══ ③ ระดับชั้น & ไซส์ ══ */}
                        <div className="ppSection">
                          <div className="ppSectionHeader">
                            <span className="ppSectionDot ppDotGreen" />
                            <span className="ppSectionTitle">ระดับชั้นและขนาด</span>
                          </div>
 
                          <div className="ppFieldBlock">
                            <label className="ppFieldLabel"><Icon icon="mdi:school-outline" /> ระดับชั้น</label>
                            <div className="ppChipGroup">
                              {LEVELS.map(l => (
                                <button
                                  key={l}
                                  className={`ppChip ${item.level === l ? "ppChipActive ppChipBlue" : ""}`}
                                  onClick={() => updateItem(idx, { level: item.level === l ? "" : l })}
                                >
                                  {l}
                                </button>
                              ))}
                            </div>
                          </div>
 
                          <div className="ppFieldBlock">
                            <label className="ppFieldLabel"><Icon icon="mdi:ruler" /> ไซส์ (นิ้ว)</label>
                            <div className="ppSizesRow">
                              {sizeKeys.map(key => (
                                <div key={key} className="ppSizeBox">
                                  <span className="ppSizeLabel">{SIZE_LABELS[key]}</span>
                                  <input
                                    className="ppSizeInput"
                                    type="number"
                                    value={item.sizes[key] || ""}
                                    placeholder="—"
                                    onChange={e => updateItem(idx, { sizes: { ...item.sizes, [key]: e.target.value } })}
                                  />
                                  <span className="ppSizeUnit">นิ้ว</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
 
                        {/* ══ ④ สภาพและราคา ══ */}
                        <div className="ppSection">
                          <div className="ppSectionHeader">
                            <span className="ppSectionDot ppDotOrange" />
                            <span className="ppSectionTitle">สภาพและราคา</span>
                          </div>
 
                          <div className="ppFieldRow2">
                            <div className="ppFieldBlock">
                              <label className="ppFieldLabel"><Icon icon="mdi:percent-outline" /> สภาพสินค้า (%)</label>
                              <div className="ppSelectWrap">
                                <select
                                  className="ppSelect"
                                  value={item.condition}
                                  onChange={e => updateItem(idx, { condition: e.target.value })}
                                >
                                  {CONDITION_PERCENTS.map(c => (
                                    <option key={c} value={c}>{c}%</option>
                                  ))}
                                </select>
                              </div>
                              <div className="ppChipGroup ppChipGroupSm" style={{ marginTop: 6 }}>
                                {CONDITION_LABELS.map(c => (
                                  <button
                                    key={c}
                                    className={`ppChip ppChipSm ${item.conditionLabel === c ? "ppChipActive ppChipBlue" : ""}`}
                                    onClick={() => updateItem(idx, { conditionLabel: c })}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                            </div>
 
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                              <div className="ppFieldBlock">
                                <label className="ppFieldLabel">
                                  <Icon icon="mdi:currency-usd" /> ราคา <span className="ppReq">*</span>
                                </label>
                                <div className="ppPriceWrap">
                                  <input
                                    className="ppInput ppPriceInput"
                                    type="number" min="0" placeholder="0"
                                    value={item.price}
                                    onChange={e => updateItem(idx, { price: e.target.value })}
                                  />
                                  <span className="ppUnit">บาท</span>
                                </div>
                              </div>
                              <div className="ppFieldBlock">
                                <label className="ppFieldLabel">
                                  <Icon icon="mdi:package-variant-closed" /> จำนวน
                                </label>
                                <div className="ppQtyWrap">
                                  <button className="ppQtyBtn" onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })}>−</button>
                                  <span className="ppQtyVal">{item.quantity}</span>
                                  <button className="ppQtyBtn" onClick={() => updateItem(idx, { quantity: Math.min(99, item.quantity + 1) })}>+</button>
                                  <span className="ppUnit">ชิ้น</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
 
                        {/* ══ ⑤ น้ำหนักสินค้า (ย้ายมาอยู่ step 1) ══ */}
                        <div className="ppSection">
                          <div className="ppSectionHeader">
                            <span className="ppSectionDot ppDotGreen" />
                            <span className="ppSectionTitle">น้ำหนักสินค้า</span>
                            <span className="ppOptionalBadge">ใช้คำนวณค่าส่ง</span>
                          </div>
                          <div className="ppFieldBlock" style={{ maxWidth: 220 }}>
                            <label className="ppFieldLabel">
                              <Icon icon="mdi:weight-kilogram" /> น้ำหนัก
                            </label>
                            <div className="ppPriceWrap">
                              <input
                                className="ppInput ppPriceInput"
                                type="number"
                                min="0"
                                step="0.1"
                                placeholder="0.0"
                                value={item.weight}
                                onChange={e => updateItem(idx, { weight: e.target.value })}
                              />
                              <span className="ppUnit">kg</span>
                            </div>
                          </div>
                        </div>
 
                        {/* ══ ⑥ รายละเอียดเพิ่มเติม (optional) ══ */}
                        <div className="ppSection ppSectionOptional">
                          <div className="ppSectionHeader">
                            <span className="ppSectionDot ppDotGray" />
                            <span className="ppSectionTitle">รายละเอียดเพิ่มเติม</span>
                            <span className="ppOptionalBadge">ไม่บังคับ</span>
                          </div>
                          <div className="ppFieldRow2">
                            <div className="ppFieldBlock">
                              <label className="ppFieldLabel">โรงเรียน</label>
                              <input
                                className="ppInput" type="text"
                                placeholder="ระบุชื่อโรงเรียน..."
                                value={item.school_name}
                                onChange={e => updateItem(idx, { school_name: e.target.value })}
                              />
                            </div>
                            <div className="ppFieldBlock">
                              <label className="ppFieldLabel">หมายเหตุ / คำอธิบาย</label>
                              <textarea
                                className="ppTextarea" rows={2}
                                placeholder="อธิบายเพิ่มเติม เช่น ตำหนิเล็กน้อย..."
                                value={item.description}
                                onChange={e => updateItem(idx, { description: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
 
                      </div>
                    )}
                  </div>
                );
              })}
 
              <button className="ppAddItemBtn" onClick={addItem}>
                <Icon icon="mdi:plus-circle-outline" /> เพิ่มรายการสินค้า
              </button>
            </div>
 
            {err && (
              <div className="ppErr">
                <Icon icon="mdi:alert-circle-outline" /> {err}
              </div>
            )}
 
            <div className="ppSubmitArea">
              <button className="ppSubmitBtn" onClick={goToStep2}>
                <Icon icon="mdi:arrow-right" />
                ถัดไป: ตั้งค่าการจัดส่ง
              </button>
            </div>
          </>
        )}
 
        {/* ══════════════════════════════════════
            STEP 2 — การจัดส่ง
            เลือก provider ร่วมกันทุกสินค้า (ไม่ต้องกรอกค่าส่งเอง)
        ══════════════════════════════════════ */}
        {step === 2 && (
          <>
            <div className="ppPageHeader">
              <h1 className="ppPageTitle">
                <Icon icon="mdi:truck-delivery-outline" style={{ marginRight: 8, verticalAlign: "middle" }} />
                การจัดส่ง
              </h1>
              <p className="ppPageSub">เลือกบริการขนส่งที่รองรับสำหรับสินค้าของคุณ — ค่าจัดส่งจะคำนวณจากน้ำหนักโดยอัตโนมัติ</p>
            </div>
 
            {/* Summary chips */}
            <div className="ppShipSummaryRow">
              {items.map((item, idx) => {
                const summary = getItemSummary(item);
                return (
                  <div key={item._id} className="ppShipSummaryChip">
                    <div className="ppShipSummaryNum">{idx + 1}</div>
                    <div>
                      <div className="ppShipSummaryName">{summary.typeName}</div>
                      <div className="ppShipSummaryPrice">
                        {item.price ? `${Number(item.price).toLocaleString()} บาท` : "—"}
                        {item.weight ? ` · ${item.weight} kg` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
 
            {/* ── Provider selection ── */}
            <div className="ppSection" style={{ background: "var(--color-surface)", borderRadius: 16, padding: "24px", marginBottom: 24 }}>
              <div className="ppSectionHeader" style={{ marginBottom: 16 }}>
                <span className="ppSectionDot ppDotBlue" />
                <span className="ppSectionTitle">เลือกขนส่งที่รองรับ</span>
                <span className="ppReqBadge">จำเป็น — เลือกได้หลายรายการ</span>
              </div>
 
              <p className="ppHint" style={{ marginBottom: 16 }}>
                <Icon icon="mdi:information-outline" style={{ verticalAlign: "middle", marginRight: 4 }} />
                ผู้ซื้อจะเห็นตัวเลือกขนส่งเหล่านี้ โดยราคาค่าส่งคำนวณจากน้ำหนักสินค้าโดยอัตโนมัติ
              </p>
 
              {shippingProviders.length === 0 ? (
                <div className="ppLoadingHint">
                  <Icon icon="mdi:loading" className="ppSpinner" /> กำลังโหลดรายการขนส่ง...
                </div>
              ) : (
                <div className="ppShipGrid">
                  {shippingProviders.map(p => {
                    const active = selectedProviders.includes(p.provider_id);
                    return (
                      <div
                        key={p.provider_id}
                        className={`ppShipCard ${active ? "ppShipCardActive" : ""}`}
                        onClick={() =>
                          setSelectedProviders(prev =>
                            prev.includes(p.provider_id)
                              ? prev.filter(id => id !== p.provider_id)
                              : [...prev, p.provider_id]
                          )
                        }
                      >
                        <div className="ppShipCardIcon">
                          <ShippingLogo name={p.name} size={38} />
                        </div>
                        <div className="ppShipCardName">{p.name}</div>
                        {active && (
                          <div className="ppShipCardCheck">
                            <Icon icon="mdi:check-circle" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
 
              {selectedProviders.length > 0 && (
                <div className="ppShipSelectedSummary">
                  <Icon icon="mdi:check-circle-outline" style={{ color: "#22c55e", marginRight: 6 }} />
                  เลือกแล้ว {selectedProviders.length} รายการ:{" "}
                  {shippingProviders
                    .filter(p => selectedProviders.includes(p.provider_id))
                    .map(p => p.name)
                    .join(", ")}
                </div>
              )}
            </div>
 
            {err && (
              <div className="ppErr">
                <Icon icon="mdi:alert-circle-outline" /> {err}
              </div>
            )}
 
            <div className="ppSubmitArea">
              <button className="ppBackBtn" onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <Icon icon="mdi:arrow-left" /> ย้อนกลับ
              </button>
              <p className="ppSubmitNote">
                แต่ละรายการจะแสดงเป็นการ์ดแยกกัน · ลงขายครั้งแรกจะอัปเดตสถานะเป็น "ผู้ขาย" โดยอัตโนมัติ
              </p>
              <button className="ppSubmitBtn" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? <><Icon icon="mdi:loading" className="ppSpinner" /> กำลังส่ง...</>
                  : <><Icon icon="mdi:tag-outline" /> ลงขาย {items.length} รายการ</>
                }
              </button>
            </div>
          </>
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