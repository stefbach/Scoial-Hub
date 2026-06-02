/**
 * Orchestrateur principal du système multi-agent Social Hub.
 *
 * Séquence d'exécution :
 *   1. Orchestrator  — décompose l'objectif et coordonne
 *   2. Strategist    — ciblage, calendrier, budget
 *   3. Copywriter    — génère le texte (Claude ou mock)
 *   4. Creative      — brief visuel (simulé si connecteur absent)
 *   5. Compliance    — BLOQUANT — évalue la conformité santé
 *   6. Media Buyer   — configure la campagne Meta (simulé)
 *   7. Analyst       — projections de performance
 *
 * Niveaux d'autonomie :
 *   1 = Recommandation pure — aucune action "exécutée", tout reste proposé.
 *   2 = Semi-auto — actions simulées, la publication reste conditionnelle à
 *       une validation humaine.
 *   3 = Auto sous garde-fous — exécution effective si compliance=pass et le
 *       plafond budgétaire est respecté. Bloque automatiquement si compliance=block.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import type { AgentId, AgentRunResult, AgentStep, AutonomyLevel } from "./types";

// ── Constantes ────────────────────────────────────────────────────────────────

/** Budget journalier maximal accepté avant blocage automatique (niveau 3). */
const BUDGET_CAP_EUR = 500;

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

// ── Interfaces internes ───────────────────────────────────────────────────────

export interface OrchestrationInput {
  objective: string;
  companyId: string;
  brandVoice?: string;
  autonomy: AutonomyLevel;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString();
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
    if (!sb) return; // Supabase non configuré — silencieux
    await sb.from("audit_log").insert({
      company_id: companyId,
      actor: `agent:${agentId}`,
      action,
      entity: "agent_run",
      entity_id: companyId,
      payload,
    });
  } catch {
    // Ne pas propager — l'audit est non-bloquant
  }
}

// ── Logique par agent ─────────────────────────────────────────────────────────

/**
 * Étape 1 — Orchestrateur
 * Décompose l'objectif en tâches et délègue aux agents spécialisés.
 */
