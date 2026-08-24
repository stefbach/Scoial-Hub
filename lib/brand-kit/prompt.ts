// Traduit l'identité de marque ENREGISTRÉE en directive de style pour les
// modèles d'image.
//
// Jusqu'ici seul `promptHints` était injecté dans les prompts. Ce champ n'est
// rempli que par l'analyse vision (« Analyser mon identité ») : une marque dont
// la charte avait été générée depuis le logo, ou dont la palette avait été
// saisie à la main, produisait donc des affiches sans aucun lien avec elle
// (recette R24 #10). On reconstruit ici la directive à partir de TOUT ce qui
// est connu de la marque.
//
// La sortie est en anglais : c'est la langue attendue par les modèles d'image.

import type { BrandKit } from "./types";

/** Rôles de couleur reconnus, en français comme en anglais. */
function roleInEnglish(role: string): string {
  const r = role.toLowerCase();
  if (/princip|primary/.test(r)) return "primary";
  if (/secondaire|secondary/.test(r)) return "secondary";
  if (/accent/.test(r)) return "accent";
  if (/fond|background/.test(r)) return "background";
  if (/texte|text/.test(r)) return "text";
  return "";
}

/**
 * Directive de style dérivée du kit de marque, prête à être concaténée à un
 * prompt d'image. Chaîne vide si la marque n'a rien d'exploitable — l'appelant
 * ne doit alors rien ajouter plutôt qu'inventer une identité.
 */
export function brandPromptHints(kit: BrandKit | null | undefined): string {
  if (!kit) return "";
  const parts: string[] = [];

  // 1) Indications issues de l'analyse vision : la source la plus précise.
  if (kit.promptHints.trim()) parts.push(kit.promptHints.trim());

  // 2) Palette — d'abord les couleurs nommées de la charte (avec leur rôle),
  //    sinon la palette brute.
  const chartColors = (kit.chart?.palette ?? [])
    .filter((c) => c.hex)
    .slice(0, 5)
    .map((c) => {
      const role = roleInEnglish(c.role);
      return role ? `${c.hex} (${role})` : c.hex;
    });
  const colors = chartColors.length ? chartColors : kit.palette.filter(Boolean).slice(0, 5);
  if (colors.length) parts.push(`strictly use the brand color palette: ${colors.join(", ")}`);

  // 3) Style et ton : l'ambiance générale du visuel.
  if (kit.style.trim()) parts.push(`visual style: ${kit.style.trim()}`);
  if (kit.tone.trim()) parts.push(`mood: ${kit.tone.trim()}`);

  // 4) Direction photographique décidée dans la charte.
  if (kit.chart?.imagery?.trim()) parts.push(`imagery direction: ${kit.chart.imagery.trim()}`);

  // 5) Mots de ton — utiles quand ni style ni ton ne sont renseignés.
  const toneWords = (kit.chart?.toneWords ?? []).filter(Boolean).slice(0, 5);
  if (toneWords.length && !kit.tone.trim()) parts.push(`brand tone: ${toneWords.join(", ")}`);

  return parts.join(". ");
}

/** Vrai si la marque enregistrée porte assez d'informations pour calibrer un visuel. */
export function hasBrandIdentity(kit: BrandKit | null | undefined): boolean {
  return brandPromptHints(kit).length > 0;
}
