// ai.service.js — GPT-4o-mini (GitHub Models) uniform analysis + project matching
import OpenAI from "openai";
import { db } from "../../config/db.js";

function getClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set in environment variables");
  return new OpenAI({
    baseURL: "https://models.inference.ai.azure.com",
    apiKey:  token,
  });
}

// ── Standard Thai school uniform sizes (inches) ──────────────────────────────
const CHEST_SIZES  = [20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52];
const WAIST_SIZES  = [18,20,22,24,26,28,30,32,34,36,38,40,42,44];
const LENGTH_SIZES = [16,17,18,19,20,21,22,24,26,28,30,32,34,36,38,40];

function snapToNearest(value, sizes) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return null;
  return sizes.reduce((prev, curr) =>
    Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
  );
}

// Condition → donation eligibility
const DONATE_OK    = ["ดีมาก", "ดี", "พอใช้"];   // acceptable for donation
const DONATE_REPAIR = ["ต้องซ่อม"];               // needs repair first

// ── Uniform type map (AI label → DB numeric uniform_category + gender) ────────
// DB uniform_category: 1=เสื้อนักเรียน, 2=กางเกงนักเรียน, 3=กระโปรงนักเรียน, 4=อื่นๆ
const TYPE_MAP = {
  "เสื้อนักเรียนหญิง": { category: 1, gender: "female" },
  "เสื้อนักเรียนชาย":  { category: 1, gender: "male"   },
  "กางเกงนักเรียน":    { category: 2, gender: null      },
  "กระโปรงนักเรียน":   { category: 3, gender: "female"  },
};

