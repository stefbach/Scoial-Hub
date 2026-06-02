import { COMPANY_DATA } from "./mock-data";
import type { MetaConnection } from "./types";
import type { ConnectorStatus } from "./connectors/types";

export function getMeta(companyId: string): MetaConnection | undefined {
  return COMPANY_DATA[companyId]?.meta;
}

export function setMeta(companyId: string, patch: Partial<MetaConnection>) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.meta = { ...(data.meta ?? { connected: false, readOnly: true, keepReadOnlyAfterSafety: false }), ...patch };
}

export function disconnectMeta(companyId: string) {
  setMeta(companyId, {
    connected: false,
    connectedAt: undefined,
    businessManagerName: undefined,
    facebookPageName: undefined,
    instagramHandle: undefined,
    readOnly: true,
    keepReadOnlyAfterSafety: false,
  });
}

// ---------------------------------------------------------------------------
// Fusion statut API + état local
// ---------------------------------------------------------------------------

/** Vue fusionnée d'une plateforme : statut API + données mock locales. */
export interface PlatformView {
  platform: "facebook" | "instagram" | "linkedin";
  /** Clés d'env présentes côté serveur. */
  configured: boolean;
  /** Nombre de comptes actifs en base. */
  connectedAccounts: number;
  /** Détail des comptes enregistrés. */
  accounts: ConnectorStatus["accounts"];
  /** Vrai si au moins un compte actif est présent. */
  hasActiveAccount: boolean;
}

/**
 * Fusionne la liste `ConnectorStatus[]` renvoyée par `GET /api/connectors`
 * avec l'état local éventuel (mock) pour produire des vues par plateforme.
 * Retourne `null` si `statuses` est null (chargement en cours).
 */
export function mergeConnectorStatus(
  statuses: ConnectorStatus[] | null
): PlatformView[] | null {
  if (!statuses) return null;

  return statuses.map((s) => ({
    platform: s.platform,
    configured: s.configured,
    connectedAccounts: s.connectedAccounts,
    accounts: s.accounts,
    hasActiveAccount: s.connectedAccounts > 0,
  }));
}
