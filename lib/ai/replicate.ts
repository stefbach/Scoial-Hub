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

/**
 * Modèle vidéo par défaut : Google Veo 3 (qualité max, son natif, clips ~8 s).
 * Pour des durées plus longues, on enchaîne plusieurs clips (storyboard) côté client.
 */
const DEFAULT_VIDEO_MODEL = "google/veo-3";

/** Timeout global pour le polling d'une prédiction (ms). */
const PREDICTION_TIMEOUT_MS = 120_000; // 2 minutes

/** Intervalle entre deux vérifications de statut (ms). */
const POLLING_INTERVAL_MS = 2_000;

/** Petite pause utilitaire. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch Replicate avec gestion du throttling (429). Replicate réduit fortement
 * le débit quand le crédit est faible (< 5 $ : burst de 1 requête, 6/min). On
 * respecte alors l'en-tête/`retry_after` et on retente quelques fois.
 */
async function replicateFetch(
  url: string,
  init: RequestInit,
  attempt = 0
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 429 || attempt >= 4) return res;

  // Détermine le délai d'attente : corps JSON `retry_after` ou en-tête, défaut 10 s.
  let waitSec = 10;
  try {
    const body = (await res.clone().json()) as { retry_after?: number };
    if (typeof body.retry_after === "number") waitSec = body.retry_after;
  } catch {
    const hdr = Number(res.headers.get("retry-after"));
    if (Number.isFinite(hdr) && hdr > 0) waitSec = hdr;
  }
  await sleep(Math.min(Math.max(waitSec, 1), 30) * 1000 + 500);
  return replicateFetch(url, init, attempt + 1);
}

// --------------- Types internes ---------------

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string;
  urls?: { get?: string };
}

// --------------- Utilitaires réseau ---------------

/**
 * Retourne les headers HTTP communs à toutes les requêtes Replicate.
 * `wait=true` ajoute `Prefer: wait` (réponse synchrone, bloque jusqu'à ~60s) —
 * à éviter pour les modèles lents qu'on veut démarrer en asynchrone.
 */
function replicateHeaders(wait = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
    "Content-Type": "application/json",
  };
  if (wait) h.Prefer = "wait";
  return h;
}

/**
 * Crée une prédiction sur Replicate.
 * Utilise l'endpoint `/v1/models/{owner}/{name}/predictions` pour les modèles
 * hébergés, ce qui permet de cibler la dernière version sans la spécifier.
 */
