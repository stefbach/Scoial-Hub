// Studio Créatif — "marketing automatique" d'images ET vidéos.
// Produit un paquet professionnel multi-réseaux (assemblage, hooks, slides,
// sous-titres, overlays, montage, copy, hashtags, CTA, specs) à partir des médias.
//
// Avec ANTHROPIC_API_KEY → généré par Claude (directeur artistique).
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

const SHORT_VIDEO: VideoPlatform[] = ["tiktok", "instagram_reels", "youtube_shorts"];

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
  // Un carrousel n'existe pas en TikTok/Reels/Shorts → diaporama vidéo.
  if (base === "carousel" && SHORT_VIDEO.includes(p)) return "slideshow";
  // Un collage statique sur réseaux vidéo courts → diaporama.
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
    const n = Math.max(count, 3);
    return Array.from({ length: Math.min(n, 6) }, (_, i) => ({
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

  const cuts: PlatformCut[] = input.platforms.map((p) => {
    const m = metaFor(p);
    const mode = assemblyForPlatform(base, p);
    const staticMode = isStatic(mode);
    const slides = mode === "single" ? [] : isStatic(mode) || mode === "slideshow" ? buildSlides(images.length || 4) : [];

    return {
      platform: p,
      label: m.label,
      aspect: m.aspect,
      assemblyType: mode,
      targetDurationSec: staticMode ? 0 : Math.min(m.maxSeconds, 28),
      hook: fr ? "Le secret qu'on ne vous montre jamais 👀" : "The secret they never show you 👀",
      hookVariants: fr
        ? ["Arrête de scroller, regarde ça.", "3 secondes pour tout comprendre.", "Tu fais sûrement cette erreur…"]
        : ["Stop scrolling, watch this.", "3 seconds to get it all.", "You're probably making this mistake…"],
      slides,
      overlays: staticMode
        ? []
        : [
            { atSecond: 0, text: fr ? "À NE PAS RATER" : "DON'T MISS THIS", style: "hook" },
            { atSecond: 8, text: m.label, style: "lower_third" },
            { atSecond: Math.min(m.maxSeconds, 26), text: fr ? "👉 En savoir plus" : "👉 Learn more", style: "cta" },
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

// ── Génération via Claude ────────────────────────────────────────────────────────

async function buildWithClaude(input: MarketizeInput): Promise<VideoMarketingPackage> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: env.anthropicKey });

  const base = inferAssembly(input.assets, input.assembly);
  const assetList = input.assets
    .map((a, i) => `  ${i + 1}. [${a.kind}] ${a.name ?? a.url}`)
    .join("\n");
  const platformSpec = input.platforms
    .map((p) => {
      const m = metaFor(p);
      return `- ${m.id} (${m.label}) — format ${m.aspect}, max ${m.maxSeconds}s`;
    })
    .join("\n");

  const prompt = `Tu es directeur artistique & social media manager senior. À partir des MÉDIAS BRUTS fournis (photos et/ou vidéos), tu conçois un dispositif de marketing automatique professionnel : tu ASSEMBLES et déclines le contenu réseau par réseau.

Médias fournis (${input.assets.length}) :
${assetList || "  (aucun détail — déduis du contexte)"}

Mode d'assemblage demandé : ${input.assembly} (base déduite : ${base})
Objectif marketing : ${input.objective || "non précisé"}
Ton de marque : ${input.brandVoice || "professionnel, dynamique"}
Langue des textes : ${input.lang === "fr" ? "français" : "anglais"}

Réseaux cibles :
${platformSpec}

Pour CHAQUE réseau, choisis le livrable le plus adapté (assemblyType) :
"carousel" (post multi-images), "slideshow" (photos animées en vidéo), "collage" (un visuel composé), "single" (un visuel unique), "video" (ré-édition d'une vidéo), "video_montage" (montage de clips).
Rappel : TikTok/Reels/Shorts ne supportent pas le carrousel → préfère "slideshow".

Produis UNIQUEMENT un JSON strict (aucun texte avant/après) :
{
  "title": "titre court du projet",
  "summary": "1-2 phrases : ce que l'on assemble et l'angle marketing",
  "transcriptSummary": "résumé du propos (vidéo) ou description (images)",
  "captions": [ { "start": number_sec, "end": number_sec, "text": "sous-titre incrusté" } ],
  "cuts": [
    {
      "platform": "tiktok|instagram_reels|youtube_shorts|facebook|linkedin",
      "assemblyType": "carousel|slideshow|collage|single|video|video_montage",
      "targetDurationSec": number (0 si format statique),
      "hook": "accroche forte",
      "hookVariants": ["3 variantes"],
      "slides": [ { "index": number, "onImageText": "texte incrusté sur l'image", "note": "ce qu'il faut montrer" } ],
      "overlays": [ { "atSecond": number, "text": "texte écran", "style": "hook|lower_third|cta" } ],
      "musicMood": "ambiance (vide si statique)",
      "pacing": "rythme (vide si statique)",
      "editNotes": ["instructions de montage/assemblage concrètes"],
      "caption": "texte du post",
      "hashtags": ["#..."],
      "cta": "appel à l'action",
      "thumbnailText": "texte de couverture en MAJUSCULES"
    }
  ]
}

Règles : une entrée "cuts" par réseau, au bon format d'aspect. Pour carousel/slideshow/collage, remplis "slides". Pour vidéo, remplis overlays/musicMood/pacing. Sois concret, vendeur et actionnable.`;

  const message = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 3500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude n'a pas retourné de JSON valide");
  const parsed = JSON.parse(jsonMatch[0]) as {
    title: string;
    summary: string;
    transcriptSummary: string;
    captions: CaptionSegment[];
    cuts: Array<Partial<PlatformCut> & { platform: string; assemblyType?: AssemblyMode }>;
  };

  const cuts: PlatformCut[] = parsed.cuts.map((c) => {
    const m = metaFor(c.platform as VideoPlatform);
    return {
      platform: c.platform as VideoPlatform,
      label: m.label,
      aspect: m.aspect,
      assemblyType: (c.assemblyType ?? base) as AssemblyMode,
      targetDurationSec: c.targetDurationSec ?? 0,
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
  });

  return {
    assets: input.assets,
    assembly: base,
    title: parsed.title,
    summary: parsed.summary,
    transcriptSummary: parsed.transcriptSummary,
    brandSafe: true,
    captions: parsed.captions ?? [],
    cuts,
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
