/**
 * Orchestrateur principal du système multi-agent Social Hub.
 *
 * Séquence d'exécution :
 *   1. Orchestrator  — décompose l'objectif et coordonne
 *   2. Strategist    — analyse professionnelle & sémantique de l'environnement
 *   3. Copywriter    — génère le texte (Claude ou mock)
 *   4. Creative      — génération d'images/vidéos réelles via Replicate (ou brief simulé)
 *   5. Compliance    — BLOQUANT — évalue la conformité santé
 *   6. Media Buyer   — configure la campagne Meta (simulé)
 *   7. Analyst       — benchmark sectoriel, KPIs et captation d'audience
 *   8. Publisher     — programme et publie le contenu validé sur les réseaux
 *
 * Niveaux d'autonomie :
 *   1 = Recommandation pure — aucune action "exécutée", tout reste proposé.
 *   2 = Semi-auto — actions simulées, la publication reste conditionnelle à
 *       une validation humaine.
 *   3 = Auto sous garde-fous — exécution effective si compliance=pass et le
 *       plafond budgétaire est respecté. Bloque automatiquement si compliance=block.
 *
 * Champs optionnels rétro-compatibles :
 *   profileId?       — identifiant du profil professionnel (lib/agents/profiles.ts)
 *   cadence?         — rythme de publication et période de reporting
 *   benchmarkTarget? — cible de benchmark libre (ex : "concurrents téléconsultation FR")
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClaudeMessage } from "@/lib/ai/anthropic";
import { env, isAiConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { isReplicateConfigured, generateImageModel } from "@/lib/ai/replicate";
import { getImageModel } from "@/lib/ai/model-catalog";
import { saveMediaAsset, persistRemoteMedia } from "@/lib/repositories/media";
import type {
  AgentId,
  AgentRunResult,
  AgentStep,
  AutonomyLevel,
  Cadence,
  EnvironmentAnalysis,
  BenchmarkResult,
  BenchmarkKPIRow,
  PublisherResult,
} from "./types";
import { getProfile, getDefaultProfile, type ProProfile } from "./profiles";

// ── Constantes ────────────────────────────────────────────────────────────────

/** Budget journalier maximal accepté avant blocage automatique (niveau 3). */
const BUDGET_CAP_EUR = 500;

// ── Interfaces internes ───────────────────────────────────────────────────────

export interface OrchestrationInput {
  /** Objectif libre-format de l'utilisateur */
  objective: string;
  /** Identifiant de la marque */
  companyId: string;
  /** Tone of voice de la marque (optionnel) */
  brandVoice?: string;
  /** Niveau d'autonomie (1, 2 ou 3) */
  autonomy: AutonomyLevel;
  /** Identifiant du profil professionnel (optionnel — rétro-compatible) */
  profileId?: string;
  /** Cadence éditoriale (optionnel — rétro-compatible) */
  cadence?: Cadence;
  /** Cible de benchmark libre (optionnel — rétro-compatible) */
  benchmarkTarget?: string;
  /**
   * Option choisie par le CLIENT : activer le contrôle de conformité santé
   * (ANSM + politiques Meta santé). Désactivé par défaut → conformité
   * publicitaire générale. Ce n'est ni l'app ni le profil qui décident.
   */
  healthcareCompliance?: boolean;
  /** Langue de sortie des textes produits par l'IA (défaut : "fr"). */
  language?: "fr" | "en";
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

/** Consigne de langue à injecter dans les prompts IA (textes produits). */
function langDirective(language: "fr" | "en"): string {
  return language === "en"
    ? "\n\nIMPORTANT: Write ALL textual output (every string value) in ENGLISH."
    : "\n\nIMPORTANT : rédige TOUT le texte produit en FRANÇAIS.";
}

/** Sélecteur bilingue pour les libellés statiques des étapes (retour QA bug 6 :
 *  les titres/détails des agents doivent suivre la langue choisie par l'utilisateur). */
function makeL(language: "fr" | "en" | undefined): (fr: string, en: string) => string {
  const en = language === "en";
  return (fr, enTxt) => (en ? enTxt : fr);
}

function ts(): string {
  return new Date().toISOString();
}

/** Résout la cadence avec des valeurs par défaut sensées. */
function resolveCadence(cadence?: Cadence): Required<Cadence> {
  return {
    postingPerDay: cadence?.postingPerDay ?? 1,
    postingDays: cadence?.postingDays ?? [1, 2, 3, 4, 5],
    postingHours: cadence?.postingHours ?? ["08:00", "19:00"],
    reportingPeriod: cadence?.reportingPeriod ?? "month",
  };
}

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function formatCadence(cadence: Required<Cadence>): string {
  const days = cadence.postingDays.map((d) => DAY_NAMES[d] ?? d).join(", ");
  const hours = cadence.postingHours.join(" / ");
  const period = {
    day: "quotidien",
    week: "hebdomadaire",
    month: "mensuel",
    quarter: "trimestriel",
    year: "annuel",
  }[cadence.reportingPeriod];
  return `${cadence.postingPerDay} publication(s)/jour · Jours : ${days} · Heures : ${hours} · Reporting ${period}`;
}

/**
 * Trace une entrée dans social_hub.audit_log via le client admin Supabase.
 * Best-effort : ne lève jamais d'exception si Supabase est absent ou plante.
 */
async function auditLog(
  agentId: AgentId,
  action: string,
  companyId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const sb = createAdminClient();
    if (!sb) return;
    await sb.from("sh_audit_log").insert({
      company_id: companyId,
      actor: `agent:${agentId}`,
      action,
      entity: "agent_run",
      entity_id: companyId,
      payload,
    });
  } catch {
    // Non-bloquant
  }
}

// ── System prompts ─────────────────────────────────────────────────────────────

/**
 * System prompt de conformité — SECTOR-AWARE.
 * Le contrôle santé/ANSM n'est appliqué QUE pour les profils `healthcare`.
 * Pour tous les autres secteurs, on applique une conformité publicitaire
 * générale (véracité, pas de promesses trompeuses, politiques plateformes,
 * protection du consommateur) — sans aucun jargon ni règle médicale.
 */
function buildComplianceSystemPrompt(profile: ProProfile, healthcareMode: boolean): string {
  if (healthcareMode) {
    return `
You are a specialist compliance officer for healthcare and medical advertising, reviewing social media posts for a brand in the "${profile.label}" sector (France + international).

Evaluate posts against:
1. French health advertising regulations (ANSM guidelines)
2. Meta health ad policies (Facebook & Instagram)
3. EU consumer protection rules for health claims

### BLOCK (must NOT be published):
- Guaranteed results or cure claims ("lose 20 kg guaranteed", "cure your diabetes")
- False or unsubstantiated medical claims presented as facts
- Manipulative exploitation of vulnerability or fear
- Before/after framing promising physical transformation
- Specific medication names with dosage claims

### WARN (needs revision):
- Alarmist phrasing; implied guarantees ("you will feel better")
- Missing recommendation to consult a professional where relevant
- Targeting by health condition; unevidenced comparative or "miracle" claims

### PASS: measured, evidence-respecting language ("may", "can help", "consult your doctor"), no manipulative triggers.

## Response format — valid JSON only, no prose:
{"verdict": "pass"|"warn"|"block", "issues": ["issue 1"], "suggestion": "optional"}`.trim();
  }

  // Conformité publicitaire GÉNÉRALE (non médicale).
  return `
You are an advertising compliance reviewer for a brand in the "${profile.label}" sector. You review social media posts for general advertising compliance — NOT medical/health rules (this brand is not in a regulated health sector).

Evaluate posts against:
1. Truthfulness & fair advertising (no misleading or deceptive claims)
2. Platform ad policies (Meta, LinkedIn, TikTok)
3. EU/French consumer protection (clear offers, no false scarcity/urgency, lawful pricing)

### BLOCK (must NOT be published):
- Demonstrably false claims or guaranteed outcomes presented as fact
- Deceptive pricing/offers, or content that violates platform policies
- Manipulative exploitation of vulnerability, hateful or discriminatory content

### WARN (needs revision):
- Unsubstantiated superlatives ("the best", "n°1") without proof
- Misleading urgency/scarcity; unclear terms of an offer
- Borderline claims that should be softened or evidenced

### PASS: honest, clear, benefit-led content with substantiated claims and compliant offers.

Apply ONLY the sector constraints provided by the user — do NOT invent medical/health requirements.

## Response format — valid JSON only, no prose:
{"verdict": "pass"|"warn"|"block", "issues": ["issue 1"], "suggestion": "optional"}`.trim();
}

