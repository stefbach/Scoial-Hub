// Visibilité des publications programmées NATIVEMENT sur Facebook (Meta
// Business Suite) — retour client Rosiane #7, BUGS-SocialHub35.
// lib/connectors/meta.ts#listFacebookNativeScheduledPosts, edge Graph API
// `/{page-id}/scheduled_posts`.
//
// Aucun appel réseau : `fetch` est remplacé par un stub qui rejoue les
// réponses de Meta et enregistre les requêtes (même méthode que
// scripts/verify-stories-publish.ts).
//
// Usage : npm run test:fbnativeschedule

process.env.META_APP_SECRET = "test_app_secret";
process.env.META_APP_ID = "test_app_id";
process.env.META_API_VERSION = "v21.0";

// Force la portée module (pas de import statique en tête de fichier sinon —
// tout est chargé dynamiquement après avoir posé les variables d'env
// ci-dessus) : évite une collision de `failures` avec un autre script global
// sous le même tsconfig (ex. verify-assets-gateway.ts).
export {};

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface Call {
  url: string;
}

function stubFetch(respond: (call: Call) => unknown, status = 200): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    const call: Call = { url };
    calls.push(call);
    return new Response(JSON.stringify(respond(call) ?? {}), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

async function main() {
  const { listFacebookNativeScheduledPosts } = await import("../lib/connectors/meta");
  const { isConnectorAuthError } = await import("../lib/connectors/types");

  console.log("\n— 1) pageId/token manquant → liste vide, aucun appel réseau —");
  {
    const calls = stubFetch(() => ({}));
    const result = await listFacebookNativeScheduledPosts("", "");
    check("aucun appel réseau", calls.length === 0);
    check("liste vide", result.posts.length === 0);
  }

  console.log("\n— 2) Réponse Graph normale → postes triés par date, timestamp converti en ISO —");
  {
    const calls = stubFetch(() => ({
      data: [
        { id: "2", message: "Deuxième", scheduled_publish_time: 1_700_002_000 },
        { id: "1", message: "Premier", scheduled_publish_time: 1_700_000_000 },
      ],
    }));
    const result = await listFacebookNativeScheduledPosts("page-123", "page-token-abc");
    check("un seul appel Graph", calls.length === 1, `${calls.length} appel(s)`);
    check("cible bien /{page-id}/scheduled_posts", calls[0].url.includes("/page-123/scheduled_posts"), calls[0].url);
    check("access_token transmis en query", calls[0].url.includes("access_token=page-token-abc"), calls[0].url);
    check("2 publications renvoyées, triées par date croissante", result.posts.map((p) => p.id).join(",") === "1,2");
    check(
      "l'horodatage Unix est bien converti en ISO 8601",
      result.posts[0].scheduledPublishTime === new Date(1_700_000_000 * 1000).toISOString(),
      result.posts[0].scheduledPublishTime
    );
    check("aucune erreur", result.error === undefined);
  }

  console.log("\n— 3) Publication sans scheduled_publish_time → ignorée (pas de crash) —");
  {
    stubFetch(() => ({ data: [{ id: "3", message: "Sans date" }] }));
    const result = await listFacebookNativeScheduledPosts("page-123", "page-token-abc");
    check("filtrée hors de la liste", result.posts.length === 0);
  }

  console.log("\n— 4) Erreur Graph non-190 (Page non éligible, permission manquante…) → liste vide + détail, pas d'exception —");
  {
    stubFetch(() => ({ error: { code: 100, message: "Unsupported get request." } }));
    let threw = false;
    let result: Awaited<ReturnType<typeof listFacebookNativeScheduledPosts>> | undefined;
    try {
      result = await listFacebookNativeScheduledPosts("page-123", "page-token-abc");
    } catch {
      threw = true;
    }
    check("ne lève pas d'exception", !threw);
    check("liste vide", result?.posts.length === 0);
    check("détail de l'erreur transmis", Boolean(result?.error), result?.error);
  }

  console.log("\n— 5) Token rejeté (code 190) → ConnectorAuthError propagée (reconnexion requise) —");
  {
    stubFetch(() => ({ error: { code: 190, message: "Error validating access token." } }));
    let caught: unknown = null;
    try {
      await listFacebookNativeScheduledPosts("page-123", "page-token-abc");
    } catch (e) {
      caught = e;
    }
    check("propage bien une ConnectorAuthError (pas avalée)", isConnectorAuthError(caught), String(caught));
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