// ── 1. Analyze single uniform image with GPT-4o-mini ─────────────────────────
export async function analyzeUniform(imageBase64, mimeType = "image/jpeg") {
  const prompt = `คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์ชุดนักเรียนไทย
วิเคราะห์ภาพนี้อย่างละเอียด แล้วตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON

ตอบใน format นี้ (ค่าทุกตัวต้องเป็น string/number/null ตามที่ระบุ):
{
  "uniform_type": "<ดูจากลักษณะจริงในภาพ — เลือกหนึ่งใน: เสื้อนักเรียนหญิง | เสื้อนักเรียนชาย | กางเกงนักเรียน | กระโปรงนักเรียน>",
  "level": "<ดูจากขนาดและลักษณะชุด — เลือกหนึ่งใน: อนุบาล | ประถมศึกษา | มัธยมตอนต้น | มัธยมตอนปลาย | ไม่ทราบ>",
  "condition": "<ดูจากสภาพจริงของผ้า — เลือกหนึ่งใน: ดีมาก | ดี | พอใช้ | ต้องซ่อม>",
  "color": "<สีหลักของชุด เช่น ขาว เทา กรมท่า>",
  "measurements": {
    "chest": <ประมาณรอบอก (นิ้ว) ถ้าเป็นเสื้อ — null ถ้าไม่ใช่เสื้อหรือไม่แน่ใจ>,
    "waist": <ประมาณรอบเอว (นิ้ว) — null ถ้าไม่แน่ใจ>,
    "hip":   <ประมาณรอบสะโพก (นิ้ว) — null ถ้าไม่แน่ใจ>,
    "length":<ประมาณความยาวชุด (นิ้ว) — null ถ้าไม่แน่ใจ>
  },
  "confidence": {
    "uniform_type": <0-100, ความมั่นใจในประเภทชุด>,
    "chest": <0-100 หรือ 0 ถ้าไม่ได้วัด>,
    "waist": <0-100 หรือ 0 ถ้าไม่ได้วัด>,
    "hip":   <0-100 หรือ 0 ถ้าไม่ได้วัด>,
    "length":<0-100 หรือ 0 ถ้าไม่ได้วัด>
  },
  "notes": "<สังเกตเพิ่มเติม เช่น รอยขาด ซีด กระดุมหาย ตะเข็บหลุด — ใส่ null ถ้าไม่มี>"
}

แนวทางการแยกประเภทชุด:
- เสื้อนักเรียนหญิง: เสื้อผู้หญิง มักมีปกสีขาว กระดุมหน้า แขนสั้น/ยาว
- เสื้อนักเรียนชาย: เสื้อผู้ชาย มีปกแหลม กระดุมหน้า สีขาว
- กางเกงนักเรียน: กางเกงขาสั้น/ขายาว สีกรมท่า/ดำ/ขาว
- กระโปรงนักเรียน: กระโปรง สีกรมท่า/ดำ/ขาว มักมีจีบหรือริ้ว
- ถ้าเห็นเฉพาะกางเกง → กางเกงนักเรียน; ถ้าเห็นเฉพาะกระโปรง → กระโปรงนักเรียน
- ถ้าเห็นทั้งชุด ให้ระบุส่วนบน (เสื้อ) เป็นหลัก

แนวทางการประมาณระดับชั้นจากขนาดชุด (หน่วย: นิ้ว รอบอก):
- อนุบาล: อก 20–26", ชุดเล็กมาก, แขนสั้นมาก
- ประถมศึกษา: อก 26–34", ขนาดกลาง-เล็ก
- มัธยมตอนต้น: อก 32–40"
- มัธยมตอนปลาย: อก 38–52", ขนาดเกือบเท่าผู้ใหญ่
- ถ้าไม่แน่ใจ ให้ใส่ "ไม่ทราบ"

แนวทางการประเมินสภาพชุด:
- ดีมาก: ใหม่เอี่ยม/เกือบใหม่ สีสด ไม่มีรอยเลย
- ดี: ใช้แล้วแต่สภาพดี ไม่มีรอยขาด สีอาจซีดเล็กน้อย
- พอใช้: สีซีด/เหลือง มีคราบเล็กน้อย แต่ยังใส่ได้
- ต้องซ่อม: มีรอยขาด/ฉีก กระดุมหาย ตะเข็บหลุด ต้องซ่อมก่อนใช้

หมายเหตุการวัดขนาด (หน่วย: นิ้ว):
- เสื้อ: chest = ความกว้างสุดของตัวเสื้อ × 2
- กางเกง/กระโปรง: waist = ปากเอว × 2
- ถ้าไม่สามารถประมาณได้จากรูป → ใส่ null และ confidence 0`;

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
    max_tokens: 800,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("GPT-4o-mini returned invalid JSON: " + raw.slice(0, 200));
  }

  // ── Snap measurements to nearest standard Thai uniform size ─────────────────
  const rawMeas = parsed.measurements || {};
  const snapped = {
    chest:  snapToNearest(rawMeas.chest,  CHEST_SIZES),
    waist:  snapToNearest(rawMeas.waist,  WAIST_SIZES),
    hip:    snapToNearest(rawMeas.hip,    WAIST_SIZES),
    length: snapToNearest(rawMeas.length, LENGTH_SIZES),
  };

  // ── Donation eligibility ─────────────────────────────────────────────────
  const canDonate  = DONATE_OK.includes(parsed.condition);
  const needRepair = DONATE_REPAIR.includes(parsed.condition);

  // ── Normalise + add DB mapping ────────────────────────────────────────────
  const typeInfo = TYPE_MAP[parsed.uniform_type] ?? { category: 1, gender: null };
  return {
    ...parsed,
    measurements:     snapped,       // snapped to standard sizes
    raw_measurements: rawMeas,       // original AI estimate
    can_donate:       canDonate,
    need_repair:      needRepair,
    category:         typeInfo.category,  // numeric DB uniform_category (1/2/3/4)
    gender:           typeInfo.gender,
  };
}

