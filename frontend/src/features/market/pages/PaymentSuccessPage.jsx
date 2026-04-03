// frontend/src/features/market/pages/PaymentSuccessPage.jsx
import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/PaymentSuccessPage.css";

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    orderId,
    isDonation    = false,
    projectTitle  = "",
    schoolName    = "",
    totalAmount   = 0,
    paymentMethod = "card",
    // ชื่อผู้บริจาคที่ CheckoutPage ส่งมา (= display_name ของ account)
    donorName: stateDonorName,
  } = location.state || {};

  // ── Donor name ────────────────────────────────────────────
  // Priority: state จาก navigate → user.user_name → user.display_name → ""
  const defaultDonorName =
    stateDonorName ||
    user?.user_name ||
    user?.display_name ||
    user?.name ||
    user?.username ||
    "";

  const [donorName,   setDonorName]   = useState(defaultDonorName);
  const [editingName, setEditingName] = useState(false);
  const [tempName,    setTempName]    = useState(defaultDonorName);

  // ── Animation ─────────────────────────────────────────────
  const [showConfetti, setShowConfetti] = useState(false);
  const [animStep,     setAnimStep]     = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimStep(1), 100);
    const t2 = setTimeout(() => setAnimStep(2), 600);
    const t3 = setTimeout(() => setAnimStep(3), 900);
    const t4 = setTimeout(() => setShowConfetti(true), 400);
    const t5 = setTimeout(() => setShowConfetti(false), 3500);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (editingName && inputRef.current) inputRef.current.focus();
  }, [editingName]);

  // redirect ถ้าไม่มี orderId
  useEffect(() => {
    if (!orderId) navigate("/", { replace: true });
  }, [orderId, navigate]);

  if (!orderId) return null;

  // ── Handlers ──────────────────────────────────────────────
  const handleSaveName = () => {
    setDonorName(tempName.trim() || defaultDonorName);
    setEditingName(false);
  };

  const handleCancelEdit = () => {
    setTempName(donorName);
    setEditingName(false);
  };

  return (
    <div className="psPage">
      {showConfetti && <ConfettiBlast />}
      <div className="psBlob psBlob1" />
      <div className="psBlob psBlob2" />

      <div className="psCard">

        {/* ── Check icon ── */}
        <div className={`psIconWrap ${animStep >= 1 ? "psIconVisible" : ""}`}>
          <svg className="psCircleSvg" viewBox="0 0 100 100">
            <circle className="psCircleTrack" cx="50" cy="50" r="44" />
            <circle className="psCircleFill"  cx="50" cy="50" r="44" />
          </svg>
          <Icon icon="mdi:check-bold" className="psCheckIcon" />
        </div>

        {/* ── Title ── */}
        <div className={`psTitleBlock ${animStep >= 2 ? "psFadeUp" : ""}`}>
          {isDonation ? (
            <>
              <h1 className="psTitle psTitleDonation">ขอบคุณที่ร่วมส่งต่อโอกาส 💙</h1>
              <p className="psSubtitle">การซื้อของคุณจะช่วยให้น้องๆ ได้มีชุดนักเรียนใหม่</p>
            </>
          ) : (
            <>
              <h1 className="psTitle">ชำระเงินสำเร็จแล้ว!</h1>
              <p className="psSubtitle">คำสั่งซื้อของคุณได้รับการยืนยันเรียบร้อย</p>
            </>
          )}
        </div>

        {/* ── Body ── */}
        <div className={`psBody ${animStep >= 3 ? "psFadeUp" : ""}`}>

          {/* Order pill */}
          <div className="psOrderPill">
            <span className="psOrderLabel">คำสั่งซื้อ</span>
            <span className="psOrderId">#{orderId}</span>
            {totalAmount > 0 && (
              <span className="psOrderAmt">{Number(totalAmount).toLocaleString()} บาท</span>
            )}
          </div>

          {/* ── Donation section ── */}
          {isDonation && (
            <div className="psDonationSection">

              {/* Certificate note */}
              <div className="psCertCard">
                <div className="psCertIcon">
                  <Icon icon="mdi:certificate-outline" />
                </div>
                <div className="psCertText">
                  <div className="psCertTitle">ใบประกาศนียบัตรกำลังรอคุณอยู่</div>
                  <div className="psCertDesc">
                    เมื่อโรงเรียน{schoolName ? ` ${schoolName} ` : " "}ยืนยันรับสินค้าแล้ว
                    คุณจะได้รับใบประกาศนียบัตรส่งถึงอีเมลโดยอัตโนมัติ
                  </div>
                </div>
              </div>

              {/* Project tag */}
              {projectTitle && (
                <div className="psProjectTag">
                  <Icon icon="mdi:clipboard-text-outline" />
                  <span>{projectTitle}</span>
                </div>
              )}

              {/* ── Donor name ── */}
              <div className="psDonorCard">
                <div className="psDonorLabel">
                  <Icon icon="mdi:account-heart-outline" />
                  บริจาคในนาม
                </div>

                {editingName ? (
                  <div className="psDonorEditRow">
                    <input
                      ref={inputRef}
                      className="psDonorInput"
                      value={tempName}
                      onChange={e => setTempName(e.target.value)}
                      placeholder="ชื่อ-นามสกุล หรือ นามแฝง"
                      maxLength={60}
                      onKeyDown={e => {
                        if (e.key === "Enter")  handleSaveName();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                    />
                    <button className="psDonorSaveBtn" onClick={handleSaveName}>
                      <Icon icon="mdi:check" /> บันทึก
                    </button>
                    <button className="psDonorCancelBtn" onClick={handleCancelEdit}>
                      <Icon icon="mdi:close" />
                    </button>
                  </div>
                ) : (
                  <div className="psDonorNameRow">
                    <span className={`psDonorName${!donorName ? " psDonorNameEmpty" : ""}`}>
                      {donorName || "ไม่ระบุชื่อ"}
                    </span>
                    <button
                      className="psDonorEditBtn"
                      onClick={() => { setTempName(donorName); setEditingName(true); }}
                    >
                      <Icon icon="mdi:pencil-outline" /> แก้ไข
                    </button>
                  </div>
                )}

                <p className="psDonorHint">ชื่อนี้จะปรากฏบนใบประกาศนียบัตรของคุณ</p>
              </div>

              {/* Steps */}
              <div className="psStepsCard">
                <div className="psStepsTitle">ขั้นตอนต่อไป</div>
                <div className="psStep">
                  <div className="psStepDot psStepDotDone"><Icon icon="mdi:check" /></div>
                  <div className="psStepText"><b>ชำระเงินสำเร็จ</b> — ระบบได้รับคำสั่งซื้อแล้ว</div>
                </div>
                <div className="psStepLine" />
                <div className="psStep">
                  <div className="psStepDot psStepDotActive"><Icon icon="mdi:truck-outline" /></div>
                  <div className="psStepText"><b>ร้านค้าจัดส่ง</b> — สินค้าจะถูกส่งไปยังโรงเรียน</div>
                </div>
                <div className="psStepLine" />
                <div className="psStep">
                  <div className="psStepDot"><Icon icon="mdi:school-outline" /></div>
                  <div className="psStepText"><b>โรงเรียนยืนยันรับ</b> — คุณจะได้รับใบประกาศ 🎓</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Normal purchase section ── */}
          {!isDonation && (
            <div className="psNormalSection">
              <div className="psInfoRow">
                <Icon icon="mdi:truck-fast-outline" />
                <span>ร้านค้าจะจัดเตรียมและจัดส่งสินค้าให้คุณเร็วๆ นี้</span>
              </div>
              <div className="psInfoRow">
                <Icon icon="mdi:bell-outline" />
                <span>คุณจะได้รับการแจ้งเตือนเมื่อสินค้าถูกจัดส่ง</span>
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="psActions">
            <Link to={`/orders/${orderId}`} className="psBtnPrimary">
              <Icon icon="mdi:receipt-text-outline" /> ดูรายละเอียดคำสั่งซื้อ
            </Link>
            <Link to="/market" className="psBtnOutline">
              <Icon icon="mdi:storefront-outline" /> ช้อปต่อ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────
function ConfettiBlast() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 1.8 + Math.random() * 1.2,
    size: 8 + Math.random() * 10,
    color: ["#5285E8","#FFBE1B","#22c55e","#f472b6","#a78bfa","#38bdf8"][i % 6],
    rotate: Math.random() * 360,
  }));

  return (
    <div className="psConfetti" aria-hidden>
      {pieces.map(p => (
        <div
          key={p.id}
          className="psConfettiPiece"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * (Math.random() > 0.5 ? 0.4 : 1),
            background: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}