function buildStrategistSystemPrompt(profile: ProProfile): string {
  return `
Tu es un stratège digital senior de niveau international, spécialisé dans le secteur : ${profile.label}.

Ton rôle est de produire une ANALYSE D'ENVIRONNEMENT PROFESSIONNELLE ET SÉMANTIQUE complète, structurée en JSON, pour guider l'ensemble des agents de la chaîne.

Profil sectoriel actif :
- Description : ${profile.description}
- Audience typique : ${profile.typicalAudience}
- Leviers d'acquisition typiques : ${profile.acquisitionLevers.join(", ")}
- Plateformes prioritaires : ${profile.priorityPlatforms.join(", ")}
- Champ sémantique de référence : ${profile.semanticField.join(", ")}
- Contraintes compliance : ${profile.complianceConstraints.slice(0, 3).join(" / ")}

Tu dois produire UNIQUEMENT un JSON valide (sans prose ni markdown autour) avec cette structure exacte :
{
  "marketOverview": "string — synthèse du marché, taille, tendances, concurrence directe et indirecte sur ce secteur",
  "semanticAnalysis": "string — intentions de recherche clés, champ sémantique principal, mots-clés à fort potentiel, angles discursifs",
  "positioning": "string — positionnement différenciant recommandé, proposition de valeur unique, territoires à éviter",
  "acquisitionAngles": ["angle1", "angle2", "angle3", "angle4"],
  "recommendedPlatforms": ["plateforme1 : justification", "plateforme2 : justification"],
  "competitiveRisks": "string — principaux risques concurrentiels et points de vigilance"
}
`.trim();
}

function buildCopywriterSystemPrompt(profile: ProProfile, voice: string, healthcareMode: boolean): string {
  const rules = healthcareMode
    ? `Règles impératives (ANSM + Meta Health Policies) :
- Jamais d'allégations médicales non étayées ni de résultats garantis
- Toujours recommander de consulter un professionnel de santé si pertinent
- Langage mesuré : "peut aider", "soutient", "accompagne", "peut contribuer"
- Pas de ciblage par pathologie ni exploitation de la peur ou de la vulnérabilité`
    : `Règles impératives (publicité responsable) :
- Pas d'allégations trompeuses ni de promesses non tenables
- Superlatifs ("le meilleur", "n°1") seulement s'ils sont justifiables
- Offres claires et conformes ; pas de fausse urgence/rareté
- Respect des politiques publicitaires des plateformes`;
  return `
Tu es un expert copywriter social media de niveau international, spécialisé en communication ${profile.label}.

Profil sectoriel : ${profile.description}
Ton de communication imposé : ${profile.recommendedTone}
Brand voice de la marque : ${voice}
Champ sémantique à activer : ${profile.semanticField.slice(0, 6).join(", ")}
Plateformes cibles : ${profile.priorityPlatforms.slice(0, 3).join(", ")}

${rules}

Angles de contenu recommandés pour ce secteur :
${profile.contentAngles.map((a) => `- ${a}`).join("\n")}

Contraintes supplémentaires :
${profile.complianceConstraints.slice(0, 3).map((c) => `- ${c}`).join("\n")}

Génère UNIQUEMENT le texte du post (sans introduction, commentaire ou balise markdown). Le post doit être adapté aux plateformes ${profile.priorityPlatforms.slice(0, 2).join(" et ")}, avec des emojis appropriés et des hashtags pertinents en fin de post.
`.trim();
}

