import { test, expect } from "../e2e/helpers";

// ── Parcours utilisateur — espaces réseau dédiés (/reseau/[platform]) ─────────
// Vérifie qu'un espace dédié (façon « Espace LinkedIn ») se charge pour un
// réseau donné, avec l'état de connexion et le planificateur de série.

test("espace Facebook dédié : connexion + planificateur de série", async ({ page }) => {
  await page.goto("/reseau/facebook", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Facebook space/i).first()).toBeVisible();
  await expect(page.getByText(/Something went wrong|Une erreur est survenue/i)).toHaveCount(0);

  // Bouton de connexion présent.
  await expect(page.getByRole("button", { name: /^(Connect|Reconnect)$/ }).first()).toBeVisible();

  // Planificateur de série dédié (génération + tous les visuels).
  await expect(page.getByRole("button", { name: /Generate all visuals/i })).toBeVisible();
});

test("espace TikTok dédié : contrainte vidéo affichée", async ({ page }) => {
  await page.goto("/reseau/tiktok", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/TikTok space/i).first()).toBeVisible();
  await expect(page.getByText(/video required/i).first()).toBeVisible();
});
