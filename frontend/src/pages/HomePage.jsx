import React, { useMemo, useState } from "react";
import "./styles/Homepage.css";
import { Link } from "react-router-dom";

export default function HomePage() {
  // ===== Mock data (ค่อยเปลี่ยนเป็นดึงจาก API ได้) =====
  const stats = { donatedSets: 300, helpedKids: 120 };

  const projects = useMemo(
    () => [
      {
        id: 1,
        title: "ขอรับบริจาคชุดนักเรียน ปีการศึกษา 2569",
        school: "โรงเรียนบ้านสมมติ",
        need: 12,
        img: "https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1200&q=60",
      },
      {
        id: 2,
        title: "ขอรับบริจาคชุดนักเรียนหญิง ปีการศึกษา 2569",
        school: "โรงเรียนตัวอย่าง",
        need: 40,
        img: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=60",
      },
      {
        id: 3,
        title: "ขอรับบริจาคชุดพละนักเรียน ปีการศึกษา 2569",
        school: "โรงเรียนทดสอบ",
        need: 18,
        img: "https://images.unsplash.com/photo-1544986581-efac024faf62?auto=format&fit=crop&w=1200&q=60",
      },
    ],
    []
  );

  const products = useMemo(
    () => [
      {
        id: 101,
        name: "เสื้อนักเรียนชาย ตราสมอ",
        school: "ตราโรงเรียนวิทยา",
        price: 80,
        condition: "สภาพ 80% ขึ้นไป",
        img: "https://images.unsplash.com/photo-1520975693411-b76f2d0a5a58?auto=format&fit=crop&w=1200&q=60",
      },
      {
        id: 102,
        name: "เสื้อเนตรนารี",
        school: "—",
        price: 100,
        condition: "สภาพ 90%",
        img: "https://images.unsplash.com/photo-1520975958225-cc1c6b1b147b?auto=format&fit=crop&w=1200&q=60",
      },
      {
        id: 103,
        name: "เสื้อนักเรียนชาย ตราสมอ",
        school: "ตราโรงเรียนวิทยา",
        price: 80,
        condition: "สภาพ 80% ขึ้นไป",
        img: "https://images.unsplash.com/photo-1520975748751-3f43708d3d18?auto=format&fit=crop&w=1200&q=60",
      },
      {
        id: 104,
        name: "กางเกงนักเรียนรัฐบาล",
        school: "—",
        price: 80,
        condition: "สภาพ 90%",
        img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=60",
      },
      {
        id: 105,
        name: "กางเกงนักเรียนเอกชน",
        school: "—",
        price: 80,
        condition: "สภาพ 80% ขึ้นไป",
        img: "https://images.unsplash.com/photo-1520975869014-7f1a6a5a7c66?auto=format&fit=crop&w=1200&q=60",
      },
      {
        id: 106,
        name: "เสื้อนักเรียนหญิง ตราสมอ",
        school: "ตราโรงเรียนบ้านสมมติ",
        price: 150,
        condition: "สภาพ 80% ขึ้นไป",
        img: "https://images.unsplash.com/photo-1520975755100-58a6a6b0d6c1?auto=format&fit=crop&w=1200&q=60",
      },
    ],
    []
  );

  const categories = useMemo(
    () => [
      { key: "uniform", label: "ชุดนักเรียน", icon: "👔" },
      { key: "pe", label: "ชุดพละ", icon: "👕" },
      { key: "scout", label: "ชุดลูกเสือ-เนตรนารี", icon: "🧢" },
      { key: "activity", label: "ชุดกิจกรรม", icon: "🎽" },
    ],
    []
  );

  // ===== UI state =====
  const [projectIndex, setProjectIndex] = useState(0);

  const prevProject = () =>
    setProjectIndex((i) => (i - 1 + projects.length) % projects.length);
  const nextProject = () =>
    setProjectIndex((i) => (i + 1) % projects.length);

  const activeProject = projects[projectIndex];

  return (
    <div className="hp">
      {/* ===== Top bar ===== */}
      <header className="hpHeader">
        <div className="hpNav">
          <div className="hpBrand">
            <div className="hpLogoBox" aria-label="Unieed logo">
              <span className="hpLogoMark">✉️</span>
            </div>
            <span className="hpBrandName">Unieed</span>
          </div>

          <nav className="hpMenu">
            <a className="hpMenuItem isActive" href="#home">
              หน้าหลัก
            </a>
            <a className="hpMenuItem" href="#market">
              ร้านค้า
            </a>
            <a className="hpMenuItem" href="#projects">
              โครงการ
            </a>
            <a className="hpMenuItem" href="#about">
              เกี่ยวกับเรา
            </a>
          </nav>

          <div className="hpRight">
            <button className="hpBell" aria-label="notifications">
              🔔
            </button>
            <div className="hpUser">
              <div className="hpAvatar" aria-hidden="true">
                👤
              </div>
              <div className="hpUserMeta">
                <div className="hpUserName">คุณชื่อ ผู้ใช้</div>
                <div className="hpUserRole">บุคคลทั่วไป</div>
              </div>
              <span className="hpCaret">▾</span>
            </div>
    
  <Link className="hpLoginBtn" to="/login">
    เข้าสู่ระบบ
  </Link>
   <Link className="hpRegisterBtn" to="/register">
    ลงทะเบียน
  </Link>

          </div>
        </div>

        {/* Search bar */}
        <div className="hpSearchRow">
          <div className="hpSearch">
            <input
              className="hpSearchInput"
              placeholder="ค้นหาโครงการหรือสิ่งที่ต้องการบริจาค..."
            />
            <button className="hpSearchBtn" aria-label="search">
              🔍
            </button>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="hpHero" id="home">
        <div
          className="hpHeroBg"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1603357465999-241beecc2629?auto=format&fit=crop&w=1800&q=60)",
          }}
        />
        <div className="hpHeroOverlay" />

        <div className="hpHeroContent">
          <div className="hpHeroText">
            <div className="hpHeroTitle">
              <span className="hpHeroTitleMain">พลังการส่งต่อ</span>
              <span className="hpHeroTitleSub">ของพวกเรา</span>
            </div>

            <div className="hpHeroStats">
              <div className="hpStatCard hpStatDark">
                <div className="hpStatLabel">บริจาคแล้ว</div>
                <div className="hpStatValue">
                  {stats.donatedSets}
                  <span className="hpStatUnit">ชุด</span>
                </div>
              </div>
              <div className="hpStatCard hpStatGold">
                <div className="hpStatLabel">ช่วยเหลือเด็กได้</div>
                <div className="hpStatValue">
                  {stats.helpedKids}
                  <span className="hpStatUnit">คน</span>
                </div>
              </div>
            </div>
          </div>

          {/* optional: you can add CTA buttons here */}
        </div>
      </section>

      {/* ===== Donation Projects ===== */}
      <section className="hpSection" id="projects">
        <div className="hpSectionHead">
          <h2 className="hpSectionTitle">
            โครงการขอรับบริจาค <span className="hpSectionIcon">🏫</span>
          </h2>
          <button className="hpPillBtn">ดูทั้งหมด</button>
        </div>

        <div className="hpCarousel">
          <button className="hpArrow" onClick={prevProject} aria-label="prev">
            ‹
          </button>

          <div className="hpProjectGrid">
            {/* Left card */}
            <div className="hpProjectCard">
              <div
                className="hpProjectImg"
                style={{ backgroundImage: `url(${activeProject.img})` }}
              />
              <div className="hpProjectBody">
                <div className="hpProjectTag">โครงการ</div>
                <div className="hpProjectTitle">{activeProject.title}</div>
                <div className="hpProjectMeta">
                  <span className="hpProjectSchool">{activeProject.school}</span>
                </div>
                <div className="hpProjectNeed">
                  ยอดของที่ต้องการรวม <b>{activeProject.need}</b> ชิ้น
                </div>

                <div className="hpProjectActions">
                  <Link className="hpBtnPrimary" to="/projects">
                    ส่งต่อ
                  </Link>
                </div>
              </div>
            </div>

            {/* Right preview card (ถ้าอยากให้เหมือนภาพมากขึ้น ให้โชว์การ์ด 2 ใบ) */}
            <div className="hpProjectCard hpProjectCardGhost">
              <div
                className="hpProjectImg"
                style={{
                  backgroundImage: `url(${
                    projects[(projectIndex + 1) % projects.length].img
                  })`,
                }}
              />
              <div className="hpProjectBody">
                <div className="hpProjectTag">โครงการ</div>
                <div className="hpProjectTitle">
                  {projects[(projectIndex + 1) % projects.length].title}
                </div>
                <div className="hpProjectNeed">
                  ยอดของที่ต้องการรวม{" "}
                  <b>{projects[(projectIndex + 1) % projects.length].need}</b>{" "}
                  ชิ้น
                </div>
                <div className="hpProjectActions">
                  <button className="hpBtnPrimary" onClick={nextProject}>
                    ส่งต่อ
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button className="hpArrow" onClick={nextProject} aria-label="next">
            ›
          </button>
        </div>

        <div className="hpDots">
          {projects.map((_, idx) => (
            <span
              key={idx}
              className={`hpDot ${idx === projectIndex ? "isOn" : ""}`}
            />
          ))}
        </div>
      </section>

      {/* ===== Marketplace ===== */}
      <section className="hpSection" id="market">
        <h2 className="hpSectionTitleCenter">ตลาดเครื่องแบบนักเรียนมือสอง</h2>

        <div className="hpCategoryBlock">
          <div className="hpCategoryHead">
            <div className="hpCategoryTitle">หมวดหมู่</div>
            <button className="hpPillBtn">ดูทั้งหมด</button>
          </div>

          <div className="hpCategoryRow">
            {categories.map((c) => (
              <button key={c.key} className="hpCategoryBtn" type="button">
                <div className="hpCategoryIcon">{c.icon}</div>
                <div className="hpCategoryLabel">{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="hpProducts">
          {products.map((p) => (
            <div className="hpProductCard" key={p.id}>
              <div
                className="hpProductImg"
                style={{ backgroundImage: `url(${p.img})` }}
              />
              <div className="hpProductBody">
                <div className="hpProductName">{p.name}</div>
                <div className="hpProductSchool">{p.school}</div>

                <div className="hpProductBadges">
                  <span className="hpBadge">id: {p.id}</span>
                  <span className="hpBadge">{p.condition}</span>
                </div>

                <div className="hpProductBottom">
                  <div className="hpProductPrice">
                    {p.price} <span className="hpCurrency">บาท</span>
                  </div>

                  <div className="hpProductActions">
                    <button className="hpBtnOutline" type="button">
                      ใส่ตะกร้า
                    </button>
                    <button className="hpBtnPrimarySmall" type="button">
                      ซื้อเลย
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating cart */}
      <button className="hpCartFloat" aria-label="cart">
        🛒
      </button>

      {/* Footer */}
      <footer className="hpFooter" id="about">
        <div className="hpFooterInner">
          <div className="hpFooterLeft">
            <div className="hpFooterBrand">
              <div className="hpLogoBox isFooter">
                <span className="hpLogoMark">✉️</span>
              </div>
              <div>
                <div className="hpBrandNameFooter">Unieed</div>
                <div className="hpFooterNote">แพลตฟอร์มส่งต่อชุดนักเรียนมือสอง</div>
              </div>
            </div>
          </div>

          <div className="hpFooterRight">
            <div className="hpFooterTitle">ติดต่อ</div>
            <div className="hpFooterLine">โทร 062-379-0000</div>
            <div className="hpFooterLine">อีเมล xxxx@gmail.com</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
