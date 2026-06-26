import { test as base, expect, type ConsoleMessage } from "@playwright/test";

// Secret du bypass de test (doit matcher E2E_BYPASS_SECRET côté serveur).
const SECRET = process.env.E2E_BYPASS_SECRET || "local-e2e-secret";

// Fixture commune : (1) langue = anglais (pour traquer le français résiduel),
// (2) cookie de bypass pour accéder aux pages protégées sans vraie session.
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await context.addInitScript(() => {
      try { localStorage.setItem("axon_lang", "en"); } catch { /* ignore */ }
    });
    if (baseURL) {
      await context.addCookies([{ name: "e2e_bypass", value: SECRET, url: baseURL }]);
    }
    await use(context);
  },
});

export { expect };

// Routes applicatives à parcourir (anti-crash + structure).
export const ROUTES = [
  "/dashboard",
  "/campaigns",
  "/campaigns/new",
  "/ad-performance",
  "/audiences",
  "/analytics",
  "/compose",
  "/scheduled",
  "/media",
  "/library",
  "/agents",
  "/automations",
  "/inbox",
  "/benchmark",
  "/veille",
  "/pilotage",
  "/studio-affiche",
  "/studio-video",
  "/studio-avatar",
  "/telegram",
  "/mcp",
  "/accounts",
  "/settings",
  "/linkedin",
  "/publicites",
];

// Erreurs console/JS considérées comme FATALES (à faire échouer).
const FATAL = /Minified React error|Rendered (fewer|more) hooks|is not a function|Cannot read properties of (?:null|undefined)|Maximum update depth|Hydration failed|Text content does not match/i;

/** Branche la capture des erreurs console + JS d'une page ; renvoie le tableau. */
export function captureErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (m: ConsoleMessage) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
  return errors;
}

export function fatalErrors(errors: string[]): string[] {
  return errors.filter((e) => FATAL.test(e));
}
