// Vérification de session admin compatible **runtime Edge** (middleware).
//
// Le middleware Next.js s'exécute sur l'Edge runtime, qui NE supporte PAS l'API
// `crypto` de Node (createHmac/timingSafeEqual). On réimplémente donc la
// vérification HMAC-SHA256 avec la Web Crypto API (`crypto.subtle`), disponible
// sur Edge. Le format de signature est identique à celui produit par
// `createAdminSession()` (lib/admin.ts, Node) : base64url sans padding.

export const ADMIN_COOKIE = "sh_admin";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

// Doit rester IDENTIQUE au fallback de lib/admin.ts (sinon les signatures
// posées par le login Node ne seraient pas validées par le middleware Edge).
const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? DEV_FALLBACK_SECRET;
}

/** HMAC-SHA256(payload) en base64url sans padding (Web Crypto, Edge-safe). */
async function hmacBase64Url(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // base64 → base64url, sans padding (comme Node `.digest("base64url")`).
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Comparaison à temps ~constant de deux chaînes de même longueur. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie la signature + l'expiration d'un cookie de session admin.
 * Format attendu : "<issuedAtMs>.<expiresAtMs>.<signatureBase64url>".
 */
export async function verifyAdminSessionEdge(value: string | undefined | null): Promise<boolean> {
  if (!value || typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [issuedAtStr, expiresAtStr, sig] = parts;
  const payload = `${issuedAtStr}.${expiresAtStr}`;

  const expected = await hmacBase64Url(getAdminSecret(), payload);
  if (!safeEqual(sig, expected)) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  return true;
}
