// // frontend/src/features/market/pages/CheckoutPage.jsx
// import { useState, useEffect, useCallback } from "react";
// import { Link, useNavigate, useSearchParams } from "react-router-dom";
// import { Icon } from "@iconify/react";
// import { useAuth } from "../../../context/AuthContext.jsx";
// import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
// import "../styles/CheckoutPage.css";

// // ── helpers ──────────────────────────────────────────────
// function getCategoryLabel(cid, gender) {
//   const c = Number(cid);
//   if (c === 1) return gender === "male" ? "เสื้อนักเรียนชาย" : "เสื้อนักเรียนหญิง";
//   if (c === 2) return "กางเกงนักเรียน";
//   if (c === 3) return "กระโปรงนักเรียน";
//   return "ชุดนักเรียน";
// }

// function getSizeText(size, categoryId) {
//   if (!size) return null;
//   try {
//     const s = JSON.parse(size);
//     const cid = Number(categoryId);
//     const parts = [];
//     if (cid === 1) {
//       if (s.chest  && s.chest  !== "0") parts.push(`อก ${s.chest}`);
//       if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
//     } else {
//       if (s.waist  && s.waist  !== "0") parts.push(`เอว ${s.waist}`);
//       if (s.length && s.length !== "0") parts.push(`ยาว ${s.length}`);
//     }
//     return parts.join(" / ") || null;
//   } catch { return size; }
// }

// function groupBySeller(items) {
//   const map = new Map();
//   for (const item of items) {
//     const key = item.seller_id || "unknown";
//     if (!map.has(key)) {
//       map.set(key, { seller_id: key, seller_name: item.seller_name || "ไม่ระบุ", items: [] });
//     }
//     map.get(key).items.push(item);
//   }
//   return Array.from(map.values());
// }

// // ── Address Form Modal ────────────────────────────────────
// function AddressModal({ address, onSave, onClose }) {
//   const [form, setForm] = useState(address || {
//     recipient_name: "", phone: "", address_line: "",
//     district: "", province: "", postcode: "", is_default: false,
//   });
//   const [saving, setSaving] = useState(false);
//   const [err,    setErr]    = useState("");

//   const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

//   const handleSave = async () => {
//     if (!form.recipient_name || !form.phone || !form.address_line || !form.district || !form.province || !form.postcode) {
//       setErr("กรุณากรอกข้อมูลให้ครบถ้วน"); return;
//     }
//     setSaving(true);
//     try { await onSave(form); onClose(); }
//     catch (e) { setErr(e.message); }
//     finally   { setSaving(false); }
//   };

//   return (
//     <div className="coModalOverlay" onClick={onClose}>
//       <div className="coModal" onClick={e => e.stopPropagation()}>
//         <div className="coModalHeader">
//           <h3>{address ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่ใหม่"}</h3>
//           <button className="coModalClose" onClick={onClose}><Icon icon="mdi:close" /></button>
//         </div>
//         <div className="coModalBody">
//           {err && <div className="coModalErr"><Icon icon="mdi:alert-circle" /> {err}</div>}
//           <div className="coFormGrid">
//             <div className="coFormGroup coSpan2">
//               <label>ชื่อผู้รับ *</label>
//               <input value={form.recipient_name} onChange={e => update("recipient_name", e.target.value)} placeholder="ชื่อ-นามสกุล" />
//             </div>
//             <div className="coFormGroup coSpan2">
//               <label>เบอร์โทร *</label>
//               <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08x-xxx-xxxx" />
//             </div>
//             <div className="coFormGroup coSpan2">
//               <label>ที่อยู่ *</label>
//               <input value={form.address_line} onChange={e => update("address_line", e.target.value)} placeholder="บ้านเลขที่ ถนน ซอย" />
//             </div>
//             <div className="coFormGroup">
//               <label>แขวง/ตำบล *</label>
//               <input value={form.district} onChange={e => update("district", e.target.value)} placeholder="แขวง/ตำบล" />
//             </div>
//             <div className="coFormGroup">
//               <label>จังหวัด *</label>
//               <input value={form.province} onChange={e => update("province", e.target.value)} placeholder="จังหวัด" />
//             </div>
//             <div className="coFormGroup">
//               <label>รหัสไปรษณีย์ *</label>
//               <input value={form.postcode} onChange={e => update("postcode", e.target.value)} placeholder="10xxx" maxLength={5} />
//             </div>
//             <div className="coFormGroup coSpan2">
//               <label className="coCheckLabel">
//                 <input type="checkbox" checked={!!form.is_default} onChange={e => update("is_default", e.target.checked)} />
//                 ตั้งเป็นที่อยู่หลัก
//               </label>
//             </div>
//           </div>
//         </div>
//         <div className="coModalFooter">
//           <button className="coBtnOutline" onClick={onClose}>ยกเลิก</button>
//           <button className="coBtnPrimary" onClick={handleSave} disabled={saving}>
//             {saving && <Icon icon="mdi:loading" className="coSpinner" />} บันทึก
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Seller Shipping Block ─────────────────────────────────
// function SellerShippingBlock({ group }) {
//   const subtotal = group.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