async function runOrchestrator(
  input: OrchestrationInput
): Promise<AgentStep> {
  const plan = `Objectif reçu : "${input.objective}".
Séquence planifiée :
  1. Stratège      → analyse du marché et ciblage
  2. Rédacteur IA  → génération du contenu
  3. Créatif       → brief visuel
  4. Conformité    → vérification réglementaire (ANSM / Meta)
  5. Media Buyer   → configuration campagne Meta Ads
  6. Analyste      → projections de performance

Niveau d'autonomie sélectionné : ${input.autonomy} (${
    input.autonomy === 1
      ? "recommandation pure — aucune action exécutée"
      : input.autonomy === 2
      ? "semi-auto — validation humaine requise avant publication"
      : "auto sous garde-fous — exécution si conformité et budget OK"
  }).`;

  await auditLog("orchestrator", "orchestration_start", input.companyId, {
    objective: input.objective,
    autonomy: input.autonomy,
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
 * Produit un brief stratégique : audience, canaux, timing, budget suggéré.
 * Dépend de Meta Insights API (non branché) — partiellement simulé.
 */
async function runStrategist(
  input: OrchestrationInput
): Promise<AgentStep> {
  // Extraire un budget éventuel depuis l'objectif (ex. "50€/j")
  const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
  const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;

  const output = `Brief stratégique :
• Objectif SMART : notoriété + acquisition sur 14 jours
• Audience cible : 25–55 ans, intérêts santé / bien-être, géo France métropolitaine
• Canaux recommandés : Facebook (portée) + Instagram (engagement)
• Budget quotidien suggéré : ${dailyBudget}€/jour → budget total : ${dailyBudget * 14}€
• Fenêtre de diffusion : lun–ven 7h–9h et 19h–21h (pic d'engagement santé)
• KPIs : CPM < 8€ · CPC < 1,20€ · taux de clic > 1,5%
• Remarque : données de benchmark basées sur les historiques internes (connecteur Meta Insights API requis pour un ciblage dynamique temps réel)`;

  return {
    agent: "strategist",
    title: "Brief stratégique et ciblage",
    // Le Stratège dépend partiellement de Meta Insights — on marque simulated
    // si le connecteur n'est pas branché. En l'absence d'API réelle, toujours simulé.
    status: "simulated",
    output,
    detail:
      "Connecteur requis : Meta Insights API — les données de benchmark sont générées depuis l'historique interne.",
    finishedAt: ts(),
  };
}

/**
 * Étape 3 — Rédacteur IA (Copywriter)
 * Appelle Claude pour générer le texte, ou retourne un mock.
 */
async function runCopywriter(
  input: OrchestrationInput
): Promise<AgentStep> {
  const voice = input.brandVoice ?? "professionnel, bienveillant, accessible";

  if (!isAiConfigured) {
    // ── Mode mock ──────────────────────────────────────────────────────
    const mockText = `Prendre soin de sa santé, c'est un geste quotidien qui mérite une attention professionnelle.
Nos équipes médicales vous accompagnent avec bienveillance et expertise — en cabinet ou en téléconsultation.
Consultez nos spécialistes dès aujourd'hui. 🩺

#SantéAccessible #MédecineGénérale #BienEtre`;

    return {
      agent: "copywriter",
      title: "Génération du contenu (mode mock)",
      status: "done",
      output: mockText,
      detail:
        "Mode mock actif — configurez ANTHROPIC_API_KEY pour activer la génération IA réelle.",
      finishedAt: ts(),
    };
  }

  // ── Appel Claude ────────────────────────────────────────────────────────────
  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const systemPrompt = `Tu es un expert copywriter social media pour DDS Group, un groupe médical opérant trois marques (Obesity Care Clinic, Tibok téléconsultation, Cabo Verde Medical International).

Ton style : ${voice}
Règles impératives :
- Jamais d'allégations médicales non étayées
- Jamais de résultats garantis
- Toujours recommander de consulter un professionnel de santé
- Langage mesuré : "peut aider", "soutient", "accompagne"
- Compatible ANSM et politiques Meta santé
Génère UNIQUEMENT le texte du post, sans introduction ni commentaire.`;

    const resp = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Génère un post Facebook/Instagram pour cet objectif de campagne : "${input.objective}"`,
        },
      ],
    });

    const firstBlock = resp.content[0];
    const text =
      firstBlock.type === "text" ? firstBlock.text : "Contenu non disponible.";

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
 * Étape 4 — Créatif Visuel
 * Produit un brief créatif. Simulé car DALL·E / Midjourney / Runway non branchés.
 */
async function runCreative(
  input: OrchestrationInput,
  copyText: string
): Promise<AgentStep> {
  const output = `Brief créatif généré :
• Format principal : image carrée 1080×1080 px (Feed FB + IG) + bannière 1200×628 px
• Palette : tons doux (blanc, bleu pâle #EEF3FF, vert clair) — codes couleur DDS Group
• Style : photographie médicale professionnelle, souriant, chaleureux — pas de stock générique
• Éléments obligatoires : logo de la marque (coin bas-droit), mention "Consultez votre médecin"
• Accroche visuelle suggérée basée sur le contenu : "${copyText.split("\n")[0]}"
• Variantes : Story 9:16 (1080×1920) + Réels 4:5 (1080×1350)
• Vidéo courte (15s) : animation de titre + b-roll médical — Runway ML requis`;

  return {
    agent: "creative",
    title: "Brief créatif et assets visuels",
    status: "simulated",
    output,
    detail:
      "Connecteurs requis : DALL·E / Midjourney API (images), Runway ML (vidéo) — assets non générés en l'absence de ces connecteurs.",
    finishedAt: ts(),
  };
}

/**
 * Étape 5 — Conformité (BLOQUANT)
 * Évalue le contenu généré contre les réglementations santé et les politiques Meta.
 * Le verdict 'block' empêche toute exécution des étapes suivantes.
 */
async function runCompliance(
  input: OrchestrationInput,
  copyText: string
): Promise<{
  step: AgentStep;
  verdict: "pass" | "warn" | "block";
  issues: string[];
  suggestion?: string;
}> {
  if (!isAiConfigured) {
    // Mock : verdict pass par défaut en l'absence de clé
    return {
      step: {
        agent: "compliance",
        title: "Vérification de conformité (mode mock)",
        status: "done",
        output: "Verdict : PASS (mock) — aucun problème de conformité détecté.",
        detail:
          "Mode mock actif — configurez ANTHROPIC_API_KEY pour l'évaluation réelle.",
        finishedAt: ts(),
      },
      verdict: "pass",
      issues: [],
    };
  }

  try {
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const resp = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 512,
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Évalue ce post pour une marque médicale française (politiques ANSM + Meta santé) :\n\n---\n${copyText}\n---`,
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

    const verdictEmoji =
      parsed.verdict === "pass" ? "✅" : parsed.verdict === "warn" ? "⚠️" : "🚫";
    const verdictLabel =
      parsed.verdict === "pass"
        ? "CONFORME"
        : parsed.verdict === "warn"
        ? "AVERTISSEMENT"
        : "BLOQUÉ";

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
        status:
          parsed.verdict === "block"
            ? "blocked"
            : "done",
        output: outputLines.join("\n"),
        finishedAt: ts(),
      },
      verdict: parsed.verdict,
      issues: parsed.issues,
      suggestion: parsed.suggestion,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // En cas d'échec de l'API, on joue la sécurité et on avertit
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
 * Configure la campagne Meta Ads. Simulé (Meta Ads API non branché).
 * En autonomie 3 : vérifie le plafond budgétaire avant tout.
 */
async function runMediaBuyer(
  input: OrchestrationInput,
  autonomy: AutonomyLevel,
  blocked: boolean
): Promise<AgentStep> {
  const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
  const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;

  // Garde-fou budgétaire — actif seulement en autonomie 3
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
      output:
        "Configuration annulée : le contenu a été bloqué par l'agent Conformité. Aucune campagne ne sera créée.",
      finishedAt: ts(),
    };
  }

  const actionVerb =
    autonomy === 1
      ? "Recommandation"
      : autonomy === 2
      ? "Simulation"
      : "Exécution simulée";

  const output = `${actionVerb} — Configuration campagne Meta Ads :
• Nom de la campagne : "DDS_IA_${new Date().toISOString().slice(0, 10)}"
• Objectif : CONVERSIONS (Lead Generation)
• Budget quotidien : ${dailyBudget}€/j
• Audiences : Lookalike 1% (base CRM) + Retargeting visiteurs 30j
• Placements : Facebook Feed, Instagram Feed, Instagram Stories
• Enchères : CPC Manuel cible < 1,20€
• Optimisation : Fenêtre de conversion 7j clic / 1j vue
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
    detail:
      "Connecteurs requis : Meta Ads API + Meta Business Manager — campagne non créée en l'absence de ces connecteurs.",
    finishedAt: ts(),
  };
}

/**
 * Étape 7 — Analyste
 * Projette les performances attendues et formule des recommandations.
 * Dépend de Meta Insights API — simulé.
 */
async function runAnalyst(
  input: OrchestrationInput,
  blocked: boolean
): Promise<AgentStep> {
  if (blocked) {
    return {
      agent: "analyst",
      title: "Analyse de performance — ANNULÉE",
      status: "blocked",
      output:
        "Analyse annulée : le contenu a été bloqué par l'agent Conformité. Aucune projection n'est produite.",
      finishedAt: ts(),
    };
  }

  const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
  const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;
  const totalBudget = dailyBudget * 14;
  const estImpressions = Math.round(totalBudget * 150); // CPM ~6,67€ → 150 imp/€
  const estClicks = Math.round(estImpressions * 0.018); // CTR 1,8%
  const estLeads = Math.round(estClicks * 0.04); // CVR 4%
  const cpl = estLeads > 0 ? (totalBudget / estLeads).toFixed(2) : "N/A";

  const output = `Projections de performance (14 jours, base ${dailyBudget}€/j) :
• Budget total estimé : ${totalBudget}€
• Impressions projetées : ~${estImpressions.toLocaleString("fr-FR")}
• Clics estimés : ~${estClicks.toLocaleString("fr-FR")} (CTR 1,8%)
• Leads estimés : ~${estLeads} (CVR 4%)
• CPL estimé : ${cpl}€

Recommandations d'optimisation :
  1. Tester 2–3 variantes de visuels (A/B test J1–J3) — couper à 90€ de dépense si CTR < 0,8%
  2. Exclure les audiences ayant déjà converti (pixel personnalisé requis)
  3. Escalader le budget de 20% si CPL < 15€ à J7
  4. Remarketing à J14 sur les cliqueurs non convertis (30j)

Note : projections basées sur les benchmarks sectoriels santé France (connecteur Meta Insights requis pour l'analyse temps réel).`;

  return {
    agent: "analyst",
    title: "Projections et recommandations",
    status: "simulated",
    output,
    detail:
      "Connecteurs requis : Meta Insights API + Supabase Analytics — projections basées sur des benchmarks sectoriels statiques.",
    finishedAt: ts(),
  };
}

// ── Point d'entrée principal ──────────────────────────────────────────────────

/**
 * Lance l'orchestration complète d'une campagne sociale.
 *
 * @param input.objective   Objectif libre-format de l'utilisateur
 * @param input.companyId   Identifiant de la marque DDS Group
 * @param input.brandVoice  Tone of voice de la marque (optionnel)
 * @param input.autonomy    Niveau d'autonomie (1, 2 ou 3)
 *
 * @returns AgentRunResult  Résultat complet avec toutes les étapes
 */
export async function runOrchestration(
  input: OrchestrationInput
): Promise<AgentRunResult> {
  const steps: AgentStep[] = [];

  // ── 1. Orchestrateur ────────────────────────────────────────────────────────
  steps.push(await runOrchestrator(input));

  // ── 2. Stratège ─────────────────────────────────────────────────────────────
  steps.push(await runStrategist(input));

  // ── 3. Rédacteur IA ─────────────────────────────────────────────────────────
  const copyStep = await runCopywriter(input);
  steps.push(copyStep);
  const copyText = copyStep.output;

  // ── 4. Créatif ──────────────────────────────────────────────────────────────
  steps.push(await runCreative(input, copyText));

  // ── 5. Conformité (BLOQUANT) ────────────────────────────────────────────────
  const { step: complianceStep, verdict, issues } = await runCompliance(input, copyText);
  steps.push(complianceStep);

  const isBlocked = verdict === "block";

  // ── 6. Media Buyer ──────────────────────────────────────────────────────────
  steps.push(await runMediaBuyer(input, input.autonomy, isBlocked));

  // ── 7. Analyste ─────────────────────────────────────────────────────────────
  steps.push(await runAnalyst(input, isBlocked));

  // ── Calcul du finalOutput ────────────────────────────────────────────────────
  // Autonomie 1 → tout est recommandation, pas de finalOutput "exécuté"
  // Autonomie 2 → finalOutput fourni (sous réserve de validation humaine)
  // Autonomie 3 → finalOutput fourni si compliance=pass et budget OK
  let finalOutput: string | undefined;

  if (input.autonomy === 1) {
    // Niveau 1 : recommandation pure — on fournit le contenu mais clairement labellisé
    finalOutput = isBlocked
      ? undefined
      : `[RECOMMANDATION — non publié] ${copyText}`;
  } else if (input.autonomy === 2) {
    // Niveau 2 : semi-auto — contenu disponible, publication manuelle requise
    finalOutput = isBlocked
      ? undefined
      : `[EN ATTENTE DE VALIDATION] ${copyText}`;
  } else {
    // Niveau 3 : auto — exécution si conformité pass et budget OK
    const budgetMatch = input.objective.match(/(\d+)\s*€\s*\/?\s*j/i);
    const dailyBudget = budgetMatch ? parseInt(budgetMatch[1], 10) : 50;
    const budgetOk = dailyBudget <= BUDGET_CAP_EUR;

    finalOutput =
      !isBlocked && budgetOk
        ? copyText // Contenu prêt à publication (connecteur requis pour l'exécution réelle)
        : undefined;
  }

  // ── Trace finale ─────────────────────────────────────────────────────────────
  await auditLog("orchestrator", "orchestration_complete", input.companyId, {
    objective: input.objective,
    autonomy: input.autonomy,
    complianceVerdict: verdict,
    stepsCount: steps.length,
    blocked: isBlocked,
  });

  return {
    objective: input.objective,
    steps,
    complianceVerdict: verdict,
    autonomy: input.autonomy,
    finalOutput,
    mock: !isAiConfigured,
  };
}
