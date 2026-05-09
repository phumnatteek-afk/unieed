import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { request } from "../../../api/http.js";
import { NotSellerView } from "../layouts/SellerLayout.jsx";
import "../../market/styles/PostProductPage.css";

const fmtBaht = (n) => "฿" + Number(n || 0).toLocaleString();

const STATUS_PILL = {
  available: { label: "วางขาย", cls: "slStatusPill--available" },
  sold:      { label: "ขายแล้ว", cls: "slStatusPill--sold" },
  hidden:    { label: "ปิดการขาย", cls: "" },
};

// Tabs (category placeholder — wire ตาม category_id ของระบบจริง)
const CATEGORY_TABS = [
  { id: "", category: "", gender: "", label: "ทั้งหมด" },
  { id: "shirt_m", category: "1", gender: "male", label: "เสื้อนักเรียนชาย" },
  { id: "shirt_f", category: "1", gender: "female", label: "เสื้อนักเรียนหญิง" },
  { id: "pants", category: "2", gender: "", label: "กางเกงนักเรียน" },
  { id: "skirt", category: "3", gender: "female", label: "กระโปรงนักเรียน" },
];

function parseSize(size) {
  if (!size) return null;
  if (typeof size === "object") return size;
  try {
    return JSON.parse(size);
  } catch {
    return null;
  }
}

function getSizeText(size, categoryId) {
  const parsed = parseSize(size);
  if (!parsed) return size || "-";

  const cid = Number(categoryId);
  const parts = [];
  if (cid === 1) {
    if (parsed.chest && parsed.chest !== "0") parts.push(`อก ${parsed.chest}`);
    if (parsed.length && parsed.length !== "0") parts.push(`ยาว ${parsed.length}`);
  } else {
    if (parsed.waist && parsed.waist !== "0") parts.push(`เอว ${parsed.waist}`);
    if (parsed.length && parsed.length !== "0") parts.push(`ยาว ${parsed.length}`);
  }
  return parts.join(" / ") || "-";
}

const SIZE_LABELS = { chest: "อก", waist: "เอว", length: "ยาว" };

const MAIN_CATEGORIES = [
  { key: "shirt_m", category_id: 1, gender: "male", label: "เสื้อ (ชาย)", icon: "mdi:tshirt-crew", sizeKeys: ["chest", "length"] },
  { key: "shirt_f", category_id: 1, gender: "female", label: "เสื้อ (หญิง)", icon: "mdi:tshirt-crew-outline", sizeKeys: ["chest", "length"] },
  { key: "pants_m", category_id: 2, gender: "male", label: "กางเกง", icon: "mdi:hanger", sizeKeys: ["waist", "length"] },
  { key: "skirt_f", category_id: 3, gender: "female", label: "กระโปรง", icon: "mdi:skirt", sizeKeys: ["waist", "length"] },
  { key: "other", category_id: 4, gender: null, label: "อื่นๆ", icon: "mdi:dots-horizontal-circle-outline", sizeKeys: ["chest"] },
];

const LEVELS = ["ทุกระดับชั้น", "อนุบาล", "ประถมศึกษา", "มัธยมต้น", "มัธยมปลาย"];
const CONDITION_PERCENTS = ["10", "20", "30", "40", "50", "60", "70", "80", "90", "100"];
const CONDITION_LABELS = ["มีตำหนิ", "พอใช้ได้", "สภาพดี", "สภาพดีมาก", "ใหม่มาก"];
const MAX_PRODUCT_IMAGES = 4;

function getSizeKeysForCategory(catId, gender) {
  return MAIN_CATEGORIES.find(
    c => c.category_id === Number(catId) && (c.gender === gender || c.gender === null)
  )?.sizeKeys || ["chest"];
}