//   return (
//     <div className="coSellerBlock">
//       <div className="coSellerHeader">
//         <div className="coSellerAvatarSm">{group.seller_name[0].toUpperCase()}</div>
//         <span className="coSellerNameSm">{group.seller_name}</span>
//         <span className="coSellerSubtotal">{subtotal.toLocaleString()} บาท</span>
//       </div>

//       <div className="coSellerItems">
//         {group.items.map(item => {
//           const cat   = getCategoryLabel(item.category_id, item.gender);
//           const type  = item.type_name?.trim();
//           const title = type ? `${cat}: ${type}` : cat;
//           const size  = getSizeText(item.size, item.category_id);
//           return (
//             <div key={item.cart_item_id} className="coSellerItem">
//               <div className="coSellerItemImg">
//                 {item.cover_image
//                   ? <img src={item.cover_image} alt={title} loading="lazy" />
//                   : <Icon icon="mdi:tshirt-crew" />
//                 }
//               </div>
//               <div className="coSellerItemInfo">
//                 <div className="coSellerItemTitle">{title}</div>
//                 {item.school_name && <div className="coSellerItemMeta">{item.school_name}</div>}
//                 {size && <div className="coSellerItemMeta">ขนาด: {size}</div>}
//                 <div className="coSellerItemMeta">× {item.quantity} ชิ้น</div>
//               </div>
//               <div className="coSellerItemPrice">
//                 {(Number(item.price) * item.quantity).toLocaleString()} บาท
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       {/* ✅ แสดงขนส่งจากสินค้าโดยตรง */}
//       <div className="coShipSection">
//         <div className="coShipSectionTitle">
//           <Icon icon="mdi:truck-outline" /> การจัดส่ง
//         </div>
//         {group.items.map(item => (
//           <div key={item.cart_item_id} className="coShipFixed">
//             <Icon icon="mdi:check-circle" style={{ color: "#22c55e" }} />
//             <span>{item.shipping_name || "ไม่ระบุขนส่ง"}</span>
//             <span>· ค่าขนส่ง {Number(item.shipping_price || 0).toLocaleString()} บาท</span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// // ── Main ─────────────────────────────────────────────────
// export default function CheckoutPage() {
//   const { token } = useAuth();
//   const navigate  = useNavigate();
//   const [params]  = useSearchParams();
//   const itemIds   = params.get("items")?.split(",").map(Number).filter(Boolean) || [];
//   const buyType   = params.get("type");

//   const [step,       setStep]       = useState(1);
//   const [items,      setItems]      = useState([]);
//   const [addresses,  setAddresses]  = useState([]);
//   const [selAddress, setSelAddress] = useState(null);
//   const [showModal,  setShowModal]  = useState(false);
//   const [editAddr,   setEditAddr]   = useState(null);
//   const [loading,    setLoading]    = useState(true);
//   const [placing,    setPlacing]    = useState(false);
//   const [err,        setErr]        = useState("");

//   const groups = groupBySeller(items);

//   // ── Load ──────────────────────────────────────────────
//   useEffect(() => {
//     if (!token) { navigate("/login"); return; }
//     if (!itemIds.length) { navigate("/cart"); return; }

//     const itemsUrl = buyType === "product"
//       ? `/api/checkout/items/by-product?items=${itemIds.join(",")}`
//       : `/api/checkout/items?items=${itemIds.join(",")}`;

//     Promise.all([
//       fetch(itemsUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
//       fetch("/api/checkout/addresses", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
//     ]).then(([its, addrs]) => {
//       setItems(Array.isArray(its)   ? its   : []);
//       setAddresses(Array.isArray(addrs) ? addrs : []);
//       const def = (Array.isArray(addrs) ? addrs : []).find(a => a.is_default) || addrs[0];
//       if (def) setSelAddress(def.address_id);
//     }).catch(console.error)
//       .finally(() => setLoading(false));
//   }, [token]);

//   const saveAddress = useCallback(async (form) => {
//     const isEdit = !!editAddr;
//     const url    = isEdit ? `/api/checkout/addresses/${editAddr.address_id}` : "/api/checkout/addresses";
//     const method = isEdit ? "PUT" : "POST";
//     const res    = await fetch(url, {
//       method,
//       headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//       body:    JSON.stringify(form),
//     });
//     const data = await res.json();
//     if (!res.ok) throw new Error(data.message);
//     const fresh = await fetch("/api/checkout/addresses", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
//     setAddresses(fresh);
//     setSelAddress(data.address_id);
//     setEditAddr(null);
//   }, [token, editAddr]);

