// Vérifie deux garde-fous rendus réels :
//   1. Les ALERTES de pilotage, désormais calculées sur de vraies données de
//      réseaux (lib/pilotage-live.ts). Le silence éditorial et l'engagement
//      faible sont des signaux observables, pas un score composite.
//   2. Le plafond de SIÈGES par formule (lib/plans.ts, lib/quota/seats.ts),
//      annoncé sur la page tarifs et jusqu'ici sans aucun contrôle.
//
// Usage : npm run test:pilotage

import { alertsFromLiveKpis, type LiveNetworkKpis } from "../lib/pilotage-live";
import { PLAN_USERS, seatLimitForPlans } from "../lib/plans";
import { searchProvider, isSearchConfigured } from "../lib/reputation/search";
import { isNoiseHost } from "../lib/reputation/scan";

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function kpi(p: Partial<LiveNetworkKpis> & { network: LiveNetworkKpis["network"] }): LiveNetworkKpis {
  return {
    followers: 0, followersTrend: 0, engagementRate: 0, engagementTrend: 0,
    likes: 0, comments: 0, views: 0, reach: 0,
    measured: true, postsAnalysed: 0, ...p,
  };
}

const ids = (a: { id: string }[]) => a.map((x) => x.id);
const level = (a: { id: string; level: string }[], id: string) => a.find((x) => x.id === id)?.level;

