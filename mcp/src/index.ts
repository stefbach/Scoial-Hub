/**
 * Serveur MCP (Model Context Protocol) — Social Hub
 *
 * Ce serveur expose des "tools" MCP qui permettent à Claude Desktop (ou tout
 * client MCP compatible) de piloter l'application Social Hub à distance via
 * son API HTTP.
 *
 * Lancement : node dist/index.js
 * Transport  : stdio (standard MCP pour Claude Desktop)
 *
 * Variable d'environnement :
 *   SOCIAL_HUB_URL  — URL de base de l'app (défaut : http://localhost:3000)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Configuration ────────────────────────────────────────────────────────────

/** URL de base de l'API Social Hub. Configurable via variable d'environnement. */
const BASE_URL = process.env.SOCIAL_HUB_URL ?? "http://localhost:3000";

// ─── Utilitaires HTTP ────────────────────────────────────────────────────────

/**
 * Effectue une requête GET sur l'API Social Hub et retourne le corps JSON.
 * Lève une erreur lisible si la réponse n'est pas OK.
 */
async function apiGet(path: string): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Impossible de joindre Social Hub à l'adresse ${url}. Vérifiez que l'application est démarrée et que SOCIAL_HUB_URL est correcte. Détail : ${message}`
    );
  }

  if (!response.ok) {
    let corps = "";
    try {
      corps = await response.text();
    } catch {
      // Impossible de lire le corps — on continue avec une chaîne vide.
    }
    throw new Error(
      `L'API a répondu ${response.status} ${response.statusText} sur GET ${path}. Corps : ${corps}`
    );
  }

  return response.json();
}

/**
 * Effectue une requête POST sur l'API Social Hub et retourne le corps JSON.
 * Lève une erreur lisible si la réponse n'est pas OK.
 */
async function apiPost(path: string, body: unknown): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Impossible de joindre Social Hub à l'adresse ${url}. Vérifiez que l'application est démarrée et que SOCIAL_HUB_URL est correcte. Détail : ${message}`
    );
  }

  if (!response.ok) {
    let corps = "";
    try {
      corps = await response.text();
    } catch {
      // Impossible de lire le corps — on continue avec une chaîne vide.
    }
    throw new Error(
      `L'API a répondu ${response.status} ${response.statusText} sur POST ${path}. Corps : ${corps}`
    );
  }

  return response.json();
}

/**
 * Formate un résultat JSON en texte lisible pour la réponse MCP.
 */
function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ─── Initialisation du serveur MCP ────────────────────────────────────────────

const server = new McpServer({
  name: "social-hub-mcp",
  version: "1.0.0",
});

// ─── Tool : list_companies ────────────────────────────────────────────────────

