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

  // ── #7 · Kit de marque IA rédigé dans la langue de l'interface ────────────
  {
    const { normalizeLang, langName, langRule } = await import("../lib/ai/lang");
    check("langue · « en » reconnu", normalizeLang("en") === "en" && normalizeLang("EN-GB") === "en");
    check("langue · défaut français", normalizeLang(undefined) === "fr" && normalizeLang("xx") === "fr");
    check("langue · règle explicite pour l'anglais", /ANGLAIS/.test(langRule("en")) && langName("en") !== langName("fr"));

    for (const route of ["app/api/ai/generate-brand-chart/route.ts", "app/api/ai/analyze-brand-visual/route.ts"]) {
      const src = read(route);
      check(`${route} · langue reçue du client`, /normalizeLang\(rawLang\)/.test(src));
      check(`${route} · règle de langue injectée dans le prompt`, /langRule\(lang\)/.test(src));
      check(`${route} · plus de sortie forcée en français`, !/en francais|phrases FR|mots de ton FR/i.test(src));
    }
    const panel = read("components/studio/BrandKitPanel.tsx");
    check("kit de marque · la langue de l'interface est transmise", (panel.match(/lang \}\),?|, lang \}/g) ?? []).length >= 1);
  }

  // ── #8 · « Utiliser » écrit dans la publication ───────────────────────────
  {
    const panel = read("components/ui/AiPanel.tsx");
    check("composer · le bouton « Utiliser » dispose d'un destinataire", /onUse\?: \(text: string\) => void/.test(panel));
    check("composer · le texte est bien transmis au clic", /onUse\(result\)/.test(panel));
    const compose = read("app/(organic)/compose/page.tsx");
    check(
      "composer · le texte généré rejoint le corps du post sans écraser la saisie",
      /onUse=\{\(text\) => setBody\(\(prev\) =>/.test(compose)
    );
  }

  // ── #9 · Musique et voix off coexistent ───────────────────────────────────
  {
    const src = read("components/studio/AudioStudio.tsx");
    check("studio audio · une piste conservée par type", /tracks, setTracks\] = useState<\{ music\?: string; voice\?: string \}>/.test(src));
    check("studio audio · changer d'onglet n'efface plus la piste", !/setUrl\(null\)/.test(src));
    check("studio audio · les deux lecteurs restent affichés", /tracks\.music \|\| tracks\.voice/.test(src));
  }

  // ── #10 · Visuels calibrés sur l'identité enregistrée ─────────────────────
  {
    const { brandPromptHints } = await import("../lib/brand-kit/prompt");
    const { makeEmptyBrandKit } = await import("../lib/brand-kit/types");

    check("marque · kit vide → aucune consigne inventée", brandPromptHints(makeEmptyBrandKit("c")) === "");
    check("marque · kit absent → chaîne vide", brandPromptHints(null) === "");

    // Cas du bug : charte générée depuis le logo, mais AUCUNE analyse vision.
    const kit = {
      ...makeEmptyBrandKit("c"),
      style: "minimaliste",
      chart: {
        palette: [{ hex: "#0d3b66", name: "Bleu nuit", role: "Principale" }],
        headingFont: "Poppins", bodyFont: "Inter", typographyNote: "", toneWords: ["sobre"],
        voice: "", logoUsage: [], dos: [], donts: [], imagery: "photos lumineuses",
        tagline: "", aiGenerated: true, generatedAt: null,
      },
    };
    const hints = brandPromptHints(kit);
    check("marque · palette de la charte injectée", /#0d3b66 \(primary\)/.test(hints), hints);
    check("marque · style et direction photo injectés", /minimaliste/.test(hints) && /photos lumineuses/.test(hints), hints);

    const affiche = read("app/(general)/studio-affiche/page.tsx");
    check("affiche · la génération utilise l'identité complète", /brandStyle\]\.filter\(Boolean\)/.test(affiche));
    check("affiche · l'utilisateur voit si son identité est prise en compte", /Calibré sur l'identité de/.test(affiche));
  }

  // ── #11 · Pastilles sélectionnées lisibles en thème sombre ────────────────
  {
    const css = read("app/globals.css");
    check(
      "thème sombre · le texte posé sur `bg-ink` reprend la couleur du fond",
      /html:not\(\[data-theme="light"\]\) \[class~="bg-ink"\] \{\s*\n?\s*color: rgb\(var\(--color-canvas\)\);/.test(css)
    );
  }

  // ── #12 · Le média publié est conservé ET affiché ─────────────────────────
  {
    const types = read("lib/types.ts");
    check("historique · l'URL du média fait partie du modèle", /media\?: \{ kind: "image" \| "video"; url\?: string \}/.test(types));

    const mapper = read("lib/repositories/company-data.ts");
    check(
      "historique · l'URL n'est plus perdue à la lecture en base",
      (mapper.match(/kind: media\.kind, url: media\.url \|\| undefined/g) ?? []).length === 2
    );

    // Les trois chemins d'écriture de l'historique doivent enregistrer l'URL.
    const meta = read("app/api/meta/publish/route.ts");
    check(
      "meta · média publié transmis à l'historique",
      /const loggedMedia = mediaUrl && mediaKind \? \{ kind: mediaKind, url: mediaUrl \}/.test(meta) &&
        (meta.match(/logPublished\(companyId, "\w+", text \?\? "", r\.url, loggedMedia\)/g) ?? []).length === 2
    );
    check("linkedin · média publié transmis à l'historique", /media: \{ kind: "image", url: imageUrl \}/.test(read("app/api/linkedin/publish/route.ts")));
    check("programmées · média publié transmis à l'historique", /url: post\.media\.url/.test(read("lib/publishing/publish-scheduled.ts")));

    const modal = read("components/organic/HistoryDetailModal.tsx");
    check("historique · le visuel est affiché, plus seulement nommé", /post\.media\.url \?/.test(modal) && /<img/.test(modal));
    const list = read("app/(organic)/history/page.tsx");
    check("historique · vignette dans la liste", /item\.media\?\.url &&/.test(list));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
