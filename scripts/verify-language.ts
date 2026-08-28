// Vérifie que les textes PRODUITS PAR L'APPLICATION suivent la langue choisie.
//
// Rapport de recette du 18/08 : six points distincts (consultant, résumés
// d'onboarding, veille ×2, étape 5, pays) signalaient la même chose — du
// français affiché sur une interface en anglais. Les causes étaient multiples :
//   • analyse de veille de REPLI codée en dur en français ;
//   • brief stratégique généré sans langue ;
//   • libellés de profils métier et jours de la semaine non traduits ;
//   • libellés de pays repris d'une table française au lieu d'Intl.
//
// Usage : npm run test:langue

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/** Marqueurs typiquement français, absents d'un texte anglais correct. */
const FRENCH_MARKERS =
  /\b(le|la|les|des|une|aux|avec|pour|sur|dans|vos|votre|nos|notre|selon|taux|réseaux|contenus|marché|à préciser|semaine)\b|[éèêàçùôû]/i;

function assertEnglish(label: string, text: string) {
  const hit = text.match(FRENCH_MARKERS);
  check(label, !hit, hit ? `français détecté : « ${hit[0]} » dans « ${text.slice(0, 70)}… »` : undefined);
}

async function main() {
  // ── 1) Analyse de veille : le REPLI doit suivre la langue ──────────────────
  {
    const { analyzeCompetition } = await import("../lib/scraping/analyze");
    const query = { geo: "gb", keywords: ["car parts"], theme: "OEM quality", competitors: [] };

    const en = await analyzeCompetition(query, [], "en");
    assertEnglish("veille · résumé de repli", en.resume);
    assertEnglish("veille · formats gagnants", en.formatsGagnants.map((f) => `${f.type} ${f.description}`).join(" "));
    assertEnglish("veille · angles thématiques", en.anglesThematiques.map((a) => a.angle).join(" "));
    assertEnglish("veille · fréquence recommandée", en.frequenceRecommandee);
    assertEnglish("veille · recommandations", en.recommandations.map((r) => `${r.titre} ${r.detail} ${r.action}`).join(" "));

    // Sans contenu collecté, le résumé doit DIRE que rien n'a été collecté au
    // lieu d'affirmer un « fort engagement » inventé (cf. Royaume-Uni à zéro).
    check(
      "veille · zéro contenu → résumé honnête, pas de conclusion inventée",
      /no competitor content/i.test(en.resume) && !/strong engagement/i.test(en.resume),
      en.resume.slice(0, 90)
    );

    const fr = await analyzeCompetition(query, [], "fr");
    check("veille · le français reste le français", /Aucun contenu concurrent/i.test(fr.resume), fr.resume.slice(0, 60));
  }

  // ── 2) Profils métier : libellés et audiences traduits ────────────────────
  {
    const { PRO_PROFILES, profileLabel, profileAudience } = await import("../lib/agents/profiles");
    check("profils · catalogue non vide", PRO_PROFILES.length > 0, `${PRO_PROFILES.length}`);
    const missing = PRO_PROFILES.filter((p) => !p.labelEn || !p.typicalAudienceEn).map((p) => p.id);
    check("profils · tous traduits (libellé + audience)", missing.length === 0, missing.join(", "));

    for (const p of PRO_PROFILES) {
      assertEnglish(`profil « ${p.id} » · libellé`, profileLabel(p, true));
      assertEnglish(`profil « ${p.id} » · audience`, profileAudience(p, true));
    }
    const first = PRO_PROFILES[0];
    check("profils · le français reste disponible", profileLabel(first, false) === first.label);
  }

  // ── 3) Pays : libellés localisés, pas la table française ──────────────────
  {
    const { countryLabel } = await import("../lib/scope");
    check("pays · GB en anglais", countryLabel("gb", "en") === "United Kingdom", countryLabel("gb", "en"));
    check("pays · GB en français", countryLabel("gb", "fr") === "Royaume-Uni", countryLabel("gb", "fr"));
    check("pays · DE en anglais", countryLabel("de", "en") === "Germany", countryLabel("de", "en"));
  }

  // ── 4) Recherche YouTube : le pays n'est pas une langue ───────────────────
  {
    // `relevanceLanguage` n'accepte qu'un code ISO-639-1. Recevant « gb »
    // (code PAYS), YouTube ne renvoyait rien — d'où « zéro contenu » au R-U.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/scraping/collectors.ts", "utf8")
    );
    const derivedFromGeo = /relevanceLanguage["'],\s*query\.geo/.test(src);
    check(
      "veille · relevanceLanguage n'est plus dérivé du code pays",
      !derivedFromGeo,
      derivedFromGeo ? "query.geo encore utilisé comme langue" : undefined
    );
    check(
      "veille · relevanceLanguage validé comme code langue",
      /\/\^\[a-z\]\{2\}\$\/\.test\(relevance\)/.test(src)
    );
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Module (et non script global) : isole les déclarations de ce fichier.
export {};
