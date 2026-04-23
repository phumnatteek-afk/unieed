// frontend/src/features/market/pages/CheckoutPage.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import "../styles/CheckoutPage.css";

// ── Helpers ───────────────────────────────────────────────
function getCategoryLabel(cid, gender) {
  const c = Number(cid);
  if (c === 1) return gender === "male" ? "เสื้อนักเรียนชาย" : "เสื้อนักเรียนหญิง";
  if (c === 2) return "กางเกงนักเรียน";
  if (c === 3) return "กระโปรงนักเรียน";
  return "ชุดนักเรียน";
}

function getSizeText(size, categoryId) {
  if (!size) return null;
  try {
    const s = JSON.parse(size);
    const cid = Number(categoryId);
    const parts = [];
    if (cid === 1) {
      if (s.chest  && s.chest  !== "0") parts.push(`อก ${s.chest}`);
      if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
    } else {
      if (s.waist  && s.waist  !== "0") parts.push(`เอว ${s.waist}`);
      if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
    }
    return parts.join(" / ") || null;
  } catch { return size; }
}

function groupBySeller(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.seller_id || "unknown";
    if (!map.has(key)) {
      map.set(key, { seller_id: key, seller_name: item.seller_name || "ไม่ระบุ", items: [] });
    }
    map.get(key).items.push(item);
  }
  return Array.from(map.values());
}

