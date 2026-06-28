import { defineConfig, devices } from "@playwright/test";

// Config Playwright — pilote un vrai navigateur pour « verrouiller » les tests.
// • En local (cet environnement), Chromium est préinstallé : on pointe dessus via
//   E2E_CHROMIUM_PATH (=/opt/pw-browsers/chromium) pour éviter tout téléchargement.
// • En CI/preview, on installe Chromium normalement (npx playwright install).
// La base d'URL : E2E_BASE_URL (ex. l'URL du preview Vercel), sinon le serveur local.
const chromiumPath = process.env.E2E_CHROMIUM_PATH;

export default defineConfig({
  // Couvre la suite e2e existante ET le dossier tests/ (tests de santé).
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "tests/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}) } },
  ],
  // En local sans E2E_BASE_URL, démarre l'app automatiquement (prod build).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://127.0.0.1:3000",
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: { E2E_BYPASS_SECRET: process.env.E2E_BYPASS_SECRET || "local-e2e-secret" },
      },
});
