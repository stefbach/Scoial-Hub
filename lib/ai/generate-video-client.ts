/**
 * Helper client pour la génération vidéo asynchrone.
 *
 * Lance la prédiction via POST /api/ai/generate-video puis interroge
 * GET /api/ai/generate-video?id=… jusqu'à obtention de l'URL (ou échec/timeout).
 * MiniMax Video-01 peut prendre plusieurs minutes ; le polling est court côté
 * serveur (chaque requête est rapide) et la patience est gérée ici.
 */

export interface VideoGenResult {
  url?: string;
  simulated?: boolean;
  error?: string;
}

export interface VideoGenBody {
  prompt: string;
  platform?: string;
  aspect?: string;
  seconds?: number;
  /** Identifiant de modèle Replicate (catalogue). */
  model?: string;
  /** Société courante — requise pour l'autorisation (mode édition). */
  companyId?: string;
}

export async function generateVideoPolling(
  body: VideoGenBody,
  opts?: {
    onStatus?: (status: string) => void;
    timeoutMs?: number;
    intervalMs?: number;
  }
): Promise<VideoGenResult> {
  const timeoutMs = opts?.timeoutMs ?? 6 * 60_000; // 6 min
  const intervalMs = opts?.intervalMs ?? 4_000;

  let res: Response;
  try {
    res = await fetch("/api/ai/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { error: "network" };
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) return { error: String((data as { error?: string }).error ?? `HTTP ${res.status}`) };
  if ((data as { simulated?: boolean }).simulated) return { simulated: true };

  const direct = (data as { video?: { url?: string } }).video?.url;
  if (direct) return { url: direct };

  const id = (data as { id?: string }).id;
  if (!id) return { error: "no-id" };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let poll: Response;
    try {
      poll = await fetch(`/api/ai/generate-video?id=${encodeURIComponent(id)}`);
    } catch {
      continue; // erreur réseau transitoire → on réessaie
    }
    const d = (await poll.json().catch(() => ({}))) as {
      status?: string;
      video?: { url?: string };
      error?: string;
      simulated?: boolean;
    };
    if (d.simulated) return { simulated: true };
    if (d.video?.url) return { url: d.video.url };
    if (d.error || d.status === "failed" || d.status === "canceled") {
      return { error: d.error || d.status || "failed" };
    }
    opts?.onStatus?.(d.status ?? "processing");
  }
  return { error: "timeout" };
}

/** Codes internes du polling — à distinguer d'une raison SERVEUR réelle. */
const INTERNAL_ERROR_CODES = new Set(["network", "timeout", "no-id", "failed", "canceled"]);

/**
 * Message à AFFICHER pour un échec de `generateVideoPolling`.
 *
 * Retour client (réunion Rosiane, point #8 — « la génération vidéo ne
 * marche pas ») : la cause la plus fréquente n'est PAS une panne, c'est une
 * formule qui n'inclut pas la vidéo IA (Présence = 0 s/mois) ou un quota
 * mensuel épuisé — et le serveur renvoie déjà un message PRÉCIS et actionnable
 * (`lib/quota/video-seconds.ts`, `refusal()`) pour ce cas précis. Jusqu'ici,
 * chaque écran l'ignorait et affichait un message générique de panne
 * technique ("réessayez", "REPLICATE_API_TOKEN ?") — ce qui fait passer une
 * restriction de formule, normale et documentée, pour un bug.
 *
 * Seuls les codes INTERNES ci-dessus (réseau, délai, etc.) retombent sur un
 * message générique ; toute autre valeur vient du serveur et doit être
 * affichée TELLE QUELLE — c'est elle qui est la plus utile à l'utilisateur.
 */
export function videoGenErrorMessage(
  error: string | undefined,
  t: (fr: string, en: string) => string
): string {
  if (error && !INTERNAL_ERROR_CODES.has(error)) return error;
  if (error === "timeout") {
    return t("La vidéo prend trop de temps. Réessayez dans un instant.", "Video is taking too long. Try again shortly.");
  }
  if (error === "network") {
    return t("Erreur réseau. Vérifiez votre connexion et réessayez.", "Network error. Check your connection and try again.");
  }
  return t("La génération vidéo a échoué. Réessayez ou changez de modèle.", "Video generation failed. Try again or change the model.");
}
