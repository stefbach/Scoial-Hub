// Vérifie le rafraîchissement automatique du token TikTok
// (lib/repositories/tiktok-connection.ts → getValidTikTokConnection).
//
// Root cause corrigée : `refresh_token` et `token_expires_at` étaient bien
// capturés à la connexion (callback OAuth) mais jamais utilisés ensuite —
// tout appelant (creator_info, publish, crons de statut/apprentissage)
// lisait `access_token` tel quel, qui finissait donc par expirer (~24h côté
// TikTok) et échouer en `access_token_invalid` — exactement l'erreur
// observée sur /compose → Réglages TikTok.
//
// Ce qui est vérifié :
//   1. Token non expiré → renvoyé tel quel, AUCUN appel réseau de refresh.
//   2. Token expiré + refresh_token présent + credentials configurés →
//      rafraîchi via /oauth/token/ (grant_type=refresh_token), PERSISTÉ, et
//      le nouveau token est bien celui renvoyé pour l'appel en cours.
//   3. Rafraîchissement refusé par TikTok (refresh_token expiré/révoqué) →
//      null (reconnexion nécessaire), pas de throw.
//   4. Token expiré mais AUCUN refresh_token connu (connexion ancienne) →
//      token existant renvoyé tel quel (comportement historique, pas de
//      régression), aucun appel réseau.
//   5. Pas de connexion / société non connectée → null.
//
// Usage : npx tsx scripts/verify-tiktok-token-refresh.ts

process.env.TIKTOK_CLIENT_KEY = "test_key";
process.env.TIKTOK_CLIENT_SECRET = "test_secret";

// Force la portée module (pas de import statique en tête de fichier sinon —
// tout est chargé dynamiquement après avoir posé les variables d'env
// ci-dessus) : évite une collision de `failures` avec un autre script global
// sous le même tsconfig (ex. verify-assets-gateway.ts).
export {};

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface Call {
  url: string;
  body: Record<string, unknown>;
}

function stubFetch(response: { access_token?: string; refresh_token?: string; expires_in?: number } | { error: string }, status = 200): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const raw = init?.body?.toString() ?? "";
    const body = Object.fromEntries(new URLSearchParams(raw));
    calls.push({ url, body });
    return new Response(JSON.stringify(response), { status });
  }) as typeof fetch;
  return calls;
}

function isoIn(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

async function main() {
  const {
    upsertTikTokConnection,
    getTikTokConnection,
    getValidTikTokConnection,
  } = await import("../lib/repositories/tiktok-connection");

  console.log("— 1) Token non expiré → aucun appel réseau —");
  {
    const calls = stubFetch({ error: "ne devrait jamais être appelé" });
    await upsertTikTokConnection("co-fresh", {
      accessToken: "fresh-token",
      refreshToken: "refresh-fresh",
      tokenExpiresAt: isoIn(60 * 60 * 1000), // +1h
    });
    const conn = await getValidTikTokConnection("co-fresh");
    check("token renvoyé tel quel", conn?.access_token === "fresh-token");
    check("aucun appel réseau émis", calls.length === 0, `${calls.length} appel(s)`);
  }

  console.log("\n— 2) Token expiré + refresh_token → rafraîchi et persisté —");
  {
    stubFetch({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 86400 });
    await upsertTikTokConnection("co-expired", {
      accessToken: "old-access",
      refreshToken: "refresh-old",
      tokenExpiresAt: isoIn(-60 * 1000), // expiré depuis 1 min
    });
    const conn = await getValidTikTokConnection("co-expired");
    check("nouveau token renvoyé pour l'appel en cours", conn?.access_token === "new-access");
    check("nouveau refresh_token retenu", conn?.refresh_token === "new-refresh");
    const persisted = await getTikTokConnection("co-expired");
    check("le nouveau token est PERSISTÉ (pas juste en mémoire)", persisted?.access_token === "new-access");
  }

  console.log("\n— 3) Rafraîchissement refusé par TikTok → null, pas de throw —");
  {
    stubFetch({ error: "invalid_grant" }, 400);
    await upsertTikTokConnection("co-revoked", {
      accessToken: "old-access",
      refreshToken: "refresh-revoked",
      tokenExpiresAt: isoIn(-60 * 1000),
    });
    let threw = false;
    let conn: Awaited<ReturnType<typeof getValidTikTokConnection>> = null;
    try {
      conn = await getValidTikTokConnection("co-revoked");
    } catch {
      threw = true;
    }
    check("ne lève pas d'exception", !threw);
    check("renvoie null (reconnexion nécessaire)", conn === null);
  }

  console.log("\n— 4) Token expiré SANS refresh_token connu → renvoyé tel quel —");
  {
    const calls = stubFetch({ error: "ne devrait jamais être appelé" });
    await upsertTikTokConnection("co-norefresh", {
      accessToken: "old-access-no-refresh",
      tokenExpiresAt: isoIn(-60 * 1000),
    });
    const conn = await getValidTikTokConnection("co-norefresh");
    check("token existant renvoyé (comportement historique)", conn?.access_token === "old-access-no-refresh");
    check("aucun appel réseau émis", calls.length === 0, `${calls.length} appel(s)`);
  }

  console.log("\n— 5) Société non connectée → null —");
  {
    const conn = await getValidTikTokConnection("co-unknown");
    check("null pour une société sans connexion", conn === null);
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
