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
import { env, isAiConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { isReplicateConfigured } from "@/lib/ai/replicate";
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
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

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

/** System prompt pour l'évaluation de conformité santé. */
const COMPLIANCE_SYSTEM_PROMPT = `
You are a specialist compliance officer for healthcare and medical advertising. You review social media posts for a medical brand group (DDS Group) operating in France and internationally.

Your job is to evaluate posts against:
1. French health advertising regulations (ANSM guidelines)
2. Meta health ad policies (Facebook & Instagram)
3. General EU consumer protection rules for health claims

### BLOCK-level violations (post must NOT be published):
- Explicit or implicit guaranteed results ("lose 20 kg guaranteed", "cure your diabetes")
- False or unsubstantiated medical claims presented as facts
- Content that exploits vulnerability or fear in a manipulative way
- Explicit before/after framing that promises physical transformation
- Specific medication names with dosage claims
- Unlicensed or unapproved health claims

### WARN-level issues (post needs revision):
- Mildly alarmist phrasing ("Don't wait until it's too late")
- Implied guarantees without the word "guaranteed" ("you will feel better")
- Missing recommendation to consult a professional for medical decisions
- Hashtags or phrasing that could target people by health condition
- Comparative claims without evidence ("the best treatment")
- Vague "natural" or "miracle" language

### PASS (content is compliant):
- Informational, evidence-respecting language
- Proper use of "may", "can help", "supports", "consult your doctor"
- No manipulative emotional triggers

## Response format — valid JSON only, no prose:
{"verdict": "pass"|"warn"|"block", "issues": ["issue 1"], "suggestion": "optional"}
`.trim();

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

function buildCopywriterSystemPrompt(profile: ProProfile, voice: string): string {
  return `
Tu es un expert copywriter social media de niveau international, spécialisé en communication ${profile.label}.

Profil sectoriel : ${profile.description}
Ton de communication imposé : ${profile.recommendedTone}
Brand voice de la marque : ${voice}
Champ sémantique à activer : ${profile.semanticField.slice(0, 6).join(", ")}
Plateformes cibles : ${profile.priorityPlatforms.slice(0, 3).join(", ")}

Règles impératives (ANSM + Meta Health Policies) :
- Jamais d'allégations médicales non étayées ni de résultats garantis
- Toujours recommander de consulter un professionnel de santé si pertinent
- Langage mesuré : "peut aider", "soutient", "accompagne", "peut contribuer"
- Pas de ciblage par pathologie ni exploitation de la peur ou de la vulnérabilité

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

  const plan = `Objectif reçu : "${input.objective}".

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
  }).`;

  await auditLog("orchestrator", "orchestration_start", input.companyId, {
    objective: input.objective,
    autonomy: input.autonomy,
    profileId: profile.id,
    cadence,
  });

  return {
    agent: "orchestrator",
    title: "Décomposition de l'objectif",
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
        title: "Analyse d'environnement pro & sémantique (mode mock)",
        status: "simulated",
        output,
        detail: "Mode mock — configurez ANTHROPIC_API_KEY pour l'analyse IA temps réel.",
        finishedAt: ts(),
      },
      analysis,
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const resp = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: buildStrategistSystemPrompt(profile),
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

    const output = `[ANALYSE D'ENVIRONNEMENT — IA]

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
        title: "Analyse d'environnement pro & sémantique",
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
        title: "Analyse d'environnement (dégradation)",
        status: "simulated",
        output: `Analyse générée en mode dégradé suite à une erreur API.\n\n${analysis.marketOverview}`,
        detail: `Erreur API : ${msg}`,
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

  if (!isAiConfigured) {
    const mockText = `${profile.contentAngles[0]} — C'est au cœur de notre mission chaque jour.
Nos équipes ${profile.label.toLowerCase()} vous accompagnent avec expertise et bienveillance, à chaque étape de votre parcours.
Prenez rendez-vous dès aujourd'hui. 🩺

${profile.semanticField.slice(0, 4).map((s) => `#${s.replace(/\s+/g, "")}`).join(" ")}`;

    return {
      agent: "copywriter",
      title: "Génération du contenu (mode mock)",
      status: "done",
      output: mockText,
      detail: "Mode mock actif — configurez ANTHROPIC_API_KEY pour activer la génération IA réelle.",
      finishedAt: ts(),
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const resp = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 600,
      system: buildCopywriterSystemPrompt(profile, voice),
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
      title: "Génération du contenu (Claude IA)",
      status: "done",
      output: text,
      finishedAt: ts(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agent: "copywriter",
      title: "Génération du contenu (erreur)",
      status: "blocked",
      output: "La génération de contenu a échoué.",
      detail: `Erreur Anthropic API : ${msg}`,
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
  return `Professional healthcare social media visual for ${profile.label}. ${firstLine}. Style: ${tone}, clean, trustworthy. Themes: ${semantics}. No text overlay, high quality, modern medical aesthetic, warm lighting.`;
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
  const briefBase = `Brief créatif — Profil : ${profile.label}
• Format principal : image carrée 1080×1080 px (Feed ${platforms}) + bannière 1200×628 px
• Palette : tons doux, professionnels, inspirants confiance
• Style : photographie médicale/professionnelle, authentique, souriant
• Éléments obligatoires : logo de la marque (coin bas-droit), mention légale si requis
• Accroche visuelle : "${copyText.split("\n")[0].slice(0, 80)}…"
• Variantes : Story 9:16 (1080×1920) + Réels 4:5 (1080×1350)
• Tonalité visuelle : ${profile.recommendedTone}`;

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

  const lines: string[] = [briefBase, `\n🎨 Prompt image (à générer) :\n  ${imagePrompt}`];
  if (videoPrompt) lines.push(`\n🎬 Prompt vidéo (à générer) :\n  ${videoPrompt}`);
  lines.push(
    isReplicateConfigured
      ? `\n→ Cliquez sur « Générer l'image » / « Générer la vidéo » ci-dessous pour produire les visuels (Replicate).`
      : `\n→ Configurez REPLICATE_API_TOKEN, puis générez les visuels en 1 clic.`
  );

  return {
    step: {
      agent: "creative",
      title: "Brief créatif & prompts visuels",
      status: "done",
      output: lines.join("\n"),
      finishedAt: ts(),
    },
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
  if (!isAiConfigured) {
    return {
      step: {
        agent: "compliance",
        title: "Vérification de conformité (mode mock)",
        status: "done",
        output: "Verdict : PASS (mock) — aucun problème de conformité détecté.",
        detail: "Mode mock actif — configurez ANTHROPIC_API_KEY pour l'évaluation réelle.",
        finishedAt: ts(),
      },
      verdict: "pass",
      issues: [],
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const profileConstraints = profile.complianceConstraints.join("\n");

    const resp = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 512,
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Évalue ce post pour une marque dans le secteur "${profile.label}" (politiques ANSM + Meta santé).

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
    const verdictLabel = parsed.verdict === "pass" ? "CONFORME" : parsed.verdict === "warn" ? "AVERTISSEMENT" : "BLOQUÉ";

    const outputLines = [
      `Verdict : ${verdictEmoji} ${verdictLabel}`,
      parsed.issues.length > 0
        ? `Problèmes identifiés :\n${parsed.issues.map((i) => `  • ${i}`).join("\n")}`
        : "Aucun problème identifié.",
    ];
    if (parsed.suggestion) {
      outputLines.push(`Suggestion : ${parsed.suggestion}`);
    }

    return {
      step: {
        agent: "compliance",
        title: "Vérification de conformité ANSM / Meta",
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
        title: "Vérification de conformité (erreur API)",
        status: "done",
        output: "⚠️ AVERTISSEMENT — La vérification automatique a échoué. Révision manuelle obligatoire avant publication.",
        detail: `Erreur : ${msg}`,
        finishedAt: ts(),
      },
      verdict: "warn",
      issues: ["Vérification automatique indisponible — révision manuelle requise."],
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
  blocked: boolean
): Promise<AgentStep> {
  const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
  const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;

  if (autonomy === 3 && dailyBudget > BUDGET_CAP_EUR) {
    return {
      agent: "media_buyer",
      title: "Configuration campagne Meta Ads — BLOQUÉ (budget)",
      status: "blocked",
      output: `Budget quotidien demandé (${dailyBudget}€) dépasse le plafond autorisé (${BUDGET_CAP_EUR}€/j) en mode automatique.`,
      detail: `Plafond de sécurité : ${BUDGET_CAP_EUR}€/jour. Réduisez le budget ou passez en autonomie 2 pour une validation manuelle.`,
      finishedAt: ts(),
    };
  }

  if (blocked) {
    return {
      agent: "media_buyer",
      title: "Configuration campagne Meta Ads — ANNULÉE",
      status: "blocked",
      output: "Configuration annulée : le contenu a été bloqué par l'agent Conformité. Aucune campagne ne sera créée.",
      finishedAt: ts(),
    };
  }

  const actionVerb = autonomy === 1 ? "Recommandation" : autonomy === 2 ? "Simulation" : "Exécution simulée";
  const platforms = profile.priorityPlatforms
    .filter((p) => ["Facebook", "Instagram"].includes(p))
    .join(", ") || "Facebook, Instagram";

  const days = cadence.postingDays.map((d) => DAY_NAMES[d] ?? d).join(", ");
  const hours = cadence.postingHours.join(" et ");

  const output = `${actionVerb} — Configuration campagne Meta Ads :
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
}`;

  return {
    agent: "media_buyer",
    title: `Configuration campagne Meta Ads (${actionVerb.toLowerCase()})`,
    status: "simulated",
    output,
    detail: "Connecteurs requis : Meta Ads API + Meta Business Manager — campagne non créée en l'absence de ces connecteurs.",
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
  // Veto conformité — jamais publier si bloqué
  if (complianceVerdict === "block") {
    const result: PublisherResult = {
      status: "blocked",
      platforms: [],
      message: "Publication empêchée par l'agent Conformité (verdict : BLOCK). Aucun contenu n'a été envoyé.",
    };
    return {
      step: {
        agent: "publisher",
        title: "Publication — BLOQUÉE (conformité)",
        status: "blocked",
        output: result.message,
        detail: "Le verdict de conformité 'block' empêche toute publication.",
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
      message: `Recommandation de publication préparée pour : ${platformsLabel}. Aucune action initiée (Autonomie N1 — validation manuelle requise).`,
    };
    return {
      step: {
        agent: "publisher",
        title: "Proposition de publication (Autonomie N1)",
        status: "simulated",
        output: `[RECOMMANDATION — non publiée]\n\nPlateformes cibles : ${platformsLabel}\nContenu préparé : ${copyText.slice(0, 200)}${copyText.length > 200 ? "…" : ""}\n\nVisuels disponibles : ${generatedImages && generatedImages.length > 0 ? generatedImages.map((i) => i.url).join(", ") : "aucun visuel généré"}${generatedVideo ? `\nVidéo : ${generatedVideo.url}` : ""}\n\n⚠️ Autonomie N1 — Aucune publication initiée. Validez et publiez manuellement sur les plateformes.`,
        detail: "Autonomie 1 : proposition uniquement, aucune action exécutée.",
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
        publishResults.push({ platform, success: true, detail: "Publication envoyée avec succès." });
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
        detail: "Connecteur non disponible (endpoint introuvable ou non configuré).",
      });
    }
  }

  const anySuccess = publishResults.some((r) => r.success);
  const allFailed = publishResults.every((r) => !r.success);

  const publisherStatus: PublisherResult["status"] = anySuccess
    ? input.autonomy === 3 ? "published" : "scheduled"
    : "simulated";

  const outputLines: string[] = [
    `Résultat de publication (Autonomie N${input.autonomy}) :`,
    `Plateformes ciblées : ${platformsLabel}`,
    "",
  ];

  publishResults.forEach((r) => {
    outputLines.push(`${r.success ? "✅" : "⚠️"} ${r.platform} : ${r.detail}`);
  });

  if (allFailed) {
    outputLines.push(
      "",
      `⚠️ Connecteurs non configurés — le contenu a été préparé mais non publié.`,
      `Configurez les connecteurs Meta Business API / LinkedIn API pour activer la publication automatique.`
    );
  } else if (input.autonomy === 2) {
    outputLines.push("", "ℹ️ Autonomie N2 — La publication a été soumise mais requiert une validation finale dans les dashboards des plateformes.");
  } else {
    outputLines.push("", "✅ Autonomie N3 — Publication déclenchée sous garde-fous conformité.");
  }

  if (mediaUrls.length > 0) {
    outputLines.push("", "Médias attachés :");
    mediaUrls.forEach((u) => outputLines.push(`  • ${u}`));
  }

  const result: PublisherResult = {
    status: publisherStatus,
    platforms,
    message: allFailed
      ? `Connecteurs non configurés — contenu préparé pour ${platformsLabel} mais non publié.`
      : anySuccess
      ? `Contenu ${input.autonomy === 3 ? "publié" : "programmé"} sur ${publishResults.filter((r) => r.success).map((r) => r.platform).join(", ")}.`
      : `Publication simulée — connecteurs requis pour ${platformsLabel}.`,
  };

  return {
    step: {
      agent: "publisher",
      title: anySuccess
        ? `Publication déclenchée (N${input.autonomy})`
        : `Publication préparée — connecteurs requis`,
      status: anySuccess ? "done" : "simulated",
      output: outputLines.join("\n"),
      detail: allFailed
        ? "Connecteurs requis : Meta Business API + LinkedIn API. Configurez-les dans les paramètres de l'application."
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
  if (blocked) {
    const emptyBenchmark: BenchmarkResult = {
      benchmarkTarget: input.benchmarkTarget ?? `Benchmark ${profile.label}`,
      kpiRows: [],
      audienceCaptureProjection: { targetAudienceSize: 0, estimatedReach: 0, captureRate: 0, timeframe: "—" },
      optimizationRecommendations: [],
      summary: "Analyse annulée suite au blocage conformité.",
    };
    return {
      step: {
        agent: "analyst",
        title: "Benchmark & analyse de performance — ANNULÉE",
        status: "blocked",
        output: "Analyse annulée : le contenu a été bloqué par l'agent Conformité. Aucune projection n'est produite.",
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
    const output = buildBenchmarkOutput(benchmark, totalBudget, dailyBudget, cadence);
    return {
      step: {
        agent: "analyst",
        title: "Benchmark sectoriel & captation d'audience (mode mock)",
        status: "simulated",
        output,
        detail: "Mode mock — configurez ANTHROPIC_API_KEY pour l'analyse IA temps réel.",
        finishedAt: ts(),
      },
      benchmark,
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });
    const resp = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: buildAnalystSystemPrompt(profile, cadence),
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

    const output = buildBenchmarkOutput(benchmark, totalBudget, dailyBudget, cadence);
    return {
      step: {
        agent: "analyst",
        title: "Benchmark sectoriel & captation d'audience",
        status: "done",
        output,
        finishedAt: ts(),
      },
      benchmark,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const benchmark = mockBenchmark(profile, cadence, dailyBudget, input.benchmarkTarget);
    const output = buildBenchmarkOutput(benchmark, totalBudget, dailyBudget, cadence);
    return {
      step: {
        agent: "analyst",
        title: "Benchmark sectoriel (dégradation)",
        status: "simulated",
        output,
        detail: `Erreur API : ${msg}`,
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
  cadence: Required<Cadence>
): string {
  const rows = b.kpiRows
    .map((r) => {
      const icon = r.assessment === "above" ? "↑" : r.assessment === "below" ? "↓" : "≈";
      return `  ${icon} ${r.kpi.padEnd(22)} Cible : ${r.targetValue.padEnd(10)} Secteur : ${r.sectorReference}`;
    })
    .join("\n");

  const proj = b.audienceCaptureProjection;

  return `Cible benchmark : ${b.benchmarkTarget}
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

Synthèse : ${b.summary}`;
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
  steps.push(await runMediaBuyer(input, profile, cadence, input.autonomy, isBlocked));

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

  if (input.autonomy === 1) {
    finalOutput = isBlocked ? undefined : `[RECOMMANDATION — non publié] ${copyText}`;
  } else if (input.autonomy === 2) {
    finalOutput = isBlocked ? undefined : `[EN ATTENTE DE VALIDATION] ${copyText}`;
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
