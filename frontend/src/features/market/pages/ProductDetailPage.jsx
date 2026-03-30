// frontend/src/features/market/pages/ProductDetailPage.jsx
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import NotificationBell from "../../../pages/NotificationBell.jsx";
import CartIcon from "../components/CartIcon.jsx";
import { useCart } from "../context/CartContext.jsx";  // ✅ เพิ่ม
import "../styles/ProductDetailPage.css";

// ── helpers ──────────────────────────────────────────────
function SizeDisplay({ size, categoryId }) {
    if (!size) return <span className="pdNoData">ไม่ระบุ</span>;
    try {
        const s = JSON.parse(size);
        const cid = Number(categoryId);
        const parts = [];
        if (cid === 1) {
            if (s.chest && s.chest !== "0") parts.push(`อก ${s.chest}`);
            if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
        } else {
            if (s.waist && s.waist !== "0") parts.push(`เอว ${s.waist}`);
            if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
        }
        return parts.length
            ? <span>{parts.join(" | ")} นิ้ว</span>
            : <span className="pdNoData">ไม่ระบุ</span>;
    } catch {
        return <span>{size}</span>;
    }
}

function getCategoryLabel(categoryId, gender) {
    const cid = Number(categoryId);
    if (cid === 1) return gender === "male" ? "เสื้อนักเรียนชาย" : "เสื้อนักเรียนหญิง";
    if (cid === 2) return "กางเกงนักเรียน";
    if (cid === 3) return "กระโปรงนักเรียน";
    return "ชุดนักเรียน";
}

