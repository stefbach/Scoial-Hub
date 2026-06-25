// Studio Créatif — "marketing automatique" d'images ET vidéos.
// Produit un paquet professionnel multi-réseaux (assemblage, hooks, slides,
// sous-titres, overlays, montage, copy, hashtags, CTA, specs) à partir des médias.
//
// Avec ANTHROPIC_API_KEY → généré par Claude (directeur artistique), UN appel
// par réseau EN PARALLÈLE (réponses courtes & rapides, jamais de timeout/troncature).
// Sinon → paquet déterministe de haute qualité (dégradation gracieuse).

import { env, isAiConfigured, isVideoRenderConfigured } from "@/lib/env";
import {
  VIDEO_PLATFORMS,
  type AssemblyMode,
  type MarketizeInput,
  type MediaAsset,
  type PlatformCut,
  type Slide,
  type VideoMarketingPackage,
  type VideoPlatform,
  type CaptionSegment,
} from "./types";

function metaFor(p: VideoPlatform) {
  return VIDEO_PLATFORMS.find((m) => m.id === p) ?? VIDEO_PLATFORMS[0];
}

const renderStatus = (): PlatformCut["renderStatus"] =>
  isVideoRenderConfigured ? "queued" : "simulated";

const SHORT_VIDEO: VideoPlatform[] = ["tiktok", "instagram_reels", "instagram_story", "youtube_shorts", "facebook_story"];

/** Déduit le mode d'assemblage de base à partir des médias. */
function inferAssembly(assets: MediaAsset[], requested: AssemblyMode): AssemblyMode {
  if (requested !== "auto") return requested;
  const hasVideo = assets.some((a) => a.kind === "video");
  const images = assets.filter((a) => a.kind === "image").length;
  if (hasVideo && assets.length > 1) return "video_montage";
  if (hasVideo) return "video";
  if (images > 1) return "carousel";
  return "single";
}

/** Choisit le livrable réellement adapté au réseau. */
function assemblyForPlatform(base: AssemblyMode, p: VideoPlatform): AssemblyMode {
  if (base === "carousel" && SHORT_VIDEO.includes(p)) return "slideshow";
  if (base === "collage" && SHORT_VIDEO.includes(p)) return "slideshow";
  return base;
}

function isStatic(mode: AssemblyMode): boolean {
  return mode === "carousel" || mode === "collage" || mode === "single";
}

// ── Mock déterministe ───────────────────────────────────────────────────────────

