/**
 * Analyse de l'identité de marque par IA (Claude).
 *
 * À partir du site web et des comptes sociaux fournis, produit un BrandProfile
 * complet utilisé tout au long du parcours de démarrage assisté (étapes 1-6).
 * En l'absence de clé Anthropic, retourne un profil de secours générique mais
 * cohérent, pour que l'UI reste fonctionnelle en tout état de cause.
 */

import { isAiConfigured, env } from "@/lib/env";
import {
  makeEmptyBrandProfile,
  type BrandHandles,
  type BrandProfile,
  type SocialNetwork,
  type SuggestedObjective,
} from "@/lib/onboarding/types";

/* ─────────────────────────────────────────────────────────────────────────────
   Récupération + nettoyage du contenu du site
───────────────────────────────────────────────────────────────────────────── */

/** Vérifie qu'une chaîne est une URL http(s) valide. */
function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Supprime les blocs <script> et <style> puis toutes les balises HTML. */
function stripHtml(html: string): string {
  // Suppression des blocs de script et de style (contenu inclus)
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  // Suppression de toutes les balises restantes
  text = text.replace(/<[^>]+>/g, " ");

  // Décodage des entités HTML les plus courantes
  text = text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");

  // Normalisation des espaces et des sauts de ligne
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Récupère le contenu textuel d'une URL avec un timeout de 10 secondes.
 * Toute erreur est silencieusement ignorée — renvoie une chaîne vide.
 */
async function fetchSiteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // User-agent neutre pour passer la plupart des guards robots
        "User-Agent": "Mozilla/5.0 (compatible; SocialHubBot/1.0)",
      },
    });

    if (!response.ok) return "";

    const html = await response.text();
    const plain = stripHtml(html);

    // On ne garde que les 6 000 premiers caractères pour maîtriser la taille du prompt
    return plain.slice(0, 6_000);
  } catch {
    // Timeout, réseau inaccessible, CORS, etc. — on dégrage gracieusement
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Réseaux valides
───────────────────────────────────────────────────────────────────────────── */

const VALID_NETWORKS: SocialNetwork[] = ["instagram", "facebook", "tiktok", "linkedin"];

function coerceNetworks(raw: unknown): SocialNetwork[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is SocialNetwork =>
    VALID_NETWORKS.includes(v as SocialNetwork)
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Fallback générique (IA non configurée ou erreur Claude)
───────────────────────────────────────────────────────────────────────────── */

function buildFallbackProfile(
  base: BrandProfile,
  companyName?: string
): BrandProfile {
  const name = companyName || "votre marque";
  const domain = base.website
    ? (() => {
        try {
          return new URL(base.website).hostname.replace(/^www\./, "");
        } catch {
          return base.website;
        }
      })()
    : null;

  // Résumé générique mais contextuel
  const summary = domain
    ? `${name} est une marque présente en ligne sur ${domain}. Elle propose une offre distinctive à destination de ses clients cibles. Son identité repose sur une communication claire et une proposition de valeur adaptée à son marché.`
    : `${name} est une marque qui construit sa présence digitale. Elle propose une offre distinctive à destination de ses clients cibles. Son identité repose sur une communication claire et une proposition de valeur adaptée à son marché.`;

  const suggestedObjectives: SuggestedObjective[] = [
    {
      id: "awareness",
      label: "Notoriété",
      why: `Faire connaître ${name} et ses offres auprès de nouvelles audiences ciblées.`,
    },
    {
      id: "leads",
      label: "Génération de leads",
      why: `Attirer des prospects qualifiés et alimenter le pipeline commercial de ${name}.`,
    },
    {
      id: "sales",
      label: "Ventes directes",
      why: `Convertir l'audience sociale de ${name} en clients actifs via des contenus orientés conversion.`,
    },
  ];

  return {
    ...base,
    summary,
    positioning: `${name} se positionne comme une solution de référence pour ses clients, avec une approche centrée sur la qualité et la satisfaction.`,
    tone: "Professionnel et accessible, avec une touche de proximité pour engager la communauté.",
    audience: "Particuliers et professionnels intéressés par les offres de la marque, actifs sur les réseaux sociaux.",
    themes: ["Actualités de la marque", "Conseils pratiques", "Témoignages clients", "Nouveautés produits", "Coulisses"],
    strengths: ["Présence multicanale", "Offre adaptée au marché", "Communication directe", "Proximité client"],
    keywords: [name, domain || "marque", "qualité", "service", "innovation", "client", "offre"],
    recommendedNetworks: ["instagram", "facebook"],
    competitorAngles: [
      "Mettre en avant le rapport qualité-prix face aux acteurs établis.",
      "Capitaliser sur la proximité et la réactivité là où les grands comptes sont moins agiles.",
      "Développer une communauté engagée pour fidéliser avant que les concurrents ne le fassent.",
    ],
    suggestedObjectives,
    aiGenerated: false,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Analyse via Claude
───────────────────────────────────────────────────────────────────────────── */

/** Construit le prompt envoyé à Claude pour l'analyse de marque. */
function buildPrompt(
  companyName: string | undefined,
  website: string,
  handles: BrandHandles,
  siteText: string,
  description: string,
  language: "fr" | "en" = "fr"
): string {
  const handlesSection = [
    handles.instagram ? `- Instagram : @${handles.instagram}` : null,
    handles.facebook ? `- Facebook : ${handles.facebook}` : null,
    handles.tiktok ? `- TikTok : @${handles.tiktok}` : null,
    handles.linkedin ? `- LinkedIn : ${handles.linkedin}` : null,
  ]
    .filter(Boolean)
    .join("\n") || "- Aucun compte renseigné";

  const siteSection = siteText
    ? `\nExtrait du site web (${website}) :\n---\n${siteText}\n---`
    : website
    ? `\n(Site ${website} inaccessible lors de l'analyse.)`
    : "\n(Aucun site web renseigné.)";

  const descriptionSection = description
    ? `\nDescriptif fourni par le client (PRIORITAIRE — c'est sa propre vision) :\n---\n${description}\n---`
    : "";

  return `Tu es un expert en stratégie de marque et marketing digital.
Analyse la marque ci-dessous et retourne UNIQUEMENT un objet JSON strict, sans aucun texte autour.

Marque : ${companyName || "Inconnue"}
Site web : ${website || "Non renseigné"}
Comptes sociaux :
${handlesSection}
${descriptionSection}
${siteSection}

Retourne STRICTEMENT ce JSON (aucun markdown, aucune explication) :
{
  "summary": "2-3 phrases décrivant qui est cette marque, sa mission et son positionnement général",
  "positioning": "En 1 phrase : sa promesse distincte face au marché",
  "tone": "Ton et style de communication observés ou recommandés (1 phrase)",
  "audience": "Description de la cible principale (1-2 phrases)",
  "themes": ["thème 1", "thème 2", "..."],
  "strengths": ["force 1", "force 2", "..."],
  "keywords": ["mot-clé 1", "mot-clé 2", "..."],
  "recommendedNetworks": ["instagram", "facebook", "tiktok", "linkedin"],
  "competitorAngles": ["angle 1", "angle 2", "..."],
  "suggestedObjectives": [
    { "id": "awareness|leads|sales|traffic|community|retention", "label": "Nom court", "why": "Pourquoi cet objectif est pertinent pour CETTE marque (1 phrase)" }
  ]
}

Règles :
- ${language === "en" ? "Write ALL textual values (summary, positioning, tone, audience, themes, strengths, labels, why…) in ENGLISH" : "Tout en français"}, concret et spécifique à cette marque (pas générique).
- themes : max 6 éléments.
- strengths : max 5 éléments.
- keywords : max 8 éléments, orientés veille concurrentielle.
- recommendedNetworks : uniquement parmi ["instagram","facebook","tiktok","linkedin"], les plus adaptés à cette marque.
- competitorAngles : max 5 angles à exploiter face aux concurrents directs.
- suggestedObjectives : max 4 objectifs ; id ∈ awareness|leads|sales|traffic|community|retention.`;
}

/** Parse et valide la réponse JSON de Claude en un BrandProfile partiel. */
function parseClaude(rawText: string): Partial<BrandProfile> | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Coercition et validation des champs
    const str = (v: unknown, fallback = ""): string =>
      typeof v === "string" ? v.trim() : fallback;

    const strArr = (v: unknown, max = 99): string[] => {
      if (!Array.isArray(v)) return [];
      return v.filter((x): x is string => typeof x === "string").slice(0, max);
    };

    // Validation des objectifs suggérés
    const VALID_OBJ_IDS = new Set(["awareness", "leads", "sales", "traffic", "community", "retention"]);
    const rawObjectives = Array.isArray(parsed.suggestedObjectives)
      ? parsed.suggestedObjectives
      : [];
    const suggestedObjectives: SuggestedObjective[] = rawObjectives
      .filter(
        (o): o is { id: string; label: string; why: string } =>
          o !== null &&
          typeof o === "object" &&
          typeof (o as Record<string, unknown>).id === "string" &&
          VALID_OBJ_IDS.has((o as Record<string, unknown>).id as string)
      )
      .slice(0, 4)
      .map((o) => ({
        id: String(o.id),
        label: str(o.label, String(o.id)),
        why: str(o.why),
      }));

    return {
      summary: str(parsed.summary),
      positioning: str(parsed.positioning),
      tone: str(parsed.tone),
      audience: str(parsed.audience),
      themes: strArr(parsed.themes, 6),
      strengths: strArr(parsed.strengths, 5),
      keywords: strArr(parsed.keywords, 8),
      recommendedNetworks: coerceNetworks(parsed.recommendedNetworks),
      competitorAngles: strArr(parsed.competitorAngles, 5),
      suggestedObjectives,
    };
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Point d'entrée principal
───────────────────────────────────────────────────────────────────────────── */

export async function analyzeBrand(input: {
  companyId: string;
  website?: string;
  handles?: BrandHandles;
  companyName?: string;
  description?: string;
  language?: "fr" | "en";
}): Promise<BrandProfile> {
  // 1. Construction du profil de base
  const profile = makeEmptyBrandProfile(input.companyId);
  profile.website = input.website ?? "";
  profile.handles = input.handles ?? {};
  profile.description = input.description ?? "";
  profile.analyzedAt = new Date().toISOString();

  // 2. Récupération du texte du site web (si URL http(s) valide)
  let siteText = "";
  if (profile.website && isHttpUrl(profile.website)) {
    siteText = await fetchSiteText(profile.website);
  }

  // 3. Si l'IA n'est pas configurée → fallback immédiat
  if (!isAiConfigured) {
    return buildFallbackProfile(profile, input.companyName);
  }

  // 4. Appel à Claude
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const prompt = buildPrompt(
      input.companyName,
      profile.website,
      profile.handles,
      siteText,
      profile.description,
      input.language === "en" ? "en" : "fr"
    );

    const message = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    // Extraction du texte brut retourné par Claude
    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const parsed = parseClaude(rawText);

    if (!parsed) throw new Error("Claude n'a pas retourné de JSON valide");

    // Fusion du profil de base avec les données IA
    return {
      ...profile,
      ...parsed,
      // On s'assure que les champs d'identité ne sont pas écrasés par des valeurs vides
      companyId: profile.companyId,
      website: profile.website,
      handles: profile.handles,
      analyzedAt: profile.analyzedAt,
      aiGenerated: true,
    };
  } catch (err) {
    // Claude inaccessible, JSON malformé, quota dépassé, etc.
    console.warn("[analyzeBrand] Claude failed, fallback:", err);
    return buildFallbackProfile(profile, input.companyName);
  }
}