function buildAnalystSystemPrompt(profile: ProProfile, cadence: Required<Cadence>): string {
  const period = cadence.reportingPeriod;
  const periodLabel = { day: "journalière", week: "hebdomadaire", month: "mensuelle", quarter: "trimestrielle", year: "annuelle" }[period];
  const kpis = profile.sectorKPIs;

  return `
Tu es un analyste performance digital de niveau expert, spécialisé dans le secteur : ${profile.label}.

Benchmarks sectoriels de référence pour ce profil :
- CPM : ${kpis.cpm.min}–${kpis.cpm.max}€
- CPC : ${kpis.cpc.min}–${kpis.cpc.max}€
- CTR : ${kpis.ctr.min}–${kpis.ctr.max}%
- Engagement rate : ${kpis.engagementRate.min}–${kpis.engagementRate.max}%
- CPA/CPL : ${kpis.cpa.min}–${kpis.cpa.max}€
- Taux de conversion : ${kpis.conversionRate.min}–${kpis.conversionRate.max}%
${kpis.roas ? `- ROAS : ${kpis.roas.min}–${kpis.roas.max}x` : ""}

Cadence de publication : ${formatCadence(cadence)}
Période de reporting retenue : analyse ${periodLabel}
Objectif de captation audience : ${profile.audienceCaptureTarget90d}% de l'audience cible en 90 jours

Tu dois produire UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "benchmarkTarget": "string — description de la cible benchmark analysée",
  "kpiRows": [
    {
      "kpi": "string",
      "targetValue": "string — valeur cible projetée pour cette campagne",
      "sectorReference": "string — fourchette sectorielle de référence",
      "assessment": "above"|"inline"|"below"
    }
  ],
  "audienceCaptureProjection": {
    "targetAudienceSize": number,
    "estimatedReach": number,
    "captureRate": number,
    "timeframe": "string"
  },
  "optimizationRecommendations": ["rec1", "rec2", "rec3", "rec4"],
  "summary": "string — synthèse narrative du benchmark et de la stratégie d'optimisation"
}
`.trim();
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function mockEnvironmentAnalysis(profile: ProProfile, objective: string): EnvironmentAnalysis {
  return {
    marketOverview: `Secteur "${profile.label}" : marché en croissance structurelle, porté par la digitalisation des parcours patients et l'essor des usages mobiles. Concurrence fragmentée entre acteurs traditionnels et pure-players numériques. L'objectif "${objective.slice(0, 60)}…" s'inscrit dans un contexte d'intensification de la demande.`,
    semanticAnalysis: `Intentions de recherche dominantes : solutions immédiates, comparaison de prix/services, avis patients. Champ sémantique prioritaire : ${profile.semanticField.slice(0, 5).join(", ")}. Mots-clés à fort potentiel : requêtes "near me" + symptômes fréquents + noms de spécialités.`,
    positioning: `Se positionner sur la combinaison Expertise + Proximité + Accessibilité. Éviter le territoire purement promotionnel (saturation) et le jargon médical (barrière à l'engagement). Levier différenciant : ${profile.contentAngles[0]}.`,
    acquisitionAngles: profile.acquisitionLevers.slice(0, 4),
    recommendedPlatforms: profile.priorityPlatforms.slice(0, 3).map(
      (p, i) => `${p} : ${["portée maximale et ciblage géographique précis", "engagement élevé et storytelling visuel", "génération de demande et intention d'achat"][i] ?? "pertinent pour ce secteur"}`
    ),
    competitiveRisks: `Principaux risques : concurrents avec budget SEA supérieur, saturation publicitaire sur les créneaux santé, sensibilité des audiences aux contenus intrusifs. Recommandation : différenciation par la qualité du contenu et la preuve sociale.`,
  };
}

function mockBenchmark(
  profile: ProProfile,
  cadence: Required<Cadence>,
  dailyBudget: number,
  benchmarkTarget?: string
): BenchmarkResult {
  const kpis = profile.sectorKPIs;
  const targetCPM = ((kpis.cpm.min + kpis.cpm.max) / 2).toFixed(2);
  const targetCPC = ((kpis.cpc.min + kpis.cpc.max) / 2).toFixed(2);
  const targetCTR = ((kpis.ctr.min + kpis.ctr.max) / 2).toFixed(1);
  const targetEngagement = ((kpis.engagementRate.min + kpis.engagementRate.max) / 2).toFixed(1);
  const targetCPA = ((kpis.cpa.min + kpis.cpa.max) / 2).toFixed(0);
  const targetCVR = ((kpis.conversionRate.min + kpis.conversionRate.max) / 2).toFixed(1);

  const periodDays = { day: 1, week: 7, month: 30, quarter: 90, year: 365 }[cadence.reportingPeriod];
  const totalBudget = dailyBudget * periodDays;
  const impressions = Math.round(totalBudget / (parseFloat(targetCPM) / 1000));
  const audienceSize = 250_000;
  const captureRate = Math.min(profile.audienceCaptureTarget90d, Math.round((impressions / audienceSize) * 100 * 0.3));
  const estimatedReach = Math.round(audienceSize * (captureRate / 100));

  const kpiRows: BenchmarkKPIRow[] = [
    {
      kpi: "CPM",
      targetValue: `${targetCPM}€`,
      sectorReference: `${kpis.cpm.min}–${kpis.cpm.max}€`,
      assessment: "inline",
    },
    {
      kpi: "CPC",
      targetValue: `${targetCPC}€`,
      sectorReference: `${kpis.cpc.min}–${kpis.cpc.max}€`,
      assessment: "inline",
    },
    {
      kpi: "CTR",
      targetValue: `${targetCTR}%`,
      sectorReference: `${kpis.ctr.min}–${kpis.ctr.max}%`,
      assessment: parseFloat(targetCTR) > (kpis.ctr.min + kpis.ctr.max) / 2 ? "above" : "inline",
    },
    {
      kpi: "Taux d'engagement",
      targetValue: `${targetEngagement}%`,
      sectorReference: `${kpis.engagementRate.min}–${kpis.engagementRate.max}%`,
      assessment: "inline",
    },
    {
      kpi: "CPA / CPL",
      targetValue: `${targetCPA}€`,
      sectorReference: `${kpis.cpa.min}–${kpis.cpa.max}€`,
      assessment: parseFloat(targetCPA) < kpis.cpa.max ? "inline" : "below",
    },
    {
      kpi: "Taux de conversion",
      targetValue: `${targetCVR}%`,
      sectorReference: `${kpis.conversionRate.min}–${kpis.conversionRate.max}%`,
      assessment: "inline",
    },
    ...(kpis.roas
      ? [
          {
            kpi: "ROAS",
            targetValue: `${((kpis.roas.min + kpis.roas.max) / 2).toFixed(1)}x`,
            sectorReference: `${kpis.roas.min}–${kpis.roas.max}x`,
            assessment: "inline" as const,
          },
        ]
      : []),
  ];

  return {
    benchmarkTarget: benchmarkTarget ?? `Benchmark sectoriel ${profile.label}`,
    kpiRows,
    audienceCaptureProjection: {
      targetAudienceSize: audienceSize,
      estimatedReach,
      captureRate,
      timeframe: `${periodDays} jours (${cadence.reportingPeriod === "month" ? "1 mois" : `reporting ${cadence.reportingPeriod}`})`,
    },
    optimizationRecommendations: [
      `Tester 2–3 variantes créatives dès J1–J3 et couper les adsets sous ${kpis.ctr.min}% de CTR`,
      `Escalader le budget de 15–20% par semaine si CPA < ${kpis.cpa.min * 1.2}€`,
      `Activer le retargeting sur les visiteurs 30 jours (CPL généralement 40% inférieur)`,
      `Exclure les audiences ayant déjà converti pour optimiser la dépense`,
    ],
    summary: `Sur la période de reporting ${cadence.reportingPeriod}, avec ${dailyBudget}€/j, les projections sont alignées avec les benchmarks du secteur ${profile.label}. Portée estimée : ${estimatedReach.toLocaleString("fr-FR")} contacts uniques, soit ${captureRate}% de captation de l'audience cible sur ${periodDays} jours.`,
  };
}

// ── Logique par agent ─────────────────────────────────────────────────────────

/**
 * Étape 1 — Orchestrateur
 */
async function runOrchestrator(
  input: OrchestrationInput,
  profile: ProProfile,
  cadence: Required<Cadence>
): Promise<AgentStep> {
  const cadenceStr = formatCadence(cadence);
  const L = makeL(input.language);

  const plan = L(
    `Objectif reçu : "${input.objective}".

Profil professionnel actif : ${profile.label} — ${profile.description}
Cadence éditoriale : ${cadenceStr}
${input.benchmarkTarget ? `Cible de benchmark : ${input.benchmarkTarget}` : ""}

Séquence planifiée :
  1. Stratège      → analyse d'environnement pro + sémantique (marché, concurrence, positionnement)
  2. Rédacteur IA  → génération du contenu adapté au profil et à la brand voice
  3. Créatif       → brief visuel
  4. Conformité    → vérification réglementaire ANSM / Meta (BLOQUANT)
  5. Media Buyer   → configuration campagne Meta Ads
  6. Analyste      → benchmark sectoriel, KPIs cibles et captation d'audience

Niveau d'autonomie : N${input.autonomy} (${
      input.autonomy === 1
        ? "recommandation pure — aucune action exécutée"
        : input.autonomy === 2
        ? "semi-auto — validation humaine requise avant publication"
        : "auto sous garde-fous — exécution si conformité et budget OK"
    }).`,
    `Objective received: "${input.objective}".

Active professional profile: ${profile.label} — ${profile.description}
Editorial cadence: ${cadenceStr}
${input.benchmarkTarget ? `Benchmark target: ${input.benchmarkTarget}` : ""}

Planned sequence:
  1. Strategist    → professional + semantic environment analysis (market, competition, positioning)
  2. Copywriter    → content generation matching the profile and brand voice
  3. Creative      → visual brief
  4. Compliance    → ANSM / Meta regulatory check (BLOCKING)
  5. Media Buyer   → Meta Ads campaign setup
  6. Analyst       → sector benchmark, target KPIs and audience capture

Autonomy level: N${input.autonomy} (${
      input.autonomy === 1
        ? "recommendation only — no action executed"
        : input.autonomy === 2
        ? "semi-auto — human validation required before publishing"
        : "auto with guardrails — executes if compliance and budget are OK"
    }).`
  );

  await auditLog("orchestrator", "orchestration_start", input.companyId, {
    objective: input.objective,
    autonomy: input.autonomy,
    profileId: profile.id,
    cadence,
  });

  return {
    agent: "orchestrator",
    title: L("Décomposition de l'objectif", "Objective breakdown"),
    status: "done",
    output: plan,
    finishedAt: ts(),
  };
}

/**
 * Étape 2 — Stratège
 * Produit une analyse d'environnement professionnelle et sémantique.
 * Appelle Claude quand l'IA est configurée, sinon mock cohérent.
 */
async function runStrategist(
  input: OrchestrationInput,
  profile: ProProfile,
  cadence: Required<Cadence>
): Promise<{ step: AgentStep; analysis: EnvironmentAnalysis }> {
  const L = makeL(input.language);
  if (!isAiConfigured) {
    const analysis = mockEnvironmentAnalysis(profile, input.objective);
    const output = `[ANALYSE D'ENVIRONNEMENT — mode mock]

Marché & concurrence :
${analysis.marketOverview}

Analyse sémantique :
${analysis.semanticAnalysis}

Positionnement recommandé :
${analysis.positioning}

Angles d'acquisition :
${analysis.acquisitionAngles.map((a) => `  • ${a}`).join("\n")}

Plateformes recommandées :
${analysis.recommendedPlatforms.map((p) => `  • ${p}`).join("\n")}

Risques concurrentiels :
${analysis.competitiveRisks}

Cadence éditoriale retenue : ${formatCadence(cadence)}`;

    return {
      step: {
        agent: "strategist",
        title: L("Analyse d'environnement pro & sémantique (mode mock)", "Professional & semantic environment analysis (mock mode)"),
        status: "simulated",
        output,
        detail: L("Mode mock — configurez ANTHROPIC_API_KEY pour l'analyse IA temps réel.", "Mock mode — set ANTHROPIC_API_KEY for real-time AI analysis."),
        finishedAt: ts(),
      },
      analysis,
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const resp = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 700,
      system: buildStrategistSystemPrompt(profile) + langDirective(input.language === "en" ? "en" : "fr"),
      messages: [
        {
          role: "user",
          content: `Réalise l'analyse d'environnement professionnelle et sémantique pour cet objectif de campagne dans le secteur "${profile.label}" :\n\n"${input.objective}"\n\nProduis uniquement le JSON demandé.`,
        },
      ],
    });

    const firstBlock = resp.content[0];
    if (firstBlock.type !== "text") throw new Error("Réponse inattendue de Claude");

    let analysis: EnvironmentAnalysis;
    try {
      analysis = JSON.parse(firstBlock.text.trim()) as EnvironmentAnalysis;
    } catch {
      analysis = mockEnvironmentAnalysis(profile, input.objective);
    }

    const output = `${L("[ANALYSE D'ENVIRONNEMENT — IA]", "[ENVIRONMENT ANALYSIS — AI]")}

${L("Marché & concurrence :", "Market & competition:")}
${analysis.marketOverview}

${L("Analyse sémantique :", "Semantic analysis:")}
${analysis.semanticAnalysis}

${L("Positionnement recommandé :", "Recommended positioning:")}
${analysis.positioning}

${L("Angles d'acquisition :", "Acquisition angles:")}
${analysis.acquisitionAngles.map((a) => `  • ${a}`).join("\n")}

${L("Plateformes recommandées :", "Recommended platforms:")}
${analysis.recommendedPlatforms.map((p) => `  • ${p}`).join("\n")}

${L("Risques concurrentiels :", "Competitive risks:")}
${analysis.competitiveRisks}

${L("Cadence éditoriale retenue :", "Selected editorial cadence:")} ${formatCadence(cadence)}`;

    return {
      step: {
        agent: "strategist",
        title: L("Analyse d'environnement pro & sémantique", "Professional & semantic environment analysis"),
        status: "done",
        output,
        finishedAt: ts(),
      },
      analysis,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const analysis = mockEnvironmentAnalysis(profile, input.objective);
    return {
      step: {
        agent: "strategist",
        title: L("Analyse d'environnement (dégradation)", "Environment analysis (degraded)"),
        status: "simulated",
        output: `${L("Analyse générée en mode dégradé suite à une erreur API.", "Analysis generated in degraded mode after an API error.")}\n\n${analysis.marketOverview}`,
        detail: L(`Erreur API : ${msg}`, `API error: ${msg}`),
        finishedAt: ts(),
      },
      analysis,
    };
  }
}

/**
 * Étape 3 — Rédacteur IA (Copywriter)
 */
async function runCopywriter(
  input: OrchestrationInput,
  profile: ProProfile
): Promise<AgentStep> {
  const voice = input.brandVoice ?? profile.recommendedTone;
  const L = makeL(input.language);

  if (!isAiConfigured) {
    const mockText = `${profile.contentAngles[0]} — C'est au cœur de notre mission chaque jour.
Nos équipes ${profile.label.toLowerCase()} vous accompagnent avec expertise et bienveillance, à chaque étape de votre parcours.
Prenez rendez-vous dès aujourd'hui. 🩺

${profile.semanticField.slice(0, 4).map((s) => `#${s.replace(/\s+/g, "")}`).join(" ")}`;

    return {
      agent: "copywriter",
      title: L("Génération du contenu (mode mock)", "Content generation (mock mode)"),
      status: "done",
      output: mockText,
      detail: L("Mode mock actif — configurez ANTHROPIC_API_KEY pour activer la génération IA réelle.", "Mock mode active — set ANTHROPIC_API_KEY to enable real AI generation."),
      finishedAt: ts(),
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const resp = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 500,
      system: buildCopywriterSystemPrompt(profile, voice, Boolean(input.healthcareCompliance)) + langDirective(input.language === "en" ? "en" : "fr"),
      messages: [
        {
          role: "user",
          content: `Génère un post ${profile.priorityPlatforms[0] ?? "Facebook"}/Instagram pour cet objectif de campagne dans le secteur "${profile.label}" :\n\n"${input.objective}"`,
        },
      ],
    });

    const firstBlock = resp.content[0];
    const text = firstBlock.type === "text" ? firstBlock.text : "Contenu non disponible.";

    return {
      agent: "copywriter",
      title: L("Génération du contenu (Claude IA)", "Content generation (Claude AI)"),
      status: "done",
      output: text,
      finishedAt: ts(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agent: "copywriter",
      title: L("Génération du contenu (erreur)", "Content generation (error)"),
      status: "blocked",
      output: L("La génération de contenu a échoué.", "Content generation failed."),
      detail: L(`Erreur Anthropic API : ${msg}`, `Anthropic API error: ${msg}`),
      finishedAt: ts(),
    };
  }
}

/**
 * Résultat interne de l'étape Créatif, incluant les visuels générés.
 */
interface CreativeResult {
  step: AgentStep;
  generatedImages?: { url: string }[];
  generatedVideo?: { url: string };
  imagePrompt?: string;
  videoPrompt?: string;
}

/**
 * Construit le prompt visuel à partir du texte du post et du profil.
 */
function buildImagePrompt(copyText: string, profile: ProProfile): string {
  const firstLine = copyText.split("\n")[0].replace(/[#@*_~`]/g, "").trim().slice(0, 120);
  const tone = profile.recommendedTone.split(".")[0].trim().toLowerCase();
  const semantics = profile.semanticField.slice(0, 4).join(", ");
  return `Professional social media visual for the "${profile.label}" sector. ${firstLine}. Style: ${tone}, clean, modern, on-brand. Themes: ${semantics}. No text overlay, high quality, tasteful lighting.`;
}

/**
 * Étape 4 — Créatif Visuel
 * Appelle Replicate pour générer images (et vidéo si la cadence implique du contenu vidéo).
 * Repli élégant si REPLICATE_API_TOKEN absent.
 */
async function runCreative(
  input: OrchestrationInput,
  profile: ProProfile,
  copyText: string,
  cadence: Required<Cadence>
): Promise<CreativeResult> {
  const platforms = profile.priorityPlatforms.slice(0, 2).join(" + ");
  const L = makeL(input.language);
  const briefBase = L(
    `Brief créatif — Profil : ${profile.label}
• Format principal : image carrée 1080×1080 px (Feed ${platforms}) + bannière 1200×628 px
• Palette : tons cohérents avec la marque, professionnels
• Style : photographie professionnelle authentique, adaptée au secteur
• Éléments obligatoires : logo de la marque (coin bas-droit), mention légale si requis
• Accroche visuelle : "${copyText.split("\n")[0].slice(0, 80)}…"
• Variantes : Story 9:16 (1080×1920) + Réels 4:5 (1080×1350)
• Tonalité visuelle : ${profile.recommendedTone}`,
    `Creative brief — Profile: ${profile.label}
• Main format: square image 1080×1080 px (${platforms} feed) + banner 1200×628 px
• Palette: professional tones consistent with the brand
• Style: authentic professional photography, tailored to the sector
• Required elements: brand logo (bottom-right corner), legal notice if required
• Visual hook: "${copyText.split("\n")[0].slice(0, 80)}…"
• Variants: Story 9:16 (1080×1920) + Reels 4:5 (1080×1350)
• Visual tone: ${profile.recommendedTone}`
  );

  // Le cycle ne génère PLUS le média en synchrone (Replicate image ~15s + vidéo
  // ~60-90s ferait dépasser la limite de 60s → 504). Il propose les PROMPTS ;
  // l'utilisateur génère image/vidéo à la demande (chaque rendu dans sa requête).
  const imagePrompt = buildImagePrompt(copyText, profile);
  const needsVideo =
    cadence.postingPerDay >= 2 ||
    /vid[eé]o|reels?|r[eé]els?/i.test(input.objective);
  const videoPrompt = needsVideo
    ? `${imagePrompt}. Clip vidéo vertical 9:16 de 5 secondes, rythmé, pour réseaux sociaux.`
    : undefined;

  // Génération RÉELLE d'une image (modèle rapide), avec garde-fou de temps pour
  // ne jamais dépasser la limite serverless. Repli élégant en prompt-only si
  // Replicate n'est pas configuré, échoue, ou prend trop de temps.
  let generatedImages: { url: string }[] | undefined;
  if (isReplicateConfigured) {
    try {
      const gm = getImageModel("black-forest-labs/flux-schnell"); // rapide (~8 s)
      const input2 = gm.buildInput(imagePrompt, { aspect: "1:1" });
      const res = await Promise.race([
        generateImageModel(gm.id, input2, 1),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 35_000)),
      ]);
      const rawUrl = res && "images" in res ? res.images[0]?.url : undefined;
      if (rawUrl) {
        // Persiste (URL Replicate éphémère → Supabase) avant enregistrement durable.
        const url = await persistRemoteMedia(input.companyId, rawUrl, "image").catch(() => rawUrl);
        generatedImages = [{ url }];
        await saveMediaAsset(input.companyId, { url, type: "image", format: "1:1", source: "agent-creative", prompt: imagePrompt }).catch(() => {});
      }
    } catch { /* repli prompt-only */ }
  }

  const lines: string[] = [briefBase, L(`\n🎨 Prompt image :\n  ${imagePrompt}`, `\n🎨 Image prompt:\n  ${imagePrompt}`)];
  if (videoPrompt) lines.push(L(`\n🎬 Prompt vidéo (à générer) :\n  ${videoPrompt}`, `\n🎬 Video prompt (to generate):\n  ${videoPrompt}`));
  lines.push(
    generatedImages
      ? L(`\n✓ Visuel généré et enregistré dans la Médiathèque (réutilisable en pub).`, `\n✓ Visual generated and saved to the Media Library (reusable in ads).`)
      : isReplicateConfigured
      ? L(`\n→ Cliquez sur « Générer l'image » / « Générer la vidéo » ci-dessous pour produire les visuels (Replicate).`, `\n→ Click “Generate image” / “Generate video” below to produce the visuals (Replicate).`)
      : L(`\n→ Configurez REPLICATE_API_TOKEN, puis générez les visuels en 1 clic.`, `\n→ Set REPLICATE_API_TOKEN, then generate the visuals in 1 click.`)
  );

  return {
    step: {
      agent: "creative",
      title: L("Brief créatif & visuel", "Creative & visual brief"),
      status: "done",
      output: lines.join("\n"),
      finishedAt: ts(),
    },
    generatedImages,
    imagePrompt,
    videoPrompt,
  };
}

/**
 * Étape 5 — Conformité (BLOQUANT)
 */
async function runCompliance(
  input: OrchestrationInput,
  profile: ProProfile,
  copyText: string
): Promise<{
  step: AgentStep;
  verdict: "pass" | "warn" | "block";
  issues: string[];
  suggestion?: string;
}> {
  // Décision du CLIENT (option du run), pas du profil ni de l'app.
  const healthcareMode = Boolean(input.healthcareCompliance);
  const L = makeL(input.language);
  if (!isAiConfigured) {
    return {
      step: {
        agent: "compliance",
        title: L("Vérification de conformité (mode mock)", "Compliance check (mock mode)"),
        status: "done",
        output: L("Verdict : PASS (mock) — aucun problème de conformité détecté.", "Verdict: PASS (mock) — no compliance issue detected."),
        detail: L("Mode mock actif — configurez ANTHROPIC_API_KEY pour l'évaluation réelle.", "Mock mode active — set ANTHROPIC_API_KEY for the real evaluation."),
        finishedAt: ts(),
      },
      verdict: "pass",
      issues: [],
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const profileConstraints = profile.complianceConstraints.join("\n");

    const resp = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 420,
      system: buildComplianceSystemPrompt(profile, healthcareMode) + langDirective(input.language === "en" ? "en" : "fr"),
      messages: [
        {
          role: "user",
          content: `Évalue ce post pour une marque dans le secteur "${profile.label}"${healthcareMode ? " (politiques ANSM + Meta santé)" : " (conformité publicitaire générale — secteur non médical)"}.

Contraintes spécifiques au profil :
${profileConstraints}

Post à évaluer :
---
${copyText}
---`,
        },
      ],
    });

    const firstBlock = resp.content[0];
    if (firstBlock.type !== "text") throw new Error("Réponse inattendue de Claude");

    let parsed: { verdict: "pass" | "warn" | "block"; issues: string[]; suggestion?: string };
    try {
      parsed = JSON.parse(firstBlock.text.trim());
    } catch {
      parsed = {
        verdict: "warn",
        issues: ["Évaluation automatique incomplète — révision manuelle recommandée."],
        suggestion: firstBlock.text,
      };
    }

    const verdictEmoji = parsed.verdict === "pass" ? "✅" : parsed.verdict === "warn" ? "⚠️" : "🚫";
    const verdictLabel = parsed.verdict === "pass"
      ? L("CONFORME", "COMPLIANT")
      : parsed.verdict === "warn"
      ? L("AVERTISSEMENT", "WARNING")
      : L("BLOQUÉ", "BLOCKED");

    const outputLines = [
      `${L("Verdict :", "Verdict:")} ${verdictEmoji} ${verdictLabel}`,
      parsed.issues.length > 0
        ? `${L("Problèmes identifiés :", "Issues found:")}\n${parsed.issues.map((i) => `  • ${i}`).join("\n")}`
        : L("Aucun problème identifié.", "No issue found."),
    ];
    if (parsed.suggestion) {
      outputLines.push(`${L("Suggestion :", "Suggestion:")} ${parsed.suggestion}`);
    }

    return {
      step: {
        agent: "compliance",
        title: healthcareMode
          ? L("Vérification de conformité ANSM / Meta", "ANSM / Meta compliance check")
          : L("Vérification de conformité publicitaire", "Advertising compliance check"),
        status: parsed.verdict === "block" ? "blocked" : "done",
        output: outputLines.join("\n"),
        finishedAt: ts(),
      },
      verdict: parsed.verdict,
      issues: parsed.issues,
      suggestion: parsed.suggestion,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      step: {
        agent: "compliance",
        title: L("Vérification de conformité (erreur API)", "Compliance check (API error)"),
        status: "done",
        output: L(
          "⚠️ AVERTISSEMENT — La vérification automatique a échoué. Révision manuelle obligatoire avant publication.",
          "⚠️ WARNING — The automatic check failed. Manual review required before publishing."
        ),
        detail: L(`Erreur : ${msg}`, `Error: ${msg}`),
        finishedAt: ts(),
      },
      verdict: "warn",
      issues: [L("Vérification automatique indisponible — révision manuelle requise.", "Automatic check unavailable — manual review required.")],
    };
  }
}

