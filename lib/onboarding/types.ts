// Contrats partagés du parcours de démarrage assisté (« Démarrage »).
// Ces types sont la source de vérité commune entre le backend (analyse IA,
// repository, routes API) et le frontend (assistant pas-à-pas). Ne pas diverger.

export type SocialNetwork = "instagram" | "facebook" | "tiktok" | "linkedin";

export const ALL_NETWORKS: SocialNetwork[] = ["instagram", "facebook", "tiktok", "linkedin"];

export interface BrandHandles {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  linkedin?: string;
}

/** Objectif marketing proposé par l'IA (étape 2). */
export interface SuggestedObjective {
  /** identifiant court stable : awareness | leads | sales | traffic | community | retention … */
  id: string;
  label: string;
  /** pourquoi cet objectif est pertinent pour CETTE marque (1 phrase). */
  why: string;
}

/**
 * Stratégie SPÉCIFIQUE à un réseau social. Chaque plateforme a ses codes :
 * le consultant adapte angle, formats, ton, piliers de contenu et rythme.
 */
export interface NetworkStrategy {
  network: SocialNetwork;
  /** angle/positionnement propre à ce réseau (1-2 phrases). */
  angle: string;
  /** formats recommandés (ex. Reels, carrousel, stories, vidéo native…). */
  formats: string[];
  /** ton adapté au réseau (ex. spontané/vertical vs expert/posé). */
  tone: string;
  /** 3-5 piliers de contenu propres au réseau. */
  contentPillars: string[];
  /** rythme de publication recommandé (ex. « 4-5×/sem »). */
  cadence: string;
  /** type d'appel à l'action privilégié sur ce réseau. */
  cta: string;
}

/**
 * Profil de marque produit par l'IA à partir du site + des comptes sociaux.
 * Persisté dans public.sh_brand_profiles (le profil complet est aussi stocké
 * dans la colonne `raw`, qui fait foi à la relecture).
 */
export interface BrandProfile {
  companyId: string;
  website: string;
  handles: BrandHandles;
  /** Descriptif libre de la société saisi par le client (nourrit l'analyse IA). */
  description: string;
  /** « Qui vous êtes » — synthèse en 2-3 phrases. */
  summary: string;
  positioning: string;
  tone: string;
  audience: string;
  themes: string[];
  strengths: string[];
  /** ── ADN de marque (Consultant IA) — la « philosophie » verrouillée ──── */
  /** Raison d'être de la marque (1-2 phrases). */
  mission: string;
  /** Valeurs fondatrices (3-5). */
  values: string[];
  /** LE message clé que le client veut faire passer. */
  keyMessage: string;
  /** Traits de personnalité de marque (ex. audacieuse, chaleureuse…). */
  personality: string[];
  /** Direction artistique : mots-clés visuels (style, lumière, matières…). */
  visualDirection: string;
  /** Stratégie distincte par réseau (Instagram/Facebook/TikTok/LinkedIn). */
  networkStrategies: NetworkStrategy[];
  /** Vrai quand l'identité/philosophie a été validée par le client. */
  philosophyLocked: boolean;
  /** mots-clés pour alimenter la veille (étape 3). */
  keywords: string[];
  /** réseaux recommandés par l'IA pour cette marque. */
  recommendedNetworks: SocialNetwork[];
  /** angles concurrentiels à exploiter (étape 3). */
  competitorAngles: string[];
  /** objectifs proposés (étape 2). */
  suggestedObjectives: SuggestedObjective[];
  /** true si produit par Claude, false si fallback. */
  aiGenerated: boolean;
  /** ISO timestamp, ou null si jamais analysé. */
  analyzedAt: string | null;
}

export interface GeoTarget {
  /** pays ciblés (codes ISO ou noms) — ex. ["MU","FR"]. */
  countries: string[];
  cities?: string[];
  radiusKm?: number;
}

export type CadenceId = "daily" | "3x_week" | "weekly" | "custom";

export interface OnboardingSchedule {
  cadence?: CadenceId;
  /** date de démarrage ISO (YYYY-MM-DD). */
  startDate?: string;
  /** heures de publication HH:mm. */
  times?: string[];
  /** jours de publication (0=Dim … 6=Sam) pour les cadences 3x/sem & hebdo. */
  days?: number[];
}

export type CreativeMode = "autonomous" | "bank" | "product";
export type CampaignType = "organic" | "paid" | "mixed";

/** État persistant du parcours (public.sh_onboarding_state). */
export interface OnboardingState {
  companyId: string;
  /** étape courante 1..6. */
  step: number;
  /** ids d'objectifs choisis (référence SuggestedObjective.id ou libre). */
  objectives: string[];
  networks: SocialNetwork[];
  /** nombre de campagnes à construire (1 ou N). */
  campaignCount: number;
  geo: GeoTarget;
  creativeMode: CreativeMode | null;
  campaignType: CampaignType | null;
  schedule: OnboardingSchedule;
  completed: boolean;
  updatedAt: string;
}

export const TOTAL_STEPS = 6;

/** État vierge pour une marque qui démarre. */
export function makeEmptyOnboardingState(companyId: string): OnboardingState {
  return {
    companyId,
    step: 1,
    objectives: [],
    networks: [],
    campaignCount: 1,
    geo: { countries: [] },
    creativeMode: null,
    campaignType: null,
    schedule: {},
    completed: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Profil vierge (avant analyse). */
export function makeEmptyBrandProfile(companyId: string): BrandProfile {
  return {
    companyId,
    website: "",
    handles: {},
    description: "",
    summary: "",
    positioning: "",
    tone: "",
    audience: "",
    themes: [],
    strengths: [],
    mission: "",
    values: [],
    keyMessage: "",
    personality: [],
    visualDirection: "",
    networkStrategies: [],
    philosophyLocked: false,
    keywords: [],
    recommendedNetworks: [],
    competitorAngles: [],
    suggestedObjectives: [],
    aiGenerated: false,
    analyzedAt: null,
  };
}

// ── Contrats API ────────────────────────────────────────────────────────────

/** POST /api/onboarding/analyze */
export interface AnalyzeRequest {
  companyId: string;
  website?: string;
  handles?: BrandHandles;
  /** nom de la marque (aide l'IA si le site est inaccessible). */
  companyName?: string;
  /** descriptif libre de la société saisi par le client. */
  description?: string;
}
export interface AnalyzeResponse {
  profile: BrandProfile;
}

/** GET /api/onboarding/state?companyId=… */
export interface OnboardingStateResponse {
  state: OnboardingState;
  profile: BrandProfile | null;
}

/** PUT /api/onboarding/state — patch partiel de l'état. */
export interface SaveStateRequest extends Partial<Omit<OnboardingState, "companyId" | "updatedAt">> {
  companyId: string;
}
