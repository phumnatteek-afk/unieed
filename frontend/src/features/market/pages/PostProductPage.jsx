import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Icon } from "@iconify/react";
import "../../../pages/styles/Homepage.css";
import "../styles/PostProductPage.css";

// ===== ข้อมูล dropdown =====
const CATEGORIES = ["เสื้อนักเรียน", "กางเกงนักเรียน", "กระโปรงนักเรียน"];
const GENDERS = ["ทุกเพศ", "ชาย", "หญิง"];
const ITEM_TYPES = ["เสื้อนักเรียนชาย", "เสื้อนักเรียนหญิง", "กางเกงนักเรียนชาย", "กระโปรงนักเรียนหญิง"];
const LEVELS = ["อนุบาล", "ประถมศึกษา", "มัธยมต้น", "มัธยมปลาย"];
const CONDITIONS = ["10%","20%","30%","40%","50%","60%","70%","80%","90%","100%"];
const CONDITION_LABELS = ["มีตำหนิ", "สภาพดีมาก", "สภาพดี", "ใหม่มาก", "ใหม่เอี่ยม"];

// ไซส์ตาม type
const SIZE_OPTIONS = {
  chest: ["26","28","30","32","34","36","38","40","42","44","46"],
  waist: ["18","20","22","24","26","28","30","32","34","36","38"],
  length: ["16","18","20","22","24","26","28","30","32"],
};

const TYPE_SIZES = {
  "เสื้อนักเรียนชาย":    { show: ["chest"], labels: { chest: "อก" } },
  "เสื้อนักเรียนหญิง":   { show: ["chest"], labels: { chest: "อก" } },
  "กางเกงนักเรียนชาย":  { show: ["waist","length"], labels: { waist: "เอว", length: "ยาว" } },
  "กระโปรงนักเรียนหญิง":{ show: ["waist","length"], labels: { waist: "เอว", length: "ยาว" } },
};

const EMPTY_ITEM = () => ({
  id: Date.now() + Math.random(),
  images: [null, null],
  type: "เสื้อนักเรียนชาย",
  level: "ประถมศึกษา",
  sizes: { chest: "32", waist: "26", length: "22" },
  condition: "80%",
  conditionLabel: "สภาพดีมาก",
  price: "",
});

