// Traduction des erreurs du moteur de rendu (Shotstack) en français.
//
// Le message brut de l'API (« Bad Request », vocabulaire d'API en anglais)
// remontait tel quel jusqu'à l'utilisateur du banc de montage — même défaut
// de traduction que celui qui masquait l'erreur réelle de quota vidéo
// derrière un message générique (audit Editing Bench, P3-4, même chemin que
// P0-1).
//
// Usage : npm run test:rendererrors

export {}; // marque le fichier comme module — sans import statique de lib/env.ts (voir plus bas).

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function withFetch(status: number, message: string | undefined, run: () => Promise<void>) {
  const real = global.fetch;
  global.fetch = (async () =>
    new Response(JSON.stringify({ success: false, message }), { status })) as unknown as typeof fetch;
  try {
    await run();
  } finally {
    global.fetch = real;
  }
}

async function main() {
  // Import dynamique : lib/env.ts lit SHOTSTACK_API_KEY à l'IMPORT (pas à
  // l'appel) ; un import statique serait hissé avant cette affectation.
  process.env.SHOTSTACK_API_KEY = "test-key";
  const { submitEdit } = await import("../lib/video/render");

  await withFetch(400, "Bad Request", async () => {
    const r = await submitEdit({});
    check("« Bad Request » devient un message compréhensible, en français",
      !r.ok && /refus\u00e9 le montage sans pr\u00e9ciser la cause/.test(r.error ?? ""),
      r.error);
    // L'ancien message citait la police parmi les suspects. Le moteur ne
    // reçoit JAMAIS de police : il envoyait chercher là où il n'y a rien.
    check("le message n'invente plus de suspects (la police n'est jamais transmise)",
      !r.ok && !/police/i.test(r.error ?? ""), r.error);
    check("le texte anglais brut ne fuite plus vers l'utilisateur", !r.ok && !/bad request/i.test(r.error ?? ""));
  });

  await withFetch(400, undefined, async () => {
    const r = await submitEdit({});
    check("un message Shotstack absent retombe sur le même texte compréhensible",
      !r.ok && /sans préciser la cause/.test(r.error ?? ""), r.error);
  });

  await withFetch(404, "Asset Not Found", async () => {
    const r = await submitEdit({});
    check("une ressource introuvable est expliquée en français",
      !r.ok && /introuvable/i.test(r.error ?? ""), r.error);
  });

  await withFetch(422, "Unprocessable: field \"timeline.tracks[0].clips[2].transition.in\" must be one of fade, reveal, wipeLeft", async () => {
    const r = await submitEdit({});
    check("un message technique inconnu passe quand même, avec son code",
      !r.ok && !!r.error?.includes("must be one of") && !!r.error?.includes("(code 422)"), r.error);
  });

  // ── Le détail RÉEL du refus doit remonter ────────────────────────────────
  // C'est le cœur du problème rencontré sur un vrai montage : le moteur répond
  // « Bad Request » dans `message` et met la cause dans `response`. Ne lire que
  // `message` jetait la seule information exploitable, et l'utilisateur
  // recevait une phrase qui ne désignait rien.
  const withBody = async (status: number, body: unknown, run: () => Promise<void>) => {
    const real = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    try { await run(); } finally { global.fetch = real; }
  };

  await withBody(400, {
    success: false,
    message: "Bad Request",
    response: { error: "Invalid timeline", details: [{ field: "timeline.tracks[0].clips[1].asset.src", message: "must be a valid URL" }] },
  }, async () => {
    const r = await submitEdit({});
    check("le champ fautif remonte jusqu'à l'utilisateur",
      !r.ok && /timeline\.tracks\[0\]\.clips\[1\]\.asset\.src/.test(r.error ?? ""), r.error);
    check("et la raison qui l'accompagne aussi",
      !r.ok && /must be a valid URL/.test(r.error ?? ""), r.error);
    check("le texte générique n'écrase plus le détail",
      !r.ok && !/sans préciser la cause/.test(r.error ?? ""), r.error);
  });

  await withBody(400, { success: false, message: "Bad Request", response: "duration exceeds plan limit" }, async () => {
    const r = await submitEdit({});
    check("un détail transmis en texte simple remonte également",
      !r.ok && /duration exceeds plan limit/.test(r.error ?? ""), r.error);
  });

  await withBody(400, {
    success: false,
    message: "Bad Request",
    response: { error: "Invalid request", message: "Invalid request" },
  }, async () => {
    const r = await submitEdit({});
    check("un détail répété deux fois n'est pas affiché en double",
      !r.ok && (r.error ?? "").split("Invalid request").length === 2, r.error);
  });

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
