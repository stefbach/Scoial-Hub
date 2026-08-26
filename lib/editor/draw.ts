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

import type { ImageLayer, TextLayer } from "./project";

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
    ctx.font = `${o.bold ? "bold " : ""}${fontPx}px sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = o.align;
    const lines = o.text.split("\n");
    const x = o.x * W;
    let y = o.y * H;
    const lineH = fontPx * 1.25;
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
    const h = w * ratio;
    const previous = ctx.globalAlpha;
    ctx.globalAlpha = l.opacity;
    ctx.drawImage(img, l.x * W, l.y * H, w, h);
    ctx.globalAlpha = previous;
  }
}
