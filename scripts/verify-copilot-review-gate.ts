// Le Copilote créatif des studios (Vidéo/Avatar/Affiches) déclenchait la
// génération réelle dès sa première proposition, sans laisser l'utilisateur
// relire/ajuster le prompt avant — remonté par un testeur ("toujours création
// directement après une simple phrase, pas de prompt ou d'élaboration
// disponible"). Verrouille le correctif : le Copilote ne fait plus que
// pré-remplir le prompt/modèle/format des studios ; la génération reste
// déclenchée manuellement par le bouton « Générer » de chaque studio.
//
// Usage : npm run test:copilotgate

import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  // ── Studio Vidéo ───────────────────────────────────────────────────────────
  {
    const page = read("app/(general)/studio-video/page.tsx");
    check("studio-video · le copilote ne force plus autorun sur le seed", !/autorun:\s*true/.test(page), "autorun: true encore présent");
    const prompt = read("components/studio/PromptStudio.tsx");
    check("studio-video · PromptStudio ne génère que si autorun est explicitement vrai", /if \(seed\.autorun && seed\.prompt\)/.test(prompt));
    check("studio-video · le bouton manuel « Générer » existe toujours", /t\("Générer", "Generate"\)/.test(prompt) || /Générer/.test(prompt));
  }

  // ── Studio Avatar ────────────────────────────────────────────────────────
  {
    const page = read("app/(general)/studio-avatar/page.tsx");
    check("studio-avatar · le copilote n'appelle plus genPerson() lui-même", !/onApply=\{[\s\S]{0,600}?void genPerson/.test(page), "onApply appelle encore genPerson() directement");
    check("studio-avatar · le bouton manuel « ✨ Générer » existe toujours", /genPerson\(\)/.test(page) && /t\("✨ Générer", "✨ Generate"\)/.test(page));
  }

  // ── Studio Affiches ──────────────────────────────────────────────────────
  {
    const page = read("app/(general)/studio-affiche/page.tsx");
    check("studio-affiche · le copilote n'appelle plus generateBackground() lui-même", !/onApply=\{[\s\S]{0,600}?void generateBackground/.test(page), "onApply appelle encore generateBackground() directement");
    check("studio-affiche · le bouton manuel « Générer le fond » existe toujours", /generateBackground\(\)/.test(page));
  }

  // ── StudioCopilot lui-même : la proposition reste visible avant application ─
  {
    const copilot = read("components/studio/StudioCopilot.tsx");
    check("StudioCopilot · le prompt proposé est affiché dans le fil de discussion", /m\.sug\.prompt/.test(copilot));
    check("StudioCopilot · un bouton de ré-application manuelle existe (itération possible)", /Réappliquer au studio/.test(copilot));
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