function buildMock(input: MarketizeInput): VideoMarketingPackage {
  const fr = input.lang === "fr";
  const objective = input.objective || (fr ? "valoriser la marque" : "promote the brand");
  const base = inferAssembly(input.assets, input.assembly);
  const images = input.assets.filter((a) => a.kind === "image");
  const hasVideo = input.assets.some((a) => a.kind === "video");

  const slideTexts = fr
    ? ["Le problème que personne n'ose dire", "Voici comment on le règle", "La preuve en images", "Le résultat", "À vous de jouer 👉"]
    : ["The problem nobody admits", "Here's how we fix it", "Proof in pictures", "The result", "Your turn 👉"];

  function buildSlides(count: number): Slide[] {
    // Toutes les images sont utilisées (min 3 pour un diaporama crédible),
    // borne haute large (30) pour éviter un timeline démesuré par erreur.
    const n = Math.min(Math.max(count, 3), 30);
    return Array.from({ length: n }, (_, i) => ({
      index: i + 1,
      onImageText: slideTexts[i % slideTexts.length],
      note: fr
        ? i === 0 ? "Slide d'accroche : gros titre lisible, image la plus forte." : "Développe l'idée, une image = un message."
        : i === 0 ? "Hook slide: big readable headline, strongest image." : "Develop the idea, one image = one message.",
    }));
  }

  const captions: CaptionSegment[] = hasVideo
    ? [
        { start: 0, end: 3, text: fr ? "Voici ce que personne ne vous dit…" : "Here's what nobody tells you…" },
        { start: 3, end: 8, text: fr ? "En 30 secondes, l'essentiel." : "In 30 seconds, the essentials." },
        { start: 8, end: 15, text: fr ? "Le détail qui change tout." : "The detail that changes everything." },
        { start: 15, end: 22, text: fr ? "Le résultat parle de lui-même." : "The result speaks for itself." },
        { start: 22, end: 28, text: fr ? "Envie d'en savoir plus ?" : "Want to know more?" },
      ]
    : [];

  // Montage : durée de chaque plan. Le film = nb de clips × PER_CLIP (illimité).
  const PER_CLIP = 5;
  const videoCount = input.assets.filter((a) => a.kind === "video").length;
  // Durée du diaporama / vidéo simple = curseur de l'utilisateur (sans plafond 28s).
  const hintSec = Math.max(5, Math.round(Number(input.durationHintSec) || 20));

  const cuts: PlatformCut[] = input.platforms.map((p) => {
    const m = metaFor(p);
    const mode = assemblyForPlatform(base, p);
    const staticMode = isStatic(mode);
    const slides = mode === "single" ? [] : isStatic(mode) || mode === "slideshow" ? buildSlides(images.length || 4) : [];
    // MONTAGE → somme des plans (illimitée). Diaporama / vidéo → durée demandée.
    const targetSec = staticMode
      ? 0
      : mode === "video_montage"
      ? Math.max(videoCount, 1) * PER_CLIP
      : hintSec;

    return {
      platform: p,
      label: m.label,
      aspect: m.aspect,
      assemblyType: mode,
      targetDurationSec: targetSec,
      secondsPerClip: mode === "video_montage" ? PER_CLIP : undefined,
      hook: fr ? "Le secret qu'on ne vous montre jamais 👀" : "The secret they never show you 👀",
      hookVariants: fr
        ? ["Arrête de scroller, regarde ça.", "3 secondes pour tout comprendre.", "Tu fais sûrement cette erreur…"]
        : ["Stop scrolling, watch this.", "3 seconds to get it all.", "You're probably making this mistake…"],
      slides,
      overlays: staticMode
        ? []
        : [
            { atSecond: 0, text: fr ? "À NE PAS RATER" : "DON'T MISS THIS", style: "hook" },
            { atSecond: Math.min(8, Math.max(1, targetSec - 4)), text: m.label, style: "lower_third" },
            { atSecond: Math.max(2, targetSec - 4), text: fr ? "👉 En savoir plus" : "👉 Learn more", style: "cta" },
          ],
      musicMood: staticMode ? "" : SHORT_VIDEO.includes(p) ? (fr ? "Énergique, tendance, beat marqué" : "Energetic, trending, punchy beat") : (fr ? "Corporate inspirant" : "Inspiring corporate"),
      pacing: staticMode ? "" : SHORT_VIDEO.includes(p) ? (fr ? "Transitions rapides, 1 image/1,5 s" : "Fast transitions, 1 image/1.5s") : (fr ? "Rythme posé, 3-4 s par plan" : "Steady pace, 3-4s per shot"),
      editNotes:
        mode === "carousel"
          ? (fr ? ["Recadrer chaque image en " + m.aspect, "Titre lisible sur la 1re slide", "Garder un style cohérent (couleurs, police)", "Dernière slide = CTA clair"] : ["Reframe each image to " + m.aspect, "Readable headline on slide 1", "Keep a consistent style (colors, font)", "Last slide = clear CTA"])
          : mode === "collage"
          ? (fr ? ["Grille équilibrée 2×2 ou 3×1", "Marge homogène + fond de marque", "Un titre fort en surimpression"] : ["Balanced 2×2 or 3×1 grid", "Even margins + brand background", "One strong overlaid headline"])
          : mode === "single"
          ? (fr ? ["Recadrer en " + m.aspect, "Titre court + logo discret", "Contraste élevé pour le mobile"] : ["Reframe to " + m.aspect, "Short headline + subtle logo", "High contrast for mobile"])
          : (fr ? ["Recadrer en " + m.aspect, "Sous-titres animés mot-à-mot", "Couper les temps morts", "Zoom punch sur le hook", "Logo en filigrane"] : ["Reframe to " + m.aspect, "Animated word-by-word captions", "Cut dead time", "Punch-in zoom on the hook", "Watermark logo"]),
      caption: fr
        ? `On vous dévoile l'essentiel pour ${objective}. ${staticMode ? "Faites défiler 👉" : "Regardez jusqu'au bout 👇"}`
        : `We reveal what matters most to ${objective}. ${staticMode ? "Swipe 👉" : "Watch till the end 👇"}`,
      hashtags: SHORT_VIDEO.includes(p)
        ? ["#reels", "#astuce", "#business", "#fyp", "#" + m.label.toLowerCase().replace(/\s/g, "")]
        : ["#business", "#strategie", "#marketing", "#entreprise"],
      cta: fr ? "Commentez « INFO » pour recevoir le guide complet." : "Comment “INFO” to get the full guide.",
      thumbnailText: fr ? "LE DÉTAIL QUI CHANGE TOUT" : "THE DETAIL THAT CHANGES IT ALL",
      renderStatus: renderStatus(),
    };
  });

  return {
    assets: input.assets,
    assembly: base,
    title: fr ? "Création marketée automatiquement" : "Auto-marketed creative",
    summary: fr
      ? "Vos médias bruts assemblés en plusieurs déclinaisons prêtes à publier, optimisées par réseau."
      : "Your raw media assembled into several publish-ready cuts, optimised per network.",
    transcriptSummary: hasVideo
      ? (fr ? "Transcription non disponible (clé IA absente)." : "Transcript unavailable (no AI key).")
      : (fr ? "Médias images — pas de transcription nécessaire." : "Image media — no transcript needed."),
    brandSafe: true,
    captions,
    cuts,
    aiGenerated: false,
    renderConfigured: isVideoRenderConfigured,
    createdAt: new Date().toISOString(),
  };
}

