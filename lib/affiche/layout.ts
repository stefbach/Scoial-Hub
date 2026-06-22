// ── Géométrie & formats du Studio Affiche (logique pure, testable) ────────────
// Extrait du composant pour pouvoir VÉRIFIER, sans navigateur, que :
//  • chaque format décliné a les bonnes dimensions,
//  • le mode « fit » (déclinaison) n'a JAMAIS de recadrage (image entière visible),
//  • le mode « cover » remplit bien le cadre.

export type FormatGroup = "print" | "universel" | "instagram" | "facebook" | "linkedin";
export interface Format { id: string; label: string; w: number; h: number; print?: boolean; ar: string; group: FormatGroup; }

// Libellés des groupes de formats (impression + un set par réseau).
export const GROUPS: { id: FormatGroup; fr: string; en: string }[] = [
  { id: "universel", fr: "Universel", en: "Universal" },
  { id: "instagram", fr: "Instagram", en: "Instagram" },
  { id: "facebook", fr: "Facebook", en: "Facebook" },
  { id: "linkedin", fr: "LinkedIn", en: "LinkedIn" },
  { id: "print", fr: "Impression", en: "Print" },
];

// Dimensions print à ~150 dpi ; réseaux en px standard de chaque plateforme.
export const FORMATS: Format[] = [
  // Universel (formats génériques)
  { id: "sq", label: "Carré 1:1", w: 1080, h: 1080, ar: "1:1", group: "universel" },
  { id: "story", label: "Story 9:16", w: 1080, h: 1920, ar: "9:16", group: "universel" },
  { id: "portrait", label: "Portrait 4:5", w: 1080, h: 1350, ar: "4:5", group: "universel" },
  { id: "wide", label: "Paysage 16:9", w: 1920, h: 1080, ar: "16:9", group: "universel" },
  // Instagram
  { id: "ig-pt", label: "IG portrait 4:5", w: 1080, h: 1350, ar: "4:5", group: "instagram" },
  { id: "ig-sq", label: "IG carré 1:1", w: 1080, h: 1080, ar: "1:1", group: "instagram" },
  { id: "ig-story", label: "IG story / Reel 9:16", w: 1080, h: 1920, ar: "9:16", group: "instagram" },
  // Facebook
  { id: "fb-feed", label: "FB fil 4:5", w: 1080, h: 1350, ar: "4:5", group: "facebook" },
  { id: "fb-land", label: "FB lien / paysage", w: 1200, h: 630, ar: "16:9", group: "facebook" },
  { id: "fb-story", label: "FB story 9:16", w: 1080, h: 1920, ar: "9:16", group: "facebook" },
  // LinkedIn
  { id: "li-land", label: "LinkedIn paysage", w: 1200, h: 627, ar: "16:9", group: "linkedin" },
  { id: "li-sq", label: "LinkedIn carré 1:1", w: 1080, h: 1080, ar: "1:1", group: "linkedin" },
  { id: "li-pt", label: "LinkedIn portrait 4:5", w: 1080, h: 1350, ar: "4:5", group: "linkedin" },
  // Impression
  { id: "a4p", label: "A4 portrait", w: 1240, h: 1754, print: true, ar: "4:5", group: "print" },
  { id: "a4l", label: "A4 paysage", w: 1754, h: 1240, print: true, ar: "16:9", group: "print" },
  { id: "a3p", label: "A3 portrait", w: 1754, h: 2480, print: true, ar: "4:5", group: "print" },
  { id: "a3l", label: "A3 paysage", w: 2480, h: 1754, print: true, ar: "16:9", group: "print" },
];

// Jeu de formats réseaux décliné « en un clic » (un par forme utile et par réseau).
export const SOCIAL_DECLINE_IDS = ["ig-pt", "ig-sq", "ig-story", "fb-feed", "fb-land", "fb-story", "li-land", "li-sq", "li-pt"];
export const DECLINE_SET = FORMATS.filter((f) => SOCIAL_DECLINE_IDS.includes(f.id));

export interface Rect { dx: number; dy: number; dw: number; dh: number; }

/** Remplit le cadre W×H (recadre si nécessaire). `scale` > 1 zoome légèrement. */
export function coverRect(iw: number, ih: number, W: number, H: number, scale = 1): Rect {
  const ir = iw / ih, fr = W / H;
  let dw: number, dh: number;
  if (ir > fr) { dh = H * scale; dw = dh * ir; }
  else { dw = W * scale; dh = dw / ir; }
  return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}

/** Affiche l'image ENTIÈRE dans W×H (aucun recadrage ; bandes éventuelles). */
export function containRect(iw: number, ih: number, W: number, H: number): Rect {
  const ir = iw / ih, fr = W / H;
  let dw: number, dh: number;
  if (ir > fr) { dw = W; dh = W / ir; } else { dh = H; dw = H * ir; }
  return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}