/** Récupère l'id de la dernière version d'un modèle (pour les modèles non officiels). */
async function resolveLatestVersion(model: string): Promise<string | null> {
  try {
    const res = await replicateFetch(`${REPLICATE_API_BASE}/models/${model}`, {
      headers: replicateHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { latest_version?: { id?: string } };
    return data.latest_version?.id ?? null;
  } catch {
    return null;
  }
}

async function createPrediction(
  model: string,
  input: Record<string, unknown>,
  wait = true
): Promise<ReplicatePrediction> {
  const [owner, name] = model.split("/");

  // 1) Endpoint « modèle officiel » (cible la dernière version sans la spécifier).
  let res = await replicateFetch(`${REPLICATE_API_BASE}/models/${owner}/${name}/predictions`, {
    method: "POST",
    headers: replicateHeaders(wait),
    body: JSON.stringify({ input }),
  });

  // 2) 404 → modèle communautaire : on résout la version et on relance via /predictions.
  if (res.status === 404) {
    const version = await resolveLatestVersion(model);
    if (version) {
      res = await replicateFetch(`${REPLICATE_API_BASE}/predictions`, {
        method: "POST",
        headers: replicateHeaders(wait),
        body: JSON.stringify({ version, input }),
      });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    if (res.status === 429) {
      throw new Error(
        "Limite de débit Replicate atteinte (crédit faible : 1 image à la fois, ~6/min). Réessayez dans ~10 s, ou ajoutez du crédit Replicate pour lever la limite."
      );
    }
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

    const res = await replicateFetch(
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
 *
 * Note : flux-1.1-pro produit UNE image par prédiction et n'accepte PAS de
 * paramètre `num_outputs` (l'envoyer provoque une erreur 422). Pour obtenir
 * plusieurs images, on lance donc plusieurs prédictions en parallèle.
 */
export async function generateImage(
  opts: GenerateImageOptions
): Promise<GenerateImageResult> {
  if (!isReplicateConfigured) {
    return { images: [], simulated: true, model: "simulated" };
  }

  const { prompt, format = "square", n = 1 } = opts;
  const count = Math.min(Math.max(1, n), 4);

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

  const input = {
    prompt,
    aspect_ratio: aspectRatio,
    output_format: "webp",
    output_quality: 80,
    safety_tolerance: 2,
  };

  // N prédictions en parallèle (flux-1.1-pro = 1 image/prédiction).
  const settled = await Promise.allSettled(
    Array.from({ length: count }, () => runPrediction(DEFAULT_IMAGE_MODEL, input))
  );

  const urls: string[] = [];
  let lastError: unknown;
  for (const s of settled) {
    if (s.status === "fulfilled") {
      const out = s.value.output;
      if (Array.isArray(out)) urls.push(...(out as string[]));
      else if (typeof out === "string") urls.push(out);
    } else {
      lastError = s.reason;
    }
  }

  // Aucune image : on remonte la vraie erreur Replicate (token invalide,
  // crédits épuisés, modèle indisponible…) plutôt qu'un échec silencieux.
  if (urls.length === 0) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Replicate — aucune image générée.");
  }

  return {
    images: urls.map((url) => ({ url })),
    model: DEFAULT_IMAGE_MODEL,
  };
}

/**
 * Génère des images avec un modèle Replicate arbitraire (catalogue) et un input
 * déjà construit pour son schéma. Parallélise si plusieurs images sont demandées.
 *
 * Robustesse : on utilise allSettled — si UNE prédiction échoue (sécurité,
 * rate-limit, transitoire), on garde quand même les images réussies. On ne lève
 * que si AUCUNE image n'a été produite (en remontant la vraie erreur Replicate).
 */
export async function generateImageModel(
  modelId: string,
  input: Record<string, unknown>,
  n = 1
): Promise<GenerateImageResult> {
  if (!isReplicateConfigured) {
    return { images: [], simulated: true, model: "simulated" };
  }
  const numOutputs = Math.min(Math.max(1, n), 4);
  const runOne = async (): Promise<string[]> => {
    const prediction = await runPrediction(modelId, input);
    const raw = prediction.output;
    return Array.isArray(raw)
      ? (raw as string[]).map(String)
      : typeof raw === "string"
      ? [raw]
      : [];
  };

  // SÉQUENTIEL (pas Promise.all) : Replicate limite à 1 requête simultanée quand
  // le crédit est faible. On garde les images réussies, on ne lève que si zéro.
  const urls: string[] = [];
  let lastError: unknown;
  for (let i = 0; i < numOutputs; i++) {
    try {
      urls.push(...(await runOne()));
    } catch (e) {
      lastError = e;
    }
  }

  if (urls.length === 0) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Replicate — aucune image générée.");
  }

  return { images: urls.map((url) => ({ url })), model: modelId };
}

// --------------- API publique — Vidéos ---------------

export interface GenerateVideoOptions {
  prompt: string;
  /**
   * Durée souhaitée en secondes. MiniMax Video-01 produit des clips COURTS
   * (~6s max) : la valeur est clampée à 5–6s. Ne pas promettre plus côté UI.
   * Défaut : 5.
   */
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

  const { prompt } = opts;

  // Veo 3 n'accepte qu'un `prompt`.
  const prediction = await runPrediction(DEFAULT_VIDEO_MODEL, { prompt });

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

// --------------- API publique — Vidéos (asynchrone) ---------------
//
// MiniMax Video-01 met souvent 2 à 5 min : on ne bloque pas une fonction
// serverless aussi longtemps. On lance la prédiction (sans Prefer: wait) et on
// interroge son statut séparément ; le polling est fait côté client.

export interface VideoPredictionStatus {
  id?: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled" | "simulated";
  video?: { url: string };
  error?: string;
  simulated?: boolean;
}

function mapVideoPrediction(p: ReplicatePrediction): VideoPredictionStatus {
  const raw = p.output;
  let videoUrl: string | undefined;
  if (typeof raw === "string") videoUrl = raw;
  else if (Array.isArray(raw) && raw.length > 0) videoUrl = String(raw[0]);
  return {
    id: p.id,
    status: p.status,
    video: videoUrl ? { url: videoUrl } : undefined,
    error: p.error,
  };
}

/**
 * Démarre une génération vidéo et retourne immédiatement l'id de prédiction.
 * `modelId` + `input` permettent de cibler n'importe quel modèle du catalogue ;
 * par défaut on utilise Veo 3 avec un input minimal.
 */
export async function startVideoPrediction(
  opts: GenerateVideoOptions,
  modelId: string = DEFAULT_VIDEO_MODEL,
  input?: Record<string, unknown>
): Promise<VideoPredictionStatus> {
  if (!isReplicateConfigured) return { status: "simulated", simulated: true };

  const [owner, name] = modelId.split("/");
  const res = await fetch(
    `${REPLICATE_API_BASE}/models/${owner}/${name}/predictions`,
    {
      method: "POST",
      // Pas de Prefer: wait — on veut un retour immédiat avec l'id.
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: input ?? { prompt: opts.prompt } }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Replicate — création de prédiction échouée (${res.status}) : ${text}`);
  }
  return mapVideoPrediction((await res.json()) as ReplicatePrediction);
}

/** Interroge une fois le statut d'une prédiction vidéo. */
export async function getVideoPrediction(id: string): Promise<VideoPredictionStatus> {
  if (!isReplicateConfigured) return { status: "simulated", simulated: true };

  const res = await fetch(`${REPLICATE_API_BASE}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Replicate — statut échoué (${res.status}) : ${text}`);
  }
  return mapVideoPrediction((await res.json()) as ReplicatePrediction);
}

// --------------- API publique — Avatar parlant (TTS + lip-sync) ---------------

/** Modèles par défaut (surchargeables). TTS texte→audio, puis image+audio→vidéo. */
export const AVATAR_TTS_MODEL = "jaaari/kokoro-82m";
export const AVATAR_LIPSYNC_MODEL = "cjwbw/sadtalker";

/** Extrait la 1ère URL exploitable d'un output Replicate (string | string[] | objet). */
function firstUrl(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") return output.startsWith("http") ? output : null;
  if (Array.isArray(output)) {
    for (const o of output) {
      const u = firstUrl(o);
      if (u) return u;
    }
    return null;
  }
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    for (const k of ["video", "audio", "output", "url"]) {
      const u = firstUrl(o[k]);
      if (u) return u;
    }
  }
  return null;
}

/** Exécute un modèle Replicate arbitraire et renvoie la 1ère URL de l'output. */
export async function runReplicateUrl(
  model: string,
  input: Record<string, unknown>
): Promise<string | null> {
  if (!isReplicateConfigured) return null;
  const prediction = await runPrediction(model, input);
  return firstUrl(prediction.output);
}

/** Auto-détecte les clés d'entrée image & audio d'un modèle (schéma OpenAPI). */
async function detectAvatarKeys(model: string): Promise<{ imageKey: string; audioKey: string }> {
  let imageKey = "image";
  let audioKey = "audio";
  try {
    const res = await replicateFetch(`${REPLICATE_API_BASE}/models/${model}`, {
      headers: replicateHeaders(),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        latest_version?: { openapi_schema?: { components?: { schemas?: { Input?: { properties?: Record<string, unknown> } } } } };
      };
      const props = data.latest_version?.openapi_schema?.components?.schemas?.Input?.properties ?? {};
      const names = Object.keys(props);
      const img = names.find((n) => /image|img|source|face|portrait|photo|video|input/i.test(n));
      const aud = names.find((n) => /audio|voice|speech|sound|wav/i.test(n));
      if (img) imageKey = img;
      if (aud) audioKey = aud;
    }
  } catch {
    /* clés par défaut */
  }
  return { imageKey, audioKey };
}

/**
 * Lip-sync ROBUSTE (synchrone) : auto-détecte les clés puis attend le résultat.
 * Réservé aux modèles rapides ; pour les modèles lents (OmniHuman…) préférer
 * startAvatarLipsync + getReplicatePrediction (asynchrone, évite les timeouts).
 */
export async function lipsyncAvatar(
  model: string,
  imageUrl: string,
  audioUrl: string
): Promise<string | null> {
  if (!isReplicateConfigured) return null;
  const { imageKey, audioKey } = await detectAvatarKeys(model);
  return runReplicateUrl(model, { [imageKey]: imageUrl, [audioKey]: audioUrl });
}

/** Démarre un lip-sync SANS attendre (asynchrone). Renvoie l'id de prédiction. */
export async function startAvatarLipsync(
  model: string,
  imageUrl: string,
  audioUrl: string
): Promise<{ id?: string; status?: string; videoUrl?: string; error?: string }> {
  if (!isReplicateConfigured) return { error: "not-configured" };
  const { imageKey, audioKey } = await detectAvatarKeys(model);
  // wait=false : démarrage immédiat (pas de blocage ~60s → pas de timeout fonction).
  const pred = await createPrediction(model, { [imageKey]: imageUrl, [audioKey]: audioUrl }, false);
  if (pred.status === "succeeded") return { id: pred.id, status: "succeeded", videoUrl: firstUrl(pred.output) ?? undefined };
  if (pred.status === "failed" || pred.status === "canceled") return { id: pred.id, status: "failed", error: pred.error ?? "failed" };
  return { id: pred.id, status: pred.status };
}

/** Interroge une prédiction Replicate (générique) et renvoie l'URL de sortie. */
export async function getReplicatePrediction(
  id: string
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  if (!isReplicateConfigured) return { status: "failed", error: "not-configured" };
  const res = await replicateFetch(`${REPLICATE_API_BASE}/predictions/${id}`, {
    headers: replicateHeaders(),
  });
  if (!res.ok) return { status: "failed", error: `HTTP ${res.status}` };
  const p = (await res.json()) as ReplicatePrediction;
  if (p.status === "succeeded") return { status: "succeeded", videoUrl: firstUrl(p.output) ?? undefined };
  if (p.status === "failed" || p.status === "canceled") return { status: "failed", error: p.error ?? "failed" };
  return { status: p.status };
}

export interface AvatarResult {
  videoUrl?: string;
  audioUrl?: string;
  simulated?: boolean;
}

/**
 * Génère une vidéo d'avatar parlant : texte → voix (TTS) → lip-sync sur un visage.
 * Dégradation : si Replicate n'est pas configuré, retourne { simulated: true }.
 */
export async function generateAvatarVideo(opts: {
  text: string;
  faceUrl: string;
  voice?: string;
  ttsModel?: string;
  lipsyncModel?: string;
}): Promise<AvatarResult> {
  if (!isReplicateConfigured) return { simulated: true };

  // 1) Voix (TTS)
  const audioUrl = await runReplicateUrl(opts.ttsModel ?? AVATAR_TTS_MODEL, {
    text: opts.text,
    ...(opts.voice ? { voice: opts.voice } : {}),
  });
  if (!audioUrl) throw new Error("Échec de la génération de la voix (TTS).");

  // 2) Lip-sync (visage + audio → vidéo)
  const videoUrl = await runReplicateUrl(opts.lipsyncModel ?? AVATAR_LIPSYNC_MODEL, {
    source_image: opts.faceUrl,
    driven_audio: audioUrl,
    preprocess: "full",
  });
  if (!videoUrl) throw new Error("Échec de la génération de la vidéo (lip-sync).");

  return { videoUrl, audioUrl };
}
