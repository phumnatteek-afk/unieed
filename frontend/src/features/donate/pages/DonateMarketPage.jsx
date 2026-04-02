import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import CartIcon from "../../market/components/CartIcon.jsx";
import "../../../pages/styles/Homepage.css";
import "../../market/styles/MarketPage.css";
import "../styles/DonateMarketPage.css";

// ── Image Carousel (เหมือน MarketPage) ──────────────────
function CardCarousel({ images = [], title, quantity }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [images]);

  const stockBadge = quantity > 0 && (
    <span className="mkStockBadge">{quantity} ชิ้น</span>
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
        <span className="mkStockBadge">{quantity} ชิ้น</span>
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

// ── helper: สร้าง label หมวดหมู่ ─────────────────────────
function getCategoryLabel(product) {
  const cid = Number(product.category_id);
  const gender = product.gender;
  if (cid === 1) return gender === "male" ? "เสื้อนักเรียนชาย" : "เสื้อนักเรียนหญิง";
  if (cid === 2) return gender === "male" ? "กางเกงนักเรียนชาย" : "กางเกงนักเรียนหญิง";
  if (cid === 3) return "กระโปรงนักเรียน";
  return "ชุดนักเรียน";
}

// ── helper: แปลง size JSON → ข้อความไทย ─────────────────
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

// ── Matched Product Card ──────────────────────────────────
function MatchedProductCard({ product, project, schoolInfo, projectId }) {
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
    <div className="mkCard">
      {/* badge ตรงกับโครงการ + match score */}
      <div className="dmMatchBadge">
        <Icon icon="mdi:check-decagram" /> ตรงกับที่โรงเรียนต้องการ
      </div>

      {/* รูปสินค้า */}
      <div className="mkCardThumb">
        <CardCarousel images={images} title={displayTitle} quantity={product.quantity} />
      </div>

      <div className="mkCardBody">
        {/* ชื่อสินค้า */}
        <div className="mkCardTitle">{displayTitle}</div>

        {/* โรงเรียนผู้ขาย (ถ้ามี) */}
        {product.school_name && (
          <div className="mkCardSchool">
            <Icon icon="mdi:school-outline" /> {product.school_name}
          </div>
        )}

        {/* ชื่อผู้ขาย */}
        {product.seller_name && (
          <div className="mkCardSeller">
            <Icon icon="mdi:account-outline" /> {product.seller_name}
          </div>
        )}

        {/* meta: ระดับ, ขนาด, สภาพ */}
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

        <div className="mkCardDivider" />

        {/* ราคา + ปุ่มซื้อ */}
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

  const rightAccount = () => {
    if (!token) return (
      <div className="navAuth">
        <Link className="navBtn navBtnOutline" to="/register">ลงทะเบียน</Link>
        <Link className="navBtn navBtnWhite" to="/login">เข้าสู่ระบบ</Link>
      </div>
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <NotificationBell />
        <ProfileDropdown />
        <CartIcon />
      </div>
    );
  };

  // ── ดึง project จาก public endpoint (ไม่ต้อง auth) ──
  useEffect(() => {
    if (!projectId || project) return;

    // route จริงใน backend: GET /school/projects/public/:request_id
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
          // normalize field names
          title:          data.request_title        || "",
          school_address: data.school_full_address  || data.school_address || "",
        });
      })
      .catch(err => {
        // ไม่ crash — banner จะดึงจาก school_info ของ matched endpoint แทน
        console.warn("ไม่สามารถโหลดโครงการได้", err.message);
      });
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
          // fallback: ถ้า project fetch ล้มเหลว ดึงจาก school_info แทน
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
        setProducts(data.products);
      })
      .catch(err => {
        console.error("[DonateMarketPage] matched error:", err);
        setError("โหลดสินค้าไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (error) return (
    <div className="dmErrorWrap">
      <Icon icon="mdi:alert-circle-outline" fontSize={48} />
      <p>{error}</p>
      <button onClick={() => navigate(-1)} className="mkResetBtn">กลับ</button>
    </div>
  );

  return (
    <div className="homePage">
      {/* ── Navbar ── */}
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
            <button><Link to="/sell">ลงขาย</Link></button>
          </nav>
          {rightAccount()}
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <section className="dmHero">
        <div className="dmHeroContent">
          {/* <button className="dmBackBtn" onClick={() => navigate(-1)}>
            <Icon icon="mdi:arrow-left" /> 
          </button> */}

          {project ? (
            <div className="dmHeroBody">

              {/* ── ซ้าย: ข้อมูลโครงการ ── */}
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
              </div>

              {/* ── ขวา: รายการที่โรงเรียนต้องการ ── */}
{needsSummary.length > 0 && (
  <div className="dmHeroNeeds">
    <div className="dmHeroNeedsTitle">
      <Icon icon="mdi:clipboard-list-outline" />
      รายการที่โรงเรียนต้องการ
      <span className="dmNeedsCount">{needsSummary.length} รายการ</span>
    </div>
    <div className="dmHeroNeedsList">
      {needsSummary.map((n, i) => {
        const sizeLabel = (() => {
          try {
            const s = typeof n.size === "string" ? JSON.parse(n.size) : (n.size || {});
            const parts = [];
            if (s.chest) parts.push(`อก ${s.chest}"`);
            if (s.waist) parts.push(`เอว ${s.waist}"`);
            return parts.join(" / ") || null;
          } catch { return null; }
        })();
        return (
          <div key={i} className="dmNeedItem">
            <Icon
              icon={n.gender === "male" ? "mdi:human-male" : "mdi:human-female"}
              className={`dmNeedGenderIcon ${n.gender}`}
            />
            <div className="dmNeedInfo">
              <span className="dmNeedTypeName">{n.type_name}</span>
              <span className="dmNeedMeta">
                {sizeLabel && <span>{sizeLabel}</span>}
                <span className="dmNeedQty">× {n.quantity_needed} ชิ้น</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
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
              <span className="mkListCount"> ({products.length} รายการ)</span>
            )}
          </h2>
          {noMatch && (
            <div className="dmNoMatchNote">
              <Icon icon="mdi:information-outline" />
              ยังไม่มีสินค้าที่ตรงกับรายการของโรงเรียนพอดี — แสดงสินค้าทั้งหมดให้เลือก
            </div>
          )}
        </div>

        {loading ? (
          <div className="mkLoadingGrid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mkCardSkeleton" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mkEmpty">
            <Icon icon="mdi:package-variant-remove" fontSize={56} />
            <p>ยังไม่มีสินค้าในขณะนี้</p>
            <button className="mkResetBtn" onClick={() => navigate("/market")} style={{ display: "inline-block" }}>
              ดูสินค้าทั้งหมด
            </button>
          </div>
        ) : (
          <div className="mkGrid">
            {products.map(p => (
              noMatch
                /* fallback: ใช้การ์ดปกติจาก MarketPage style ไม่มี match badge */
                ? <FallbackProductCard key={p.product_id} product={p} />
                /* matched: ใช้การ์ดพร้อม match badge + ปุ่มซื้อส่งต่อ */
                : <MatchedProductCard
                  key={p.product_id}
                  product={p}
                  project={project || {}}
                  schoolInfo={schoolInfo}
                  projectId={projectId}
                />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Fallback card (กรณีไม่มีสินค้า match → แสดงสินค้าทั้งหมดแบบปกติ) ──
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