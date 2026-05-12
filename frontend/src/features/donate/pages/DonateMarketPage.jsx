import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import Navbar from "../../../pages/Navbar.jsx";
import "../../../pages/styles/Homepage.css";
import "../../market/styles/MarketPage.css";
import "../styles/DonateMarketPage.css";

// ── Image Carousel ──────────────────────────────────────
function CardCarousel({ images = [], title, quantity }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [images]);

  const stockBadge = quantity > 0 && (
    <span className="mkStockBadge">{quantity} ตัว</span>
  );

  if (!images.length) return (
    <div className="mkCarouselWrap">
      <div className="mkCarouselMain" style={{ position: "relative" }}>
        <div className="mkCardThumbPlaceholder" />
        {stockBadge}
      </div>
    </div>
  );

  return (
    <div className="mkCarouselWrap" style={{ position: "relative" }}>
      {quantity > 0 && (
        <span className="mkStockBadge">{quantity} ตัว</span>
      )}
      <div className="mkCarouselMain">
        <img
          src={images[idx]?.image_url}
          alt={title}
          className="mkCarouselImg"
          loading="lazy"
        />
        {images.length > 1 && (
          <>
            <button
              className="mkCarouselArrow mkCarouselArrowLeft"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
            >
              <Icon icon="mdi:chevron-left" />
            </button>
            <button
              className="mkCarouselArrow mkCarouselArrowRight"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
            >
              <Icon icon="mdi:chevron-right" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mkCarouselThumbs">
          {images.map((img, i) => (
            <div
              key={i}
              className={`mkCarouselThumb${i === idx ? " mkCarouselThumbActive" : ""}`}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setIdx(i); }}
            >
              <img src={img.image_url} alt={`${title} ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────
function getCategoryLabel(product) {
  const cid = Number(product.category_id);
  const gender = product.gender;
  if (cid === 1) return gender === "male" ? "เสื้อนักเรียนชาย" : "เสื้อนักเรียนหญิง";
  if (cid === 2) return gender === "male" ? "กางเกงนักเรียนชาย" : "กางเกงนักเรียนหญิง";
  if (cid === 3) return "กระโปรงนักเรียน";
  return "ชุดนักเรียน";
}

function formatSize(sizeRaw) {
  try {
    const s = typeof sizeRaw === "string" ? JSON.parse(sizeRaw) : sizeRaw || {};
    const parts = [];
    if (s.chest) parts.push(`อก ${s.chest}`);
    if (s.waist) parts.push(`เอว ${s.waist}`);
    if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
    return parts.join(" | ") || null;
  } catch { return null; }
}

// หา need item ที่ตรงกับ product
function findNeedForProduct(product, needsSummary = []) {
  if (!needsSummary.length) return null;
  const cid = Number(product.category_id);
  const gender = product.gender;
  return needsSummary.find(n => {
    const ncid = Number(n.category_id);
    if (ncid && ncid !== cid) return false;
    if (n.gender && gender && n.gender !== gender) return false;
    return true;
  }) || null;
}

// ── Matched Product Card ──────────────────────────────────
function MatchedProductCard({ product, project, schoolInfo, projectId, needItem }) {
  const navigate = useNavigate();

  const images = product.images?.length
    ? product.images
    : product.cover_image
      ? [{ image_url: product.cover_image }]
      : [];

  const categoryLabel = getCategoryLabel(product);
  const typePart = product.type_name?.trim() || product.custom_type_name?.trim();
  const displayTitle = typePart ? `${categoryLabel}: ${typePart}` : categoryLabel;
  const sizeLabel = formatSize(product.size);

  const handleBuyNow = (e) => {
    e.stopPropagation();
    const si = schoolInfo || project || {};
    const pid = project?.request_id || project?.project_id || projectId;
    const title = project?.request_title || project?.title || "";

    navigate(`/checkout?items=${product.product_id}&type=product`, {
      state: {
        isDonation: true,
        project_id: pid,
        project_title: title,
        shippingAddress: {
          name: si.school_name || project?.school_name || "",
          address: si.address_line || si.school_address || "",
          district: si.district || "",
          province: si.province || "",
          postal_code: si.postal_code || "",
          phone: si.phone || si.school_phone || "",
        },
      },
    });
  };

  return (
    <div className="mkCard dmMatchCard" onClick={() => navigate(`/market/${product.product_id}`)}>
      {/* badge ตรงกับโครงการ */}
      <div className="dmMatchBadge">
        <Icon icon="mdi:check-decagram" /> ตรงกับที่โรงเรียนต้องการ
      </div>

      {/* รูปสินค้า */}
      <div className="mkCardThumb" onClick={e => e.stopPropagation()}>
        <CardCarousel images={images} title={displayTitle} quantity={product.quantity} />
      </div>

      <div className="mkCardBody" onClick={e => e.stopPropagation()}>
        {/* ชื่อสินค้า */}
        <div className="mkCardTitle">{displayTitle}</div>

        {product.school_name && (
          <div className="mkCardSchool">
            <Icon icon="mdi:school-outline" /> {product.school_name}
          </div>
        )}
        {product.seller_name && (
          <div className="mkCardSeller">
            <Icon icon="mdi:account-outline" /> {product.seller_name}
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
          {sizeLabel && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">ขนาด</span>
              <span className="mkMetaVal">{sizeLabel}</span>
            </div>
          )}
          {(product.condition_percent || product.condition_label) && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">สภาพ</span>
              <span className="mkMetaVal">
                <span className="mkBadgeCond">
                  {[
                    product.condition_percent ? `${product.condition_percent}%` : null,
                    product.condition_label,
                  ].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>
          )}
          {product.shipping_name && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">ส่งผ่าน</span>
              <span className="mkMetaVal">
                {product.shipping_name}
                {product.shipping_price > 0
                  ? ` (+${Number(product.shipping_price).toLocaleString()} บาท)`
                  : " (ฟรี)"}
              </span>
            </div>
          )}
        </div>

        {/* need count badge */}
        {needItem && Number(needItem.quantity_needed) > 0 && (
          <div className="dmNeedCountBadge">
            <Icon icon="mdi:hand-heart-outline" />
            โรงเรียนต้องการ <strong>{Number(needItem.quantity_needed).toLocaleString()}</strong> ชิ้น
          </div>
        )}

        <div className="mkCardDivider" />

        <div className="mkCardBottom">
          <div className="mkCardPrice">
            {Number(product.price).toLocaleString()}
            <span> บาท</span>
          </div>
          <button
            className="dmBuyBtnInline"
            onClick={handleBuyNow}
            disabled={product.quantity === 0}
            title="ซื้อเพื่อส่งต่อให้โรงเรียน"
          >
            <Icon icon="mdi:gift-outline" />
            {product.quantity === 0 ? "หมด" : "ซื้อส่งต่อ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Filter categories ────────────────────────────────────
const FILTER_TABS = [
  { key: "all",     label: "ทั้งหมด",           icon: "mdi:view-grid-outline" },
  { key: "shirt_m", label: "เสื้อนักเรียนชาย",          icon: "mdi:tshirt-crew-outline" },
  { key: "shirt_f", label: "เสื้อนักเรียนหญิง",         icon: "mdi:tshirt-crew-outline" },
  { key: "pants",   label: "กางเกงนักเรียน",     icon: "mdi:human-male" },
  { key: "skirt",   label: "กระโปรงนักเรียน",   icon: "mdi:human-female" },
];

function filterKey(product) {
  const cid = Number(product.category_id);
  const g   = product.gender;
  if (cid === 1) return g === "male" ? "shirt_m" : "shirt_f";
  if (cid === 2) return "pants";
  if (cid === 3) return "skirt";
  return "other";
}

// ── Main Page ─────────────────────────────────────────────
export default function DonateMarketPage() {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [project, setProject] = useState(location.state?.project || null);
  const [products, setProducts] = useState([]);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noMatch, setNoMatch] = useState(false);
  const [needsSummary, setNeedsSummary] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  // ── ดึง project ──
  useEffect(() => {
    if (!projectId || project) return;
    fetch(`/school/projects/public/${projectId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error("Not JSON");
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setProject({
          ...data,
          title:          data.request_title        || "",
          school_address: data.school_full_address  || data.school_address || "",
        });
      })
      .catch(err => console.warn("ไม่สามารถโหลดโครงการได้", err.message));
  }, [projectId, project, token]);

  // ── ดึงสินค้าที่แมช ──
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    fetch(`/api/market/matched?project_id=${projectId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (data.school_info) {
          setSchoolInfo(data.school_info);
          setProject(prev => prev ? prev : {
            school_name:    data.school_info.school_name,
            school_address: data.school_info.school_address,
            school_phone:   data.school_info.phone,
            request_title:  "",
            title:          "",
          });
        }
        if (data.needs_summary) setNeedsSummary(data.needs_summary);

        if (!data.products || data.products.length === 0) {
          setNoMatch(true);
          return fetch("/api/market")
            .then(r => r.json())
            .then(all => setProducts(all.products || []));
        }
        setNoMatch(false);
        // เรียงตามความต้องการมากสุดก่อน
        const sorted = [...(data.products || [])].sort((a, b) => {
          const na = findNeedForProduct(a, data.needs_summary || []);
          const nb = findNeedForProduct(b, data.needs_summary || []);
          return (Number(nb?.quantity_needed) || 0) - (Number(na?.quantity_needed) || 0);
        });
        setProducts(sorted);
      })
      .catch(err => {
        console.error("[DonateMarketPage] matched error:", err);
        setError("โหลดสินค้าไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // ── คำนวณ dashboard (ใช้ field เดียวกับ ProjectDetailPage) ──
  const totalNeeded    = Number(project?.total_needed    || 0);
  const totalFulfilled = Number(project?.total_received  || 0);
  const totalRemaining = Math.max(totalNeeded - totalFulfilled, 0);
  const pct = totalNeeded > 0 ? Math.min(Math.round((totalFulfilled / totalNeeded) * 100), 100) : 0;

  // ── filter products ──
  const displayProducts = useMemo(() => {
    if (noMatch || activeTab === "all") return products;
    return products.filter(p => filterKey(p) === activeTab);
  }, [products, activeTab, noMatch]);

  // ── count per tab ──
  const tabCounts = useMemo(() => {
    const counts = { all: products.length };
    FILTER_TABS.slice(1).forEach(t => {
      counts[t.key] = products.filter(p => filterKey(p) === t.key).length;
    });
    return counts;
  }, [products]);

  if (error) return (
    <div className="dmErrorWrap">
      <Icon icon="mdi:alert-circle-outline" fontSize={48} />
      <p>{error}</p>
      <button onClick={() => navigate(-1)} className="mkResetBtn">กลับ</button>
    </div>
  );

  const coverImg = project?.request_image_url || schoolInfo?.cover_image;

  return (
    <div className="homePage">
      {/* ── Navbar ── */}
      <Navbar activeLink="projects" />

      {/* ── Hero Banner ── */}
      <section
        className="dmHero"
        style={coverImg ? { backgroundImage: `url(${coverImg})` } : {}}
      >
        <div className="dmHeroBgOverlay" />
        <div className="dmHeroContent">
          {project ? (
            <div className="dmHeroBody">
              {/* ── ซ้าย: ข้อมูลโครงการ + progress ── */}
              <div className="dmHeroLeft">
                <div className="dmHeroSchoolBadge">
                  <Icon icon="mdi:school" />
                  <span>{project.school_name}</span>
                </div>
                <h1 className="dmHeroTitle">
                  {project.request_title || project.title || "โครงการรับบริจาคชุดนักเรียน"}
                </h1>
                <div className="dmHeroAddress">
                  <Icon icon="mdi:map-marker-outline" />
                  <span>
                    {schoolInfo
                      ? [schoolInfo.address_line, schoolInfo.district, schoolInfo.province, schoolInfo.postal_code]
                          .filter(Boolean).join(" ")
                      : project.school_full_address || project.school_address || ""}
                  </span>
                </div>
                {(schoolInfo?.phone || project.school_phone) && (
                  <div className="dmHeroPhone">
                    <Icon icon="mdi:phone-outline" />
                    <span>{schoolInfo?.phone || project.school_phone}</span>
                  </div>
                )}

                {/* Progress bar */}
                {totalNeeded > 0 && (
                  <div className="dmHeroProgress">
                    <div className="dmHeroProgressTop">
                      <span>ได้รับแล้ว {totalFulfilled.toLocaleString()} / {totalNeeded.toLocaleString()} ชุด</span>
                      <span className="dmHeroProgressPct">{pct}%</span>
                    </div>
                    <div className="dmHeroProgressTrack">
                      <div className="dmHeroProgressFill" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="dmHeroProgressSub">
                      บริจาคแล้ว {pct}% จากเป้าหมาย
                    </p>
                  </div>
                )}
              </div>

              {/* ── ขวา: dashboard ── */}
              <div className="dmHeroRight">
                {/* Dashboard สรุป */}
                <div className="dmDashboard" onClick={() => navigate(`/projects/${projectId}`)} style={{ cursor: "pointer" }}>
                  <div>
                    <div className="dmDashCard dmDashCardBlue">
                      <div className="dmDashIcon"><Icon icon="mdi:clipboard-list-outline" /></div>
                      <div className="dmDashVal">{totalNeeded.toLocaleString()}</div>
                      <div className="dmDashLabel">รายการที่ต้องการ</div>
                    </div>
                    <div className="dmDashCard dmDashCardOrange">
                      <div className="dmDashIcon"><Icon icon="mdi:package-variant-closed" /></div>
                      <div className="dmDashVal">{totalRemaining.toLocaleString()}</div>
                      <div className="dmDashLabel">ชิ้นที่ยังขาด</div>
                    </div>
                  </div>
                  <div className="dmDashHint">
                    <Icon icon="mdi:arrow-right-circle-outline" />
                    <span>ดูรายละเอียดโครงการ</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="dmHeroLoading">
              <Icon icon="mdi:loading" className="mkSpinner" /> กำลังโหลด...
            </div>
          )}
        </div>
      </section>

      {/* ── รายการสินค้า ── */}
      <main className="mkMain dmMain">
        <div className="mkListHeader">
          <h2 className="mkListTitle">
            {noMatch ? "สินค้าทั้งหมด" : "สินค้าที่ตรงกับความต้องการของโรงเรียน"}
            {!loading && (
              <span className="mkListCount"> ({displayProducts.length} รายการ)</span>
            )}
          </h2>
          {noMatch && (
            <div className="dmNoMatchNote">
              <Icon icon="mdi:information-outline" />
              ยังไม่มีสินค้าที่ตรงกับรายการของโรงเรียนพอดี — แสดงสินค้าทั้งหมดให้เลือก
            </div>
          )}
        </div>

        {/* ── Filter Tabs ── */}
        {!noMatch && !loading && products.length > 0 && (
          <div className="dmFilterTabs">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                className={`dmFilterTab${activeTab === tab.key ? " dmFilterTabActive" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon icon={tab.icon} />
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className="dmFilterTabCount">{tabCounts[tab.key]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="mkLoadingGrid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mkCardSkeleton" />
            ))}
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="mkEmpty">
            <Icon icon="mdi:package-variant-remove" fontSize={56} />
            <p>
              {activeTab !== "all"
                ? "ไม่มีสินค้าประเภทนี้ในขณะนี้"
                : "ยังไม่มีสินค้าในขณะนี้"}
            </p>
            {activeTab !== "all" && (
              <button className="mkResetBtn" onClick={() => setActiveTab("all")} style={{ display: "inline-block" }}>
                ดูสินค้าทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <div className="mkGrid">
            {displayProducts.map(p =>
              noMatch
                ? <FallbackProductCard key={p.product_id} product={p} />
                : <MatchedProductCard
                    key={p.product_id}
                    product={p}
                    project={project || {}}
                    schoolInfo={schoolInfo}
                    projectId={projectId}
                    needItem={findNeedForProduct(p, needsSummary)}
                  />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Fallback card ──
function FallbackProductCard({ product }) {
  const navigate = useNavigate();
  const images = product.images?.length ? product.images : product.cover_image ? [{ image_url: product.cover_image }] : [];
  const catLabel = getCategoryLabel(product);
  const typePart = product.type_name?.trim() || product.custom_type_name?.trim();
  const title = typePart ? `${catLabel}: ${typePart}` : catLabel;
  const sizeLabel = formatSize(product.size);

  return (
    <div className="mkCard" onClick={() => navigate(`/market/${product.product_id}`)}>
      <div className="mkCardThumb">
        <CardCarousel images={images} title={title} quantity={product.quantity} />
      </div>
      <div className="mkCardBody">
        <div className="mkCardTitle">{title}</div>
        {product.school_name && (
          <div className="mkCardSchool"><Icon icon="mdi:school-outline" /> {product.school_name}</div>
        )}
        <div className="mkMeta">
          {product.level && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">ระดับ</span>
              <span className="mkMetaVal"><span className="mkBadgeLevel">{product.level}</span></span>
            </div>
          )}
          {sizeLabel && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">ขนาด</span>
              <span className="mkMetaVal">{sizeLabel}</span>
            </div>
          )}
          {(product.condition_percent || product.condition_label) && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">สภาพ</span>
              <span className="mkMetaVal">
                <span className="mkBadgeCond">
                  {[product.condition_percent ? `${product.condition_percent}%` : null, product.condition_label].filter(Boolean).join(" · ")}
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
            onClick={e => { e.stopPropagation(); navigate(`/market/${product.product_id}`); }}
          >
            <Icon icon="mdi:cart-outline" />
          </button>
        </div>
      </div>
    </div>
  );
}
