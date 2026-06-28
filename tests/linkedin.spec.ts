import { test, expect } from "../e2e/helpers";

// ── Parcours utilisateur — espace LinkedIn ────────────────────────────────────
// Vérifie que l'espace LinkedIn (studio article + planificateur) se charge sans
// crash et expose l'ajout de visuels au planificateur de série — la nouvelle
// fonctionnalité (accès bibliothèque pour rajouter un visuel à une publication
// programmée). /linkedin est protégée : la fixture e2e pose le cookie de bypass.

test("espace LinkedIn : studio chargé + visuel de série disponible au planificateur", async ({ page }) => {
  await page.goto("/linkedin", { waitUntil: "domcontentloaded" });

  // En-tête de la page.
  await expect(page.getByText(/Your LinkedIn space/i)).toBeVisible();

  // Aucune frontière d'erreur React.
  await expect(page.getByText(/Something went wrong|Une erreur est survenue/i)).toHaveCount(0);

  // Le studio article est présent (bouton « Generate article »).
  await expect(page.getByRole("button", { name: /Generate article/i })).toBeVisible({ timeout: 15_000 });

  // Le planificateur de série propose désormais un visuel (bibliothèque).
  await expect(page.getByText(/Series visual/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Pick a visual/i })).toBeVisible();

  // Nouveau : choix du type (posts courts / articles) et génération de visuel par élément.
  await expect(page.getByRole("button", { name: "Short posts", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Articles", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate visual/i }).first()).toBeVisible();
});
