// Traduction du document de projet vers les DEUX moteurs de rendu.
//
// Le même document alimente le rendu navigateur (ffmpeg.wasm) et le rendu
// serveur (Shotstack). C'est ce qui garantit que l'aperçu et le fichier exporté
// décrivent le même montage : il n'existe qu'une seule description, projetée
// deux fois.
//
// Module PUR : il ne rend rien, il décrit ce qu'il faut rendre.

import {
  FORMAT_SIZE,
  projectDuration,
  type AudioTrack,
  type Clip,
  type EditorProject,
} from "./project";

/**
 * Chaîne de filtres qui inscrit un plan dans le format de publication.
 *
 * Sans elle, le fichier exporté conservait la définition de la source : choisir
 * « 9:16 » ne changeait rien au fichier produit, et le calque de texte — composé
 * lui à la taille du format — se retrouvait décalé. Les deux moteurs appliquent
 * désormais le même cadrage.
 */
export function frameFilterSteps(clip: Clip, size: { width: number; height: number }): string[] {
  const { width: W, height: H } = size;
  if (clip.fit === "contain") {
    return [
      `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`,
      "setsar=1",
    ];
  }
  // `cover` : on agrandit jusqu'à remplir, puis on rogne AUTOUR du point
  // d'intérêt — un visage cadré à gauche ne sort plus du champ.
  const fx = clip.focusX.toFixed(3);
  const fy = clip.focusY.toFixed(3);
  return [
    `scale=${W}:${H}:force_original_aspect_ratio=increase`,
    `crop=${W}:${H}:(in_w-out_w)*${fx}:(in_h-out_h)*${fy}`,
    "setsar=1",
  ];
}

/* ────────────────────────────────────────────────────────────────────────────
   Aiguillage
   ──────────────────────────────────────────────────────────────────────── */

export type RenderTarget = "browser" | "server";

/**
 * Seuils d'aiguillage. Le rendu navigateur est gratuit et ne fait sortir aucune
 * donnée, mais ffmpeg.wasm s'exécute en WebAssembly 32 bits : au-delà d'environ
 * 100 Mo de source l'onglet se bloque, et un montage long en mono-thread prend
 * des dizaines de minutes. Au-delà de ces seuils, le serveur prend la main.
 */
export const BROWSER_LIMITS = {
  /** Poids cumulé des sources. */
  maxBytes: 80 * 1024 * 1024,
  /** Nombre de plans : au-delà, l'assemblage devient coûteux dans l'onglet. */
  maxClips: 3,
  /** Durée du film. */
  maxSeconds: 120,
};

export interface RenderDecision {
  target: RenderTarget;
  /** Motif du basculement, affichable tel quel. */
  reason: string;
}

/**
 * Choisit le moteur. L'utilisateur ne choisit pas : il clique « Exporter » et
 * le système décide. Un rendu serveur libère en outre l'onglet — il peut fermer
 * sa fenêtre, le fichier l'attend dans sa bibliothèque.
 */
export function decideRenderTarget(p: EditorProject, totalSourceBytes: number): RenderDecision {
  const duration = projectDuration(p);
  if (totalSourceBytes > BROWSER_LIMITS.maxBytes) {
    return { target: "server", reason: "sources volumineuses" };
  }
  if (p.clips.length > BROWSER_LIMITS.maxClips) {
    return { target: "server", reason: "montage à plusieurs plans" };
  }
  if (duration > BROWSER_LIMITS.maxSeconds) {
    return { target: "server", reason: "film long" };
  }
  return { target: "browser", reason: "montage léger" };
}

/* ────────────────────────────────────────────────────────────────────────────
   Rendu serveur — timeline Shotstack
   ──────────────────────────────────────────────────────────────────────── */

/** Couleur hexadécimale sûre (le moteur refuse toute autre forme). */
function safeHex(v: string | undefined, fallback: string): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/** Position verticale Shotstack la plus proche d'une fraction de cadre. */
function bandFor(y: number): "top" | "center" | "bottom" {
  if (y < 0.33) return "top";
  if (y > 0.66) return "bottom";
  return "center";
}

