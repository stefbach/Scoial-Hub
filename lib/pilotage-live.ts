/**
 * lib/pilotage/real-kpis.ts
 *
 * Indicateurs de pilotage calculés sur les VRAIES données des réseaux connectés,
 * et alertes qui en découlent. Server-only (tokens de Page).
 *
 * Remplace les valeurs à zéro de `computeNetworkKpis` : jusqu'ici le Centre de
 * Pilotage et son cron 6 h tournaient sur des indicateurs vides, donc sans
 * jamais rien signaler.
 *
 * CE QUI EST CALCULÉ, ET CE QUI NE L'EST PAS
 * Followers, likes, commentaires, partages, taux d'engagement et date de la
 * dernière publication viennent de l'API Meta. Les TENDANCES (« +12 % vs période
 * précédente ») exigeraient un historique que nous ne stockons pas encore : elles
 * restent donc à zéro plutôt que d'être inventées. Une donnée fausse dans un
 * centre de pilotage est pire que pas de donnée.
 *
 * LinkedIn n'expose pas de statistiques de page sans l'approbation Community
 * Management : le réseau est renvoyé comme « non mesuré », pas comme « à zéro ».
 */

import { getMetaContext, fetchMetaInsights } from "@/lib/connectors/meta-pages";
import type { Network, NetworkKpis, PilotAlert } from "@/lib/pilotage";

/** Un réseau mesuré, avec la fraîcheur de sa dernière publication. */
export interface LiveNetworkKpis extends NetworkKpis {
  /** Faux si le réseau n'est pas connecté ou n'expose pas de statistiques. */
  measured: boolean;
  /** Jours écoulés depuis la dernière publication, si connue. */
  daysSinceLastPost?: number;
  /** Nombre de publications analysées. */
  postsAnalysed: number;
}

function emptyKpis(network: Network): LiveNetworkKpis {
  return {
    network,
    followers: 0,
    followersTrend: 0,
    engagementRate: 0,
    engagementTrend: 0,
    likes: 0,
    comments: 0,
    views: 0,
    reach: 0,
    measured: false,
    postsAnalysed: 0,
  };
}

/** Jours entiers écoulés depuis une date ISO, ou undefined si illisible. */
function daysSince(iso: string | undefined, now: Date): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/**
 * Taux d'engagement : interactions rapportées à l'audience, en pourcentage.
 * Rapporté au nombre de followers — la portée n'étant pas disponible par
 * publication sans permissions supplémentaires.
 */
function engagementRate(interactions: number, followers: number, posts: number): number {
  if (followers <= 0 || posts <= 0) return 0;
  return Number(((interactions / posts / followers) * 100).toFixed(2));
}

/**
 * Lit les indicateurs réels des réseaux connectés d'une société.
 * Ne throw jamais : un réseau injoignable est renvoyé « non mesuré ».
 */
export async function fetchLiveKpis(
  companyId: string,
  now: Date = new Date()
): Promise<LiveNetworkKpis[]> {
  const out: LiveNetworkKpis[] = [
    emptyKpis("facebook"),
    emptyKpis("instagram"),
    emptyKpis("linkedin"),
  ];

  try {
    const ctx = await getMetaContext(companyId);
    if (!ctx.pageToken) return out;

    const insights = await fetchMetaInsights(ctx);

    // ── Facebook ──────────────────────────────────────────────────────────
    if (insights.facebook) {
      const posts = insights.facebookPosts ?? [];
      const likes = posts.reduce((a, p) => a + (p.likes ?? 0), 0);
      const comments = posts.reduce((a, p) => a + (p.comments ?? 0), 0);
      const shares = posts.reduce((a, p) => a + (p.shares ?? 0), 0);
      const followers = insights.facebook.followers || insights.facebook.fanCount || 0;
      const dates = posts.map((p) => daysSince(p.createdAt, now)).filter((d): d is number => d !== undefined);

      out[0] = {
        ...out[0],
        measured: true,
        followers,
        likes,
        comments,
        // Portée et vues sont renvoyées par Meta au niveau du COMPTE sur 28 j,
        // pas par publication : on les rattache à Facebook, seul porteur de la
        // Page, plutôt que de les dupliquer sur chaque réseau.
        views: insights.views ?? 0,
        reach: insights.reach ?? 0,
        postsAnalysed: posts.length,
        engagementRate: engagementRate(likes + comments + shares, followers, posts.length),
        daysSinceLastPost: dates.length ? Math.min(...dates) : undefined,
      };
    }

    // ── Instagram ─────────────────────────────────────────────────────────
    if (insights.instagram) {
      const posts = insights.instagramPosts ?? [];
      const likes = posts.reduce((a, p) => a + (p.likes ?? 0), 0);
      const comments = posts.reduce((a, p) => a + (p.comments ?? 0), 0);
      const followers = insights.instagram.followers || 0;
      const dates = posts.map((p) => daysSince(p.createdAt, now)).filter((d): d is number => d !== undefined);

      out[1] = {
        ...out[1],
        measured: true,
        followers,
        likes,
        comments,
        postsAnalysed: posts.length,
        engagementRate: engagementRate(likes + comments, followers, posts.length),
        daysSinceLastPost: dates.length ? Math.min(...dates) : undefined,
      };
    }
  } catch (e) {
    console.error("[pilotage] lecture des indicateurs réels :", e instanceof Error ? e.message : e);
  }

  return out;
}

