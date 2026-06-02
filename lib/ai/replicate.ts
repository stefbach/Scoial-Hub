// ============================================================
// Couche Replicate — génération d'images et de vidéos.
// Une seule clé : REPLICATE_API_TOKEN (lue directement depuis process.env).
// Dégradation gracieuse : si la clé est absente, retourne des données
// simulées SANS aucun appel réseau et SANS throw au chargement du module.
// ============================================================

// --------------- Configuration ---------------

/** Vrai si REPLICATE_API_TOKEN est présent dans l'environnement. */
export const isReplicateConfigured: boolean = Boolean(
  process.env.REPLICATE_API_TOKEN
);

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

/** Modèle image par défaut : Flux 1.1 Pro (qualité photoréaliste). */
const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux-1.1-pro";

/** Modèle vidéo par défaut : MiniMax Video-01 (disponible via Replicate). */
const DEFAULT_VIDEO_MODEL = "minimax/video-01";

/** Timeout global pour le polling d'une prédiction (ms). */
const PREDICTION_TIMEOUT_MS = 120_000; // 2 minutes

/** Intervalle entre deux vérifications de statut (ms). */
const POLLING_INTERVAL_MS = 2_000;

// --------------- Types internes ---------------

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string;
  urls?: { get?: string };
}

// --------------- Utilitaires réseau ---------------

/** Retourne les headers HTTP communs à toutes les requêtes Replicate. */
function replicateHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
    "Content-Type": "application/json",
    Prefer: "wait",
  };
}

/**
 * Crée une prédiction sur Replicate.
 * Utilise l'endpoint `/v1/models/{owner}/{name}/predictions` pour les modèles
 * hébergés, ce qui permet de cibler la dernière version sans la spécifier.
 */
async function createPrediction(
  model: string,
  input: Record<string, unknown>
): Promise<ReplicatePrediction> {
  const [owner, name] = model.split("/");
  const url = `${REPLICATE_API_BASE}/models/${owner}/${name}/predictions`;

  const res = await fetch(url, {
    method: "POST",
    headers: replicateHeaders(),
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(
      `Replicate — création de prédiction échouée (${res.status}) : ${text}`
    );
  }

  return res.json() as Promise<ReplicatePrediction>;
}

/**
 * Interroge Replicate jusqu'à ce que la prédiction soit terminée
 * (statut `succeeded` ou `failed`) ou que le timeout soit atteint.
 */
async function pollPrediction(
  predictionId: string
): Promise<ReplicatePrediction> {
  const deadline = Date.now() + PREDICTION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));

    const res = await fetch(
      `${REPLICATE_API_BASE}/predictions/${predictionId}`,
      { headers: replicateHeaders() }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(
        `Replicate — polling échoué (${res.status}) : ${text}`
      );
    }

    const prediction: ReplicatePrediction = await res.json();

    if (prediction.status === "succeeded") return prediction;
    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(
        `Replicate — prédiction ${prediction.status} : ${prediction.error ?? "raison inconnue"}`
      );
    }
    // statuts "starting" | "processing" → on continue le polling
  }

  throw new Error(
    `Replicate — timeout (${PREDICTION_TIMEOUT_MS / 1000} s) dépassé sans réponse.`
  );
}

/**
 * Crée une prédiction et attend le résultat via polling.
 * Si Replicate renvoie directement l'output (Prefer: wait), le polling
 * est court-circuité car le statut sera déjà `succeeded`.
 */
async function runPrediction(
  model: string,
  input: Record<string, unknown>
): Promise<ReplicatePrediction> {
  const prediction = await createPrediction(model, input);

  // Replicate peut répondre immédiatement avec le résultat final
  if (prediction.status === "succeeded") return prediction;
  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(
      `Replicate — prédiction ${prediction.status} dès la création : ${prediction.error ?? ""}`
    );
  }

  return pollPrediction(prediction.id);
}

