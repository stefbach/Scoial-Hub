// Notification d'un échec DÉFINITIF de publication programmée — second canal
// (e-mail au propriétaire, lib/notifications/failed-publish.ts), câblé dans
// app/api/cron/publish-due/route.ts à côté de l'alerte Telegram déjà couverte
// par scripts/verify-publish-failure-alert.ts.
//
// Retour client (BUGS-SocialHub35 #3) : une publication Facebook a vu son
// visuel supprimé avant l'échéance et a été retentée plus de 300 fois sans
// succès — demande explicite qu'une notification parte au lieu de boucler.
// Le réessai est déjà borné (RETRY_WINDOW_HOURS) et alertait déjà par
// Telegram ; ce script vérifie que le nouveau module compose bien les deux
// canaux sans jamais lever, quel que soit l'état de la configuration.
//
// Usage : npx tsx scripts/verify-failed-publish-notification.ts

process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
delete process.env.RESEND_API_KEY;
// Environnement de test : Supabase non configuré (comme
// scripts/verify-publish-failure-alert.ts) — getCompanyOwnerEmail y renvoie
// donc toujours null par construction (lib/repositories/access.ts) ; ce
// script vérifie le comportement ATTEIGNABLE dans cet environnement (garde
// "pas configuré", jamais d'exception, contenu Telegram correct) plutôt que
// l'envoi Resend réel, qui suppose un projet Supabase.

export {};

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface TelegramCall {
  chatId: string;
  text: string;
}

function stubFetch(): { telegram: TelegramCall[]; resendCalls: number } {
  const telegram: TelegramCall[] = [];
  let resendCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("api.telegram.org")) {
      const body = init?.body ? (JSON.parse(init.body as string) as { chat_id?: string | number; text?: string }) : {};
      telegram.push({ chatId: String(body.chat_id), text: String(body.text ?? "") });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
    }
    if (url.includes("api.resend.com")) {
      resendCalls += 1;
      return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
    }
    throw new Error(`fetch inattendu : ${url}`);
  }) as typeof fetch;
  return { telegram, resendCalls };
}

async function main() {
  const { notifyFailedScheduledPublish } = await import("../lib/notifications/failed-publish");
  const { upsertConnection } = await import("../lib/repositories/channel-connections");

  console.log("— 1) RESEND non configuré → pas d'appel Resend, Telegram toujours envoyé —");
  {
    await upsertConnection("co-notif-1", "telegram", { linked_chat_ids: "111" }, "connected");
    const state = stubFetch();
    let threw = false;
    try {
      await notifyFailedScheduledPublish({
        companyId: "co-notif-1",
        platform: "facebook",
        title: "Post test",
        reason: "Image introuvable.",
      });
    } catch {
      threw = true;
    }
    check("ne lève pas d'exception", !threw);
    check("Telegram reçoit bien le message", state.telegram.length === 1, `${state.telegram.length} appel(s)`);
    check("aucun appel Resend (RESEND_API_KEY absente)", state.resendCalls === 0);
  }

  console.log("\n— 2) RESEND configuré mais Supabase absent (env de test) → pas d'e-mail, pas d'exception —");
  {
    process.env.RESEND_API_KEY = "test-resend-key";
    await upsertConnection("co-notif-2", "telegram", { linked_chat_ids: "222" }, "connected");
    const state = stubFetch();
    let threw = false;
    try {
      await notifyFailedScheduledPublish({
        companyId: "co-notif-2",
        platform: "instagram",
        title: "Post test 2",
        reason: "Jeton expiré.",
      });
    } catch {
      threw = true;
    }
    check("ne lève pas d'exception", !threw);
    check("Telegram reçoit toujours le message", state.telegram.length === 1, `${state.telegram.length} appel(s)`);
    check(
      "pas d'appel Resend (getCompanyOwnerEmail renvoie null sans Supabase configuré)",
      state.resendCalls === 0
    );
    delete process.env.RESEND_API_KEY;
  }

  console.log("\n— 3) headline « cancelled » vs « failed » → texte Telegram distinct —");
  {
    await upsertConnection("co-notif-3", "telegram", { linked_chat_ids: "333" }, "connected");
    const state = stubFetch();
    await notifyFailedScheduledPublish({
      companyId: "co-notif-3",
      platform: "linkedin",
      title: "Post en retard",
      reason: "Échéance dépassée de plus de 24 h.",
      headline: "cancelled",
    });
    check(
      "texte « annulée » pour un dépassement de fenêtre",
      state.telegram[0]?.text.startsWith("⚠️ Publication automatique annulée"),
      state.telegram[0]?.text
    );
  }
  {
    await upsertConnection("co-notif-4", "telegram", { linked_chat_ids: "444" }, "connected");
    const state = stubFetch();
    await notifyFailedScheduledPublish({
      companyId: "co-notif-4",
      platform: "tiktok",
      title: "Post rejeté",
      reason: "Compte déconnecté.",
    });
    check(
      "texte « échec » par défaut",
      state.telegram[0]?.text.startsWith("⚠️ Échec de la publication automatique"),
      state.telegram[0]?.text
    );
  }

  console.log("\n— 4) Aucun canal disponible (ni Telegram ni Resend) → jamais d'exception —");
  {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const state = stubFetch();
    let threw = false;
    try {
      await notifyFailedScheduledPublish({
        companyId: "co-notif-none",
        platform: "facebook",
        title: "Post sans canal",
        reason: "Test.",
      });
    } catch {
      threw = true;
    }
    check("ne lève pas d'exception", !threw);
    check("aucun appel réseau", state.telegram.length === 0 && state.resendCalls === 0);
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
