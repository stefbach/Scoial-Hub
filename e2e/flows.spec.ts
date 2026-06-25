import { test, expect, captureErrors, fatalErrors } from "./helpers";

// ── Parcours clés (comme un humain) ───────────────────────────────────────────

// Ouvrir une audience enregistrée NE DOIT PAS planter (régression du crash #310 :
// un hook appelé après un return anticipé dans AudienceDetailModal).
test("audiences : ouvrir une fiche audience n'affiche pas d'erreur", async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto("/audiences", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const card = page.locator(".card.cursor-pointer").first();
  if ((await card.count()) === 0) test.skip(true, "Aucune audience à ouvrir dans cet environnement.");
  await card.click();
  await page.waitForTimeout(600);

  await expect(page.getByText(/Something went wrong|Une erreur est survenue/i)).toHaveCount(0);
  // La fiche audience (modale) s'ouvre — on la distingue du tiroir d'aide
  // (celui-ci porte un aria-label « Help: … », pas la modale).
  const modal = page.locator('[role="dialog"]:not([aria-label])');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(/Configuration|Gender|Genre|Reach|Portée/i);
  expect(fatalErrors(errors), fatalErrors(errors).join("\n")).toEqual([]);
});

// Le brouillon de campagne est sauvegardé automatiquement et restauré (#10).
test("campaigns/new : le brouillon est restauré après rechargement", async ({ page }) => {
  await page.goto("/campaigns/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1300); // l'autosave écrit le brouillon (debounce 600 ms)

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Draft restored|Brouillon restauré/i)).toBeVisible();
});

// L'heure de début par défaut est pré-remplie et n'est pas dans le passé (#4).
test("campaigns/new : l'heure de début par défaut est définie", async ({ page }) => {
  await page.goto("/campaigns/new", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /Advanced settings|Réglages avancés/i }).click();
  const start = page.locator('input[type="datetime-local"]').first();
  await expect(start).toBeVisible();
  const value = await start.inputValue();
  expect(value, "L'heure de début devrait être pré-remplie").not.toEqual("");
});

// ── i18n : en mode anglais, l'UI statique ne reste pas en français ─────────────
test("i18n : /campaigns/new s'affiche en anglais", async ({ page }) => {
  await page.goto("/campaigns/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Create a Meta ad/i)).toBeVisible();
  await expect(page.getByText("Créer une publicité Meta", { exact: true })).toHaveCount(0);
});