function main() {
  // ── 1) Aucun réseau mesuré ────────────────────────────────────────────────
  console.log("\n— 1) Aucun réseau connecté —");
  {
    const a = alertsFromLiveKpis([kpi({ network: "facebook", measured: false })]);
    check("une seule alerte, informative", a.length === 1 && a[0].level === "info");
    check("elle invite à connecter un réseau", a[0].id === "no-network");
  }

  // ── 2) Silence éditorial ──────────────────────────────────────────────────
  console.log("\n— 2) Silence éditorial : le signal le plus actionnable —");
  {
    const recent = alertsFromLiveKpis([kpi({ network: "facebook", followers: 500, postsAnalysed: 5, engagementRate: 2, daysSinceLastPost: 2 })]);
    check("2 jours → aucune alerte de silence", !ids(recent).includes("silence-facebook"));

    const warn = alertsFromLiveKpis([kpi({ network: "facebook", followers: 500, postsAnalysed: 5, engagementRate: 2, daysSinceLastPost: 8 })]);
    check("8 jours → avertissement", level(warn, "silence-facebook") === "warning");

    const crit = alertsFromLiveKpis([kpi({ network: "facebook", followers: 500, postsAnalysed: 5, engagementRate: 2, daysSinceLastPost: 20 })]);
    check("20 jours → critique", level(crit, "silence-facebook") === "critical");

    const seuil = alertsFromLiveKpis([kpi({ network: "facebook", followers: 500, postsAnalysed: 5, engagementRate: 2, daysSinceLastPost: 7 })]);
    check("exactement 7 jours → avertissement (seuil inclus)", level(seuil, "silence-facebook") === "warning");

    const inconnu = alertsFromLiveKpis([kpi({ network: "facebook", followers: 500, postsAnalysed: 5, engagementRate: 2 })]);
    check("date inconnue → aucune alerte inventée", !ids(inconnu).includes("silence-facebook"));
  }

  // ── 3) Engagement faible ──────────────────────────────────────────────────
  console.log("\n— 3) Engagement : pas d'alerte sur une audience trop petite —");
  {
    const faible = alertsFromLiveKpis([kpi({ network: "instagram", followers: 5000, postsAnalysed: 10, engagementRate: 0.2, daysSinceLastPost: 1 })]);
    check("audience large + engagement bas → avertissement", level(faible, "engagement-instagram") === "warning");

    const petiteAudience = alertsFromLiveKpis([kpi({ network: "instagram", followers: 40, postsAnalysed: 10, engagementRate: 0.2, daysSinceLastPost: 1 })]);
    check("audience < 100 → aucune alerte (taux non significatif)",
      !ids(petiteAudience).includes("engagement-instagram"));

    const bon = alertsFromLiveKpis([kpi({ network: "instagram", followers: 5000, postsAnalysed: 10, engagementRate: 3.4, daysSinceLastPost: 1 })]);
    check("engagement correct → aucune alerte", !ids(bon).includes("engagement-instagram"));

    const sansPost = alertsFromLiveKpis([kpi({ network: "instagram", followers: 5000, postsAnalysed: 0, engagementRate: 0, daysSinceLastPost: 1 })]);
    check("aucune publication analysée → aucune alerte d'engagement",
      !ids(sansPost).includes("engagement-instagram"));
  }

  // ── 4) Audience non communiquée = permission manquante ────────────────────
  console.log("\n— 4) Distinguer « compte vide » et « permission manquante » —");
  {
    const a = alertsFromLiveKpis([kpi({ network: "facebook", followers: 0, postsAnalysed: 6, daysSinceLastPost: 1 })]);
    check("publications lues mais 0 abonné → alerte de permission",
      level(a, "followers-facebook") === "info");

    const vide = alertsFromLiveKpis([kpi({ network: "facebook", followers: 0, postsAnalysed: 0, daysSinceLastPost: 1 })]);
    check("aucune publication → pas d'alerte de permission", !ids(vide).includes("followers-facebook"));
  }

  // ── 5) Plusieurs réseaux ──────────────────────────────────────────────────
  console.log("\n— 5) Chaque réseau est évalué séparément —");
  {
    const a = alertsFromLiveKpis([
      kpi({ network: "facebook", followers: 900, postsAnalysed: 5, engagementRate: 2, daysSinceLastPost: 30 }),
      kpi({ network: "instagram", followers: 900, postsAnalysed: 5, engagementRate: 2, daysSinceLastPost: 1 }),
      kpi({ network: "linkedin", measured: false }),
    ]);
    check("Facebook silencieux signalé", level(a, "silence-facebook") === "critical");
    check("Instagram actif non signalé", !ids(a).includes("silence-instagram"));
    check("LinkedIn non mesuré → aucune alerte le concernant",
      !ids(a).some((id) => id.endsWith("linkedin")));
  }

  // ── 6) Plafond de sièges ──────────────────────────────────────────────────
  console.log("\n— 6) Sièges par formule —");
  check("Executive : 2 sièges", PLAN_USERS.executive === 2);
  check("Présence : 5 sièges", PLAN_USERS.presence === 5);
  check("Studio : illimité", PLAN_USERS.studio === Infinity);
  check("Agence : illimité", PLAN_USERS.agence === Infinity);

  check("le plafond retenu est le PLUS ÉLEVÉ des sociétés",
    seatLimitForPlans(["executive", "presence"]) === 5);
  check("une société Studio rend l'organisation illimitée",
    seatLimitForPlans(["executive", "studio"]) === Infinity);
  check("aucune société → plafond de la formule par défaut",
    seatLimitForPlans([]) === PLAN_USERS.presence);
  check("formule inconnue → traitée comme la formule par défaut",
    seatLimitForPlans(["inexistante"]) === PLAN_USERS.presence);

  // ── 7) Veille de réputation : dormante sans clé, filtrage du bruit ────────
  console.log("\n— 7) Veille de réputation —");
  {
    // Sans BRAVE_SEARCH_API_KEY ni SERPAPI_KEY, la veille ne doit RIEN appeler.
    check("aucune clé → fournisseur « none »", searchProvider() === "none");
    check("aucune clé → veille non configurée", !isSearchConfigured());

    // Le filtrage du bruit et la déduplication décident du coût comme de la
    // pertinence : une mention de sa propre page Facebook n'est pas une mention.
    check("un résultat facebook.com est écarté", isNoiseHost("facebook.com"));
    check("un sous-domaine m.facebook.com est écarté", isNoiseHost("m.facebook.com"));
    check("un site de presse est conservé", !isNoiseHost("lexpress.mu"));
    // Le piège que `endsWith` seul ne voit pas : ce domaine n'a aucun rapport
    // avec Facebook et doit être CONSERVÉ.
    check("« monfacebook.com » n'est pas Facebook et reste", !isNoiseHost("monfacebook.com"));
    check("« x.com » est écarté", isNoiseHost("x.com"));
    check("« lexpress.mu » ne ressemble pas à « x.com »", !isNoiseHost("lexpress.mu"));
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main();
