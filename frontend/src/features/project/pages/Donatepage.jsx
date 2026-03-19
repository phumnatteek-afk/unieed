import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getJson, postJson } from "../../../api/http.js";
import { Icon } from "@iconify/react";

import "../../../pages/styles/Homepage.css";
import "../styles/DonatePage.css";

const COURIERS = ["ไปรษณีย์ไทย", "Flash Express", "J&T Express", "Kerry Express", "Lazada Logistics", "อื่นๆ"];

// ===== ตรวจจับประเภทชุดจาก uniform_category (field จาก API) =====
// uniform_category มาจาก uniform_type.uniform_category ใน DB
// fallback ตรวจจากชื่อถ้าไม่มี category
function detectUniformType(item) {
  const cat = (item.uniform_category || "").toLowerCase();
  if (cat.includes("skirt") || cat.includes("กระโปรง")) return "กระโปรง";
  if (cat.includes("pants") || cat.includes("กางเกง") || cat.includes("trouser")) return "กางเกง";
  if (cat.includes("shirt") || cat.includes("เสื้อ") || cat.includes("top")) return "เสื้อนักเรียน";

  // fallback: ตรวจจากชื่อ
  const name = (item.name || "").toLowerCase();
  if (name.includes("กระโปรง")) return "กระโปรง";
  if (name.includes("กางเกง")) return "กางเกง";
  return "เสื้อนักเรียน";
}

// ===== แปลง size JSON → ข้อความ =====
function formatSize(size) {
  if (!size) return "";
  try {
    const obj = typeof size === "string" ? JSON.parse(size) : size;
    const parts = [];
    if (obj.chest) parts.push(`อก ${obj.chest}"`);
    if (obj.waist) parts.push(`เอว ${obj.waist}"`);
    if (obj.length) parts.push(`ยาว ${obj.length}"`);
    return parts.length > 0 ? parts.join(" / ") : String(size);
  } catch {
    return String(size);
  }
}

const TAB_ICONS = {
  "เสื้อนักเรียน": "👔",
  "กระโปรง": "👗",
  "กางเกง": "👖",
};

