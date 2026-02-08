import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getJson } from "../api/http.js";
import "./styles/Homepage.css";
// icon
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faPhone, faEnvelope} from '@fortawesome/free-solid-svg-icons'
import { faFacebook, faLine } from '@fortawesome/free-brands-svg-icons';
<link rel='stylesheet' href='https://cdn-uicons.flaticon.com/3.0.0/uicons-regular-rounded/css/uicons-regular-rounded.css'></link>

export default function HomePage() {
    const { token, role, userName, logout } = useAuth();

    const [stats, setStats] = useState({ products_total: 0, schools_approved: 0, total_paid: 0 });
    const [projects, setProjects] = useState([]);
    const [products, setProducts] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);

    const [q, setQ] = useState("");

    // ===== Projects carousel (page-based, 2 cards/page)
    const [projPage, setProjPage] = useState(0);
    const [isSliding, setIsSliding] = useState(false);
    function formatThaiDate(dateStr) {
        if (!dateStr) return "";

        const date = new Date(dateStr);

        return date.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }
    // ===== Testimonials slider
    const [tsIndex, setTsIndex] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const data = await getJson("/home", false);

                setStats(data.stats || {});
                setProjects(Array.isArray(data.projects) ? data.projects : []);
                setProducts(Array.isArray(data.products) ? data.products : []);
                setTestimonials(Array.isArray(data.testimonials) ? data.testimonials : []);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ถ้าข้อมูล projects/testimonials เปลี่ยน (โหลดมาใหม่) ให้รีเซ็ต index ป้องกัน out-of-range
    useEffect(() => {
        setProjPage(0);
        setIsSliding(false);
    }, [projects.length]);

    useEffect(() => {
        setTsIndex(0);
    }, [testimonials.length]);

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
                <span className="hello">สวัสดี, {userName || "ผู้ใช้"}</span>
                <button className="navBtn navBtnOutline" onClick={logout}>ออกจากระบบ</button>
            </div>
        );
    };

    // ===== Projects paging logic
    const perPage = 2;
    const projPages = useMemo(() => {
        const len = projects?.length || 0;
        return Math.max(1, Math.ceil(len / perPage));
    }, [projects]);

    const goPrev = () => {
        if (isSliding || projPages <= 1) return;
        setIsSliding(true);
        setProjPage((p) => (p - 1 + projPages) % projPages);
    };

    const goNext = () => {
        if (isSliding || projPages <= 1) return;
        setIsSliding(true);
        setProjPage((p) => (p + 1) % projPages);
    };

    // ===== Testimonials logic (วนลูป ไม่ติดลบ)
    const currentTs = useMemo(() => {
        const a = testimonials || [];
        if (!a.length) return null;
        const idx = ((tsIndex % a.length) + a.length) % a.length;
        return a[idx];
    }, [testimonials, tsIndex]);

    const tsPrev = () => {
        const len = testimonials.length;
        if (len <= 1) return;
        setTsIndex((i) => (i - 1 + len) % len);
    };

    const tsNext = () => {
        const len = testimonials.length;
        if (len <= 1) return;
        setTsIndex((i) => (i + 1) % len);
    };

    const steps = [
        { no: 1, pic:"/src/unieed_pic/st1.png", title: "เตรียมชุดนักเรียน", desc: "เช็คสภาพชุด ทำความสะอาด พร้อมแพ็คให้กล่องเรียบร้อย" },
        { no: 2, pic:"/src/unieed_pic/st2.png", title: "ส่งตรงถึงโรงเรียน", desc: "ค้นหาโรงเรียนที่ต้องการตามไซส์ที่คุณมี" },
        { no: 3, pic:"/src/unieed_pic/st3.png", title: "ส่งของ", desc: "แพ็คใส่กล่อง จัดส่ง / Drop-off ที่โรงเรียนกำหนด" },
    ];

    return (
        <div className="homePage">
            {/* ===== Top Header + Search ===== */}
            <header className="topBar">
                <div className="topRow">
                    <Link to="/" className="brand">
                        <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
                    </Link>

                    <nav className="navLinks">
                        <a href="#home" className="active">หน้าหลัก</a>
                        <a href="#projects">โครงการ</a>
                        <a href="#market">ร้านค้า</a>
                        <a href="#about">เกี่ยวกับเรา</a>
                    </nav>

                    {rightAccount()}
                </div>

                <div className="searchRow">
                    <div className="searchBox">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="ค้นหาโครงการหรือสิ่งของที่ต้องการบริจาค..."
                        />
                        <button className="searchBtn" type="button" aria-label="search">
      <FontAwesomeIcon icon={faMagnifyingGlass} />
    </button>
                    </div>
                </div>
            </header>

            {/* ===== Hero ===== */}
            <section id="home" className="hero">
                <div className="heroInner">
                    <div className="heroLeft">
                        <h1>เสื้อตัวเก่าของคุณ...</h1>
                        <p className="heroSub">
                            คือ <span>ชุดเก่งตัวใหม่ของน้อง</span>
                        </p>

                        <div className="heroActions">
                            <a className="pill pillYellow" href="#projects">🎁 บริจาคชุดนักเรียน</a>
                            <a className="pill pillWhite" href="#market">🛒 เลือกซื้อชุดมือสอง</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== Stats ===== */}
            <section className="stats">
                <h2>ร่วมสร้างการเปลี่ยนแปลงไปกับ Unieed</h2>
                <p className="sub">ตัวเลขแหล่งการแบ่งปันที่เกิดขึ้นจริงจากทุกคนในปี 2569</p>

                <div className="statGrid">
                    <div className="statCard statBlue">
                        <div className="statIcon">👔</div>
                        <div className="statValue">{stats.products_total || 0}</div>
                        <div className="statLabel">ชุดนักเรียนที่ส่งต่อแล้ว</div>
                    </div>

                    <div className="statCard statGreen">
                        <div className="statIcon">🏫</div>
                        <div className="statValue">{stats.schools_approved || 0}</div>
                        <div className="statLabel">โรงเรียนที่เข้าร่วมโครงการ</div>
                    </div>

                    <div className="statCard statYellow">
                        <div className="statIcon">🐷</div>
                        <div className="statValue">฿{Number(stats.total_paid || 0).toLocaleString()}</div>
                        <div className="statLabel">ช่วยประหยัดค่าใช้จ่าย</div>
                    </div>
                </div>
            </section>

            {/* ===== Steps ===== */}
            <section className="steps">
                <div className="stepsWrap">
                    <div className="stepsSide">
                        <div className="stepsBig">3 ขั้นตอน !<br/>บริจาคง่ายๆ</div>
                        <div className="stepsHint">กรณีมีชุดอยู่แล้ว</div>
                    </div>

                    <div className="stepsCards">
                        {steps.map((s) => (
                            <div className="stepCard" key={s.no}>
                                <div className="stepPic"><img src={s.pic}/></div>
                                {/* <div className="stepNo">{s.no}.</div> */}
                                <div className="stepTitle">{s.no}. {s.title}</div>
                                <div className="stepDesc">{s.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== Projects (Smooth Carousel) ===== */}
            <section id="projects" className="section sectionBlue">
                <div className="sectionHead">
                    <h3>โครงการขอรับบริจาค <span><i class="fi fi-rs-school"></i></span></h3>
                    <button className="btnGhost" type="button">ดูทั้งหมด</button>
                </div>

                {loading ? (
                    <div className="muted">กำลังโหลด…</div>
                ) : (
                    <div className="carouselRow">
                        <button
                            className="navArrow"
                            onClick={goPrev}
                            disabled={isSliding || projPages <= 1}
                            aria-label="prev"
                        >
                            ‹
                        </button>

                        <div className="carouselViewport">
                            {!projects.length ? (
                                <div className="muted">ยังไม่มีโครงการในระบบ </div>
                            ) : (
                                <div
                                    className="carouselTrack"
                                    style={{ transform: `translateX(-${projPage * 100}%)` }}
                                    onTransitionEnd={() => setIsSliding(false)}
                                >
                                    {Array.from({ length: projPages }).map((_, pageIndex) => {
                                        const start = pageIndex * perPage;
                                        const slice = projects.slice(start, start + perPage);

                                        return (
                                            <div className="carouselPage" key={pageIndex}>
                                                {slice.map((p) => (
                                                    <div className="projCard" key={p.request_id}>
                                                        <div className="thumb">
                                                            {p.request_image_url ? (
                                                                <img src={p.request_image_url} alt={p.request_title} />
                                                            ) : (
                                                                <div className="thumbPlaceholder" />
                                                            )}
                                                        </div>

                                                        <div className="projBody">
                                                            <div className="projTitle">{p.request_title}</div>
                                                            <div className="projMeta">
                                                                <span>{p.school_name}</span>
                                                                <span> จ.{p.school_address}</span>
                                                            </div>

                                                            <div className="projBottom">
                                                                <div className="projFilled">
                                                                    ยอดบริจาคปัจจุบัน <span><b>{p.total_fulfilled || 0}</b></span> ชิ้น
                                                                </div>
                                                                <button className="btnSend" type="button">ส่งต่อ</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {slice.length < 2 && <div className="projCard projCardGhost" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            className="navArrow"
                            onClick={goNext}
                            disabled={isSliding || projPages <= 1}
                            aria-label="next"
                        >
                            ›
                        </button>
                    </div>
                )}
            </section>

            {/* ===== Market ===== */}
            <section id="market" className="section">
                <div className="sectionHead">
                    <h3>ตลาดชุดนักเรียนมือสอง</h3>
                    <button className="btnGhost" type="button">ดูทั้งหมด</button>
                </div>

                {loading ? (
                    <div className="muted">กำลังโหลด…</div>
                ) : (
                    <div className="grid3">
                        {products.map((x) => (
                            <div className="productCard" key={x.product_id}>
                                <div className="pThumb">
                                    {x.cover_image ? (
                                        <img src={x.cover_image} alt={x.product_title} />
                                    ) : (
                                        <div className="thumbPlaceholder" />
                                    )}
                                </div>

                                <div className="pBody">
                                    <div className="pTitle">{x.product_title}</div>
                                    <div className="pMeta">
                                        <span>ขนาด: {x.size_label || "-"} </span>
                                        <span>
                                              สภาพ: <span className="condPct"> {x.condition_percent} %</span> {x.condition || "-"}
                                        </span>
                                    </div>

                                    <div className="pBottom">
                                        <div className="pPrice">{Number(x.price || 0).toLocaleString()} บาท</div>
                                        <button className="cartBtn" type="button" aria-label="cart"><i class="fi fi-rr-shopping-cart-add"></i></button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {!products.length && <div className="muted">ยังไม่มีสินค้าในระบบ</div>}
                    </div>
                )}
            </section>

            {/* ===== Testimonials ===== */}
            <section className="section sectionSoftBlue">
                <div className="sectionHead">
                    <h3>ความประทับใจจากโรงเรียน</h3>
                </div>

                {!currentTs ? (
                    <div className="muted">ยังไม่มีรีวิวจากโรงเรียน</div>
                ) : (
                    <div className="tsWrap">
                        <button className="tsArrow tsArrowLeft" onClick={tsPrev} aria-label="prev">‹</button>

                        <div className="tsCard">
                            <div className="tsLeft">
                                <div className="tsSchool">{currentTs.school_name}ได้รับชุดแล้ว!</div>
                                <div className="tsDate">
                                    {formatThaiDate(currentTs.review_date)}
                                </div>
                                <div className="tsText">{currentTs.review_text}</div>
                            </div>

                            <div className="tsRight">
                                {currentTs.image_url ? (
                                    <img src={currentTs.image_url} alt={currentTs.school_name} />
                                ) : (
                                    <div className="thumbPlaceholder" />
                                )}
                            </div>
                        </div>
                        <button className="tsArrow tsArrowRight" onClick={tsNext} aria-label="next">›</button>
                        <div className="tsDots">
                            {testimonials.slice(0, 3).map((_, i) => (
                                <span key={i} className={`dot ${i === (tsIndex % 3) ? "active" : ""}`} />
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* ===== Footer ===== */}
            <footer id="about" className="footer">
                <div className="footerInner">
                    <div className="footBrand">
                        <div>
                            <img className="footLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
                            <div className="footDesc">
                                แพลตฟอร์มส่งต่อแบ่งปันชุดนักเรียน<br />
                                เพื่อมอบโอกาสทางการศึกษาให้กับนักเรียน
                            </div>
                        </div>
                    </div>

                    <div className="footCol">
                        <div className="footTitle">เมนูลัด</div>
                        <a href="#home">หน้าหลัก</a>
                        <a href="#projects">โครงการ</a>
                        <a href="#market">ร้านค้า</a>
                        <a href="#about">เกี่ยวกับเรา</a>
                    </div>

                    <div className="footCol">
                        <div className="footTitle">ติดต่อเรา</div>
                        <div><FontAwesomeIcon icon={faPhone} /> 062-379-0000</div>
                        <div><FontAwesomeIcon icon={faEnvelope} /> contact@unieed.com</div>
                        <div className="connect">
                            <div><FontAwesomeIcon icon={faFacebook} /> </div>
                            <div><FontAwesomeIcon icon={faLine} /></div>
                        </div>

                    </div>
                </div>
            </footer>
        </div>
    );
}
