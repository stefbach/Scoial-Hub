import { test, expect, ROUTES, captureErrors, fatalErrors } from "./helpers";

// ── Crawler anti-crash ────────────────────────────────────────────────────────
// Visite chaque route et vérifie qu'aucune ne plante : pas de carte d'erreur
// (frontière React), pas d'erreur JS/React fatale (ex. le crash #310 des hooks).
for (const route of ROUTES) {
  test(`smoke: ${route} ne plante pas`, async ({ page }) => {
    const errors = captureErrors(page);

    const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(resp?.status() ?? 200, `${route} a renvoyé ${resp?.status()}`).toBeLessThan(400);

    // Laisse le client hydrater / les effets se déclencher.
    await page.waitForTimeout(1200);

    // La frontière d'erreur globale (app/error.tsx) ne doit JAMAIS s'afficher.
    await expect(
      page.getByText(/Something went wrong|Une erreur est survenue/i),
      `Frontière d'erreur affichée sur ${route}`
    ).toHaveCount(0);

    const fatal = fatalErrors(errors);
    expect(fatal, `Erreurs fatales sur ${route}:\n${fatal.join("\n")}`).toEqual([]);
  });
}
