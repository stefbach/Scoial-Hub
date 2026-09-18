// ============================================================
// Couche Higgsfield — génération d'images et de vidéos.
// Option SUPPLÉMENTAIRE à Replicate (lib/ai/replicate.ts) : mêmes
// contrats de sortie, pour que les routes /api/ai/generate-image et
// /api/ai/generate-video puissent basculer d'un fournisseur à l'autre
// selon `GenModel.provider` (lib/ai/model-catalog.ts) sans changer leur
// logique de quota, de repli ou de persistance média.
//
// Identifiants (console.higgsfield.ai) — deux formats acceptés, comme le SDK
// officiel @higgsfield/client (scripts/higgsfield-seedance-example.ts) pour
// n'avoir la clé à renseigner qu'une seule fois :
//   - HF_CREDENTIALS (ou HF_KEY) = "<key-id>:<key-secret>" — format préféré
//   - HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET — champs séparés
// Dégradation gracieuse : si aucun n'est présent/valide, retourne des données
// simulées SANS appel réseau et SANS throw au chargement du module.
// ============================================================

// --------------- Configuration ---------------

function resolveCredentials(): { apiKey: string; apiSecret: string } | null {
  const combined = process.env.HF_CREDENTIALS || process.env.HF_KEY;
  if (combined) {
    const [apiKey, apiSecret] = combined.split(":");
    if (apiKey && apiSecret) return { apiKey, apiSecret };
  }
  const { HIGGSFIELD_API_KEY_ID: apiKey, HIGGSFIELD_API_KEY_SECRET: apiSecret } = process.env;
  if (apiKey && apiSecret) return { apiKey, apiSecret };
  return null;
}

/** Vrai si des identifiants Higgsfield exploitables sont présents dans l'environnement. */
export const isHiggsfieldConfigured: boolean = resolveCredentials() !== null;

const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";

/** Timeout global pour le polling d'une requête (ms). */
const REQUEST_TIMEOUT_MS = 120_000; // 2 minutes

/** Intervalle entre deux vérifications de statut (ms). */
const POLLING_INTERVAL_MS = 2_000;

function higgsfieldHeaders(): Record<string, string> {
  const creds = resolveCredentials();
  return {
    // Format documenté (console.higgsfield.ai) : "Key <id>:<secret>".
    Authorization: `Key ${creds?.apiKey ?? ""}:${creds?.apiSecret ?? ""}`,
    "Content-Type": "application/json",
  };
}

// --------------- Types internes ---------------

type HiggsfieldStatus = "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";

interface HiggsfieldRequestStatus {
  request_id: string;
  status: HiggsfieldStatus;
  images?: { url: string }[];
  video?: { url: string };
  error?: string;
}

// --------------- Utilitaires réseau ---------------

async function createHiggsfieldRequest(
  path: string,
  input: Record<string, unknown>
): Promise<HiggsfieldRequestStatus> {
  const res = await fetch(`${HIGGSFIELD_API_BASE}${path}`, {
    method: "POST",
    headers: higgsfieldHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Higgsfield — création de requête échouée (${res.status}) : ${text}`);
  }
  return res.json() as Promise<HiggsfieldRequestStatus>;
}

async function fetchHiggsfieldStatus(requestId: string): Promise<HiggsfieldRequestStatus> {
  const res = await fetch(`${HIGGSFIELD_API_BASE}/requests/${requestId}/status`, {
    headers: higgsfieldHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Higgsfield — statut échoué (${res.status}) : ${text}`);
  }
  return res.json() as Promise<HiggsfieldRequestStatus>;
}

/** Interroge une requête Higgsfield jusqu'à un état terminal ou le timeout. */
async function pollHiggsfieldRequest(requestId: string): Promise<HiggsfieldRequestStatus> {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));

    const status = await fetchHiggsfieldStatus(requestId);
    if (status.status === "completed") return status;
    if (status.status === "failed" || status.status === "nsfw" || status.status === "canceled") {
      throw new Error(`Higgsfield — requête ${status.status} : ${status.error ?? "raison inconnue"}`);
    }
    // "queued" | "in_progress" → on continue le polling
  }

  throw new Error(`Higgsfield — timeout (${REQUEST_TIMEOUT_MS / 1000} s) dépassé sans réponse.`);
}

// --------------- API publique — Images (synchrone) ---------------

export interface GenerateImageResult {
  images: { url: string }[];
  simulated?: boolean;
  model?: string;
}

/**
 * Crée une requête image Higgsfield (ex. SOUL Standard) et attend le résultat
 * via polling. `path` est l'endpoint du catalogue (ex.
 * "/higgsfield-ai/soul/standard"). Retourne `{ images: [], simulated: true }`
 * si les clés sont absentes.
 */
export async function generateHiggsfieldImage(
  path: string,
  input: Record<string, unknown>,
  n = 1
): Promise<GenerateImageResult> {
  if (!isHiggsfieldConfigured) {
    return { images: [], simulated: true, model: "simulated" };
  }

  const count = Math.min(Math.max(1, n), 4);
  const created = await createHiggsfieldRequest(path, { ...input, num_images: count });
  const final = created.status === "completed" ? created : await pollHiggsfieldRequest(created.request_id);

  const urls = (final.images ?? []).map((im) => im.url).filter(Boolean);
  if (urls.length === 0) {
    throw new Error("Higgsfield — aucune image générée.");
  }

  return { images: urls.map((url) => ({ url })), model: path };
}

// --------------- API publique — Vidéos (asynchrone) ---------------
//
// Même contrat que lib/ai/replicate.ts (startVideoPrediction /
// getVideoPrediction) : la route /api/ai/generate-video lance la requête
// sans attendre (fonctions vidéo lentes) et le client fait le polling via
// GET, quel que soit le fournisseur retenu.

export interface VideoPredictionStatus {
  id?: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled" | "simulated";
  video?: { url: string };
  error?: string;
  simulated?: boolean;
}

const STATUS_MAP: Record<HiggsfieldStatus, VideoPredictionStatus["status"]> = {
  queued: "starting",
  in_progress: "processing",
  completed: "succeeded",
  failed: "failed",
  nsfw: "failed",
  canceled: "canceled",
};

function mapHiggsfieldStatus(s: HiggsfieldRequestStatus): VideoPredictionStatus {
  return {
    id: s.request_id,
    status: STATUS_MAP[s.status],
    video: s.video?.url ? { url: s.video.url } : undefined,
    error: s.error,
  };
}

/**
 * Démarre une génération vidéo Higgsfield (ex. Veo 3.1, Kling 2.5 Turbo) et
 * renvoie immédiatement l'id de requête — pas d'attente (certains modèles
 * mettent plusieurs minutes). Renvoie `{ status: "simulated" }` sans clés.
 */
export async function startHiggsfieldVideo(
  path: string,
  input: Record<string, unknown>
): Promise<VideoPredictionStatus> {
  if (!isHiggsfieldConfigured) return { status: "simulated", simulated: true };
  const created = await createHiggsfieldRequest(path, input);
  return mapHiggsfieldStatus(created);
}

/** Interroge une fois le statut d'une requête vidéo Higgsfield. */
export async function getHiggsfieldVideo(requestId: string): Promise<VideoPredictionStatus> {
  if (!isHiggsfieldConfigured) return { status: "simulated", simulated: true };
  const status = await fetchHiggsfieldStatus(requestId);
  return mapHiggsfieldStatus(status);
}
