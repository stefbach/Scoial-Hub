// Barre de mise en forme (gras/italique/emoji) — retour client Rosiane #6,
// BUGS-SocialHub35 : n'existait nulle part (ni Composer ni les espaces
// réseaux). Vérifie la logique PURE (lib/composer/apply-formatting.ts)
// derrière components/composer/FormattingToolbar.tsx.
//
// Usage : npm run test:formattoolbar

import { applyWrapFormatting, insertAtCursor } from "../lib/composer/apply-formatting";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

console.log("\n— applyWrapFormatting : mode markdown (LinkedIn) —");
{
  const value = "Bonjour le monde";
  // Sélectionne "monde" (positions 11-16).
  const r = applyWrapFormatting(value, 11, 16, "bold", "markdown", "texte en gras");
  check("entoure la sélection de **", r.next === "Bonjour le **monde**", r.next);
  check("sélection couvre le texte inséré (hors marqueurs)", r.selStart === 13 && r.selEnd === 18, `${r.selStart}-${r.selEnd}`);
}
{
  const r = applyWrapFormatting("texte", 5, 5, "italic", "markdown", "texte en italique");
  check("sans sélection → insère le texte-repère entouré de *", r.next === "texte*texte en italique*", r.next);
}

console.log("\n— applyWrapFormatting : mode unicode (Facebook/Instagram/TikTok) —");
{
  const r = applyWrapFormatting("Promo demain", 0, 5, "bold", "unicode", "texte en gras");
  check("remplace la sélection par son équivalent Unicode gras (pas de **)", !r.next.includes("*") && r.next.startsWith("𝗣𝗿𝗼𝗺𝗼"), r.next);
  check("le reste du texte est conservé", r.next.endsWith(" demain"), r.next);
}
{
  const r = applyWrapFormatting("", 0, 0, "italic", "unicode", "texte en italique");
  check("sans sélection → insère le placeholder stylé en italique Unicode", r.next.length > 0 && !r.next.includes("*"), r.next);
}

console.log("\n— insertAtCursor (emoji) —");
{
  const r = insertAtCursor("Bonjour !", 7, 7, "🎉");
  check("insère au curseur sans toucher le reste", r.next === "Bonjour🎉 !", r.next);
  // "🎉" occupe 2 unités UTF-16 (paire de substitution) — le curseur doit en
  // tenir compte comme le ferait un vrai <textarea>.
  check("curseur replacé juste après l'emoji (2 unités UTF-16)", r.selStart === 9 && r.selEnd === 9, `${r.selStart}-${r.selEnd}`);
}
{
  // Remplace une sélection existante par l'emoji (comportement standard d'un champ de texte).
  const r = insertAtCursor("Bonjour le monde", 8, 10, "✨");
  check("remplace la sélection par l'emoji", r.next === "Bonjour ✨ monde", r.next);
}

console.log(failed === 0 ? "\n✓ Tous les tests sont passés.\n" : `\n✗ ${failed} test(s) en échec.\n`);
if (failed > 0) process.exit(1);
