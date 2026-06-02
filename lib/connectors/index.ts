/**
 * lib/connectors/index.ts
 *
 * Registre central des connecteurs de plateformes sociales.
 *
 * Expose :
 *   - `getConnector(platform)` → connecteur typé pour la plateforme demandée
 *   - `listConnectorStatus()` → statut de configuration et comptes connectés
 *     pour toutes les plateformes (lit social_accounts si Supabase est dispo).
 *
 * Aucun appel réseau au chargement du module.
 */

import type { Platform } from "@/lib/types";
import type { SocialConnector, ConnectorStatus } from "@/lib/connectors/types";
import { facebookConnector, instagramConnector } from "@/lib/connectors/meta";
import { linkedinConnector } from "@/lib/connectors/linkedin";

// ---------------------------------------------------------------------------
// Registre
// ---------------------------------------------------------------------------

/** Map interne plateforme → instance connecteur. */
const REGISTRY: Record<Platform, SocialConnector> = {
  facebook: facebookConnector,
  instagram: instagramConnector,
  linkedin: linkedinConnector,
};

/**
 * Retourne le connecteur correspondant à la plateforme donnée.
 * Lance une erreur si la plateforme n'est pas reconnue (ne devrait pas
 * arriver en pratique grâce au typage strict de `Platform`).
 */
export function getConnector(platform: Platform): SocialConnector {
  const connector = REGISTRY[platform];
  if (!connector) {
    throw new Error(`Connecteur inconnu pour la plateforme : ${platform}`);
  }
  return connector;
}

// ---------------------------------------------------------------------------
// Statut des connecteurs
// ---------------------------------------------------------------------------

/**
 * Retourne le statut de configuration et de connexion de chaque plateforme.
 *
 * Si Supabase est disponible, enrichit les résultats avec les comptes actifs
 * de la table `social_hub.social_accounts`. En mode dégradé (pas de Supabase),
 * retourne connectedAccounts = 0 et accounts = [].
 */
export async function listConnectorStatus(): Promise<ConnectorStatus[]> {
  // Import dynamique pour éviter un import circulaire et ne pas forcer
  // la présence de Supabase au chargement du module.
  let accountsByPlatform: Record<
    Platform,
    { id: string; accountName: string; externalId?: string; status: "active" | "expired" | "revoked" }[]
  > = {
    facebook: [],
    instagram: [],
    linkedin: [],
  };

  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createAdminClient();

    if (supabase) {
      const { data, error } = await supabase
        .from("sh_social_accounts")
        .select("id, company_id, platform, account_name, status, external_id")
        .in("status", ["active", "expired", "revoked"]);

      if (!error && data) {
        for (const row of data) {
          const platform = row.platform as Platform;
          if (platform in accountsByPlatform) {
            accountsByPlatform[platform].push({
              id: row.id as string,
              accountName: (row.account_name as string) ?? "",
              externalId: (row.external_id as string) ?? undefined,
              status: (row.status as "active" | "expired" | "revoked"),
            });
          }
        }
      }
    }
  } catch {
    // Supabase non disponible ou erreur réseau → on continue avec des listes vides.
  }

  const platforms: Platform[] = ["facebook", "instagram", "linkedin"];

  return platforms.map((platform) => {
    const connector = REGISTRY[platform];
    const accounts = accountsByPlatform[platform];

    return {
      platform,
      configured: connector.isConfigured(),
      connectedAccounts: accounts.filter((a) => a.status === "active").length,
      accounts,
    };
  });
}

// ---------------------------------------------------------------------------
// Re-exports pratiques
// ---------------------------------------------------------------------------

export { facebookConnector, instagramConnector } from "@/lib/connectors/meta";
export { linkedinConnector } from "@/lib/connectors/linkedin";
export type { SocialConnector, ConnectorStatus } from "@/lib/connectors/types";