// ── 2. Match analyzed uniforms against open projects ─────────────────────────
export async function matchProjects(uniforms) {
  if (!uniforms?.length) return [];

  // Fetch all open projects with school uniform reference image
  const [projects] = await db.query(`
    SELECT
      dr.request_id,
      dr.request_title,
      dr.end_date,
      dr.school_id,
      s.school_name,
      s.school_logo_url,
      s.school_address,
      s.province AS school_province,
      (SELECT COUNT(DISTINCT st.student_id)
       FROM students st WHERE st.request_id = dr.request_id) AS student_count,
      (SELECT SUM(sn2.quantity_needed - COALESCE(sn2.quantity_received, 0))
       FROM student_need sn2
       JOIN students st2 ON st2.student_id = sn2.student_id
       WHERE st2.request_id = dr.request_id
         AND sn2.quantity_needed > COALESCE(sn2.quantity_received, 0)) AS total_still_needed
    FROM donation_request dr
    JOIN schools s ON s.school_id = dr.school_id
    WHERE dr.status = 'open'
      AND (dr.start_date IS NULL OR dr.start_date <= CURDATE())
      AND s.verification_status = 'approved'
    ORDER BY dr.created_at DESC
    LIMIT 50
  `);

  if (!projects.length) return [];

  // Fetch needs for all these projects
  const requestIds = projects.map((p) => p.request_id);
  const placeholders = requestIds.map(() => "?").join(",");

  const [needs] = await db.query(`
    SELECT
      sn.student_need_id,
      sn.student_id,
      st.request_id,
      st.student_name,
      st.education_level_group AS level,
      sn.uniform_type_id,
      ut.type_name,
      ut.uniform_category,
      ut.gender,
      JSON_UNQUOTE(JSON_EXTRACT(sn.size, '$.chest')) AS chest,
      JSON_UNQUOTE(JSON_EXTRACT(sn.size, '$.waist')) AS waist,
      sn.quantity_needed,
      COALESCE(sn.quantity_received, 0) AS quantity_received
    FROM student_need sn
    JOIN students    st ON st.student_id      = sn.student_id
    JOIN uniform_type ut ON ut.uniform_type_id = sn.uniform_type_id
    WHERE st.request_id IN (${placeholders})
      AND sn.quantity_needed > COALESCE(sn.quantity_received, 0)
    ORDER BY st.request_id, sn.student_need_id
  `, requestIds);

  // Index needs by request_id
  const needsByProject = {};
  for (const n of needs) {
    if (!needsByProject[n.request_id]) needsByProject[n.request_id] = [];
    needsByProject[n.request_id].push(n);
  }

  // ── Score each (uniform × project) pair ────────────────────────────────────
  const CONDITION_MULT = { ดีมาก: 1.0, ดี: 0.9, พอใช้: 0.7, ต้องซ่อม: 0.3 };

  const results = [];

  for (let ui = 0; ui < uniforms.length; ui++) {
    const u = uniforms[ui];
    const condMult = CONDITION_MULT[u.condition] ?? 0.8;

    const uniformMatches = [];

    for (const proj of projects) {
      const projNeeds = needsByProject[proj.request_id] ?? [];
      if (!projNeeds.length) continue;

      // Find the best matching need in this project
      let bestNeed = null;
      let bestScore = 0;

      for (const need of projNeeds) {
        // Type match — DB uniform_category is numeric (1/2/3/4)
        // Compare against AI-derived numeric category
        const typeOk = Number(need.uniform_category) === u.category;
        if (!typeOk) continue;

        // Gender match
        const genderOk =
          u.gender === null ||
          need.gender === null ||
          need.gender === u.gender;
        if (!genderOk) continue;

        // Size score
        const sizeScore = calcSizeScore(u, need);
        if (sizeScore === 0) continue;

        const score = Math.round(sizeScore * condMult * 100);

        if (score > bestScore) {
          bestScore = score;
          bestNeed = { ...need, score };
        }
      }

      if (!bestNeed || bestScore < 25) continue;

      // Collect all matching needs for display
      const matchingNeeds = projNeeds
        .filter((n) => {
          const tOk = Number(n.uniform_category) === u.category;
          if (!tOk) return false;
          const gOk = u.gender === null || n.gender === null || n.gender === u.gender;
          return gOk;
        })
        .map((n) => ({
          student_need_id: n.student_need_id,
          student_name:    n.student_name,
          level:           n.level,
          type_name:       n.type_name,
          gender:          n.gender,
          chest:           n.chest,
          waist:           n.waist,
          still_needed:    n.quantity_needed - n.quantity_received,
        }));

      uniformMatches.push({
        request_id:       proj.request_id,
        request_title:    proj.request_title,
        school_id:        proj.school_id,
        school_name:      proj.school_name,
        school_logo_url:  proj.school_logo_url,
        school_address:   proj.school_address,
        school_province:  proj.school_province,
        student_count:    Number(proj.student_count || 0),
        total_still_needed: Number(proj.total_still_needed || 0),
        match_score:      bestScore,
        best_need:        bestNeed,
        matching_needs:   matchingNeeds,
        end_date:         proj.end_date,
      });
    }

    // Sort by score desc
    uniformMatches.sort((a, b) => b.match_score - a.match_score);

    results.push({
      uniform_index: ui,
      uniform:       u,
      matches:       uniformMatches.slice(0, 10),
    });
  }

  return results;
}