/**
 * Construit la timeline serveur à partir du projet.
 * Les bornes temporelles des calques sont transmises telles quelles : c'est ce
 * qui permet enfin à un titre de n'apparaître que sur les trois premières
 * secondes, ce que l'ancien aplatissement en une image unique interdisait.
 */
export function toServerEdit(p: EditorProject, callback?: string) {
  const size = FORMAT_SIZE[p.format];

  const videoClips = p.clips.map((c: Clip) => ({
    asset: {
      type: c.kind === "image" ? "image" : "video",
      src: c.src,
      ...(c.kind === "video"
        ? { trim: c.trimStart > 0 ? c.trimStart : undefined, speed: c.speed !== 1 ? c.speed : undefined }
        : {}),
    },
    start: c.start,
    length: c.length,
    fit: c.fit,
    // Décalage qui ramène le point d'intérêt au centre du cadre (y positif =
    // vers le haut chez Shotstack). Sans objet quand la source entière tient.
    ...(c.fit === "cover" && (c.focusX !== 0.5 || c.focusY !== 0.5)
      ? { offset: { x: 0.5 - c.focusX, y: c.focusY - 0.5 } }
      : {}),
    ...(c.transitionIn !== "none" ? { transition: { in: c.transitionIn } } : {}),
  }));

  const textClips = p.texts.map((l) => ({
    asset: {
      type: "title",
      text: l.text,
      style: "subtitle",
      size: l.sizePct >= 0.1 ? "large" : l.sizePct >= 0.06 ? "medium" : "small",
      position: bandFor(l.y),
      color: safeHex(l.color, "#ffffff"),
      ...(l.bg ? { background: "#000000" } : {}),
    },
    start: l.start,
    length: Math.max(0.1, l.end - l.start),
  }));

  const imageClips = p.images.map((l) => ({
    asset: { type: "image", src: l.src },
    start: l.start,
    length: Math.max(0.1, l.end - l.start),
    fit: "none",
    scale: l.scale,
    opacity: l.opacity,
    offset: { x: l.x - 0.5, y: 0.5 - l.y },
  }));

  const audioTracks = p.audios
    .filter((a) => !a.muted && a.length > 0)
    .map((a: AudioTrack) => ({
      asset: {
        type: "audio",
        src: a.src,
        trim: a.trimStart > 0 ? a.trimStart : undefined,
        volume: a.volume,
        effect: a.fadeIn > 0 && a.fadeOut > 0 ? "fadeInFadeOut" : a.fadeIn > 0 ? "fadeIn" : a.fadeOut > 0 ? "fadeOut" : undefined,
      },
      start: a.start,
      length: a.length,
    }));

  // Ordre des pistes : la PREMIÈRE est au-dessus. Les incrustations et les
  // textes doivent donc précéder les plans vidéo.
  const tracks = [
    ...(textClips.length ? [{ clips: textClips }] : []),
    ...(imageClips.length ? [{ clips: imageClips }] : []),
    { clips: videoClips },
    ...(audioTracks.length ? [{ clips: audioTracks }] : []),
  ];

  return {
    timeline: { background: "#000000", tracks },
    output: { format: "mp4", size, fps: 30 },
    ...(callback ? { callback } : {}),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Rendu navigateur — plan d'exécution ffmpeg
   ──────────────────────────────────────────────────────────────────────── */

export interface BrowserRenderPlan {
  /** Fichiers à écrire dans le système de fichiers virtuel, dans cet ordre. */
  inputs: { name: string; src: string }[];
  /** Arguments passés à ffmpeg. */
  args: string[];
  /** Nom du fichier de sortie. */
  output: string;
}

/**
 * Construit le plan d'un montage à UN plan — le cas que le navigateur prend en
 * charge. Les montages multi-plans partent au serveur (voir l'aiguillage), ce
 * qui évite de réimplémenter une chaîne de concaténation fragile dans l'onglet.
 *
 * `overlayName` est le PNG des calques, composé par le canvas de l'aperçu :
 * la même fonction de dessin sert à l'aperçu et au rendu, ce qui garantit que
 * l'un ressemble à l'autre.
 */
export function toBrowserPlan(p: EditorProject, overlayName: string | null): BrowserRenderPlan {
  const clip = p.clips[0];
  if (!clip) return { inputs: [], args: [], output: "out.mp4" };

  const size = FORMAT_SIZE[p.format];
  const inputs: { name: string; src: string }[] = [{ name: "in0", src: clip.src }];
  const args: string[] = [];

  // Une photo n'a qu'une image : sans `-loop`, le fichier produit durait une
  // frame. Elle est bouclée puis bornée par `-t`.
  if (clip.kind === "image") args.push("-loop", "1");
  // Rognage : `-ss` AVANT `-i` positionne la lecture sans décoder l'amont.
  if (clip.trimStart > 0) args.push("-ss", String(clip.trimStart));
  args.push("-i", "in0");

  if (overlayName) {
    inputs.push({ name: overlayName, src: "" });
    args.push("-i", overlayName);
  }

  const audible = p.audios.filter((a) => !a.muted && a.role !== "original" && a.length > 0);
  audible.forEach((a, i) => {
    inputs.push({ name: `aud${i}`, src: a.src });
    if (a.trimStart > 0) args.push("-ss", String(a.trimStart));
    args.push("-i", `aud${i}`);
  });

  const keepOriginal = !p.audios.some((a) => a.role === "original" && a.muted);
  const filters: string[] = [];

  // Vidéo : vitesse, cadrage au format, puis incrustation des calques.
  let vLabel = "0:v";
  const vSteps: string[] = [];
  if (clip.speed !== 1) vSteps.push(`setpts=${(1 / clip.speed).toFixed(4)}*PTS`);
  vSteps.push(...frameFilterSteps(clip, size));
  if (vSteps.length) {
    filters.push(`[0:v]${vSteps.join(",")}[vs]`);
    vLabel = "vs";
  }
  if (overlayName) {
    filters.push(`[${vLabel}][1:v]overlay=0:0[v]`);
    vLabel = "v";
  }

  // Audio : chaque piste ajoutée reçoit son volume et ses fondus, puis on mixe.
  const audioLabels: string[] = [];
  if (keepOriginal && clip.kind === "video") audioLabels.push("0:a");
  audible.forEach((a, i) => {
    const idx = (overlayName ? 2 : 1) + i;
    const steps = [`volume=${a.volume.toFixed(2)}`];
    if (a.fadeIn > 0) steps.push(`afade=t=in:st=0:d=${a.fadeIn}`);
    if (a.fadeOut > 0) steps.push(`afade=t=out:st=${Math.max(0, a.length - a.fadeOut).toFixed(2)}:d=${a.fadeOut}`);
    filters.push(`[${idx}:a]${steps.join(",")}[m${i}]`);
    audioLabels.push(`m${i}`);
  });

  let aLabel: string | null = null;
  if (audioLabels.length === 1) {
    aLabel = audioLabels[0];
  } else if (audioLabels.length > 1) {
    // `normalize=0` : sans lui, amix atténue chaque source de moitié et la
    // musique couvre la voix — le défaut corrigé au lot 0.
    filters.push(`[${audioLabels.join("][")}]amix=inputs=${audioLabels.length}:duration=shortest:normalize=0[a]`);
    aLabel = "a";
  }

  if (filters.length) args.push("-filter_complex", filters.join(";"));
  args.push("-map", vLabel.includes(":") ? vLabel : `[${vLabel}]`);
  if (aLabel) args.push("-map", aLabel.includes(":") ? aLabel : `[${aLabel}]`);

  args.push("-t", String(clip.length));
  // Une photo bouclée n'a pas de cadence propre : on la fixe.
  if (clip.kind === "image") args.push("-r", "30");
  // `veryfast` + CRF : le fichier produit est nettement plus léger qu'avec
  // `ultrafast`, ce qui accélère ensuite l'envoi vers les réseaux sociaux.
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p");
  if (aLabel) args.push("-c:a", "aac", "-b:a", "128k");
  args.push("-movflags", "+faststart", "out.mp4");

  return { inputs, args, output: "out.mp4" };
}