export default function DonatePage() {
  const { token, userName, logout } = useAuth();
  const { requestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [donateMethod, setDonateMethod] = useState(params.get("method") || "parcel");

  // ===== Step 1 =====
  const [quantities, setQuantities] = useState({});
  const [uniformItems, setUniformItems] = useState([]);
  const [activeTypeTab, setActiveTypeTab] = useState("เสื้อนักเรียน");

  // ===== Step 2: Parcel =====
  const [courier, setCourier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [donorName, setDonorName] = useState(userName || "");

  // ===== Step 2: Drop-off =====
  const [appointDate, setAppointDate] = useState("");
  const [appointHour, setAppointHour] = useState("13");
  const [appointMin, setAppointMin] = useState("00");
  const [donorPhone, setDonorPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // สร้าง unique key สำหรับแต่ละ uniform item
  // API ไม่มี item_id — ใช้ composite key: uniform_type_id + education_level + size
  const itemKey = (item) =>
    `${item.uniform_type_id}_${item.education_level || "all"}_${JSON.stringify(item.size || "")}`;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson(`/school/projects/public/${requestId}`, false);
        setProject(data);

        // ดึง uniform_items จาก API จริง
        const items = Array.isArray(data.uniform_items) ? data.uniform_items : [];
        setUniformItems(items);

        // init quantities — ใช้ composite key เพราะ API ไม่มี item_id
        const init = {};
        items.forEach((item) => { init[itemKey(item)] = 0; });
        setQuantities(init);

        // set active tab เป็น tab แรกที่มีข้อมูล
        if (items.length > 0) {
          const firstType = detectUniformType(items[0]);
          setActiveTypeTab(firstType);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  // ===== grouping by type =====
  const itemsByType = useMemo(() => {
    const map = {};
    uniformItems.forEach((item) => {
      const type = detectUniformType(item);
      if (!map[type]) map[type] = [];
      map[type].push(item);
    });
    return map;
  }, [uniformItems]);

  const availableTabs = useMemo(
    () => ["เสื้อนักเรียน", "กระโปรง", "กางเกง"].filter((t) => itemsByType[t]?.length > 0),
    [itemsByType]
  );

  const currentItems = itemsByType[activeTypeTab] || [];

  const totalQty = Object.values(quantities).reduce((s, v) => s + v, 0);

  const setQty = (key, val) => {
    // หา item ด้วย itemKey เพราะ API ไม่ส่ง item_id
    const item = uniformItems.find((i) => itemKey(i) === key);
    // API ส่ง quantity = SUM(quantity_needed) รวม — ใช้เป็น cap สูงสุด
    const maxAllowed = item ? (Number(item.quantity) || 99) : 99;
    const clamped = Math.max(0, Math.min(Number(val) || 0, maxAllowed));
    setQuantities((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofImage(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setErr("");
    if (donateMethod === "parcel") {
      if (!courier) return setErr("กรุณาเลือกบริการขนส่ง");
      if (!trackingNo.trim()) return setErr("กรุณากรอกเลขพัสดุ");
      if (!donorName.trim()) return setErr("กรุณากรอกชื่อผู้บริจาค");
    } else {
      if (!appointDate) return setErr("กรุณาเลือกวันนัดหมาย");
      if (!donorName.trim()) return setErr("กรุณากรอกชื่อผู้บริจาค");
    }
    try {
      setSubmitting(true);
      alert("✅ ยืนยันการส่งต่อเรียบร้อยแล้ว! รอโรงเรียน approve เพื่อรับใบเซอร์");
      navigate(`/projects/${requestId}`);
    } catch (e) {
      setErr(e?.data?.message || e.message || "เกิดข้อผิดพลาด");
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

  if (loading) return (
    <div className="homePage">
      <div style={{ padding: "120px", textAlign: "center", color: "#888" }}>กำลังโหลด…</div>
    </div>
  );

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
            <a href="#market">ร้านค้า</a>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><a href="#" className="sell">ลงขาย</a></button>
          </nav>
          {rightAccount()}
        </div>
      </header>

      <div className="dpTopStrip" style={{ background: "#87C7EB", height: "8px", width: "100vw", marginLeft: "calc(-50vw + 50%)" }} />

      <div className="dnLayout">
        {/* LEFT */}
        <div className="dnLeft">
          <div className="dnProjectCard">
            <div className="dnProjectImg">
              {project?.request_image_url
                ? <img src={project.request_image_url} alt={project.school_name} />
                : <div className="dnProjectImgPlaceholder" />}
            </div>
            <div className="dnProjectInfo">
              <div className="dnProjectBadge">โครงการ</div>
              <div className="dnProjectTitle">{project?.request_title || "-"}</div>
              <div className="dnProjectSchool">{project?.school_name} {project?.school_address}</div>
              <div className="dnProjectFulfilled">
                ยอดบริจาคชุดปัจจุบัน <strong>{project?.total_fulfilled || 0}</strong> ชิ้น
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="dnRight">
          {/* Method tabs */}
          <div className="dnMethodTabs">
            <button
              className={`dnMethodTab ${donateMethod === "parcel" ? "dnMethodTabActive" : ""}`}
              onClick={() => { setDonateMethod("parcel"); setStep(1); }}
            >
              📦 จัดส่งพัสดุ
            </button>
            <button
              className={`dnMethodTab ${donateMethod === "dropoff" ? "dnMethodTabActive" : ""}`}
              onClick={() => { setDonateMethod("dropoff"); setStep(1); }}
            >
              🚶 Drop-off
            </button>
          </div>

          {/* ─── STEP 1: เลือกชุด ─── */}
          {step === 1 && (
            <div className="dnStep">
              <button className="dnBackBtn" onClick={() => navigate(`/projects/${requestId}`)}>
                ← ย้อนกลับ
              </button>

              <div className="dnStepTitle">ระบุรายการที่ต้องการบริจาค</div>

              {/* ── Type Tab Bar ── */}
              {availableTabs.length > 0 && (
                <div className="dnTypeTabs">
                  {availableTabs.map((tab) => {
                    const tabQty = (itemsByType[tab] || []).reduce(
                      (sum, item) => sum + (quantities[itemKey(item)] || 0), 0
                    );
                    return (
                      <button
                        key={tab}
                        className={`dnTypeTab ${activeTypeTab === tab ? "dnTypeTabActive" : ""}`}
                        onClick={() => setActiveTypeTab(tab)}
                      >
                        <span className="dnTypeTabIcon">{TAB_ICONS[tab] || "👕"}</span>
                        <span className="dnTypeTabLabel">{tab}</span>
                        {tabQty > 0 && (
                          <span className="dnTypeTabBadge">{tabQty}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── รายการชุดของ tab นั้น ── */}
              {currentItems.length === 0 ? (
                <div className="dnNoItems">ไม่มีรายการ{activeTypeTab}ในโครงการนี้</div>
              ) : (
                <div className="dnUniformList">
                  {currentItems.map((item) => {
                    const key = itemKey(item);
                    // API ส่ง quantity = SUM(quantity_needed) — ใช้เป็นยอดที่โรงเรียนต้องการทั้งหมด
                    const needed = Number(item.quantity) || 0;
                    const qty = quantities[key] || 0;
                    return (
                      <div key={key} className="dnUniformItem">
                        <div className="dnUniformImg">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.name} />
                            : <div className="dnUniformImgPlaceholder" />}
                        </div>
                        <div className="dnUniformInfo">
                          <div className="dnUniformName">
                            {item.name}
                            {item.size && (
                              <span className="dnUniformSize">{formatSize(item.size)}</span>
                            )}
                          </div>
                          <div className="dnUniformLevel">ระดับชั้น : {item.education_level || "-"}</div>
                          <div className="dnUniformRemain">โรงเรียนต้องการ {needed} ชิ้น</div>
                        </div>
                        <div className="dnQtyControl">
                          <button
                            className="dnQtyBtn"
                            onClick={() => setQty(key, qty - 1)}
                            disabled={qty <= 0}
                          >−</button>
                          <span className="dnQtyNum">{qty}</span>
                          <button
                            className="dnQtyBtn"
                            onClick={() => setQty(key, qty + 1)}
                            disabled={qty >= needed}
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Summary ── */}
              <div className="dnTotalSummary">
                <div className="dnTotalRow">
                  {availableTabs.map((tab) => {
                    const tabQty = (itemsByType[tab] || []).reduce(
                      (sum, item) => sum + (quantities[itemKey(item)] || 0), 0
                    );
                    if (tabQty === 0) return null;
                    return (
                      <div key={tab} className="dnTotalChip">
                        {TAB_ICONS[tab]} {tab} <strong>{tabQty}</strong> ชิ้น
                      </div>
                    );
                  })}
                </div>
                <div className="dnTotal">
                  ยอดรวมชุดบริจาคทั้งหมด : <strong>{totalQty} ชิ้น</strong>
                </div>
              </div>

              <div className="dnStepActions">
                <button
                  className="dnNextBtn"
                  onClick={() => {
                    if (totalQty === 0) return setErr("กรุณาเลือกจำนวนชุดอย่างน้อย 1 ชิ้น");
                    setErr("");
                    setStep(2);
                  }}
                >
                  ถัดไป →
                </button>
              </div>
              {err && <div className="dnErr">{err}</div>}
            </div>
          )}

          {/* ─── STEP 2: Parcel ─── */}
          {step === 2 && donateMethod === "parcel" && (
            <div className="dnStep">
              <button className="dnBackBtn" onClick={() => setStep(1)}>← ย้อนกลับ</button>
              <div className="dnStepTitle">ที่อยู่สำหรับจ่าหน้าพัสดุ</div>

              <div className="dnAddressBox">
                <div className="dnAddressText">
                  โครงการ "{project?.request_title}"<br />
                  {project?.school_name} {project?.school_address}
                </div>
                <button
                  className="dnCopyBtn"
                  onClick={() => {
                    const addr = `โครงการ "${project?.request_title}" ${project?.school_name} ${project?.school_address}`;
                    navigator.clipboard.writeText(addr);
                    alert("คัดลอกที่อยู่แล้ว!");
                  }}
                >
                  <Icon icon="fluent:copy-20-filled" width="20" />
                </button>
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">เลือกบริการขนส่งที่จัดส่ง</label>
                <select className="dnSelect" value={courier} onChange={e => setCourier(e.target.value)}>
                  <option value="">เลือกขนส่ง</option>
                  {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">กรอกเลขพัสดุ</label>
                <input className="dnInput" value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="เลข Tracking" />
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">อัปโหลดหลักฐานการจัดส่งพัสดุ</label>
                <label className="dnUploadBox">
                  {proofPreview
                    ? <img src={proofPreview} alt="proof" className="dnProofImg" />
                    : <><Icon icon="fluent:image-add-20-filled" width="36" color="#aaa" /><span>เพิ่มรูปภาพ</span></>}
                  <input type="file" accept="image/*" onChange={handleProofChange} style={{ display: "none" }} />
                </label>
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">ชื่อ - นามสกุลผู้บริจาค</label>
                <input className="dnInput" value={donorName} onChange={e => setDonorName(e.target.value)} placeholder="ชื่อ-นามสกุล (ใช้สำหรับออกใบเซอร์)" />
              </div>

              {err && <div className="dnErr">{err}</div>}
              <button className="dnSubmitBtn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "กำลังส่ง..." : "ยืนยันการส่งต่อ"}
              </button>
              <div className="dnCertNote">*รับใบเกียรติบัตรเมื่อโรงเรียนยืนยันการรับของแล้ว*</div>
            </div>
          )}

          {/* ─── STEP 2: Drop-off ─── */}
          {step === 2 && donateMethod === "dropoff" && (
            <div className="dnStep">
              <button className="dnBackBtn" onClick={() => setStep(1)}>← ย้อนกลับ</button>
              <div className="dnStepTitle">เลือกวันและเวลานัดหมาย</div>

              <div className="dnInfoBox">
                <Icon icon="fluent:location-20-filled" width="20" color="#FFBE1B" />
                <div>
                  <div className="dnInfoLabel">สถานที่รับ</div>
                  <div className="dnInfoVal">{project?.school_name}</div>
                  <div className="dnInfoSub">{project?.school_address}</div>
                </div>
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">วันที่ต้องการ</label>
                <div className="dnDateWrap">
                  <input
                    className="dnInput"
                    type="date"
                    value={appointDate}
                    onChange={e => setAppointDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <div className="dnDateIcon">
                    <Icon icon="fluent:calendar-20-filled" width="18" color="#fff" />
                  </div>
                </div>
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">เวลา</label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <select className="dnSelect" style={{ flex: 1 }} value={appointHour} onChange={e => setAppointHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <select className="dnSelect" style={{ flex: 1 }} value={appointMin} onChange={e => setAppointMin(e.target.value)}>
                    {["00", "15", "30", "45"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">ข้อมูลติดต่อผู้บริจาค</label>
                <input className="dnInput" value={donorPhone} onChange={e => setDonorPhone(e.target.value)} placeholder="เบอร์โทร" inputMode="numeric" />
              </div>

              <div className="dnFormGroup">
                <label className="dnLabel">กรอกชื่อผู้บริจาค</label>
                <input className="dnInput" value={donorName} onChange={e => setDonorName(e.target.value)} placeholder="ชื่อ-นามสกุล (ใช้สำหรับออกใบเซอร์)" />
              </div>

              {err && <div className="dnErr">{err}</div>}
              <button className="dnSubmitBtn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "กำลังส่ง..." : "ยืนยันการนัดหมาย"}
              </button>
              <div className="dnCertNote">*รับใบเกียรติบัตรเมื่อโรงเรียนยืนยันการรับของแล้ว*</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}