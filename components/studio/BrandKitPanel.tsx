"use client";

// Panneau « Brand kit » réutilisable (Studio Affiches, Studio Vidéo, Composer).
// • importe logo + charte graphique (téléversés dans Supabase Storage, persistés)
// • analyse l'identité visuelle par l'IA (palette, couleur de texte, style, ton)
// • enregistre le tout par société → réutilisé partout
// • notifie le parent : couleur de texte, logo (source canvas-safe), promptHints.

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { useBrandKit } from "@/lib/brand-kit/use-brand-kit";
import BrandChartView from "@/components/studio/BrandChartView";
import { SafeBoundary } from "@/components/ui/SafeBoundary";
import type { BrandKit } from "@/lib/brand-kit/types";

/** Source utilisable sur un <canvas> sans taint CORS. */
export function canvasSafeSrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * Rasterise n'importe quelle image (y compris SVG, souvent fourni pour les logos)
 * en PNG via <canvas>. Garantit : un format lisible par l'IA vision (png/jpeg/…),
 * la transparence préservée, et une taille raisonnable. Retourne data URL + blob.
 */
async function rasterizeToPng(file: File): Promise<{ dataUrl: string; blob: Blob; name: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = objectUrl;
    });
    const isSvg = (file.type || "").includes("svg") || /\.svg$/i.test(file.name);
    let w = img.naturalWidth || 0;
    let h = img.naturalHeight || 0;
    if (!w || !h) { w = 512; h = 512; } // SVG sans dimensions intrinsèques
    // SVG : rend net à ~512 px ; raster : plafonne à 1024 px (poids/coût IA).
    const target = isSvg ? 512 : Math.min(1024, Math.max(w, h));
    const scale = target / Math.max(w, h);
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponible");
    ctx.drawImage(img, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/png");
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png")
    );
    const name = file.name.replace(/\.[^.]+$/, "") + ".png";
    return { dataUrl, blob, name };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface BrandKitPanelProps {
  companyId: string | undefined;
  /** Nom de marque (titre de la charte générée). */
  brandName?: string;
  /** Couleur de texte courante (pour surligner la pastille sélectionnée). */
  textColor?: string;
  /** Sélection d'une couleur (palette / couleur recommandée). */
  onPickColor?: (hex: string) => void;
  /** Source du logo prête pour le canvas (data URL ou proxy). "" si retiré. */
  onLogo?: (src: string) => void;
  /** Indications de style IA à injecter dans les prompts d'image. */
  onPromptHints?: (hints: string) => void;
  /** Kit complet (à chaque changement) — pour usages avancés. */
  onKit?: (kit: BrandKit) => void;
}