// ── Related Card ─────────────────────────────────────────
function RelatedCard({ product, navigate }) {
    const categoryLabel = getCategoryLabel(product.category_id, product.gender);
    const typePart = product.type_name?.trim();
    const title = typePart ? `${categoryLabel}: ${typePart}` : categoryLabel;
    const img = product.images?.[0]?.image_url || product.cover_image;

    return (
        <div className="pdRelCard" onClick={() => navigate(`/market/${product.product_id}`)}>
            <div className="pdRelThumb">
                {img
                    ? <img src={img} alt={title} loading="lazy" />
                    : <div className="pdRelPlaceholder"><Icon icon="mdi:tshirt-crew" /></div>
                }
                {product.quantity > 0 && (
                    <span className="pdRelBadge">{product.quantity} ชิ้น</span>
                )}
            </div>
            <div className="pdRelBody">
                <div className="pdRelTitle">{title}</div>
                {product.school_name && (
                    <div className="pdRelSchool">
                        <Icon icon="mdi:school-outline" /> {product.school_name}
                    </div>
                )}
                <div className="pdRelPrice">{Number(product.price).toLocaleString()} บาท</div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────
export default function ProductDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
     const location = useLocation();
  const isDonation = location.state?.isDonation;
  const donationAddress = location.state?.shippingAddress;
  const project = location.state?.project;

    const { token, role, userName } = useAuth();
    const { refreshCart } = useCart();
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
    const [product, setProduct] = useState(null);
    const [related, setRelated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imgIdx, setImgIdx] = useState(0);
    const [addingCart, setAddingCart] = useState(false);
    const [cartMsg, setCartMsg] = useState("");
    const [err, setErr] = useState("");

    // fetch product
    // แก้ใน ProductDetailPage.jsx — เฉพาะส่วน useEffect ที่ fetch related
    // แทนที่ useEffect เดิมทั้งหมดด้วยอันนี้

    useEffect(() => {
        setLoading(true);
        setImgIdx(0);
        setRelated([]);

        fetch(`/api/market/${id}`)
            .then(r => r.json())
            .then(data => {
                if (data.message) { setErr(data.message); return; }
                setProduct(data);

                // ── fetch related โดย filter ตาม category + gender + level ──
                const params = new URLSearchParams();
                if (data.category_id) params.set("category_id", data.category_id);
                if (data.gender) params.set("gender", data.gender);
                if (data.level) params.set("level", data.level);
                params.set("limit", "7");

                // ✅ โค้ดใหม่ (strict — ถ้าไม่มีก็ไม่แสดง)
                return fetch(`/api/market/${id}/related?${params}`)
                    .then(r => r.json())
                    .then(rows => setRelated(rows.slice(0, 6)));
            })
            .catch(() => setErr("ไม่สามารถโหลดข้อมูลสินค้าได้"))
            .finally(() => setLoading(false));
    }, [id]);
    const handleAddCart = async () => {
        if (!token) { navigate("/login"); return; }
        setAddingCart(true);
        try {
            const res = await fetch("/api/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ product_id: Number(id), quantity: 1 }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");

            await refreshCart();
            setCartMsg("เพิ่มลงตะกร้าแล้ว!");
            setTimeout(() => setCartMsg(""), 2500);
        } catch (e) {
            setCartMsg(e.message);
        } finally {
            setAddingCart(false);
        }
    };
    const handleBuyNow = async () => {
  if (!token) { navigate("/login"); return; }
  setAddingCart(true);

  try {
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ product_id: Number(id), quantity: 1 }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    await refreshCart();

    // 🔥 แยก logic
    if (isDonation) {
      navigate(`/checkout?items=${id}&type=product`, {
        state: {
          isDonation: true,
          shippingAddress: donationAddress,
          project_id: project?.project_id,
          project_title: project?.title,
        }
      });
    } else {
      navigate(`/checkout?items=${id}&type=product`);
    }

  } catch (e) {
    setCartMsg(e.message);
  } finally {
    setAddingCart(false);
  }
};

    const categoryLabel = product
        ? getCategoryLabel(product.category_id, product.gender)
        : "";
    const typePart = product?.type_name?.trim();
    const title = typePart ? `${categoryLabel}: ${typePart}` : categoryLabel;

    const condText = product
        ? [
            product.condition_percent ? `${product.condition_percent}%` : null,
            product.condition_label || null,
        ].filter(Boolean).join(" · ")
        : "";

    const images = product?.images || [];

    return (
        <div className="pdPage">
            {/* ── Navbar ── */}
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
                    {rightAccount()}
                </div>
            </header>

            <div className="pdContainer">
                {/* ── Breadcrumb ── */}
                <div className="pdBreadcrumb">
                    <Link to="/">หน้าหลัก</Link>
                    <Icon icon="mdi:chevron-right" />
                    <Link to="/market">ร้านค้า</Link>
                    <Icon icon="mdi:chevron-right" />
                    <span>{loading ? "..." : title}</span>
                </div>

                {loading ? (
                    <div className="pdLoading">
                        <Icon icon="mdi:loading" className="pdSpinner" />
                        <span>กำลังโหลด...</span>
                    </div>
                ) : err ? (
                    <div className="pdError">
                        <Icon icon="mdi:alert-circle-outline" />
                        <p>{err}</p>
                        <button onClick={() => navigate("/market")}>กลับไปร้านค้า</button>
                    </div>
                ) : product && (
                    <>
                        {/* ── Main Detail ── */}
                        <div className="pdMain">
                            {/* Images */}
                            <div className="pdImages">
                                <div className="pdMainImg">
                                    {images.length ? (
                                        <img src={images[imgIdx]?.image_url} alt={title} />
                                    ) : (
                                        <div className="pdImgPlaceholder">
                                            <Icon icon="mdi:tshirt-crew" />
                                        </div>
                                    )}
                                    {product.quantity > 0 && (
                                        <span className="pdStockBadge">{product.quantity} ชิ้น</span>
                                    )}
                                </div>
                                {images.length > 1 && (
                                    <div className="pdThumbs">
                                        {images.map((img, i) => (
                                            <div
                                                key={i}
                                                className={`pdThumb${i === imgIdx ? " pdThumbActive" : ""}`}
                                                onClick={() => setImgIdx(i)}
                                            >
                                                <img src={img.image_url} alt={`${title} ${i + 1}`} loading="lazy" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="pdInfo">
                                <h1 className="pdTitle">{title}</h1>

                                {product.school_name && (
                                    <div className="pdSchool">
                                        <Icon icon="mdi:school-outline" />
                                        {product.school_name}
                                    </div>
                                )}

                                <div className="pdPrice">
                                    {Number(product.price).toLocaleString()}
                                    <span> บาท</span>
                                </div>

                                {/* Details */}
                                <div className="pdDetails">
                                    <div className="pdDetailRow">
                                        <span className="pdDetailLabel">หมวดหมู่</span>
                                        <span className="pdDetailVal">{categoryLabel}</span>
                                    </div>
                                    {product.type_name && (
                                        <div className="pdDetailRow">
                                            <span className="pdDetailLabel">ประเภท</span>
                                            <span className="pdDetailVal">{product.type_name}</span>
                                        </div>
                                    )}
                                    {product.level && (
                                        <div className="pdDetailRow">
                                            <span className="pdDetailLabel">ระดับชั้น</span>
                                            <span className="pdDetailVal">
                                                <span className="pdBadgeLevel">{product.level}</span>
                                            </span>
                                        </div>
                                    )}
                                    <div className="pdDetailRow">
                                        <span className="pdDetailLabel">ขนาด</span>
                                        <span className="pdDetailVal">
                                            <SizeDisplay size={product.size} categoryId={product.category_id} />
                                        </span>
                                    </div>
                                    {condText && (
                                        <div className="pdDetailRow">
                                            <span className="pdDetailLabel">สภาพ</span>
                                            <span className="pdDetailVal">
                                                <span className="pdBadgeCond">{condText}</span>
                                            </span>
                                        </div>
                                    )}
                                    <div className="pdDetailRow">
                                        <span className="pdDetailLabel">จำนวน</span>
                                        <span className="pdDetailVal">{product.quantity} ชิ้น</span>
                                    </div>
                                </div>

                                {/* Description */}
                                {product.product_description && (
                                    <div className="pdDesc">
                                        <div className="pdDescLabel">รายละเอียดเพิ่มเติม</div>
                                        <p>{product.product_description}</p>
                                    </div>
                                )}

                                {/* Seller */}
                                <div className="pdSeller">
                                    <div className="pdSellerAvatar">
                                        {(product.seller_name || "?")[0].toUpperCase()}
                                    </div>
                                    <div className="pdSellerInfo">
                                        <div className="pdSellerName">{product.seller_name || "ไม่ระบุ"}</div>
                                        <div className="pdSellerLabel">ผู้ขาย</div>
                                    </div>
                                    {product.seller_phone && (
                                        <a href={`tel:${product.seller_phone}`} className="pdSellerPhone">
                                            <Icon icon="mdi:phone-outline" /> {product.seller_phone}
                                        </a>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="pdActions">
                                    <button
                                        className="pdCartBtn"
                                        onClick={handleAddCart}
                                        disabled={addingCart || product.quantity === 0}
                                    >
                                        {addingCart
                                            ? <Icon icon="mdi:loading" className="pdSpinner" />
                                            : <Icon icon="mdi:cart-plus" />
                                        }
                                        {product.quantity === 0 ? "สินค้าหมด" : "เพิ่มลงตะกร้า"}
                                    </button>
                                    <button
                                        className="pdBuyBtn"
                                        onClick={handleBuyNow}
                                        disabled={addingCart || product.quantity === 0}
                                    >
                                        <Icon icon="mdi:lightning-bolt" />
                                        ซื้อเลย
                                    </button>

                                    <Link to="/market" className="pdBackBtn">
                                        <Icon icon="mdi:arrow-left" /> กลับ
                                    </Link>
                                </div>

                                {cartMsg && (
                                    <div className={`pdCartMsg ${cartMsg.includes("แล้ว") ? "pdCartMsgOk" : "pdCartMsgErr"}`}>
                                        <Icon icon={cartMsg.includes("แล้ว") ? "mdi:check-circle" : "mdi:alert-circle"} />
                                        {cartMsg}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Related ── */}
                        {related.length > 0 && (
                            <section className="pdRelated">
                                <h2 className="pdRelatedTitle">สินค้าอื่นๆ ที่อาจถูกใจ</h2>
                                <div className="pdRelGrid">
                                    {related.map(p => (
                                        <RelatedCard key={p.product_id} product={p} navigate={navigate} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}