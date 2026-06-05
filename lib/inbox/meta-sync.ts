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
  note?: string;
}

/** Importe les commentaires récents (FB + IG) en messages « pending ». */
export async function syncMetaComments(companyId: string): Promise<SyncResult> {
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) {
    return { imported: 0, scanned: 0, available: false, note: "Page Meta non connectée." };
  }

  let imported = 0;
  let scanned = 0;

  // ── Facebook : posts récents → commentaires ────────────────────────────────
  if (ctx.pageId) {
    const posts = await gget(
      `${ctx.pageId}/posts?fields=permalink_url,comments.limit(15){id,from,message,created_time}&limit=10`,
      token
    );
    for (const post of ((posts?.data as Array<Record<string, unknown>>) ?? [])) {
      const permalink = post.permalink_url ? String(post.permalink_url) : undefined;
      const comments = (post.comments as { data?: Array<Record<string, unknown>> })?.data ?? [];
      for (const c of comments) {
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
        if (inserted) imported++;
      }
    }
  }

  // ── Instagram : médias récents → commentaires ──────────────────────────────
  if (ctx.igId) {
    const media = await gget(
      `${ctx.igId}/media?fields=permalink,comments.limit(15){id,text,timestamp,username}&limit=10`,
      token
    );
    for (const m of ((media?.data as Array<Record<string, unknown>>) ?? [])) {
      const permalink = m.permalink ? String(m.permalink) : undefined;
      const comments = (m.comments as { data?: Array<Record<string, unknown>> })?.data ?? [];
      for (const c of comments) {
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
        if (inserted) imported++;
      }
    }
  }

  return { imported, scanned, available: true };
}

export interface DeliverResult {
  delivered: boolean;
  error?: string;
}

/**
 * Envoie une réponse vers la plateforme.
 * - Facebook : POST /{comment-id}/comments
 * - Instagram : POST /{ig-comment-id}/replies
 * Dégradation : si pas de token / canal non géré → renvoie delivered=false.
 */
export async function deliverMetaReply(
  companyId: string,
  channel: InboxChannel,
  externalId: string | undefined,
  body: string
): Promise<DeliverResult> {
  if (!externalId) return { delivered: false, error: "Identifiant de message manquant." };
  const ctx = await getMetaContext(companyId);
  const token = ctx.pageToken;
  if (!token) return { delivered: false, error: "Page Meta non connectée." };

  const path =
    channel === "instagram" ? `${externalId}/replies` : `${externalId}/comments`;
  if (channel !== "facebook" && channel !== "instagram") {
    return { delivered: false, error: `Envoi automatique non géré pour ${channel}.` };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${V}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message: body, access_token: token }).toString(),
    });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (json.error) return { delivered: false, error: json.error.message ?? "Erreur Meta." };
    return { delivered: Boolean(json.id) };
  } catch (e) {
    return { delivered: false, error: e instanceof Error ? e.message : "Échec réseau." };
  }
}