// ── 3. Size scoring helper ────────────────────────────────────────────────────
function calcSizeScore(uniform, need) {
  const cat = uniform.category; // 1=เสื้อ, 2=กางเกง, 3=กระโปรง, 4=อื่นๆ

  if (cat === 1) {
    // Shirt — primary: chest
    const donated = parseFloat(uniform.measurements?.chest);
    const needed  = parseFloat(need.chest);
    return measureScore(donated, needed);
  }

  if (cat === 2 || cat === 3) {
    // Pants / Skirt — primary: waist
    const donated = parseFloat(uniform.measurements?.waist);
    const needed  = parseFloat(need.waist);
    return measureScore(donated, needed);
  }

  return 0.5; // fallback for อื่นๆ or unknown
}

function measureScore(donated, needed) {
  // Unknown size on either side → neutral score (still shows up in results)
  if (isNaN(donated) || isNaN(needed) || donated <= 0 || needed <= 0) return 0.5;
  const diff = Math.abs(donated - needed);
  if (diff === 0) return 1.0;
  if (diff <= 1)  return 0.9;
  if (diff <= 2)  return 0.75;
  if (diff <= 3)  return 0.55;
  if (diff <= 4)  return 0.35;
  if (diff <= 6)  return 0.15; // far off but still show with low score
  return 0.05;                  // very far — nearly zero but still visible
}

// ── 4. Build multi-uniform × multi-project matrix ────────────────────────────
export function buildMatchMatrix(matchResults) {
  // Collect unique projects
  const projMap = {};
  for (const ur of matchResults) {
    for (const m of ur.matches) {
      if (!projMap[m.request_id]) {
        projMap[m.request_id] = {
          request_id:      m.request_id,
          request_title:   m.request_title,
          school_name:     m.school_name,
          school_logo_url: m.school_logo_url,
          school_province: m.school_province,
          student_count:   m.student_count,
          end_date:        m.end_date,
        };
      }
    }
  }

  const projects = Object.values(projMap);

  // Build matrix rows
  const matrix = matchResults.map((ur) => {
    const cells = {};
    for (const m of ur.matches) {
      cells[m.request_id] = {
        score:   m.match_score,
        is_best: false,
      };
    }
    // Mark best
    if (ur.matches.length) {
      cells[ur.matches[0].request_id].is_best = true;
    }
    return {
      uniform_index: ur.uniform_index,
      uniform:       ur.uniform,
      cells,
    };
  });

  // Build recommended bundles (group uniforms going to same project)
  const bundleMap = {};
  for (const ur of matchResults) {
    if (!ur.matches.length) continue;
    const best = ur.matches[0];
    if (!bundleMap[best.request_id]) {
      bundleMap[best.request_id] = {
        ...best,
        uniforms: [],
        avg_score: 0,
      };
    }
    bundleMap[best.request_id].uniforms.push({
      uniform_index: ur.uniform_index,
      uniform:       ur.uniform,
      score:         best.match_score,
    });
  }

  for (const b of Object.values(bundleMap)) {
    b.avg_score = Math.round(
      b.uniforms.reduce((s, u) => s + u.score, 0) / b.uniforms.length
    );
  }

  const bundles = Object.values(bundleMap).sort((a, b) => b.avg_score - a.avg_score);

  return { matrix, projects, bundles };
}