/* ── Alertes ─────────────────────────────────────────────────────────────── */

/** Silence au-delà duquel on alerte, en jours. */
const SILENCE_WARNING_DAYS = 7;
const SILENCE_CRITICAL_DAYS = 14;
/** Plancher de taux d'engagement (%) en dessous duquel on alerte. */
const ENGAGEMENT_FLOOR = 0.5;
/** Audience minimale à partir de laquelle le taux d'engagement fait sens. */
const MIN_FOLLOWERS_FOR_RATE = 100;

const NET_LABEL: Record<Network, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

/**
 * Alertes déduites des indicateurs réels. Chaque règle porte sur un signal
 * observable — pas de score composite dont personne ne saurait quoi faire.
 */
export function alertsFromLiveKpis(kpis: LiveNetworkKpis[]): PilotAlert[] {
  const alerts: PilotAlert[] = [];
  const measured = kpis.filter((k) => k.measured);

  if (measured.length === 0) {
    alerts.push({
      id: "no-network",
      level: "info",
      title: "Aucun réseau mesuré",
      detail:
        "Connectez votre Page Facebook ou votre compte Instagram professionnel dans Connecteurs pour suivre vos indicateurs.",
    });
    return alerts;
  }

  for (const k of measured) {
    const net = NET_LABEL[k.network];

    // Silence éditorial — le signal le plus actionnable.
    if (k.daysSinceLastPost !== undefined) {
      if (k.daysSinceLastPost >= SILENCE_CRITICAL_DAYS) {
        alerts.push({
          id: `silence-${k.network}`,
          level: "critical",
          title: `${net} : ${k.daysSinceLastPost} jours sans publication`,
          detail:
            "Une audience qui n'a plus de nouvelles se désengage vite. Générez un mois de contenu depuis trois mots-clés et programmez-le.",
        });
      } else if (k.daysSinceLastPost >= SILENCE_WARNING_DAYS) {
        alerts.push({
          id: `silence-${k.network}`,
          level: "warning",
          title: `${net} : ${k.daysSinceLastPost} jours sans publication`,
          detail: "Le rythme se creuse. Un calendrier validé une fois par mois suffit à le tenir.",
        });
      }
    }

    // Engagement faible — seulement au-delà d'une audience significative,
    // sinon le taux est trop instable pour vouloir dire quelque chose.
    if (
      k.followers >= MIN_FOLLOWERS_FOR_RATE &&
      k.postsAnalysed > 0 &&
      k.engagementRate < ENGAGEMENT_FLOOR
    ) {
      alerts.push({
        id: `engagement-${k.network}`,
        level: "warning",
        title: `${net} : engagement à ${k.engagementRate} %`,
        detail:
          "Vos publications touchent peu votre audience. Testez d'autres formats — la veille concurrentielle montre ce qui fonctionne sur votre marché.",
      });
    }

    // Audience non renseignée alors que le réseau est connecté : signe d'une
    // permission manquante plutôt que d'un compte vide.
    if (k.followers === 0 && k.postsAnalysed > 0) {
      alerts.push({
        id: `followers-${k.network}`,
        level: "info",
        title: `${net} : audience non communiquée`,
        detail:
          "Les publications sont lues mais le nombre d'abonnés ne l'est pas — il manque probablement une permission. Reconnectez le compte pour l'obtenir.",
      });
    }
  }

  return alerts;
}
