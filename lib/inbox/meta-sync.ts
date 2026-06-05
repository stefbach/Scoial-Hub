// Synchronisation des messages Meta (commentaires Facebook + Instagram) vers la
// messagerie, et envoi des réponses vers la plateforme.
// Utilise le token de PAGE stocké pour la société (cf. meta-pages.getMetaContext).

import { getMetaContext } from "@/lib/connectors/meta-pages";
import { ingestMessage } from "@/lib/repositories/inbox";
import type { InboxChannel } from "@/lib/inbox/types";

const V = process.env.META_API_VERSION ?? "v21.0";

async function gget(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const j = (await res.json()) as Record<string, unknown>;
    if (j && (j as { error?: unknown }).error) return null;
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
  note?: string;
}

/** Suit la pagination Graph (champ paging.next) jusqu'à `maxPages`. */
async function gpaged(
  startPath: string,
  token: string,
  maxPages = 5
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let page = await gget(startPath, token);
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
 * Importe TOUS les messages récupérables (commentaires FB + IG ET messages privés
 * Messenger + IG DM) en messages « pending ». Idempotent (externalId unique).
 */
export async function syncMetaComments(companyId: string): Promise<SyncResult> {
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) {
    return { imported: 0, scanned: 0, comments: 0, dms: 0, available: false, note: "Page Meta non connectée." };
  }

  let comments = 0;
  let dms = 0;
  let scanned = 0;

  // ── Facebook : posts → commentaires (paginés) ──────────────────────────────
  if (ctx.pageId) {
    const posts = await gpaged(
      `${ctx.pageId}/posts?fields=permalink_url,comments.limit(50){id,from,message,created_time}&limit=25`,
      token,
      4
    );
    for (const post of posts) {
      const permalink = post.permalink_url ? String(post.permalink_url) : undefined;
      const comments_ = (post.comments as { data?: Array<Record<string, unknown>> })?.data ?? [];
      for (const c of comments_) {
        scanned++;
        const from = c.from as { name?: string; id?: string } | undefined;
        const inserted = await ingestMessage(companyId, {
          channel: "facebook",
          externalId: String(c.id ?? ""),
          kind: "comment",
          text: String(c.message ?? ""),
          authorName: from?.name ?? "Utilisateur Facebook",
          authorHandle: from?.id ? String(from.id) : undefined,
          permalink,
          raw: c as Record<string, unknown>,
        });
        if (inserted) comments++;
      }
    }

    // ── Messenger : conversations privées ────────────────────────────────────
    const convos = await gpaged(
      `${ctx.pageId}/conversations?fields=updated_time,messages.limit(25){id,message,from,created_time}&limit=50`,
      token,
      3
    );
    for (const conv of convos) {
      const msgs = (conv.messages as { data?: Array<Record<string, unknown>> })?.data ?? [];
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
          raw: m as Record<string, unknown>,
        });
        if (inserted) dms++;
      }
    }
  }

  // ── Instagram : médias → commentaires (paginés) ────────────────────────────
  if (ctx.igId) {
    const media = await gpaged(
      `${ctx.igId}/media?fields=permalink,comments.limit(50){id,text,timestamp,username}&limit=25`,
      token,
      4
    );
    for (const m of media) {
      const permalink = m.permalink ? String(m.permalink) : undefined;
      const comments_ = (m.comments as { data?: Array<Record<string, unknown>> })?.data ?? [];
      for (const c of comments_) {
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
          raw: c as Record<string, unknown>,
        });
        if (inserted) comments++;
      }
    }

    // ── Instagram DM : conversations privées (via la Page, platform=instagram) ─
    if (ctx.pageId) {
      const igConvos = await gpaged(
        `${ctx.pageId}/conversations?platform=instagram&fields=updated_time,messages.limit(25){id,message,from,created_time}&limit=50`,
        token,
        3
      );
      for (const conv of igConvos) {
        const msgs = (conv.messages as { data?: Array<Record<string, unknown>> })?.data ?? [];
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
            authorHandle: from?.username ?? from?.id,
            raw: m as Record<string, unknown>,
          });
          if (inserted) dms++;
        }
      }
    }
  }

  return { imported: comments + dms, scanned, comments, dms, available: true };
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
  /** Pour un DM : l'identifiant de l'expéditeur (PSID Messenger / id IG). */
  authorHandle?: string;
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
 * - Commentaire FB : POST /{comment-id}/comments
 * - Commentaire IG : POST /{ig-comment-id}/replies
 * - DM Messenger   : POST /{page-id}/messages (Send API, fenêtre 24 h)
 * - DM Instagram   : POST /{ig-id}/messages
 * Dégradation : si pas de token / cible manquante → delivered=false avec message.
 */
export async function deliverMetaReply(
  companyId: string,
  target: DeliverTarget,
  body: string
): Promise<DeliverResult> {
  const { channel, kind, externalId, authorHandle } = target;
  if (channel !== "facebook" && channel !== "instagram") {
    return { delivered: false, error: `Envoi automatique non géré pour ${channel}.` };
  }
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) return { delivered: false, error: "Page Meta non connectée." };

  // ── Messages privés (Send API) ─────────────────────────────────────────────
  if (kind === "dm") {
    if (!authorHandle) return { delivered: false, error: "Destinataire du message privé inconnu." };
    const senderNode = channel === "instagram" ? ctx.igId : ctx.pageId;
    if (!senderNode) return { delivered: false, error: "Compte expéditeur introuvable." };
    return metaPost(`${senderNode}/messages`, {
      recipient: JSON.stringify({ id: authorHandle }),
      message: JSON.stringify({ text: body }),
      messaging_type: "RESPONSE",
      access_token: token,
    });
  }

  // ── Commentaires (réponse publique) ────────────────────────────────────────
  if (!externalId) return { delivered: false, error: "Identifiant de message manquant." };
  const path = channel === "instagram" ? `${externalId}/replies` : `${externalId}/comments`;
  return metaPost(path, { message: body, access_token: token });
}
