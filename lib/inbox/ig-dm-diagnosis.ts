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
  /**
   * L'erreur observée ne dit RIEN de la santé de la messagerie. Cas type :
   * l'erreur (#3) « does not have the capability » sur le nœud Instagram, qui
   * attend un token Instagram Login et non un token de Page — elle apparaît
   * même quand tout fonctionne, et ne doit jamais être présentée comme la
   * cause d'une boîte vide.
   */
  inconclusive?: boolean;
}

export interface IgDmDiagnosis {
  /** Un compte Instagram professionnel est lié à la Page connectée. */
  igLinked: boolean;
  igUsername?: string;
  /** BUSINESS / MEDIA_CREATOR / PERSONAL — la messagerie exige un compte pro. */
  igAccountType?: string;
  pageName?: string;
  /** null = indéterminable (aucun token utilisateur enregistré). */
  permissionGranted: boolean | null;
  /** La Page est abonnée au webhook « messages » de l'app. null = inconnu. */
  webhookSubscribed: boolean | null;
  /**
   * Conversations MESSENGER lues avec le même token. Contre-épreuve décisive :
   * si Messenger répond et Instagram reste à zéro, l'edge, le token et la Page
   * sont hors de cause — le blocage est propre au compte Instagram.
   */
  messengerConversations: number | null;
  probes: NodeProbe[];
  verdict: IgDmVerdict;
}

/** Une erreur Graph qui ne prouve rien sur l'état réel de la messagerie. */
function isInconclusiveError(message: string | undefined, code: number | undefined): boolean {
  if (code === 3) return true;
  return Boolean(message && /does not have the capability|capability to make this API call/i.test(message));
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
  // Aucune conversation. Une erreur NON concluante (cf. NodeProbe.inconclusive)
  // ne fait pas un diagnostic : seul un refus réel vaut « graph-error ». Si un
  // nœud a répondu sans erreur — même « vide » — l'appel fonctionne, et le
  // silence vient du compte, pas de l'API.
  const meaningful = input.probes.filter((p) => !p.inconclusive);
  if (meaningful.length > 0 && meaningful.every((p) => p.error)) return "graph-error";
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
        (d.probes.find((p) => p.error && !p.inconclusive)?.error ?? "erreur non détaillée") +
        ". Reconnectez Meta ; si l'erreur persiste, elle nomme la cause exacte."
      );
    case "access-blocked-or-empty": {
      // La contre-épreuve Messenger change la force de la conclusion : un
      // Messenger qui répond prouve que le token, la Page et l'edge marchent.
      const proof =
        d.messengerConversations && d.messengerConversations > 0
          ? `L'appel FONCTIONNE : le même token lit ${d.messengerConversations} conversation(s) Messenger sur cette Page. ` +
            "Le token, la Page et la permission sont donc hors de cause — le silence est propre au compte Instagram. "
          : "L'appel aboutit sans erreur, mais ne renvoie aucune conversation. ";
      const creator =
        d.igAccountType && d.igAccountType !== "BUSINESS"
          ? `Le compte @${d.igUsername ?? ""} est de type ${d.igAccountType} : la messagerie via l'API exige un compte ` +
            "PROFESSIONNEL (Business). Basculez-le en compte Business dans Instagram, puis reconnectez Meta. "
          : "";
      return (
        proof +
        creator +
        "Deux lectures restent possibles, que l'API ne distingue pas : soit le compte n'a reçu aucun " +
        "message privé, soit l'accès aux messages est bloqué côté compte (Instagram → Paramètres → " +
        "Messages et réponses aux stories → Outils connectés → « Autoriser l'accès aux messages »). " +
        "Pour trancher en deux minutes : envoyez un message privé à ce compte DEPUIS UN AUTRE COMPTE, " +
        "puis relancez ce diagnostic. S'il reste à zéro alors qu'un message vient d'arriver, c'est le réglage."
      );
    }
    case "ok":
    default:
      return (
        `Les conversations Instagram sont lisibles (${d.probes.reduce((s, p) => s + p.conversations, 0)} fil(s) vu(s)). ` +
        "« Synchroniser Meta » importera les messages privés."
      );
  }
}

// ── Sondes Graph ─────────────────────────────────────────────────────────────

async function gget(
  path: string,
  token: string
): Promise<{ json: Record<string, unknown>; error?: string; code?: number }> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      withAppSecretProof(`https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`),
      { cache: "no-store" }
    );
    const json = (await res.json()) as Record<string, unknown>;
    const err = (json as { error?: { message?: string; code?: number } }).error;
    return { json, error: err?.message, code: err?.code };
  } catch (e) {
    return { json: {}, error: e instanceof Error ? e.message : "échec réseau" };
  }
}

/** Nombre d'éléments d'un edge, ou null si l'appel a échoué. */
function edgeCount(json: Record<string, unknown>, error?: string): number | null {
  if (error) return null;
  const data = json.data as unknown[] | undefined;
  return Array.isArray(data) ? data.length : 0;
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
    messengerConversations: null,
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

  // Identité et TYPE du compte Instagram lié : confirme quel compte est
  // interrogé, et si c'est bien un compte professionnel (seul type dont la
  // messagerie est exposée par l'API).
  if (ctx.igId) {
    const { json } = await gget(`${ctx.igId}?fields=username,account_type`, token);
    if (json.username) out.igUsername = String(json.username);
    if (json.account_type) out.igAccountType = String(json.account_type);
  }

  // Contre-épreuve MESSENGER : le même token, la même Page, le même edge —
  // sans platform=instagram. S'il répond, l'infrastructure d'accès est prouvée
  // saine, et un zéro côté Instagram ne peut plus être imputé au token.
  if (ctx.pageId) {
    const { json, error } = await gget(`${ctx.pageId}/conversations?fields=id&limit=25`, token);
    out.messengerConversations = edgeCount(json, error);
  }

  // Conversations Instagram : le nœud de la PAGE est le chemin documenté du
  // Messenger Platform avec un token de Page. Le nœud Instagram n'est sondé
  // qu'en REPLI, s'il a échoué : interrogé avec un token de Page, il renvoie
  // l'erreur (#3) « does not have the capability » même quand tout va bien —
  // la faire figurer comme un échec brouillait la lecture du diagnostic.
  if (ctx.pageId) {
    const { json, error, code } = await gget(
      `${ctx.pageId}/conversations?platform=instagram&fields=id&limit=25`,
      token
    );
    out.probes.push({
      node: "page",
      id: ctx.pageId,
      conversations: edgeCount(json, error) ?? 0,
      error,
      inconclusive: error ? isInconclusiveError(error, code) : undefined,
    });
  }
  const pageProbe = out.probes[0];
  if (ctx.igId && (!pageProbe || pageProbe.error)) {
    const { json, error, code } = await gget(
      `${ctx.igId}/conversations?platform=instagram&fields=id&limit=25`,
      token
    );
    out.probes.push({
      node: "instagram",
      id: ctx.igId,
      conversations: edgeCount(json, error) ?? 0,
      error,
      inconclusive: error ? isInconclusiveError(error, code) : undefined,
    });
  }

  out.verdict = verdictFor(out);
  return out;
}
