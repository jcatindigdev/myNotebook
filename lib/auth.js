// Works in both the Edge runtime (middleware) and Node (API routes)
// using the Web Crypto API.

export const COOKIE_NAME = "nb_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function toBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET env var is missing or too short (use 32+ random characters).");
  }
  return s;
}

async function hmac(value) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function createSessionToken() {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  try {
    return safeEqual(sig, await hmac(payload));
  } catch {
    return false;
  }
}
