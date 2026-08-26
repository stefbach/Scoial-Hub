// Composition des calques sur un canevas.
//
// POURQUOI CE MODULE EXISTE
// L'aperçu et le fichier exporté doivent montrer la même chose. Tant que le
// dessin vivait dans le composant d'aperçu, l'export n'en reprenait qu'une
// partie : les textes étaient gravés, les incrustations d'image jamais — un
// logo se réglait à l'écran et disparaissait du fichier produit.
//
// Une seule implémentation, appelée des deux côtés, rend cette divergence
// impossible par construction.

import type { FontKey, ImageLayer, ShapeLayer, TextLayer } from "./project";

/**
 * Familles proposées à l'utilisateur.
 *
 * Chaque entrée est une PILE de polices largement disponibles, pas un fichier à
 * télécharger : c'est ce qui garantit que l'aperçu et le fichier exporté
 * s'accordent, sans faire dépendre le rendu d'un chargement réseau qui peut
 * échouer au pire moment. Le rendu serveur reçoit la même pile.
 */
export const FONT_STACKS: Record<FontKey, { label: string; stack: string }> = {
  sans: { label: "Sans", stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` },
  serif: { label: "Serif", stack: `Georgia, "Times New Roman", "Nimbus Roman", serif` },
  mono: { label: "Mono", stack: `ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace` },
  condensed: { label: "Étroite", stack: `"Arial Narrow", "Liberation Sans Narrow", "Helvetica Neue Condensed", sans-serif` },
  rounded: { label: "Arrondie", stack: `ui-rounded, "SF Pro Rounded", "Varela Round", "Trebuchet MS", sans-serif` },
  display: { label: "Titrage", stack: `Impact, "Haettenschweiler", "Arial Black", "DejaVu Sans", sans-serif` },
};

export function fontStack(key: FontKey | undefined): string {
  return FONT_STACKS[key ?? "sans"]?.stack ?? FONT_STACKS.sans.stack;
}

/**
 * Attend que les polices demandées soient utilisables par le canevas.
 *
 * Sans cette attente, `ctx.font` retombe silencieusement sur une police de
 * secours et le fichier exporté ne ressemble plus à l'aperçu — la divergence
 * la plus difficile à diagnostiquer, parce qu'elle ne produit aucune erreur.
 */
export async function ensureFontsReady(keys: (FontKey | undefined)[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const wanted = new Set(keys.map((k) => fontStack(k)));
  try {
    await Promise.all([...wanted].map((stack) => document.fonts.load(`700 64px ${stack}`)));
    await document.fonts.ready;
  } catch {
    // Une police indisponible ne doit pas faire échouer un export.
  }
}

/**
 * Découpe un texte pour qu'il tienne dans une largeur donnée.
 * `wrapPct` à 0 signifie « pas de retour à la ligne » : seuls les sauts de
 * ligne saisis comptent.
 */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  if (maxWidth <= 0) return paragraphs;
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Applique la rotation d'un calque autour de son centre, exécute le dessin,
 * puis rend le contexte tel qu'il était.
 */
function rotated(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  degrees: number,
  opacity: number,
  paint: () => void
): void {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * opacity;
  if (degrees) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    paint();
    ctx.restore();
  } else {
    paint();
  }
  ctx.globalAlpha = previous;
}

/**
 * Dessine les calques de texte visibles à un instant donné.
 * Les coordonnées sont des fractions du cadre : le même calque tient donc à
 * n'importe quelle définition de sortie.
 */
export function drawTexts(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  layers: TextLayer[]
): void {
  for (const o of layers) {
    const fontPx = Math.max(8, o.sizePct * H);
    ctx.font = `${o.bold ? "bold " : ""}${fontPx}px ${fontStack(o.font)}`;
    ctx.textBaseline = "top";
    ctx.textAlign = o.align;
    const lines = wrapLines(ctx, o.text, (o.wrapPct ?? 0) * W);
    const x = o.x * W;
    const y0 = o.y * H;
    let y = y0;
    const lineH = fontPx * (o.lineHeight || 1.25);
    const blockH = lineH * lines.length;
    const cx = o.align === "center" ? x : o.align === "right" ? x - ((o.wrapPct ?? 0.5) * W) / 2 : x + ((o.wrapPct || 0.5) * W) / 2;

    rotated(ctx, cx, y0 + blockH / 2, o.rotation ?? 0, o.opacity ?? 1, () => {
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (o.bg) {
        const bx = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(bx - fontPx * 0.15, y - fontPx * 0.08, w + fontPx * 0.3, lineH);
      }
      if (o.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = fontPx * 0.12;
        ctx.shadowOffsetY = fontPx * 0.04;
      }
      if (o.outline) {
        ctx.lineWidth = Math.max(1, fontPx * 0.06);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(line, x, y);
      }
      ctx.fillStyle = o.color;
      ctx.fillText(line, x, y);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      y += lineH;
    }
    });
  }
}

/**
 * Charge une image en vue du dessin. Renvoie `null` plutôt que de rejeter :
 * une incrustation introuvable ne doit pas faire échouer tout un export.
 *
 * `crossOrigin` est indispensable — sans lui, dessiner une image d'un autre
 * domaine SOUILLE le canevas et `toBlob` échoue, ce qui ferait perdre le rendu
 * entier pour un simple logo.
 */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Dessine les incrustations d'image visibles à un instant donné.
 * `scale` est une fraction de la LARGEUR du cadre ; la hauteur suit le rapport
 * natif de l'image, pour ne jamais la déformer.
 */
export function drawImages(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  layers: ImageLayer[],
  loaded: Map<string, HTMLImageElement>
): void {
  for (const l of layers) {
    const img = loaded.get(l.src);
    if (!img) continue;
    const w = l.scale * W;
    const ratio = img.naturalHeight > 0 ? img.naturalHeight / img.naturalWidth : 1;
    // Hauteur libre : réglée explicitement, ou déduite du rapport natif pour
    // ne jamais déformer l'image par accident.
    const h = l.heightPct > 0 ? l.heightPct * H : w * ratio;
    const x = l.x * W;
    const y = l.y * H;
    rotated(ctx, x + w / 2, y + h / 2, l.rotation ?? 0, l.opacity ?? 1, () => {
      ctx.drawImage(img, x, y, w, h);
    });
  }
}

/**
 * Dessine les formes vectorielles.
 * Elles sont composées ici — et non importées comme images préparées ailleurs —
 * ce qui les rend modifiables après coup : couleur, taille, rayon d'angle.
 */
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  layers: ShapeLayer[]
): void {
  for (const l of layers) {
    const x = l.x * W;
    const y = l.y * H;
    const w = l.w * W;
    const h = l.h * H;
    const stroke = l.strokeWidth * W;

    rotated(ctx, x + w / 2, y + h / 2, l.rotation ?? 0, l.opacity ?? 1, () => {
      ctx.fillStyle = l.fill;
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = stroke;

      if (l.shape === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (stroke > 0) ctx.stroke();
        return;
      }
      if (l.shape === "line") {
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineWidth = Math.max(1, h);
        ctx.strokeStyle = l.fill;
        ctx.stroke();
        return;
      }
      if (l.shape === "arrow") {
        const headW = Math.min(w * 0.3, h * 2.2);
        const shaftH = h * 0.35;
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2 - shaftH / 2);
        ctx.lineTo(x + w - headW, y + h / 2 - shaftH / 2);
        ctx.lineTo(x + w - headW, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w - headW, y + h);
        ctx.lineTo(x + w - headW, y + h / 2 + shaftH / 2);
        ctx.lineTo(x, y + h / 2 + shaftH / 2);
        ctx.closePath();
        ctx.fill();
        return;
      }

      const r = l.shape === "round" ? Math.min(l.radius * W, w / 2, h / 2) : 0;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();
      if (stroke > 0) ctx.stroke();
    });
  }
}
