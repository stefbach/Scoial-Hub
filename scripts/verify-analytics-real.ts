// Test autonome (sans réseau ni credentials) des analytiques RÉELLES et du
// choix d'organisation à la création d'une société.
//
// Vérifie que :
//   - la monnaie est lue en unités MINEURES entières (aucun flottant) ;
//   - seules les vraies actions de conversion sont comptées ;
//   - la fenêtre quotidienne couvre exactement N jours et se termine aujourd'hui ;
//   - l'engagement Meta est imputé au JOUR DE PUBLICATION, réseau par réseau ;
//   - une publication hors fenêtre n'est pas comptée ;
//   - les dépenses et conversions du compte publicitaire tombent au bon jour ;
//   - une société sans Page connectée est « non connectée » plutôt que remplie
//     de zéros muets ;
//   - un cookie admin SANS orgId ne bloque plus la création d'une société.
//
// Lancement : npx tsx scripts/verify-analytics-real.ts

import { upsertConnection } from "../lib/repositories/channel-connections";
import {
  countConversions,
  dayKey,
  emptySeries,
  fetchCompanyAnalytics,
  parseMoneyToCents,
} from "../lib/analytics-live";
import { chooseOrgSource } from "../lib/auth/org-scope";
import { moneyFromCents } from "../lib/format";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {

// ── 1) Monnaie : unités mineures entières ────────────────────────────────────

console.log("\n— 1) Monnaie en unités mineures (jamais de flottant) —");
check("« 12.34 » → 1234 centimes", parseMoneyToCents("12.34") === 1234);
check("« 12,3 » → 1230 centimes (virgule décimale)", parseMoneyToCents("12,3") === 1230);
check("« 12 » → 1200 centimes", parseMoneyToCents("12") === 1200);
check("« 0.07 » → 7 centimes", parseMoneyToCents("0.07") === 7);
check("« -3.50 » → -350 centimes", parseMoneyToCents("-3.50") === -350);
check("valeur illisible → 0", parseMoneyToCents("n/a") === 0 && parseMoneyToCents(undefined) === 0);
// 0.1 + 0.2 en flottant vaut 0.30000000000000004 : la somme en centiemes doit
// rester exacte.
check(
  "somme de centimes exacte là où le flottant dérive",
  parseMoneyToCents("0.10") + parseMoneyToCents("0.20") === 30
);
check("formatage : 1234 centimes → « EUR 12.34 »", moneyFromCents(1234) === "EUR 12.34");
check("formatage : 7 centimes → « MUR 0.07 »", moneyFromCents(7, "MUR") === "MUR 0.07");
check("formatage : montant négatif", moneyFromCents(-350) === "-EUR 3.50");

// ── 2) Conversions : uniquement les actions qui en sont ──────────────────────

console.log("\n— 2) Conversions publicitaires —");
const ACTIONS = [
  { action_type: "lead", value: "3" },
  { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
  { action_type: "link_click", value: "150" },
  { action_type: "post_engagement", value: "400" },
  { action_type: "video_view", value: "900" },
];
check("leads + achats comptés, clics et vues exclus", countConversions(ACTIONS) === 5, `= ${countConversions(ACTIONS)}`);
check("actions absentes → 0", countConversions(undefined) === 0);
check("format inattendu → 0", countConversions({ nope: true }) === 0);

// ── 3) Fenêtre quotidienne ───────────────────────────────────────────────────

console.log("\n— 3) Fenêtre quotidienne —");
const NOW = new Date("2026-08-05T12:00:00Z");
const series = emptySeries(7, NOW);
check("7 jours renvoyés", series.length === 7, `${series.length}`);
check("le dernier jour est aujourd'hui", series[6].date === "2026-08-05", series[6].date);
check("le premier jour est J-6", series[0].date === "2026-07-30", series[0].date);
check("tous les compteurs démarrent à zéro", series.every((p) => p.engagement === 0 && p.adSpendCents === 0));
check("jour UTC extrait d'un horodatage Graph", dayKey("2026-08-03T14:22:00+0000") === "2026-08-03");
check("horodatage illisible → null", dayKey("pas une date") === null && dayKey("") === null);

// ── 4) Lecture Graph : imputation au bon jour ────────────────────────────────

console.log("\n— 4) Séries réelles à partir de Graph —");

const COMPANY = "analytics-co";
const requested: string[] = [];

function json(data: unknown) {
  return { json: async () => data } as Response;
}

function route(url: string): Response {
  requested.push(url);

  // Profils (abonnés)
  if (url.includes("/PAGE1?") && url.includes("followers_count")) {
    return json({ followers_count: 1200 });
  }
  if (url.includes("/IG1?") && url.includes("followers_count")) {
    return json({ followers_count: 800 });
  }

  // Publications Facebook de la fenêtre
  if (url.includes("PAGE1/posts")) {
    return json({
      data: [
        {
          id: "p1",
          created_time: "2026-08-04T09:00:00+0000",
          reactions: { summary: { total_count: 10 } },
          comments: { summary: { total_count: 4 } },
          shares: { count: 1 },
        },
        {
          // Hors fenêtre (bien avant les 7 jours demandés) : ne doit RIEN ajouter.
          id: "p-vieux",
          created_time: "2025-01-02T09:00:00+0000",
          reactions: { summary: { total_count: 999 } },
          comments: { summary: { total_count: 999 } },
        },
      ],
    });
  }

  // Médias Instagram de la fenêtre
  if (url.includes("IG1/media")) {
    return json({
      data: [
        { id: "m1", timestamp: "2026-08-04T18:00:00+0000", like_count: 20, comments_count: 5 },
        { id: "m2", timestamp: "2026-08-05T08:00:00+0000", like_count: 7, comments_count: 0 },
      ],
    });
  }

  // Portée / vues du compte sur 28 jours
  if (url.includes("PAGE1/insights")) {
    return json({
      data: [
        { name: "page_impressions_unique", values: [{ value: 3400 }] },
        { name: "page_impressions", values: [{ value: 5600 }] },
      ],
    });
  }

  // Dépenses publicitaires jour par jour
  if (url.includes("act_9911/insights")) {
    return json({
      data: [
        {
          date_start: "2026-08-04",
          spend: "12.34",
          account_currency: "MUR",
          actions: [
            { action_type: "lead", value: "2" },
            { action_type: "link_click", value: "88" },
          ],
        },
        { date_start: "2026-08-05", spend: "7.66", account_currency: "MUR", actions: [] },
      ],
    });
  }

  return json({ data: [] });
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => route(String(input))) as typeof fetch;

await upsertConnection(COMPANY, "facebook", {
  page_id: "PAGE1",
  page_access_token: "tok",
  user_access_token: "utok",
  account_name: "Ma Page",
});
await upsertConnection(COMPANY, "instagram", { ig_business_account_id: "IG1" });
await upsertConnection(COMPANY, "meta_ads", { ad_account_id: "9911", access_token: "atok" });

const result = await fetchCompanyAnalytics(COMPANY, 7, NOW);
const byDate = new Map(result.series.map((p) => [p.date, p]));
const d0804 = byDate.get("2026-08-04")!;
const d0805 = byDate.get("2026-08-05")!;

check("Page connectée → connected", result.connected);
check("compte publicitaire lu → adsMeasured", result.adsMeasured);
check("devise du compte publicitaire retenue", result.currency === "MUR", result.currency);
check("abonnés = Page + Instagram", result.followers === 2000, `${result.followers}`);
check("portée 28 j remontée", result.reach === 3400, `${result.reach}`);
check("vues 28 j remontées", result.views === 5600, `${result.views}`);

check(
  "engagement FB imputé au jour de publication (10+4+1)",
  d0804.engagementFacebook === 15,
  `${d0804.engagementFacebook}`
);
check("engagement IG du 4 août (20+5)", d0804.engagementInstagram === 25, `${d0804.engagementInstagram}`);
check("engagement total du 4 août", d0804.engagement === 40, `${d0804.engagement}`);
check("2 publications le 4 août", d0804.postsPublished === 2, `${d0804.postsPublished}`);
check("engagement IG du 5 août (7+0)", d0805.engagement === 7, `${d0805.engagement}`);

const windowTotal = result.series.reduce((s, p) => s + p.engagement, 0);
check(
  "la publication hors fenêtre n'est PAS comptée",
  windowTotal === 47,
  `total fenêtre = ${windowTotal} (attendu 47)`
);

check("dépense du 4 août en centimes", d0804.adSpendCents === 1234, `${d0804.adSpendCents}`);
check("dépense du 5 août en centimes", d0805.adSpendCents === 766, `${d0805.adSpendCents}`);
check(
  "total dépensé = MUR 20.00 sans dérive flottante",
  moneyFromCents(result.series.reduce((s, p) => s + p.adSpendCents, 0), result.currency) === "MUR 20.00"
);
check("conversions du 4 août (leads uniquement)", d0804.conversions === 2, `${d0804.conversions}`);
check("aucune conversion inventée le 5 août", d0805.conversions === 0);

check(
  "la fenêtre demandée à Graph est bornée (since/until)",
  requested.some((u) => u.includes("PAGE1/posts") && u.includes("since=") && u.includes("until=")),
  requested.find((u) => u.includes("PAGE1/posts"))?.slice(0, 120) ?? "aucun appel"
);
check(
  "les dépenses sont demandées jour par jour (time_increment=1)",
  requested.some((u) => u.includes("act_9911/insights") && u.includes("time_increment=1"))
);

// ── 5) Société sans réseau connecté ──────────────────────────────────────────

console.log("\n— 5) Société sans Page connectée —");
const bare = await fetchCompanyAnalytics("societe-sans-reseau", 7, NOW);
check("non connectée → connected = false", bare.connected === false);
check("dépenses non mesurées → adsMeasured = false", bare.adsMeasured === false);
check("la fenêtre existe quand même (7 jours à zéro)", bare.series.length === 7);
check("aucune donnée inventée", bare.series.every((p) => p.engagement === 0 && p.postsPublished === 0));

globalThis.fetch = realFetch;

// ── 6) Création de société : origine de l'organisation ───────────────────────

console.log("\n— 6) Création de société : origine de l'organisation —");
check("admin AVEC orgId → organisation du corps (dépannage)", chooseOrgSource(true, "org-42") === "body");
check(
  "admin SANS orgId → organisation de la session (plus de « orgId requis »)",
  chooseOrgSource(true, undefined) === "session"
);
check("admin avec orgId vide → organisation de la session", chooseOrgSource(true, "   ") === "session");
check("client : l'orgId du corps est ignoré", chooseOrgSource(false, "org-piraté") === "session");
check("client sans orgId → organisation de la session", chooseOrgSource(false, undefined) === "session");

console.log(failed === 0 ? "\n✅ Tous les tests passent." : `\n❌ ${failed} test(s) en échec.`);
process.exit(failed === 0 ? 0 : 1);

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
