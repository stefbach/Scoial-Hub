// Vérifie l'alerte Telegram sur échec DÉFINITIF de publication programmée
// (lib/telegram/notify.ts, câblé dans app/api/cron/publish-due/route.ts).
//
// Root cause corrigée : un post qui passait en `failed` (fenêtre de réessai
// dépassée ou erreur permanente) le devenait SILENCIEUSEMENT — rien ne
// prévenait l'utilisateur, qui ne le découvrait qu'en consultant l'écran
// Programmé. Cas réel signalé (compte-rendu Rosiane) : une image supprimée
// avant l'heure prévue a fait échouer une publication Facebook sans aucune
// notification, l'app se contentant de retenter en silence.
//
// Ce qui est vérifié :
//   1. Sans bot Telegram configuré → aucun appel réseau, ne lève jamais.
//   2. Bot configuré mais société sans chat lié → aucun appel réseau.
//   3. Société avec plusieurs chats liés → un message envoyé à CHACUN.
//   4. Un chat_id vide/blanc dans la liste (ex. "123,,456") est ignoré.
//   5. Une panne de l'API Telegram ne remonte jamais à l'appelant (best-effort).
//
// Usage : npx tsx scripts/verify-publish-failure-alert.ts

process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";

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
  chatId: string;
  text: string;
}

/** Intercepte les appels à l'API Bot Telegram (fetch natif) — aucun appel réseau réel. */
function stubTelegramFetch(fail = false): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (!url.includes("api.telegram.org")) {
      throw new Error(`fetch inattendu hors Telegram : ${url}`);
    }
    if (fail) throw new Error("panne réseau simulée");
    const body = init?.body ? (JSON.parse(init.body as string) as { chat_id?: string | number; text?: string }) : {};
    calls.push({ chatId: String(body.chat_id), text: String(body.text ?? "") });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
  }) as typeof fetch;
  return calls;
}

async function main() {
  const { notifyCompanyTelegram } = await import("../lib/telegram/notify");
  const { upsertConnection } = await import("../lib/repositories/channel-connections");

  console.log("— 1) Sans bot configuré → rien —");
  {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const calls = stubTelegramFetch();
    let threw = false;
    try {
      await notifyCompanyTelegram("co-1", "test");
    } catch {
      threw = true;
    }
    check("aucun appel réseau", calls.length === 0);
    check("ne lève pas d'exception", !threw);
  }

  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";

  console.log("\n— 2) Bot configuré, société sans chat lié → rien —");
  {
    const calls = stubTelegramFetch();
    await notifyCompanyTelegram("co-unlinked", "test");
    check("aucun appel réseau", calls.length === 0);
  }

  console.log("\n— 3) Plusieurs chats liés → un message à chacun —");
  {
    await upsertConnection("co-multi", "telegram", { linked_chat_ids: "111,222,333" }, "connected");
    const calls = stubTelegramFetch();
    await notifyCompanyTelegram("co-multi", "⚠️ Échec de publication");
    check("3 messages envoyés (un par chat)", calls.length === 3, `${calls.length} appel(s)`);
    check("les 3 chat_id attendus ont reçu le message",
      ["111", "222", "333"].every((id) => calls.some((c) => c.chatId === id)));
    check("le texte transmis est bien celui demandé", calls.every((c) => c.text === "⚠️ Échec de publication"));
  }

  console.log("\n— 4) chat_id vide dans la liste → ignoré, pas de crash —");
  {
    await upsertConnection("co-sparse", "telegram", { linked_chat_ids: "123,,456, " }, "connected");
    const calls = stubTelegramFetch();
    await notifyCompanyTelegram("co-sparse", "test");
    check("seuls les 2 chat_id valides reçoivent un message", calls.length === 2, `${calls.length} appel(s)`);
  }

  console.log("\n— 5) Panne de l'API Telegram → jamais remontée à l'appelant —");
  {
    await upsertConnection("co-broken", "telegram", { linked_chat_ids: "999" }, "connected");
    stubTelegramFetch(true);
    let threw = false;
    try {
      await notifyCompanyTelegram("co-broken", "test");
    } catch {
      threw = true;
    }
    check("ne lève pas d'exception (best-effort)", !threw);
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
