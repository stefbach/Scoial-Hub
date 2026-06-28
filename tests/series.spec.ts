import { test, expect } from "../e2e/helpers";

// ── Parcours utilisateur — Séries multi-réseaux (/series) ─────────────────────
// Vérifie que le planificateur de série générique se charge, expose le sélecteur
// de réseau et s'adapte aux contraintes (média requis pour Instagram, génération
// de tous les visuels). /series est protégée : la fixture e2e pose le bypass.

test("séries multi-réseaux : sélecteur + génération de visuels + adaptation Instagram", async ({ page }) => {
  await page.goto("/series", { waitUntil: "domcontentloaded" });

  // Titre + aucune frontière d'erreur.
  await expect(page.getByText(/Post series/i).first()).toBeVisible();
  await expect(page.getByText(/Something went wrong|Une erreur est survenue/i)).toHaveCount(0);

  // Sélecteur de réseau (les 5).
  for (const net of ["Facebook", "Instagram", "Twitter / X", "Pinterest", "TikTok"]) {
    await expect(page.getByRole("button", { name: net, exact: true })).toBeVisible();
  }

  // Génération en lot + bouton « tous les visuels » présents.
  await expect(page.getByRole("button", { name: /Generate all visuals/i })).toBeVisible();

  // Bascule sur Instagram → contrainte « image required » affichée.
  await page.getByRole("button", { name: "Instagram", exact: true }).click();
  await expect(page.getByText(/image required/i).first()).toBeVisible();
});
