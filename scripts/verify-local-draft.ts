// Autosave local des brouillons de série (retour client Rosiane #2, espaces
// Facebook/Instagram/LinkedIn/TikTok) — lib/hooks/useLocalDraft.ts.
//
// Usage : npm run test:localdraft

import { loadLocalDraft, clearLocalDraft } from "../lib/hooks/useLocalDraft";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// Stub minimal de localStorage (Node n'en a pas nativement).
class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}
(globalThis as { window?: unknown }).window = { localStorage: new FakeStorage() };

console.log("\n— loadLocalDraft / clearLocalDraft —");

// Clé absente → null, pas d'exception.
check("clé absente → null", loadLocalDraft("sh:missing") === null);

// Écriture puis lecture → round-trip fidèle.
{
  const snap = { theme: "lancement produit", drafts: [{ body: "Post 1" }] };
  (window as unknown as { localStorage: FakeStorage }).localStorage.setItem(
    "sh:series-draft:acme:facebook",
    JSON.stringify(snap)
  );
  const loaded = loadLocalDraft<typeof snap>("sh:series-draft:acme:facebook");
  check("round-trip JSON fidèle", JSON.stringify(loaded) === JSON.stringify(snap));
}

// JSON corrompu → null (jamais d'exception qui casserait le rendu).
{
  (window as unknown as { localStorage: FakeStorage }).localStorage.setItem("sh:corrupt", "{not json");
  check("JSON corrompu → null (pas d'exception)", loadLocalDraft("sh:corrupt") === null);
}

// clearLocalDraft retire bien la clé.
{
  const key = "sh:series-draft:acme:instagram";
  (window as unknown as { localStorage: FakeStorage }).localStorage.setItem(key, JSON.stringify({ a: 1 }));
  clearLocalDraft(key);
  check("clearLocalDraft supprime la clé", loadLocalDraft(key) === null);
}

// localStorage indisponible (ex. navigation privée qui le fait throw) →
// aucune exception ne doit remonter.
{
  const throwing = {
    getItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  (globalThis as { window?: unknown }).window = { localStorage: throwing };
  let threw = false;
  try {
    loadLocalDraft("sh:whatever");
    clearLocalDraft("sh:whatever");
  } catch {
    threw = true;
  }
  check("localStorage indisponible → aucune exception", !threw);
}

console.log(failed === 0 ? "\n✓ Tous les tests sont passés.\n" : `\n✗ ${failed} test(s) en échec.\n`);
if (failed > 0) process.exit(1);
