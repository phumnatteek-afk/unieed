import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getJson } from "../api/http.js";
import { Icon } from "@iconify/react";
import "./styles/Homepage.css";
import "./styles/ProjectDetail.css";

export default function ProjectDetailPage() {
  const { token, userName, logout } = useAuth();
  const { requestId } = useParams();
  const navigate = useNavigate();
  

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("detail"); // "detail" | "review"

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getJson(`/school/projects/public/${requestId}`, false);
        setProject(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

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
        <button className="navBtn navBtnOutline" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
    );
  };

  const needed = project?.total_needed || 0;
  const fulfilled = project?.total_fulfilled || 0;
  const remaining = Math.max(needed - fulfilled, 0);
  const pct = needed > 0 ? Math.min(Math.round((fulfilled / needed) * 100), 100) : 0;

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
            <Link to="/projects" className="active">โครงการ</Link>
            <a href="#market">ร้านค้า</a>
            <a href="#about">เกี่ยวกับเรา</a>
            <button><a href="#" className="sell">ลงขาย</a></button>
          </nav>
          {rightAccount()}
        </div>
      </header>

      {/* ===== Blue strip under header ===== */}
      <div className="pdTopStrip" />

      {/* ===== Main content ===== */}
      <div className="pdWrapper">
        {loading ? (
          <div className="muted" style={{ padding: "60px", textAlign: "center" }}>กำลังโหลด…</div>
        ) : !project ? (
          <div className="muted" style={{ padding: "60px", textAlign: "center" }}>ไม่พบโครงการนี้</div>
        ) : (
          <>
            {/* ===== Hero Card ===== */}
            <div className="pdHeroCard">
              {/* Left: image + stats */}
              <div className="pdLeft">
                <div className="pdImgWrap">
                  {project.request_image_url
                    ? <img src={project.request_image_url} alt={project.school_name} />
                    : <div className="pdImgPlaceholder" />}
                </div>

                <div className="pdStatRow">
                  <div className="pdStatLabel">ยอดบริจาคชุดปัจจุบัน</div>
                  <div className="pdStatValue">{fulfilled} ชิ้น</div>
                </div>

                <div className="pdStatBoxes">
                  <div className="pdStatBox pdStatBoxBlue">
                    <Icon icon="fluent:shirt-20-filled" width="28" height="28" />
                    <div>
                      <div className="pdBoxSub">จำนวนชุดที่ต้องการทั้งหมด</div>
                      <div className="pdBoxVal">{needed} ชิ้น</div>
                    </div>
                  </div>
                  <div className="pdStatBox pdStatBoxYellow">
                    <Icon icon="fluent:shirt-20-filled" width="28" height="28" />
                    <div>
                      <div className="pdBoxSub">ต้องการชุดอีก</div>
                      <div className="pdBoxVal">{remaining} ชิ้น</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: info + donate button */}
              <div className="pdRight">
                <div className="pdBadge">โครงการขอรับบริจาคชุดนักเรียน</div>

                <h1 className="pdSchoolName">{project.school_name}</h1>
                <p className="pdTitle">{project.request_title}</p>

                <div className="pdLocation">
                  <Icon icon="fluent:location-20-filled" width="20" />
                  <span>{project.school_address || "-"}</span>
                </div>

                {project.request_description && (
                  <blockquote className="pdQuote">
                    "{project.request_description}"
                  </blockquote>
                )}

                <div className="pdProgressLabel">
                  <span>ช่องทางการส่งต่อ</span>
                </div>

                <div className="pdChannels">
                  <div className="pdChannel">
                    <Icon icon="fluent:vehicle-truck-20-filled" width="20" />
                    <span>จัดส่งพัสดุ</span>
                  </div>
                  <div className="pdChannel">
                    <Icon icon="fluent:person-walking-20-filled" width="20" />
                    <span>ไปส่งเอง (Drop-off)</span>
                  </div>
                </div>

                <button
                  className="pdDonateBtn"
                  onClick={() => navigate(`/donate/${requestId}`)}
                >
                  ส่งต่อ
                </button>

                <p className="pdNote">*รับเกียรติบัตรออนไลน์ เพียงอัปโหลดหลักฐานการส่งต่อของท่าน*</p>
              </div>
            </div>

            {/* ===== Tabs ===== */}
            <div className="pdTabs">
              <button
                className={`pdTab ${activeTab === "detail" ? "pdTabActive" : ""}`}
                onClick={() => setActiveTab("detail")}
              >
                รายละเอียด
              </button>
              <button
                className={`pdTab ${activeTab === "review" ? "pdTabActive" : ""}`}
                onClick={() => setActiveTab("review")}
              >
                ความประทับใจจากโรงเรียน
              </button>
            </div>
            <div className="pdTabLine" />

            {/* ===== Tab Content ===== */}
            {activeTab === "detail" && (
              <div className="pdDetailGrid">
                {/* Left col */}
                <div className="pdDetailLeft">
                  <div className="pdDetailSection">
                    <div className="pdDetailSectionTitle">
                      <Icon icon="fluent:hat-graduation-20-filled" width="24" color="#FFBE1B" />
                      <span>นักเรียนในโครงการ</span>
                    </div>

                    <div className="pdStudentBox">
                      <div className="pdStudentLabel">จำนวนนักเรียนที่ต้องการชุด</div>
                      <div className="pdStudentVal">
                        <Icon icon="fluent:people-20-filled" width="28" />
                        {project.student_count || "-"} คน
                      </div>
                    </div>

                    {/* uniform items */}
                    {project.uniform_items?.length > 0 && (
                      <div className="pdUniformBox">
                        <div className="pdUniformTitle">รายละเอียดชุดที่ต้องการ</div>
                        <div className="pdUniformSub">{project.education_level || ""}</div>
                        <div className="pdUniformImgs">
                          {project.uniform_images?.map((img, i) => (
                            <img key={i} src={img} alt="uniform" className="pdUniformImg" />
                          ))}
                        </div>
                        <div className="pdUniformList">
                          {project.uniform_items.map((item, i) => (
                            <div className="pdUniformRow" key={i}>
                              <span className="pdUniformName">{item.name}</span>
                              <span className="pdUniformQty">{item.quantity} ชิ้น</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right col */}
                <div className="pdDetailRight">
                  <div className="pdContactItem">
                    <Icon icon="fluent:location-20-filled" width="22" color="#FFBE1B" />
                    <div>
                      <div className="pdContactTitle">ที่อยู่โรงเรียน</div>
                      <div className="pdContactVal">{project.school_full_address || project.school_address || "-"}</div>
                    </div>
                  </div>

                  <div className="pdContactItem">
                    <Icon icon="fluent:call-20-filled" width="22" color="#FFBE1B" />
                    <div>
                      <div className="pdContactTitle">เบอร์ติดต่อ</div>
                      <div className="pdContactVal">{project.school_phone || "-"}</div>
                    </div>
                  </div>

                  <div className="pdContactItem">
                    <Icon icon="fluent:mail-20-filled" width="22" color="#FFBE1B" />
                    <div>
                      <div className="pdContactTitle">E-mail</div>
                      <div className="pdContactVal">{project.school_email || "-"}</div>
                    </div>
                  </div>

                  {project.contact_person && (
                    <div className="pdContactPerson">
                      <div className="pdContactTitle">ผู้รับผิดชอบโครงการ</div>
                      <div className="pdPersonRow">
                        {project.contact_avatar
                          ? <img src={project.contact_avatar} alt="contact" className="pdAvatar" />
                          : <div className="pdAvatarPlaceholder">
                              <Icon icon="fluent:person-circle-28-filled" width="44" color="#87C7EB" />
                            </div>}
                        <span className="pdPersonName">{project.contact_person}</span>
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
                  <div className="muted" style={{ padding: "40px", textAlign: "center" }}>
                    ยังไม่มีความประทับใจจากโรงเรียนนี้
                  </div>
                )}
              </div>
            )}
          </>
        )}
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
            <a href="#market">ร้านค้า</a>
            <a href="#about">เกี่ยวกับเรา</a>
          </div>
          <div className="footCol">
            <div className="footTitle">ติดต่อเรา</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <Icon icon="fluent:call-20-filled" width="24" color="#fff" />
              <span>062-379-0000</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <Icon icon="fluent:mail-20-filled" width="24" color="#fff" />
              <span>contact@unieed.com</span>
            </div>
            <div className="connect">
              <Icon icon="logos:facebook" width="36" />
              <Icon icon="simple-icons:line" width="36" color="#fff" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}