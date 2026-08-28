// Passerelle d'assets — mission bibliothèque, Lot A-1.
//
// Ces contrôles portent sur le CONTRAT de la passerelle, pas sur les
// fournisseurs réels (aucune vraie clé n'est configurée dans cet
// environnement) : normalisation, cache mutualisé, dégradation par
// fournisseur, aucun fournisseur en échec n'empêche les autres de répondre,
// aucune clé ne fuit dans une réponse.
//
// AUCUN IMPORT STATIQUE de lib/env.ts (ni de rien qui en dépend) dans ce
// fichier : ses flags isXxxConfigured sont des `const` calculées UNE SEULE
// FOIS à la première évaluation du module. process.env.PEXELS_API_KEY et
// PIXABAY_API_KEY sont donc positionnées ici, tout en haut, avant le premier
// `await import(...)` — Coverr et Unsplash restent volontairement SANS clé
// pour toute la durée du script : c'est ce qui permet de tester la
// dégradation par fournisseur sans relancer un second processus.
//
// Usage : npm run test:assetsgateway

process.env.PEXELS_API_KEY = "test-pexels-key";
process.env.PIXABAY_API_KEY = "test-pixabay-key";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function mockFetch(handler: (url: string) => { status: number; body: unknown }) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const result = handler(url);
    return new Response(JSON.stringify(result.body), { status: result.status });
  }) as typeof fetch;
}

async function main() {
  const { searchAssets, configuredProviders } = await import("../lib/assets/gateway");
  const { clearCacheForTests } = await import("../lib/assets/cache");
  const { PROVIDER_POLICY } = await import("../lib/assets/types");

  check("les fournisseurs sans clé restent masqués, ceux configurés apparaissent",
    configuredProviders().sort().join(",") === "pexels,pixabay",
    configuredProviders().join(","));

  // ── Fournisseurs sans clé : dégradation propre, aucun appel, aucune erreur ──
  {
    let calls = 0;
    mockFetch(() => { calls += 1; return { status: 200, body: {} }; });
    clearCacheForTests();
    const results = await searchAssets({ query: "musique ambiance", kinds: ["audio"] });
    check("un type couvert seulement par des fournisseurs non configurés renvoie [], sans exception",
      Array.isArray(results) && results.length === 0);
    check("aucun appel réseau n'est fait pour un fournisseur sans clé", calls === 0, String(calls));
  }

  // ── Normalisation : Pexels répond, le format est celui attendu ───────────
  {
    mockFetch((url) => {
      if (url.startsWith("https://api.pexels.com/v1/search")) {
        return {
          status: 200,
          body: {
            photos: [{
              id: 42, width: 1920, height: 1080,
              photographer: "Ada Lovelace", photographer_url: "https://pexels.com/@ada",
              src: { large: "https://images.pexels.com/42-large.jpg", medium: "https://images.pexels.com/42-medium.jpg", original: "https://images.pexels.com/42.jpg" },
            }],
          },
        };
      }
      if (url.startsWith("https://pixabay.com/api/?")) return { status: 200, body: { hits: [] } };
      return { status: 200, body: {} };
    });
    clearCacheForTests();

    const results = await searchAssets({ query: "plage", kinds: ["image"] });
    check("une recherche renvoie des résultats normalisés d'au moins un fournisseur", results.length === 1, JSON.stringify(results));
    const r = results[0];
    check("le fournisseur est identifié", r?.provider === "pexels");
    check("l'identifiant chez le fournisseur est conservé", r?.providerId === "42");
    check("la licence n'est jamais vide", Boolean(r?.license));
    check("l'attribution Pexels est marquée requise", r?.attributionRequired === true);
    check("l'auteur est renseigné", r?.author === "Ada Lovelace");
    check("aucune clé n'apparaît dans le résultat", !JSON.stringify(r).includes("test-pexels-key"));
  }

  // ── Cache mutualisé : la même recherche ne déclenche aucun second appel ──
  {
    let calls = 0;
    mockFetch((url) => {
      calls += 1;
      if (url.startsWith("https://api.pexels.com/v1/search")) {
        return { status: 200, body: { photos: [{ id: 1, width: 10, height: 10, photographer: "x", photographer_url: "x", src: { large: "l", medium: "m", original: "o" } }] } };
      }
      return { status: 200, body: { hits: [] } };
    });
    clearCacheForTests();

    await searchAssets({ query: "montagne", kinds: ["image"] });
    const callsAfterFirst = calls;
    await searchAssets({ query: "montagne", kinds: ["image"] });
    check("la même recherche répétée ne déclenche aucun second appel externe", calls === callsAfterFirst, `${callsAfterFirst} puis ${calls}`);

    await searchAssets({ query: "montagne", kinds: ["video"] });
    check("une recherche de type différent n'est pas confondue avec le cache", calls > callsAfterFirst);
  }

  // ── Dégradation par fournisseur : un échec n'empêche pas les autres ──────
  {
    mockFetch((url) => {
      if (url.startsWith("https://api.pexels.com")) throw new Error("Pexels indisponible");
      if (url.startsWith("https://pixabay.com/api/?")) {
        return { status: 200, body: { hits: [{ id: 7, webformatURL: "w", largeImageURL: "l", imageWidth: 100, imageHeight: 100 }] } };
      }
      return { status: 200, body: {} };
    });
    clearCacheForTests();

    const results = await searchAssets({ query: "forêt", kinds: ["image"] });
    check("un fournisseur en échec (exception) n'empêche pas les autres de répondre",
      results.some((r) => r.provider === "pixabay"), JSON.stringify(results));
  }

  // ── Politique par fournisseur : aucune valeur par défaut implicite ───────
  check("Pixabay impose le rehébergement (lien direct interdit)", PROVIDER_POLICY.pixabay.rehost === true);
  check("Unsplash impose le suivi de téléchargement", PROVIDER_POLICY.unsplash.track === true);
  check("Coverr n'exige pas d'attribution", PROVIDER_POLICY.coverr.attributionRequired === false);
  check("Pexels exige une attribution", PROVIDER_POLICY.pexels.attributionRequired === true);

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