server.tool(
  "list_companies",
  "Liste toutes les entreprises (marques) disponibles dans Social Hub. " +
    "Utilisez ce tool en premier pour obtenir les identifiants (companyId) " +
    "nécessaires aux autres tools.",
  {},
  async () => {
    try {
      const data = await apiGet("/api/companies");
      return {
        content: [
          {
            type: "text",
            text: `Entreprises disponibles dans Social Hub :\n\n${formatJson(data)}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erreur — list_companies : ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool : list_campaigns ────────────────────────────────────────────────────

server.tool(
  "list_campaigns",
  "Liste toutes les campagnes d'une entreprise donnée. " +
    "Fournit le nom, le statut, les plateformes ciblées et les métriques de performance.",
  {
    companyId: z
      .string()
      .min(1)
      .describe(
        "Identifiant unique de l'entreprise (obtenu via list_companies)."
      ),
  },
  async ({ companyId }) => {
    try {
      const data = await apiGet(`/api/campaigns?companyId=${encodeURIComponent(companyId)}`);
      return {
        content: [
          {
            type: "text",
            text: `Campagnes pour l'entreprise ${companyId} :\n\n${formatJson(data)}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erreur — list_campaigns : ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool : list_agents ───────────────────────────────────────────────────────

server.tool(
  "list_agents",
  "Liste tous les agents IA disponibles dans Social Hub (ex : Stratège, Rédacteur, " +
    "Compliance, Scheduler…). Utile pour comprendre les capacités d'orchestration " +
    "avant de lancer run_agent_orchestration.",
  {},
  async () => {
    try {
      const data = await apiGet("/api/agents");
      return {
        content: [
          {
            type: "text",
            text: `Agents disponibles dans Social Hub :\n\n${formatJson(data)}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erreur — list_agents : ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool : connector_status ──────────────────────────────────────────────────

server.tool(
  "connector_status",
  "Retourne l'état de connexion de tous les connecteurs de réseaux sociaux " +
    "(Facebook, Instagram, LinkedIn). Indique si les comptes sont authentifiés " +
    "et prêts à publier.",
  {},
  async () => {
    try {
      const data = await apiGet("/api/connectors");
      return {
        content: [
          {
            type: "text",
            text: `Statut des connecteurs sociaux :\n\n${formatJson(data)}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erreur — connector_status : ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool : run_agent_orchestration ──────────────────────────────────────────

/** Schéma Zod pour la cadence éditoriale (objet optionnel). */
const CadenceSchema = z.object({
  postsPerWeek: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Nombre de publications par semaine."),
  platforms: z
    .array(z.enum(["facebook", "instagram", "linkedin"]))
    .optional()
    .describe("Plateformes ciblées par la cadence."),
  preferredDays: z
    .array(z.string())
    .optional()
    .describe("Jours préférés de publication (ex : ['lundi', 'jeudi'])."),
  preferredTime: z
    .string()
    .optional()
    .describe("Heure préférée de publication au format HH:mm (ex : '09:00')."),
});

server.tool(
  "run_agent_orchestration",
  "Lance une orchestration multi-agent complète pour piloter une campagne sociale. " +
    "L'orchestrateur mobilise plusieurs agents spécialisés (Stratège, Rédacteur, " +
    "Compliance, Scheduler, Benchmark) pour produire une timeline de contenu, " +
    "un rapport de conformité réglementaire et une analyse benchmark. " +
    "Autonomy 1 = suggestions uniquement, 2 = planification complète, 3 = exécution autonome.",
  {
    objective: z
      .string()
      .min(1)
      .describe(
        "Objectif libre de la campagne, ex : 'Lancer une campagne Tibok sur Instagram avec 50€/j pendant 2 semaines'."
      ),
    companyId: z
      .string()
      .min(1)
      .describe(
        "Identifiant de l'entreprise cible (obtenu via list_companies)."
      ),
    brandVoice: z
      .string()
      .optional()
      .describe(
        "Description du tone of voice de la marque, ex : 'Bienveillant, professionnel, proche des patients'."
      ),
    autonomy: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .describe(
        "Niveau d'autonomie : 1 = suggestions uniquement, 2 = planification complète, 3 = exécution autonome."
      ),
    profileId: z
      .string()
      .optional()
      .describe("Identifiant du profil professionnel à cibler (optionnel)."),
    cadence: CadenceSchema.optional().describe(
      "Cadence éditoriale souhaitée (optionnel)."
    ),
    benchmarkTarget: z
      .string()
      .optional()
      .describe(
        "Cible de benchmark libre, ex : 'Médecins en ligne leaders sur LinkedIn'."
      ),
  },
  async ({ objective, companyId, brandVoice, autonomy, profileId, cadence, benchmarkTarget }) => {
    try {
      const data = await apiPost("/api/agents/run", {
        objective,
        companyId,
        brandVoice,
        autonomy,
        profileId,
        cadence,
        benchmarkTarget,
      });

      return {
        content: [
          {
            type: "text",
            text:
              `Orchestration multi-agent lancée avec succès.\n` +
              `Objectif : ${objective}\n` +
              `Entreprise : ${companyId} | Autonomie : ${autonomy}\n\n` +
              `Résultat :\n${formatJson(data)}`,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: `Erreur — run_agent_orchestration : ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool : generate_post ─────────────────────────────────────────────────────

server.tool(
  "generate_post",
  "Génère ou améliore un post social media via l'IA de Social Hub. " +
    "Prend en compte les contraintes de la plateforme cible (longueur, hashtags, " +
    "ton) et les règles de conformité santé (ANSM, Meta Health Ads Policy). " +
    "Actions disponibles : 'generate' (créer), 'rewrite' (réécrire), " +
    "'shorten' (raccourcir), 'hashtags' (suggérer des hashtags).",
  {
    prompt: z
      .string()
      .min(1)
      .describe(
        "Brief ou texte source à traiter, ex : 'Mettre en avant la téléconsultation pour les actifs'."
      ),
    platform: z
      .enum(["facebook", "instagram", "linkedin"])
      .describe("Plateforme cible du post."),
    brandVoice: z
      .string()
      .optional()
      .describe(
        "Tone of voice de la marque (optionnel), ex : 'Bienveillant, médical, rassurant'."
      ),
    action: z
      .enum(["generate", "rewrite", "shorten", "hashtags"])
      .describe(
        "Action à effectuer : generate = créer un post, rewrite = réécrire, shorten = raccourcir, hashtags = suggérer des hashtags."
      ),
  },
  async ({ prompt, platform, brandVoice, action }) => {
    try {
      const data = await apiPost("/api/ai/generate-post", {
        prompt,
        platform,
        brandVoice: brandVoice ?? "",
        action,
      });

      const result = data as { text?: string; mock?: boolean; error?: string };

      if (result.error) {
        throw new Error(result.error);
      }

      const mockNote = result.mock ? "\n\n⚠️ Mode mock activé (pas de clé API Anthropic configurée)." : "";

      return {
        content: [
          {
            type: "text",
            text:
              `Post généré pour ${platform} (action : ${action}) :\n\n` +
              `${result.text ?? "(Aucun texte retourné)"}` +
              mockNote,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erreur — generate_post : ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool : check_compliance ──────────────────────────────────────────────────

server.tool(
  "check_compliance",
  "Vérifie la conformité réglementaire d'un texte de post social media " +
    "selon les règles santé française (ANSM), les politiques Meta Health Ads " +
    "et les standards LinkedIn. Retourne un verdict (pass / warn / block), " +
    "la liste des problèmes détectés et une suggestion de correction.",
  {
    text: z
      .string()
      .min(1)
      .describe("Texte du post à analyser pour la conformité."),
    platform: z
      .enum(["facebook", "instagram", "linkedin"])
      .describe("Plateforme cible (les règles varient légèrement selon la plateforme)."),
  },
  async ({ text, platform }) => {
    try {
      const data = await apiPost("/api/ai/compliance", { text, platform });
      const result = data as {
        verdict?: string;
        issues?: string[];
        suggestion?: string;
        mock?: boolean;
        error?: string;
      };

      if (result.error) {
        throw new Error(result.error);
      }

      const mockNote = result.mock
        ? "\n\n⚠️ Mode mock activé (pas de clé API Anthropic configurée) — résultat simulé."
        : "";

      const issuesList =
        result.issues && result.issues.length > 0
          ? `\nProblèmes détectés :\n${result.issues.map((i) => `  • ${i}`).join("\n")}`
          : "\nAucun problème détecté.";

      const suggestion = result.suggestion
        ? `\n\nSuggestion de correction :\n${result.suggestion}`
        : "";

      return {
        content: [
          {
            type: "text",
            text:
              `Analyse de conformité (${platform}) :\n` +
              `Verdict : ${(result.verdict ?? "inconnu").toUpperCase()}` +
              issuesList +
              suggestion +
              mockNote,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erreur — check_compliance : ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool : publish_post ──────────────────────────────────────────────────────

server.tool(
  "publish_post",
  "Publie un post sur un réseau social via le connecteur Social Hub. " +
    "Fonctionne en mode simulé si le connecteur n'est pas authentifié. " +
    "Vérifiez d'abord connector_status pour vous assurer que la plateforme est prête. " +
    "Recommandé : passez toujours check_compliance avant de publier.",
  {
    platform: z
      .enum(["facebook", "instagram", "linkedin"])
      .describe("Plateforme cible de la publication."),
    companyId: z
      .string()
      .min(1)
      .describe("Identifiant de l'entreprise (utilisé pour les logs d'audit)."),
    accountId: z
      .string()
      .optional()
      .describe(
        "Identifiant du compte social dans Social Hub (optionnel — " +
          "le connecteur récupère le token automatiquement si fourni)."
      ),
    text: z
      .string()
      .min(1)
      .describe("Texte du post à publier."),
    media: z
      .object({
        url: z.string().url().describe("URL publique de l'image ou de la vidéo."),
        caption: z.string().optional().describe("Légende du média (optionnel)."),
        mimeType: z
          .string()
          .optional()
          .describe("Type MIME du média, ex : 'image/jpeg' (optionnel)."),
      })
      .optional()
      .describe("Média à attacher au post (optionnel)."),
  },
  async ({ platform, companyId, accountId, text, media }) => {
    try {
      const data = await apiPost(`/api/connectors/${platform}/publish`, {
        companyId,
        accountId,
        text,
        media,
      });

      const result = data as {
        externalId?: string;
        url?: string;
        simulated?: boolean;
        error?: string;
      };

      if (result.error) {
        throw new Error(result.error);
      }

      const simulatedNote = result.simulated
        ? "\n\n⚠️ Publication simulée — le connecteur n'est pas authentifié en production."
        : "";

      return {
        content: [
          {
            type: "text",
            text:
              `Post publié avec succès sur ${platform}.\n` +
              `ID externe : ${result.externalId ?? "(non disponible)"}\n` +
              (result.url ? `URL : ${result.url}\n` : "") +
              simulatedNote,
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Erreur — publish_post : ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── Démarrage du transport stdio ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Toutes les traces de débogage vont sur stderr pour ne pas polluer stdout (stdio MCP).
  process.stderr.write(
    `[social-hub-mcp] Serveur démarré. API cible : ${BASE_URL}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[social-hub-mcp] Erreur fatale : ${err}\n`);
  process.exit(1);
});
