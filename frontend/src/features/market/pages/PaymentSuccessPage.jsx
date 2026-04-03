import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import "../styles/PaymentSuccessPage.css";
 
const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";
 
export default function PaymentSuccessPage() {
  const { user, token } = useAuth();
  const location        = useLocation();
  const navigate        = useNavigate();
 
  const {
    orderId,
    isDonation    = false,
    projectTitle  = "",
    projectId,               // ← project_id / request_id ส่งมาจาก CheckoutPage
    schoolName    = "",
    totalAmount   = 0,
    paymentMethod = "card",
    shippingCarrier,         // ← ชื่อขนส่งที่ผู้ขายเลือก (optional ณ ตอนนี้)
    trackingNumber,          // ← เลขพัสดุ (optional ณ ตอนนี้)
    orderItems    = [],      // ← [{ name, quantity, uniform_type_id? }]
    donorName: stateDonorName,
  } = location.state || {};
 
  // ── Donor name ────────────────────────────────────────────────────────────
  const defaultDonorName =
    stateDonorName ||
    user?.display_name ||
    user?.user_name ||
    user?.name ||
    user?.username ||
    "";
 
  const [donorName,   setDonorName]   = useState(defaultDonorName);
  const [editingName, setEditingName] = useState(false);
  const [tempName,    setTempName]    = useState(defaultDonorName);
 
  // ── Donation record state ─────────────────────────────────────────────────
  const [donationId,      setDonationId]      = useState(null);
  const [donationLoading, setDonationLoading] = useState(false);
  const [donationError,   setDonationError]   = useState(null);
  const submittedRef = useRef(false); // ป้องกัน double-submit
 
  // ── Animation ─────────────────────────────────────────────────────────────
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
 
  // ── Auto-submit donation record เมื่อ payment สำเร็จ ─────────────────────
  const submitDonation = useCallback(async (nameToUse) => {
    if (!isDonation || !orderId || !projectId) return;
    if (submittedRef.current) return;
    submittedRef.current = true;
 
    setDonationLoading(true);
    setDonationError(null);
    try {
      const res = await fetch(`${BASE}/donations/from-order`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          order_id:         String(orderId),
          project_id:       projectId,
          donor_name:       nameToUse || defaultDonorName || "ผู้ใจดี",
          shipping_carrier: shippingCarrier || null,
          tracking_number:  trackingNumber  || null,
          items:            orderItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ส่งข้อมูลไม่สำเร็จ");
      setDonationId(data.donation_id);
    } catch (err) {
      console.error("[submitDonation]", err);
      setDonationError(err.message);
      submittedRef.current = false; // อนุญาตให้ retry
    } finally {
      setDonationLoading(false);
    }
  }, [isDonation, orderId, projectId, token, defaultDonorName, shippingCarrier, trackingNumber, orderItems]);
 
  // Submit ทันทีที่หน้าโหลด (ใช้ defaultDonorName)
  useEffect(() => {
    if (isDonation && orderId && projectId) {
      submitDonation(defaultDonorName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once
 
  // ── อัปเดตชื่อบน donation record หลังผู้ใช้แก้ไข ─────────────────────────
  const updateDonorName = async (newName) => {
    if (!donationId) return; // ยังไม่มี donation_id → ไม่ต้อง patch
    try {
      await fetch(`${BASE}/donations/${donationId}/donor-name`, {
        method:  "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ donor_name: newName }),
      });
    } catch (err) {
      console.error("[updateDonorName]", err);
    }
  };
 
  if (!orderId) return null;
 
  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    const saved = tempName.trim() || defaultDonorName;
    setDonorName(saved);
    setEditingName(false);
    await updateDonorName(saved);
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
 
              {/* Donation submit status */}
              {donationLoading && (
                <div className="psDonationSubmitStatus">
                  <Icon icon="mdi:loading" className="psSpinner" />
                  <span>กำลังบันทึกข้อมูลการบริจาค...</span>
                </div>
              )}
              {donationError && (
                <div className="psDonationSubmitError">
                  <Icon icon="mdi:alert-circle-outline" />
                  <span>{donationError}</span>
                  <button
                    className="psDonationRetryBtn"
                    onClick={() => { submittedRef.current = false; submitDonation(donorName); }}
                  >
                    ลองอีกครั้ง
                  </button>
                </div>
              )}
 
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
 
// ── Confetti ───────────────────────────────────────────────────────────────
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
 