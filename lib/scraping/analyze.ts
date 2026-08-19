/**
 * Analyse concurrentielle par IA (Claude).
 *
 * Si ANTHROPIC_API_KEY est configuré, appelle Claude pour produire une analyse
 * structurée à partir des contenus collectés.
 * Sinon, retourne un mock cohérent et déterministe.
 */

import { isAiConfigured, env } from "@/lib/env";
import type { CompetitorContent, ScrapeQuery } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
   Types de sortie
───────────────────────────────────────────────────────────────────────────── */

export interface FormatGagnant {
  type: string;
  network: string;
  engagementMoyen: number;
  description: string;
}

export interface AngleThematique {
  angle: string;
  exemples: string[];
  potentiel: "fort" | "moyen" | "faible";
}

export interface BenchmarkMetrics {
  network: string;
  medianeLikes: number;
  medianeVues: number;
  tauxEngagementMoyen: number;
  fréquencePostsSemaine: number;
}

export interface Recommandation {
  priorite: "haute" | "moyenne" | "basse";
  titre: string;
  detail: string;
  action: string;
}

/** Profil d'un concurrent puissant + analyse de sa stratégie. */
export interface CompetitorProfile {
  handle: string;
  network: string;
  /** Nombre de contenus analysés. */
  nbPosts: number;
  /** Engagement moyen (likes+commentaires) par post. */
  engagementMoyen: number;
  /** Vues moyennes par post. */
  vuesMoyennes: number;
  /** Format dominant observé. */
  formatDominant: string;
  /** Score de puissance relatif (0-100). */
  scorePuissance: number;
  /** Synthèse de sa stratégie de contenu (par l'IA). */
  strategie: string;
  /** Pourquoi ce concurrent est puissant (par l'IA). */
  pourquoiPuissant: string;
}

