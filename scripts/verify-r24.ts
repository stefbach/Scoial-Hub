// Recette du 19/08 — contrôles des points d'interface et d'envoi d'e-mail.
// Le cloisonnement par société (#2, #3, #4) a son propre script :
// npm run test:cloisonnement.
//
// Usage : npm run test:r24

import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  // ── #1 · Niveaux d'autonomie : plus d'infobulle redondante ────────────────
  {
    const src = read("components/agents/AgentLauncher.tsx");
    check(
      "niveaux · plus d'infobulle au survol (la description est déjà sous les boutons)",
      !/title=\{t\(LEVELS/.test(src)
    );
    check("niveaux · description du niveau sélectionné conservée", /LEVELS\[autonomy\]/.test(src));
  }

  // ── #5 · Le centre de pilotage décrit le niveau sélectionné ───────────────
  {
    const src = read("app/(general)/pilotage/page.tsx");
    check(
      "pilotage · description du niveau d'autonomie sélectionné affichée",
      /AUTONOMY_LEVELS\[autonomy\]\.fr/.test(src)
    );
    check(
      "pilotage · libellés courts issus de la définition partagée",
      /AUTONOMY_LEVELS\[lvl\]\.shortFr/.test(src)
    );
  }

  // Une seule définition des niveaux pour toute l'application.
  {
    const { AUTONOMY_LEVELS } = await import("../lib/agents/autonomy");
    const levels = [1, 2, 3] as const;
    check(
      "niveaux · les trois niveaux sont décrits en FR et en EN",
      levels.every((l) => AUTONOMY_LEVELS[l].fr.length > 20 && AUTONOMY_LEVELS[l].en.length > 20)
    );
  }

  // ── #6 · Invitation d'équipe : échec d'envoi visible et rattrapable ───────
  {
    // Sans service e-mail configuré, l'envoi ne doit JAMAIS être annoncé comme
    // réussi — c'est ce silence qui a fait croire l'invitation partie.
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const { sendEmail, isEmailConfigured } = await import("../lib/email");
    check("e-mail · service non configuré correctement détecté", isEmailConfigured() === false);
    const res = await sendEmail({ to: "x@example.com", subject: "s", text: "t" });
    check(
      "e-mail · aucun succès simulé quand le service est absent",
      res.ok === false && res.failure === "not_configured",
      JSON.stringify(res)
    );
    if (saved !== undefined) process.env.RESEND_API_KEY = saved;

    const route = read("app/api/team/route.ts");
    check("api équipe · état du service e-mail exposé à l'écran", /emailConfigured: isEmailConfigured\(\)/.test(route));
    check("api équipe · cause de l'échec renvoyée", /res\.emailFailure = sent\.failure/.test(route));

    const ui = read("app/(general)/mon-equipe/page.tsx");
    check(
      "mon équipe · avertissement AVANT d'inviter quand l'envoi auto est inactif",
      /!emailConfigured &&/.test(ui)
    );
    check(
      "mon équipe · repli qui envoie vraiment (messagerie de l'admin)",
      /mailtoInvite\(inv\.email\)/.test(ui) && /`mailto:\$\{encodeURIComponent\(email\)\}/.test(ui)
    );
    check(
      "mon équipe · message d'échec précisant la cause",
      /res\?\.emailFailure === "rejected"/.test(ui)
    );
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
