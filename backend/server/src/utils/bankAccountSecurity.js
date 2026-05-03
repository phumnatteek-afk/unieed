import crypto from "crypto";

const SECRET = String(process.env.BANK_ACCOUNT_SECRET || process.env.JWT_SECRET || "dev-bank-secret");
const KEY = crypto.createHash("sha256").update(SECRET).digest();

export function sanitizeBankName(input) {
  return String(input || "").trim().replace(/\s+/g, " ");
}

export function sanitizeBankNumber(input) {
  return String(input || "").replace(/\D/g, "");
}

export function isValidBankName(name) {
  if (!name) return false;
  if (name.length < 2 || name.length > 120) return false;
  // Thai + English letters only, allow spaces.
  return /^[A-Za-zก-๙\s]+$/.test(name);
}

export function isValidBankNumber(num) {
  return /^\d{10,12}$/.test(String(num || ""));
}

export function encryptBankAccountNumber(plain) {
  const normalized = sanitizeBankNumber(plain);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptBankAccountNumber(stored) {
  const value = String(stored || "");
  if (!value) return "";
  if (!value.startsWith("enc:")) return sanitizeBankNumber(value);
  const parts = value.split(":");
  if (parts.length !== 4) return "";
  try {
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const encrypted = Buffer.from(parts[3], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return sanitizeBankNumber(dec.toString("utf8"));
  } catch {
    return "";
  }
}

export function maskBankAccountNumber(input) {
  const num = sanitizeBankNumber(input);
  if (!num) return "";
  if (num.length <= 4) return num;
  return `${"*".repeat(Math.max(0, num.length - 4))}${num.slice(-4)}`;
}

export function formatBankAccountNumber(input) {
  const num = sanitizeBankNumber(input);
  if (!num) return "";
  if (num.length <= 3) return num;
  if (num.length <= 7) return `${num.slice(0, 3)}-${num.slice(3)}`;
  return `${num.slice(0, 3)}-${num.slice(3, 4)}-${num.slice(4, 9)}-${num.slice(9)}`;
}
