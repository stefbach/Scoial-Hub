// Vérifie le CLOISONNEMENT PAR SOCIÉTÉ des données publicitaires et de pilotage.
//
// Rapport de recette du 19/08, points #2, #3 et #4 : une société voyait les
// publicités d'une autre, la liste des comptes publicitaires montrait tout le
// portefeuille, et le centre de pilotage affichait « France » pour une société
// maltaise. Trois symptômes, une même cause : des données rattachées ou
// affichées sans preuve d'appartenance à la société active.
//
// Usage : npm run test:cloisonnement

import { readFileSync } from "node:fs";
import { pickAdAccountForCompany, type AdAccount } from "../lib/connectors/meta-pages";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const acct = (id: string, name: string, spent = 0, status = 1): AdAccount => ({
  id,
  name,
  currency: "EUR",
  status,
  amountSpent: spent,
});

function main() {
  // ── 1) Rattachement d'un compte publicitaire : sur preuve uniquement ──────
  {
    const portfolio = [
      acct("1", "TIBOK MU - Ads", 4_500_000),
      acct("2", "Obesity Care Clinic - Malta", 2_100_000),
      acct("3", "Rosiane Gebert Pillai", 90_000),
    ];

    // Le cœur du bug : une société sans compte à son nom était rattachée au
    // compte qui dépense le PLUS du portefeuille — celui d'une autre société.
    check(
      "compte pub · aucun nom correspondant → aucun rattachement automatique",
      pickAdAccountForCompany(portfolio, "German Auto Parts") === null
    );

    check(
      "compte pub · correspondance exacte retenue",
      pickAdAccountForCompany(portfolio, "TIBOK MU - Ads")?.id === "1"
    );
    check(
      "compte pub · correspondance partielle retenue",
      pickAdAccountForCompany(portfolio, "Obesity Care Clinic")?.id === "2"
    );

    // Un seul compte accessible : pas d'ambiguïté possible, on le retient.
    check(
      "compte pub · portefeuille à un seul compte → rattaché",
      pickAdAccountForCompany([acct("9", "Peu importe")], "German Auto Parts")?.id === "9"
    );

    // Le nom de SOCIÉTÉ prime sur celui de la Page Facebook.
    check(
      "compte pub · le nom de société prime sur le nom de Page",
      pickAdAccountForCompany(portfolio, ["Rosiane Gebert Pillai", "TIBOK MU - Ads"])?.id === "3"
    );
    check(
      "compte pub · repli sur le nom de Page si la société ne correspond pas",
      pickAdAccountForCompany(portfolio, ["German Auto Parts", "TIBOK MU - Ads"])?.id === "1"
    );

    // Aucun compte du tout : null, jamais une exception.
    check("compte pub · portefeuille vide → null", pickAdAccountForCompany([], "X") === null);
  }

  // ── 2) Liste des comptes : cloisonnée par défaut, ouverture explicite ─────
  {
    const src = readFileSync("components/ads/MetaAdAccountsPanel.tsx", "utf8");
    check(
      "panneau · liste filtrée sur le compte de la société active",
      /selected && !showAll\s*\?\s*resp\.accounts\.filter\(\(a\) => a\.id === selected\)/.test(src)
    );
    check(
      "panneau · ouverture au portefeuille complet possible et explicite",
      /setShowAll\(\(v\) => !v\)/.test(src) && /Afficher tous les comptes/.test(src)
    );
    check(
      "panneau · un compte déjà piloté par une autre société est signalé",
      /a\.boundTo/.test(src) && /Déjà piloté par/.test(src)
    );
  }

  // ── 3) API : le repère « déjà piloté » vient bien du serveur ──────────────
  {
    const route = readFileSync("app/api/meta/adaccounts/route.ts", "utf8");
    check(
      "api · comptes rattachés ailleurs renvoyés au client",
      /listAdAccountBindings/.test(route) && /boundTo: boundElsewhere\[a\.id\]/.test(route)
    );
  }

  // ── 4) Pilotage : la zone affichée est celle de la SOCIÉTÉ ────────────────
  {
    const src = readFileSync("app/(general)/pilotage/page.tsx", "utf8");
    check(
      "pilotage · le marché suit la zone de la société, pas le sélecteur global",
      /const market = companyZone;/.test(src) && !/const market = country\.label/.test(src)
    );
    check(
      "pilotage · plus de drapeau France sur une société étrangère",
      !/\{country\.flag\} \{market\}/.test(src) && /\{zoneFlag\} \{market\}/.test(src)
    );
    check(
      "pilotage · drapeau cohérent (pays unique) ou globe (zone multi-pays)",
      /zoneCountries\.length === 1 \? countryFlag\(zoneCountries\[0\]\) : "🌍"/.test(src)
    );
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
