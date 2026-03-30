// src/features/donate/pages/DonateMarketPage.jsx
// หน้าสินค้าที่แมชกับโครงการโรงเรียน (มาจากปุ่ม "ซื้อเพื่อส่งต่อ" ใน DonatePage)

import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import CartIcon from "../../market/components/CartIcon.jsx";
import "../../../pages/styles/Homepage.css";
import "../../market/styles/MarketPage.css";
import "../styles/DonateMarketPage.css";

// ── Image Carousel (ใช้ร่วมกับ MarketPage) ──────────────
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
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setIdx(i => (i - 1 + images.length) % images.length);
              }}
            >
              <Icon icon="mdi:chevron-left" />
            </button>
            <button
              className="mkCarouselArrow mkCarouselArrowRight"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setIdx(i => (i + 1) % images.length);
              }}
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
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setIdx(i);
              }}
            >
              <img src={img.image_url} alt={`${title} ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Matched Product Card ──────────────────────────────
function  MatchedProductCard({ product, project, schoolInfo, projectId }) {
  const navigate = useNavigate();

  const images = product.images?.length
    ? product.images
    : product.cover_image
    ? [{ image_url: product.cover_image }]
    : [];

  const categoryLabel = (() => {
    const cid = Number(product.category_id);
    if (cid === 1) return product.gender === "male" ? "เสื้อนักเรียนชาย" : "เสื้อนักเรียนหญิง";
    if (cid === 2) return "กางเกงนักเรียน";
    if (cid === 3) return "กระโปรงนักเรียน";
    return "ชุดนักเรียน";
  })();

  const typePart = product.type_name?.trim() || product.custom_type_name?.trim();
  const displayTitle = typePart ? `${categoryLabel}: ${typePart}` : categoryLabel;

  // ── กดซื้อ → ไป CheckoutPage พร้อมข้อมูลสินค้า + ที่อยู่โรงเรียน ──
  // const handleBuyNow = (e) => {
  //   e.stopPropagation();
  //   navigate("/checkout", {
  //     state: {
  //       // ข้อมูลสินค้า
  //       product: {
  //         product_id: product.product_id,
  //         title: displayTitle,
  //         price: product.price,
  //         quantity: 1,
  //         images,
  //         size: product.size,
  //         condition_label: product.condition_label,
  //         condition_percent: product.condition_percent,
  //       },
  //       // ที่อยู่โรงเรียน (ดึงจาก project)
  //       shippingAddress: {
  //         name: project.school_name,
  //         address: project.school_address,
  //         district: project.district,
  //         province: project.province,
  //         postal_code: project.postal_code,
  //         phone: project.contact_phone,
  //       },
  //       // บอกว่าเป็น donation checkout
  //       isDonation: true,
  //       project_id: project.project_id,
  //       project_title: project.title,
  //     },
  //   });
  // };
  const handleBuyNow = (e) => {
    e.stopPropagation();

    // ใช้ schoolInfo ที่ backend parse มาให้แล้ว (แยก field ครบ)
    // fallback ไปที่ project fields ถ้า schoolInfo ยังไม่มา
    const si = schoolInfo || project || {};
    const pid   = project?.request_id || project?.project_id || projectId;
    const title = project?.request_title || project?.title || "";

    navigate(`/checkout?items=${product.product_id}&type=product`, {
      state: {
        isDonation:    true,
        project_id:    pid,
        project_title: title,
        // 📍 ที่อยู่โรงเรียน — ใช้ field จาก school_info ที่ backend parse แล้ว
        shippingAddress: {
          name:        si.school_name    || project?.school_name || "",
          address:     si.address_line   || si.school_address    || "",
          district:    si.district       || "",
          province:    si.province       || "",
          postal_code: si.postal_code    || "",
          phone:       si.phone          || si.school_phone      || "",
        },
      },
    });
  };

  return (
    <div className="mkCard dmMatchCard">
      {/* Badge "แมชกับโครงการ" */}
      <div className="dmMatchBadge">
        <Icon icon="mdi:check-decagram" /> ตรงกับที่โรงเรียนต้องการ
      </div>

      <div className="mkCardThumb">
        <CardCarousel images={images} title={displayTitle} quantity={product.quantity} />
      </div>

      <div
        className="mkCardBody"
  onClick={(e) => e.stopPropagation()}
  style={{ cursor: "default" }}
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
          {(product.condition_percent || product.condition_label) && (
            <div className="mkMetaRow">
              <span className="mkMetaLabel">สภาพ</span>
              <span className="mkMetaVal">
                <span className="mkBadgeCond">
                  {[
                    product.condition_percent ? `${product.condition_percent}%` : null,
                    product.condition_label,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="mkCardDivider" />

        <div className="mkCardBottom">
          <div className="mkCardPrice">
            {Number(product.price).toLocaleString()}
            <span> บาท</span>
          </div>
        </div>
      </div>

      {/* ปุ่มซื้อเพื่อส่งต่อ */}
      <button
        className="dmBuyBtn"
        onClick={handleBuyNow}
        disabled={product.quantity === 0}
      >
        <Icon icon="mdi:gift-outline" />
        {product.quantity === 0 ? "สินค้าหมด" : "ซื้อเพื่อส่งต่อ"}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────
export default function DonateMarketPage() {
  const { projectId } = useParams();           // รับ project_id จาก URL เช่น /donate/:projectId/market
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [noMatch, setNoMatch] = useState(false);

  // project มาจาก location.state (ส่งมาจาก DonatePage)
  const [project, setProject] = useState(location.state?.project || null);
  const [products, setProducts] = useState([]);
  const [schoolInfo, setSchoolInfo] = useState(null); // ที่อยู่โรงเรียน parsed จาก backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  // ── ดึงสินค้าที่แมช — backend ส่ง { products, school_info } กลับมา ──
  useEffect(() => {
    if (!projectId) return;

    setLoading(true);

    fetch(`/api/market/matched?project_id=${projectId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // รับ school_info ที่ backend parse มาให้แล้ว
        if (data.school_info) {
          setSchoolInfo(data.school_info);
        }

        if (!data.products || data.products.length === 0) {
          setNoMatch(true);
          return fetch("/api/market")
            .then(r => r.json())
            .then(all => setProducts(all.products || []));
        }
        setProducts(data.products);
      })
      .catch(err => {
        console.error("[DonateMarketPage] matched error:", err);
        setError("โหลดสินค้าไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

//   useEffect(() => {
//   if (!location.state || location.state.mode !== "buy") return;

//   async function load() {
//     const request = await fetch(`/api/projects/${projectId}`)
//       .then(r => r.json());

//     const products = await fetch(`/api/market/products`)
//       .then(r => r.json());

//     const matched = products.filter(p =>
//       request.uniform_items.some(r => {
//         if (p.category_id !== r.category_id) return false;
//         if (p.gender !== r.gender) return false;

//         const pSize = JSON.parse(p.size || "{}");
//         const rSize = JSON.parse(r.size || "{}");

//         const chestOk = !pSize.chest || !rSize.chest || Math.abs(pSize.chest - rSize.chest) <= 1;
//         const waistOk = !pSize.waist || !rSize.waist || Math.abs(pSize.waist - rSize.waist) <= 1;

//         return chestOk && waistOk;
//       })
//     );

//     setProducts(matched);
//   }

//   load();
// }, [projectId, location.state]);

  if (error) {
    return (
      <div className="dmErrorWrap">
        <Icon icon="mdi:alert-circle-outline" fontSize={48} />
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="mkResetBtn">กลับ</button>
      </div>
    );
  }

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

      {/* ── Hero Banner โครงการ ── */}
      <section className="dmHero">
        <div className="dmHeroOverlay" />
        <div className="dmHeroContent">
          <button className="dmBackBtn" onClick={() => navigate(-1)}>
            <Icon icon="mdi:arrow-left" /> กลับไปหน้าโครงการ
          </button>
          {project ? (
            <>
              <div className="dmHeroSchool">
                <Icon icon="mdi:school" /> {project.school_name}
              </div>
              <h1 className="dmHeroTitle">{project.title}</h1>
              <p className="dmHeroSub">
                เลือกสินค้าด้านล่างที่ตรงกับรายการที่โรงเรียนต้องการ
              </p>

              {/* ── ที่อยู่โรงเรียน — ใช้ schoolInfo (parsed) หรือ school_address เต็ม ── */}
              <div className="dmSchoolAddress">
                <Icon icon="mdi:map-marker-outline" />
                <span>
                  {schoolInfo
                    ? [
                        schoolInfo.address_line,
                        schoolInfo.district ? `อ.${schoolInfo.district}` : "",
                        schoolInfo.province ? `จ.${schoolInfo.province}` : "",
                        schoolInfo.postal_code,
                      ].filter(Boolean).join(" ")
                    : project.school_address || project.school_full_address || ""}
                </span>
              </div>
            </>
          ) : (
            <div className="dmHeroLoading">
              <Icon icon="mdi:loading" className="mkSpinner" /> กำลังโหลดโครงการ...
            </div>
          )}
        </div>
      </section>

      {/* ── รายการสินค้าที่แมช ── */}
      <main className="mkMain dmMain">
        <div className="mkListHeader">
          <h2 className="mkListTitle">
            สินค้าที่ตรงกับความต้องการของโรงเรียน
            {!loading && (
              <span className="mkListCount"> ({products.length} รายการ)</span>
            )}
          </h2>
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
            <p>ยังไม่มีสินค้าที่ตรงกับรายการที่โรงเรียนต้องการในขณะนี้</p>
            <button
              className="mkResetBtn"
              onClick={() => navigate("/market")}
              style={{ display: "inline-block" }}
            >
              ดูสินค้าทั้งหมด
            </button>
          </div>
        ) : (
          <div className="mkGrid">
            {products.map(p => (
              <MatchedProductCard
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