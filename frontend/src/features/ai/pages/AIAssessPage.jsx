// AIAssessPage.jsx — redesigned with Unieed warm theme + @iconify/react
import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import Navbar from "../../../pages/Navbar.jsx";
import { analyzeUniform, matchProjects, fileToBase64 } from "../services/ai.service.js";
import "../styles/AIAssess.css";

// ── constants ─────────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: "อัปโหลดรูป" },
  { num: 2, label: "วิเคราะห์" },
  { num: 3, label: "ผลการวิเคราะห์" },
  { num: 4, label: "เลือกโครงการ" },
];

const HISTORY_KEY = "ai_assess_history";

const TIPS = [
  { icon: "ph:sun",         title: "แสงสว่างเพียงพอ",    sub: "ถ่ายในที่มีแสงธรรมชาติหรือไฟสว่าง ชัดเจนไม่มีเงา",           color: "teal" },
  { icon: "ph:t-shirt",     title: "วางชุดให้แบน",       sub: "กางชุดบนพื้นหรือแขวนบนไม้แขวน ไม่พับหรือยับ",              color: "teal" },
  { icon: "ph:frame-corners", title: "ถ่ายทั้งตัวชุด",  sub: "ให้เห็นชุดทั้งผืน รวมถึงขอบและปลายแขน/ขา",                color: "teal" },
  { icon: "ph:stack",       title: "แยกรูปทีละชุด",      sub: "1 ภาพต่อ 1 ชุด เพื่อให้ AI วิเคราะห์ได้แม่นยำที่สุด",     color: "amber" },
];

const MEAS_FIELDS = [
  { key: "chest",  label: "รอบอก",     icon: "ph:arrows-horizontal" },
  { key: "waist",  label: "รอบเอว",    icon: "ph:arrows-horizontal" },
  { key: "hip",    label: "รอบสะโพก",  icon: "ph:arrows-horizontal" },
  { key: "length", label: "ความยาว",   icon: "ph:arrows-vertical"   },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function condStyle(cond) {
  if (cond === "ดีมาก") return { bg: "var(--teal-light)",  color: "var(--teal)"  };
  if (cond === "ดี")    return { bg: "#e8f5e9",            color: "#2e7d32"      };
  if (cond === "พอใช้") return { bg: "var(--amber-light)", color: "var(--amber)" };
  return                       { bg: "var(--red-light)",   color: "var(--red)"   };
}

function scoreColorClass(s) {
  if (s >= 75) return "";    // teal (default)
  if (s >= 50) return "mid";
  return "low";
}

function deltaClass(diff) {
  if (diff === 0)  return "ok";
  if (diff <= 2)   return "near";
  return "bad";
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30))); }
  catch {}
}

// ── Donation eligibility helper ───────────────────────────────────────────────
function donateStatus(uniform) {
  const c = uniform?.condition;
  if (c === "ดีมาก") return { ok: true,  label: "บริจาคได้เลย",         icon: "ph:check-circle",   cls: "ok"     };
  if (c === "ดี")    return { ok: true,  label: "บริจาคได้",            icon: "ph:check-circle",   cls: "ok"     };
  if (c === "พอใช้") return { ok: true,  label: "บริจาคได้ (สภาพพอใช้)", icon: "ph:check-circle",   cls: "fair"   };
  if (c === "ต้องซ่อม") return { ok: false, label: "ควรซ่อมก่อนบริจาค",   icon: "ph:wrench",          cls: "repair" };
  return { ok: false, label: "ไม่ทราบสภาพ", icon: "ph:question", cls: "repair" };
}