// ── Génération via Claude (UN appel par réseau, en parallèle) ─────────────────────

interface CutResult {
  cut: PlatformCut;
  title?: string;
  summary?: string;
  transcript?: string;
  captions?: CaptionSegment[];
}

async function buildOneCut(
  input: MarketizeInput,
  base: AssemblyMode,
  platform: VideoPlatform
): Promise<CutResult | null> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: env.anthropicKey });
  const m = metaFor(platform);
  const images = input.assets.filter((a) => a.kind === "image").length;
  const videos = input.assets.filter((a) => a.kind === "video").length;

  const prompt = `Tu es directeur artistique & social media manager senior. À partir de MÉDIAS BRUTS (photos/vidéos), tu conçois UNE déclinaison marketing pro pour LE réseau ${m.label} (${m.id}), format ${m.aspect}, durée max ${m.maxSeconds}s.

Médias : ${input.assets.length} (${images} image(s), ${videos} vidéo(s)). Assemblage de base déduit : ${base}.
Objectif : ${input.objective || "non précisé"}. Ton de marque : ${input.brandVoice || "professionnel, dynamique"}. Langue des textes : ${input.lang === "fr" ? "français" : "anglais"}.

Choisis "assemblyType" adapté à CE réseau : carousel | slideshow | collage | single | video | video_montage. Rappel : TikTok/Reels/Shorts ne supportent pas le carrousel → "slideshow".

Réponds UNIQUEMENT en JSON strict, COMPACT (aucun texte autour) :
{
 "projectTitle":"titre court du projet",
 "projectSummary":"1 phrase : angle marketing",
 "transcriptSummary":"résumé/description bref",
 "captions":[{"start":0,"end":3,"text":"sous-titre court"}],
 "cut":{
  "assemblyType":"...","targetDurationSec":0,
  "hook":"accroche forte","hookVariants":["variante 1","variante 2"],
  "slides":[{"index":1,"onImageText":"texte sur l'image","note":"quoi montrer"}],
  "overlays":[{"atSecond":0,"text":"texte écran","style":"hook"}],
  "musicMood":"","pacing":"","editNotes":["note 1","note 2","note 3"],
  "caption":"texte du post","hashtags":["#a","#b"],"cta":"appel à l'action","thumbnailText":"TEXTE MAJUSCULES"
 }
}
Limites STRICTES : slides ≤ 5, hookVariants ≤ 2, editNotes ≤ 4, captions ≤ 5, hashtags ≤ 6. Si format statique → targetDurationSec=0 et overlays/musicMood/pacing vides. Sois concret et vendeur.`;

  const message = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 1600,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: {
    projectTitle?: string;
    projectSummary?: string;
    transcriptSummary?: string;
    captions?: CaptionSegment[];
    cut?: Partial<PlatformCut> & { assemblyType?: AssemblyMode };
  };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  const c = parsed.cut ?? {};
  const assemblyType = (c.assemblyType ?? base) as AssemblyMode;
  // MONTAGE → durée = nb de clips × plan (illimité). Sinon → valeur IA bornée au
  // maximum réel du réseau (et non plus à 28 s).
  const PER_CLIP = 5;
  const targetDurationSec =
    assemblyType === "video_montage"
      ? Math.max(videos, 1) * PER_CLIP
      : Math.min(Math.max(0, Math.round(Number(c.targetDurationSec) || 0)), m.maxSeconds);
  const cut: PlatformCut = {
    platform,
    label: m.label,
    aspect: m.aspect,
    assemblyType,
    targetDurationSec,
    secondsPerClip: assemblyType === "video_montage" ? PER_CLIP : undefined,
    hook: c.hook ?? "",
    hookVariants: c.hookVariants ?? [],
    slides: c.slides ?? [],
    overlays: c.overlays ?? [],
    musicMood: c.musicMood ?? "",
    pacing: c.pacing ?? "",
    editNotes: c.editNotes ?? [],
    caption: c.caption ?? "",
    hashtags: c.hashtags ?? [],
    cta: c.cta ?? "",
    thumbnailText: c.thumbnailText ?? "",
    renderStatus: renderStatus(),
  };

  return {
    cut,
    title: parsed.projectTitle,
    summary: parsed.projectSummary,
    transcript: parsed.transcriptSummary,
    captions: parsed.captions,
  };
}

