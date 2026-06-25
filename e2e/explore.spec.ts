import { test, expect, captureErrors, fatalErrors } from "./helpers";

// ── Crawler EXPLORATOIRE ──────────────────────────────────────────────────────
// Va au-delà des routes statiques : sur chaque page, l'agent REMPLIT les champs
// et CLIQUE les boutons/onglets (bornés, non destructifs) en vérifiant qu'aucune
// action ne provoque de crash (frontière d'erreur ou erreur React/JS fatale).
// C'est l'approximation déterministe d'« un agent qui simule les actions humaines ».

// Libellés d'actions à NE JAMAIS déclencher : destructrices, dépensières,
// navigations hors page, ou ouvrant un sélecteur de fichiers OS.
const BLOCK =
  /supprimer|delete|remove|retirer|d[ée]connex|log\s?out|sign\s?out|publier|publish|activer|activate|lancer|launch|payer|\bpay\b|envoyer|\bsend\b|exporter|export|importer|import|upload|t[ée]l[ée]charger|download|r[ée]initialiser|reset|quitter|choisir|choose|parcourir|browse|fichier|\bfile\b|photo|\blogo\b|cloner|clone|enregistrer micro|record/i;

const PAGES = [
  "/campaigns/new",
  "/audiences",
  "/ad-performance",
  "/studio-affiche",
  "/studio-avatar",
  "/compose",
  "/settings",
  "/analytics",
];

for (const route of PAGES) {
  test(`explore: ${route} — interactions sans crash`, async ({ page }) => {
    const errors = captureErrors(page);
    // Filets de sécurité : on referme tout dialogue natif / sélecteur de fichiers.
    page.on("dialog", (d) => d.dismiss().catch(() => {}));
    page.on("filechooser", (fc) => fc.setFiles([]).catch(() => {}));

    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    const assertNoCrash = async (ctx: string) => {
      await expect(
        page.getByText(/Something went wrong|Une erreur est survenue/i),
        `Frontière d'erreur après ${ctx} sur ${route}`
      ).toHaveCount(0);
    };
    await assertNoCrash("chargement");

    // 1) Remplit les champs texte visibles (déclenche onChange / autosave / recherche).
    const inputs = page.locator('input[type="text"]:visible, input:not([type]):visible, input[type="search"]:visible, textarea:visible');
    const ic = Math.min(await inputs.count(), 8);
    for (let i = 0; i < ic; i++) {
      try {
        const el = inputs.nth(i);
        if (await el.isEditable()) await el.fill("Test E2E", { timeout: 2000 });
      } catch { /* champ non éditable / parti — on continue */ }
    }
    await page.waitForTimeout(300);
    await assertNoCrash("saisie des champs");

    // 2) Clique les boutons/onglets visibles non destructifs (bornés).
    const clickables = page.locator('button:visible, [role="tab"]:visible');
    const max = Math.min(await clickables.count(), 16);
    for (let i = 0; i < max; i++) {
      const el = clickables.nth(i);
      let label = "";
      try {
        label = ((await el.innerText({ timeout: 1000 }).catch(() => "")) || (await el.getAttribute("aria-label").catch(() => "")) || "").trim();
      } catch { continue; }
      if (BLOCK.test(label)) continue;

      try {
        await el.click({ timeout: 2500 });
      } catch { /* couvert / détaché / navigation — on continue */ }
      await page.waitForTimeout(150);
      await assertNoCrash(`clic « ${label.slice(0, 40)} »`);
      await page.keyboard.press("Escape").catch(() => {}); // referme une éventuelle modale

      // Si un clic a fait quitter la page, on revient pour continuer l'exploration.
      if (!page.url().includes(route)) {
        await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }

    const fatal = fatalErrors(errors);
    expect(fatal, `Erreurs fatales sur ${route}:\n${fatal.join("\n")}`).toEqual([]);
  });
}
