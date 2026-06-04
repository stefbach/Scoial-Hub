// Sélection de la Page Facebook (et du compte Instagram Business lié) après OAuth.
// Le token renvoyé par l'OAuth est un token UTILISATEUR : pour publier il faut
// le token de PAGE + l'ID de Page (et l'ID du compte IG Business lié). On liste
// les Pages de l'utilisateur, on choisit celle qui correspond à la société, et
// on enregistre les bons identifiants dans sh_channel_connections.

const V = process.env.META_API_VERSION ?? "v21.0";

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;      // token de PAGE (publication)
  igId?: string;            // Instagram Business Account lié
  igUsername?: string;
}

/** Liste les Pages gérées par l'utilisateur (avec token de page + IG lié). */
export async function fetchMetaPages(userToken: string): Promise<MetaPage[]> {
  const url =
    `https://graph.facebook.com/${V}/me/accounts` +
    `?fields=id,name,access_token,instagram_business_account{id,username}` +
    `&limit=100&access_token=${encodeURIComponent(userToken)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    if (!Array.isArray(json.data)) return [];
    return json.data.map((p) => {
      const ig = p.instagram_business_account as { id?: string; username?: string } | undefined;
      return {
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        accessToken: String(p.access_token ?? ""),
        igId: ig?.id ? String(ig.id) : undefined,
        igUsername: ig?.username ? String(ig.username) : undefined,
      };
    });
  } catch {
    return [];
  }
}

/** Choisit la Page la plus proche du nom de la société (exact → inclus → 1ère). */
export function pickPageForCompany(pages: MetaPage[], companyName: string): MetaPage | null {
  if (pages.length === 0) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cn = norm(companyName);
  if (cn) {
    const exact = pages.find((p) => norm(p.name) === cn);
    if (exact) return exact;
    const partial = pages.find((p) => {
      const pn = norm(p.name);
      return pn && (pn.includes(cn) || cn.includes(pn));
    });
    if (partial) return partial;
  }
  return pages[0];
}

/** Récupère le nom de la société (pour le matching de Page). */
export async function getCompanyName(companyUuid: string): Promise<string> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const sb = createAdminClient();
    if (!sb) return "";
    const { data } = await sb
      .from("sh_companies")
      .select("name")
      .eq("id", companyUuid)
      .maybeSingle();
    return data?.name ? String(data.name) : "";
  } catch {
    return "";
  }
}

/**
 * Enregistre les connexions Facebook + Instagram à partir de la Page choisie.
 * Un seul OAuth connecte donc les deux réseaux (ils partagent la Page + le token).
 */
export async function storeMetaConnections(
  companyId: string,
  page: MetaPage
): Promise<void> {
  const { upsertConnection } = await import("@/lib/repositories/channel-connections");
  const { resolveCompanyUuid } = await import("@/lib/repositories/resolve-company");
  const uuid = await resolveCompanyUuid(companyId);

  const pagesMeta = JSON.stringify({ id: page.id, name: page.name });

  // Facebook : id de Page + token de Page
  await upsertConnection(
    uuid,
    "facebook",
    {
      page_id: page.id,
      page_access_token: page.accessToken,
      account_name: page.name,
      connected_via: "oauth",
      selected_page: pagesMeta,
    },
    "connected"
  );

  // Instagram : seulement si un compte IG Business est lié à la Page
  if (page.igId) {
    await upsertConnection(
      uuid,
      "instagram",
      {
        ig_business_account_id: page.igId,
        page_access_token: page.accessToken,
        account_name: page.igUsername ? `@${page.igUsername}` : page.name,
        connected_via: "oauth",
        selected_page: pagesMeta,
      },
      "connected"
    );
  }
}