// --------------- API publique — Images ---------------

export interface GenerateImageOptions {
  prompt: string;
  /** Format cible Meta : "square" (1:1), "portrait" (4:5), "landscape" (1.91:1), "story" (9:16). */
  format?: string;
  /** Nombre d'images souhaitées (1–4). Défaut : 1. */
  n?: number;
}

export interface GenerateImageResult {
  images: { url: string }[];
  simulated?: boolean;
  model?: string;
}

/**
 * Génère une ou plusieurs images via Replicate (Flux 1.1 Pro).
 * Retourne `{ images: [], simulated: true }` si le token est absent.
 */
export async function generateImage(
  opts: GenerateImageOptions
): Promise<GenerateImageResult> {
  if (!isReplicateConfigured) {
    return { images: [], simulated: true, model: "simulated" };
  }

  const { prompt, format = "square", n = 1 } = opts;
  const numOutputs = Math.min(Math.max(1, n), 4);

  // Mappage du format vers le ratio Replicate
  const aspectRatioMap: Record<string, string> = {
    square: "1:1",
    portrait: "4:5",
    landscape: "16:9",
    story: "9:16",
    // valeurs brutes transmises directement
    "1:1": "1:1",
    "4:5": "4:5",
    "16:9": "16:9",
    "9:16": "9:16",
    "1.91:1": "16:9",
  };
  const aspectRatio = aspectRatioMap[format] ?? "1:1";

  const prediction = await runPrediction(DEFAULT_IMAGE_MODEL, {
    prompt,
    aspect_ratio: aspectRatio,
    num_outputs: numOutputs,
    output_format: "webp",
    output_quality: 80,
    safety_tolerance: 2,
  });

  // L'output de Flux est un tableau d'URLs (strings)
  const rawOutput = prediction.output;
  const urls: string[] = Array.isArray(rawOutput)
    ? (rawOutput as string[])
    : typeof rawOutput === "string"
    ? [rawOutput]
    : [];

  return {
    images: urls.map((url) => ({ url })),
    model: DEFAULT_IMAGE_MODEL,
  };
}

// --------------- API publique — Vidéos ---------------

export interface GenerateVideoOptions {
  prompt: string;
  /** Durée souhaitée en secondes (5 ou 10). Défaut : 5. */
  seconds?: number;
  /** Ratio d'aspect : "16:9", "9:16", "1:1". Défaut : "9:16" (Reels). */
  aspect?: string;
}

export interface GenerateVideoResult {
  video?: { url: string };
  simulated?: boolean;
  model?: string;
}

/**
 * Génère une vidéo courte via Replicate (MiniMax Video-01).
 * Retourne `{ simulated: true }` si le token est absent.
 */
export async function generateVideo(
  opts: GenerateVideoOptions
): Promise<GenerateVideoResult> {
  if (!isReplicateConfigured) {
    return { simulated: true, model: "simulated" };
  }

  const { prompt, seconds = 5, aspect = "9:16" } = opts;

  // MiniMax Video-01 accepte prompt_optimizer et duration (en secondes)
  const prediction = await runPrediction(DEFAULT_VIDEO_MODEL, {
    prompt,
    prompt_optimizer: true,
    // Le modèle supporte 6 s ; on clamp pour rester dans les limites
    duration: Math.min(Math.max(seconds, 5), 6),
  });

  // L'output est une URL string ou un tableau dont on prend le premier élément
  const rawOutput = prediction.output;
  let videoUrl: string | undefined;

  if (typeof rawOutput === "string") {
    videoUrl = rawOutput;
  } else if (Array.isArray(rawOutput) && rawOutput.length > 0) {
    videoUrl = String(rawOutput[0]);
  }

  if (!videoUrl) {
    throw new Error("Replicate — aucune URL vidéo dans la réponse du modèle.");
  }

  return {
    video: { url: videoUrl },
    model: DEFAULT_VIDEO_MODEL,
  };
}