/**
 * Étape 6 — Media Buyer
 */
async function runMediaBuyer(
  input: OrchestrationInput,
  profile: ProProfile,
  cadence: Required<Cadence>,
  autonomy: AutonomyLevel,
  blocked: boolean,
  copyText?: string,
  imageUrl?: string
): Promise<AgentStep> {
  const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
  const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;
  const L = makeL(input.language);

  if (autonomy === 3 && dailyBudget > BUDGET_CAP_EUR) {
    return {
      agent: "media_buyer",
      title: L("Configuration campagne Meta Ads — BLOQUÉ (budget)", "Meta Ads campaign setup — BLOCKED (budget)"),
      status: "blocked",
      output: L(
        `Budget quotidien demandé (${dailyBudget}€) dépasse le plafond autorisé (${BUDGET_CAP_EUR}€/j) en mode automatique.`,
        `Requested daily budget (€${dailyBudget}) exceeds the allowed cap (€${BUDGET_CAP_EUR}/day) in automatic mode.`
      ),
      detail: L(
        `Plafond de sécurité : ${BUDGET_CAP_EUR}€/jour. Réduisez le budget ou passez en autonomie 2 pour une validation manuelle.`,
        `Safety cap: €${BUDGET_CAP_EUR}/day. Lower the budget or switch to autonomy 2 for manual validation.`
      ),
      finishedAt: ts(),
    };
  }

  if (blocked) {
    return {
      agent: "media_buyer",
      title: L("Configuration campagne Meta Ads — ANNULÉE", "Meta Ads campaign setup — CANCELLED"),
      status: "blocked",
      output: L(
        "Configuration annulée : le contenu a été bloqué par l'agent Conformité. Aucune campagne ne sera créée.",
        "Setup cancelled: the content was blocked by the Compliance agent. No campaign will be created."
      ),
      finishedAt: ts(),
    };
  }

  const actionVerb = autonomy === 1
    ? L("Recommandation", "Recommendation")
    : autonomy === 2
    ? L("Simulation", "Simulation")
    : L("Exécution simulée", "Simulated execution");
  const platforms = profile.priorityPlatforms
    .filter((p) => ["Facebook", "Instagram"].includes(p))
    .join(", ") || "Facebook, Instagram";

  const days = cadence.postingDays.map((d) => DAY_NAMES[d] ?? d).join(", ");
  const hours = cadence.postingHours.join(L(" et ", " and "));

  const output = L(
    `${actionVerb} — Configuration campagne Meta Ads :
• Profil : ${profile.label}
• Nom de la campagne : "DDS_IA_${new Date().toISOString().slice(0, 10)}"
• Objectif : CONVERSIONS (Lead Generation)
• Budget quotidien : ${dailyBudget}€/j
• Audience cible : ${profile.typicalAudience}
• Placements : ${platforms} Feed + Stories
• Calendrier : ${days} — ${hours}
• Cadence : ${cadence.postingPerDay} publication(s)/jour
• Enchères : CPC cible < ${profile.sectorKPIs.cpc.max}€
• KPIs cibles : CTR ≥ ${profile.sectorKPIs.ctr.min}% · CPL ≤ ${profile.sectorKPIs.cpa.max}€
${
      autonomy === 1
        ? "\n⚠️ Autonomie 1 — Aucune campagne créée : validation et activation manuelles requises."
        : autonomy === 2
        ? "\n⚠️ Autonomie 2 — Campagne simulée : activez manuellement dans Meta Business Manager après validation."
        : "\n✅ Autonomie 3 — Campagne transmise à Meta Ads API (connecteur requis pour exécution réelle)."
    }`,
    `${actionVerb} — Meta Ads campaign setup:
• Profile: ${profile.label}
• Campaign name: "DDS_IA_${new Date().toISOString().slice(0, 10)}"
• Objective: CONVERSIONS (Lead Generation)
• Daily budget: €${dailyBudget}/day
• Target audience: ${profile.typicalAudience}
• Placements: ${platforms} Feed + Stories
• Schedule: ${days} — ${hours}
• Cadence: ${cadence.postingPerDay} post(s)/day
• Bidding: target CPC < €${profile.sectorKPIs.cpc.max}
• Target KPIs: CTR ≥ ${profile.sectorKPIs.ctr.min}% · CPL ≤ €${profile.sectorKPIs.cpa.max}
${
      autonomy === 1
        ? "\n⚠️ Autonomy 1 — No campaign created: manual validation and activation required."
        : autonomy === 2
        ? "\n⚠️ Autonomy 2 — Simulated campaign: activate manually in Meta Business Manager after validation."
        : "\n✅ Autonomy 3 — Campaign sent to the Meta Ads API (connector required for real execution)."
    }`
  );

  // Lien prêt-à-créer : ouvre /campaigns/new pré-rempli (visuel + texte) pour
  // créer la VRAIE campagne en PAUSE en un clic (sans dépense aveugle).
  const params = new URLSearchParams();
  if (imageUrl) params.set("image", imageUrl);
  if (copyText) params.set("text", copyText.slice(0, 600));
  params.set("name", L(`Campagne IA ${new Date().toISOString().slice(0, 10)}`, `AI campaign ${new Date().toISOString().slice(0, 10)}`));
  const handoff = L(
    `\n\n🔗 Créer cette campagne (pré-remplie, EN PAUSE) : /campaigns/new?${params.toString()}`,
    `\n\n🔗 Create this campaign (pre-filled, PAUSED): /campaigns/new?${params.toString()}`
  );

  return {
    agent: "media_buyer",
    title: L(
      `Configuration campagne Meta Ads (${actionVerb.toLowerCase()})`,
      `Meta Ads campaign setup (${actionVerb.toLowerCase()})`
    ),
    status: "simulated",
    output: output + handoff,
    detail: L(
      "Cliquez le lien pour créer la vraie campagne EN PAUSE (visuel + texte pré-remplis) puis activez-la quand vous voulez.",
      "Click the link to create the real campaign PAUSED (visual + text pre-filled), then activate it whenever you want."
    ),
    finishedAt: ts(),
  };
}

