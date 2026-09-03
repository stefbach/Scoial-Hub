// Modèles de composition calibrés sur l'identité de marque.
//
// POURQUOI CE MODULE EXISTE
// Poser un texte lisible sur une vidéo verticale n'est pas une affaire de goût :
// c'est une affaire de position, de contraste et de taille relative. Laissé à
// des réglages manuels, chaque publication repartait de zéro et la marque
// n'était reconnaissable nulle part.
//
// Un modèle décrit une INTENTION de composition (une accroche, un bandeau, une
// citation), pas des pixels. Les couleurs viennent du kit de marque, les tailles
// se mesurent en fraction de la LARGEUR du cadre — c'est elle qui borne le
// nombre de caractères par ligne, donc la lisibilité. Le même modèle tient
// ainsi en 9:16 comme en 16:9.
//
// Module PUR : ni réseau, ni DOM. Testé par npm run test:montageproj.

import {
  FORMAT_SIZE,
  addImageLayer,
  addSlot,
  addText,
  clamp,
  projectDuration,
  updateImageLayer,
  updateText,
  type EditorProject,
  type FontKey,
  type SlotRole as DocSlotRole,
  type TextLayer,
} from "./project";

/** Identité visuelle réduite à ce dont une composition a besoin. */
export interface BrandStyle {
  /** Palette de la marque, de la couleur la plus structurante à la plus accessoire. */
  palette: string[];
  /** Couleur de texte lisible sur la marque. */
  textColor: string;
  /** Logo à incruster, s'il existe. */
  logoUrl?: string;
  /** Police par défaut des nouveaux textes, déduite de la charte (P2-11). */
  font: FontKey;
}

/**
 * Rapproche un nom de police libre (déduit par l'IA depuis le logo, ex.
 * « Montserrat ») de la pile la plus proche parmi celles que l'éditeur sait
 * RÉELLEMENT rendre — jamais la police exacte : la charger depuis le réseau
 * ferait diverger l'aperçu et l'export (voir la note dans draw.ts). Un texte
 * neuf partait toujours en "sans" quelle que soit l'identité de la marque
 * (audit Editing Bench, P2-11) ; repli sur "sans" si rien ne correspond.
 */
export function fontFromBrandFont(name: string | null | undefined): FontKey {
  const n = (name ?? "").toLowerCase();
  if (!n) return "sans";
  if (/mono|code|courier|typewriter/.test(n)) return "mono";
  if (/serif|times|georgia|garamond|didot|playfair|caslon|baskerville/.test(n)) return "serif";
  if (/condensed|narrow|compress/.test(n)) return "condensed";
  if (/round|varela|quicksand|comfortaa|nunito/.test(n)) return "rounded";
  if (/display|impact|black|anton|oswald|bebas|headline/.test(n)) return "display";
  return "sans";
}

/** Couleur hexadécimale valide, sinon repli. */
function hex(v: string | undefined, fallback: string): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/**
 * Extrait l'identité utile d'un kit de marque, quel que soit son état de
 * remplissage. Un kit vide ne bloque rien : les modèles restent utilisables
 * en blanc sur fond sombre, qui est le réglage lisible par défaut.
 */
