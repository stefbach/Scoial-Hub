// Format normalisé de la bibliothèque d'assets — mission bibliothèque et
// galerie de modèles, chapitre 6.2.
//
// Tout fournisseur produit le MÊME objet. L'interface (et le reste du code)
// ignore de quel fournisseur vient un média : ça n'est jamais visible côté
// client, seulement dans ce champ serveur.

export type AssetKind = "image" | "video" | "audio";

export type ProviderId = "pexels" | "coverr" | "pixabay" | "unsplash" | "internal";

export interface AssetResult {
  provider: ProviderId;
  /** Identifiant chez le fournisseur — clé de déduplication. */
  providerId: string;
  kind: AssetKind;
  /** Vignette, affichage seul. */
  previewUrl: string;
  /** Fichier à acquérir. */
  sourceUrl: string;
  width?: number;
  height?: number;
  durationSec?: number;
  /** Alimente decideRenderTarget() une fois le média inséré dans un montage. */
  bytes?: number;
  /** Requis si le fournisseur impose une attribution. */
  author?: string;
  authorUrl?: string;
  /** Identifiant de licence, jamais vide. */
  license: string;
  attributionRequired: boolean;
  /** Point de suivi à appeler à l'acquisition (Unsplash). */
  downloadTrackUrl?: string;
}

/**
 * Provenance écrite dans le document de projet à l'INSERTION, jamais après
 * (règle 4 — cette information n'est pas récupérable plus tard).
 */
export interface AssetProvenance {
  provider: ProviderId;
  providerId: string;
  author?: string;
  authorUrl?: string;
  license: string;
  sourceUrl: string;
}

/**
 * Politique d'acquisition — propre à chaque fournisseur (règle 3). Les règles
 * sont contradictoires d'un fournisseur à l'autre : aucune valeur par défaut
 * implicite, chaque fournisseur déclare la sienne explicitement.
 */
export interface ProviderPolicy {
  /** Rapatrier le fichier sur notre stockage à l'acquisition. */
  rehost: boolean;
  /** Appeler un point de suivi de téléchargement à l'acquisition. */
  track: boolean;
  /** Mention d'attribution à afficher partout où le média apparaît. */
  attributionRequired: boolean;
}

export const PROVIDER_POLICY: Record<Exclude<ProviderId, "internal">, ProviderPolicy> = {
  // Pexels : rehébergement libre, lien vers Pexels exigé par leurs règles d'usage.
  pexels: { rehost: true, track: false, attributionRequired: true },
  // Coverr : libre, aucune attribution exigée.
  coverr: { rehost: true, track: false, attributionRequired: false },
  // Pixabay : lien direct permanent INTERDIT — téléchargement obligatoire.
  pixabay: { rehost: true, track: false, attributionRequired: false },
  // Unsplash : lien direct attendu, mais suivi de téléchargement OBLIGATOIRE
  // à chaque usage effectif, et attribution photographe + Unsplash exigée.
  unsplash: { rehost: true, track: true, attributionRequired: true },
};

export interface AssetSearchQuery {
  query: string;
  kinds: AssetKind[];
  /** Page 1-indexée, pour le défilement de résultats. */
  page?: number;
}
