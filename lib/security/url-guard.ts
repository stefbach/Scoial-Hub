// Garde anti-SSRF : valide une URL fournie par l'utilisateur avant tout fetch
// côté serveur. Bloque les schémas non http(s), le loopback, les IP privées et
// les services de métadonnées cloud (169.254.169.254, *.internal…).

const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /(^|\.)metadata\.google\.internal$/i,
];

/** IPv4 privée / loopback / link-local / metadata. */
function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/** True si l'URL est sûre à récupérer côté serveur. */
export function isSafeRemoteUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // dé-bracket IPv6
  if (!host) return false;
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) return false;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false; // IPv6 loopback/link-local/ULA
  if (isPrivateIPv4(host)) return false;
  return true;
}
