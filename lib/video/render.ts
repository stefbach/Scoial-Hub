// Moteur de rendu vidéo via Shotstack — construit un timeline JSON à partir d'un
// "cut" du Studio Créatif, soumet le rendu et permet d'en suivre l'état.
// Doc : https://shotstack.io/docs/api/

import { shotstack, isShotstackConfigured } from "@/lib/env";
import type { CaptionSegment, MediaAsset, PlatformCut } from "./types";

const SIZE: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

export type RenderState = "queued" | "rendering" | "done" | "failed" | "unsupported";

export interface RenderSubmit {
  ok: boolean;
  id?: string;
  status?: RenderState;
  error?: string;
}
export interface RenderStatus {
  status: RenderState;
  url?: string;
  error?: string;
}

const RENDERABLE = new Set(["video", "video_montage", "slideshow"]);

function endpoint(env: string): string {
  return `https://api.shotstack.io/edit/${env}`;
}
/** Ordre d'essai des environnements : celui configuré d'abord, puis l'autre. */
function envOrder(): string[] {
  return shotstack.env === "v1" ? ["v1", "stage"] : ["stage", "v1"];
}

/** Construit le timeline Shotstack pour un cut + ses médias. */
function buildEdit(cut: PlatformCut, assets: MediaAsset[], captions: CaptionSegment[]) {
  const size = SIZE[cut.aspect] ?? SIZE["9:16"];
  const videos = assets.filter((a) => a.kind === "video");
  const images = assets.filter((a) => a.kind === "image");
  const duration = cut.targetDurationSec > 0 ? cut.targetDurationSec : 20;

  const mediaClips: unknown[] = [];

  if (cut.assemblyType === "slideshow" || (videos.length === 0 && images.length > 0)) {
    // Diaporama : images en séquence, fondu + léger zoom.
    const slides = images.length > 0 ? images : assets;
    const per = Math.max(2, Math.round(duration / Math.max(slides.length, 1)));
    slides.forEach((a, i) => {
      mediaClips.push({
        asset: { type: "image", src: a.url },
        start: i * per,
        length: per,
        fit: "cover",
        effect: i % 2 === 0 ? "zoomIn" : "zoomOut",
        transition: { in: "fade", out: "fade" },
      });
    });
  } else {
    // Vidéo / montage : clips vidéo en séquence.
    const clips = videos.length > 0 ? videos : assets;
    const per = clips.length > 1 ? Math.max(3, Math.round(duration / clips.length)) : duration;
    let cursor = 0;
    clips.forEach((a) => {
      mediaClips.push({
        asset: { type: "video", src: a.url },
        start: cursor,
        length: per,
        fit: "cover",
        transition: { in: "fade", out: "fade" },
      });
      cursor += per;
    });
  }

  // Track texte : hook (0-3s) + sous-titres.
  const textClips: unknown[] = [];
  if (cut.hook) {
    textClips.push({
      asset: { type: "title", text: cut.hook, style: "subtitle", size: "large", position: "center" },
      start: 0,
      length: 3,
      transition: { in: "slideUp", out: "fade" },
    });
  }
  for (const c of captions) {
    if (c.start >= duration) continue;
    textClips.push({
      asset: { type: "title", text: c.text, style: "subtitle", size: "small", position: "bottom" },
      start: c.start,
      length: Math.max(1, Math.min(c.end, duration) - c.start),
    });
  }

  // Textes à l'écran (overlays) édités par l'utilisateur (hors hook 0-3s déjà posé).
  for (const o of cut.overlays ?? []) {
    if (!o.text || o.atSecond >= duration) continue;
    if (o.style === "hook" && o.atSecond === 0) continue; // évite doublon avec le hook
    const position = o.style === "cta" ? "bottom" : o.style === "lower_third" ? "bottom" : "center";
    textClips.push({
      asset: { type: "title", text: o.text, style: "minimal", size: "medium", position },
      start: Math.max(0, o.atSecond),
      length: 3,
      transition: { in: "fade", out: "fade" },
    });
  }

  const timeline: Record<string, unknown> = {
    background: "#000000",
    tracks: [{ clips: textClips }, { clips: mediaClips }].filter((tr) => (tr.clips as unknown[]).length > 0),
  };
  // Musique de fond (fondu) si fournie.
  if (cut.musicUrl) {
    timeline.soundtrack = { src: cut.musicUrl, effect: "fadeInFadeOut", volume: 0.45 };
  }

  return {
    timeline,
    output: { format: "mp4", size, fps: 30 },
  };
}

