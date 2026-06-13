// ── Incrustation de logo sur un visuel (client) ──────────────────────────────
// Compose le logo de la marque par-dessus une image (coin au choix), exporte un
// PNG, l'envoie au stockage durable et l'enregistre dans la bibliothèque.
// Renvoie l'URL publique du visuel logoté. À n'appeler que côté client (canvas).

import { createClient } from "@/lib/supabase/client";

export type LogoCorner = "tl" | "tr" | "bl" | "br";

// Charge une image sans tainter le canvas (proxy même-origine pour le cross-origin).
function loadImage(src: string): Promise<HTMLImageElement> {
  const safe = src.startsWith("data:") || src.startsWith("blob:") ? src : `/api/proxy-image?url=${encodeURIComponent(src)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image illisible"));
    img.src = safe;
  });
}

/**
 * Incruste `logoUrl` sur `imageUrl` puis téléverse le résultat.
 * @returns URL publique du visuel logoté.
 */
export async function overlayLogoAndUpload(opts: {
  companyId: string;
  imageUrl: string;
  logoUrl: string;
  corner?: LogoCorner;
  /** Largeur du logo en fraction de la largeur de l'image (défaut 18 %). */
  scale?: number;
  source?: string;
}): Promise<string> {
  const { companyId, imageUrl, logoUrl, corner = "br", scale = 0.18, source = "logo-overlay" } = opts;

  const [base, logo] = await Promise.all([loadImage(imageUrl), loadImage(logoUrl)]);

  const W = base.naturalWidth || base.width;
  const H = base.naturalHeight || base.height;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");

  ctx.drawImage(base, 0, 0, W, H);

  const lw = W * scale;
  const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
  const m = W * 0.04; // marge
  const lx = corner.includes("l") ? m : W - lw - m;
  const ly = corner.includes("t") ? m : H - lh - m;

  // Léger halo pour la lisibilité du logo sur fonds variés.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = Math.max(4, W * 0.006);
  ctx.drawImage(logo, lx, ly, lw, lh);
  ctx.restore();

  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Export impossible (image protégée)."))), "image/png")
  );

  const sb = createClient();
  if (!sb) throw new Error("Stockage indisponible.");
  const path = `${companyId}/logo-overlay-${Date.now()}.png`;
  const { error } = await sb.storage.from("sh-videos").upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw new Error("Échec de l'envoi au stockage.");
  const { data } = sb.storage.from("sh-videos").getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error("URL publique indisponible.");

  // Enregistre dans la bibliothèque (non bloquant).
  fetch("/api/media", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, url, type: "image", source }),
  }).catch(() => {});

  return url;
}
