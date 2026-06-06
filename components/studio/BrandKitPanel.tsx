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
import type { BrandKit } from "@/lib/brand-kit/types";

/** Source utilisable sur un <canvas> sans taint CORS. */
export function canvasSafeSrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export interface BrandKitPanelProps {
  companyId: string | undefined;
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
  textColor,
  onPickColor,
  onLogo,
  onPromptHints,
  onKit,
}: BrandKitPanelProps) {
  const t = useT();
  const { kit, save, uploadAsset } = useBrandKit(companyId);

  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [charteDataUrl, setCharteDataUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const hydrated = useRef(false);

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
    const dataUrl = await fileToDataUrl(file);
    setLogoDataUrl(dataUrl);
    onLogo?.(dataUrl); // aperçu immédiat
    const publicUrl = await uploadAsset(file, "logo");
    await save({ logoUrl: publicUrl || dataUrl });
    if (!publicUrl) setNote(t("Logo non persistant (stockage indisponible) — actif pour cette session.", "Logo not persisted (storage unavailable) — active this session."));
  }

  async function onCharteUpload(file: File | undefined) {
    if (!file) return;
    setNote(null);
    const dataUrl = await fileToDataUrl(file);
    setCharteDataUrl(dataUrl);
    const publicUrl = await uploadAsset(file, "charte");
    await save({ charteUrl: publicUrl || dataUrl });
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

  const k = kit;
  const hasAnalysis = !!k && (k.summary || k.palette.length > 0 || k.style || k.tone);

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="section-label">{t("Brand kit (IA)", "Brand kit (AI)")}</div>
        {k?.updatedAt && <span className="text-2xs text-success-600">{t("✓ enregistré", "✓ saved")}</span>}
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
      </div>

      {analyzing && <BusyHint label={t("L'IA analyse votre identité visuelle…", "The AI analyzes your visual identity…")} eta={t("~10–20 s", "~10–20 s")} />}

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

      {note && <p className="rounded-lg bg-warning-50 px-3 py-2 text-2xs text-warning-700">{note}</p>}
    </section>
  );
}