//   const deleteAddr = async (id) => {
//     await fetch(`/api/checkout/addresses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
//     const fresh = await fetch("/api/checkout/addresses", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
//     setAddresses(fresh);
//     if (selAddress === id) setSelAddress(fresh[0]?.address_id || null);
//   };

//   // ── คำนวณยอด ──────────────────────────────────────────
//   const subtotal      = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
//   const shippingTotal = items.reduce((s, i) => s + Number(i.shipping_price || 0), 0);
//   const total         = subtotal + shippingTotal;
//   const selectedAddr  = addresses.find(a => a.address_id === selAddress);
//   const steps         = ["ที่อยู่จัดส่ง", "การจัดส่ง", "ยืนยันคำสั่งซื้อ"];

//   if (!token) return null;

//   return (
//     <div className="coPage">
//       <header className="topBar">
//         <div className="topRow">
//           <Link to="/" className="brand">
//             <img className="brandLogo" src="/src/unieed_pic/logo.png" alt="Unieed" />
//           </Link>
//           <nav className="navLinks">
//             <Link to="/">หน้าหลัก</Link>
//             <Link to="/market">ร้านค้า</Link>
//             <Link to="/cart">ตะกร้า</Link>
//           </nav>
//           <ProfileDropdown />
//         </div>
//       </header>

//       <div className="coContainer">
//         {/* Steps */}
//         <div className="coSteps">
//           {steps.map((s, i) => (
//             <div key={i} className={`coStep${step === i+1 ? " coStepActive" : step > i+1 ? " coStepDone" : ""}`}>
//               <div className="coStepCircle">
//                 {step > i+1 ? <Icon icon="mdi:check" /> : i+1}
//               </div>
//               <span>{s}</span>
//               {i < steps.length - 1 && (
//                 <div className={`coStepLine${step > i+1 ? " coStepLineDone" : step === i+1 ? " coStepLineActive" : ""}`} />
//               )}
//             </div>
//           ))}
//         </div>

//         {loading ? (
//           <div className="coLoading"><Icon icon="mdi:loading" className="coSpinner" /> กำลังโหลด...</div>
//         ) : (
//           <div className="coLayout">
//             <div className="coLeft">

//               {/* ── Step 1: Address ── */}
//               {step === 1 && (
//                 <div className="coSection">
//                   <div className="coSectionHead">
//                     <h2><Icon icon="mdi:map-marker-outline" /> ที่อยู่จัดส่ง</h2>
//                     <button className="coAddBtn" onClick={() => { setEditAddr(null); setShowModal(true); }}>
//                       <Icon icon="mdi:plus" /> เพิ่มที่อยู่
//                     </button>
//                   </div>

//                   {addresses.length === 0 ? (
//                     <div className="coEmpty">
//                       <Icon icon="mdi:map-marker-off" fontSize={48} />
//                       <p>ยังไม่มีที่อยู่ กรุณาเพิ่มก่อน</p>
//                     </div>
//                   ) : (
//                     <div className="coAddrList">
//                       {addresses.map(a => (
//                         <div
//                           key={a.address_id}
//                           className={`coAddrCard${selAddress === a.address_id ? " coAddrCardSel" : ""}`}
//                           onClick={() => setSelAddress(a.address_id)}
//                         >
//                           <div className="coAddrRadio">
//                             <input type="radio" checked={selAddress === a.address_id} onChange={() => setSelAddress(a.address_id)} />
//                           </div>
//                           <div className="coAddrBody">
//                             <div className="coAddrTop">
//                               <span className="coAddrName">{a.recipient_name}</span>
//                               <span className="coAddrPhone">{a.phone}</span>
//                               {a.is_default ? <span className="coBadgeDefault">ที่อยู่หลัก</span> : null}
//                             </div>
//                             <div className="coAddrText">
//                               {a.address_line} {a.district} {a.province} {a.postcode}
//                             </div>
//                           </div>
//                           <div className="coAddrBtns">
//                             <button className="coAddrBtn" title="แก้ไข"
//                               onClick={e => { e.stopPropagation(); setEditAddr(a); setShowModal(true); }}>
//                               <Icon icon="mdi:pencil-outline" />
//                             </button>
//                             <button className="coAddrBtn coAddrBtnDel" title="ลบ"
//                               onClick={e => { e.stopPropagation(); deleteAddr(a.address_id); }}>
//                               <Icon icon="mdi:trash-can-outline" />
//                             </button>
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   )}

//                   <div className="coNavBtns">
//                     <Link to="/cart" className="coBtnOutline"><Icon icon="mdi:arrow-left" /> ย้อนกลับ</Link>
//                     <button className="coBtnPrimary" disabled={!selAddress} onClick={() => setStep(2)}>
//                       ถัดไป <Icon icon="mdi:arrow-right" />
//                     </button>
//                   </div>
//                 </div>
//               )}

