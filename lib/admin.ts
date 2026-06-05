// Authentification du mode ADMIN (console d'administration).
//
// Variables d'env (à configurer en prod) :
//   ADMIN_EMAIL    — email du compte admin.
//   ADMIN_PASSWORD — mot de passe admin (comparaison à temps constant).
//   ADMIN_SECRET   — secret HMAC pour signer le cookie de session.
//
// Sécurité :
//   - Le cookie de session ne contient PAS une constante devinable : c'est un
//     token signé (HMAC-SHA256) d'un payload horodaté. La validité est vérifiée
//     par signature + expiration (7 jours).
//   - Le mot de passe est comparé à temps constant (timingSafeEqual).
//
// Mode DEV (échappatoire documentée) : si ADMIN_PASSWORD ou ADMIN_SECRET est
//   absent, on retombe sur des valeurs de développement. ⚠️ NE JAMAIS déployer
//   en prod sans définir ADMIN_PASSWORD et ADMIN_SECRET — sinon les identifiants
//   de dev ci-dessous sont actifs.

import crypto from "crypto";

// Nom du cookie de session admin (httpOnly).
export const ADMIN_COOKIE = "sh_admin";

// Durée de validité d'une session (7 jours, en secondes).
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

// ── Identifiants ──────────────────────────────────────────────────────────────

// Fallback DEV uniquement (utilisés seulement si l'env n'est pas configurée).
const DEV_FALLBACK_EMAIL = "admin@socialhub.com";
const DEV_FALLBACK_PASSWORD = "dev-only-change-me";
const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? DEV_FALLBACK_EMAIL;

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? DEV_FALLBACK_PASSWORD;
}

function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? DEV_FALLBACK_SECRET;
}

/** True si l'admin est correctement configuré pour la production. */
export const isAdminConfigured =
  Boolean(process.env.ADMIN_PASSWORD) && Boolean(process.env.ADMIN_SECRET);

// ── Comparaison à temps constant ──────────────────────────────────────────────

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual exige des longueurs égales : on hache d'abord pour normaliser.
  const ah = crypto.createHash("sha256").update(ab).digest();
  const bh = crypto.createHash("sha256").update(bb).digest();
  return crypto.timingSafeEqual(ah, bh);
}

/** Vérifie email + mot de passe contre la configuration (temps constant). */
export function isValidAdmin(email: string, password: string): boolean {
  const emailOk = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const passOk = constantTimeEqual(password ?? "", getAdminPassword());
  return emailOk && passOk;
}

// ── Session signée (HMAC) ─────────────────────────────────────────────────────

function sign(payload: string): string {
  return crypto.createHmac("sha256", getAdminSecret()).update(payload).digest("base64url");
}

/**
 * Génère la valeur de cookie de session admin : un token signé horodaté.
 * Format : "<issuedAtMs>.<expiresAtMs>.<signatureBase64url>".
 */
export function createAdminSession(): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ADMIN_SESSION_MAX_AGE * 1000;
  const payload = `${issuedAt}.${expiresAt}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

/**
 * Vérifie la signature et l'expiration d'une valeur de cookie de session.
 * Renvoie true si la session est valide et non expirée.
 */
export function verifyAdminSession(value: string | undefined | null): boolean {
  if (!value || typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [issuedAtStr, expiresAtStr, sig] = parts;
  const payload = `${issuedAtStr}.${expiresAtStr}`;

  // Vérifie la signature à temps constant.
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  // Vérifie l'expiration.
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}
