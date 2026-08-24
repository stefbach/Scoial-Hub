// Recette du 24/08 — barre latérale et écrans d'agents.
//
// Les points #6 à #13 de ce rapport répètent des corrections déjà livrées dans
// la PR #200 (recettes R24 et R25) : elles ont leurs propres scripts
// (test:cloisonnement, test:r24, test:r25). Ne sont vérifiés ici que les
// points RÉELLEMENT nouveaux : la barre latérale (#1, #2, #3) et les deux
// corrections d'étape 5 qui n'avaient été appliquées qu'à l'écran /agents,
// jamais au parcours assisté (#4, #5).
//
// Usage : npm run test:r26

import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  const sidebar = read("components/shell/Sidebar.tsx");
  const shell = read("components/shell/AppShell.tsx");
  const css = read("app/globals.css");

  // ── #1 · Plus de filet horizontal, seulement le filet vertical ────────────
  {
    check(
      "barre latérale · plus aucun filet horizontal",
      !/h-px[^"]*bg-hair/.test(sidebar),
      (sidebar.match(/[^"]*h-px[^"]*bg-hair[^"]*/) ?? [])[0]
    );
    check("barre latérale · le filet vertical de séparation est conservé", /border-r border-hair/.test(sidebar));
  }

  // ── #2 · La colonne descend jusqu'en bas de l'écran ───────────────────────
  {
    check("barre latérale · colonne pleine hauteur", /flex h-full flex-col shrink-0 border-r/.test(sidebar));
    check(
      "barre latérale · hauteur d'écran restante attribuée par le shell",
      /lg:h-\[calc\(100dvh-var\(--app-header-h\)\)\]/.test(shell)
    );
    check("barre latérale · hauteur d'en-tête définie une seule fois", /--app-header-h: 3\.75rem/.test(css));
    check(
      "barre latérale · l'en-tête est verrouillé sur cette hauteur",
      /min-height: var\(--app-header-h\);/.test(css)
    );
    check("barre latérale · espacement des sections élargi", /i > 0 \? "mt-4" : ""/.test(sidebar));
    check("barre latérale · déconnexion ancrée en bas", /mt-4 shrink-0 pt-1/.test(sidebar));
  }

  // ── #3 · Le menu ne défile plus avec la page ──────────────────────────────
  {
    check(
      "barre latérale · collée sous l'en-tête pendant le défilement",
      /lg:sticky lg:top-\[var\(--app-header-h\)\]/.test(shell)
    );
    check(
      "barre latérale · défile pour elle-même si le menu dépasse",
      /min-h-0 flex-1 overflow-y-auto/.test(sidebar)
    );
    // `self-start` est indispensable : dans un conteneur flex, l'étirement par
    // défaut (`align-items: stretch`) neutralise `position: sticky`.
    check("barre latérale · alignement compatible avec le collage", /self-start/.test(shell));
  }

  // ── #4 · Le lien de reprise de campagne est cliquable à l'étape 5 ─────────
  {
    const step5 = read("components/onboarding/Step5Agents.tsx");
    const timeline = read("components/agents/RunTimeline.tsx");
    const shared = read("components/agents/StepOutput.tsx");

    check("agents · rendu du texte d'étape mutualisé", /export function StepOutput/.test(shared));
    check("agents · la timeline utilise le rendu partagé", /from "\.\/StepOutput"/.test(timeline));
    check(
      "agents · l'étape 5 utilise le MÊME rendu (liens cliquables)",
      /<StepOutput text=\{displayOutput\} \/>/.test(step5)
    );
    check(
      "agents · la troncature ne coupe plus le lien de reprise",
      /truncateKeepingLink\(rawOutput, OUTPUT_LIMIT\)/.test(step5)
    );

    const { truncateKeepingLink, hasInternalLink } = await import("../components/agents/StepOutput");
    const long = `${"a".repeat(400)}\n\n🔗 Créer cette campagne (pré-remplie, EN PAUSE) : /campaigns/new?image=x&text=y`;
    const cut = truncateKeepingLink(long, 300);
    check("agents · lien préservé malgré la troncature", hasInternalLink(cut) && cut.includes("/campaigns/new"), cut.slice(-80));
    check("agents · texte court laissé intact", truncateKeepingLink("court", 300) === "court");
  }

  // ── #5 · La mention d'attente de validation saute aux yeux ────────────────
  {
    const step5 = read("components/onboarding/Step5Agents.tsx");
    check(
      "étape 5 · bandeau d'attente de validation sur le contenu final",
      /splitApprovalMark\(finalOutput\)/.test(step5) && /<PendingApprovalBanner/.test(step5)
    );

    const { splitApprovalMark } = await import("../components/agents/StepOutput");
    const en = splitApprovalMark("[PENDING APPROVAL] Buy now");
    check("étape 5 · marqueur anglais détecté et retiré du corps", en.pending && en.body === "Buy now", JSON.stringify(en));
    const fr = splitApprovalMark("[EN ATTENTE DE VALIDATION]\n\nAchetez maintenant");
    check("étape 5 · marqueur français détecté et retiré du corps", fr.pending && fr.body === "Achetez maintenant", JSON.stringify(fr));
    const none = splitApprovalMark("Contenu déjà validé");
    check("étape 5 · aucun bandeau sans marqueur", !none.pending && none.body === "Contenu déjà validé");
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