//               {/* ── Step 2: Shipping ── */}
//               {step === 2 && (
//                 <div className="coSection">
//                   <h2><Icon icon="mdi:truck-outline" /> การจัดส่ง</h2>
//                   <div className="coSellerList">
//                     {groups.map(g => (
//                       <SellerShippingBlock key={g.seller_id} group={g} />
//                     ))}
//                   </div>
//                   <div className="coNavBtns">
//                     <button className="coBtnOutline" onClick={() => setStep(1)}>
//                       <Icon icon="mdi:arrow-left" /> ย้อนกลับ
//                     </button>
//                     <button className="coBtnPrimary" onClick={() => setStep(3)}>
//                       ถัดไป <Icon icon="mdi:arrow-right" />
//                     </button>
//                   </div>
//                 </div>
//               )}

//               {/* ── Step 3: Confirm ── */}
//               {step === 3 && (
//                 <div className="coSection">
//                   <h2><Icon icon="mdi:clipboard-check-outline" /> ยืนยันคำสั่งซื้อ</h2>

//                   {selectedAddr && (
//                     <div className="coConfirmBlock">
//                       <div className="coConfirmIcon"><Icon icon="mdi:map-marker-outline" /></div>
//                       <div className="coConfirmContent">
//                         <div className="coConfirmLabelText">ที่อยู่จัดส่ง</div>
//                         <div className="coConfirmVal">
//                           <b>{selectedAddr.recipient_name}</b> · {selectedAddr.phone}<br />
//                           {selectedAddr.address_line} {selectedAddr.district} {selectedAddr.province} {selectedAddr.postcode}
//                         </div>
//                       </div>
//                       <button className="coEditLink" onClick={() => setStep(1)}>เปลี่ยน</button>
//                     </div>
//                   )}

//                   {groups.map(g => {
//                     const sub = g.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
//                     const shipTotal = g.items.reduce((s, i) => s + Number(i.shipping_price || 0), 0);
//                     return (
//                       <div key={g.seller_id} className="coConfirmSeller">
//                         <div className="coConfirmSellerHead">
//                           <div className="coSellerAvatarSm">{g.seller_name[0].toUpperCase()}</div>
//                           <span className="coSellerNameSm">{g.seller_name}</span>
//                           <button className="coEditLink" onClick={() => setStep(2)}>เปลี่ยน</button>
//                         </div>
//                         {g.items.map(item => {
//                           const cat   = getCategoryLabel(item.category_id, item.gender);
//                           const type  = item.type_name?.trim();
//                           const title = type ? `${cat}: ${type}` : cat;
//                           const size  = getSizeText(item.size, item.category_id);
//                           return (
//                             <div key={item.cart_item_id} className="coConfirmItem">
//                               <div className="coConfirmItemImg">
//                                 {item.cover_image
//                                   ? <img src={item.cover_image} alt={title} />
//                                   : <Icon icon="mdi:tshirt-crew" />
//                                 }
//                               </div>
//                               <div className="coConfirmItemInfo">
//                                 <div className="coConfirmItemTitle">{title}</div>
//                                 {item.school_name && <div className="coConfirmItemMeta">{item.school_name}</div>}
//                                 {size && <div className="coConfirmItemMeta">ขนาด: {size}</div>}
//                                 <div className="coConfirmItemMeta">จำนวน: {item.quantity} ชิ้น</div>
//                                 {item.shipping_name && (
//                                   <div className="coConfirmItemMeta">
//                                     <Icon icon="mdi:truck-outline" /> {item.shipping_name}
//                                     · ค่าขนส่ง {Number(item.shipping_price || 0).toLocaleString()} บาท
//                                   </div>
//                                 )}
//                               </div>
//                               <div className="coConfirmItemPrice">
//                                 {(Number(item.price) * item.quantity).toLocaleString()} บาท
//                               </div>
//                             </div>
//                           );
//                         })}
//                         <div className="coConfirmSellerFoot">
//                           ยอดสินค้า {sub.toLocaleString()} บาท
//                           {shipTotal > 0 && ` + ค่าขนส่ง ${shipTotal.toLocaleString()} บาท`}
//                         </div>
//                       </div>
//                     );
//                   })}

//                   {err && <div className="coErr"><Icon icon="mdi:alert-circle" /> {err}</div>}

//                   <div className="coNavBtns">
//                     <button className="coBtnOutline" onClick={() => setStep(2)}>
//                       <Icon icon="mdi:arrow-left" /> ย้อนกลับ
//                     </button>
//                     <button className="coBtnYellow" disabled={placing} onClick={async () => {
//                       setPlacing(true); setErr("");
//                       try {
//                         await new Promise(r => setTimeout(r, 1000));
//                         navigate("/market", { state: { successMsg: "สั่งซื้อสำเร็จ! 🎉" } });
//                       } catch(e) { setErr(e.message); }
//                       finally { setPlacing(false); }
//                     }}>
//                       {placing ? <Icon icon="mdi:loading" className="coSpinner" /> : <Icon icon="mdi:credit-card-outline" />}
//                       ยืนยันคำสั่งซื้อ
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>

