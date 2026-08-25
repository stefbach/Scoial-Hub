// Éditeur média — Lot 0 des correctifs d'urgence (document de refonte).
//
// L'audit note qu'aucun test ne couvrait ce module : c'est ce qui a laissé
// passer A-02 (un défaut d'une ligne neutralisant six fonctions) et A-06 (un
// média non publiable livré en production). Ces contrôles verrouillent les
// correctifs du lot 0.
//
// Usage : npm run test:editeur

import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  const editor = read("components/compose/MediaEditor.tsx");
  const upload = read("components/ui/MediaUpload.tsx");
  const compose = read("app/(organic)/compose/page.tsx");
  const host = read("lib/media/host.ts");

  // ── A-06 · Le rendu est hébergé publiquement (CRITIQUE) ───────────────────
  {
    check(
      "A-06 · l'éditeur n'émet plus d'URL blob: comme média final",
      !/onExport\(\{\s*url:\s*URL\.createObjectURL/.test(editor) &&
        !/const url = URL\.createObjectURL\(blob\)/.test(editor)
    );
    check("A-06 · le rendu passe par l'hébergement public", /await hostMedia\(companyId, blob, name, "edited"\)/.test(editor));
    check(
      "A-06 · la modale ne se ferme QUE si l'hébergement a réussi",
      (editor.match(/if \(await publishRender\(/g) ?? []).length === 2
    );
    check("A-06 · le composeur transmet la société", /companyId=\{company\.id\}/.test(compose));
    check("A-06 · règle d'hébergement partagée par les deux appelants",
      /export async function hostMedia/.test(host) && /hostMedia\(companyId, file, file\.name, "compose"\)/.test(upload));
  }

  // ── A-02 · Le texte posé reste sélectionnable ─────────────────────────────
  {
    check(
      "A-02 · le clic sur un bloc de texte ne remonte plus au conteneur",
      /onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(
        editor.slice(editor.indexOf("overlays.map"), editor.indexOf("Ajouter un texte"))
      )
    );
    // Les six fonctions débloquées existent bel et bien dans le panneau.
    for (const [nom, motif] of [
      ["contenu", /updateSel\(\{ text:/],
      ["taille", /updateSel\(\{ sizePct:/],
      ["couleur", /updateSel\(\{ color:/],
      ["gras", /updateSel\(\{ bold:/],
      ["fond", /updateSel\(\{ bg:/],
      ["suppression", /onClick=\{removeSel\}/],
    ] as const) {
      check(`A-02 · fonction « ${nom} » présente et désormais atteignable`, motif.test(editor));
    }
  }

  // ── A-04 · Le son d'origine n'est plus supprimé en silence ────────────────
  {
    check("A-04 · son original conservé par défaut", /useState\(true\);?\s*\n\s*\/\*\* Volume de la musique/.test(editor) || /const \[keepAudio, setKeepAudio\] = useState\(true\)/.test(editor));
    check("A-04 · mixage pondéré en faveur de la voix", /\[2:a\]volume=\$\{gain\.toFixed\(2\)\}\[m\]/.test(editor));
    check("A-04 · plus de amix brut à volume égal", !/\[0:a\]\[2:a\]amix=inputs=2:duration=shortest\[a\]/.test(editor));
    check("A-04 · la musique est écoutable avant le rendu", /<audio src=\{musicUrl/.test(editor));
    check("A-04 · réglage du volume de la musique", /setMusicVolume\(Number\(e\.target\.value\)\)/.test(editor));
    check("A-04 · suppression du son d'origine annoncée explicitement", /son d'origine de la vidéo sera supprimé/.test(editor));
  }

  // ── A-01 · Plafond d'import relevé et expliqué ────────────────────────────
  {
    const { MAX_UPLOAD_BYTES, MEDIA_ACCEPT, formatSize } = await import("../lib/media/host");
    check("A-01 · plafond porté à 100 Mo", MAX_UPLOAD_BYTES === 100 * 1024 * 1024, String(MAX_UPLOAD_BYTES));
    check("A-01 · MOV et WebM acceptés", /video\/quicktime/.test(MEDIA_ACCEPT) && /video\/webm/.test(MEDIA_ACCEPT));
    check("A-01 · taille lisible", formatSize(120 * 1024 * 1024) === "120.0 Mo", formatSize(120 * 1024 * 1024));
    check(
      "A-01 · le rejet explique la cause et la sortie",
      /dépasse sa mémoire/.test(upload) && /Réduisez la durée ou la définition/.test(upload)
    );
  }

  // ── A-08 · Le libellé annonce ce que l'outil fait ─────────────────────────
  {
    check("A-08 · plus de promesse « Studio »", !/Studio — texte & musique/.test(editor));
    check("A-08 · libellé aligné sur le périmètre réel", /Annotation rapide/.test(editor) && /Annoter \(texte \/ musique\)/.test(compose));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
