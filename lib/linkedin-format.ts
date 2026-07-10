/**
 * lib/linkedin-format.ts
 *
 * Convertisseur markdown léger → texte LinkedIn natif.
 *
 * LinkedIn ne rend PAS le markdown : `**gras**` s'affiche tel quel. Pour un
 * rendu identique à un post rédigé directement sur LinkedIn, on convertit le
 * gras/italique en caractères Unicode « Mathematical Sans-Serif Bold/Italic »
 * (le seul mécanisme de mise en relief natif du fil LinkedIn).
 *
 * STRATÉGIE ACCENTS (français : é è à ç…) — documentée et testée :
 * le texte stylé est décomposé en NFD ; chaque lettre de base [A-Za-z0-9] est
 * mappée vers son équivalent Unicode stylé et les diacritiques combinants
 * sont CONSERVÉS (é → « e » gras + U+0301) : ils se composent visuellement
 * sur la lettre stylée (« 𝗲́ »). Tout caractère sans correspondance
 * (ponctuation, emoji, CJK, symboles…) est laissé tel quel — jamais perdu.
 *
 * Fonctions pures, aucune dépendance React ni réseau.
 */

// ---------------------------------------------------------------------------
// Styles Unicode
// ---------------------------------------------------------------------------

interface UnicodeStyle {
  /** Point de code du « A » stylé. */
  upper: number;
  /** Point de code du « a » stylé. */
  lower: number;
  /** Point de code du « 0 » stylé (null si le style n'a pas de chiffres). */
  digit: number | null;
}

/** Mathematical Sans-Serif Bold : 𝗔 (U+1D5D4), 𝗮 (U+1D5EE), 𝟬 (U+1D7EC). */
const BOLD: UnicodeStyle = { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec };

/** Mathematical Sans-Serif Italic : 𝘈 (U+1D608), 𝘢 (U+1D622) — pas de chiffres. */
const ITALIC: UnicodeStyle = { upper: 0x1d608, lower: 0x1d622, digit: null };

/**
 * Applique un style Unicode à un texte : NFD → lettre de base stylée +
 * diacritiques combinants conservés ; caractères hors [A-Za-z0-9] inchangés.
 * Idempotent : un texte déjà stylé traverse la fonction sans modification.
 */
function styleText(text: string, style: UnicodeStyle): string {
  let out = "";
  for (const ch of text.normalize("NFD")) {
    const cp = ch.codePointAt(0) as number;
    if (cp >= 0x41 && cp <= 0x5a) {
      out += String.fromCodePoint(style.upper + (cp - 0x41));
    } else if (cp >= 0x61 && cp <= 0x7a) {
      out += String.fromCodePoint(style.lower + (cp - 0x61));
    } else if (cp >= 0x30 && cp <= 0x39 && style.digit !== null) {
      out += String.fromCodePoint(style.digit + (cp - 0x30));
    } else {
      // Diacritiques combinants, ponctuation, emojis… : conservés tels quels.
      out += ch;
    }
  }
  return out;
}

/** « Santé » → « 𝗦𝗮𝗻𝘁𝗲́ » (gras sans-serif Unicode). */
export function toUnicodeBold(text: string): string {
  return styleText(text, BOLD);
}

/** « exemple » → « 𝘦𝘹𝘦𝘮𝘱𝘭𝘦 » (italique sans-serif Unicode). */
export function toUnicodeItalic(text: string): string {
  return styleText(text, ITALIC);
}

// ---------------------------------------------------------------------------
// Conversion markdown léger → texte LinkedIn
// ---------------------------------------------------------------------------

/** Transformations INLINE : liens, gras, italique, code inline. */
function applyInline(s: string): string {
  return (
    s
      // [texte](url) → « texte (url) »
      .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, "$1 ($2)")
      // **gras** et __gras__
      .replace(/\*\*([^\n]+?)\*\*/g, (_, x: string) => toUnicodeBold(x))
      .replace(/__([^\n]+?)__/g, (_, x: string) => toUnicodeBold(x))
      // *italique* (jamais une puce : pas d'espace après l'astérisque)
      .replace(/\*([^*\s][^*\n]*?)\*/g, (_, x: string) => toUnicodeItalic(x))
      // _italique_ (délimité par espaces/ponctuation pour épargner snake_case)
      .replace(
        /(^|[\s(«"'])_([^_\n]+?)_(?=$|[\s).,;:!?»"'])/gm,
        (_, p: string, x: string) => p + toUnicodeItalic(x)
      )
      // `code` inline → contenu brut
      .replace(/`([^`\n]+)`/g, "$1")
  );
}

/**
 * Clamp de sécurité ≤ max caractères, coupé à une frontière de phrase ou de
 * paragraphe (jamais en plein mot, sans « … ») — même politique que le
 * connecteur LinkedIn.
 */
function clampLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const br = Math.max(
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("\n")
  );
  return (br > max * 0.6 ? slice.slice(0, br + 1) : slice).trim();
}

/** Limite stricte du champ `commentary` d'un post LinkedIn. */
const LINKEDIN_MAX = 3000;

/**
 * Convertit un texte markdown léger en texte LinkedIn natif, prêt à publier :
 *   - `**gras**` / `__gras__`  → gras sans-serif Unicode (accents conservés) ;
 *   - `*italique*` / `_italique_` → italique sans-serif Unicode ;
 *   - `- item` / `* item`      → puce « • » ;
 *   - `# Titre` / `## Titre`   → titre en gras Unicode + ligne vide après ;
 *   - `[texte](url)`           → « texte (url) », backticks retirés ;
 *   - filet de sécurité : clamp propre ≤ 3000 caractères.
 *
 * Idempotente : un texte déjà converti (ou sans markdown) ressort intact.
 */
export function formatForLinkedIn(text: string, maxLength = LINKEDIN_MAX): string {
  if (!text) return "";

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Clôtures de blocs de code ``` : supprimées (le contenu est conservé).
    if (/^\s*```/.test(line)) continue;

    // Titres markdown → ligne en gras Unicode + ligne vide après si absente.
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (heading) {
      out.push(toUnicodeBold(applyInline(heading[1].trim())));
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== "") out.push("");
      continue;
    }

    // Puces markdown → « • » (l'indentation éventuelle est conservée).
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      out.push(`${bullet[1]}• ${applyInline(bullet[2])}`);
      continue;
    }

    out.push(applyInline(line));
  }

  const formatted = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return clampLength(formatted, maxLength);
}