async function buildWithClaude(input: MarketizeInput): Promise<VideoMarketingPackage> {
  const base = inferAssembly(input.assets, input.assembly);

  // Un appel par réseau, en parallèle. Un échec isolé n'annule pas les autres.
  const results = await Promise.all(
    input.platforms.map((p) => buildOneCut(input, base, p).catch(() => null))
  );
  const ok = results.filter((r): r is CutResult => r !== null);
  if (ok.length === 0) throw new Error("Aucune déclinaison générée par Claude");

  const fr = input.lang === "fr";
  const meta = ok[0];
  const captions = ok.find((r) => r.captions && r.captions.length > 0)?.captions ?? [];

  return {
    assets: input.assets,
    assembly: base,
    title: meta.title ?? (fr ? "Création marketée automatiquement" : "Auto-marketed creative"),
    summary:
      meta.summary ??
      (fr ? "Médias assemblés en déclinaisons prêtes à publier, optimisées par réseau." : "Media assembled into publish-ready, network-optimised cuts."),
    transcriptSummary: meta.transcript ?? "",
    brandSafe: true,
    captions,
    cuts: ok.map((r) => r.cut),
    aiGenerated: true,
    renderConfigured: isVideoRenderConfigured,
    createdAt: new Date().toISOString(),
  };
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

export async function marketizeVideo(input: MarketizeInput): Promise<VideoMarketingPackage> {
  if (!isAiConfigured || input.platforms.length === 0) {
    return buildMock(input);
  }
  try {
    return await buildWithClaude(input);
  } catch (err) {
    console.error("[studio/marketer] fallback mock:", err);
    return buildMock(input);
  }
}
