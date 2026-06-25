// Diagnostic de bugs (one-shot, non commité au verrou) : parcourt les routes en
// anglais via le bypass de test et remonte : erreurs/avertissements console,
// erreurs JS, fuites de français en mode EN, images cassées, frontières d'erreur.
// Lancement : node + serveur local démarré, avec E2E_CHROMIUM_PATH + E2E_BYPASS_SECRET.

import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const SECRET = process.env.E2E_BYPASS_SECRET || "local-e2e-secret";

const ROUTES = [
  "/dashboard", "/campaigns", "/campaigns/new", "/ad-performance", "/audiences",
  "/analytics", "/compose", "/scheduled", "/media", "/library", "/agents",
  "/automations", "/inbox", "/benchmark", "/veille", "/pilotage", "/studio-affiche",
  "/studio-video", "/studio-avatar", "/telegram", "/mcp", "/accounts", "/settings",
  "/linkedin", "/publicites", "/identite", "/mon-equipe", "/mes-societes", "/history",
  "/connecteurs", "/parametres-connecteurs", "/pages-meta", "/simulateur", "/article-linkedin",
];

// Mots d'UI typiquement français qui ne devraient PAS apparaître en mode anglais.
const FRENCH = /\b(Param[èe]tres|Programm[ée]s?|Brouillon|Enregistrer|Annuler|Rechercher|Connectez|Chargement|R[ée]essayer|Aujourd'hui|Semaine|Publier|Modifier|Supprimer|T[ée]l[ée]charger|Suivant|Pr[ée]c[ée]dent|Fermer|Cr[ée]er une|Param[èe]tre|Tableau de bord|D[ée]connexion|R[ée]seaux|Activer|Lancer)\b/g;

function uniq(a: string[]) { return [...new Set(a)]; }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem("axon_lang", "en"); } catch {} });
  await ctx.addCookies([{ name: "e2e_bypass", value: SECRET, url: BASE }]);

  const report: Record<string, unknown>[] = [];

  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const consoleErr: string[] = [];
    const consoleWarn: string[] = [];
    const jsErr: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErr.push(m.text());
      else if (m.type() === "warning") consoleWarn.push(m.text());
    });
    page.on("pageerror", (e) => jsErr.push(String(e?.message ?? e)));

    let status = 0;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 20000 });
      status = resp?.status() ?? 0;
      await page.waitForTimeout(1500);
    } catch (e) { jsErr.push("goto failed: " + String(e)); }

    const boundary = await page.getByText(/Something went wrong|Une erreur est survenue/i).count().catch(() => 0);
    const frenchHits = await page.evaluate((src) => {
      const re = new RegExp(src, "g");
      const txt = (document.body?.innerText || "");
      return [...new Set((txt.match(re) || []))].slice(0, 12);
    }, FRENCH.source).catch(() => [] as string[]);
    const brokenImgs = await page.evaluate(() =>
      Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src).slice(0, 8)
    ).catch(() => [] as string[]);

    report.push({
      route, status,
      errorBoundary: boundary > 0,
      jsErr: uniq(jsErr).slice(0, 6),
      consoleErr: uniq(consoleErr).filter((e) => !/favicon|404|Failed to load resource/i.test(e)).slice(0, 6),
      french: frenchHits,
      brokenImgs,
      consoleWarnCount: consoleWarn.length,
    });
    await page.close();
  }

  await browser.close();

  // Sortie : seulement les routes avec quelque chose à signaler.
  let issues = 0;
  for (const r of report as any[]) {
    const has = r.errorBoundary || r.jsErr.length || r.consoleErr.length || r.french.length || r.brokenImgs.length || r.status >= 400;
    if (!has) continue;
    issues++;
    console.log(`\n### ${r.route}  [${r.status}]${r.errorBoundary ? "  ⛔ ERROR BOUNDARY" : ""}`);
    if (r.jsErr.length) console.log("  JS errors:", r.jsErr);
    if (r.consoleErr.length) console.log("  Console errors:", r.consoleErr);
    if (r.french.length) console.log("  FR-in-EN:", r.french);
    if (r.brokenImgs.length) console.log("  Broken images:", r.brokenImgs);
  }
  console.log(`\n==== ${issues}/${ROUTES.length} routes avec signalement ====`);
})();