export interface AnalysisResult {
  /** Résumé exécutif (2-3 phrases). */
  resume: string;
  /** Formats de contenu générant le plus d'engagement. */
  formatsGagnants: FormatGagnant[];
  /** Angles thématiques performants détectés. */
  anglesThematiques: AngleThematique[];
  /** Fréquence de publication recommandée. */
  frequenceRecommandee: string;
  /** Fourchettes d'engagement observées par réseau. */
  benchmarkParReseau: BenchmarkMetrics[];
  /** Recommandations stratégiques actionnables. */
  recommandations: Recommandation[];
  /** Concurrents les plus puissants, classés, avec analyse de leur stratégie. */
  competiteurs: CompetitorProfile[];
  /** Indique si l'analyse est issue de Claude (true) ou du mock (false). */
  aiGenerated: boolean;
  /** Horodatage de l'analyse. */
  analyzedAt: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Agrégation par concurrent (chiffres réels) + score de puissance
───────────────────────────────────────────────────────────────────────────── */

function computeProfiles(contents: CompetitorContent[]): CompetitorProfile[] {
  const byHandle = new Map<string, CompetitorContent[]>();
  for (const c of contents) {
    const key = `${c.network}|${c.handle}`;
    const arr = byHandle.get(key);
    if (arr) arr.push(c);
    else byHandle.set(key, [c]);
  }
  const profiles: CompetitorProfile[] = [];
  for (const [key, items] of byHandle) {
    const [network, handle] = key.split("|");
    const n = items.length || 1;
    const eng = items.reduce((s, c) => s + c.likes + c.comments, 0) / n;
    const vues = items.reduce((s, c) => s + c.views, 0) / n;
    const typeCount: Record<string, number> = {};
    for (const c of items) typeCount[c.type] = (typeCount[c.type] || 0) + 1;
    const formatDominant = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "post";
    profiles.push({
      handle,
      network,
      nbPosts: items.length,
      engagementMoyen: Math.round(eng),
      vuesMoyennes: Math.round(vues),
      formatDominant,
      scorePuissance: 0,
      strategie: "",
      pourquoiPuissant: "",
    });
  }
  const maxScore = Math.max(...profiles.map((p) => p.engagementMoyen + p.vuesMoyennes * 0.1), 1);
  for (const p of profiles) {
    p.scorePuissance = Math.round(((p.engagementMoyen + p.vuesMoyennes * 0.1) / maxScore) * 100);
  }
  profiles.sort((a, b) => b.scorePuissance - a.scorePuissance);
  return profiles.slice(0, 6);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mock déterministe
───────────────────────────────────────────────────────────────────────────── */

function buildMockAnalysis(
  query: ScrapeQuery,
  contents: CompetitorContent[],
  language: "fr" | "en" = "fr"
): AnalysisResult {
  // Analyse de REPLI (aucune IA configurée, ou aucun contenu collecté). Ses
  // textes étaient codés en dur en français et s'affichaient tels quels sur une
  // interface en anglais — c'est le gros des « textes IA en français ».
  const en = language === "en";
  const L = (fr: string, engl: string) => (en ? engl : fr);
  const networks = [...new Set(contents.map((c) => c.network))];
  const theme = query.theme || query.keywords[0] || L("votre secteur", "your sector");

  const benchmarkParReseau: BenchmarkMetrics[] = networks.map((network) => {
    const netContents = contents.filter((c) => c.network === network);
    const avgLikes = netContents.length
      ? Math.round(netContents.reduce((s, c) => s + c.likes, 0) / netContents.length)
      : 0;
    const avgViews = netContents.length
      ? Math.round(netContents.reduce((s, c) => s + c.views, 0) / netContents.length)
      : 0;
    const avgEr = netContents.length
      ? parseFloat((netContents.reduce((s, c) => s + c.engagementRate, 0) / netContents.length).toFixed(4))
      : 0;

    return {
      network,
      medianeLikes: avgLikes,
      medianeVues: avgViews,
      tauxEngagementMoyen: avgEr,
      fréquencePostsSemaine: network === "tiktok" ? 7 : network === "instagram" ? 5 : 3,
    };
  });

  return {
    resume: contents.length === 0
      ? L(
          `Aucun contenu concurrent n'a pu être collecté pour "${theme}" dans la zone ${query.geo.toUpperCase()}. Ajoutez des concurrents à surveiller (ou utilisez « Identifier ») : sans eux, l'analyse ne repose sur aucune donnée réelle.`,
          `No competitor content could be collected for "${theme}" in ${query.geo.toUpperCase()}. Add competitors to monitor (or use "Identify"): without them the analysis has no real data to work from.`
        )
      : L(
          `L'analyse de ${contents.length} contenus concurrents sur ${networks.join(", ")} révèle que la thématique "${theme}" génère un fort engagement dans la zone ${query.geo.toUpperCase()}. Les formats vidéo courts et les contenus éducatifs dominent les performances.`,
          `Analysing ${contents.length} competitor posts on ${networks.join(", ")} shows that "${theme}" drives strong engagement in ${query.geo.toUpperCase()}. Short-form video and educational content lead performance.`
        ),
    formatsGagnants: [
      { type: L("Vidéo courte (< 60s)", "Short video (< 60s)"), network: "tiktok", engagementMoyen: 0.08, description: L("Format dominant — taux d'engagement 2× supérieur aux autres formats.", "Leading format — twice the engagement rate of other formats.") },
      { type: L("Carrousel éducatif", "Educational carousel"), network: "instagram", engagementMoyen: 0.06, description: L("Sauvegarde élevée, idéal pour contenus à valeur ajoutée.", "High save rate, ideal for value-driven content.") },
      { type: L("Thread long", "Long-form thread"), network: "linkedin", engagementMoyen: 0.05, description: L("Expertise visible, partages professionnels.", "Visible expertise, professional shares.") },
      { type: L("Tutoriel vidéo", "Video tutorial"), network: "youtube", engagementMoyen: 0.04, description: L("Longue durée de vie, référencement naturel.", "Long shelf life, organic search reach.") },
    ],
    anglesThematiques: [
      { angle: L(`Coulisses & authenticité autour de "${theme}"`, `Behind the scenes & authenticity around "${theme}"`), exemples: [L("Coulisses", "Behind the scenes"), L("Processus de création", "Creative process"), L("Échecs et apprentissages", "Failures and lessons")], potentiel: "fort" },
      { angle: L("Chiffres & études de cas sectoriels", "Data & sector case studies"), exemples: [L("Statistiques surprenantes", "Surprising statistics"), L("Résultats concrets", "Concrete results"), L("Comparatifs", "Comparisons")], potentiel: "fort" },
      { angle: L("Tutoriels pratiques pas-à-pas", "Step-by-step practical tutorials"), exemples: [L("Mode d'emploi", "How-to"), L("Astuces rapides", "Quick tips"), L("Checklist", "Checklist")], potentiel: "moyen" },
      { angle: L("Tendances & actualités du secteur", "Sector trends & news"), exemples: [L("News commentées", "Commented news"), L("Prédictions", "Predictions"), L("Prises de position", "Hot takes")], potentiel: "moyen" },
    ],
    frequenceRecommandee: L("3 à 5 publications/semaine sur Instagram et TikTok, 2 à 3 sur LinkedIn, 1 vidéo YouTube hebdomadaire.", "3 to 5 posts/week on Instagram and TikTok, 2 to 3 on LinkedIn, 1 YouTube video weekly."),
    benchmarkParReseau,
    recommandations: [
      { priorite: "haute", titre: L("Miser sur la vidéo courte", "Bet on short-form video"), detail: L("Les vidéos < 60s génèrent en moyenne 2,4× plus d'engagement que les posts statiques chez vos concurrents.", "Videos under 60s average 2.4× the engagement of static posts among your competitors."), action: L("Créer 3 Reels/TikToks par semaine sur les usages concrets de votre offre.", "Produce 3 Reels/TikToks a week on concrete uses of your offer.") },
      { priorite: "haute", titre: L("Augmenter la fréquence de publication", "Increase posting frequency"), detail: L("Vos concurrents publient 4,5× par semaine en moyenne. Vous êtes en dessous de ce rythme.", "Your competitors post 4.5 times a week on average. You are below that pace."), action: L("Mettre en place un calendrier éditorial avec minimum 4 posts/semaine.", "Set up an editorial calendar with at least 4 posts a week.") },
      { priorite: "moyenne", titre: L("Exploiter les angles éducatifs", "Lean into educational angles"), detail: L("Les contenus \"comment faire\" génèrent +40 % de sauvegardes, signal fort pour l'algorithme.", "How-to content drives 40% more saves, a strong algorithmic signal."), action: L("Produire une série de posts éducatifs sur les fondamentaux de votre secteur.", "Produce a series of educational posts on your sector's fundamentals.") },
      { priorite: "basse", titre: L("Tester les collaborations", "Test collaborations"), detail: L("Plusieurs concurrents utilisent les UGC et les collab-posts avec des micro-influenceurs locaux.", "Several competitors use UGC and collab posts with local micro-influencers."), action: L("Identifier 3 créateurs alignés avec votre marque pour des partenariats test.", "Identify 3 creators aligned with your brand for trial partnerships.") },
    ],
    competiteurs: computeProfiles(contents).map((p) => ({
      ...p,
      strategie: L(
        `Publie majoritairement des ${p.formatDominant}s (${p.nbPosts} contenus analysés), avec un engagement moyen de ${p.engagementMoyen} par publication.`,
        `Mostly posts ${p.formatDominant}s (${p.nbPosts} items analysed), averaging ${p.engagementMoyen} engagement per post.`
      ),
      pourquoiPuissant: L(
        `Forte régularité et un engagement supérieur à la moyenne du marché — audience fidèle et formats calibrés pour l'algorithme.`,
        `Strong consistency and above-market engagement — a loyal audience and formats tuned for the algorithm.`
      ),
    })),
    aiGenerated: false,
    analyzedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Analyse via Claude
───────────────────────────────────────────────────────────────────────────── */

async function analyzeWithClaude(
  query: ScrapeQuery,
  contents: CompetitorContent[],
  language: "fr" | "en" = "fr"
): Promise<AnalysisResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const { createClaudeMessage } = await import("@/lib/ai/anthropic");
  const client = new Anthropic({ apiKey: env.anthropicKey });

  // Profils agrégés (chiffres réels) classés par puissance
  const profiles = computeProfiles(contents);
  const profilesResume = profiles.map((p) => ({
    handle: p.handle,
    network: p.network,
    nbPosts: p.nbPosts,
    engagementMoyen: p.engagementMoyen,
    vuesMoyennes: p.vuesMoyennes,
    formatDominant: p.formatDominant,
    scorePuissance: p.scorePuissance,
  }));

  // Résumé compact des contenus pour limiter les tokens
  const contentsResume = contents.slice(0, 20).map((c) => ({
    handle: c.handle,
    network: c.network,
    type: c.type,
    caption: c.caption.slice(0, 110),
    likes: c.likes,
    comments: c.comments,
    views: c.views,
    postedAt: c.postedAt,
  }));

  const prompt = `Tu es un expert en veille concurrentielle social media. À partir des PROFILS concurrents (chiffres réels, classés par puissance) et d'un échantillon de leurs contenus, identifie les concurrents les PLUS PUISSANTS et explique précisément LEUR STRATÉGIE et POURQUOI ils dominent.

Contexte :
- Thématique : ${query.theme || "non précisée"}
- Mots-clés : ${query.keywords.join(", ") || "aucun"}
- Zone géographique : ${query.geo.toUpperCase()}
- Réseaux : ${[...new Set(contents.map((c) => c.network))].join(", ")}

Profils concurrents (classés par puissance, chiffres RÉELS) :
${JSON.stringify(profilesResume, null, 2)}

Échantillon de contenus :
${JSON.stringify(contentsResume, null, 2)}

Produis UNIQUEMENT ce JSON strict (aucun texte autour) :
{
  "resume": "2-3 phrases : qui domine ce marché et pourquoi",
  "formatsGagnants": [ { "type": "string", "network": "string", "engagementMoyen": number, "description": "string" } ],
  "anglesThematiques": [ { "angle": "string", "exemples": ["string"], "potentiel": "fort|moyen|faible" } ],
  "frequenceRecommandee": "string",
  "benchmarkParReseau": [ { "network": "string", "medianeLikes": number, "medianeVues": number, "tauxEngagementMoyen": number, "fréquencePostsSemaine": number } ],
  "recommandations": [ { "priorite": "haute|moyenne|basse", "titre": "string", "detail": "string", "action": "string" } ],
  "competiteurs": [ { "handle": "exactement le handle fourni", "strategie": "2 phrases : piliers de contenu, formats, ton, cadence", "pourquoiPuissant": "2 phrases : ce qui explique sa domination (audience, régularité, angle, communauté…)" } ]
}

Règles : max 3 formatsGagnants, max 3 anglesThematiques, max 4 recommandations. Un objet "competiteurs" par profil fourni, du plus puissant au moins puissant. ${language === "en" ? "Write ALL textual values (resume, descriptions, angles, titres, details, actions, strategie, pourquoiPuissant…) in ENGLISH" : "Réponds en français"}, concret.`;

  const message = await createClaudeMessage(client, {
    model: env.anthropicModel,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude n'a pas retourné de JSON valide");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<
    AnalysisResult,
    "aiGenerated" | "analyzedAt" | "competiteurs"
  > & { competiteurs?: Array<{ handle: string; strategie?: string; pourquoiPuissant?: string }> };

  // Fusionne le texte IA (stratégie / pourquoi puissant) avec les chiffres réels.
  const norm = (h: string) => h.replace(/^@/, "").toLowerCase();
  const aiMap = new Map<string, { strategie?: string; pourquoiPuissant?: string }>();
  for (const c of parsed.competiteurs ?? []) aiMap.set(norm(c.handle), c);
  const competiteurs: CompetitorProfile[] = profiles.map((p) => {
    const m = aiMap.get(norm(p.handle));
    return {
      ...p,
      strategie: m?.strategie || p.strategie || "",
      pourquoiPuissant: m?.pourquoiPuissant || p.pourquoiPuissant || "",
    };
  });

  const { competiteurs: _raw, ...rest } = parsed;
  void _raw;

  return {
    ...rest,
    competiteurs,
    aiGenerated: true,
    analyzedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Point d'entrée principal
───────────────────────────────────────────────────────────────────────────── */

export async function analyzeCompetition(
  query: ScrapeQuery,
  contents: CompetitorContent[],
  language: "fr" | "en" = "fr"
): Promise<AnalysisResult> {
  if (!isAiConfigured || contents.length === 0) {
    return buildMockAnalysis(query, contents, language);
  }

  try {
    return await analyzeWithClaude(query, contents, language);
  } catch (err) {
    console.warn("[analyzeCompetition] Claude failed, fallback mock:", err);
    return buildMockAnalysis(query, contents, language);
  }
}
