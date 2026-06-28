import { test, expect } from "../e2e/helpers";

// ── Parcours utilisateur — hub « Comptes & connexions » ───────────────────────
// Valide la fonctionnalité centrale de cette branche : la page /accounts liste
// TOUS les réseaux (dont les nouveaux : Twitter/X, Pinterest, Threads, TikTok)
// et le bouton « Connecter » ouvre l'assistant guidé (aide pas-à-pas par réseau).
//
// /accounts est protégée : la fixture e2e (../e2e/helpers) pose le cookie de
// bypass + force la langue anglaise.

test("hub Comptes : les connecteurs s'affichent et l'aide guidée s'ouvre", async ({ page }) => {
  await page.goto("/accounts", { waitUntil: "domcontentloaded" });

  // En-tête de la page présent.
  await expect(page.getByText(/Accounts & connections/i)).toBeVisible();

  // Les cartes réseaux se chargent (statut récupéré) : un bouton « Connect » apparaît.
  const connect = page.getByRole("button", { name: "Connect", exact: true });
  await expect(connect.first()).toBeVisible({ timeout: 15_000 });

  // Tous les réseaux du hub sont rendus : un bouton « Connect » par réseau non
  // connecté. En mode démo aucun n'est connecté → on attend les 7 réseaux
  // (Facebook, Instagram, LinkedIn, Twitter/X, Pinterest, Threads, TikTok).
  await expect(connect).toHaveCount(7);

  // Parcours : ouvrir l'assistant guidé → le modal d'aide (réassurance) s'affiche.
  await connect.first().click();
  await expect(
    page.getByText(/Secure connection — no key or password to copy\./i)
  ).toBeVisible();
});
