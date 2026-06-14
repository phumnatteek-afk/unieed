/**
 * thaiAddress.js
 * ข้อมูลที่อยู่ไทยครบ ~7,400 ตำบล สำหรับ autocomplete
 * โหลด lazy จาก geography.json (โหลดครั้งแรกเมื่อเปิดฟอร์มที่อยู่)
 */

const SEARCH_LIMIT = 15;

let addressDB = null;
let provinceList = null;
let loadPromise = null;

function normalize(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "");
}

function mapRow(item) {
  return {
    tambon: item.subdistrictNameTh,
    amphoe: item.districtNameTh,
    province: item.provinceNameTh,
    zipcode: String(item.postalCode),
  };
}

/** โหลดข้อมูลที่อยู่ (เรียกครั้งเดียว แล้ว cache) */
export function ensureAddressDataReady() {
  if (addressDB) return Promise.resolve(addressDB);
  if (!loadPromise) {
    loadPromise = import("@amiearth/thai-address-finder/dist/data/geography.json")
      .then((mod) => {
        const raw = mod.default ?? mod;
        addressDB = raw.map(mapRow);
        provinceList = [...new Set(addressDB.map((r) => r.province))].sort();
        return addressDB;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

export function isAddressDataReady() {
  return !!addressDB;
}

function scoreRow(row, kw, field) {
  const nTambon = normalize(row.tambon);
  const nAmphoe = normalize(row.amphoe);
  const nProv = normalize(row.province);
  const zip = row.zipcode;

  let score = 0;

  // รหัสไปรษณีย์ — รองรับ prefix (เช่น พิมพ์ 1020 → 10200)
  if (/^\d+$/.test(kw)) {
    if (zip === kw) score += 100;
    else if (zip.startsWith(kw)) score += 80 - (zip.length - kw.length);
    return score;
  }

  const match = (text, exactW, startW, containW) => {
    if (text === kw) return exactW;
    if (text.startsWith(kw)) return startW;
    if (text.includes(kw)) return containW;
    return 0;
  };

  score += match(nTambon, 60, 45, 25);
  score += match(nAmphoe, 50, 35, 20);
  score += match(nProv, 40, 30, 15);

  // ให้คะแนนสูงขึ้นตามช่องที่กำลังพิมพ์
  if (field === "district" && nTambon.includes(kw)) score += 15;
  if (field === "amphoe" && nAmphoe.includes(kw)) score += 15;
  if (field === "province" && nProv.includes(kw)) score += 15;

  return score;
}

/**
 * ค้นหาที่อยู่ตาม keyword (ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์)
 * @param {string} keyword
 * @param {{ field?: "district"|"amphoe"|"province"|"postcode", limit?: number }} [opts]
 * @returns Array<{tambon, amphoe, province, zipcode}>
 */
export function searchAddress(keyword, opts = {}) {
  if (!keyword || !addressDB) return [];

  const kw = normalize(keyword);
  const minLen = /^\d+$/.test(kw) ? 3 : 2;
  if (kw.length < minLen) return [];

  const field = opts.field || null;
  const limit = opts.limit ?? SEARCH_LIMIT;

  const scored = [];
  for (const row of addressDB) {
    const score = scoreRow(row, kw, field);
    if (score > 0) scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score || a.row.tambon.localeCompare(b.row.tambon, "th"));

  // dedupe ตำบล+อำเภอ+จังหวัด+รหัส (กรณีข้อมูลซ้ำ)
  const seen = new Set();
  const results = [];
  for (const { row } of scored) {
    const key = `${row.tambon}|${row.amphoe}|${row.province}|${row.zipcode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(row);
    if (results.length >= limit) break;
  }
  return results;
}

/** ค้นหาตามรหัสไปรษณีย์ (prefix) */
export function searchByZip(zip) {
  return searchAddress(String(zip || "").trim(), { field: "postcode" });
}

/** filter province suggestions จากที่พิมพ์ */
export function suggestProvinces(keyword) {
  if (!keyword) return [];
  const kw = normalize(keyword);
  const list = provinceList || PROVINCES;
  return list.filter((p) => normalize(p).includes(kw)).slice(0, SEARCH_LIMIT);
}

// backward compat — รายชื่อจังหวัด (ใช้ก่อนโหลดข้อมูลเต็ม)
export const PROVINCES = [
  "กระบี่","กรุงเทพมหานคร","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร",
  "ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท",
  "ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง",
  "ตราด","ตาก","นครนายก","นครปฐม","นครพนม",
  "นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส",
  "น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์",
  "ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา",
  "พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์",
  "แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน",
  "ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง",
  "ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย",
  "ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ",
  "สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี",
  "สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย",
  "หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์",
  "อุทัยธานี","อุบลราชธานี",
];