// ── component ─────────────────────────────────────────────────────────────────
export default function AIAssessPage() {
  const navigate = useNavigate();

  // flow state
  const [step, setStep]                   = useState(1);
  const [activeUniform, setActiveUniform] = useState(0);
  const [activeTab, setActiveTab]         = useState("list");

  // upload state
  const [images, setImages]   = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef            = useRef(null);
  const mobileCapRef            = useRef(null); // <input capture="environment">

  // camera (live webcam) state
  const [camOpen,    setCamOpen]    = useState(false);
  const [camStream,  setCamStream]  = useState(null);
  const [camError,   setCamError]   = useState("");
  const [camCount,   setCamCount]   = useState(0); // photos taken this session
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // analysis state
  const [uniforms, setUniforms]                     = useState([]);
  const [editedMeasurements, setEditedMeasurements] = useState({});
  const [analyzeErr, setAnalyzeErr]                 = useState("");
  const [matchData, setMatchData]                   = useState(null);

  // history state
  const [history, setHistory]       = useState(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  // ── drag / drop ────────────────────────────────────────────────────────────
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true);  }, []);
  const onDragLeave = useCallback(()  => setDragOver(false), []);
  const onDrop      = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")));
  }, []);

  // ── camera ────────────────────────────────────────────────────────────────
  async function openLiveCamera() {
    setCamError("");
    setCamCount(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Fallback: mobile-style capture input
      mobileCapRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCamStream(stream);
      setCamOpen(true);
    } catch {
      // Fallback to file picker with capture hint
      mobileCapRef.current?.click();
    }
  }

  function closeLiveCamera() {
    camStream?.getTracks().forEach(t => t.stop());
    setCamStream(null);
    setCamOpen(false);
    setCamError("");
  }

  function capturePhoto() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
      addFiles([file]);
      setCamCount(c => c + 1);
    }, "image/jpeg", 0.92);
  }

  // Assign stream to video element when it opens
  useEffect(() => {
    if (camOpen && camStream && videoRef.current) {
      videoRef.current.srcObject = camStream;
      videoRef.current.play().catch(() => {});
    }
  }, [camOpen, camStream]);

  // Cleanup camera on unmount
  useEffect(() => () => camStream?.getTracks().forEach(t => t.stop()), [camStream]);

  // ── files ──────────────────────────────────────────────────────────────────
  async function addFiles(files) {
    const newImgs = await Promise.all(
      files.map(async (file) => {
        const preview = URL.createObjectURL(file);
        const { base64, mimeType } = await fileToBase64(file);
        return { file, preview, base64, mimeType };
      })
    );
    setImages(prev => [...prev, ...newImgs]);
  }

  function removeImage(idx) {
    setImages(prev => prev.filter((_, i) => i !== idx));
  }

  // ── analyze ────────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!images.length) return;
    setStep(2);
    setAnalyzeErr("");
    setUniforms([]);
    setMatchData(null);
    setEditedMeasurements({});

    try {
      const results = await Promise.all(
        images.map(async (img, i) => {
          const res = await analyzeUniform(img.base64, img.mimeType);
          return { ...res, _preview: img.preview, _imgIdx: i };
        })
      );
      setUniforms(results);

      // Seed editable measurements from AI output
      const initEdited = {};
      results.forEach((u, i) => { initEdited[i] = { ...u.measurements }; });
      setEditedMeasurements(initEdited);

      const matchRes = await matchProjects(results);
      setMatchData(matchRes);

      setActiveUniform(0);
      setStep(3);
    } catch (err) {
      setAnalyzeErr(err?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setStep(1);
    }
  }

  function updateMeasurement(uniformIdx, field, value) {
    setEditedMeasurements(prev => ({
      ...prev,
      [uniformIdx]: { ...prev[uniformIdx], [field]: value },
    }));
  }

  function getEffectiveMeasurements(idx) {
    return editedMeasurements[idx] || uniforms[idx]?.measurements || {};
  }

  // ── go to project ──────────────────────────────────────────────────────────
  function goToProject(requestId, matchInfo) {
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      uniforms: uniforms.map(u => ({
        uniform_type: u.uniform_type,
        condition:    u.condition,
        measurements: u.measurements,
        _preview:     u._preview,
      })),
      matchedProjectId: requestId,
      matchedTitle:     matchInfo?.request_title || "",
      matchedSchool:    matchInfo?.school_name   || "",
      status: "pending",
    };
    const h = [entry, ...history];
    setHistory(h);
    saveHistory(h);

    navigate(`/projects/${requestId}`, {
      state: { aiMatch: { uniforms, matchInfo, auto_select: true } },
    });
  }

  function markDonated(id) {
    const h = history.map(e => e.id === id ? { ...e, status: "donated" } : e);
    setHistory(h);
    saveHistory(h);
  }

  // ── step bar state helper ──────────────────────────────────────────────────
  function stepState(n) {
    if (step === 2) {
      if (n === 1) return "done";
      if (n === 2) return "active";
      return "";
    }
    if (n < step)  return "done";
    if (n === step) return "active";
    return "";
  }

  const currentUniform = uniforms[activeUniform];

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="aiPage">
      <Navbar activeLink="projects" />

      {/* ── sticky step bar ─────────────────────────────────────────────────── */}
      <div className="aiStepBar">
        {STEPS.map((s, i) => (
          <div key={s.num} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div className={`aiStepItem ${stepState(s.num)}`}>
              <div className="aiStepNum">
                {stepState(s.num) === "done"
                  ? <Icon icon="ph:check-bold" width={10} />
                  : s.num}
              </div>
              <span className="aiStepLabel">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <Icon icon="ph:caret-right" className="aiStepArrow" />
            )}
          </div>
        ))}
      </div>

      <div className="aiContainer">

        {/* page header */}
        <div className="aiPageHeader">
          <h1>AI ประเมินชุดนักเรียน</h1>
          <p>ถ่ายรูปชุดนักเรียนของคุณ — AI จะวิเคราะห์สภาพ วัดขนาด และแนะนำโครงการบริจาคที่ตรงที่สุด</p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — Upload                                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            <div className="aiGrid2">
              {/* ── left col: upload + batch ─────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="aiCard">
                  <div className="aiSectionLabel">อัปโหลดรูปชุดนักเรียน</div>

                  <div
                    className={`aiUploadZone ${dragOver ? "dragOver" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                  >
                    <div className="aiUploadIcon">
                      <Icon icon="ph:camera-plus" width={26} />
                    </div>
                    <h3>คลิกหรือลากไฟล์มาวางที่นี่</h3>
                    <p>รองรับ JPG, PNG, WEBP — อัปโหลดได้หลายภาพ</p>
                    <span className="aiUploadHint">1 รูป = 1 ชุดนักเรียน</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={e => addFiles(Array.from(e.target.files))}
                  />
                  {/* mobile camera capture fallback */}
                  <input
                    ref={mobileCapRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    style={{ display: "none" }}
                    onChange={e => addFiles(Array.from(e.target.files))}
                  />

                  {/* camera / upload action buttons */}
                  <div className="aiUploadActions">
                    <button className="aiUploadActionBtn cam" onClick={openLiveCamera}>
                      <Icon icon="ph:camera" width={18} />
                      เปิดกล้อง
                    </button>
                    <div className="aiUploadActionDiv">หรือ</div>
                    <button className="aiUploadActionBtn file" onClick={() => fileInputRef.current?.click()}>
                      <Icon icon="ph:folder-open" width={18} />
                      เลือกไฟล์
                    </button>
                  </div>

                  {analyzeErr && (
                    <div className="aiError" style={{ marginTop: 12 }}>
                      <Icon icon="ph:warning-circle" width={16} />
                      {analyzeErr}
                    </div>
                  )}
                </div>

                {/* batch grid — shown once images are added */}
                {images.length > 0 && (
                  <div className="aiCard">
                    <div className="aiSectionLabel">
                      รูปที่เลือก · {images.length} ชุด
                    </div>

                    <div className="aiBatchGrid">
                      {images.map((img, i) => (
                        <div key={i} className="aiBatchItem">
                          <div className="aiBatchThumb">
                            <img src={img.preview} alt={`ชุดที่ ${i + 1}`} />
                          </div>
                          <div className="aiBatchInfo">
                            <div className="aiBatchName">ชุดที่ {i + 1}</div>
                            <div className="aiBatchMeas">
                              <span className="aiMeasChip">
                                <span className="ml">{img.file.type.split("/")[1]?.toUpperCase()}</span>
                                <span className="mv">{formatFileSize(img.file.size)}</span>
                              </span>
                            </div>
                          </div>
                          <button
                            className="aiBatchRemove"
                            onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                          >
                            <Icon icon="ph:x" width={11} />
                          </button>
                        </div>
                      ))}

                      {/* add more button */}
                      <button
                        className="aiBatchAdd"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Icon icon="ph:plus-circle" width={24} />
                        <span>เพิ่มรูป</span>
                      </button>
                    </div>

                    <div className="aiFooterRow">
                      <button
                        className="aiBtn secondary"
                        onClick={() => setImages([])}
                      >
                        <Icon icon="ph:trash" width={15} />
                        ล้างทั้งหมด
                      </button>
                      <button
                        className="aiBtn primary lg"
                        onClick={handleAnalyze}
                      >
                        <Icon icon="ph:sparkle" width={17} />
                        วิเคราะห์ด้วย AI · {images.length} ชุด
                      </button>
                    </div>
                  </div>
                )}

                {/* disabled analyze button when no images */}
                {images.length === 0 && (
                  <button className="aiBtn primary lg" disabled style={{ opacity: 0.35, cursor: "not-allowed" }}>
                    <Icon icon="ph:sparkle" width={17} />
                    เลือกรูปก่อนวิเคราะห์
                  </button>
                )}
              </div>

              {/* ── right col: tips ──────────────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="aiCard">
                  <div className="aiSectionLabel">เคล็ดลับถ่ายรูปให้ได้ผลดี</div>
                  {TIPS.map((tip, i) => (
                    <div key={i} className="aiTipRow">
                      <div className={`aiTipNum ${tip.color === "amber" ? "amber" : ""}`}>
                        <Icon icon={tip.icon} width={14} />
                      </div>
                      <div>
                        <div className="aiTipTitle">{tip.title}</div>
                        <div className="aiTipSub">{tip.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="aiNotice teal">
                  <Icon icon="ph:info" width={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    AI จะประเมินประเภทชุด ระดับการศึกษา สภาพ และขนาดโดยประมาณ
                    คุณแก้ไขขนาดได้ในขั้นตอนถัดไปก่อนดูผลการจับคู่
                  </span>
                </div>
              </div>
            </div>

            {/* ── history ─────────────────────────────────────────────────── */}
            {history.length > 0 && (
              <div className="aiCard" style={{ marginTop: 20 }}>
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                  onClick={() => setShowHistory(h => !h)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon icon="ph:clock-counter-clockwise" width={16} style={{ color: "var(--ink-muted)" }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>ประวัติการประเมิน</span>
                    <span className="aiTag teal">{history.length}</span>
                  </div>
                  <Icon icon={showHistory ? "ph:caret-up" : "ph:caret-down"} width={15} style={{ color: "var(--ink-muted)" }} />
                </div>

                {showHistory && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {history.map((entry) => (
                      <div key={entry.id} className="aiHistoryItem">

                        {/* all uniform thumbnails in a row */}
                        <div className="aiHistoryThumbs">
                          {entry.uniforms?.length > 0
                            ? entry.uniforms.map((u, ti) => (
                                <div key={ti} className="aiHistoryThumb">
                                  {u._preview
                                    ? <img src={u._preview} alt={u.uniform_type} />
                                    : <Icon icon="ph:t-shirt" width={16} style={{ color: "var(--ink-muted)" }} />}
                                </div>
                              ))
                            : (
                              <div className="aiHistoryThumb">
                                <Icon icon="ph:t-shirt" width={16} style={{ color: "var(--ink-muted)" }} />
                              </div>
                            )}
                        </div>

                        <div className="aiHistoryBody">
                          <div className="aiHistoryType">
                            {entry.uniforms?.map(u => u.uniform_type).filter(Boolean).join(", ") || "ชุดนักเรียน"}
                          </div>
                          <div className="aiHistoryMeta">
                            {entry.matchedSchool && (
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <Icon icon="ph:map-pin" width={11} />
                                {entry.matchedSchool}
                              </span>
                            )}
                            <span>
                              {new Date(entry.date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          {/* show all matched uniform types */}
                          {entry.uniforms?.length > 1 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                              {entry.uniforms.map((u, ti) => (
                                <span key={ti} className="aiTag teal" style={{ fontSize: 10 }}>
                                  <Icon icon="ph:t-shirt" width={9} />
                                  {u.uniform_type}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                          <span className={`aiHistoryStatus ${entry.status === "donated" ? "donated" : "pending"}`}>
                            {entry.status === "donated"
                              ? <><Icon icon="ph:check-circle" width={11} />บริจาคแล้ว</>
                              : "รอบริจาค"}
                          </span>
                          {entry.matchedProjectId && (
                            <button
                              className="aiBtn secondary"
                              style={{ fontSize: 11, padding: "4px 10px" }}
                              onClick={() => navigate(`/projects/${entry.matchedProjectId}`)}
                            >
                              <Icon icon="ph:arrow-right" width={12} />
                              ไปโครงการ
                            </button>
                          )}
                          {entry.status !== "donated" && (
                            <button
                              className="aiBtn primary"
                              style={{ fontSize: 11, padding: "4px 10px" }}
                              onClick={() => markDonated(entry.id)}
                            >
                              <Icon icon="ph:heart" width={12} />
                              บริจาค
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2 — Analyzing                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="aiCard">
            <div className="aiAnalyzing">
              <div className="aiSpinner" />
              <div className="aiAnalyzingText">กำลังวิเคราะห์ด้วย AI…</div>
              <div className="aiAnalyzingSub">
                GPT-4o กำลังตรวจสอบสภาพและขนาดชุด · {images.length} ชุด
              </div>
              <div className="aiNotice amber" style={{ marginTop: 8, maxWidth: 360 }}>
                <Icon icon="ph:clock" width={14} style={{ flexShrink: 0 }} />
                <span>อาจใช้เวลา 10–30 วินาที กรุณาอย่าปิดหน้าต่างนี้</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3 — Analysis results + editable measurements                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 3 && uniforms.length > 0 && (
          <>
            {/* uniform tab selector (multi-image only) */}
            {uniforms.length > 1 && (
              <div className="aiUniformTabs">
                {uniforms.map((u, i) => {
                  const meas = u.measurements || {};
                  const hasSize = meas.chest || meas.waist;
                  return (
                    <button
                      key={i}
                      className={`aiUniformTab ${i === activeUniform ? "active" : ""} ${!hasSize ? "warn" : ""}`}
                      onClick={() => setActiveUniform(i)}
                    >
                      <Icon icon="ph:t-shirt" width={13} style={{ marginRight: 4 }} />
                      ชุดที่ {i + 1} · {u.uniform_type}
                    </button>
                  );
                })}
              </div>
            )}

            {currentUniform && (
              <div className="aiAnalyzeLayout">

                {/* ── left: preview ──────────────────────────────────────── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="aiPreviewBox">
                    <div className="aiPreviewImg">
                      <img src={currentUniform._preview} alt="ชุดนักเรียน" />
                    </div>
                    <div className="aiPreviewMeta">
                      <div className="fn">ชุดที่ {activeUniform + 1}</div>
                      <div className="fs">{currentUniform.uniform_type}</div>
                    </div>
                  </div>

                  {/* badges */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(() => {
                      const { bg, color } = condStyle(currentUniform.condition);
                      return (
                        <span style={{ background: bg, color, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Icon icon="ph:star-four" width={13} />
                          สภาพ: {currentUniform.condition}
                        </span>
                      );
                    })()}
                    {currentUniform.level && currentUniform.level !== "ไม่ทราบ" && (
                      <span className="aiTag blue" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Icon icon="ph:graduation-cap" width={11} />
                        {currentUniform.level}
                      </span>
                    )}
                    {currentUniform.color && (
                      <span className="aiTag amber" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Icon icon="ph:palette" width={11} />
                        {currentUniform.color}
                      </span>
                    )}
                  </div>

                  {/* donation eligibility badge */}
                  {(() => {
                    const ds = donateStatus(currentUniform);
                    return (
                      <div className={`aiDonateStatus ${ds.cls}`}>
                        <Icon icon={ds.icon} width={16} />
                        {ds.label}
                      </div>
                    );
                  })()}

                  {currentUniform.notes && (
                    <div className="aiNotice amber">
                      <Icon icon="ph:note-pencil" width={14} style={{ flexShrink: 0 }} />
                      <span>{currentUniform.notes}</span>
                    </div>
                  )}
                </div>

                {/* ── right: AI results ──────────────────────────────────── */}
                <div>
                  <div className="aiAIBadge">
                    <Icon icon="ph:robot" width={13} />
                    ผลการวิเคราะห์โดย AI
                  </div>

                  {/* result rows with confidence bars */}
                  <div className="aiCard" style={{ marginBottom: 16 }}>
                    {[
                      { label: "ประเภทชุด", value: currentUniform.uniform_type,              conf: currentUniform.confidence?.uniform_type },
                      { label: "ระดับชั้น", value: currentUniform.level || "ไม่ทราบ",        conf: null },
                      { label: "สภาพชุด",   value: currentUniform.condition,                 conf: null },
                    ].map((row) => (
                      <div key={row.label} className="aiResultRow">
                        <span className="aiResultLabel">{row.label}</span>
                        <span className="aiResultValue">{row.value}</span>
                        {row.conf != null && (
                          <>
                            <div className="aiConfBar">
                              <div className="aiConfFill" style={{ width: `${row.conf}%` }} />
                            </div>
                            <span className="aiConfText">{row.conf}%</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* big measurement numbers */}
                  <div className="aiSectionLabel">ขนาดที่ AI วัดได้</div>
                  <div className="aiMeasResultBox">
                    {MEAS_FIELDS.map((m, i) => {
                      const val  = currentUniform.measurements?.[m.key];
                      const conf = currentUniform.confidence?.[m.key] || 0;
                      return (
                        <div key={m.key} style={{ display: "contents" }}>
                          {i > 0 && <div className="aiMeasDivider" />}
                          <div className="aiMeasStat">
                            <div className={`val ${!val ? "unknown" : ""}`}>
                              {val ? <>{val}<span>"</span></> : "—"}
                            </div>
                            <div className="lbl">{m.label}</div>
                            {val && (
                              <div className="aiProgressTrack" style={{ width: 36, margin: "4px auto 0" }}>
                                <div className="aiProgressFill" style={{ width: `${conf}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* editable measurement inputs */}
                  <div className="aiMeasInputGroup">
                    <div className="aiMeasInputTitle">
                      <Icon icon="ph:pencil-simple" width={13} />
                      ปรับขนาดเอง (ถ้า AI วัดไม่ถูกต้อง)
                    </div>
                    <div className="aiMeasFields">
                      {MEAS_FIELDS.map((m) => {
                        const val    = editedMeasurements[activeUniform]?.[m.key];
                        const hasVal = val !== null && val !== "" && val !== undefined;
                        return (
                          <div key={m.key} className="aiMeasField">
                            <label>{m.label}</label>
                            <div className="aiMeasFieldRow">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="—"
                                value={hasVal ? val : ""}
                                className={hasVal ? "hasVal" : ""}
                                onChange={e =>
                                  updateMeasurement(
                                    activeUniform,
                                    m.key,
                                    e.target.value ? parseFloat(e.target.value) : null
                                  )
                                }
                              />
                              <span className="unit">นิ้ว</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* footer navigation */}
                  <div className="aiFooterRow">
                    <button
                      className="aiBtn secondary"
                      onClick={() => { setStep(1); setImages([]); setUniforms([]); setMatchData(null); }}
                    >
                      <Icon icon="ph:arrow-left" width={15} />
                      อัปโหลดใหม่
                    </button>
                    <button
                      className="aiBtn primary"
                      onClick={() => setStep(4)}
                    >
                      ดูโครงการที่แนะนำ
                      <Icon icon="ph:arrow-right" width={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 4 — Match results                                            */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 4 && matchData && (
          <>
            {/* summary bar */}
            <div className="aiSummaryBar">
              <div className="aiSummaryItem">
                <div className="val">{uniforms.length}</div>
                <div className="lbl">ชุดที่วิเคราะห์</div>
              </div>
              <div className="aiSummaryDiv" />
              <div className="aiSummaryItem">
                <div className="val teal">
                  {matchData.matchResults?.filter(r => r.matches?.length > 0).length || 0}
                </div>
                <div className="lbl">ชุดที่แมชได้</div>
              </div>
              <div className="aiSummaryDiv" />
              <div className="aiSummaryItem">
                <div className="val teal">{matchData.projects?.length || 0}</div>
                <div className="lbl">โครงการที่พบ</div>
              </div>
              {matchData.bundles?.length > 0 && (
                <>
                  <div className="aiSummaryDiv" />
                  <div className="aiSummaryItem">
                    <div className="val teal">{matchData.bundles[0].avg_score}%</div>
                    <div className="lbl">คะแนนสูงสุด</div>
                    <div className="aiProgressTrack" style={{ width: 64 }}>
                      <div className="aiProgressFill" style={{ width: `${matchData.bundles[0].avg_score}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* tab switcher (multi-uniform only) */}
            {uniforms.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[
                  { id: "list",   icon: "ph:list",         label: "รายการ" },
                  { id: "bundle", icon: "ph:package",      label: "บริจาครวม" },
                  { id: "matrix", icon: "ph:table",        label: "Matrix" },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`aiModeBtn ${activeTab === t.id ? "active" : ""}`}
                    style={{ border: "1px solid var(--border-med)", borderRadius: 8 }}
                    onClick={() => setActiveTab(t.id)}
                  >
                    <Icon icon={t.icon} width={15} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── list view ──────────────────────────────────────────────── */}
            {(activeTab === "list" || uniforms.length === 1) && (
              <div className="aiMatchLayout">
                {/* match cards */}
                <div>
                  {matchData.matchResults?.map((ur, ui) => (
                    <div key={ui}>
                      {uniforms.length > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px", fontSize: 13, fontWeight: 600 }}>
                          <Icon icon="ph:t-shirt" width={15} style={{ color: "var(--teal)" }} />
                          ชุดที่ {ui + 1} · {uniforms[ui]?.uniform_type}
                        </div>
                      )}

                      {ur.matches?.length === 0 ? (
                        <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--ink-muted)", fontSize: 13, background: "var(--warm-white)", borderRadius: "var(--radius)", border: "1px dashed var(--border-med)", marginBottom: 10 }}>
                          <Icon icon="ph:magnifying-glass" width={22} style={{ display: "block", margin: "0 auto 8px", opacity: 0.4 }} />
                          ไม่พบโครงการที่ตรงกับชุดนี้
                        </div>
                      ) : (
                        ur.matches?.map((m, mi) => {
                          const uMeas     = getEffectiveMeasurements(ui);
                          const needChest = m.best_need?.chest;
                          const needWaist = m.best_need?.waist;
                          const dChest    = (needChest && uMeas.chest)  ? Math.abs(parseFloat(uMeas.chest)  - parseFloat(needChest))  : null;
                          const dWaist    = (needWaist && uMeas.waist)  ? Math.abs(parseFloat(uMeas.waist)  - parseFloat(needWaist))  : null;

                          return (
                            <div
                              key={m.request_id}
                              className={`aiMatchCard ${mi === 0 ? "top" : ""}`}
                              onClick={() => goToProject(m.request_id, m)}
                            >
                              <div>
                                <div className="aiMatchSchool">{m.school_name}</div>
                                <div className="aiMatchDetail">
                                  {m.request_title}
                                  {m.school_province && ` · ${m.school_province}`}
                                </div>

                                {/* measurement comparison chips */}
                                {(dChest !== null || dWaist !== null) && (
                                  <div className="aiMeasMatchRow">
                                    {dChest !== null && (
                                      <>
                                        <div className={`aiMeasMatchChip ${deltaClass(dChest)}`}>
                                          <span className="ml">อก (คุณ)</span>
                                          <span className="mv">{uMeas.chest}"</span>
                                        </div>
                                        <Icon icon="ph:arrow-right" width={11} className="aiMatchArrow" />
                                        <div className={`aiMeasMatchChip ${deltaClass(dChest)}`}>
                                          <span className="ml">อก (ต้องการ)</span>
                                          <span className="mv">{needChest}"</span>
                                        </div>
                                        <span className={`aiDelta ${deltaClass(dChest)}`}>
                                          {dChest === 0 ? "พอดี" : `±${dChest}"`}
                                        </span>
                                      </>
                                    )}
                                    {dWaist !== null && (
                                      <>
                                        <div className={`aiMeasMatchChip ${deltaClass(dWaist)}`}>
                                          <span className="ml">เอว (คุณ)</span>
                                          <span className="mv">{uMeas.waist}"</span>
                                        </div>
                                        <Icon icon="ph:arrow-right" width={11} className="aiMatchArrow" />
                                        <div className={`aiMeasMatchChip ${deltaClass(dWaist)}`}>
                                          <span className="ml">เอว (ต้องการ)</span>
                                          <span className="mv">{needWaist}"</span>
                                        </div>
                                        <span className={`aiDelta ${deltaClass(dWaist)}`}>
                                          {dWaist === 0 ? "พอดี" : `±${dWaist}"`}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* tags row */}
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                                  {mi === 0 && (
                                    <span className="aiTag teal" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                      <Icon icon="ph:star" width={10} />
                                      แมชดีที่สุด
                                    </span>
                                  )}
                                  <span className="aiTag blue" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    <Icon icon="ph:users-three" width={10} />
                                    ต้องการ {m.total_still_needed || 0} ตัว
                                  </span>
                                  {m.end_date && (
                                    <span className="aiTag amber" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                      <Icon icon="ph:calendar" width={10} />
                                      ปิด {new Date(m.end_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* score */}
                              <div className={`aiMatchScore ${scoreColorClass(m.match_score)}`}>
                                {m.match_score}
                                <span>คะแนน</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>

                {/* right info panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="aiCard">
                    <div className="aiSectionLabel">วิธีใช้ผลการแมช</div>
                    {[
                      { icon: "ph:chart-bar",       text: "คะแนนสูง = ขนาดใกล้เคียงกับที่โรงเรียนต้องการ" },
                      { icon: "ph:cursor-click",    text: "กดที่การ์ดเพื่อไปหน้าโครงการและกรอกบริจาค"      },
                      { icon: "ph:pencil-simple",   text: "แก้ไขขนาดที่ขั้นตอน 3 ถ้าต้องการผลแม่นยำกว่า"  },
                    ].map((tip, i) => (
                      <div key={i} className="aiTipRow" style={{ marginBottom: i < 2 ? 10 : 0 }}>
                        <div className="aiTipNum">
                          <Icon icon={tip.icon} width={13} />
                        </div>
                        <div className="aiTipSub" style={{ fontSize: 12 }}>{tip.text}</div>
                      </div>
                    ))}
                  </div>

                  <div className="aiNotice teal">
                    <Icon icon="ph:info" width={14} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12 }}>
                      ระบบแสดงสูงสุด 10 โครงการที่ตรงที่สุดสำหรับแต่ละชุด
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── bundle view ─────────────────────────────────────────────── */}
            {activeTab === "bundle" && uniforms.length > 1 && (
              <div>
                {matchData.bundles?.length === 0 ? (
                  <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--ink-muted)", fontSize: 13, background: "var(--warm-white)", borderRadius: "var(--radius)", border: "1px dashed var(--border-med)" }}>
                    <Icon icon="ph:package" width={28} style={{ display: "block", margin: "0 auto 10px", opacity: 0.35 }} />
                    ไม่พบโครงการที่รองรับชุดของคุณ
                  </div>
                ) : (
                  matchData.bundles?.map((bundle, bi) => (
                    <div key={bundle.request_id} className={`aiMatchCard ${bi === 0 ? "top" : ""}`} style={{ marginBottom: 12, alignItems: "flex-start" }}>
                      <div>
                        <div className="aiMatchSchool">{bundle.school_name}</div>
                        <div className="aiMatchDetail">{bundle.request_title}</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" }}>
                          {bundle.uniforms?.map((u, j) => (
                            <span key={j} className="aiTag teal" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Icon icon="ph:t-shirt" width={10} />
                              ชุดที่ {u.uniform_index + 1} · {u.score}%
                            </span>
                          ))}
                          {bi === 0 && (
                            <span className="aiTag teal" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Icon icon="ph:star" width={10} />
                              แนะนำที่สุด
                            </span>
                          )}
                        </div>
                        <button className="aiBtn primary" onClick={() => goToProject(bundle.request_id, bundle)}>
                          <Icon icon="ph:arrow-right" width={14} />
                          บริจาคที่โครงการนี้
                        </button>
                      </div>
                      <div className="aiMatchScore">{bundle.avg_score}<span>คะแนน</span></div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── matrix view ─────────────────────────────────────────────── */}
            {activeTab === "matrix" && uniforms.length > 1 && matchData.matrix && (
              <div className="aiCard" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--ink-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>
                        ชุด
                      </th>
                      {matchData.projects?.map(p => (
                        <th key={p.request_id} style={{ padding: "8px 12px", textAlign: "center", color: "var(--ink-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                          {p.school_name?.slice(0, 10)}{p.school_name?.length > 10 ? "…" : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matchData.matrix?.map((row, ri) => (
                      <tr key={ri}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontWeight: 500, whiteSpace: "nowrap" }}>
                          ชุดที่ {row.uniform_index + 1}
                          <div style={{ fontSize: 10, color: "var(--ink-muted)", fontWeight: 400 }}>
                            {uniforms[row.uniform_index]?.uniform_type}
                          </div>
                        </td>
                        {matchData.projects?.map(p => {
                          const cell = row.cells?.[p.request_id];
                          if (!cell) return (
                            <td key={p.request_id} style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>—</td>
                          );
                          const cls   = scoreColorClass(cell.score);
                          const bg    = cls === ""    ? "var(--teal-light)"  : cls === "mid" ? "var(--blue-light)"  : "var(--cream)";
                          const color = cls === ""    ? "var(--teal)"        : cls === "mid" ? "var(--blue)"        : "var(--ink-muted)";
                          return (
                            <td key={p.request_id} style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid var(--border)" }}>
                              <span style={{ background: bg, color, fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 6, display: "inline-block", border: cell.is_best ? `1.5px solid ${color}` : "none" }}>
                                {cell.score}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* footer nav */}
            <div className="aiFooterRow">
              <button className="aiBtn secondary" onClick={() => setStep(3)}>
                <Icon icon="ph:arrow-left" width={15} />
                กลับไปผลวิเคราะห์
              </button>
              <button className="aiBtn secondary" onClick={() => { setStep(1); setImages([]); setUniforms([]); setMatchData(null); }}>
                <Icon icon="ph:arrow-counter-clockwise" width={15} />
                ประเมินชุดใหม่
              </button>
            </div>
          </>
        )}

      </div>

      {/* ── live camera modal ───────────────────────────────────────────────── */}
      {camOpen && (
        <div className="aiCameraModal" onClick={closeLiveCamera}>
          <div className="aiCameraInner" onClick={e => e.stopPropagation()}>
            <div className="aiCameraHeader">
              <span>
                <Icon icon="ph:camera" width={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                ถ่ายรูปชุดนักเรียน
              </span>
              <button className="aiCameraClose" onClick={closeLiveCamera}>
                <Icon icon="ph:x" width={18} />
              </button>
            </div>

            <div className="aiCameraViewport">
              <video ref={videoRef} className="aiCameraVideo" autoPlay playsInline muted />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              {camError && (
                <div className="aiCameraError">
                  <Icon icon="ph:warning-circle" width={16} />
                  {camError}
                </div>
              )}
            </div>

            <div className="aiCameraControls">
              <div className="aiCamCountBadge">
                <Icon icon="ph:images" width={14} />
                ถ่ายไปแล้ว {camCount} รูป
              </div>
              <button className="aiCaptureBtn" onClick={capturePhoto}>
                <Icon icon="ph:camera-slash" width={0} />
                <span className="aiCaptureDot" />
              </button>
              <button className="aiCameraFinish" onClick={closeLiveCamera}>
                <Icon icon="ph:check" width={15} />
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
