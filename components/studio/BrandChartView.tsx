"use client";

// Affiche une charte graphique structuree (palette, typo, ton, regles, do/don't,
// baseline) et permet de l'exporter en PNG A4 (rendu canvas).

import { useT } from "@/lib/i18n";
import type { BrandChart } from "@/lib/brand-kit/types";

function canvasSafe(url: string): string {
  if (!url) return "";
  return url.startsWith("data:") ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export default function BrandChartView({
  chart,
  logoSrc,
  brandName,
}: {
  chart: BrandChart;
  logoSrc?: string;
  brandName: string;
}) {
  const t = useT();

  async function exportPng() {
    const W = 1240, H = 1754;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pad = 80;
    const ink = "#0f172a", muted = "#64748b", hair = "#e2e8f0";

    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

    // En-tete
    ctx.fillStyle = ink;
    ctx.font = "700 46px Manrope, system-ui, sans-serif";
    ctx.fillText(t("Charte graphique", "Brand guidelines"), pad, pad + 30);
    ctx.fillStyle = muted;
    ctx.font = "500 26px Manrope, system-ui, sans-serif";
    ctx.fillText(brandName || "", pad, pad + 70);

    if (logoSrc) {
      try {
        const img = await loadImage(canvasSafe(logoSrc));
        const lw = 180, lh = (img.height / img.width) * lw;
        ctx.drawImage(img, W - pad - lw, pad - 10, lw, Math.min(lh, 120));
      } catch { /* logo optionnel */ }
    }

    let y = pad + 130;
    const section = (label: string) => {
      ctx.fillStyle = ink;
      ctx.font = "700 30px Manrope, system-ui, sans-serif";
      ctx.fillText(label, pad, y);
      y += 16;
      ctx.strokeStyle = hair; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      y += 40;
    };
    const para = (text: string, color = muted, size = 24) => {
      if (!text) return;
      ctx.fillStyle = color;
      ctx.font = `400 ${size}px Manrope, system-ui, sans-serif`;
      for (const ln of wrap(ctx, text, W - pad * 2)) { ctx.fillText(ln, pad, y); y += size * 1.35; }
      y += 8;
    };
    const bullets = (items: string[], mark = "•", color = ink) => {
      ctx.font = "400 23px Manrope, system-ui, sans-serif";
      for (const it of items) {
        const lines = wrap(ctx, it, W - pad * 2 - 30);
        ctx.fillStyle = color; ctx.fillText(mark, pad, y);
        ctx.fillStyle = "#334155";
        lines.forEach((ln, i) => { ctx.fillText(ln, pad + 30, y); if (i < lines.length - 1) y += 30; });
        y += 36;
      }
      y += 6;
    };

    // Palette
    section(t("Palette", "Palette"));
    const sw = 150, gap = 18; let x = pad;
    for (const c of chart.palette) {
      if (x + sw > W - pad) { x = pad; y += 150; }
      ctx.fillStyle = c.hex; ctx.strokeStyle = hair;
      ctx.fillRect(x, y, sw, 90); ctx.strokeRect(x, y, sw, 90);
      ctx.fillStyle = ink; ctx.font = "600 20px Manrope, system-ui, sans-serif";
      ctx.fillText(c.hex.toUpperCase(), x, y + 116);
      ctx.fillStyle = muted; ctx.font = "400 18px Manrope, system-ui, sans-serif";
      ctx.fillText(`${c.name || ""}${c.role ? " · " + c.role : ""}`.slice(0, 22), x, y + 140);
      x += sw + gap;
    }
    y += 175;

    // Typographie
    section(t("Typographie", "Typography"));
    ctx.fillStyle = ink; ctx.font = "700 30px Manrope, system-ui, sans-serif";
    ctx.fillText(`${t("Titres", "Headings")} : ${chart.headingFont}`, pad, y); y += 44;
    ctx.fillText(`${t("Texte", "Body")} : ${chart.bodyFont}`, pad, y); y += 44;
    para(chart.typographyNote);

    // Ton & voix
    section(t("Ton & voix", "Tone & voice"));
    if (chart.toneWords.length) para(chart.toneWords.join(" · "), ink, 26);
    para(chart.voice);

    // Usage du logo
    if (chart.logoUsage.length) { section(t("Usage du logo", "Logo usage")); bullets(chart.logoUsage); }

    // Do / Don't
    if (chart.dos.length || chart.donts.length) {
      section(t("Bonnes pratiques", "Best practices"));
      ctx.fillStyle = "#16a34a"; bullets(chart.dos, "✓", "#16a34a");
      ctx.fillStyle = "#dc2626"; bullets(chart.donts, "✗", "#dc2626");
    }

    // Imagerie + baseline
    if (chart.imagery) { section(t("Imagerie", "Imagery")); para(chart.imagery); }
    if (chart.tagline) {
      ctx.fillStyle = "#5b2d8e"; ctx.font = "italic 700 30px Manrope, system-ui, sans-serif";
      for (const ln of wrap(ctx, `« ${chart.tagline} »`, W - pad * 2)) { ctx.fillText(ln, pad, y); y += 42; }
    }

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `charte-${(brandName || "marque").replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="rounded-lg border border-hair bg-card p-4 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{t("Charte graphique", "Brand guidelines")}</span>
        <button onClick={exportPng} className="btn-secondary text-2xs">⬇︎ {t("Télécharger (PNG A4)", "Download (A4 PNG)")}</button>
      </div>

      {chart.palette.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Palette", "Palette")}</div>
          <div className="flex flex-wrap gap-2">
            {chart.palette.map((c) => (
              <div key={c.hex} className="w-20">
                <div className="h-10 w-full rounded-md ring-1 ring-hair" style={{ backgroundColor: c.hex }} />
                <div className="mt-1 font-mono text-[10px] text-ink">{c.hex.toUpperCase()}</div>
                <div className="text-[10px] leading-tight text-muted">{c.name}{c.role ? ` · ${c.role}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(chart.headingFont || chart.bodyFont) && (
        <div className="mb-3">
          <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Typographie", "Typography")}</div>
          <p className="text-ink"><span className="font-semibold">{t("Titres", "Headings")}</span> : {chart.headingFont} · <span className="font-semibold">{t("Texte", "Body")}</span> : {chart.bodyFont}</p>
          {chart.typographyNote && <p className="text-muted">{chart.typographyNote}</p>}
        </div>
      )}

      {(chart.toneWords.length > 0 || chart.voice) && (
        <div className="mb-3">
          <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Ton & voix", "Tone & voice")}</div>
          {chart.toneWords.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {chart.toneWords.map((w) => <span key={w} className="chip text-2xs">{w}</span>)}
            </div>
          )}
          {chart.voice && <p className="text-muted">{chart.voice}</p>}
        </div>
      )}

      {chart.logoUsage.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Usage du logo", "Logo usage")}</div>
          <ul className="space-y-0.5 text-ink">{chart.logoUsage.map((u, i) => <li key={i} className="flex gap-1.5"><span className="text-primary">›</span>{u}</li>)}</ul>
        </div>
      )}

      {(chart.dos.length > 0 || chart.donts.length > 0) && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-success-700">{t("À faire", "Do")}</div>
            <ul className="space-y-0.5 text-ink">{chart.dos.map((d, i) => <li key={i} className="flex gap-1.5"><span className="text-success-600">✓</span>{d}</li>)}</ul>
          </div>
          <div>
            <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-danger-600">{t("À éviter", "Don't")}</div>
            <ul className="space-y-0.5 text-ink">{chart.donts.map((d, i) => <li key={i} className="flex gap-1.5"><span className="text-danger-600">✗</span>{d}</li>)}</ul>
          </div>
        </div>
      )}

      {chart.imagery && (
        <div className="mb-3">
          <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{t("Imagerie", "Imagery")}</div>
          <p className="text-muted">{chart.imagery}</p>
        </div>
      )}

      {chart.tagline && <p className="text-center text-sm font-semibold italic text-primary-700">« {chart.tagline} »</p>}
    </div>
  );
}