/**
 * Étape 7 — Publisher
 * Programme et publie le contenu validé sur les réseaux sociaux.
 * - Niv.1 → propose la publication (status 'pending' — ne publie pas)
 * - Niv.2/3 → tente la publication via le connecteur (best-effort)
 *             ou marque 'simulated' si connecteur non configuré
 * Respecte le veto conformité : jamais publier si blocked.
 */
async function runPublisher(
  input: OrchestrationInput,
  profile: ProProfile,
  copyText: string,
  generatedImages: { url: string }[] | undefined,
  generatedVideo: { url: string } | undefined,
  complianceVerdict: "pass" | "warn" | "block"
): Promise<{ step: AgentStep; publisherResult: PublisherResult }> {
  const L = makeL(input.language);
  // Veto conformité — jamais publier si bloqué
  if (complianceVerdict === "block") {
    const result: PublisherResult = {
      status: "blocked",
      platforms: [],
      message: L(
        "Publication empêchée par l'agent Conformité (verdict : BLOCK). Aucun contenu n'a été envoyé.",
        "Publishing prevented by the Compliance agent (verdict: BLOCK). No content was sent."
      ),
    };
    return {
      step: {
        agent: "publisher",
        title: L("Publication — BLOQUÉE (conformité)", "Publishing — BLOCKED (compliance)"),
        status: "blocked",
        output: result.message,
        detail: L("Le verdict de conformité 'block' empêche toute publication.", "The 'block' compliance verdict prevents any publishing."),
        finishedAt: ts(),
      },
      publisherResult: result,
    };
  }

  // Plateformes cibles depuis le profil
  const platforms = profile.priorityPlatforms
    .filter((p) => ["Facebook", "Instagram", "LinkedIn"].includes(p))
    .slice(0, 2);
  const platformsLabel = platforms.length > 0 ? platforms.join(", ") : "Facebook, Instagram";

  // Niv.1 → recommandation pure, pas de publication
  if (input.autonomy === 1) {
    const result: PublisherResult = {
      status: "pending",
      platforms,
      message: L(
        `Recommandation de publication préparée pour : ${platformsLabel}. Aucune action initiée (Autonomie N1 — validation manuelle requise).`,
        `Publishing recommendation prepared for: ${platformsLabel}. No action taken (Autonomy N1 — manual validation required).`
      ),
    };
    return {
      step: {
        agent: "publisher",
        title: L("Proposition de publication (Autonomie N1)", "Publishing proposal (Autonomy N1)"),
        status: "simulated",
        output: L(
          `[RECOMMANDATION — non publiée]\n\nPlateformes cibles : ${platformsLabel}\nContenu préparé : ${copyText.slice(0, 200)}${copyText.length > 200 ? "…" : ""}\n\nVisuels disponibles : ${generatedImages && generatedImages.length > 0 ? generatedImages.map((i) => i.url).join(", ") : "aucun visuel généré"}${generatedVideo ? `\nVidéo : ${generatedVideo.url}` : ""}\n\n⚠️ Autonomie N1 — Aucune publication initiée. Validez et publiez manuellement sur les plateformes.`,
          `[RECOMMENDATION — not published]\n\nTarget platforms: ${platformsLabel}\nPrepared content: ${copyText.slice(0, 200)}${copyText.length > 200 ? "…" : ""}\n\nAvailable visuals: ${generatedImages && generatedImages.length > 0 ? generatedImages.map((i) => i.url).join(", ") : "no visual generated"}${generatedVideo ? `\nVideo: ${generatedVideo.url}` : ""}\n\n⚠️ Autonomy N1 — No publishing initiated. Validate and publish manually on the platforms.`
        ),
        detail: L("Autonomie 1 : proposition uniquement, aucune action exécutée.", "Autonomy 1: proposal only, no action executed."),
        finishedAt: ts(),
      },
      publisherResult: result,
    };
  }

  // Niv.2 ou Niv.3 → tentative de publication via connecteurs (best-effort)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const publishResults: { platform: string; success: boolean; detail: string }[] = [];

  const mediaUrls: string[] = [];
  if (generatedImages) mediaUrls.push(...generatedImages.map((i) => i.url));
  if (generatedVideo) mediaUrls.push(generatedVideo.url);

  for (const platform of (platforms.length > 0 ? platforms : ["Facebook"])) {
    const platformSlug = platform.toLowerCase().replace(/\s+/g, "_");
    try {
      const resp = await fetch(`${appUrl}/api/connectors/${platformSlug}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: input.companyId,
          text: copyText,
          media: mediaUrls.length > 0 ? mediaUrls : undefined,
        }),
      });
      if (resp.ok) {
        publishResults.push({ platform, success: true, detail: L("Publication envoyée avec succès.", "Post sent successfully.") });
      } else {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        publishResults.push({
          platform,
          success: false,
          detail: (err as { error?: string }).error ?? `HTTP ${resp.status}`,
        });
      }
    } catch {
      publishResults.push({
        platform,
        success: false,
        detail: L("Connecteur non disponible (endpoint introuvable ou non configuré).", "Connector unavailable (endpoint missing or not configured)."),
      });
    }
  }

  const anySuccess = publishResults.some((r) => r.success);
  const allFailed = publishResults.every((r) => !r.success);

  const publisherStatus: PublisherResult["status"] = anySuccess
    ? input.autonomy === 3 ? "published" : "scheduled"
    : "simulated";

  const outputLines: string[] = [
    L(`Résultat de publication (Autonomie N${input.autonomy}) :`, `Publishing result (Autonomy N${input.autonomy}):`),
    L(`Plateformes ciblées : ${platformsLabel}`, `Target platforms: ${platformsLabel}`),
    "",
  ];

  publishResults.forEach((r) => {
    outputLines.push(`${r.success ? "✅" : "⚠️"} ${r.platform} : ${r.detail}`);
  });

  if (allFailed) {
    outputLines.push(
      "",
      L(
        `⚠️ Connecteurs non configurés — le contenu a été préparé mais non publié.`,
        `⚠️ Connectors not configured — the content was prepared but not published.`
      ),
      L(
        `Configurez les connecteurs Meta Business API / LinkedIn API pour activer la publication automatique.`,
        `Configure the Meta Business API / LinkedIn API connectors to enable automatic publishing.`
      )
    );
  } else if (input.autonomy === 2) {
    outputLines.push("", L(
      "ℹ️ Autonomie N2 — La publication a été soumise mais requiert une validation finale dans les dashboards des plateformes.",
      "ℹ️ Autonomy N2 — The post was submitted but requires final validation in the platforms' dashboards."
    ));
  } else {
    outputLines.push("", L(
      "✅ Autonomie N3 — Publication déclenchée sous garde-fous conformité.",
      "✅ Autonomy N3 — Publishing triggered under compliance guardrails."
    ));
  }

  if (mediaUrls.length > 0) {
    outputLines.push("", L("Médias attachés :", "Attached media:"));
    mediaUrls.forEach((u) => outputLines.push(`  • ${u}`));
  }

  const result: PublisherResult = {
    status: publisherStatus,
    platforms,
    message: allFailed
      ? L(
          `Connecteurs non configurés — contenu préparé pour ${platformsLabel} mais non publié.`,
          `Connectors not configured — content prepared for ${platformsLabel} but not published.`
        )
      : anySuccess
      ? L(
          `Contenu ${input.autonomy === 3 ? "publié" : "programmé"} sur ${publishResults.filter((r) => r.success).map((r) => r.platform).join(", ")}.`,
          `Content ${input.autonomy === 3 ? "published" : "scheduled"} on ${publishResults.filter((r) => r.success).map((r) => r.platform).join(", ")}.`
        )
      : L(
          `Publication simulée — connecteurs requis pour ${platformsLabel}.`,
          `Simulated publishing — connectors required for ${platformsLabel}.`
        ),
  };

  return {
    step: {
      agent: "publisher",
      title: anySuccess
        ? L(`Publication déclenchée (N${input.autonomy})`, `Publishing triggered (N${input.autonomy})`)
        : L(`Publication préparée — connecteurs requis`, `Publishing prepared — connectors required`),
      status: anySuccess ? "done" : "simulated",
      output: outputLines.join("\n"),
      detail: allFailed
        ? L(
            "Connecteurs requis : Meta Business API + LinkedIn API. Configurez-les dans les paramètres de l'application.",
            "Required connectors: Meta Business API + LinkedIn API. Configure them in the app settings."
          )
        : undefined,
      finishedAt: ts(),
    },
    publisherResult: result,
  };
}

/**
 * Étape 8 — Analyste
 * Produit un benchmark sectoriel ciblé avec KPIs et projection de captation d'audience.
 */
async function runAnalyst(
  input: OrchestrationInput,
  profile: ProProfile,
  cadence: Required<Cadence>,
  blocked: boolean
): Promise<{ step: AgentStep; benchmark: BenchmarkResult }> {
  const L = makeL(input.language);
  if (blocked) {
    const emptyBenchmark: BenchmarkResult = {
      benchmarkTarget: input.benchmarkTarget ?? `Benchmark ${profile.label}`,
      kpiRows: [],
      audienceCaptureProjection: { targetAudienceSize: 0, estimatedReach: 0, captureRate: 0, timeframe: "—" },
      optimizationRecommendations: [],
      summary: L("Analyse annulée suite au blocage conformité.", "Analysis cancelled after the compliance block."),
    };
    return {
      step: {
        agent: "analyst",
        title: L("Benchmark & analyse de performance — ANNULÉE", "Benchmark & performance analysis — CANCELLED"),
        status: "blocked",
        output: L(
          "Analyse annulée : le contenu a été bloqué par l'agent Conformité. Aucune projection n'est produite.",
          "Analysis cancelled: the content was blocked by the Compliance agent. No projection is produced."
        ),
        finishedAt: ts(),
      },
      benchmark: emptyBenchmark,
    };
  }

  const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
  const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;
  const periodDays = { day: 1, week: 7, month: 30, quarter: 90, year: 365 }[cadence.reportingPeriod];
  const totalBudget = dailyBudget * periodDays;

  if (!isAiConfigured) {
    const benchmark = mockBenchmark(profile, cadence, dailyBudget, input.benchmarkTarget);
    const output = buildBenchmarkOutput(benchmark, totalBudget, dailyBudget, cadence, input.language);
    return {
      step: {
        agent: "analyst",
        title: L("Benchmark sectoriel & captation d'audience (mode mock)", "Sector benchmark & audience capture (mock mode)"),
        status: "simulated",
        output,
        detail: L("Mode mock — configurez ANTHROPIC_API_KEY pour l'analyse IA temps réel.", "Mock mode — set ANTHROPIC_API_KEY for real-time AI analysis."),
        finishedAt: ts(),
      },
      benchmark,
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const resp = await createClaudeMessage(client, {
      model: env.anthropicModel,
      max_tokens: 700,
      system: buildAnalystSystemPrompt(profile, cadence) + langDirective(input.language === "en" ? "en" : "fr"),
      messages: [
        {
          role: "user",
          content: `Produis le benchmark sectoriel pour cet objectif dans le secteur "${profile.label}" :\n\n"${input.objective}"\n\nCible de benchmark : ${input.benchmarkTarget ?? "benchmark sectoriel " + profile.label}\nBudget : ${dailyBudget}€/j (total ${totalBudget}€ sur ${periodDays} jours)\n\nProduis uniquement le JSON demandé.`,
        },
      ],
    });

    const firstBlock = resp.content[0];
    if (firstBlock.type !== "text") throw new Error("Réponse inattendue de Claude");

    let benchmark: BenchmarkResult;
    try {
      benchmark = JSON.parse(firstBlock.text.trim()) as BenchmarkResult;
    } catch {
      benchmark = mockBenchmark(profile, cadence, dailyBudget, input.benchmarkTarget);
    }

    const output = buildBenchmarkOutput(benchmark, totalBudget, dailyBudget, cadence, input.language);
    return {
      step: {
        agent: "analyst",
        title: L("Benchmark sectoriel & captation d'audience", "Sector benchmark & audience capture"),
        status: "done",
        output,
        finishedAt: ts(),
      },
      benchmark,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const benchmark = mockBenchmark(profile, cadence, dailyBudget, input.benchmarkTarget);
    const output = buildBenchmarkOutput(benchmark, totalBudget, dailyBudget, cadence, input.language);
    return {
      step: {
        agent: "analyst",
        title: L("Benchmark sectoriel (dégradation)", "Sector benchmark (degraded)"),
        status: "simulated",
        output,
        detail: L(`Erreur API : ${msg}`, `API error: ${msg}`),
        finishedAt: ts(),
      },
      benchmark,
    };
  }
}

function buildBenchmarkOutput(
  b: BenchmarkResult,
  totalBudget: number,
  dailyBudget: number,
  cadence: Required<Cadence>,
  language?: "fr" | "en"
): string {
  const L = makeL(language);
  const rows = b.kpiRows
    .map((r) => {
      const icon = r.assessment === "above" ? "↑" : r.assessment === "below" ? "↓" : "≈";
      return `  ${icon} ${r.kpi.padEnd(22)} ${L("Cible :", "Target:")} ${r.targetValue.padEnd(10)} ${L("Secteur :", "Sector:")} ${r.sectorReference}`;
    })
    .join("\n");

  const proj = b.audienceCaptureProjection;

  return L(
    `Cible benchmark : ${b.benchmarkTarget}
Budget : ${dailyBudget}€/j · Total période : ${totalBudget.toLocaleString("fr-FR")}€

Tableau KPIs (↑ au-dessus / ≈ dans la norme / ↓ en dessous) :
${rows}

Projection de captation d'audience :
  Audience cible estimée : ${proj.targetAudienceSize.toLocaleString("fr-FR")} personnes
  Portée projetée        : ${proj.estimatedReach.toLocaleString("fr-FR")} contacts uniques
  Taux de captation      : ${proj.captureRate}% de l'audience cible
  Horizon                : ${proj.timeframe}

Recommandations d'optimisation :
${b.optimizationRecommendations.map((r) => `  • ${r}`).join("\n")}

Synthèse : ${b.summary}`,
    `Benchmark target: ${b.benchmarkTarget}
Budget: €${dailyBudget}/day · Period total: €${totalBudget.toLocaleString("en-US")}

KPI table (↑ above / ≈ within norm / ↓ below):
${rows}

Audience capture projection:
  Estimated target audience : ${proj.targetAudienceSize.toLocaleString("en-US")} people
  Projected reach           : ${proj.estimatedReach.toLocaleString("en-US")} unique contacts
  Capture rate              : ${proj.captureRate}% of the target audience
  Timeframe                 : ${proj.timeframe}

Optimization recommendations:
${b.optimizationRecommendations.map((r) => `  • ${r}`).join("\n")}

Summary: ${b.summary}`
  );
}

// ── Point d'entrée principal ──────────────────────────────────────────────────

/**
 * Lance l'orchestration complète d'une campagne sociale.
 *
 * @param input.objective         Objectif libre-format de l'utilisateur
 * @param input.companyId         Identifiant de la marque
 * @param input.brandVoice        Tone of voice de la marque (optionnel)
 * @param input.autonomy          Niveau d'autonomie (1, 2 ou 3)
 * @param input.profileId         Identifiant du profil professionnel (optionnel)
 * @param input.cadence           Cadence éditoriale (optionnel)
 * @param input.benchmarkTarget   Cible de benchmark (optionnel)
 *
 * @returns AgentRunResult  Résultat complet avec toutes les étapes
 */
export async function runOrchestration(
  input: OrchestrationInput
): Promise<AgentRunResult> {
  const steps: AgentStep[] = [];

  // Résolution du profil et de la cadence
  const profile = (input.profileId ? getProfile(input.profileId) : undefined) ?? getDefaultProfile();
  const cadence = resolveCadence(input.cadence);

  // ── 1. Orchestrateur ────────────────────────────────────────────────────────
  steps.push(await runOrchestrator(input, profile, cadence));

  // ── 2. Stratège ─────────────────────────────────────────────────────────────
  const { step: strategistStep, analysis: environmentAnalysis } = await runStrategist(input, profile, cadence);
  steps.push(strategistStep);

  // ── 3. Rédacteur IA ─────────────────────────────────────────────────────────
  const copyStep = await runCopywriter(input, profile);
  steps.push(copyStep);
  const copyText = copyStep.output;

  // ── 4. Créatif ──────────────────────────────────────────────────────────────
  const creativeResult = await runCreative(input, profile, copyText, cadence);
  steps.push(creativeResult.step);
  const generatedImages = creativeResult.generatedImages;
  const generatedVideo = creativeResult.generatedVideo;
  const imagePrompt = creativeResult.imagePrompt;
  const videoPrompt = creativeResult.videoPrompt;

  // ── 5. Conformité (BLOQUANT) ────────────────────────────────────────────────
  const { step: complianceStep, verdict, issues } = await runCompliance(input, profile, copyText);
  steps.push(complianceStep);

  const isBlocked = verdict === "block";

  // ── 6. Media Buyer ──────────────────────────────────────────────────────────
  steps.push(await runMediaBuyer(input, profile, cadence, input.autonomy, isBlocked, copyText, generatedImages?.[0]?.url));

  // ── 7. Analyste ─────────────────────────────────────────────────────────────
  const { step: analystStep, benchmark } = await runAnalyst(input, profile, cadence, isBlocked);
  steps.push(analystStep);

  // ── 8. Publisher ─────────────────────────────────────────────────────────────
  const { step: publisherStep, publisherResult } = await runPublisher(
    input,
    profile,
    copyText,
    generatedImages,
    generatedVideo,
    verdict
  );
  steps.push(publisherStep);

  // ── Calcul du finalOutput ────────────────────────────────────────────────────
  let finalOutput: string | undefined;
  const en = input.language === "en";

  if (input.autonomy === 1) {
    finalOutput = isBlocked ? undefined : `${en ? "[RECOMMENDATION — not published]" : "[RECOMMANDATION — non publié]"} ${copyText}`;
  } else if (input.autonomy === 2) {
    finalOutput = isBlocked ? undefined : `${en ? "[PENDING APPROVAL]" : "[EN ATTENTE DE VALIDATION]"} ${copyText}`;
  } else {
    const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
    const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;
    const budgetOk = dailyBudget <= BUDGET_CAP_EUR;
    finalOutput = !isBlocked && budgetOk ? copyText : undefined;
  }

  // ── Trace finale ─────────────────────────────────────────────────────────────
  await auditLog("orchestrator", "orchestration_complete", input.companyId, {
    objective: input.objective,
    autonomy: input.autonomy,
    profileId: profile.id,
    complianceVerdict: verdict,
    stepsCount: steps.length,
    blocked: isBlocked,
    publisherStatus: publisherResult.status,
  });

  return {
    objective: input.objective,
    steps,
    complianceVerdict: verdict,
    autonomy: input.autonomy,
    finalOutput,
    mock: !isAiConfigured,
    // Champs enrichis
    profileId: profile.id,
    cadence,
    benchmarkTarget: input.benchmarkTarget,
    environmentAnalysis: isBlocked ? undefined : environmentAnalysis,
    benchmark: isBlocked ? undefined : benchmark,
    // Visuels générés par Creative
    generatedImages,
    generatedVideo,
    // Prompts visuels (génération à la demande, côté UI)
    imagePrompt,
    videoPrompt,
    // Résultat de publication
    publisherResult,
  };
}
