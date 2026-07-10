// Test autonome du convertisseur markdown léger → texte LinkedIn natif.
// LinkedIn ne rend pas le markdown : on vérifie la conversion du gras/italique
// en Unicode « Mathematical Sans-Serif » (accents français conservés via NFD),
// les puces, les titres, les liens, l'idempotence et le clamp de longueur.
// Lancement : npx tsx scripts/verify-linkedin-format.ts

import { formatForLinkedIn, toUnicodeBold, toUnicodeItalic } from "../lib/linkedin-format";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// Helpers : construit la référence attendue à partir des points de code.
const bold = (base: number, offset: number) => String.fromCodePoint(base + offset);
const B_UP = 0x1d5d4, B_LO = 0x1d5ee, B_DG = 0x1d7ec; // sans-serif bold A / a / 0
const I_LO = 0x1d622; // sans-serif italic a
const ACUTE = "́", GRAVE = "̀", CEDILLA = "̧";

console.log("\n— 1) Gras Unicode simple —");
const grasSimple = formatForLinkedIn("**Bold**");
const expectedBold =
  bold(B_UP, 1) + bold(B_LO, 14) + bold(B_LO, 11) + bold(B_LO, 3); // 𝗕𝗼𝗹𝗱
check("**Bold** → 𝗕𝗼𝗹𝗱", grasSimple === expectedBold, grasSimple);
check("__Bold__ → 𝗕𝗼𝗹𝗱", formatForLinkedIn("__Bold__") === expectedBold);
check("chiffres en gras : **2026** → 𝟮𝟬𝟮𝟲",
  formatForLinkedIn("**2026**") === bold(B_DG, 2) + bold(B_DG, 0) + bold(B_DG, 2) + bold(B_DG, 6));

console.log("\n— 2) Gras avec accents français (é à ç) : NFD, base grasse + diacritique conservé —");
const sante = formatForLinkedIn("**Santé**");
const expectedSante =
  bold(B_UP, 18) + bold(B_LO, 0) + bold(B_LO, 13) + bold(B_LO, 19) + bold(B_LO, 4) + ACUTE; // 𝗦𝗮𝗻𝘁𝗲́
check("**Santé** → 𝗦𝗮𝗻𝘁𝗲 + U+0301", sante === expectedSante, JSON.stringify(sante));
const francais = formatForLinkedIn("**à ça**");
check("**à ça** : à → 𝗮 + U+0300, ç → 𝗰 + U+0327",
  francais === bold(B_LO, 0) + GRAVE + " " + bold(B_LO, 2) + CEDILLA + bold(B_LO, 0),
  JSON.stringify(francais));

console.log("\n— 3) Italique Unicode —");
check("*mot* → 𝘮𝘰𝘵",
  formatForLinkedIn("*mot*") === bold(I_LO, 12) + bold(I_LO, 14) + bold(I_LO, 19));
check("_mot_ → 𝘮𝘰𝘵",
  formatForLinkedIn("un _mot_ ici") === "un " + bold(I_LO, 12) + bold(I_LO, 14) + bold(I_LO, 19) + " ici");
check("snake_case intact", formatForLinkedIn("var snake_case_ok") === "var snake_case_ok");

console.log("\n— 4) Puces —");
check("- item → • item", formatForLinkedIn("- item\n- deux") === "• item\n• deux");
check("* item → • item", formatForLinkedIn("* item") === "• item");
check("gras dans une puce", formatForLinkedIn("- **clé**") === "• " + bold(B_LO, 2) + bold(B_LO, 11) + bold(B_LO, 4) + ACUTE);

console.log("\n— 5) Titres —");
const titre = formatForLinkedIn("## Titre\ntexte");
check("## Titre → gras Unicode + ligne vide insérée",
  titre === bold(B_UP, 19) + bold(B_LO, 8) + bold(B_LO, 19) + bold(B_LO, 17) + bold(B_LO, 4) + "\n\ntexte", JSON.stringify(titre));
check("# Titre suivi d'une ligne vide : pas de double vide",
  formatForLinkedIn("# Cap\n\nsuite") === toUnicodeBold("Cap") + "\n\nsuite");

console.log("\n— 6) Texte sans markdown : inchangé —");
const plain = "Bonjour le monde. Ceci est un texte normal, avec 123 chiffres et (parenthèses).";
check("texte brut identique", formatForLinkedIn(plain) === plain);
check("idempotence : formater deux fois = formater une fois",
  formatForLinkedIn(formatForLinkedIn("**Santé** et *style*")) === formatForLinkedIn("**Santé** et *style*"));

console.log("\n— 7) Emojis et liens —");
check("emoji conservé", formatForLinkedIn("🚀 **go**") === "🚀 " + bold(B_LO, 6) + bold(B_LO, 14));
check("[texte](url) → texte (url)",
  formatForLinkedIn("Voir [le site](https://ex.io) ici") === "Voir le site (https://ex.io) ici");
check("backticks retirés", formatForLinkedIn("code `npm test` ok") === "code npm test ok");

console.log("\n— 8) Longueur clampée (filet de sécurité 3000) —");
const long = ("Une phrase complète qui compte des caractères. ".repeat(90)).trim(); // > 4000
const clamped = formatForLinkedIn(long);
check("entrée > 4000 → sortie ≤ 3000", clamped.length <= 3000, String(clamped.length));
check("coupe propre : se termine par un point", clamped.endsWith("."), clamped.slice(-20));
check("texte court : aucune coupe", formatForLinkedIn("court").length === 5);

console.log("\n— 9) Exports unitaires —");
check("toUnicodeBold pur", toUnicodeBold("AZaz09") ===
  bold(B_UP, 0) + bold(B_UP, 25) + bold(B_LO, 0) + bold(B_LO, 25) + bold(B_DG, 0) + bold(B_DG, 9));
check("toUnicodeItalic laisse les chiffres (pas d'italique Unicode pour 0-9)",
  toUnicodeItalic("a1") === bold(I_LO, 0) + "1");

console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
process.exit(failed === 0 ? 0 : 1);