export function isRenderable(cut: PlatformCut): boolean {
  return RENDERABLE.has(cut.assemblyType);
}

export async function submitRender(
  cut: PlatformCut,
  assets: MediaAsset[],
  captions: CaptionSegment[]
): Promise<RenderSubmit> {
  if (!isShotstackConfigured) {
    return { ok: false, error: "Aucun moteur de rendu configuré (SHOTSTACK_API_KEY)." };
  }
  if (!isRenderable(cut)) {
    return { ok: false, status: "unsupported", error: "Ce format n'est pas rendu en vidéo (livrable statique)." };
  }
  if (assets.length === 0) {
    return { ok: false, error: "Aucun média à rendre." };
  }

  const body = JSON.stringify(buildEdit(cut, assets, captions));
  let lastErr = "Erreur Shotstack";
  // Essaie l'environnement configuré, puis bascule sur l'autre si la clé
  // ne correspond pas (401/403). L'env retenu est encodé dans l'id renvoyé.
  for (const env of envOrder()) {
    try {
      const res = await fetch(`${endpoint(env)}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": shotstack.apiKey },
        body,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        response?: { id?: string };
      };
      if (res.ok && data.success && data.response?.id) {
        return { ok: true, id: `${env}:${data.response.id}`, status: "queued" };
      }
      // 401/403 = mauvais environnement pour cette clé → on tente l'autre.
      if (res.status === 401 || res.status === 403) {
        lastErr = `Clé refusée par l'environnement « ${env} » (${res.status}). Vérifiez SHOTSTACK_ENV (stage vs v1).`;
        continue;
      }
      return { ok: false, error: data.message ?? `Erreur Shotstack (${res.status})` };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Erreur réseau";
    }
  }
  return { ok: false, error: lastErr };
}

export async function getRenderStatus(idWithEnv: string): Promise<RenderStatus> {
  if (!isShotstackConfigured) return { status: "failed", error: "Non configuré." };

  // L'id peut arriver encodé ("v1%3A<uuid>") ou préfixé ("v1:<uuid>"). On décode,
  // on retire le préfixe d'environnement, et on interroge les DEUX environnements
  // (un render n'existe que dans l'un d'eux) pour être robuste.
  let decoded = idWithEnv;
  try {
    decoded = decodeURIComponent(idWithEnv);
  } catch {
    /* garde tel quel */
  }
  const sep = decoded.indexOf(":");
  const bareId = sep > 0 ? decoded.slice(sep + 1) : decoded;
  const preferred = sep > 0 ? decoded.slice(0, sep) : shotstack.env;
  const order = preferred === "v1" ? ["v1", "stage"] : ["stage", "v1"];

  let pending: RenderStatus = { status: "queued" };
  for (const env of order) {
    try {
      const res = await fetch(`${endpoint(env)}/render/${encodeURIComponent(bareId)}`, {
        headers: { "x-api-key": shotstack.apiKey },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json().catch(() => ({}))) as {
        response?: { status?: string; url?: string; error?: string };
      };
      const raw = data.response?.status ?? "";
      if (!raw) continue;
      const status: RenderState =
        raw === "done" ? "done" : raw === "failed" ? "failed" : raw === "queued" || raw === "fetching" ? "queued" : "rendering";
      const out = { status, url: data.response?.url, error: data.response?.error };
      // done/rendering/failed = état définitif pour cet env → on renvoie.
      if (status !== "queued") return out;
      pending = out; // on garde "queued" mais on tente l'autre env au cas où.
    } catch {
      /* tente l'autre env */
    }
  }
  return pending;
}
