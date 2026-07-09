import type { Campaign } from "@/lib/types";

// Prédicat UNIQUE « campagne active » — partagé par le tableau de bord
// (lib/repositories/company-data.ts) et la page Campagnes.
//
// UAT #13 : le dashboard comptait `status === "active"` alors que la page
// Campagnes affiche le badge « Actif » d'après `enabled` (le toggle de
// diffusion). Les deux champs dérivent (ex. campagne créée `enabled: true`
// avec `status: "paused"`), d'où deux comptes différents pour la même donnée.
// La vérité côté utilisateur est le toggle de diffusion : ON = active.
export function isCampaignActive(c: Pick<Campaign, "status" | "enabled">): boolean {
  return c.enabled;
}
