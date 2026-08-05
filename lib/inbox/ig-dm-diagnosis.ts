/**
 * Diagnostic des messages privés Instagram.
 *
 * POURQUOI CE FICHIER EXISTE
 * Une messagerie Instagram muette a quatre causes possibles, et Meta n'en
 * distingue aucune par un message d'erreur clair :
 *   1. aucun compte Instagram professionnel n'est lié à la Page ;
 *   2. la permission instagram_manage_messages n'est pas accordée au token ;
 *   3. l'edge des conversations refuse la lecture (erreur Graph explicite) ;
 *   4. l'accès aux messages est bloqué CÔTÉ COMPTE Instagram — réglage
 *      « Outils connectés → Autoriser l'accès aux messages » — auquel cas Graph
 *      renvoie une liste VIDE, sans la moindre erreur, exactement comme une
 *      boîte réellement vide.
 *
 * Les cas 1 à 3 se déterminent depuis l'API. Le cas 4 ne se distingue d'une
 * boîte vide que par un essai : envoyer un message privé au compte puis
 * relancer. Le verdict le dit explicitement plutôt que de trancher à tort.
 */

import { withAppSecretProof } from "@/lib/connectors/meta-appsecret";
import { getMetaContext } from "@/lib/connectors/meta-pages";

const V = process.env.META_API_VERSION ?? "v21.0";

export type IgDmVerdict =
  | "ok"
  | "no-ig"
  | "permission-missing"
  | "graph-error"
  | "access-blocked-or-empty";

/** Lecture de l'edge des conversations sur un nœud Graph donné. */
export interface NodeProbe {
  node: "page" | "instagram";
  id: string;
  conversations: number;
  error?: string;
}

export interface IgDmDiagnosis {
  /** Un compte Instagram professionnel est lié à la Page connectée. */
  igLinked: boolean;
  igUsername?: string;
  pageName?: string;
  /** null = indéterminable (aucun token utilisateur enregistré). */
  permissionGranted: boolean | null;
  /** La Page est abonnée au webhook « messages » de l'app. null = inconnu. */
  webhookSubscribed: boolean | null;
  probes: NodeProbe[];
  verdict: IgDmVerdict;
}

/**
 * Verdict déduit des observations. Fonction PURE : c'est elle qui porte la
 * logique de décision, et elle est testée cas par cas.
 */
export function verdictFor(
  input: Pick<IgDmDiagnosis, "igLinked" | "permissionGranted" | "probes">
): IgDmVerdict {
  if (!input.igLinked) return "no-ig";
  if (input.permissionGranted === false) return "permission-missing";
  if (input.probes.some((p) => p.conversations > 0)) return "ok";
  // Aucune conversation : soit tous les nœuds ont refusé (erreur exploitable),
  // soit ils ont répondu « vide » — indiscernable d'une boîte sans message.
  const answered = input.probes.filter((p) => !p.error);
  if (input.probes.length > 0 && answered.length === 0) return "graph-error";
  return "access-blocked-or-empty";
}