export default function PostProductPage() {
  const { token, userName, logout } = useAuth();
  const navigate = useNavigate();

  // ===== Global =====
  const [category, setCategory] = useState("เสื้อนักเรียน");
  const [school, setSchool] = useState("");
  const [gender, setGender] = useState("ทุกเพศ");

  // ===== Items =====
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [editIdx, setEditIdx] = useState(null); // index ที่กำลัง expand

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const fileRefs = useRef({});

  // ===== Helpers =====
  const updateItem = (idx, patch) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const addItem = () => {
    const newItem = EMPTY_ITEM();
    setItems((prev) => [...prev, newItem]);
    setEditIdx(items.length); // expand ใหม่ทันที
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setEditIdx(null);
  };

  const handleImageChange = (itemIdx, imgIdx, file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== itemIdx) return it;
        const newImgs = [...it.images];
        newImgs[imgIdx] = { file, url };
        return { ...it, images: newImgs };
      })
    );
  };

  const addImageSlot = (itemIdx) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx ? { ...it, images: [...it.images, null] } : it
      )
    );
  };

  const handleSubmit = async () => {
    setErr("");
    if (!items.length) return setErr("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
    for (let i = 0; i < items.length; i++) {
      if (!items[i].price) return setErr(`กรุณากรอกราคาในรายการที่ ${i + 1}`);
    }
    setSubmitting(true);
    try {
      // TODO: API call
      alert("✅ ลงขายสำเร็จ!");
      navigate("/");
    } finally {
      setSubmitting(false);
    }
  };

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
            <Link to="/projects">โครงการ</Link>
            <a href="#market">ร้านค้า</a>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><Link to="/sell" className="active">ลงขาย</Link></button>
          </nav>
          {rightAccount()}
        </div>
      </header>

      {/* ===== Blue Strip ===== */}
      <div style={{ background: "#87C7EB", height: "8px", width: "100vw", marginLeft: "calc(-50vw + 50%)" }} />

      {/* ===== Main ===== */}
      <div className="ppWrapper">
        <h1 className="ppPageTitle">สร้างรายการสินค้า</h1>

        <div className="ppCard">

          {/* ─── ① ข้อมูลหลัก ─── */}
          <section className="ppSection">
            <div className="ppSectionNo">1</div>
            <div className="ppSectionBody">
              <h2 className="ppSectionTitle">ข้อมูลหลัก</h2>

              <div className="ppRow">
                <label className="ppLabel">หมวดหมู่:</label>
                <div className="ppSelectWrap">
                  <select className="ppSelect" value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="ppRow">
                <label className="ppLabel">โรงเรียน (หากมี):</label>
                <input
                  className="ppInput"
                  placeholder="กรอกชื่อโรงเรียน"
                  value={school}
                  onChange={e => setSchool(e.target.value)}
                />
              </div>

              <div className="ppRow">
                <label className="ppLabel">เพศ:</label>
                <div className="ppSelectWrap">
                  <select className="ppSelect" value={gender} onChange={e => setGender(e.target.value)}>
                    {GENDERS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* ─── ② รายการสินค้า ─── */}
          <section className="ppSection">
            <div className="ppSectionNo">2</div>
            <div className="ppSectionBody">
              <div className="ppSectionTitleRow">
                <h2 className="ppSectionTitle">รายการสินค้า</h2>
                {editIdx !== null && (
                  <button className="ppEditToggle" onClick={() => setEditIdx(null)}>
                    ✏️ แก้ไข
                  </button>
                )}
              </div>

              {items.map((item, idx) => {
                const sizeCfg = TYPE_SIZES[item.type] || { show: ["chest"], labels: { chest: "อก" } };
                const isOpen = editIdx === idx;

                return (
                  <div key={item.id} className={`ppItemCard ${isOpen ? "ppItemCardOpen" : ""}`}>
                    {/* Header แถบ */}
                    <div className="ppItemHeader" onClick={() => setEditIdx(isOpen ? null : idx)}>
                      <span className="ppItemLabel">รายการที่ {idx + 1}</span>
                      <div className="ppItemHeaderRight">
                        <button
                          className="ppRemoveBtn"
                          onClick={e => { e.stopPropagation(); removeItem(idx); }}
                        >
                          ลบรายการ
                        </button>
                        <span className="ppItemChevron">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Body (collapse) */}
                    {isOpen && (
                      <div className="ppItemBody">
                        {/* รูปภาพ */}
                        <div className="ppImgSection">
                          <div className="ppImgLabel">เพิ่มภาพรายละเอียดสินค้า</div>
                          <div className="ppImgRow">
                            {item.images.map((img, imgIdx) => (
                              <label key={imgIdx} className="ppImgSlot">
                                {img
                                  ? <img src={img.url} alt="" className="ppImgPreview" />
                                  : (
                                    <div className="ppImgPlaceholder">
                                      <Icon icon="fluent:image-add-24-regular" width="32" color="#aaa" />
                                      <span>{imgIdx === 0 ? "ภาพสินค้าด้านหน้า" : "ภาพสินค้าด้านหลัง"}</span>
                                    </div>
                                  )
                                }
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={e => handleImageChange(idx, imgIdx, e.target.files?.[0])}
                                />
                              </label>
                            ))}
                            {item.images.length < 5 && (
                              <button className="ppImgAddBtn" onClick={() => addImageSlot(idx)}>
                                <Icon icon="fluent:add-circle-24-filled" width="28" color="#5285E8" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ประเภท */}
                        <div className="ppFieldRow">
                          <label className="ppFieldLabel">ประเภท:</label>
                          <div className="ppSelectWrap ppSelectSmall">
                            <select
                              className="ppSelect"
                              value={item.type}
                              onChange={e => updateItem(idx, { type: e.target.value })}
                            >
                              {ITEM_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* ระดับชั้น */}
                        <div className="ppFieldRow">
                          <label className="ppFieldLabel">ระดับชั้น:</label>
                          <div className="ppSelectWrap ppSelectSmall">
                            <select
                              className="ppSelect"
                              value={item.level}
                              onChange={e => updateItem(idx, { level: e.target.value })}
                            >
                              {LEVELS.map(l => <option key={l}>{l}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* ไซส์ */}
                        <div className="ppFieldRow ppFieldRowSizes">
                          <label className="ppFieldLabel">ไซส์:</label>
                          <div className="ppSizesGroup">
                            {sizeCfg.show.map(key => (
                              <div key={key} className="ppSizeItem">
                                <span className="ppSizeLabel">{sizeCfg.labels[key]}:</span>
                                <div className="ppSelectWrap ppSelectXS">
                                  <select
                                    className="ppSelect"
                                    value={item.sizes[key]}
                                    onChange={e => updateItem(idx, { sizes: { ...item.sizes, [key]: e.target.value } })}
                                  >
                                    {SIZE_OPTIONS[key].map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>
                                <span className="ppSizeUnit">นิ้ว</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* สภาพ + เพิ่มเติม */}
                        <div className="ppFieldRow">
                          <label className="ppFieldLabel">สภาพ:</label>
                          <div className="ppConditionGroup">
                            <div className="ppSelectWrap ppSelectSmall">
                              <select
                                className="ppSelect"
                                value={item.condition}
                                onChange={e => updateItem(idx, { condition: e.target.value })}
                              >
                                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                              </select>
                            </div>
                            <span className="ppFieldLabel" style={{ marginLeft: 16 }}>เพิ่มเติม</span>
                            <div className="ppSelectWrap ppSelectSmall">
                              <select
                                className="ppSelect"
                                value={item.conditionLabel}
                                onChange={e => updateItem(idx, { conditionLabel: e.target.value })}
                              >
                                {CONDITION_LABELS.map(c => <option key={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* ราคา */}
                        <div className="ppFieldRow">
                          <label className="ppFieldLabel">ราคา:</label>
                          <div className="ppPriceWrap">
                            <input
                              className="ppInput ppPriceInput"
                              type="number"
                              min="0"
                              placeholder="0"
                              value={item.price}
                              onChange={e => updateItem(idx, { price: e.target.value })}
                            />
                            <span className="ppFieldLabel">บาท</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Summary (when collapsed) */}
                    {!isOpen && (
                      <div className="ppItemSummary">
                        <span>{item.type}</span>
                        <span className="ppItemSummaryDot">·</span>
                        <span>{item.level}</span>
                        <span className="ppItemSummaryDot">·</span>
                        <span>
                          {sizeCfg.show.map(k => `${sizeCfg.labels[k]} ${item.sizes[k]}"`).join(" / ")}
                        </span>
                        <span className="ppItemSummaryDot">·</span>
                        <span>สภาพ {item.condition}</span>
                        {item.price && <><span className="ppItemSummaryDot">·</span><span className="ppItemPrice">{Number(item.price).toLocaleString()} บาท</span></>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ปุ่มเพิ่มรายการ */}
              <button className="ppAddItemBtn" onClick={addItem}>
                เพิ่มรายการสินค้า
              </button>
            </div>
          </section>

          {err && <div className="ppErr">{err}</div>}
        </div>

        {/* ===== ปุ่มลงขาย ===== */}
        <button className="ppSubmitBtn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "กำลังส่ง..." : "ลงขาย"}
        </button>
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
            <Link to="/#market">ร้านค้า</Link>
            <Link to="/#about">เกี่ยวกับเรา</Link>
            <Link to="/sell">ลงขาย</Link>
            </div>

          <div className="footCol">
            <div className="footTitle">ติดต่อเรา</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M9.55537 3.40517C11.5837 1.3885 14.9237 1.74684 16.622 4.01684L18.7254 6.8235C20.1087 8.67017 19.9854 11.2502 18.3437 12.8818L17.947 13.2785C17.9021 13.445 17.8975 13.6199 17.9337 13.7885C18.0387 14.4685 18.607 15.9085 20.987 18.2752C23.367 20.6418 24.817 21.2085 25.507 21.3152C25.6809 21.3501 25.8605 21.345 26.032 21.3002L26.712 20.6235C28.172 19.1735 30.412 18.9018 32.2187 19.8835L35.402 21.6168C38.1304 23.0968 38.8187 26.8035 36.5854 29.0252L34.217 31.3785C33.4704 32.1202 32.467 32.7385 31.2437 32.8535C28.227 33.1352 21.1987 32.7752 13.8104 25.4302C6.91537 18.5735 5.59204 12.5935 5.4237 9.64684C5.34037 8.15684 6.0437 6.89684 6.94037 6.00684L9.55537 3.40517ZM14.622 5.51517C13.777 4.38684 12.2037 4.29684 11.317 5.1785L8.70037 7.7785C8.15037 8.32517 7.88704 8.9285 7.92037 9.50517C8.0537 11.8468 9.12037 17.2418 15.5737 23.6585C22.3437 30.3885 28.5954 30.5902 31.012 30.3635C31.5054 30.3185 31.9954 30.0618 32.4537 29.6068L34.8204 27.2518C35.7837 26.2952 35.572 24.5518 34.2087 23.8118L31.0254 22.0802C30.1454 21.6035 29.1154 21.7602 28.4754 22.3968L27.717 23.1518L26.8337 22.2652C27.717 23.1518 27.7154 23.1535 27.7137 23.1535L27.712 23.1568L27.707 23.1618L27.6954 23.1718L27.6704 23.1952C27.6 23.2605 27.5242 23.3196 27.4437 23.3718C27.3104 23.4602 27.1337 23.5585 26.912 23.6402C26.462 23.8085 25.8654 23.8985 25.1287 23.7852C23.6837 23.5635 21.7687 22.5785 19.2237 20.0485C16.6804 17.5185 15.687 15.6152 15.4637 14.1718C15.3487 13.4352 15.4404 12.8385 15.6104 12.3885C15.7039 12.1353 15.8379 11.8989 16.007 11.6885L16.0604 11.6302L16.0837 11.6052L16.0937 11.5952L16.0987 11.5902L16.102 11.5868L16.582 11.1102C17.2954 10.3985 17.3954 9.22017 16.7237 8.32184L14.622 5.51517Z" fill="white" />
              </svg>
              <div id="contactfooter">062-379-0000</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M36.6663 10.0003C36.6663 8.16699 35.1663 6.66699 33.333 6.66699H6.66634C4.83301 6.66699 3.33301 8.16699 3.33301 10.0003V30.0003C3.33301 31.8337 4.83301 33.3337 6.66634 33.3337H33.333C35.1663 33.3337 36.6663 31.8337 36.6663 30.0003V10.0003ZM33.333 10.0003L19.9997 18.3337L6.66634 10.0003H33.333ZM33.333 30.0003H6.66634V13.3337L19.9997 21.667L33.333 13.3337V30.0003Z" fill="white" />
              </svg>
              <div id="contactfooter">contact@unieed.com</div>
            </div>
            <div className="connect">
              <div>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0)">
                    <path d="M40.0001 20.1221C40.0001 9.00707 31.0451 -0.00292969 20.0001 -0.00292969C8.95012 -0.000429687 -0.00488281 9.00707 -0.00488281 20.1246C-0.00488281 30.1671 7.31012 38.4921 16.8701 40.0021V25.9396H11.7951V20.1246H16.8751V15.6871C16.8751 10.6446 19.8626 7.85957 24.4301 7.85957C26.6201 7.85957 28.9076 8.25207 28.9076 8.25207V13.2021H26.3851C23.9026 13.2021 23.1276 14.7546 23.1276 16.3471V20.1221H28.6726L27.7876 25.9371H23.1251V39.9996C32.6851 38.4896 40.0001 30.1646 40.0001 20.1221Z" fill="white" />
                  </g>
                  <defs><clipPath id="clip0"><rect width="40" height="40" fill="white" /></clipPath></defs>
                </svg>
              </div>
              <div>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.33366 1.66699C6.56555 1.66699 4.86986 2.36937 3.61961 3.61961C2.36937 4.86986 1.66699 6.56555 1.66699 8.33366V31.667C1.66699 33.4351 2.36937 35.1308 3.61961 36.381C4.86986 37.6313 6.56555 38.3337 8.33366 38.3337H31.667C33.4351 38.3337 35.1308 37.6313 36.381 36.381C37.6313 35.1308 38.3337 33.4351 38.3337 31.667V8.33366C38.3337 6.56555 37.6313 4.86986 36.381 3.61961C35.1308 2.36937 33.4351 1.66699 31.667 1.66699H8.33366ZM20.0003 8.06699C13.2153 8.06699 7.50033 12.5403 7.50033 18.2953C7.50033 23.5603 12.2953 27.7587 18.2903 28.4287C18.3936 28.4372 18.4924 28.4747 18.5753 28.537C18.5987 28.5535 18.6182 28.5749 18.6325 28.5996C18.6469 28.6243 18.6558 28.6519 18.6587 28.6803C18.7162 29.5216 18.6051 30.3659 18.332 31.1637C18.2992 31.2498 18.2879 31.3425 18.2991 31.434C18.3102 31.5254 18.3435 31.6128 18.396 31.6885C18.4486 31.7642 18.5188 31.8259 18.6005 31.8683C18.6823 31.9107 18.7732 31.9326 18.8653 31.932C19.0237 31.932 19.2053 31.8837 19.3553 31.8387C19.557 31.7754 19.7556 31.7025 19.9503 31.6203C20.4003 31.4353 20.9737 31.167 21.6237 30.8253C22.9237 30.1453 24.5503 29.162 26.1453 27.952C27.737 26.7437 29.3153 25.2937 30.5003 23.677C31.6837 22.0603 32.5003 20.237 32.5003 18.2953C32.5003 12.5403 26.7853 8.06699 20.0003 8.06699ZM11.1937 21.4203V15.4537H12.8987V19.7153H15.4553V21.4203H11.1937ZM16.307 15.4537V21.4203H18.012V15.4537H16.307ZM18.5803 21.4203V15.4537H20.512L21.9887 18.2253V15.4553H23.6937V21.422H21.7603L20.2853 18.6503V21.4203H18.5803ZM27.9553 15.4537H24.262V21.4203H27.9553V19.717H25.9653V19.292H27.9553V17.5837H25.9653V17.157H27.9553V15.4537Z" fill="white" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}