// Encode/décode le state OAuth pour transporter companyId + URL de retour.
//
// Format : `<nonce hex>.<companyId encodé>.<ret encodé>`
// Le nonce (anti-CSRF) est généré aléatoirement à l'aller et doit être
// présent au retour. `parseState` valide le format et n'accepte que des
// chemins de retour internes (commençant par `/`, hors `//` qui ouvrirait
// une redirection vers un domaine externe).
import crypto from "crypto";

/** Chemin de retour par défaut si le state est absent/invalide. */
export const DEFAULT_RETURN = "/parametres-connecteurs";

/**
 * Valide qu'un chemin de retour est strictement interne :
 * - commence par "/" (chemin absolu)
 * - n'est pas "//host" ni "/\host" (open-redirect protocol-relative)
 */
export function isSafeInternalPath(ret: string | null | undefined): boolean {
  if (!ret || typeof ret !== "string") return false;
  if (!ret.startsWith("/")) return false;
  // "//evil.com" ou "/\evil.com" => redirection externe déguisée
  if (ret.startsWith("//") || ret.startsWith("/\\")) return false;
  return true;
}

/** Retourne `ret` s'il est interne, sinon le fallback sûr. */
export function safeReturnPath(ret: string | null | undefined): string {
  return isSafeInternalPath(ret) ? (ret as string) : DEFAULT_RETURN;
}

export function buildState(companyId: string, ret: string): string {
  const safeRet = safeReturnPath(ret);
  return `${crypto.randomBytes(8).toString("hex")}.${encodeURIComponent(companyId)}.${encodeURIComponent(safeRet)}`;
}

export function parseState(state: string | null): { companyId: string; ret: string; valid: boolean } {
  const parts = (state ?? "").split(".");
  // Format attendu : nonce.companyId.ret => au moins 3 segments, nonce non vide.
  const nonce = parts[0] ?? "";
  const valid = parts.length >= 3 && /^[a-f0-9]{8,}$/i.test(nonce);

  const companyId = valid && parts[1] ? decodeURIComponent(parts[1]) : "";
  const rawRet = valid && parts[2] ? decodeURIComponent(parts[2]) : "";

  return {
    companyId,
    // Toujours renvoyer un chemin interne sûr (anti open-redirect).
    ret: safeReturnPath(rawRet),
    valid,
  };
}