export function brandStyleFrom(kit: {
  palette?: string[];
  recommendedTextColor?: string;
  logoUrl?: string;
  chart?: { headingFont?: string; bodyFont?: string } | null;
} | null | undefined): BrandStyle {
  const palette = (kit?.palette ?? []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  return {
    palette,
    textColor: hex(kit?.recommendedTextColor, "#ffffff"),
    logoUrl: kit?.logoUrl || undefined,
    font: fontFromBrandFont(kit?.chart?.headingFont || kit?.chart?.bodyFont),
  };
}

type SlotRole = "title" | "subtitle" | "caption" | "cta";

interface Slot {
  role: SlotRole;
  /** Texte d'amorce — remplaçable immédiatement. */
  fr: string;
  en: string;
  x: number;
  y: number;
  /** Taille en fraction de la LARGEUR du cadre. */
  sizeW: number;
  align: TextLayer["align"];
  bold: boolean;
  bg: boolean;
  outline: boolean;
  shadow: boolean;
  /** Rang dans la palette de marque ; -1 = couleur de texte recommandée. */
  colorRank: number;
  /** Bornes d'apparition, en fraction du film. `null` = tout le film. */
  window: [number, number] | null;
}

export interface EditorTemplate {
  key: string;
  label: { fr: string; en: string };
  hint: { fr: string; en: string };
  slots: Slot[];
  /** Incruste le logo de la marque, s'il est connu. */
  logo: boolean;
}

/**
 * Les cinq compositions qui couvrent l'essentiel d'une publication sociale.
 * Volontairement peu nombreuses : un catalogue pléthorique déplace le travail
 * au lieu de le supprimer.
 */
export const TEMPLATES: EditorTemplate[] = [
  {
    key: "hook",
    label: { fr: "Accroche", en: "Hook" },
    hint: { fr: "Titre fort sur les premières secondes", en: "Strong title over the opening seconds" },
    logo: false,
    slots: [
      {
        role: "title", fr: "Votre accroche", en: "Your hook",
        x: 0.5, y: 0.12, sizeW: 0.1, align: "center",
        bold: true, bg: true, outline: false, shadow: true, colorRank: -1,
        // Une accroche se joue dans les trois premières secondes : au-delà,
        // le spectateur a déjà décidé s'il restait.
        window: [0, 0.25],
      },
    ],
  },
  {
    key: "lower-third",
    label: { fr: "Bandeau bas", en: "Lower third" },
    hint: { fr: "Nom et fonction, sans masquer l'image", en: "Name and role, without hiding the image" },
    logo: true,
    slots: [
      {
        role: "caption", fr: "Prénom Nom", en: "First Last",
        x: 0.06, y: 0.76, sizeW: 0.062, align: "left",
        bold: true, bg: true, outline: false, shadow: false, colorRank: -1,
        window: [0.05, 0.4],
      },
      {
        role: "subtitle", fr: "Fonction", en: "Role",
        x: 0.06, y: 0.83, sizeW: 0.042, align: "left",
        bold: false, bg: true, outline: false, shadow: false, colorRank: -1,
        window: [0.05, 0.4],
      },
    ],
  },
  {
    key: "quote",
    label: { fr: "Citation", en: "Quote" },
    hint: { fr: "Texte centré, lisible sur fond chargé", en: "Centred text, readable over busy footage" },
    logo: false,
    slots: [
      {
        role: "title", fr: "« Votre citation »", en: "“Your quote”",
        x: 0.5, y: 0.42, sizeW: 0.085, align: "center",
        // Contour ET ombre : c'est ce qui tient sur une image dont on ne
        // maîtrise pas le fond.
        bold: true, bg: false, outline: true, shadow: true, colorRank: -1,
        window: null,
      },
    ],
  },
  {
    key: "cta",
    label: { fr: "Appel à l'action", en: "Call to action" },
    hint: { fr: "Pastille de marque en fin de film", en: "Brand badge at the end of the film" },
    logo: true,
    slots: [
      {
        role: "cta", fr: "En savoir plus", en: "Learn more",
        x: 0.5, y: 0.86, sizeW: 0.058, align: "center",
        bold: true, bg: true, outline: false, shadow: false, colorRank: 0,
        // Un appel à l'action arrive quand la démonstration est faite.
        window: [0.6, 1],
      },
    ],
  },
  {
    key: "title-card",
    label: { fr: "Carton titre", en: "Title card" },
    hint: { fr: "Titre et sous-titre au centre", en: "Title and subtitle, centred" },
    logo: true,
    slots: [
      {
        role: "title", fr: "Votre titre", en: "Your title",
        x: 0.5, y: 0.36, sizeW: 0.1, align: "center",
        bold: true, bg: false, outline: false, shadow: true, colorRank: -1,
        window: [0, 0.35],
      },
      {
        role: "subtitle", fr: "Votre sous-titre", en: "Your subtitle",
        x: 0.5, y: 0.47, sizeW: 0.05, align: "center",
        bold: false, bg: false, outline: false, shadow: true, colorRank: 1,
        window: [0, 0.35],
      },
    ],
  },
];

/** Borne haute de la taille de police, alignée sur le réglage de l'interface. */
const MAX_SIZE_PCT = 0.2;
const MIN_SIZE_PCT = 0.03;

/**
 * Convertit une taille exprimée en fraction de largeur vers la fraction de
 * hauteur attendue par le calque. C'est ce qui rend un modèle transposable
 * d'un format à l'autre sans le réécrire.
 */
export function sizePctFor(sizeW: number, format: EditorProject["format"]): number {
  const { width, height } = FORMAT_SIZE[format];
  return clamp(Number(((sizeW * width) / height).toFixed(4)), MIN_SIZE_PCT, MAX_SIZE_PCT);
}

function colorFor(slot: Slot, brand: BrandStyle): string {
  if (slot.colorRank < 0) return brand.textColor;
  return brand.palette[slot.colorRank] ?? brand.textColor;
}

/** Description humaine d'un rôle d'emplacement, pour l'inviter à le remplir. */
const ROLE_LABEL: Record<SlotRole, { fr: string; en: string }> = {
  title: { fr: "Titre", en: "Title" },
  subtitle: { fr: "Sous-titre", en: "Subtitle" },
  caption: { fr: "Légende", en: "Caption" },
  cta: { fr: "Appel à l'action", en: "Call to action" },
};

/**
 * Applique un modèle au projet : les calques sont AJOUTÉS, jamais substitués.
 * L'opération reste donc annulable comme n'importe quelle autre, et un montage
 * en cours n'est pas effacé par une hésitation sur le modèle.
 */
export function applyTemplate(
  p: EditorProject,
  key: string,
  brand: BrandStyle,
  idFor: (prefix: string) => string,
  lang: "fr" | "en" = "fr"
): EditorProject {
  const tpl = TEMPLATES.find((x) => x.key === key);
  if (!tpl) return p;

  const total = projectDuration(p);
  let next = p;

  for (const slot of tpl.slots) {
    const id = idFor("t");
    next = addText(next, id, lang === "en" ? slot.en : slot.fr);
    const [from, to] = slot.window ?? [0, 1];
    next = updateText(next, id, {
      x: slot.x,
      y: slot.y,
      sizePct: sizePctFor(slot.sizeW, next.format),
      color: colorFor(slot, brand),
      bold: slot.bold,
      bg: slot.bg,
      align: slot.align,
      outline: slot.outline,
      shadow: slot.shadow,
      start: total * from,
      // Une borne de fin nulle serait relue comme « tout le film » : sur un
      // projet encore vide, on laisse `normalize` trancher.
      end: total > 0 ? total * to : 0,
    });
    // Le texte posé est une amorce, pas le message final : un emplacement le
    // signale jusqu'à ce que `fillSlot` (ou une édition suivie d'un appel à
    // `fillSlot` côté interface) enregistre le vrai contenu.
    next = addSlot(next, {
      id: idFor("s"),
      role: slot.role as DocSlotRole,
      label: (lang === "en" ? ROLE_LABEL[slot.role].en : ROLE_LABEL[slot.role].fr),
      required: true,
      targetKind: "text",
      targetId: id,
      filled: false,
    });
  }

  if (tpl.logo && brand.logoUrl) {
    const id = idFor("i");
    next = addImageLayer(next, id, brand.logoUrl);
    next = updateImageLayer(next, id, { x: 0.78, y: 0.05, scale: 0.16, opacity: 0.9 });
  }

  return next;
}

/**
 * Recale les textes déjà posés sur les couleurs de la marque, sans toucher au
 * placement ni au minutage. Sert quand la charte évolue après le montage.
 */
export function recolorToBrand(p: EditorProject, brand: BrandStyle): EditorProject {
  let next = p;
  for (const layer of p.texts) {
    next = updateText(next, layer.id, { color: brand.textColor });
  }
  return next;
}

/**
 * Retranspose les tailles de texte après un changement de format. Un titre
 * réglé en 9:16 devenait minuscule en 16:9 : la fraction de hauteur ne veut
 * plus dire la même chose d'un cadre à l'autre.
 */
export function rescaleTextsForFormat(
  p: EditorProject,
  previous: EditorProject["format"]
): EditorProject {
  if (previous === p.format) return p;
  const before = FORMAT_SIZE[previous];
  const after = FORMAT_SIZE[p.format];
  // On conserve la taille RELATIVE À LA LARGEUR, seule mesure stable.
  const factor = (before.height / before.width) * (after.width / after.height);
  let next = p;
  for (const layer of p.texts) {
    next = updateText(next, layer.id, {
      sizePct: clamp(Number((layer.sizePct * factor).toFixed(4)), MIN_SIZE_PCT, MAX_SIZE_PCT),
    });
  }
  return next;
}