export default function SellerProductsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const selectedTab = CATEGORY_TABS.find(c => c.id === tab) || CATEGORY_TABS[0];
      const qs = new URLSearchParams({
        page: String(page), limit: "10", sort,
        ...(selectedTab.category ? { category: selectedTab.category } : {}),
        ...(selectedTab.gender ? { gender: selectedTab.gender } : {}),
        ...(status ? { status } : {}),
        ...(q      ? { q } : {}),
      });
      const d = await request(`/seller/products?${qs.toString()}`);
      setData(d);
    } catch (e) { setErr(e?.data?.message || e.message); }
    finally { setLoading(false); }
  }, [tab, q, status, sort, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (productId) => {
    if (!window.confirm("ยืนยันการลบสินค้านี้?")) return;
    try {
      await request(`/api/market/${productId}`, { method: "DELETE" });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
      fetchData();
    } catch (e) {
      window.alert(e?.data?.message || e.message || "ลบสินค้าไม่สำเร็จ");
    }
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleAll = () => {
    const allIds = (data?.rows || []).map(p => p.product_id);
    setSelectedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
  };
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = [...selectedIds];
    for (const id of ids) {
      await request(`/api/market/${id}`, { method: "DELETE" }).catch(() => {});
    }
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    setBulkDeleting(false);
    fetchData();
  };

  const handleSaveEdit = async (payload) => {
    try {
      const { product_id: pid, remove_image_ids, newImageFiles, ...body } = payload;
      const hasRemove = Array.isArray(remove_image_ids) && remove_image_ids.length > 0;
      const hasNew = Array.isArray(newImageFiles) && newImageFiles.length > 0;
      if (hasRemove || hasNew) {
        const fd = new FormData();
        fd.append("patch", JSON.stringify({ ...body, remove_image_ids: remove_image_ids || [] }));
        for (const file of newImageFiles || []) fd.append("images", file);
        await request(`/api/market/${pid}`, { method: "PATCH", body: fd });
      } else {
        await request(`/api/market/${pid}`, { method: "PATCH", body });
      }
      setEditingProduct(null);
      fetchData();
    } catch (e) {
      window.alert(e?.data?.message || e.message || "แก้ไขสินค้าไม่สำเร็จ");
    }
  };

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div className="slBreadcrumb">จัดการร้านค้า</div>
          <h1 className="slPageTitle" style={{ marginBottom:0 }}>รายการสินค้า</h1>
        </div>
        <Link to="/sell" className="slBtnPrimary slBtn"><Icon icon="mdi:plus" /> เพิ่มสินค้า</Link>
      </div>

      {!data?.is_seller && !loading
        ? <NotSellerView message={data?.message} />
        : (
          <>
            {/* Stat cards */}
            <div className="slProdGrid">
              <StatCard label="สินค้าทั้งหมด" value={data?.counts?.total || 0} cls="slProdValue--blue" icon="mdi:package-variant-closed" iconBg="#eff6ff" iconColor="#3b82f6" />
              <StatCard label="วางขายอยู่"     value={data?.counts?.available || 0} cls="slProdValue--amber" icon="mdi:storefront-outline" iconBg="#fffbeb" iconColor="#f59e0b" />
              <StatCard label="ปิดการขาย"      value={(data?.counts?.total || 0) - (data?.counts?.available || 0)} cls="slProdValue--green" icon="mdi:eye-off-outline" iconBg="#f0fdf4" iconColor="#22c55e" />
            </div>

            <div className="slCard">
              {/* Toolbar */}
              <div className="slToolbar">
                <div className="slSearch">
                  <Icon icon="mdi:magnify" className="slSearch__icon" />
                  <input placeholder="ค้นหาสินค้าทั้งหมด" value={q}
                         onChange={e => { setQ(e.target.value); setPage(1); }} />
                </div>
                <select className="slSelect" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                  <option value="">ทุกสถานะ</option>
                  <option value="available">วางขาย</option>
                  <option value="sold">ขายแล้ว</option>
                  <option value="hidden">ปิดการขาย</option>
                </select>
                <select className="slSelect" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="latest">ล่าสุด</option>
                  <option value="oldest">เก่าสุด</option>
                </select>
              </div>

              {/* Tabs */}
              <div className="slTabs">
                {CATEGORY_TABS.map(c => (
                  <div key={c.id}
                       className={`slTab ${tab === c.id ? "active" : ""}`}
                       onClick={() => { setTab(c.id); setPage(1); setSelectedIds(new Set()); }}>
                    {c.label}
                  </div>
                ))}
              </div>

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  padding: "10px 14px", marginBottom: 4,
                  background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 14,
                }}>
                  <Icon icon="mdi:checkbox-marked-circle-outline" style={{ color: "#3b82f6", fontSize: 18, flexShrink: 0 }} />
                  <span style={{ color: "#1e40af" }}>เลือกแล้ว <strong>{selectedIds.size}</strong> รายการ</span>
                  <button
                    style={{
                      marginLeft: "auto", padding: "7px 18px", borderRadius: 8, border: "none",
                      background: "#ef4444", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Icon icon="mdi:trash-can-outline" /> ลบที่เลือก ({selectedIds.size})
                  </button>
                  <button
                    style={{
                      padding: "7px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
                      background: "#fff", cursor: "pointer", fontSize: 13, color: "#475569",
                    }}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    ยกเลิก
                  </button>
                </div>
              )}

              {loading && (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icon icon="mdi:loading" style={{ animation: "spin 1s linear infinite" }} /> กำลังโหลด...
                </div>
              )}
              {err && (
                <div style={{ color: "#b91c1c", padding: "10px 14px", background: "#fef2f2", borderRadius: 8, margin: "8px 0", fontSize: 13 }}>
                  <Icon icon="mdi:alert-circle-outline" style={{ marginRight: 6 }} />{err}
                </div>
              )}

              {!loading && data?.rows?.length === 0 && (
                <div style={{ padding: 50, textAlign: "center", color: "#94a3b8" }}>
                  <Icon icon="mdi:package-variant-remove" style={{ fontSize: 48, display: "block", margin: "0 auto 10px" }} />
                  ไม่มีสินค้าในหมวดนี้
                </div>
              )}

              {!loading && data?.rows?.length > 0 && (
                <table className="slTable">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          style={{ cursor: "pointer", accentColor: "#3b82f6", width: 15, height: 15 }}
                          checked={data.rows.length > 0 && selectedIds.size === data.rows.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th>สินค้า</th>
                      <th>ราคา</th>
                      <th>ไซส์</th>
                      <th>จำนวน</th>
                      <th>วันที่</th>
                      <th>สถานะ</th>
                      <th style={{ textAlign: "center" }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(p => {
                      const pill = STATUS_PILL[p.status] || { label: p.status, cls: "" };
                      const date = new Date(p.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
                      const isSelected = selectedIds.has(p.product_id);
                      return (
                        <tr key={p.product_id}
                            style={{ background: isSelected ? "#eff6ff" : undefined, transition: "background 0.15s" }}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(p.product_id)}
                              style={{ cursor: "pointer", accentColor: "#3b82f6", width: 15, height: 15 }}
                            />
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              {p.cover_image
                                ? <img src={p.cover_image} alt="" className="slTableThumb" style={{ objectFit: "cover", borderRadius: 6 }} />
                                : <div className="slTableThumb" style={{ background: "#f1f5f9", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Icon icon="mdi:hanger" style={{ color: "#cbd5e1", fontSize: 18 }} />
                                  </div>}
                              <span style={{ fontWeight: 500, color: "#0f172a", fontSize: 13 }}>{p.product_title}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, color: "#3b82f6" }}>{fmtBaht(p.price)}</td>
                          <td style={{ color: "#475569", fontSize: 13 }}>{getSizeText(p.size, p.category_id)}</td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{
                              display: "inline-block", minWidth: 28, textAlign: "center",
                              background: p.quantity === 0 ? "#fee2e2" : "#f1f5f9",
                              color: p.quantity === 0 ? "#b91c1c" : "#374151",
                              borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 600,
                            }}>{p.quantity}</span>
                          </td>
                          <td style={{ color: "#64748b", fontSize: 12 }}>{date}</td>
                          <td>
                            <span className={`slStatusPill ${pill.cls}`}>{pill.label}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                              <button className="slBtn" title="ดู" style={{ padding: "6px 10px" }} onClick={() => setSelectedProduct(p)}>
                                <Icon icon="mdi:eye-outline" />
                              </button>
                              <button className="slBtn" title="แก้ไข" style={{ padding: "6px 10px" }} onClick={() => setEditingProduct(p)}>
                                <Icon icon="mdi:pencil-outline" />
                              </button>
                              <button className="slBtn" title="ลบ" style={{ padding: "6px 10px", color: "#ef4444" }} onClick={() => handleDelete(p.product_id)}>
                                <Icon icon="mdi:trash-can-outline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Pagination */}
              {data?.total_pages > 1 && (
                <div className="slPaging">
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    หน้า {page} / {data.total_pages} (ทั้งหมด {data.counts.total} รายการ)
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="slBtn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <Icon icon="mdi:chevron-left" />
                    </button>
                    <select
                      className="slSelect"
                      value={page}
                      onChange={e => setPage(Number(e.target.value))}
                      style={{ padding: "4px 10px", fontSize: 13 }}
                    >
                      {Array.from({ length: data.total_pages }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                    <button className="slBtn" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>
                      <Icon icon="mdi:chevron-right" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )
      }

      {/* Bulk delete confirmation popup */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{
            background: "#fff", borderRadius: 18, padding: "36px 40px", maxWidth: 420, width: "90%",
            boxShadow: "0 20px 60px rgba(15,23,42,0.20)", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: 19 }}>ยืนยันการลบสินค้า</h3>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 26px", lineHeight: 1.7 }}>
              คุณต้องการลบสินค้า{" "}
              <strong style={{ color: "#ef4444", fontSize: 16 }}>{selectedIds.size}</strong>{" "}
              รายการที่เลือกใช่หรือไม่?<br />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>การกระทำนี้ไม่สามารถย้อนกลับได้</span>
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                style={{ padding: "11px 30px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkDeleting}
              >
                ยกเลิก
              </button>
              <button
                style={{ padding: "11px 30px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6, opacity: bulkDeleting ? 0.7 : 1 }}
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting
                  ? <><Icon icon="mdi:loading" style={{ animation: "spin 1s linear infinite" }} /> กำลังลบ...</>
                  : <><Icon icon="mdi:trash-can-outline" /> ยืนยันลบทั้งหมด</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={handleSaveEdit} />
    </>
  );
}

function ProductDetailModal({ product, onClose }) {
  if (!product) return null;
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{product.product_title}</h3>
        <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <div>ราคา: {fmtBaht(product.price)}</div>
          <div>จำนวน: {product.quantity}</div>
          <div>ไซส์: {getSizeText(product.size, product.category_id)}</div>
          <div>สถานะ: {(STATUS_PILL[product.status] || {}).label || product.status}</div>
          <div>สินค้า ID: {product.product_id}</div>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <a href={`/market/${product.product_id}`} className="slBtn" target="_blank" rel="noreferrer">ดูหน้าสินค้าเต็ม</a>
          <button className="slBtnPrimary slBtn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

function EditProductModal({ product, onClose, onSave }) {
  const [detail, setDetail] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [uniformTypes, setUniformTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const imageInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setTypesLoading(true);
    request("/api/market/uniform-types", { auth: false })
      .then((rows) => {
        if (!cancelled) setUniformTypes(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setUniformTypes([]);
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!product?.product_id) return;
    let cancelled = false;
    setDetail(null);
    setLoadErr("");
    setForm(null);
    setRemovedImageIds([]);
    setNewImages((prev) => {
      prev.forEach((x) => x.previewUrl && URL.revokeObjectURL(x.previewUrl));
      return [];
    });
    request(`/api/market/${product.product_id}`, { auth: false })
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e?.data?.message || e.message || "โหลดไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [product?.product_id]);

  useEffect(() => {
    if (!detail) return;
    const parsed = parseSize(detail.size);
    const cid = Number(detail.category_id) || 1;
    const genderInit =
      cid === 4
        ? null
        : detail.gender === "male" || detail.gender === "female"
          ? detail.gender
          : "male";
    const utId = detail.uniform_type_id != null ? Number(detail.uniform_type_id) : null;
    setForm({
      product_id: detail.product_id,
      product_title: detail.product_title || "",
      product_description: detail.product_description || "",
      price: detail.price ?? "",
      quantity: detail.quantity ?? 1,
      status: detail.status || "available",
      category_id: cid,
      gender: genderInit,
      uniform_type_id: Number.isFinite(utId) ? utId : null,
      custom_type_name: detail.custom_type_name || "",
      school_name: detail.school_name || "",
      level: detail.level || "",
      sizes: { chest: parsed?.chest || "", waist: parsed?.waist || "", length: parsed?.length || "" },
      condition: String(detail.condition_percent ?? "80"),
      conditionLabel: detail.condition_label || "สภาพดี",
    });
  }, [detail]);

  const filteredTypes = useMemo(() => {
    if (!form) return [];
    const filtered = uniformTypes.filter(
      (t) =>
        t.category_id === Number(form.category_id) &&
        (form.gender === null || form.gender === undefined || t.gender === form.gender || !t.gender)
    );
    const uniqueMap = new Map();
    filtered.forEach((t) => {
      const key = String(t.type_name || "").trim();
      if (!key) return;
      if (!uniqueMap.has(key)) uniqueMap.set(key, t);
    });
    return Array.from(uniqueMap.values()).sort((a, b) =>
      String(a.type_name).localeCompare(String(b.type_name), "th")
    );
  }, [uniformTypes, form?.category_id, form?.gender]);

  const handleCategoryChange = (catId, genderVal) => {
    setForm((f) =>
      f
        ? {
            ...f,
            category_id: catId,
            gender: genderVal,
            uniform_type_id: null,
            custom_type_name: "",
          }
        : f
    );
  };

  const save = () => {
    if (!form?.product_id) return;
    const cid = Number(form.category_id);
    if (!form.uniform_type_id && !String(form.custom_type_name || "").trim()) {
      window.alert("กรุณาเลือกหรือกรอกประเภทชุด");
      return;
    }
    if (form.price === "" || Number.isNaN(Number(form.price))) {
      window.alert("กรุณากรอกราคา");
      return;
    }
    const title = String(form.product_title || "").trim();
    if (!title) {
      window.alert("กรุณากรอกชื่อสินค้า");
      return;
    }

    const sizeObj = {};
    if (cid === 1) {
      if (form.sizes.chest) sizeObj.chest = form.sizes.chest;
      if (form.sizes.length) sizeObj.length = form.sizes.length;
    } else if (cid === 4) {
      if (form.sizes.chest) sizeObj.chest = form.sizes.chest;
    } else {
      if (form.sizes.waist) sizeObj.waist = form.sizes.waist;
      if (form.sizes.length) sizeObj.length = form.sizes.length;
    }

    const imgs = detail?.images || [];
    const keptExisting = imgs.filter((im) => !removedImageIds.includes(Number(im.image_id)));
    const totalPhotos = keptExisting.length + newImages.length;
    if (totalPhotos < 1) {
      window.alert("ต้องมีรูปสินค้าอย่างน้อย 1 รูป");
      return;
    }

    onSave({
      product_id: form.product_id,
      remove_image_ids: removedImageIds,
      newImageFiles: newImages.map((n) => n.file),
      product_title: title,
      product_description: String(form.product_description || "").trim(),
      price: Number(form.price),
      quantity: parseInt(form.quantity, 10) || 0,
      status: form.status,
      size: sizeObj,
      category_id: cid,
      gender: cid === 4 ? null : form.gender,
      uniform_type_id: form.uniform_type_id || null,
      custom_type_name: form.uniform_type_id ? null : String(form.custom_type_name || "").trim() || null,
      school_name: String(form.school_name || "").trim() || null,
      level: form.level || "",
      condition_percent: parseInt(form.condition, 10) || 80,
      condition_label: form.conditionLabel || "",
    });
  };

  if (!product) return null;

  const modalBoxStyle = {
    ...modalStyle,
    maxWidth: 640,
    maxHeight: "90vh",
    overflowY: "auto",
    padding: "18px 20px",
  };

  if (loadErr) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
          <p style={{ color: "#b91c1c", marginTop: 0 }}>{loadErr}</p>
          <button type="button" className="slBtnPrimary slBtn" style={{ marginTop: 12 }} onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
          <p style={{ margin: 0 }}>กำลังโหลดข้อมูลสินค้า...</p>
        </div>
      </div>
    );
  }

  const sizeKeys = getSizeKeysForCategory(form.category_id, form.gender);

  const existingImages = detail?.images || [];
  const visibleExisting = existingImages.filter(
    (im) => !removedImageIds.includes(Number(im.image_id))
  );
  const visibleCount = visibleExisting.length + newImages.length;

  const markRemoveImage = (imageId) => {
    const id = Number(imageId);
    const imgs = detail?.images || [];
    const nextRemoved = [...removedImageIds, id];
    const kept = imgs.filter((im) => !nextRemoved.includes(Number(im.image_id))).length;
    if (kept + newImages.length < 1) {
      window.alert("ต้องมีรูปสินค้าอย่างน้อย 1 รูป");
      return;
    }
    setRemovedImageIds(nextRemoved);
  };

  const pickImages = (filesList) => {
    const files = Array.from(filesList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const imgs = detail?.images || [];
    const kept = imgs.filter((im) => !removedImageIds.includes(Number(im.image_id))).length;
    const room = MAX_PRODUCT_IMAGES - kept - newImages.length;
    if (room <= 0) return;
    const take = files.slice(0, room);
    setNewImages((prev) => [
      ...prev,
      ...take.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removeNewImageAt = (idx) => {
    setNewImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalBoxStyle} className="editProductModal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>แก้ไขสินค้า</h3>

        <div className="ppSection">
          <div className="ppSectionHeader">
            <span className="ppSectionDot ppDotBlue" />
            <span className="ppSectionTitle">รูปภาพสินค้า</span>
            <span className="ppImgCount">
              {visibleCount}/{MAX_PRODUCT_IMAGES}
            </span>
            <span className="ppOptionalBadge">ภาพแรก = ภาพปก</span>
          </div>
          <div className="ppImgRow">
            {visibleExisting.map((im, idx) => (
              <div key={im.image_id} className={`ppImgSlot ${idx === 0 ? "ppImgCover" : ""}`}>
                <img src={im.image_url} alt="" className="ppImgPreview" />
                {idx === 0 && <span className="ppCoverBadge">ปก</span>}
                <button
                  type="button"
                  className="ppImgRemove"
                  aria-label="ลบรูป"
                  onClick={() => markRemoveImage(im.image_id)}
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
            ))}
            {newImages.map((ni, idx) => (
              <div
                key={ni.previewUrl}
                className={`ppImgSlot ${visibleExisting.length === 0 && idx === 0 ? "ppImgCover" : ""}`}
              >
                <img src={ni.previewUrl} alt="" className="ppImgPreview" />
                {visibleExisting.length === 0 && idx === 0 && <span className="ppCoverBadge">ปก</span>}
                <button
                  type="button"
                  className="ppImgRemove"
                  aria-label="ยกเลิกรูปใหม่"
                  onClick={() => removeNewImageAt(idx)}
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
            ))}
            {visibleCount < MAX_PRODUCT_IMAGES && (
              <button
                type="button"
                className="ppImgAddSlot"
                onClick={() => imageInputRef.current?.click()}
              >
                <Icon icon="mdi:plus" />
              </button>
            )}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              pickImages(e.target.files);
              e.target.value = "";
            }}
          />
          <small className="ppDropHint">JPG / PNG / WEBP ไม่เกิน 5MB ต่อรูป · สูงสุด {MAX_PRODUCT_IMAGES} รูป</small>
        </div>

        <div className="ppSection">
          <div className="ppSectionHeader">
            <span className="ppSectionDot ppDotPurple" />
            <span className="ppSectionTitle">ประเภทชุด</span>
          </div>
          <div className="ppFieldBlock">
            <label className="ppFieldLabel">
              <Icon icon="mdi:shape-outline" /> หมวดหมู่
            </label>
            <div className="ppCatTabs">
              {MAIN_CATEGORIES.map((cat) => {
                const isActive = Number(form.category_id) === cat.category_id && form.gender === cat.gender;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    className={`ppCatTab ${isActive ? "ppCatTabActive" : ""}`}
                    onClick={() => handleCategoryChange(cat.category_id, cat.gender)}
                  >
                    <Icon icon={cat.icon} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ppFieldBlock">
            <label className="ppFieldLabel">
              <Icon icon="mdi:format-list-bulleted" /> เลือกจากระบบ
            </label>
            {typesLoading ? (
              <p className="ppLoadingHint">กำลังโหลดประเภทชุด...</p>
            ) : (
              <div className="ppSelectWrap">
                <select
                  className="ppSelect"
                  value={form.uniform_type_id || ""}
                  onChange={(e) => {
                    const selId = e.target.value ? Number(e.target.value) : null;
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            uniform_type_id: selId,
                            custom_type_name: selId ? "" : f.custom_type_name,
                          }
                        : f
                    );
                  }}
                >
                  <option value="">— เลือกประเภทชุดที่มีในระบบ —</option>
                  {filteredTypes.length === 0 && <option disabled>ไม่มีประเภทชุดในหมวดนี้</option>}
                  {filteredTypes.map((t) => (
                    <option key={t.uniform_type_id} value={t.uniform_type_id}>
                      {t.type_name}
                      {t.gender === "male" ? " (ชาย)" : t.gender === "female" ? " (หญิง)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="ppOrDivider">
              <span />หรือกรอกชื่อประเภทเอง<span />
            </div>
            <input
              className="ppInput"
              placeholder="เช่น คอฮาวาย, ชุดพละ..."
              value={form.custom_type_name || ""}
              disabled={!!form.uniform_type_id}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, custom_type_name: e.target.value, uniform_type_id: null } : f
                )
              }
            />
            {!!form.uniform_type_id && (
              <p className="ppHint">ล้างตัวเลือกด้านบนก่อนถึงจะกรอกเองได้</p>
            )}
          </div>
        </div>

        <div className="ppSection">
          <div className="ppSectionHeader">
            <span className="ppSectionDot ppDotGreen" />
            <span className="ppSectionTitle">ระดับชั้นและขนาด</span>
          </div>
          <div className="ppFieldBlock">
            <label className="ppFieldLabel">
              <Icon icon="mdi:school-outline" /> ระดับชั้น
            </label>
            <div className="ppChipGroup">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`ppChip ${form.level === l ? "ppChipActive ppChipBlue" : ""}`}
                  onClick={() =>
                    setForm((f) => (f ? { ...f, level: f.level === l ? "" : l } : f))
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="ppFieldBlock">
            <label className="ppFieldLabel">
              <Icon icon="mdi:ruler" /> ไซส์ (นิ้ว)
            </label>
            <div className="ppSizesRow">
              {sizeKeys.map((key) => (
                <div key={key} className="ppSizeBox">
                  <span className="ppSizeLabel">{SIZE_LABELS[key]}</span>
                  <input
                    className="ppSizeInput"
                    type="number"
                    value={form.sizes[key] || ""}
                    placeholder="—"
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, sizes: { ...f.sizes, [key]: e.target.value } } : f
                      )
                    }
                  />
                  <span className="ppSizeUnit">นิ้ว</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ppSection">
          <div className="ppSectionHeader">
            <span className="ppSectionDot ppDotOrange" />
            <span className="ppSectionTitle">สภาพและราคา</span>
          </div>
          <div className="ppFieldRow2">
            <div className="ppFieldBlock">
              <label className="ppFieldLabel">
                <Icon icon="mdi:percent-outline" /> สภาพสินค้า (%)
              </label>
              <div className="ppSelectWrap">
                <select
                  className="ppSelect"
                  value={form.condition}
                  onChange={(e) => setForm((f) => (f ? { ...f, condition: e.target.value } : f))}
                >
                  {CONDITION_PERCENTS.map((c) => (
                    <option key={c} value={c}>
                      {c}%
                    </option>
                  ))}
                </select>
              </div>
              <div className="ppChipGroup ppChipGroupSm" style={{ marginTop: 6 }}>
                {CONDITION_LABELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`ppChip ppChipSm ${form.conditionLabel === c ? "ppChipActive ppChipBlue" : ""}`}
                    onClick={() => setForm((f) => (f ? { ...f, conditionLabel: c } : f))}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="ppFieldRow2" style={{ marginTop: 10 }}>
            <div className="ppFieldBlock">
              <label className="ppFieldLabel">
                <Icon icon="mdi:currency-usd" /> ราคา <span className="ppReq">*</span>
              </label>
              <div className="ppPriceWrap">
                <input
                  className="ppInput ppPriceInput"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => (f ? { ...f, price: e.target.value } : f))}
                />
                <span className="ppUnit">บาท</span>
              </div>
            </div>
            <div className="ppFieldBlock">
              <label className="ppFieldLabel">
                <Icon icon="mdi:package-variant-closed" /> จำนวน
              </label>
              <input
                className="ppInput"
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm((f) => (f ? { ...f, quantity: e.target.value } : f))}
              />
            </div>
          </div>
          <div className="ppFieldBlock" style={{ marginTop: 10 }}>
            <label className="ppFieldLabel">สถานะการขาย</label>
            <select
              className="slSelect"
              style={{ width: "100%", maxWidth: 280 }}
              value={form.status}
              onChange={(e) => setForm((f) => (f ? { ...f, status: e.target.value } : f))}
            >
              <option value="available">วางขาย</option>
              <option value="hidden">ปิดการขาย</option>
              <option value="sold">ขายแล้ว</option>
            </select>
          </div>
        </div>

        <div className="ppSection ppSectionOptional">
          <div className="ppSectionHeader">
            <span className="ppSectionDot ppDotGray" />
            <span className="ppSectionTitle">ชื่อเรียกและรายละเอียด</span>
          </div>
          <div className="ppFieldBlock">
            <label className="ppFieldLabel">ชื่อสินค้า</label>
            <input
              className="ppInput"
              value={form.product_title}
              onChange={(e) => setForm((f) => (f ? { ...f, product_title: e.target.value } : f))}
              placeholder="ชื่อที่แสดงในร้าน"
            />
          </div>
          <div className="ppFieldRow2">
            <div className="ppFieldBlock">
              <label className="ppFieldLabel">โรงเรียน</label>
              <input
                className="ppInput"
                type="text"
                placeholder="ระบุชื่อโรงเรียน..."
                value={form.school_name}
                onChange={(e) => setForm((f) => (f ? { ...f, school_name: e.target.value } : f))}
              />
            </div>
            <div className="ppFieldBlock">
              <label className="ppFieldLabel">หมายเหตุ / คำอธิบาย</label>
              <textarea
                className="ppTextarea"
                rows={2}
                placeholder="อธิบายเพิ่มเติม..."
                value={form.product_description}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, product_description: e.target.value } : f))
                }
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="slBtn" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" className="slBtnPrimary slBtn" onClick={save}>
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(2,6,23,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
};

const modalStyle = {
  width: "100%", maxWidth: 520, background: "#fff", borderRadius: 14, padding: 18,
  boxShadow: "0 12px 40px rgba(15,23,42,0.22)",
};

function StatCard({ label, value, cls, icon, iconBg, iconColor }) {
  return (
    <div className="slCard slProdCard" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="slIncomeCard__label" style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
        {icon && (
          <div style={{ width: 34, height: 34, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon icon={icon} style={{ fontSize: 18, color: iconColor }} />
          </div>
        )}
      </div>
      <div className={`slProdValue ${cls}`} style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div className="slStatSubtle" style={{ fontSize: 12, color: "#94a3b8" }}>รายการ</div>
    </div>
  );
}