export default function BrandKitPanel({
  companyId,
  brandName,
  textColor,
  onPickColor,
  onLogo,
  onPromptHints,
  onKit,
}: BrandKitPanelProps) {
  const t = useT();
  const { kit, save, reset, uploadAsset } = useBrandKit(companyId);

  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [charteDataUrl, setCharteDataUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingChart, setGeneratingChart] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Remise à zéro complète du brand kit (rien n'est figé).
  async function resetKit() {
    if (resetting) return;
    if (typeof window !== "undefined" && !window.confirm(
      t("Réinitialiser le brand kit ? Logo, charte et analyse seront effacés.",
        "Reset the brand kit? Logo, chart and analysis will be cleared.")
    )) return;
    setResetting(true);
    setNote(null);
    try {
      const updated = await reset();
      setLogoDataUrl("");
      setCharteDataUrl("");
      onLogo?.("");
      onPromptHints?.("");
      if (updated) onKit?.(updated);
    } finally {
      setResetting(false);
    }
  }

  // Hydrate depuis le kit persistant (une seule fois) → prévient le parent.
  useEffect(() => {
    if (hydrated.current || !kit) return;
    if (!kit.logoUrl && !kit.summary && kit.palette.length === 0) return;
    hydrated.current = true;
    if (kit.logoUrl) onLogo?.(canvasSafeSrc(kit.logoUrl));
    if (kit.promptHints) onPromptHints?.(kit.promptHints);
    if (kit.recommendedTextColor) onPickColor?.(kit.recommendedTextColor);
    onKit?.(kit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit]);

  async function onLogoUpload(file: File | undefined) {
    if (!file) return;
    setNote(null);
    try {
      const { dataUrl, blob, name } = await rasterizeToPng(file);
      setLogoDataUrl(dataUrl);
      onLogo?.(dataUrl); // aperçu immédiat
      const publicUrl = await uploadAsset(blob, "logo", name);
      // Ne persiste l'image que si elle est hébergée (URL https) : on évite de
      // stocker un énorme data URL en base — l'aperçu reste actif en session.
      const updated = await save({ logoUrl: publicUrl || "" });
      if (updated) onKit?.(updated);
      if (!publicUrl) setNote(t("Logo actif pour cette session (échec de l'enregistrement permanent).", "Logo active this session (permanent save failed)."));
    } catch {
      setNote(t("Logo illisible — essayez un PNG ou un JPG.", "Unreadable logo — try a PNG or JPG."));
    }
  }

  async function onCharteUpload(file: File | undefined) {
    if (!file) return;
    setNote(null);
    try {
      const { dataUrl, blob, name } = await rasterizeToPng(file);
      setCharteDataUrl(dataUrl);
      const publicUrl = await uploadAsset(blob, "charte", name);
      await save({ charteUrl: publicUrl || "" });
    } catch {
      setNote(t("Charte illisible — essayez un PNG ou un JPG.", "Unreadable chart — try a PNG or JPG."));
    }
  }

  async function analyze() {
    const imageDataUrl = charteDataUrl || logoDataUrl;
    if (!imageDataUrl) {
      setNote(t("Importez d'abord un logo ou une charte.", "Upload a logo or brand chart first."));
      return;
    }
    if (!companyId) return;
    setAnalyzing(true);
    setNote(null);
    try {
      const r = await fetch("/api/ai/analyze-brand-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, imageDataUrl, kind: charteDataUrl ? "charte" : "logo" }),
      });
      const d = await r.json();
      if (!r.ok) {
        setNote(d.error || t("Échec de l'analyse.", "Analysis failed."));
        return;
      }
      const v = d.visual as Partial<BrandKit> | undefined;
      if (v) {
        if (v.recommendedTextColor) onPickColor?.(v.recommendedTextColor);
        if (v.promptHints) onPromptHints?.(v.promptHints);
        // Persiste l'analyse dans le brand kit.
        const updated = await save({
          palette: v.palette ?? [],
          recommendedTextColor: v.recommendedTextColor ?? "#ffffff",
          style: v.style ?? "",
          tone: v.tone ?? "",
          promptHints: v.promptHints ?? "",
          summary: v.summary ?? "",
          aiGenerated: Boolean(v.aiGenerated),
        });
        if (updated) onKit?.(updated);
        if (v.aiGenerated === false) setNote(t("Analyse IA non configurée — palette à choisir manuellement.", "AI analysis not configured — pick colors manually."));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("Échec de l'analyse.", "Analysis failed."));
    } finally {
      setAnalyzing(false);
    }
  }

  // Génère une charte graphique complète À PARTIR DU LOGO (palette, typo, ton,
  // règles d'usage, do/don't, baseline), puis la mémorise dans le brand kit.
  async function generateChart() {
    if (!companyId) return;
    const hasLogo = logoDataUrl || (kit?.logoUrl && /^https?:\/\//.test(kit.logoUrl));
    if (!hasLogo) {
      setNote(t("Importez d'abord un logo pour générer la charte.", "Upload a logo first to generate the chart."));
      return;
    }
    setGeneratingChart(true);
    setNote(null);
    try {
      const r = await fetch("/api/ai/generate-brand-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, imageDataUrl: logoDataUrl || undefined, logoUrl: kit?.logoUrl || undefined }),
      });
      const d = await r.json();
      if (!r.ok) {
        setNote(d.error || t("Échec de la génération.", "Generation failed."));
        return;
      }
      if (d.chart) {
        const updated = await save({ chart: d.chart });
        if (updated) onKit?.(updated);
        if (d.chart.aiGenerated === false) setNote(t("Charte indisponible (IA non configurée).", "Chart unavailable (AI not configured)."));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("Échec de la génération.", "Generation failed."));
    } finally {
      setGeneratingChart(false);
    }
  }

  const k = kit;
  const hasAnalysis = !!k && (k.summary || k.palette.length > 0 || k.style || k.tone);
  const canChart = !!(logoDataUrl || (k?.logoUrl && /^https?:\/\//.test(k.logoUrl)));

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="section-label">{t("Brand kit (IA)", "Brand kit (AI)")}</div>
        <div className="flex items-center gap-2">
          {k?.updatedAt && <span className="text-2xs text-success-600">{t("✓ enregistré", "✓ saved")}</span>}
          {(k?.logoUrl || k?.charteUrl || hasAnalysis || k?.chart) && (
            <button onClick={resetKit} disabled={resetting} className="btn-ghost text-2xs text-muted" title={t("Tout remettre à zéro", "Reset everything")}>
              {resetting ? t("…", "…") : t("↺ Réinitialiser", "↺ Reset")}
            </button>
          )}
        </div>
      </div>
      <p className="text-2xs text-muted">
        {t("Importez le logo et la charte graphique : l'IA en extrait la palette, le style et le ton — mémorisés pour cette marque et réutilisés partout.", "Upload the logo and brand chart: the AI extracts the palette, style and tone — saved for this brand and reused everywhere.")}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-secondary cursor-pointer text-xs">
          {k?.logoUrl || logoDataUrl ? t("Changer le logo", "Change logo") : t("📁 Logo", "📁 Logo")}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogoUpload(e.target.files?.[0])} />
        </label>
        <label className="btn-secondary cursor-pointer text-xs">
          {k?.charteUrl || charteDataUrl ? t("Changer la charte", "Change chart") : t("📁 Charte", "📁 Chart")}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onCharteUpload(e.target.files?.[0])} />
        </label>
        <button onClick={analyze} disabled={analyzing || (!charteDataUrl && !logoDataUrl)} className="btn-primary text-xs disabled:opacity-50">
          {analyzing ? <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-white" />{t("Analyse…", "Analyzing…")}</span> : t("🔎 Analyser la marque", "🔎 Analyze brand")}
        </button>
        <button onClick={generateChart} disabled={generatingChart || !canChart} title={!canChart ? t("Importez un logo d'abord", "Upload a logo first") : undefined} className="btn-secondary text-xs disabled:opacity-50">
          {generatingChart ? <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-primary-600" />{t("Charte…", "Chart…")}</span> : t("📐 Générer la charte (IA)", "📐 Generate chart (AI)")}
        </button>
      </div>

      {analyzing && <BusyHint label={t("L'IA analyse votre identité visuelle…", "The AI analyzes your visual identity…")} eta={t("~10–20 s", "~10–20 s")} />}
      {generatingChart && <BusyHint label={t("L'IA construit votre charte graphique…", "The AI is building your brand guidelines…")} eta={t("~15–30 s", "~15–30 s")} />}

      {hasAnalysis && k && (
        <div className="rounded-lg border border-hair bg-canvas p-3 text-xs">
          {k.summary && <p className="text-ink">{k.summary}</p>}
          {(k.style || k.tone) && (
            <p className="mt-1 text-2xs text-muted">
              {k.style && <>{t("Style", "Style")} : <span className="text-ink">{k.style}</span></>}
              {k.style && k.tone && " · "}
              {k.tone && <>{t("Ton", "Tone")} : <span className="text-ink">{k.tone}</span></>}
            </p>
          )}
          {k.palette.length > 0 && (
            <div className="mt-2">
              <span className="text-2xs text-muted">{t("Palette (clic = couleur du texte)", "Palette (click = text color)")}</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {k.palette.map((c) => (
                  <button key={c} onClick={() => onPickColor?.(c)} title={c}
                    className={`h-7 w-7 rounded-md ring-2 ${textColor === c ? "ring-ink" : "ring-hair"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          )}
          {k.promptHints && (
            <p className="mt-2 text-2xs text-ai-text">{t("✓ Style de marque injecté dans la génération.", "✓ Brand style injected into generation.")}</p>
          )}
        </div>
      )}

      {k?.chart && Array.isArray(k.chart.palette) && k.chart.palette.length > 0 && (
        <SafeBoundary label="BrandChartView">
          <BrandChartView chart={k.chart} logoSrc={k.logoUrl || logoDataUrl} brandName={brandName ?? ""} />
        </SafeBoundary>
      )}

      {note && <p className="rounded-lg bg-warning-50 px-3 py-2 text-2xs text-warning-700">{note}</p>}
    </section>
  );
}
