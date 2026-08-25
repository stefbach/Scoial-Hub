// Recette du 25/08 — points restants après la première passe.
//
// Les points #2, #3, #5 et #6 sont couverts par le commit précédent ; ceux-ci
// verrouillent les six derniers.
//
// Usage : npm run test:r27

import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  // ── #1 · La durée annoncée correspond au traitement réel ──────────────────
  {
    const step5 = read("components/onboarding/Step5Agents.tsx");
    check("#1 · durée annoncée portée à 90 s", /environ 90 secondes/.test(step5) && !/environ 45 secondes/.test(step5));
  }

  // ── #4 et #12 · Thèmes proposés depuis l'identité de marque ───────────────
  {
    const { brandThemes } = await import("../components/brand/ThemeSuggestions");

    check("thèmes · profil absent → aucune suggestion inventée", brandThemes(null).length === 0);
    const themes = brandThemes({
      themes: ["Authenticité OEM", "authenticité oem"],
      competitorAngles: ["Garantie constructeur"],
      keywords: ["BMW", "Mercedes", "Authenticité OEM"],
    });
    check("thèmes · dédoublonnage insensible à la casse", themes.filter((x) => /authenticit/i.test(x)).length === 1, themes.join(" | "));
    check(
      "thèmes · thèmes éditoriaux d'abord, mots-clés en dernier",
      themes[0] === "Authenticité OEM" && themes[1] === "Garantie constructeur" && themes.includes("BMW"),
      themes.join(" | ")
    );
    check("thèmes · liste bornée", brandThemes({ keywords: Array.from({ length: 30 }, (_, i) => `k${i}`) }, 8).length === 8);

    const veille = read("app/(general)/veille/page.tsx");
    const series = read("components/series/SeriesPlanner.tsx");
    check("#4 · veille · suggestions branchées sur le champ thématique", /<ThemeSuggestions themes=\{brandThemeList\} value=\{theme\} onPick=\{setTheme\} \/>/.test(veille));
    check("#12 · séries · suggestions branchées sur le champ thème", /<ThemeSuggestions/.test(series) && /useBrandThemes\(companyId\)/.test(series));
    check("thèmes · la saisie libre reste possible", /onChange=\{\(e\) => \{ setTheme\(e\.target\.value\)/.test(series));
  }

  // ── #11 · L'absence de thème est signalée SOUS le champ ───────────────────
  {
    const series = read("components/series/SeriesPlanner.tsx");
    check("#11 · « Générer » sans thème marque le champ en erreur", /setThemeMissing\(true\)/.test(series));
    check("#11 · message affiché près du champ", /role="alert"/.test(series) && /Indiquez un thème ci-dessus/.test(series));
    check("#11 · l'erreur disparaît dès la saisie", /if \(e\.target\.value\.trim\(\)\) setThemeMissing\(false\)/.test(series));
  }

  // ── #7 · L'entretien du consultant reprend où il s'est arrêté ─────────────
  {
    const types = read("lib/onboarding/types.ts");
    const route = read("app/api/ai/consultant/route.ts");
    const ui = read("components/onboarding/BrandConsultant.tsx");
    check("#7 · le fil fait partie du profil persisté", /consultantThread\?: \{ role: "user" \| "assistant"; content: string \}\[\]/.test(types));
    check("#7 · le fil est enregistré à chaque tour", /consultantThread: thread/.test(route));
    check("#7 · fil borné pour ne pas gonfler indéfiniment", /\.slice\(-40\)/.test(route));
    check("#7 · le fil enregistré prime au rechargement", /const saved = Array\.isArray\(p\.consultantThread\)/.test(ui) && /setMessages\(saved\)/.test(ui));
  }

  // ── #8, #9, #10 · Brouillons et publications programmées ──────────────────
  {
    const scheduled = read("app/(organic)/scheduled/page.tsx");
    const modal = read("components/organic/ScheduledDetailModal.tsx");
    const compose = read("app/(organic)/compose/page.tsx");

    check("#8 · un brouillon ne saute plus directement dans l'éditeur", !/href=\{`\/compose\?draft=\$\{p\.id\}`\}/.test(scheduled));
    check("#8 · le brouillon ouvre l'aperçu commun", /onOpen=\{\(\) => setOpenPost\(p\)\}/.test(scheduled));
    check("#8 · l'aperçu mène à l'éditeur avec le bon paramètre", /post\.status === "draft" \? `\/compose\?draft=\$\{post\.id\}`/.test(modal));
    check("#9 · le préremplissage couvre brouillons ET programmées", /const resumeId = postId \?\? draftId;/.test(compose));
    check("#9 · la recherche côté API utilise cet identifiant", /rows\.find\(\(p\) => p\.id === resumeId\)/.test(compose));
    check("#10 · actions au survol disponibles sur toutes les lignes", /group-hover\/row:opacity-100/.test(scheduled));
    check("#10 · suppression câblée sur la ligne", /onDelete=\{\(\) => handleQuickDelete\(p\)\}/.test(scheduled));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
