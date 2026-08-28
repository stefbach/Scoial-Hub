/**
 * lib/connectors/meta-appsecret.ts
 *
 * `appsecret_proof` — preuve HMAC exigée par l'option de sécurité Meta
 * « Require App Secret ». Chaque appel Graph doit porter
 *   appsecret_proof = HMAC-SHA256(access_token, app_secret)
 * faute de quoi Meta rejette l'appel une fois l'option activée.
 *
 * Point d'application UNIQUE pour toute l'app : les connecteurs passent leurs
 * URLs et leurs corps de requête par ces helpers, jamais par un calcul local.
 *
 * Sans secret configuré (dev/démo), les helpers sont des no-op : rien n'est
 * ajouté et aucun appel existant ne change de comportement.
 */

import crypto from "crypto";

/**
 * Secret de l'app Meta. Tolère les deux formats rencontrés en configuration :
 * `META_APP_SECRET` seul, ou un `META_APP_ID` au format token d'app
 * « <app_id>|<app_secret> » dont on extrait la seconde moitié.
 */
const META_APP_SECRET = (
  process.env.META_APP_SECRET ??
  (process.env.META_APP_ID ?? "").split("|")[1] ??
  ""
)
  .split("|")[0]
  .trim();

/** Nom du paramètre attendu par la Graph API. */
const PARAM = "appsecret_proof";

/**
 * Calcule la preuve pour un token donné, ou null si le calcul est impossible
 * (secret d'app absent, token vide).
 */
export function appSecretProof(accessToken: string): string | null {
  if (!META_APP_SECRET || !accessToken) return null;
  return crypto.createHmac("sha256", META_APP_SECRET).update(accessToken).digest("hex");
}

/**
 * Ajoute `appsecret_proof` à une URL Graph qui porte déjà son `access_token`
 * dans la query string — y compris les URLs de pagination (`paging.next`)
 * renvoyées telles quelles par Meta.
 *
 * Idempotent : une URL déjà signée est renvoyée inchangée. Une URL sans
 * `access_token` (ou une URL non parsable) est renvoyée inchangée.
 */
export function withAppSecretProof(url: string): string {
  if (!META_APP_SECRET) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has(PARAM)) return url;
    const token = u.searchParams.get("access_token");
    if (!token) return url;
    const proof = appSecretProof(token);
    if (!proof) return url;
    u.searchParams.set(PARAM, proof);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Ajoute `appsecret_proof` à un corps `application/x-www-form-urlencoded`
 * portant déjà son `access_token` (POST Graph). Mute et renvoie le même objet.
 */
export function signFormBody(form: URLSearchParams): URLSearchParams {
  if (!META_APP_SECRET || form.has(PARAM)) return form;
  const proof = appSecretProof(form.get("access_token") ?? "");
  if (proof) form.set(PARAM, proof);
  return form;
}

/**
 * Paire `{ appsecret_proof }` à fusionner dans un objet de paramètres, ou objet
 * vide si le calcul est impossible.
 */
export function appSecretProofParam(accessToken: string): Record<string, string> {
  const proof = appSecretProof(accessToken);
  return proof ? { [PARAM]: proof } : {};
}
