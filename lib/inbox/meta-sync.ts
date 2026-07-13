// Synchronisation des messages Meta (commentaires Facebook + Instagram, messages
// privés Messenger + IG DM, avis de la Page) vers la messagerie, et envoi des
// réponses vers la plateforme.
// Utilise le token de PAGE stocké pour la société (cf. meta-pages.getMetaContext).

import { getMetaContext } from "@/lib/connectors/meta-pages";
import { ingestMessage } from "@/lib/repositories/inbox";
import type { InboxChannel } from "@/lib/inbox/types";

const V = process.env.META_API_VERSION ?? "v21.0";

/** Edge Graph imbriqué (data + pagination). */
interface GraphEdge {
  data?: Array<Record<string, unknown>>;
  paging?: { next?: string };
}

/**
 * GET Graph. En cas d'erreur Graph, le message est collecté dans `errs`
 * (au lieu d'être avalé) pour être remonté à l'utilisateur : c'est souvent
 * une permission manquante qui explique des messages « invisibles ».
 */
async function gget(
  path: string,
  token: string,
  errs?: string[]
): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const j = (await res.json()) as Record<string, unknown>;
    const err = (j as { error?: { message?: string } }).error;
    if (err) {
      if (err.message) errs?.push(err.message);
      // Trace serveur (visible dans les logs Vercel) — sans le token.
      console.error("[meta-sync] Graph refuse", path.split("?")[0], "→", err.message);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

export interface SyncResult {
  imported: number;
  scanned: number;
  available: boolean;
  comments: number;
  dms: number;
  reviews: number;
  note?: string;
}

/** Suit la pagination Graph (champ paging.next) jusqu'à `maxPages`. */
async function gpaged(
  startPath: string,
  token: string,
  maxPages = 5,
  errs?: string[]
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let page = await gget(startPath, token, errs);
  let guard = 0;
  while (page && guard < maxPages) {
    const data = (page.data as Array<Record<string, unknown>>) ?? [];
    out.push(...data);
    const next = (page.paging as { next?: string })?.next;
    if (!next || data.length === 0) break;
    guard++;
    try {
      const res = await fetch(next, { cache: "no-store" });
      page = (await res.json()) as Record<string, unknown>;
      if ((page as { error?: unknown }).error) break;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Épuise un edge IMBRIQUÉ (ex. les commentaires d'un post, les messages d'une
 * conversation) en suivant son propre paging.next. Sans cela, seule la première
 * page (25–50 éléments) de chaque fil était importée.
 */
async function drainEdge(
  edge: GraphEdge | undefined,
  maxPages = 3,
  errs?: string[]
): Promise<Array<Record<string, unknown>>> {
  const out = [...(edge?.data ?? [])];
  let next = edge?.paging?.next;
  let guard = 0;
  while (next && guard < maxPages) {
    guard++;
    try {
      const res = await fetch(next, { cache: "no-store" });
      const j = (await res.json()) as GraphEdge & { error?: { message?: string } };
      if (j.error) {
        if (j.error.message) errs?.push(j.error.message);
        break;
      }
      out.push(...(j.data ?? []));
      next = j.paging?.next;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Normalise un horodatage Graph en ISO 8601 : Meta renvoie selon les endpoints
 * un ISO avec offset compact ("2026-07-01T10:00:00+0000"), des secondes Unix
 * (webhooks feed) ou des millisecondes (webhooks messaging).
 */
export function graphTimeToIso(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    const d = new Date(v > 1e12 ? v : v * 1000);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Résumé lisible des erreurs Graph rencontrées (dédupliquées). */
function buildNote(errs: string[]): string | undefined {
  if (errs.length === 0) return undefined;
  const uniq = [...new Set(errs)].slice(0, 2).join(" · ");
  return `Certains contenus n'ont pas pu être lus (${uniq}). Si les permissions ont changé, reconnectez votre Page Meta depuis Comptes.`;
}

/**
 * Permissions nécessaires à la messagerie. Sans certaines d'entre elles
 * (ex. pages_read_user_content), Meta ne renvoie PAS d'erreur : il masque
 * silencieusement les contenus des visiteurs — d'où des messages « manquants »
 * inexplicables. On vérifie donc ce que le token accorde réellement.
 */
const REQUIRED_PERMS = [
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_engagement",
  "pages_messaging",
  "instagram_manage_comments",
  "instagram_manage_messages",
] as const;

async function missingPermissions(userToken: string | undefined, errs: string[]): Promise<string[]> {
  if (!userToken) return [];
  const res = await gget("me/permissions?limit=100", userToken, errs);
  const rows = (res?.data as Array<{ permission?: string; status?: string }>) ?? [];
  if (rows.length === 0) return [];
  const granted = new Set(rows.filter((r) => r.status === "granted").map((r) => String(r.permission)));
  return REQUIRED_PERMS.filter((p) => !granted.has(p));
}

/**
 * Importe TOUS les messages récupérables — comme la boîte de réception
 * Meta Business Suite : commentaires FB (posts de la Page ET des visiteurs,
 * réponses en fil incluses), commentaires IG (+ réponses), messages privés
 * Messenger + IG DM, et avis/recommandations de la Page.
 * Idempotent (externalId unique).
 */
export async function syncMetaComments(companyId: string): Promise<SyncResult> {
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) {
    return { imported: 0, scanned: 0, comments: 0, dms: 0, reviews: 0, available: false, note: "Page Meta non connectée." };
  }

  let comments = 0;
  let dms = 0;
  let reviews = 0;
  let scanned = 0;
  const errs: string[] = [];

  // Expansion commune des commentaires FB.
  // filter(stream) : tous les commentaires À PLAT, réponses en fil incluses.
  // order(reverse_chronological) : les PLUS RÉCENTS d'abord — sinon stream sert
  // les plus anciens en premier et les derniers commentaires restent au-delà
  // des pages parcourues.
  const FB_COMMENTS =
    "comments.filter(stream).order(reverse_chronological).limit(50){id,from,message,created_time}";

  // ── Facebook : publications → commentaires ──────────────────────────────────
  // edge "feed" : posts de la Page ET des VISITEURS. edge "ads_posts" : posts
  // publicitaires (y compris dark posts, absents du feed) — c'est là que
  // tombent la plupart des commentaires récents quand des pubs tournent.
  async function fbPostComments(edge: "feed" | "ads_posts"): Promise<void> {
    const posts = await gpaged(
      `${ctx.pageId}/${edge}?fields=permalink_url,${FB_COMMENTS}&limit=25`,
      token!,
      4,
      errs
    );
    for (const post of posts) {
      const permalink = post.permalink_url ? String(post.permalink_url) : undefined;
      const comments_ = await drainEdge(post.comments as GraphEdge | undefined, 3, errs);
      for (const c of comments_) {
        scanned++;
        const from = c.from as { name?: string; id?: string } | undefined;
        // On ignore les commentaires écrits par la Page elle-même.
        if (from?.id && from.id === ctx.pageId) continue;
        const inserted = await ingestMessage(companyId, {
          channel: "facebook",
          externalId: String(c.id ?? ""),
          kind: "comment",
          text: String(c.message ?? ""),
          authorName: from?.name ?? "Utilisateur Facebook",
          authorHandle: from?.id ? String(from.id) : undefined,
          permalink,
          receivedAt: graphTimeToIso(c.created_time),
          raw: c as Record<string, unknown>,
        });
        if (inserted) comments++;
      }
    }
  }

  // ── Messenger : conversations privées (fils paginés) ────────────────────────
  async function messengerDms(): Promise<void> {
    const convos = await gpaged(
      `${ctx.pageId}/conversations?fields=updated_time,messages.limit(25){id,message,from,created_time}&limit=50`,
      token!,
      3,
      errs
    );
    for (const conv of convos) {
      const msgs = await drainEdge(conv.messages as GraphEdge | undefined, 3, errs);
      for (const m of msgs) {
        const from = m.from as { name?: string; id?: string; email?: string } | undefined;
        // On ignore les messages envoyés par la Page elle-même.
        if (from?.id && ctx.pageId && from.id === ctx.pageId) continue;
        const text = String(m.message ?? "");
        if (!text) continue;
        scanned++;
        const inserted = await ingestMessage(companyId, {
          channel: "facebook",
          externalId: String(m.id ?? ""),
          kind: "dm",
          text,
          authorName: from?.name ?? "Messenger",
          authorHandle: from?.id ? String(from.id) : undefined,
          receivedAt: graphTimeToIso(m.created_time),
          raw: m as Record<string, unknown>,
        });
        if (inserted) dms++;
      }
    }
  }

  // ── Avis / recommandations de la Page ────────────────────────────────────────
  // Visibles dans Meta Business Suite ; externalId = open_graph_story pour
  // pouvoir y répondre publiquement (POST /{story-id}/comments).
  async function pageRatings(): Promise<void> {
    const ratings = await gpaged(
      `${ctx.pageId}/ratings?fields=review_text,created_time,recommendation_type,reviewer{id,name},open_graph_story{id}&limit=50`,
      token!,
      2,
      errs
    );
    for (const r of ratings) {
      const text = String(r.review_text ?? "");
      if (!text) continue; // note sans texte : rien à traiter
      scanned++;
      const reviewer = r.reviewer as { id?: string; name?: string } | undefined;
      const story = (r.open_graph_story as { id?: string } | undefined)?.id;
      const inserted = await ingestMessage(companyId, {
        channel: "facebook",
        externalId: story ?? `review-${reviewer?.id ?? "anon"}-${String(r.created_time ?? "")}`,
        kind: "review",
        text,
        authorName: reviewer?.name ?? "Avis Facebook",
        authorHandle: reviewer?.id ? String(reviewer.id) : undefined,
        receivedAt: graphTimeToIso(r.created_time),
        raw: r as Record<string, unknown>,
      });
      if (inserted) reviews++;
    }
  }

  // ── Instagram : médias → commentaires + réponses en fil ─────────────────────
  async function igComments(): Promise<void> {
    const media = await gpaged(
      `${ctx.igId}/media?fields=permalink,comments.limit(50){id,text,timestamp,username,replies.limit(25){id,text,timestamp,username}}&limit=25`,
      token!,
      4,
      errs
    );
    for (const m of media) {
      const permalink = m.permalink ? String(m.permalink) : undefined;
      const top = await drainEdge(m.comments as GraphEdge | undefined, 3, errs);
      // Aplati : commentaires de premier niveau + leurs réponses en fil.
      const all: Array<Record<string, unknown>> = [];
      for (const c of top) {
        all.push(c);
        all.push(...(((c.replies as GraphEdge | undefined)?.data) ?? []));
      }
      for (const c of all) {
        scanned++;
        const username = c.username ? String(c.username) : undefined;
        const inserted = await ingestMessage(companyId, {
          channel: "instagram",
          externalId: String(c.id ?? ""),
          kind: "comment",
          text: String(c.text ?? ""),
          authorName: username ? `@${username}` : "Utilisateur Instagram",
          authorHandle: username,
          permalink,
          receivedAt: graphTimeToIso(c.timestamp),
          raw: c as Record<string, unknown>,
        });
        if (inserted) comments++;
      }
    }
  }

  // ── Instagram DM : conversations privées (via la Page, platform=instagram) ──
  async function igDms(): Promise<void> {
    const igConvos = await gpaged(
      `${ctx.pageId}/conversations?platform=instagram&fields=updated_time,messages.limit(25){id,message,from,created_time}&limit=50`,
      token!,
      3,
      errs
    );
    for (const conv of igConvos) {
      const msgs = await drainEdge(conv.messages as GraphEdge | undefined, 3, errs);
      for (const m of msgs) {
        const from = m.from as { username?: string; id?: string } | undefined;
        if (from?.id && ctx.igId && from.id === ctx.igId) continue;
        const text = String(m.message ?? "");
        if (!text) continue;
        scanned++;
        const inserted = await ingestMessage(companyId, {
          channel: "instagram",
          externalId: String(m.id ?? ""),
          kind: "dm",
          text,
          authorName: from?.username ? `@${from.username}` : "DM Instagram",
          // IMPORTANT : l'ID (IGSID) — c'est lui que la Send API accepte comme
          // destinataire. Le username ne permet PAS de répondre.
          authorHandle: from?.id ? String(from.id) : undefined,
          receivedAt: graphTimeToIso(m.created_time),
          raw: m as Record<string, unknown>,
        });
        if (inserted) dms++;
      }
    }
  }

  // Sections lancées EN PARALLÈLE : la route serverless est bornée à 60 s, en
  // séquentiel une grosse Page dépassait le délai et perdait la fin de l'import.
  const jobs: Array<Promise<void>> = [];
  if (ctx.pageId) jobs.push(fbPostComments("feed"), fbPostComments("ads_posts"), messengerDms(), pageRatings());
  if (ctx.igId) jobs.push(igComments());
  if (ctx.igId && ctx.pageId) jobs.push(igDms());
  const [missing] = await Promise.all([missingPermissions(ctx.userToken, errs), ...jobs]);

  // Diagnostic prioritaire : des permissions absentes du token = contenus
  // masqués EN SILENCE par Meta (aucune erreur). On le dit explicitement.
  let note = buildNote(errs);
  if (missing.length > 0) {
    note =
      `Permissions Meta manquantes sur le token actuel : ${missing.join(", ")}. ` +
      `Reconnectez votre Page Meta (Comptes → Facebook) pour les accorder — sans elles, ` +
      `Meta masque une partie des messages sans renvoyer d'erreur.` +
      (note ? ` ${note}` : "");
  }
  console.warn("[inbox/sync]", JSON.stringify({ companyId, comments, dms, reviews, scanned, missing, errs: [...new Set(errs)].slice(0, 5) }));

  return {
    imported: comments + dms + reviews,
    scanned,
    comments,
    dms,
    reviews,
    available: true,
    note,
  };
}

export interface DeliverResult {
  delivered: boolean;
  error?: string;
}

/** Cible d'envoi : un commentaire (réponse publique) ou un DM (réponse privée). */
export interface DeliverTarget {
  channel: InboxChannel;
  kind: "comment" | "dm" | "mention" | "review";
  externalId?: string;
  /** Pour un DM : l'identifiant de l'expéditeur (PSID Messenger / IGSID). */
  authorHandle?: string;
  /**
   * "private" sur un commentaire : bascule la réponse en MESSAGE PRIVÉ à son
   * auteur (Private Replies de la Send API — une seule réponse privée par
   * commentaire, fenêtre de 7 jours côté Meta). Défaut : réponse publique.
   */
  visibility?: "public" | "private";
}

async function metaPost(path: string, params: Record<string, string>): Promise<DeliverResult> {
  try {
    const res = await fetch(`https://graph.facebook.com/${V}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const json = (await res.json()) as { id?: string; message_id?: string; error?: { message?: string } };
    if (json.error) return { delivered: false, error: json.error.message ?? "Erreur Meta." };
    return { delivered: Boolean(json.id || json.message_id) };
  } catch (e) {
    return { delivered: false, error: e instanceof Error ? e.message : "Échec réseau." };
  }
}

/**
 * Envoie une réponse vers la plateforme.
 * - Commentaire FB / avis FB : POST /{comment-or-story-id}/comments
 * - Commentaire IG           : POST /{ig-comment-id}/replies
 * - DM Messenger + DM IG     : POST /{page-id}/messages (Send API — les DM
 *   Instagram passent aussi par le nœud de la PAGE avec le token de Page ;
 *   fenêtre de réponse 24 h côté Meta)
 * Dégradation : si pas de token / cible manquante → delivered=false avec message.
 */
export async function deliverMetaReply(
  companyId: string,
  target: DeliverTarget,
  body: string
): Promise<DeliverResult> {
  const { channel, kind, externalId, authorHandle, visibility } = target;
  if (channel !== "facebook" && channel !== "instagram") {
    return { delivered: false, error: `Envoi automatique non géré pour ${channel}.` };
  }
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) return { delivered: false, error: "Page Meta non connectée." };

  // ── Bascule public → privé : réponse privée à un commentaire ──────────────
  // Private Replies : le destinataire est le COMMENTAIRE (recipient.comment_id),
  // Meta route le message vers son auteur en DM. Même nœud Page pour FB et IG.
  if (visibility === "private" && kind !== "dm") {
    if (!externalId) return { delivered: false, error: "Identifiant de commentaire manquant." };
    const senderNode = ctx.pageId ?? (channel === "instagram" ? ctx.igId : undefined);
    if (!senderNode) return { delivered: false, error: "Compte expéditeur introuvable." };
    return metaPost(`${senderNode}/messages`, {
      recipient: JSON.stringify({ comment_id: externalId }),
      message: JSON.stringify({ text: body }),
      access_token: token,
    });
  }

  // ── Messages privés (Send API) ─────────────────────────────────────────────
  if (kind === "dm") {
    if (!authorHandle) return { delivered: false, error: "Destinataire du message privé inconnu." };
    // Messenger ET Instagram : l'envoi se fait via le nœud de la PAGE liée
    // (token de Page). On garde l'ID IG en secours si la Page manque.
    const senderNode = ctx.pageId ?? (channel === "instagram" ? ctx.igId : undefined);
    if (!senderNode) return { delivered: false, error: "Compte expéditeur introuvable." };
    return metaPost(`${senderNode}/messages`, {
      recipient: JSON.stringify({ id: authorHandle }),
      message: JSON.stringify({ text: body }),
      messaging_type: "RESPONSE",
      access_token: token,
    });
  }

  // ── Commentaires, avis, mentions (réponse publique) ────────────────────────
  if (!externalId) return { delivered: false, error: "Identifiant de message manquant." };
  const path = channel === "instagram" ? `${externalId}/replies` : `${externalId}/comments`;
  return metaPost(path, { message: body, access_token: token });
}