//             {/* ── Summary ── */}
//             <div className="coRight">
//               <div className="coSummaryCard">
//                 <div className="coSummaryTitle">สรุปคำสั่งซื้อ</div>
//                 {groups.map(g => {
//                   const sub = g.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
//                   return (
//                     <div key={g.seller_id} className="coSummaryGroup">
//                       <div className="coSummaryGroupName">
//                         <Icon icon="mdi:store-outline" /> {g.seller_name}
//                       </div>
//                       {g.items.map(item => {
//                         const cat   = getCategoryLabel(item.category_id, item.gender);
//                         const type  = item.type_name?.trim();
//                         const title = type ? `${cat}: ${type}` : cat;
//                         return (
//                           <div key={item.cart_item_id} className="coSummaryItem">
//                             <span className="coSummaryItemName">{title} × {item.quantity}</span>
//                             <span>{(Number(item.price) * item.quantity).toLocaleString()} บาท</span>
//                           </div>
//                         );
//                       })}
//                       <div className="coSummaryShip">
//                         <span>ค่าจัดส่ง</span>
//                         <span>
//                           {g.items.reduce((s, i) => s + Number(i.shipping_price || 0), 0).toLocaleString()} บาท
//                         </span>
//                       </div>
//                     </div>
//                   );
//                 })}
//                 <div className="coSummaryDivider" />
//                 <div className="coSummaryRow">
//                   <span>ยอดสินค้า</span>
//                   <span>{subtotal.toLocaleString()} บาท</span>
//                 </div>
//                 <div className="coSummaryRow">
//                   <span>ค่าจัดส่งรวม</span>
//                   <span>{shippingTotal.toLocaleString()} บาท</span>
//                 </div>
//                 <div className="coSummaryDivider" />
//                 <div className="coSummaryTotal">
//                   <span>ยอดรวมทั้งหมด</span>
//                   <span className="coTotalPrice">{total.toLocaleString()} บาท</span>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       {showModal && (
//         <AddressModal
//           address={editAddr}
//           onSave={saveAddress}
//           onClose={() => { setShowModal(false); setEditAddr(null); }}
//         />
//       )}
//     </div>
//   );
// }

// ----- new ver.
// frontend/src/features/market/pages/CheckoutPage.jsx
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../../context/AuthContext.jsx";
import ProfileDropdown from "../../auth/pages/ProfileDropdown.jsx";
import "../styles/CheckoutPage.css";
 
// ── helpers ──────────────────────────────────────────────
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
    const s   = JSON.parse(size);
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
 