/** Message actionnable associé à chaque verdict. */
export function explain(d: IgDmDiagnosis): string {
  switch (d.verdict) {
    case "no-ig":
      return (
        "Aucun compte Instagram professionnel n'est lié à la Page connectée. " +
        "Liez-le depuis la Page Facebook (Paramètres → Comptes liés → Instagram), " +
        "puis reconnectez Meta dans Comptes."
      );
    case "permission-missing":
      return (
        "La permission instagram_manage_messages n'est PAS accordée au token actuel. " +
        "Reconnectez Facebook (Comptes) en acceptant l'accès aux messages Instagram — " +
        "sans elle, Meta ne servira jamais les conversations."
      );
    case "graph-error":
      return (
        "Meta refuse la lecture des conversations Instagram : " +
        (d.probes.find((p) => p.error)?.error ?? "erreur non détaillée") +
        ". Reconnectez Meta ; si l'erreur persiste, elle nomme la cause exacte."
      );
    case "access-blocked-or-empty":
      return (
        "Meta répond sans erreur mais ne renvoie AUCUNE conversation. Deux lectures " +
        "possibles, que l'API ne distingue pas : soit le compte Instagram n'a reçu aucun " +
        "message privé, soit l'accès est bloqué côté compte. Vérifiez dans l'application " +
        "Instagram : Paramètres → Messages et réponses aux stories → Outils connectés → " +
        "« Autoriser l'accès aux messages ». Pour trancher : envoyez-vous un message privé " +
        "depuis un autre compte, puis relancez ce diagnostic — s'il reste à zéro, c'est le réglage."
      );
    case "ok":
    default:
      return (
        `Les conversations Instagram sont lisibles (${d.probes.reduce((s, p) => s + p.conversations, 0)} fil(s) vu(s)). ` +
        "« Synchroniser Meta » importera les messages privés."
      );
  }
}

// ── Sondes Graph ─────────────────────────────────────────────────────────────

async function gget(path: string, token: string): Promise<{ json: Record<string, unknown>; error?: string }> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      withAppSecretProof(`https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`),
      { cache: "no-store" }
    );
    const json = (await res.json()) as Record<string, unknown>;
    const err = (json as { error?: { message?: string } }).error;
    return { json, error: err?.message };
  } catch (e) {
    return { json: {}, error: e instanceof Error ? e.message : "échec réseau" };
  }
}

/**
 * Établit le diagnostic pour une société. Ne throw jamais : chaque sonde
 * indéterminable laisse son champ à `null` plutôt que de faire échouer le tout.
 */
export async function diagnoseIgDm(companyId: string): Promise<IgDmDiagnosis> {
  const ctx = await getMetaContext(companyId);
  const out: IgDmDiagnosis = {
    igLinked: Boolean(ctx.igId),
    pageName: ctx.pageName,
    permissionGranted: null,
    webhookSubscribed: null,
    probes: [],
    verdict: "no-ig",
  };

  const token = ctx.pageToken;
  if (!token) {
    out.verdict = "no-ig";
    return out;
  }

  // Permission réellement accordée au token utilisateur.
  if (ctx.userToken) {
    const { json } = await gget("me/permissions?limit=100", ctx.userToken);
    const rows = (json.data as Array<{ permission?: string; status?: string }>) ?? [];
    if (rows.length > 0) {
      out.permissionGranted = rows.some(
        (r) => r.permission === "instagram_manage_messages" && r.status === "granted"
      );
    }
  }

  // Abonnement de la Page au webhook « messages » (temps réel).
  if (ctx.pageId) {
    const { json, error } = await gget(`${ctx.pageId}/subscribed_apps`, token);
    if (!error) {
      const apps = (json.data as Array<{ subscribed_fields?: string[] }>) ?? [];
      out.webhookSubscribed = apps.some((a) => (a.subscribed_fields ?? []).includes("messages"));
    }
  }

  // Nom d'usage du compte Instagram lié (confirme QUEL compte est interrogé).
  if (ctx.igId) {
    const { json } = await gget(`${ctx.igId}?fields=username`, token);
    if (json.username) out.igUsername = String(json.username);
  }

  // Lecture des conversations sur les deux nœuds possibles.
  const nodes: Array<{ node: "page" | "instagram"; id?: string }> = [
    { node: "page", id: ctx.pageId },
    { node: "instagram", id: ctx.igId },
  ];
  for (const { node, id } of nodes) {
    if (!id) continue;
    const { json, error } = await gget(`${id}/conversations?platform=instagram&fields=id&limit=25`, token);
    const data = (json.data as unknown[]) ?? [];
    out.probes.push({ node, id, conversations: Array.isArray(data) ? data.length : 0, error });
  }

  out.verdict = verdictFor(out);
  return out;
}
