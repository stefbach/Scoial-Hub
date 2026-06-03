// Studio Vidéo — moteur de "marketing automatique" d'une vidéo brute.
// Produit un paquet professionnel multi-réseaux (hooks, sous-titres incrustés,
// overlays, montage, copy, hashtags, CTA, specs de rendu) à partir d'une vidéo.
//
// Avec ANTHROPIC_API_KEY → généré par Claude (directeur artistique vidéo).
// Sinon → paquet déterministe de haute qualité (dégradation gracieuse).

import { env, isAiConfigured, isVideoRenderConfigured } from "@/lib/env";
import {
  VIDEO_PLATFORMS,
  type MarketizeInput,
  type PlatformCut,
  type VideoMarketingPackage,
  type VideoPlatform,
  type CaptionSegment,
} from "./types";

function metaFor(p: VideoPlatform) {
  return VIDEO_PLATFORMS.find((m) => m.id === p) ?? VIDEO_PLATFORMS[0];
}

const renderStatus = (): PlatformCut["renderStatus"] =>
  isVideoRenderConfigured ? "queued" : "simulated";

// ── Mock déterministe ───────────────────────────────────────────────────────────

function buildMock(input: MarketizeInput): VideoMarketingPackage {
  const fr = input.lang === "fr";
  const objective = input.objective || (fr ? "valoriser la marque" : "promote the brand");

  const captions: CaptionSegment[] = [
    { start: 0, end: 3, text: fr ? "Voici ce que personne ne vous dit…" : "Here's what nobody tells you…" },
    { start: 3, end: 8, text: fr ? "En 30 secondes, on vous montre l'essentiel." : "In 30 seconds, we show you the essentials." },
    { start: 8, end: 15, text: fr ? "Le détail qui change tout." : "The detail that changes everything." },
    { start: 15, end: 22, text: fr ? "Et le résultat parle de lui-même." : "And the result speaks for itself." },
    { start: 22, end: 28, text: fr ? "Envie d'en savoir plus ?" : "Want to know more?" },
  ];

  const cuts: PlatformCut[] = input.platforms.map((p) => {
    const m = metaFor(p);
    const vertical = m.aspect === "9:16";
    return {
      platform: p,
      label: m.label,
      aspect: m.aspect,
      targetDurationSec: Math.min(m.maxSeconds, vertical ? 28 : 45),
      hook: fr ? "Le secret qu'on ne vous montre jamais 👀" : "The secret they never show you 👀",
      hookVariants: fr
        ? ["Arrête de scroller, regarde ça.", "3 secondes pour tout comprendre.", "Tu fais sûrement cette erreur…"]
        : ["Stop scrolling, watch this.", "3 seconds to get it all.", "You're probably making this mistake…"],
      overlays: [
        { atSecond: 0, text: fr ? "À NE PAS RATER" : "DON'T MISS THIS", style: "hook" },
        { atSecond: 8, text: m.label, style: "lower_third" },
        { atSecond: Math.min(m.maxSeconds, vertical ? 26 : 42), text: fr ? "👉 En savoir plus" : "👉 Learn more", style: "cta" },
      ],
      musicMood: vertical ? (fr ? "Énergique, tendance, beat marqué" : "Energetic, trending, punchy beat") : (fr ? "Corporate inspirant, montée progressive" : "Inspiring corporate, gradual build"),
      pacing: vertical ? (fr ? "Coupes dynamiques toutes les 2-3 s" : "Dynamic cuts every 2-3s") : (fr ? "Rythme posé, plans de 4-5 s" : "Steady pace, 4-5s shots"),
      editNotes: fr
        ? ["Recadrer au format " + m.aspect, "Incruster les sous-titres animés mot-à-mot", "Couper les silences > 0,4 s", "Ajouter un zoom punch sur le hook", "Insérer le logo en filigrane (coin haut-droit)"]
        : ["Reframe to " + m.aspect, "Burn animated word-by-word captions", "Cut silences > 0.4s", "Add a punch-in zoom on the hook", "Add watermark logo (top-right)"],
      caption: fr
        ? `On vous dévoile l'essentiel pour ${objective}. Regardez jusqu'au bout 👇`
        : `We reveal what matters most to ${objective}. Watch till the end 👇`,
      hashtags: vertical
        ? ["#reels", "#astuce", "#business", "#fyp", "#" + (m.label.toLowerCase().replace(/\s/g, ""))]
        : ["#business", "#strategie", "#marketing", "#entreprise"],
      cta: fr ? "Commentez « INFO » pour recevoir le guide complet." : "Comment “INFO” to get the full guide.",
      thumbnailText: fr ? "LE DÉTAIL QUI CHANGE TOUT" : "THE DETAIL THAT CHANGES IT ALL",
      renderStatus: renderStatus(),
    };
  });

  return {
    sourceUrl: input.sourceUrl,
    title: fr ? "Vidéo marketée automatiquement" : "Auto-marketed video",
    summary: fr
      ? "Vidéo brute retraitée en plusieurs déclinaisons prêtes à publier, optimisées par réseau."
      : "Raw video reprocessed into several publish-ready cuts, optimised per network.",
    transcriptSummary: fr
      ? "Transcription non disponible (clé IA absente) — paquet généré à partir de modèles éprouvés."
      : "Transcript unavailable (no AI key) — package built from proven templates.",
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

  const platformSpec = input.platforms
    .map((p) => {
      const m = metaFor(p);
      return `- ${m.id} (${m.label}) — format ${m.aspect}, max ${m.maxSeconds}s`;
    })
    .join("\n");

  const prompt = `Tu es directeur artistique vidéo et social media manager senior. À partir d'une vidéo BRUTE fournie par le client, tu conçois un dispositif de "marketing automatique" professionnel : déclinaisons prêtes à publier, optimisées réseau par réseau.

Vidéo source (URL) : ${input.sourceUrl}
Objectif marketing : ${input.objective || "non précisé"}
Ton de marque : ${input.brandVoice || "professionnel, dynamique"}
Langue des textes à produire : ${input.lang === "fr" ? "français" : "anglais"}
Durée approximative : ${input.durationHintSec ? input.durationHintSec + "s" : "inconnue"}

Réseaux cibles :
${platformSpec}

Produis UNIQUEMENT un JSON strict (aucun texte avant/après) :
{
  "title": "titre court du projet",
  "summary": "1-2 phrases : ce que la vidéo raconte et l'angle marketing retenu",
  "transcriptSummary": "résumé du propos probable de la vidéo (déduis-le de l'objectif)",
  "captions": [ { "start": number_sec, "end": number_sec, "text": "sous-titre incrusté court" } ],
  "cuts": [
    {
      "platform": "tiktok|instagram_reels|youtube_shorts|facebook|linkedin",
      "targetDurationSec": number,
      "hook": "accroche des 3 premières secondes",
      "hookVariants": ["3 variantes d'accroche"],
      "overlays": [ { "atSecond": number, "text": "texte écran", "style": "hook|lower_third|cta" } ],
      "musicMood": "ambiance musicale",
      "pacing": "rythme de montage",
      "editNotes": ["instructions de montage concrètes : recadrage, sous-titres, coupes, zooms, logo"],
      "caption": "texte du post",
      "hashtags": ["#..."],
      "cta": "appel à l'action",
      "thumbnailText": "texte de vignette en MAJUSCULES"
    }
  ]
}

Règles : une entrée "cuts" par réseau demandé, dans le bon format d'aspect. Sois concret, vendeur et actionnable.`;

  const message = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 3000,
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
    cuts: Array<Omit<PlatformCut, "label" | "aspect" | "renderStatus">>;
  };

  const cuts: PlatformCut[] = parsed.cuts.map((c) => {
    const m = metaFor(c.platform as VideoPlatform);
    return {
      ...c,
      platform: c.platform as VideoPlatform,
      label: m.label,
      aspect: m.aspect,
      hookVariants: c.hookVariants ?? [],
      overlays: c.overlays ?? [],
      editNotes: c.editNotes ?? [],
      hashtags: c.hashtags ?? [],
      renderStatus: renderStatus(),
    };
  });

  return {
    sourceUrl: input.sourceUrl,
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
    console.error("[video/marketer] fallback mock:", err);
    return buildMock(input);
  }
}