// ── Address Form Modal ────────────────────────────────────
function AddressModal({ address, onSave, onClose }) {
  const [form, setForm] = useState(address || {
    recipient_name: "", phone: "", address_line: "",
    district: "", province: "", postcode: "", is_default: false,
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
 
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
 
  const handleSave = async () => {
    if (!form.recipient_name || !form.phone || !form.address_line ||
        !form.district || !form.province || !form.postcode) {
      setErr("กรุณากรอกข้อมูลให้ครบถ้วน"); return;
    }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e) { setErr(e.message); }
    finally   { setSaving(false); }
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
 
// ── Seller Shipping Block ─────────────────────────────────
function SellerShippingBlock({ group }) {
  const subtotal = group.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  return (
    <div className="coSellerBlock">
      <div className="coSellerHeader">
        <div className="coSellerAvatarSm">{group.seller_name[0].toUpperCase()}</div>
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
        {group.items.map(item => (
          <div key={item.cart_item_id} className="coShipFixed">
            <Icon icon="mdi:check-circle" style={{ color: "#22c55e" }} />
            <span>{item.shipping_name || "ไม่ระบุขนส่ง"}</span>
            <span>· ค่าขนส่ง {Number(item.shipping_price || 0).toLocaleString()} บาท</span>
          </div>
        ))}
      </div>
    </div>
  );
}
 
// ── Donation Address Block (แสดงแทน address selector เมื่อเป็น donation) ──
function DonationAddressBlock({ shippingAddress, projectTitle }) {
  return (
    <div className="coDonationAddrBlock">
      <div className="coDonationAddrBadge">
        <Icon icon="mdi:gift-outline" /> ซื้อเพื่อส่งต่อ
      </div>
      {projectTitle && (
        <div className="coDonationProject">
          <Icon icon="mdi:clipboard-text-outline" />
          <span>{projectTitle}</span>
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
            <div className="coDonationAddrPhone">
              <Icon icon="mdi:phone-outline" /> {shippingAddress.phone}
            </div>
          )}
        </div>
      </div>
      <p className="coDonationAddrNote">
        <Icon icon="mdi:information-outline" />
        ที่อยู่จัดส่งจะเป็นโรงเรียนโดยอัตโนมัติ ไม่สามารถเปลี่ยนได้
      </p>
    </div>
  );
}
 
 
 
// ── Main ─────────────────────────────────────────────────
export default function CheckoutPage() {
  const { token }    = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const [params]     = useSearchParams();
 
  // ── donation state จาก location.state หรือ sessionStorage (กัน refresh หาย) ──
  // บันทึกไว้ใน sessionStorage ครั้งแรกที่เข้ามาพร้อม state
  useEffect(() => {
    if (location.state?.isDonation) {
      sessionStorage.setItem(
        `donationState_${params.get("items")}`,
        JSON.stringify(location.state)
      );
    }
  }, []); // eslint-disable-line
 
  const _savedDonation = (() => {
    try {
      return JSON.parse(
        sessionStorage.getItem(`donationState_${params.get("items")}`) || "{}"
      );
    } catch { return {}; }
  })();
 
  const isDonation      = (location.state?.isDonation ?? _savedDonation.isDonation) === true;
  const donationAddress = location.state?.shippingAddress ?? _savedDonation.shippingAddress ?? null;
  const projectId       = location.state?.project_id      ?? _savedDonation.project_id      ?? null;
  const projectTitle    = location.state?.project_title   ?? _savedDonation.project_title   ?? null;
 
  const itemIds = params.get("items")?.split(",").map(Number).filter(Boolean) || [];
  const buyType = params.get("type");
 
  const [step,       setStep]       = useState(1);
  const [items,      setItems]      = useState([]);
  const [addresses,  setAddresses]  = useState([]);
  const [selAddress, setSelAddress] = useState(null);
  const [showModal,  setShowModal]  = useState(false);
  const [editAddr,   setEditAddr]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [placing,    setPlacing]    = useState(false);
  const [err,        setErr]        = useState("");
 
  const groups = groupBySeller(items);
 
  // ── Load items + addresses ────────────────────────────
  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    if (!itemIds.length) { navigate("/cart"); return; }
 
    const itemsUrl = buyType === "product"
      ? `/api/checkout/items/by-product?items=${itemIds.join(",")}`
      : `/api/checkout/items?items=${itemIds.join(",")}`;
 
    const fetches = [
      fetch(itemsUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ];
 
    // donation mode ไม่ต้องโหลด address list (ใช้ของโรงเรียน)
    if (!isDonation) {
      fetches.push(
        fetch("/api/checkout/addresses", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      );
    }
 
    Promise.all(fetches)
      .then(([its, addrs]) => {
        setItems(Array.isArray(its) ? its : []);
        if (!isDonation) {
          const addrList = Array.isArray(addrs) ? addrs : [];
          setAddresses(addrList);
          const def = addrList.find(a => a.is_default) || addrList[0];
          if (def) setSelAddress(def.address_id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);
 
  // ── Address CRUD (ซื้อทั่วไปเท่านั้น) ────────────────
  const saveAddress = useCallback(async (form) => {
    const isEdit = !!editAddr;
    const url    = isEdit ? `/api/checkout/addresses/${editAddr.address_id}` : "/api/checkout/addresses";
    const method = isEdit ? "PUT" : "POST";
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    const fresh = await fetch("/api/checkout/addresses", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    setAddresses(fresh);
    setSelAddress(data.address_id);
    setEditAddr(null);
  }, [token, editAddr]);
 
  const deleteAddr = async (id) => {
    await fetch(`/api/checkout/addresses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const fresh = await fetch("/api/checkout/addresses", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    setAddresses(fresh);
    if (selAddress === id) setSelAddress(fresh[0]?.address_id || null);
  };
 
  // ── ยืนยันคำสั่งซื้อ — API จริง ────────────────────────
  const handlePlaceOrder = async () => {
    setPlacing(true); setErr("");
    try {
      const body = {
        order_type: isDonation ? "donation" : "purchase",
        request_id: isDonation ? projectId  : null,
      };
 
      if (buyType === "product") {
        body.product_ids = itemIds;
      } else {
        body.items = itemIds;
      }
 
      if (isDonation) {
        body.donation_address = donationAddress;
      } else {
        body.address_id = selAddress;
      }
 
      const res  = await fetch("/api/checkout/orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
 
      navigate("/market", {
        state: {
          successMsg: isDonation
            ? "ซื้อเพื่อส่งต่อสำเร็จ! โรงเรียนจะได้รับแจ้ง 🎉"
            : "สั่งซื้อสำเร็จ! 🎉",
        },
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setPlacing(false);
    }
  };
 
  // ── ตรวจ step 1 valid ─────────────────────────────────
  const step1Valid = isDonation ? true : !!selAddress;
 
  // ── คำนวณยอด ──────────────────────────────────────────
  const subtotal      = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const shippingTotal = items.reduce((s, i) => s + Number(i.shipping_price || 0), 0);
  const total         = subtotal + shippingTotal;
  const selectedAddr  = addresses.find(a => a.address_id === selAddress);
  const steps         = ["ที่อยู่จัดส่ง", "การจัดส่ง", "ยืนยันคำสั่งซื้อ"];
 
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
 
      {/* Donation banner */}
      {isDonation && (
        <div className="coDonationBanner">
          <Icon icon="mdi:gift-outline" />
          <span>โหมดซื้อเพื่อส่งต่อ — สินค้าจะถูกจัดส่งตรงให้โรงเรียน</span>
        </div>
      )}
 
      <div className="coContainer">
        {/* Steps */}
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
 
              {/* ── Step 1: ที่อยู่จัดส่ง ── */}
              {step === 1 && (
                <div className="coSection">
                  <div className="coSectionHead">
                    <h2><Icon icon="mdi:map-marker-outline" /> ที่อยู่จัดส่ง</h2>
                    {/* donation mode ไม่มีปุ่มเพิ่มที่อยู่ */}
                    {!isDonation && (
                      <button className="coAddBtn" onClick={() => { setEditAddr(null); setShowModal(true); }}>
                        <Icon icon="mdi:plus" /> เพิ่มที่อยู่
                      </button>
                    )}
                  </div>
 
                  {/* donation → แสดงที่อยู่โรงเรียน / ปกติ → เลือก address */}
                  {isDonation ? (
                    <DonationAddressBlock
                      shippingAddress={donationAddress}
                      projectTitle={projectTitle}
                    />
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
                            <div className="coAddrText">
                              {a.address_line} {a.district} {a.province} {a.postcode}
                            </div>
                          </div>
                          <div className="coAddrBtns">
                            <button className="coAddrBtn" title="แก้ไข"
                              onClick={e => { e.stopPropagation(); setEditAddr(a); setShowModal(true); }}>
                              <Icon icon="mdi:pencil-outline" />
                            </button>
                            <button className="coAddrBtn coAddrBtnDel" title="ลบ"
                              onClick={e => { e.stopPropagation(); deleteAddr(a.address_id); }}>
                              <Icon icon="mdi:trash-can-outline" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
 
                  <div className="coNavBtns">
                    {isDonation
                      ? <button className="coBtnOutline" onClick={() => navigate(-1)}>
                          <Icon icon="mdi:arrow-left" /> ย้อนกลับ
                        </button>
                      : <Link to="/cart" className="coBtnOutline">
                          <Icon icon="mdi:arrow-left" /> ย้อนกลับ
                        </Link>
                    }
                    <button className="coBtnPrimary" disabled={!step1Valid} onClick={() => setStep(2)}>
                      ถัดไป <Icon icon="mdi:arrow-right" />
                    </button>
                  </div>
                </div>
              )}
 
              {/* ── Step 2: การจัดส่ง ── */}
              {step === 2 && (
                <div className="coSection">
                  <h2><Icon icon="mdi:truck-outline" /> การจัดส่ง</h2>
                  <div className="coSellerList">
                    {groups.map(g => (
                      <SellerShippingBlock key={g.seller_id} group={g} />
                    ))}
                  </div>
                  <div className="coNavBtns">
                    <button className="coBtnOutline" onClick={() => setStep(1)}>
                      <Icon icon="mdi:arrow-left" /> ย้อนกลับ
                    </button>
                    <button className="coBtnPrimary" onClick={() => setStep(3)}>
                      ถัดไป <Icon icon="mdi:arrow-right" />
                    </button>
                  </div>
                </div>
              )}
 
              {/* ── Step 3: ยืนยันคำสั่งซื้อ ── */}
              {step === 3 && (
                <div className="coSection">
                  <h2><Icon icon="mdi:clipboard-check-outline" /> ยืนยันคำสั่งซื้อ</h2>
 
                  {/* ที่อยู่จัดส่ง */}
                  {isDonation ? (
                    <div className="coConfirmBlock">
                      <div className="coConfirmIcon"><Icon icon="mdi:school-outline" /></div>
                      <div className="coConfirmContent">
                        <div className="coConfirmLabelText">จัดส่งให้โรงเรียน</div>
                        <div className="coConfirmVal">
                          <b>{donationAddress?.name}</b>
                          {donationAddress?.phone && ` · ${donationAddress.phone}`}<br />
                          {[donationAddress?.address, donationAddress?.district,
                            donationAddress?.province, donationAddress?.postal_code]
                            .filter(Boolean).join(" ")}
                        </div>
                      </div>
                    </div>
                  ) : selectedAddr && (
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
                  )}
 
                  {/* รายการสินค้า */}
                  {groups.map(g => {
                    const sub      = g.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
                    const shipSub  = g.items.reduce((s, i) => s + Number(i.shipping_price || 0), 0);
                    return (
                      <div key={g.seller_id} className="coConfirmSeller">
                        <div className="coConfirmSellerHead">
                          <div className="coSellerAvatarSm">{g.seller_name[0].toUpperCase()}</div>
                          <span className="coSellerNameSm">{g.seller_name}</span>
                          <button className="coEditLink" onClick={() => setStep(2)}>เปลี่ยน</button>
                        </div>
                        {g.items.map(item => {
                          const cat   = getCategoryLabel(item.category_id, item.gender);
                          const type  = item.type_name?.trim();
                          const title = type ? `${cat}: ${type}` : cat;
                          const size  = getSizeText(item.size, item.category_id);
                          return (
                            <div key={item.cart_item_id} className="coConfirmItem">
                              <div className="coConfirmItemImg">
                                {item.cover_image
                                  ? <img src={item.cover_image} alt={title} />
                                  : <Icon icon="mdi:tshirt-crew" />}
                              </div>
                              <div className="coConfirmItemInfo">
                                <div className="coConfirmItemTitle">{title}</div>
                                {item.school_name && <div className="coConfirmItemMeta">{item.school_name}</div>}
                                {size && <div className="coConfirmItemMeta">ขนาด: {size}</div>}
                                <div className="coConfirmItemMeta">จำนวน: {item.quantity} ชิ้น</div>
                                {item.shipping_name && (
                                  <div className="coConfirmItemMeta">
                                    <Icon icon="mdi:truck-outline" /> {item.shipping_name}
                                    · ค่าขนส่ง {Number(item.shipping_price || 0).toLocaleString()} บาท
                                  </div>
                                )}
                              </div>
                              <div className="coConfirmItemPrice">
                                {(Number(item.price) * item.quantity).toLocaleString()} บาท
                              </div>
                            </div>
                          );
                        })}
                        <div className="coConfirmSellerFoot">
                          ยอดสินค้า {sub.toLocaleString()} บาท
                          {shipSub > 0 && ` + ค่าขนส่ง ${shipSub.toLocaleString()} บาท`}
                        </div>
                      </div>
                    );
                  })}
 
                  {/* donation note */}
                  {isDonation && (
                    <div className="coDonationNote">
                      <Icon icon="mdi:information-outline" />
                      เมื่อโรงเรียนยืนยันรับสินค้าแล้ว คุณจะได้รับใบเกียรติบัตรทางอีเมล
                    </div>
                  )}
 
                  {err && <div className="coErr"><Icon icon="mdi:alert-circle" /> {err}</div>}
 
                  <div className="coNavBtns">
                    <button className="coBtnOutline" onClick={() => setStep(2)}>
                      <Icon icon="mdi:arrow-left" /> ย้อนกลับ
                    </button>
                    <button
                      className={isDonation ? "coBtnGreen" : "coBtnYellow"}
                      disabled={placing}
                      onClick={handlePlaceOrder}
                    >
                      {placing
                        ? <Icon icon="mdi:loading" className="coSpinner" />
                        : <Icon icon={isDonation ? "mdi:gift-outline" : "mdi:credit-card-outline"} />}
                      {isDonation ? "ยืนยันการส่งต่อ" : "ยืนยันคำสั่งซื้อ"}
                    </button>
                  </div>
                </div>
              )}
            </div>
 
            {/* ── Summary sidebar ── */}
            <div className="coRight">
              <div className="coSummaryCard">
                {isDonation && (
                  <div className="coSummaryDonationTag">
                    <Icon icon="mdi:gift-outline" /> ซื้อเพื่อส่งต่อ
                  </div>
                )}
                <div className="coSummaryTitle">สรุปคำสั่งซื้อ</div>
                {groups.map(g => {
                  const sub = g.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
                  return (
                    <div key={g.seller_id} className="coSummaryGroup">
                      <div className="coSummaryGroupName">
                        <Icon icon="mdi:store-outline" /> {g.seller_name}
                      </div>
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
                        <span>
                          {g.items.reduce((s, i) => s + Number(i.shipping_price || 0), 0).toLocaleString()} บาท
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="coSummaryDivider" />
                <div className="coSummaryRow">
                  <span>ยอดสินค้า</span>
                  <span>{subtotal.toLocaleString()} บาท</span>
                </div>
                <div className="coSummaryRow">
                  <span>ค่าจัดส่งรวม</span>
                  <span>{shippingTotal.toLocaleString()} บาท</span>
                </div>
                <div className="coSummaryDivider" />
                <div className="coSummaryTotal">
                  <span>ยอดรวมทั้งหมด</span>
                  <span className="coTotalPrice">{total.toLocaleString()} บาท</span>
                </div>
 
                {/* จัดส่งให้โรงเรียน (summary) */}
                {isDonation && donationAddress && (
                  <>
                    <div className="coSummaryDivider" />
                    <div className="coSummaryDonationAddr">
                      <Icon icon="mdi:school-outline" />
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{donationAddress.name}</div>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                          {[donationAddress.province, donationAddress.postal_code].filter(Boolean).join(" ")}
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