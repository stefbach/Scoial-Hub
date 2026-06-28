import { test, expect } from "@playwright/test";

// ── Test de santé de base — page d'accueil ────────────────────────────────────
// Vérifie que la page d'accueil ("/") de l'application Next.js se charge
// correctement et SANS erreur :
//   1) réponse HTTP 2xx/3xx,
//   2) le document est rendu (pas une page blanche),
//   3) la frontière d'erreur globale React (app/error.tsx) ne s'affiche pas,
//   4) aucune erreur JS/console FATALE n'est émise pendant le chargement.
//
// "/" est une route PUBLIQUE (cf. middleware.ts) : aucun bypass d'authentification
// n'est nécessaire, ce test est donc volontairement autonome et minimal.

// Erreurs console/JS considérées comme bloquantes (mêmes critères que la suite e2e).
const FATAL =
  /Minified React error|Rendered (fewer|more) hooks|is not a function|Cannot read properties of (?:null|undefined)|Maximum update depth|Hydration failed|Text content does not match/i;

test("la page d'accueil se charge sans erreur", async ({ page }) => {
  // Capture des erreurs console + exceptions JS pendant le chargement.
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));

  // 1) Chargement de la page d'accueil — statut HTTP correct.
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(
    response?.status() ?? 200,
    `La page d'accueil a renvoyé ${response?.status()}`
  ).toBeLessThan(400);

  // 2) Le document est bien rendu (un <body> visible, pas une page blanche).
  await expect(page.locator("body")).toBeVisible();

  // Laisse le client s'hydrater / les effets se déclencher.
  await page.waitForTimeout(800);

  // 3) La frontière d'erreur globale ne doit JAMAIS s'afficher.
  await expect(
    page.getByText(/Something went wrong|Une erreur est survenue/i),
    "Une frontière d'erreur est affichée sur la page d'accueil"
  ).toHaveCount(0);

  // 4) Aucune erreur JS/console fatale.
  const fatal = errors.filter((e) => FATAL.test(e));
  expect(fatal, `Erreurs fatales sur la page d'accueil :\n${fatal.join("\n")}`).toEqual([]);
});
