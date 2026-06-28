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

import type { SocialConnector, ConnectorStatus, ConnectorPlatform } from "@/lib/connectors/types";
import { facebookConnector, instagramConnector } from "@/lib/connectors/meta";
import { linkedinConnector } from "@/lib/connectors/linkedin";
import { twitterConnector } from "@/lib/connectors/providers/twitter";
import { pinterestConnector } from "@/lib/connectors/providers/pinterest";
import { threadsConnector } from "@/lib/connectors/providers/threads";
import { tiktokConnector } from "@/lib/connectors/providers/tiktok";

// ---------------------------------------------------------------------------
// Registre
// ---------------------------------------------------------------------------
//
// Source unique de vérité. Ajouter un réseau social = ajouter UNE entrée ici
// (les nouveaux réseaux OAuth 2.0 standards sont eux-mêmes de simples objets de
// config, cf. lib/connectors/providers/*). Aucune route ni aucun branchement à
// modifier ailleurs : les routes /api/connectors/[platform]/* sont génériques.

const CONNECTORS: readonly SocialConnector[] = [
  facebookConnector,
  instagramConnector,
  linkedinConnector,
  tiktokConnector,
  twitterConnector,
  pinterestConnector,
  threadsConnector,
];

/** Map interne plateforme → instance connecteur (dérivée de CONNECTORS). */
const REGISTRY = new Map<ConnectorPlatform, SocialConnector>(
  CONNECTORS.map((c) => [c.platform, c])
);

/** Liste ordonnée des plateformes gérées par un connecteur. */
export const SUPPORTED_PLATFORMS: ConnectorPlatform[] = CONNECTORS.map((c) => c.platform);

/** Vrai si une plateforme dispose d'un connecteur enregistré. */
export function isSupportedPlatform(value: string): value is ConnectorPlatform {
  return REGISTRY.has(value as ConnectorPlatform);
}

/**
 * Retourne le connecteur correspondant à la plateforme donnée.
 * Lance une erreur si la plateforme n'est pas reconnue.
 */
export function getConnector(platform: ConnectorPlatform): SocialConnector {
  const connector = REGISTRY.get(platform);
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
  type AccountRow = {
    id: string;
    accountName: string;
    externalId?: string;
    status: "active" | "expired" | "revoked";
  };

  // Une liste par plateforme enregistrée (pas de liste codée en dur).
  const accountsByPlatform = new Map<ConnectorPlatform, AccountRow[]>(
    SUPPORTED_PLATFORMS.map((p) => [p, []])
  );

  try {
    // Import dynamique pour éviter un import circulaire et ne pas forcer
    // la présence de Supabase au chargement du module.
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createAdminClient();

    if (supabase) {
      const { data, error } = await supabase
        .from("sh_social_accounts")
        .select("id, company_id, platform, account_name, status, external_id")
        .in("status", ["active", "expired", "revoked"]);

      if (!error && data) {
        for (const row of data) {
          const platform = row.platform as ConnectorPlatform;
          const bucket = accountsByPlatform.get(platform);
          if (bucket) {
            bucket.push({
              id: row.id as string,
              accountName: (row.account_name as string) ?? "",
              externalId: (row.external_id as string) ?? undefined,
              status: row.status as "active" | "expired" | "revoked",
            });
          }
        }
      }
    }
  } catch {
    // Supabase non disponible ou erreur réseau → on continue avec des listes vides.
  }

  return CONNECTORS.map((connector) => {
    const accounts = accountsByPlatform.get(connector.platform) ?? [];
    return {
      platform: connector.platform,
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
export { makeOAuth2Connector } from "@/lib/connectors/provider-spec";
export type { OAuth2ProviderSpec } from "@/lib/connectors/provider-spec";
export type { SocialConnector, ConnectorStatus, ConnectorPlatform } from "@/lib/connectors/types";