// ── Address Modal ─────────────────────────────────────────
function AddressModal({ address, onSave, onClose }) {
  const [form, setForm] = useState(address || {
    recipient_name: "", phone: "", address_line: "",
    district: "", province: "", postcode: "", is_default: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.recipient_name || !form.phone || !form.address_line ||
        !form.district || !form.province || !form.postcode) {
      setErr("กรุณากรอกข้อมูลให้ครบถ้วน"); return;
    }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="coModalOverlay" onClick={onClose}>
      <div className="coModal" onClick={e => e.stopPropagation()}>
        <div className="coModalHeader">
          <h3>{address ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่ใหม่"}</h3>
          <button className="coModalClose" onClick={onClose}><Icon icon="mdi:close" /></button>
        </div>
        <div className="coModalBody">
          {err && <div className="coModalErr"><Icon icon="mdi:alert-circle" /> {err}</div>}
          <div className="coFormGrid">
            <div className="coFormGroup coSpan2">
              <label>ชื่อผู้รับ *</label>
              <input value={form.recipient_name} onChange={e => update("recipient_name", e.target.value)} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div className="coFormGroup coSpan2">
              <label>เบอร์โทร *</label>
              <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08x-xxx-xxxx" />
            </div>
            <div className="coFormGroup coSpan2">
              <label>ที่อยู่ *</label>
              <input value={form.address_line} onChange={e => update("address_line", e.target.value)} placeholder="บ้านเลขที่ ถนน ซอย" />
            </div>
            <div className="coFormGroup">
              <label>แขวง/ตำบล *</label>
              <input value={form.district} onChange={e => update("district", e.target.value)} placeholder="แขวง/ตำบล" />
            </div>
            <div className="coFormGroup">
              <label>จังหวัด *</label>
              <input value={form.province} onChange={e => update("province", e.target.value)} placeholder="จังหวัด" />
            </div>
            <div className="coFormGroup">
              <label>รหัสไปรษณีย์ *</label>
              <input value={form.postcode} onChange={e => update("postcode", e.target.value)} placeholder="10xxx" maxLength={5} />
            </div>
            <div className="coFormGroup coSpan2">
              <label className="coCheckLabel">
                <input type="checkbox" checked={!!form.is_default} onChange={e => update("is_default", e.target.checked)} />
                ตั้งเป็นที่อยู่หลัก
              </label>
            </div>
          </div>
        </div>
        <div className="coModalFooter">
          <button className="coBtnOutline" onClick={onClose}>ยกเลิก</button>
          <button className="coBtnPrimary" onClick={handleSave} disabled={saving}>
            {saving && <Icon icon="mdi:loading" className="coSpinner" />} บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Shipping Logo Map ─────────────────────────────────────
// match ด้วย code (KEX, FLX ฯลฯ) หรือ name (ไม่ case-sensitive)
const SHIPPING_LOGO_MAP = {
  // Kerry Express — official CDN
  KEX:   "https://www.kerryexpress.com/img/kerry-logo.svg",
  KERRY: "https://www.kerryexpress.com/img/kerry-logo.svg",
  // Flash Express — official asset
  FLX:   "https://www.flashexpress.co.th/wp-content/uploads/2021/04/flash_logo-1.png",
  FLASH: "https://www.flashexpress.co.th/wp-content/uploads/2021/04/flash_logo-1.png",
  // Thailand Post / EMS
  THP:      "https://www.thaipost.go.th/main/img/logo-thaipost.png",
  THAIPOST: "https://www.thaipost.go.th/main/img/logo-thaipost.png",
  EMS:      "https://www.thaipost.go.th/main/img/logo-thaipost.png",
  // J&T Express
  JNT: "https://th.jtexpress.co.th/dist/img/logo.svg",
  JT:  "https://th.jtexpress.co.th/dist/img/logo.svg",
  // Ninja Van
  NJV:      "https://www.ninjavan.co/static/logo.svg",
  NINJAVAN: "https://www.ninjavan.co/static/logo.svg",
  // Shopee Express
  SHOPEE: "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/homepage/6d9f0d1b41d4f4c9.png",
  SPX:    "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/homepage/6d9f0d1b41d4f4c9.png",
  // Lazada Logistics
  LAZADA: "https://lzd-img-global.slatic.net/g/tsp/tb/img/logo/lazada_logo_160.png",
  LZD:    "https://lzd-img-global.slatic.net/g/tsp/tb/img/logo/lazada_logo_160.png",
  // DHL
  DHL: "https://www.dhl.com/content/dam/dhl/global/core/images/logos/dhl-logo.svg",
  // SCG Logistics
  SCG: "https://www.scglogistics.co.th/wp-content/uploads/2023/01/logo-scgl.png",
};

// ── Brand identity สำหรับ fallback badge ─────────────────
// แต่ละแบรนด์มีสีและ icon เป็นของตัวเอง
const SHIPPING_BRAND = {
  kerry:   { bg: "#e8f0fe", color: "#1a56db", icon: "mdi:truck-fast",      abbr: "KEX" },
  flash:   { bg: "#fff3e0", color: "#e65100", icon: "mdi:lightning-bolt",  abbr: "FLX" },
  thai:    { bg: "#fce4ec", color: "#c62828", icon: "mdi:mailbox-outline",  abbr: "THP" },
  post:    { bg: "#fce4ec", color: "#c62828", icon: "mdi:mailbox-outline",  abbr: "EMS" },
  ems:     { bg: "#fce4ec", color: "#c62828", icon: "mdi:mailbox-outline",  abbr: "EMS" },
  "j&t":   { bg: "#fff8e1", color: "#f57f17", icon: "mdi:truck-delivery",  abbr: "J&T" },
  jnt:     { bg: "#fff8e1", color: "#f57f17", icon: "mdi:truck-delivery",  abbr: "J&T" },
  ninja:   { bg: "#e8f5e9", color: "#2e7d32", icon: "mdi:ninja",           abbr: "NJV" },
  shopee:  { bg: "#fff3e0", color: "#ee4d2d", icon: "simple-icons:shopee", abbr: "SPX" },
  lazada:  { bg: "#f3e5f5", color: "#6a1b9a", icon: "mdi:shopping-outline",abbr: "LZD" },
  dhl:     { bg: "#fff9c4", color: "#b71c1c", icon: "mdi:truck-outline",   abbr: "DHL" },
  scg:     { bg: "#e3f2fd", color: "#1565c0", icon: "mdi:truck-check",     abbr: "SCG" },
  default: { bg: "#f1f5f9", color: "#475569", icon: "mdi:truck-outline",   abbr: "???" },
};

function getShippingLogo(code, name) {
  const codeKey = (code || "").toUpperCase();
  const nameLower = (name || "").toLowerCase();
  if (SHIPPING_LOGO_MAP[codeKey]) return SHIPPING_LOGO_MAP[codeKey];
  for (const [key, url] of Object.entries(SHIPPING_LOGO_MAP)) {
    if (nameLower.includes(key.toLowerCase())) return url;
  }
  return null;
}

function getShippingBrand(code, name) {
  const n = ((name || "") + " " + (code || "")).toLowerCase();
  for (const [key, brand] of Object.entries(SHIPPING_BRAND)) {
    if (key !== "default" && n.includes(key)) return brand;
  }
  return SHIPPING_BRAND.default;
}

function ShippingLogo({ code, name, size = 40 }) {
  const [imgError, setImgError] = React.useState(false);
  const logoUrl = getShippingLogo(code, name);
  const brand   = getShippingBrand(code, name);

  // ── Fallback badge: มีสีประจำแบรนด์ + icon + abbr ──
  if (!logoUrl || imgError) {
    return (
      <div style={{
        width: size, height: size,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: brand.bg,
        borderRadius: size * 0.22,
        border: `1.5px solid ${brand.color}22`,
        overflow: "hidden",
        gap: 1,
      }}>
        <Icon icon={brand.icon} style={{ fontSize: size * 0.44, color: brand.color }} />
        <span style={{
          fontSize: size * 0.22,
          fontWeight: 700,
          color: brand.color,
          letterSpacing: "0.02em",
          lineHeight: 1,
          fontFamily: "monospace",
        }}>{brand.abbr}</span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={name}
      onError={() => setImgError(true)}
      style={{
        width: size, height: size,
        objectFit: "contain",
        borderRadius: size * 0.18,
        background: "#fff",
        padding: size * 0.08,
        border: "1px solid #e5e7eb",
      }}
    />
  );
}

// ── Seller Shipping Block ─────────────────────────────────
function SellerShippingBlock({ group, shippingOptions, selectedShipping, setSelectedShipping }) {
  const subtotal = group.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  // undefined = ยังโหลด, [] = ไม่มีขนส่ง, [...] = มีตัวเลือก
  const optionsRaw = shippingOptions[group.seller_id];
  const isLoading  = optionsRaw === undefined;
  const options    = Array.isArray(optionsRaw) ? optionsRaw : [];

  return (
    <div className="coSellerBlock">
      <div className="coSellerHeader">
        <div className="coSellerAvatarSm">{group.seller_name[0]?.toUpperCase()}</div>
        <span className="coSellerNameSm">{group.seller_name}</span>
        <span className="coSellerSubtotal">{subtotal.toLocaleString()} บาท</span>
      </div>

      <div className="coSellerItems">
        {group.items.map(item => {
          const cat   = getCategoryLabel(item.category_id, item.gender);
          const type  = item.type_name?.trim();
          const title = type ? `${cat}: ${type}` : cat;
          const size  = getSizeText(item.size, item.category_id);
          return (
            <div key={item.cart_item_id} className="coSellerItem">
              <div className="coSellerItemImg">
                {item.cover_image
                  ? <img src={item.cover_image} alt={title} loading="lazy" />
                  : <Icon icon="mdi:tshirt-crew" />}
              </div>
              <div className="coSellerItemInfo">
                <div className="coSellerItemTitle">{title}</div>
                {item.school_name && <div className="coSellerItemMeta">{item.school_name}</div>}
                {size && <div className="coSellerItemMeta">ขนาด: {size}</div>}
                <div className="coSellerItemMeta">× {item.quantity} ชิ้น</div>
              </div>
              <div className="coSellerItemPrice">
                {(Number(item.price) * item.quantity).toLocaleString()} บาท
              </div>
            </div>
          );
        })}
      </div>

      <div className="coShipSection">
        <div className="coShipSectionTitle">
          <Icon icon="mdi:truck-outline" /> การจัดส่ง
        </div>
        {isLoading ? (
          <div className="coShipEmpty">
            <Icon icon="mdi:loading" className="coSpinner" /> กำลังโหลดตัวเลือกขนส่ง...
          </div>
        ) : options.length === 0 ? (
          <div className="coShipEmpty">
            <Icon icon="mdi:truck-outline" style={{ color: "#94a3b8" }} />
            ผู้ขายรายนี้ยังไม่ได้กำหนดขนส่ง — สามารถดำเนินการต่อได้
          </div>
        ) : (
          <>
            {options.some(o => o.free_threshold) && (
              <div className="coShipFreeHint">
                <Icon icon="mdi:tag-outline" />
                ซื้อครบ {Math.min(...options.filter(o => o.free_threshold).map(o => o.free_threshold)).toLocaleString()} บาท ส่งฟรี!
              </div>
            )}
            <div className="coShipOptions">
              {options.map(opt => {
                const selected = selectedShipping[group.seller_id]?.provider_id === opt.provider_id;
                return (
                  <label key={opt.provider_id} className={`coShipOption ${selected ? "coShipOptionSel" : ""}`}>
                    <input
                      type="radio"
                      name={`shipping-${group.seller_id}`}
                      checked={selected}
                      onChange={() => setSelectedShipping(prev => ({ ...prev, [group.seller_id]: { ...opt, seller_id: group.seller_id } }))}
                    />
                    <div className="coShipOptionLogo">
                      <ShippingLogo code={opt.code} name={opt.name} size={42} />
                    </div>
                    <div className="coShipOptionInfo">
                      <div className="coShipOptionName">{opt.name}</div>
                      <div className="coShipOptionDesc">{opt.est_days || "2-5 วัน"}</div>
                    </div>
                    <div className={`coShipOptionPrice ${opt.price === 0 ? "coFree" : ""}`}>
                      {opt.price === 0 ? "🎉 ส่งฟรี" : `${Number(opt.price).toLocaleString()} บาท`}
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Donation Address Block ────────────────────────────────
function DonationAddressBlock({ shippingAddress, projectTitle }) {
  return (
    <div className="coDonationAddrBlock">
      <div className="coDonationAddrBadge"><Icon icon="mdi:gift-outline" /> ซื้อเพื่อส่งต่อ</div>
      {projectTitle && (
        <div className="coDonationProject">
          <Icon icon="mdi:clipboard-text-outline" /> <span>{projectTitle}</span>
        </div>
      )}
      <div className="coDonationAddrCard">
        <Icon icon="mdi:school-outline" style={{ color: "#378ADD", fontSize: 20 }} />
        <div>
          <div className="coDonationAddrName">{shippingAddress?.name}</div>
          <div className="coDonationAddrText">
            {[shippingAddress?.address, shippingAddress?.district,
              shippingAddress?.province, shippingAddress?.postal_code]
              .filter(Boolean).join(" ")}
          </div>
          {shippingAddress?.phone && (
            <div className="coDonationAddrPhone"><Icon icon="mdi:phone-outline" /> {shippingAddress.phone}</div>
          )}
        </div>
      </div>
      <p className="coDonationAddrNote">
        <Icon icon="mdi:information-outline" /> ที่อยู่จัดส่งจะเป็นโรงเรียนโดยอัตโนมัติ
      </p>
    </div>
  );
}

// ── Omise Card Form ───────────────────────────────────────
const OMISE_PUBLIC_KEY = import.meta.env.VITE_OMISE_PUBLIC_KEY || "pkey_test_xxxxxxxx";

function OmiseCardForm({ amount, onToken, onError, disabled }) {
  const [cardNum,  setCardNum]  = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear,  setExpYear]  = useState("");
  const [cvc,      setCvc]      = useState("");
  const [name,     setName]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const omiseRef = useRef(null);

  useEffect(() => {
    if (window.Omise) { omiseRef.current = window.Omise; return; }
    const script = document.createElement("script");
    script.src = "https://cdn.omise.co/omise.js";
    script.onload = () => {
      window.Omise.setPublicKey(OMISE_PUBLIC_KEY);
      omiseRef.current = window.Omise;
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  const formatCardNum = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const handleSubmit = async () => {
    if (!omiseRef.current) { onError("ระบบชำระเงินยังโหลดไม่สำเร็จ กรุณารอสักครู่"); return; }
    if (!name || !cardNum || !expMonth || !expYear || !cvc) {
      onError("กรุณากรอกข้อมูลบัตรให้ครบถ้วน"); return;
    }
    setLoading(true);
    omiseRef.current.createToken("card", {
      name,
      number:           cardNum.replace(/\s/g, ""),
      expiration_month: Number(expMonth),
      expiration_year:  Number(expYear),
      security_code:    cvc,
    }, (statusCode, response) => {
      setLoading(false);
      if (statusCode !== 200 || response.object === "error") {
        onError(response.message || "ข้อมูลบัตรไม่ถูกต้อง");
        return;
      }
      onToken(response.id);
    });
  };

  return (
    <div className="coCardForm">
      <div className="coCardFormHeader">
        <Icon icon="mdi:credit-card-outline" />
        <span>ชำระด้วยบัตรเครดิต/เดบิต</span>
        <div className="coCardBrands">
          <Icon icon="logos:visa" style={{ fontSize: 32 }} />
          <Icon icon="logos:mastercard" style={{ fontSize: 32 }} />
          <Icon icon="simple-icons:jcb" style={{ fontSize: 28, color: "#005BAC" }} />
        </div>
      </div>
      <div className="coCardFormBody">
        <div className="coCardField coSpan2">
          <label>ชื่อบนบัตร</label>
          <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="FIRSTNAME LASTNAME" autoComplete="cc-name" disabled={disabled || loading} />
        </div>
        <div className="coCardField coSpan2">
          <label>หมายเลขบัตร</label>
          <div className="coCardNumWrap">
            <Icon icon="mdi:credit-card-outline" className="coCardNumIcon" />
            <input value={cardNum} onChange={e => setCardNum(formatCardNum(e.target.value))} placeholder="0000 0000 0000 0000" autoComplete="cc-number" inputMode="numeric" maxLength={19} disabled={disabled || loading} />
          </div>
        </div>
        <div className="coCardField">
          <label>วันหมดอายุ</label>
          <div className="coCardExpRow">
            <input value={expMonth} onChange={e => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="MM" inputMode="numeric" maxLength={2} disabled={disabled || loading} className="coCardExpInput" />
            <span>/</span>
            <input value={expYear} onChange={e => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="YYYY" inputMode="numeric" maxLength={4} disabled={disabled || loading} className="coCardExpInput" />
          </div>
        </div>
        <div className="coCardField">
          <label>CVV / CVC</label>
          <input value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="•••" inputMode="numeric" maxLength={4} type="password" disabled={disabled || loading} />
        </div>
      </div>
      <div className="coCardTotal">
        <span>ยอดชำระ</span>
        <span className="coCardTotalAmt">{Number(amount).toLocaleString()} บาท</span>
      </div>
      <button className="coBtnYellow coCardPayBtn" onClick={handleSubmit} disabled={disabled || loading}>
        {loading
          ? <><Icon icon="mdi:loading" className="coSpinner" /> กำลังตรวจสอบบัตร...</>
          : <><Icon icon="mdi:lock-outline" /> ชำระเงิน {Number(amount).toLocaleString()} บาท</>
        }
      </button>
      <div className="coCardSecureNote">
        <Icon icon="mdi:shield-check-outline" />
        ข้อมูลบัตรถูกส่งตรงไปยัง Omise — เราไม่เก็บข้อมูลบัตรของคุณ
      </div>
    </div>
  );
}

// ── PromptPay Block ───────────────────────────────────────
// FIX: รับ qrImageUrl (URL ตรงๆ จาก Omise) แทน qrBase64
function PromptPayBlock({ qrImageUrl, amount, onConfirm, mockMode = false }) {
  const [polling, setPolling] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!qrImageUrl) return;
    setPolling(true);
    pollRef.current = setInterval(() => {
      onConfirm(false);
    }, 3000);
    return () => { clearInterval(pollRef.current); setPolling(false); };
  }, [qrImageUrl]); // eslint-disable-line

  if (!qrImageUrl) return null;

  const handleCheckNow = async () => {
    setCheckingNow(true);
    try { await onConfirm(true); }
    finally { setCheckingNow(false); }
  };

  return (
    <div className="coQrBlock">
      <div className="coQrHeader">
        <Icon icon="mdi:qrcode-scan" />
        <span>สแกน QR Code ด้วย Mobile Banking</span>
      </div>
      <div className="coQrHint">
        เปิดแอปธนาคาร &gt; เลือกสแกนจ่าย &gt; ยืนยันยอดเงิน
      </div>
      {mockMode && (
        <div className="coQrMockTag">
          โหมดทดสอบ: กดปุ่มตรวจสอบเพื่อจำลองการชำระสำเร็จ
        </div>
      )}
      <div className="coQrFrame">
        <img src={qrImageUrl} alt="PromptPay QR" className="coQrImage" />
      </div>
      <div className="coQrAmtLabel">ยอดที่ต้องชำระ</div>
      <div className="coQrAmt">{Number(amount).toLocaleString()} บาท</div>
      <div className="coQrNote" aria-live="polite">
        {polling
          ? <><Icon icon="mdi:loading" className="coSpinner" /> กำลังรอการชำระเงิน...</>
          : "กรุณาสแกนและชำระภายใน 15 นาที"}
      </div>
      <button
        className="coQrCheckBtn"
        onClick={handleCheckNow}
        disabled={checkingNow}
      >
        {checkingNow
          ? <><Icon icon="mdi:loading" className="coSpinner" /> กำลังตรวจสอบ...</>
          : <><Icon icon="mdi:check-circle-outline" /> {mockMode ? "ยืนยันการชำระ" : "ฉันชำระแล้ว ตรวจสอบตอนนี้"}</>}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function CheckoutPage() {
  const { token, user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [params]  = useSearchParams();

  useEffect(() => {
    if (location.state?.isDonation) {
      sessionStorage.setItem(
        `donationState_${params.get("items")}`,
        JSON.stringify(location.state)
      );
    }
  }, []); // eslint-disable-line

  const _saved       = (() => { try { return JSON.parse(sessionStorage.getItem(`donationState_${params.get("items")}`) || "{}"); } catch { return {}; } })();
  const isDonation   = (location.state?.isDonation ?? _saved.isDonation) === true;
  const donationAddr = location.state?.shippingAddress ?? _saved.shippingAddress ?? null;
  const projectId    = location.state?.project_id      ?? _saved.project_id      ?? null;
  const projectTitle = location.state?.project_title   ?? _saved.project_title   ?? null;

  const itemIds = params.get("items")?.split(",").map(Number).filter(Boolean) || [];
  const buyType = params.get("type");

  // ── State ─────────────────────────────────────────────
  const [step,             setStep]             = useState(1);
  const [items,            setItems]            = useState([]);
  const [addresses,        setAddresses]        = useState([]);
  const [selAddress,       setSelAddress]       = useState(null);
  // "school" = ส่งให้โรงเรียน (default donation), "buyer" = ใช้ที่อยู่ผู้ซื้อ
  const [donationAddrMode, setDonationAddrMode] = useState("school");
  const [shippingOptions,  setShippingOptions]  = useState({});
  const [selectedShipping, setSelectedShipping] = useState({});
  const [payMethod,        setPayMethod]        = useState("card");
  const [loading,          setLoading]          = useState(true);
  const [placing,          setPlacing]          = useState(false);
  const [err,              setErr]              = useState("");
  const [showModal,        setShowModal]        = useState(false);
  const [editAddr,         setEditAddr]         = useState(null);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState(null);
  const [orderId,          setOrderId]          = useState(null);
  const [qrImageUrl,       setQrImageUrl]       = useState(null);
  const [authorizeUri,     setAuthorizeUri]      = useState(null);
  const [mockMode,         setMockMode]         = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (qrImageUrl && String(qrImageUrl).startsWith("blob:")) {
        URL.revokeObjectURL(qrImageUrl);
      }
    };
  }, [qrImageUrl]);

  const groups = groupBySeller(items);

  // ── Load items + addresses ────────────────────────────
  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    if (!itemIds.length) { navigate("/cart"); return; }

    const itemsUrl = buyType === "product"
      ? `/api/checkout/items/by-product?items=${itemIds.join(",")}`
      : `/api/checkout/items?items=${itemIds.join(",")}`;

    Promise.all([
      fetch(itemsUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/checkout/addresses", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([its, addrs]) => {
        setItems(Array.isArray(its) ? its : []);
        const addrList = Array.isArray(addrs) ? addrs : [];
        setAddresses(addrList);
        // non-donation: auto-select default
        if (!isDonation) {
          const def = addrList.find(a => a.is_default) || addrList[0];
          if (def) setSelAddress(def.address_id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]); // eslint-disable-line

  // ── Load shipping options ─────────────────────────────
  useEffect(() => {
    if (!items.length || !token) return;

    // buyType = "product" → ids คือ product_id (ซื้อเลย/บริจาค)
    // buyType = "cart"    → ids คือ cart_item_id (จากตะกร้า)
    const type = buyType === "product" ? "product" : "cart";
    const ids  = buyType === "product"
      ? itemIds                              // ← ใช้ product_id จาก URL params โดยตรง
      : items.map(i => i.cart_item_id);     // ← ใช้ cart_item_id

    fetch(`/api/checkout/shipping-options?items=${ids.join(",")}&type=${type}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const opts = typeof data === "object" && !Array.isArray(data) ? data : {};
        setShippingOptions(opts);
        // auto-select ถ้า seller มีตัวเลือกเดียว
        const autoSel = {};
        for (const [sellerId, selOpts] of Object.entries(opts)) {
          if (Array.isArray(selOpts) && selOpts.length === 1) {
            autoSel[sellerId] = { ...selOpts[0], seller_id: Number(sellerId) };
          }
        }
        if (Object.keys(autoSel).length) setSelectedShipping(autoSel);
      })
      .catch(err => console.error("[shipping-options]", err));
  }, [items, token]);

  // ── Address CRUD ──────────────────────────────────────
  const reloadAddresses = async () => {
    const fresh = await fetch("/api/checkout/addresses", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    setAddresses(Array.isArray(fresh) ? fresh : []);
    return fresh;
  };

  const saveAddress = useCallback(async (form) => {
    const isEdit = !!editAddr;
    const url    = isEdit ? `/api/checkout/addresses/${editAddr.address_id}` : "/api/checkout/addresses";
    const res    = await fetch(url, {
      method:  isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    const fresh = await reloadAddresses();
    const found = fresh.find(a => a.address_id === data.address_id);
    if (found) setSelAddress(found.address_id);
    setEditAddr(null);
  }, [token, editAddr]); // eslint-disable-line

  const deleteAddr = async (id) => {
    await fetch(`/api/checkout/addresses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const fresh = await reloadAddresses();
    if (selAddress === id) setSelAddress(fresh[0]?.address_id || null);
    setConfirmDeleteId(null);
  };

  // ── Derived values ────────────────────────────────────
  const useSchoolAddr  = isDonation && donationAddrMode === "school";
  const step1Valid    = useSchoolAddr ? true : !!selAddress;
  const validGroups   = groups.filter(g => g.seller_id !== "unknown");
  // step2Valid: ผ่านถ้า donation, หรือทุก seller มี shipping ที่เลือกแล้ว
  // กรณี seller ไม่มี shipping options เลย (options = []) → ถือว่า skip ได้ (ไม่บังคับ)
  const step2Valid = isDonation || (
    validGroups.length > 0 &&
    validGroups.every(g => {
      const opts = shippingOptions[g.seller_id];
      // ถ้ายังไม่มี options (loading) → ยังเลือกไม่ได้
      if (opts === undefined) return false;
      // ถ้า seller ไม่มีขนส่งเลย (opts = []) → ข้ามได้
      if (Array.isArray(opts) && opts.length === 0) return true;
      // ปกติ → ต้องเลือก
      return !!selectedShipping[g.seller_id];
    })
  );
  const subtotal      = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const shippingTotal = Object.values(selectedShipping).reduce((s, v) => s + (Number(v.price) || 0), 0);
  const total         = subtotal + shippingTotal;
  const selectedAddr  = addresses.find(a => a.address_id === selAddress);
  // donation ก็ต้องชำระเงินผ่าน Omise เหมือนซื้อปกติ
  const steps         = ["ที่อยู่จัดส่ง", "การจัดส่ง", isDonation ? "ยืนยัน & ส่งต่อ" : "ชำระเงิน"];

  // ── Build order body ──────────────────────────────────
  const buildOrderBody = () => {
    const body = {
      order_type: isDonation ? "donation" : "purchase",
      request_id: isDonation ? projectId  : null,
      shipping:   Object.values(selectedShipping).map(v => ({
        seller_id:   Number(v.seller_id || v.provider_id),
        provider_id: v.provider_id,
        price:       v.price,
      })),
    };
    if (buyType === "product") body.product_ids = itemIds;
    else                       body.items       = itemIds;

    if (isDonation) {
      if (useSchoolAddr) {
        body.donation_address = donationAddr;
      } else {
        // ผู้ซื้อเลือกส่งไปที่อยู่ตัวเอง (ไม่ใช่โรงเรียน)
        body.address_id = selAddress;
      }
    } else {
      body.address_id = selAddress;
    }
    return body;
  };

  // ── Card payment (ใช้ทั้ง purchase และ donation) ─────
  const handleCardPayment = async (omiseToken) => {
    setPlacing(true); setErr("");
    try {
      const res  = await fetch("/api/checkout/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ...buildOrderBody(), omise_token: omiseToken, payment_method: "card" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ชำระเงินไม่สำเร็จ");
      navigate("/checkout/success", {
        state: {
          orderId:        data.order_id,
          isDonation,
          projectId,
          projectTitle,
          schoolName:     useSchoolAddr ? (donationAddr?.name || "") : (selectedAddr?.address_line || ""),
          totalAmount:    total,
          paymentMethod:  "card",
          donorName:      user?.display_name || user?.name || user?.username || "",
          shippingCarrier: Object.values(selectedShipping)[0]?.name || null,
          // รายการสินค้าสำหรับสร้าง donation_record
          orderItems: items.map(i => ({
            name:            i.product_title || i.title || i.name || "",
            quantity:        i.quantity,
            uniform_type_id: i.uniform_type_id || null,
          })),
        }
      });
    } catch (e) { setErr(e.message); }
    finally { setPlacing(false); }
  };

  // ── PromptPay ─────────────────────────────────────────
  const handlePromptPay = async () => {
    setPlacing(true); setErr("");
    try {
      const res  = await fetch("/api/checkout/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ...buildOrderBody(), payment_method: "promptpay" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
      setOrderId(data.order_id);
      // qr_image_url endpoint requires auth header, so fetch it first
      // then convert to a temporary object URL for <img src=...>.
      if (data.qr_image_url) {
        if (String(data.qr_image_url).startsWith("data:image/")) {
          setQrImageUrl(data.qr_image_url);
        } else {
          const qrRes = await fetch(data.qr_image_url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!qrRes.ok) throw new Error("โหลด QR Code ไม่สำเร็จ");
          const contentType = qrRes.headers.get("content-type") || "";
          if (!contentType.includes("image/")) {
            let detail = "";
            try {
              const maybeJson = await qrRes.json();
              detail = maybeJson?.message || "";
            } catch {
              try { detail = await qrRes.text(); } catch {}
            }
            throw new Error(detail || "รูป QR ไม่ถูกต้อง");
          }
          const qrBlob = await qrRes.blob();
          setQrImageUrl(URL.createObjectURL(qrBlob));
        }
      } else {
        setQrImageUrl(null);
      }
      setMockMode(Boolean(data.mock_mode));
      setAuthorizeUri(data.authorize_uri || null);
    } catch (e) { setErr(e.message); }
    finally { setPlacing(false); }
  };

  // ── Poll PromptPay status ─────────────────────────────
  const checkPromptPayStatus = useCallback(async (forceMock = false) => {
    if (!orderId) return;
    try {
      const res  = await fetch(`/api/checkout/orders/${orderId}/payment-status${forceMock ? "?mock=1" : ""}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ตรวจสอบสถานะชำระเงินไม่สำเร็จ");
      if (data.paid) {
        clearInterval(pollRef.current);
        navigate("/checkout/success", {
          state: {
            orderId,
            isDonation,
            projectId,
            projectTitle,
            schoolName:     useSchoolAddr ? (donationAddr?.name || "") : (selectedAddr?.address_line || ""),
            totalAmount:    total,
            paymentMethod:  "promptpay",
            donorName:      user?.display_name || user?.name || user?.username || "",
            shippingCarrier: Object.values(selectedShipping)[0]?.name || null,
            orderItems: items.map(i => ({
              name:            i.product_title || i.title || i.name || "",
              quantity:        i.quantity,
              uniform_type_id: i.uniform_type_id || null,
            })),
          }
        });
      }
    } catch (e) {
      setErr(e.message || "ตรวจสอบสถานะชำระเงินไม่สำเร็จ");
    }
  }, [orderId, token, navigate]); // eslint-disable-line

  if (!token) return null;

  return (
    <div className="coPage">
      <header className="topBar">
        <div className="topRow">
          <Link to="/" className="brand">
            <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
          </Link>
          <nav className="navLinks">
            <Link to="/">หน้าหลัก</Link>
            <Link to="/market">ร้านค้า</Link>
            {!isDonation && <Link to="/cart">ตะกร้า</Link>}
          </nav>
          <ProfileDropdown />
        </div>
      </header>

      {isDonation && (
        <div className="coDonationBanner">
          <Icon icon="mdi:gift-outline" />
          <span>โหมดซื้อเพื่อส่งต่อ — สินค้าจะถูกจัดส่งตรงให้โรงเรียน</span>
        </div>
      )}

      <div className="coContainer">
        <div className="coSteps">
          {steps.map((s, i) => (
            <div key={i} className={`coStep${step === i+1 ? " coStepActive" : step > i+1 ? " coStepDone" : ""}`}>
              <div className="coStepCircle">
                {step > i+1 ? <Icon icon="mdi:check" /> : i+1}
              </div>
              <span>{s}</span>
              {i < steps.length - 1 && (
                <div className={`coStepLine${step > i+1 ? " coStepLineDone" : step === i+1 ? " coStepLineActive" : ""}`} />
              )}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="coLoading"><Icon icon="mdi:loading" className="coSpinner" /> กำลังโหลด...</div>
        ) : (
          <div className="coLayout">
            <div className="coLeft">

              {/* ══ STEP 1 ══ */}
              {step === 1 && (
                <div className="coSection">
                  <div className="coSectionHead">
                    <h2><Icon icon="mdi:map-marker-outline" /> ที่อยู่จัดส่ง</h2>
                    {!isDonation && (
                      <button className="coAddBtn" onClick={() => { setEditAddr(null); setShowModal(true); }}>
                        <Icon icon="mdi:plus" /> เพิ่มที่อยู่
                      </button>
                    )}
                  </div>

                  {isDonation ? (
                    <div>
                      {/* ── toggle school / buyer ── */}
                      <div className="coDonationAddrToggle">
                        <button
                          className={`coDonationToggleBtn${donationAddrMode === "school" ? " coDonationToggleActive" : ""}`}
                          onClick={() => setDonationAddrMode("school")}
                        >
                          <Icon icon="mdi:school-outline" /> ส่งให้โรงเรียน
                        </button>
                        <button
                          className={`coDonationToggleBtn${donationAddrMode === "buyer" ? " coDonationToggleActive" : ""}`}
                          onClick={() => setDonationAddrMode("buyer")}
                        >
                          <Icon icon="mdi:home-outline" /> ใช้ที่อยู่ของฉัน
                        </button>
                      </div>

                      {donationAddrMode === "school" ? (
                        <DonationAddressBlock shippingAddress={donationAddr} projectTitle={projectTitle} />
                      ) : (
                        <>
                          <p className="coStepDesc" style={{ marginBottom: 12 }}>
                            <Icon icon="mdi:information-outline" /> เลือกที่อยู่ที่ต้องการรับสินค้า (คุณจะรับสินค้าไปส่งต่อเอง)
                          </p>
                          {addresses.length === 0 ? (
                            <div className="coEmpty">
                              <Icon icon="mdi:map-marker-off" fontSize={48} />
                              <p>ยังไม่มีที่อยู่ กรุณาเพิ่มก่อน</p>
                            </div>
                          ) : (
                            <div className="coAddrList">
                              {addresses.map(a => (
                                <div
                                  key={a.address_id}
                                  className={`coAddrCard${selAddress === a.address_id ? " coAddrCardSel" : ""}`}
                                  onClick={() => setSelAddress(a.address_id)}
                                >
                                  <div className="coAddrRadio">
                                    <input type="radio" checked={selAddress === a.address_id} onChange={() => setSelAddress(a.address_id)} />
                                  </div>
                                  <div className="coAddrBody">
                                    <div className="coAddrTop">
                                      <span className="coAddrName">{a.recipient_name}</span>
                                      <span className="coAddrPhone">{a.phone}</span>
                                      {a.is_default ? <span className="coBadgeDefault">ที่อยู่หลัก</span> : null}
                                    </div>
                                    <div className="coAddrText">{a.address_line} {a.district} {a.province} {a.postcode}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <button className="coAddBtn" style={{ marginTop: 12 }} onClick={() => { setEditAddr(null); setShowModal(true); }}>
                            <Icon icon="mdi:plus" /> เพิ่มที่อยู่
                          </button>
                        </>
                      )}
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="coEmpty">
                      <Icon icon="mdi:map-marker-off" fontSize={48} />
                      <p>ยังไม่มีที่อยู่ กรุณาเพิ่มก่อน</p>
                    </div>
                  ) : (
                    <div className="coAddrList">
                      {addresses.map(a => (
                        <div
                          key={a.address_id}
                          className={`coAddrCard${selAddress === a.address_id ? " coAddrCardSel" : ""}`}
                          onClick={() => setSelAddress(a.address_id)}
                        >
                          <div className="coAddrRadio">
                            <input type="radio" checked={selAddress === a.address_id} onChange={() => setSelAddress(a.address_id)} />
                          </div>
                          <div className="coAddrBody">
                            <div className="coAddrTop">
                              <span className="coAddrName">{a.recipient_name}</span>
                              <span className="coAddrPhone">{a.phone}</span>
                              {a.is_default ? <span className="coBadgeDefault">ที่อยู่หลัก</span> : null}
                            </div>
                            <div className="coAddrText">{a.address_line} {a.district} {a.province} {a.postcode}</div>
                          </div>
                          <div className="coAddrBtns">
                            <button className="coAddrBtn" onClick={e => { e.stopPropagation(); setEditAddr(a); setShowModal(true); }}>
                              <Icon icon="mdi:pencil-outline" />
                            </button>
                            {confirmDeleteId === a.address_id ? (
                              <span className="coAddrDelConfirm" onClick={e => e.stopPropagation()}>
                                <span>ลบ?</span>
                                <button className="coAddrBtnDelConfirm" onClick={e => { e.stopPropagation(); deleteAddr(a.address_id); }}>ใช่</button>
                                <button className="coAddrBtnDelCancel" onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}>ไม่</button>
                              </span>
                            ) : (
                              <button className="coAddrBtn coAddrBtnDel" onClick={e => { e.stopPropagation(); setConfirmDeleteId(a.address_id); }}>
                                <Icon icon="mdi:trash-can-outline" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="coNavBtns">
                    {isDonation
                      ? <button className="coBtnOutline" onClick={() => navigate(-1)}><Icon icon="mdi:arrow-left" /> ย้อนกลับ</button>
                      : <Link to="/cart" className="coBtnOutline"><Icon icon="mdi:arrow-left" /> ย้อนกลับ</Link>
                    }
                    <button className="coBtnPrimary" disabled={!step1Valid} onClick={() => setStep(2)}>
                      ถัดไป <Icon icon="mdi:arrow-right" />
                    </button>
                  </div>
                </div>
              )}

              {/* ══ STEP 2 ══ */}
              {step === 2 && (
                <div className="coSection">
                  <h2><Icon icon="mdi:truck-outline" /> การจัดส่ง</h2>
                  <p className="coStepDesc">เลือกบริษัทขนส่งสำหรับแต่ละร้านค้า ค่าจัดส่งคำนวณตามน้ำหนักและยอดสินค้า</p>
                  <div className="coSellerList">
                    {groups.map(g => (
                      <SellerShippingBlock
                        key={g.seller_id}
                        group={g}
                        shippingOptions={shippingOptions}
                        selectedShipping={selectedShipping}
                        setSelectedShipping={setSelectedShipping}
                      />
                    ))}
                  </div>
                  <div className="coNavBtns">
                    <button className="coBtnOutline" onClick={() => setStep(1)}><Icon icon="mdi:arrow-left" /> ย้อนกลับ</button>
                    <button className="coBtnPrimary" disabled={!step2Valid} onClick={() => setStep(3)}>
                      ถัดไป <Icon icon="mdi:arrow-right" />
                    </button>
                  </div>
                </div>
              )}

              {/* ══ STEP 3 ══ */}
              {step === 3 && (
                <div className="coSection">
                  <h2><Icon icon="mdi:clipboard-check-outline" /> {isDonation ? "ยืนยันการส่งต่อ" : "ชำระเงิน"}</h2>

                  {isDonation && useSchoolAddr ? (
                    <div className="coConfirmBlock">
                      <div className="coConfirmIcon"><Icon icon="mdi:school-outline" /></div>
                      <div className="coConfirmContent">
                        <div className="coConfirmLabelText">จัดส่งให้โรงเรียน</div>
                        <div className="coConfirmVal">
                          <b>{donationAddr?.name}</b>{donationAddr?.phone && ` · ${donationAddr.phone}`}<br />
                          {[donationAddr?.address, donationAddr?.district, donationAddr?.province, donationAddr?.postal_code].filter(Boolean).join(" ")}
                        </div>
                      </div>
                      <button className="coEditLink" onClick={() => setStep(1)}>เปลี่ยน</button>
                    </div>
                  ) : selectedAddr ? (
                    <div className="coConfirmBlock">
                      <div className="coConfirmIcon"><Icon icon="mdi:map-marker-outline" /></div>
                      <div className="coConfirmContent">
                        <div className="coConfirmLabelText">ที่อยู่จัดส่ง</div>
                        <div className="coConfirmVal">
                          <b>{selectedAddr.recipient_name}</b> · {selectedAddr.phone}<br />
                          {selectedAddr.address_line} {selectedAddr.district} {selectedAddr.province} {selectedAddr.postcode}
                        </div>
                      </div>
                      <button className="coEditLink" onClick={() => setStep(1)}>เปลี่ยน</button>
                    </div>
                  ) : null}

                  {groups.map(g => {
                    const sub  = g.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
                    const ship = selectedShipping[g.seller_id];
                    return (
                      <div key={g.seller_id} className="coSummaryGroup">
                        <div className="coSummaryGroupName"><Icon icon="mdi:store-outline" /> {g.seller_name}</div>
                        {g.items.map(item => {
                          const cat   = getCategoryLabel(item.category_id, item.gender);
                          const type  = item.type_name?.trim();
                          const title = type ? `${cat}: ${type}` : cat;
                          return (
                            <div key={item.cart_item_id} className="coSummaryItem">
                              <span>{title} × {item.quantity}</span>
                              <span>{(Number(item.price) * item.quantity).toLocaleString()} บาท</span>
                            </div>
                          );
                        })}
                        <div className="coSummaryShip">
                          <span>ค่าจัดส่ง {ship ? `(${ship.name})` : ""}</span>
                          <span>{!ship ? "-" : ship.price === 0 ? "ส่งฟรี" : `${Number(ship.price).toLocaleString()} บาท`}</span>
                        </div>
                        <div className="coConfirmSellerFoot">ยอดร้านนี้ {(sub + (ship?.price || 0)).toLocaleString()} บาท</div>
                      </div>
                    );
                  })}

                  {isDonation && (
                    <div className="coDonationNote">
                      <Icon icon="mdi:information-outline" />
                      เมื่อโรงเรียนยืนยันรับสินค้า คุณจะได้แจ้งเตือนพร้อมรับใบเกียรติบัตร
                    </div>
                  )}

                  {/* ── ชำระเงิน ── */}
                  {!qrImageUrl && (
                    <>
                      {isDonation && (
                        <div className="coDonationNote" style={{ marginBottom: 12 }}>
                          <Icon icon="mdi:information-outline" />
                          กรุณาชำระเงินเพื่อยืนยันการส่งต่อ — สินค้าจะถูกจัดส่งตรงไปยังโรงเรียน
                        </div>
                      )}
                      <div className="coPayMethodBar">
                        <button
                          className={`coPayMethodBtn ${payMethod === "card" ? "coPayMethodActive" : ""}`}
                          onClick={() => setPayMethod("card")}
                        >
                          <Icon icon="mdi:credit-card-outline" /> บัตรเครดิต/เดบิต
                        </button>
                        <button
                          className={`coPayMethodBtn ${payMethod === "promptpay" ? "coPayMethodActive" : ""}`}
                          onClick={() => setPayMethod("promptpay")}
                        >
                          <Icon icon="mdi:qrcode" /> PromptPay
                        </button>
                      </div>

                      {payMethod === "card" && (
                        <OmiseCardForm
                          amount={total}
                          onToken={handleCardPayment}
                          onError={msg => setErr(msg)}
                          disabled={placing}
                        />
                      )}

                      {payMethod === "promptpay" && (
                        <div className="coPromptPaySection">
                          <p className="coPromptPayDesc">
                            <Icon icon="mdi:information-outline" />
                            กด "สร้าง QR Code" แล้วสแกนด้วยแอปธนาคาร ระบบจะยืนยันอัตโนมัติ
                          </p>
                          <button className="coBtnYellow coCardPayBtn" onClick={handlePromptPay} disabled={placing}>
                            {placing
                              ? <><Icon icon="mdi:loading" className="coSpinner" /> กำลังสร้าง QR...</>
                              : <><Icon icon="mdi:qrcode-scan" /> สร้าง QR Code {total.toLocaleString()} บาท</>
                            }
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* QR Code PromptPay */}
                  {qrImageUrl && (
                    <PromptPayBlock
                      qrImageUrl={qrImageUrl}
                      amount={total}
                      onConfirm={checkPromptPayStatus}
                      mockMode={mockMode}
                    />
                  )}

                  {/* Fallback: authorize_uri */}
                  {!qrImageUrl && authorizeUri && (
                    <div className="coAuthorizeBlock">
                      <Icon icon="mdi:qrcode-scan" style={{ fontSize: 32, color: "#3b82f6" }} />
                      <p>ไม่สามารถโหลด QR Code ได้ กรุณากดปุ่มด้านล่างเพื่อชำระเงินผ่าน Omise</p>
                      <a href={authorizeUri} target="_blank" rel="noopener noreferrer"
                        className="coBtnYellow coCardPayBtn"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                        <Icon icon="mdi:open-in-new" /> เปิดหน้าชำระ PromptPay
                      </a>
                      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
                        หลังชำระเงินแล้ว กลับมาที่หน้านี้ ระบบจะยืนยันอัตโนมัติ
                      </p>
                    </div>
                  )}

                  {err && <div className="coErr"><Icon icon="mdi:alert-circle" /> {err}</div>}

                  <div className="coNavBtns">
                    <button className="coBtnOutline" onClick={() => setStep(2)}><Icon icon="mdi:arrow-left" /> ย้อนกลับ</button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <div className="coRight">
              <div className="coSummaryCard">
                {isDonation && <div className="coSummaryDonationTag"><Icon icon="mdi:gift-outline" /> ซื้อเพื่อส่งต่อ</div>}
                <div className="coSummaryTitle">สรุปคำสั่งซื้อ</div>

                {groups.map(g => {
                  const ship = selectedShipping[g.seller_id];
                  return (
                    <div key={g.seller_id} className="coSummaryGroup">
                      <div className="coSummaryGroupName"><Icon icon="mdi:store-outline" /> {g.seller_name}</div>
                      {g.items.map(item => {
                        const cat   = getCategoryLabel(item.category_id, item.gender);
                        const type  = item.type_name?.trim();
                        const title = type ? `${cat}: ${type}` : cat;
                        return (
                          <div key={item.cart_item_id} className="coSummaryItem">
                            <span className="coSummaryItemName">{title} × {item.quantity}</span>
                            <span>{(Number(item.price) * item.quantity).toLocaleString()} บาท</span>
                          </div>
                        );
                      })}
                      <div className="coSummaryShip">
                        <span>ค่าจัดส่ง</span>
                        <span>{!ship ? "-" : ship.price === 0 ? "ส่งฟรี" : `${Number(ship.price).toLocaleString()} บาท`}</span>
                      </div>
                      {ship && <div className="coConfirmShipTag">🚚 {ship.name}{ship.price === 0 ? " · ส่งฟรี" : ` · ${ship.price} บาท`}</div>}
                    </div>
                  );
                })}

                <div className="coSummaryDivider" />
                <div className="coSummaryRow"><span>ยอดสินค้า</span><span>{subtotal.toLocaleString()} บาท</span></div>
                <div className="coSummaryRow"><span>ค่าจัดส่งรวม</span><span>{shippingTotal > 0 ? `${shippingTotal.toLocaleString()} บาท` : "ส่งฟรี"}</span></div>
                <div className="coSummaryDivider" />
                <div className="coSummaryTotal">
                  <span>ยอดรวมทั้งหมด</span>
                  <span className="coTotalPrice">{total.toLocaleString()} บาท</span>
                </div>

                {isDonation && donationAddr && (
                  <>
                    <div className="coSummaryDivider" />
                    <div className="coSummaryDonationAddr">
                      <Icon icon="mdi:school-outline" />
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{donationAddr.name}</div>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                          {[donationAddr.province, donationAddr.postal_code].filter(Boolean).join(" ")}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddressModal
          address={editAddr}
          onSave={saveAddress}
          onClose={() => { setShowModal(false); setEditAddr(null); }}
        />
      )}
    </div>
  );
}