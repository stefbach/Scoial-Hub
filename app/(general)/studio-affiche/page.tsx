"use client";

// Studio Affiches & Visuels — un vrai studio piloté par IA, AÉRÉ :
// • formats print (A4/A3) ET réseaux (carré, story, portrait, paysage)
// • fond généré par IA (Replicate) OU image uploadée
// • texte par-dessus (titre + sous-titre, couleur, position)
// • logo de la marque (upload) en surimpression
// • grand aperçu en temps réel + export PNG haute définition (hors réseaux aussi)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL_ID } from "@/lib/ai/model-catalog";
import BrandKitPanel from "@/components/studio/BrandKitPanel";
import BrandChartView from "@/components/studio/BrandChartView";
import { StudioHero, StudioStep } from "@/components/studio/StudioUI";
import { StudioCopilot, type CopilotSuggestion } from "@/components/studio/StudioCopilot";
import { ImageEditor } from "@/components/studio/ImageEditor";
import { StudioDistribution } from "@/components/studio/StudioDistribution";
import { IconFrame } from "@/components/visual/Icons";
import { SafeBoundary } from "@/components/ui/SafeBoundary";
import type { BrandKit } from "@/lib/brand-kit/types";

interface Format { id: string; label: string; w: number; h: number; print?: boolean; ar: string; }

// Dimensions print à ~150 dpi (bon compromis qualité/poids) ; réseaux en px standard.
const FORMATS: Format[] = [
  { id: "a4p", label: "A4 portrait", w: 1240, h: 1754, print: true, ar: "4:5" },
  { id: "a4l", label: "A4 paysage", w: 1754, h: 1240, print: true, ar: "16:9" },
  { id: "a3p", label: "A3 portrait", w: 1754, h: 2480, print: true, ar: "4:5" },
  { id: "a3l", label: "A3 paysage", w: 2480, h: 1754, print: true, ar: "16:9" },
  { id: "sq", label: "Carré 1:1", w: 1080, h: 1080, ar: "1:1" },
  { id: "story", label: "Story 9:16", w: 1080, h: 1920, ar: "9:16" },
  { id: "portrait", label: "Portrait 4:5", w: 1080, h: 1350, ar: "4:5" },
  { id: "wide", label: "Paysage 16:9", w: 1920, h: 1080, ar: "16:9" },
];

const TEXT_COLORS = ["#ffffff", "#0f172a", "#60a5fa", "#5b2d8e", "#be123c", "#f59e0b"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const ir = img.width / img.height;
  const fr = W / H;
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > fr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
  else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export default function StudioAffichePage() {
  const t = useT();
  const { company, access } = useCompany();
  const canEdit = access.canEdit;
  const companyId = company.id;

  const [formatId, setFormatId] = useState("a4p");
  const format = useMemo(() => FORMATS.find((f) => f.id === formatId)!, [formatId]);

  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_IMAGE_MODEL_ID);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  // URL source du fond (https générée ou data-URI upload) — base de la retouche IA.
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // ── Identité de marque (brand kit persistant, géré par BrandKitPanel) ───────
  const [promptHints, setPromptHints] = useState<string>("");
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [previewTab, setPreviewTab] = useState<"affiche" | "charte">("affiche");

  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [pos, setPos] = useState<"top" | "center" | "bottom">("bottom");
  const [scrim, setScrim] = useState(true);
  const [logoCorner, setLogoCorner] = useState<"tl" | "tr" | "bl" | "br">("tr");

  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Génération du fond par IA ───────────────────────────────────────────────
  // `o` permet au copilote de générer immédiatement avec SES valeurs (axe :
  // « le copilote déclenche la génération »), sans attendre le re-render React.
  async function generateBackground(o?: { prompt?: string; model?: string; ar?: string }) {
    setGenerating(true); setNote(null);
    try {
      const effPrompt = o?.prompt ?? prompt;
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: [effPrompt || `affiche professionnelle pour ${company.name}`, promptHints].filter(Boolean).join(". "), format: o?.ar ?? format.ar, n: 1, model: o?.model ?? modelId }),
      });
      const d = await r.json();
      if (!r.ok) { setNote(d.error || t("Échec de génération.", "Generation failed.")); return; }
      const urls: string[] = Array.isArray(d.images) ? d.images.map((i: string | { url?: string }) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean) : [];
      if (!urls[0]) { setNote(d.simulated ? t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured.") : t("Aucune image renvoyée.", "No image returned.")); return; }
      // Proxy même-origine → canvas exportable sans taint CORS.
      const img = await loadImage(`/api/proxy-image?url=${encodeURIComponent(urls[0])}`);
      setBgImg(img);
      setBgUrl(urls[0]); // URL brute conservée pour la retouche IA
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setGenerating(false); }
  }

  // Applique une nouvelle version (retouche/upscale) comme fond du canvas.
  async function applyEditedBg(url: string) {
    try {
      const src = url.startsWith("data:") ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
      const img = await loadImage(src);
      setBgImg(img);
      setBgUrl(url);
    } catch { setNote(t("Image retouchée illisible.", "Edited image unreadable.")); }
  }

  // ── Prompt généré par l'IA (puis utilisé pour générer l'image) ──────────────
  async function suggestPrompt() {
    setSuggesting(true); setNote(null);
    try {
      const r = await fetch("/api/ai/suggest-image-prompt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, brief: [prompt, promptHints].filter(Boolean).join(" — "), format: format.label, kind: format.print ? "affiche" : "visuel réseau social" }),
      });
      const d = await r.json();
      if (d.prompt) setPrompt(d.prompt);
      if (d.aiGenerated === false) setNote(t("Prompt généré en mode démo (IA non configurée).", "Prompt generated in demo mode (AI not configured)."));
    } catch {
      setNote(t("Échec de la suggestion de prompt.", "Prompt suggestion failed."));
    } finally { setSuggesting(false); }
  }

  function onUpload(file: File | undefined, kind: "bg" | "logo") {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const img = await loadImage(String(reader.result));
        if (kind === "bg") { setBgImg(img); setBgUrl(String(reader.result)); }
        else setLogoImg(img);
      } catch { setNote(t("Image illisible.", "Unreadable image.")); }
    };
    reader.readAsDataURL(file);
  }

  // Logo issu du brand kit (data URL ou proxy) → image canvas-safe.
  function onBrandLogo(src: string) {
    if (!src) { setLogoImg(null); return; }
    loadImage(src).then(setLogoImg).catch(() => setNote(t("Logo illisible.", "Unreadable logo.")));
  }

  // ── Rendu canvas ────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w: W, h: H } = format;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fond
    if (bgImg) {
      drawCover(ctx, bgImg, W, H);
    } else {
      // État vide = page neutre (PAS un aplat de couleur) + invite, pour qu'on
      // voie tout de suite une « page blanche » prête à composer.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#eef2f7");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (!headline && !subtitle) {
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.font = `500 ${Math.round(W * 0.028)}px Manrope, system-ui, sans-serif`;
        ctx.fillText(t("Générez un fond (IA) ou importez une image", "Generate a background (AI) or upload an image"), W / 2, H / 2);
        ctx.textAlign = "left";
      }
    }

    // Voile pour lisibilité du texte
    const textColorLight = color === "#ffffff" || color === "#f59e0b";
    if (scrim && (headline || subtitle)) {
      const grad = ctx.createLinearGradient(0, pos === "top" ? 0 : H, 0, pos === "top" ? H * 0.5 : H * 0.4);
      const c0 = textColorLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
      grad.addColorStop(0, c0);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Texte
    const pad = W * 0.07;
    const maxW = W - pad * 2;
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    let y: number;

    const hSize = Math.round(W * 0.072);
    const sSize = Math.round(W * 0.036);
    ctx.font = `700 ${hSize}px Manrope, system-ui, sans-serif`;
    const hLines = headline ? wrapText(ctx, headline, maxW) : [];
    ctx.font = `500 ${sSize}px Manrope, system-ui, sans-serif`;
    const sLines = subtitle ? wrapText(ctx, subtitle, maxW) : [];

    const blockH = hLines.length * hSize * 1.12 + (sLines.length ? sLines.length * sSize * 1.25 + hSize * 0.4 : 0);
    if (pos === "top") y = pad + hSize;
    else if (pos === "center") y = (H - blockH) / 2 + hSize;
    else y = H - pad - blockH + hSize;

    ctx.fillStyle = color;
    ctx.font = `700 ${hSize}px Manrope, system-ui, sans-serif`;
    for (const ln of hLines) { ctx.fillText(ln, pad, y); y += hSize * 1.12; }
    if (sLines.length) {
      y += hSize * 0.2;
      ctx.font = `500 ${sSize}px Manrope, system-ui, sans-serif`;
      for (const ln of sLines) { ctx.fillText(ln, pad, y); y += sSize * 1.25; }
    }

    // Logo
    if (logoImg) {
      const lw = W * 0.16;
      const lh = (logoImg.height / logoImg.width) * lw;
      const m = W * 0.05;
      const lx = logoCorner.includes("l") ? m : W - lw - m;
      const ly = logoCorner.includes("t") ? m : H - lh - m;
      ctx.drawImage(logoImg, lx, ly, lw, lh);
    }
  }, [format, bgImg, logoImg, headline, subtitle, color, pos, scrim, logoCorner, company.accent, company.name]);

  // Re-render aussi au retour sur l'onglet « Affiche » (le canvas est remonté).
  useEffect(() => { if (previewTab === "affiche") render(); }, [render, previewTab]);

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(company.name || "affiche").replace(/\s+/g, "-").toLowerCase()}-${format.id}.png`;
      a.click();
    } catch {
      setNote(t("Export impossible (image protégée). Régénérez le fond via l'IA.", "Export failed (protected image). Regenerate the background via AI."));
    }
  }

  // Repart d'une affiche vierge (rien n'est figé). Conserve le format choisi et
  // le brand kit ; remet à zéro le fond, le texte et le logo de l'affiche.
  function resetStudio() {
    if (typeof window !== "undefined" && !window.confirm(
      t("Réinitialiser l'affiche en cours ? Fond, texte et logo seront effacés.",
        "Reset the current poster? Background, text and logo will be cleared.")
    )) return;
    setPrompt("");
    setBgImg(null);
    setLogoImg(null);
    setHeadline("");
    setSubtitle("");
    setColor("#ffffff");
    setPos("bottom");
    setScrim(true);
    setNote(null);
    setPosterUrl(null);
    setPreviewTab("affiche");
  }

  const [savingLib, setSavingLib] = useState(false);
  // URL publique de l'affiche enregistrée → débloque la publication / programmation
  // / utilisation dans une pub (le canvas seul n'a pas d'URL partageable).
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  // Enregistre l'affiche (PNG du canvas) dans la bibliothèque média, réutilisable
  // partout (campagnes, etc.).
  async function saveToLibrary() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSavingLib(true); setNote(null);
    try {
      const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
      if (!blob) { setNote(t("Enregistrement impossible (image protégée). Régénérez le fond via l'IA.", "Save failed (protected image). Regenerate the background via AI.")); return; }
      const sb = createClient();
      if (!sb) { setNote(t("Stockage indisponible.", "Storage unavailable.")); return; }
      const path = `${companyId}/affiche-${Date.now()}-${format.id}.png`;
      const { error } = await sb.storage.from("sh-videos").upload(path, blob, { contentType: "image/png", upsert: true });
      if (error) { setNote(t("Échec de l'envoi au stockage.", "Upload to storage failed.")); return; }
      const { data } = sb.storage.from("sh-videos").getPublicUrl(path);
      const url = data?.publicUrl;
      if (!url) { setNote(t("URL publique indisponible.", "Public URL unavailable.")); return; }
      await fetch("/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, url, type: "image", format: format.id, source: "studio-affiche" }),
      });
      setPosterUrl(url); // débloque le bloc Publier / programmer / utiliser en pub
      setNote(t("✓ Enregistré dans la bibliothèque — réutilisable dans une pub.", "✓ Saved to the library — reusable in an ad."));
    } catch {
      setNote(t("Échec de l'enregistrement.", "Save failed."));
    } finally { setSavingLib(false); }
  }

  const inputCls = "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <StudioHero
        icon={<IconFrame size={24} />}
        title={t("Studio Affiches & Visuels", "Poster & Visual Studio")}
        subtitle={t("Créez des affiches A4/A3 et des visuels réseaux : fond IA ou image, texte, logo — export prêt à imprimer ou à publier.", "Create A4/A3 posters and social visuals: AI or uploaded background, text, logo — export ready to print or publish.")}
        actions={
          <button onClick={resetStudio} className="btn-ghost shrink-0 text-xs text-muted" title={t("Repartir d'une affiche vierge", "Start from a blank poster")}>
            {t("↺ Réinitialiser", "↺ Reset")}
          </button>
        }
      />
      <a href="/campaigns/new" className="-mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-page hover:underline">
        {t("→ Créer une pub Meta (vos visuels sont dans la bibliothèque)", "→ Create a Meta ad (your visuals are in the library)")}
      </a>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Panneau de contrôle ── */}
        <div className="stagger-in space-y-5">
          {/* Copilote créatif — décrivez, l'IA prépare prompt + modèle + format */}
          <StudioCopilot
            studio="affiche"
            currentPrompt={prompt}
            onApply={(s: CopilotSuggestion) => {
              const validModel = s.modelId && IMAGE_MODELS.some((m) => m.id === s.modelId) ? s.modelId : undefined;
              if (s.prompt) setPrompt(s.prompt);
              if (validModel) setModelId(validModel);
              let ar: string | undefined;
              if (s.aspect) {
                const map: Record<string, string> = { "1:1": "sq", "9:16": "story", "16:9": "wide", "4:5": "portrait" };
                if (map[s.aspect]) { setFormatId(map[s.aspect]); ar = s.aspect; }
              }
              // Le copilote DÉCLENCHE la génération (pas seulement le remplissage).
              if (s.prompt && canEdit) void generateBackground({ prompt: s.prompt, model: validModel, ar });
            }}
          />
          {/* Format */}
          <StudioStep n={1} title={t("Format", "Format")}>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} onClick={() => setFormatId(f.id)}
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs ${formatId === f.id ? "border-primary-400 bg-primary-50 text-primary-700 font-semibold" : "border-hair text-muted hover:bg-canvas"}`}>
                  {f.label}{f.print && <span className="ml-1 text-2xs opacity-70">{t("(impression)", "(print)")}</span>}
                </button>
              ))}
            </div>
          </StudioStep>

          {/* Fond */}
          <StudioStep n={2} title={t("Fond", "Background")}>

            {/* Modèle IA */}
            <div>
              <label className="text-2xs font-medium text-muted">{t("Modèle d'image (IA)", "Image model (AI)")}</label>
              <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={`mt-1 ${inputCls}`}>
                {IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>
                ))}
              </select>
            </div>

            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
              placeholder={t("Décrivez le visuel… ou laissez l'IA proposer un prompt", "Describe the visual… or let the AI suggest a prompt")} className={inputCls} />
            <div className="flex flex-wrap gap-2">
              <button onClick={suggestPrompt} disabled={suggesting || !canEdit} className="btn-secondary text-xs disabled:opacity-50">
                {suggesting ? <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-primary-600" />{t("Prompt…", "Prompt…")}</span> : t("🧠 Suggérer un prompt (IA)", "🧠 Suggest a prompt (AI)")}
              </button>
              <button onClick={() => generateBackground()} disabled={generating || !canEdit} title={!canEdit ? t("Lecture seule", "View only") : undefined} className="btn-primary text-xs disabled:opacity-50">
                {generating ? <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-white" />{t("Génération…", "Generating…")}</span> : t("✨ Générer le fond (IA)", "✨ Generate background (AI)")}
              </button>
              <label className="btn-secondary cursor-pointer text-xs">
                {t("📁 Importer une image", "📁 Upload image")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0], "bg")} />
              </label>
            </div>
            {generating && <BusyHint label={t("Création du visuel…", "Creating the visual…")} eta={t("~15–40 s", "~15–40 s")} />}
          </StudioStep>

          {/* Retouche IA du fond — modifie par consignes, versions conservées */}
          {bgUrl && canEdit && <ImageEditor imageUrl={bgUrl} aspect={format.ar} onResult={applyEditedBg} />}

          {/* Texte */}
          <StudioStep n={3} title={t("Texte", "Text")}>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t("Titre", "Headline")} className={inputCls} />
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={t("Sous-titre (optionnel)", "Subtitle (optional)")} className={inputCls} />
            <div className="flex items-center gap-2">
              <span className="text-2xs text-muted">{t("Couleur", "Color")}</span>
              {TEXT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  className={`h-6 w-6 rounded-full ring-2 ${color === c ? "ring-ink" : "ring-hair"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["top", "center", "bottom"] as const).map((p) => (
                <button key={p} onClick={() => setPos(p)}
                  className={`rounded-full px-2.5 py-1 text-2xs ${pos === p ? "bg-ink text-white" : "bg-canvas text-muted"}`}>
                  {p === "top" ? t("Haut", "Top") : p === "center" ? t("Centre", "Center") : t("Bas", "Bottom")}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1.5 text-2xs text-muted">
                <input type="checkbox" checked={scrim} onChange={(e) => setScrim(e.target.checked)} className="accent-primary-600" />
                {t("Voile lisibilité", "Readability scrim")}
              </label>
            </div>
          </StudioStep>

          {/* Logo : placement sur l'affiche (le logo vient du brand kit) */}
          <StudioStep n={4} title={t("Logo sur l'affiche", "Logo on the poster")}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-secondary cursor-pointer text-xs">
                {logoImg ? t("Remplacer ponctuellement", "Replace for this poster") : t("📁 Logo ponctuel", "📁 One-off logo")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0], "logo")} />
              </label>
              {logoImg && <button onClick={() => setLogoImg(null)} className="text-2xs text-danger-600 hover:underline">{t("Retirer", "Remove")}</button>}
            </div>
            {logoImg ? (
              <div className="flex gap-1.5">
                {([["tl", "↖"], ["tr", "↗"], ["bl", "↙"], ["br", "↘"]] as const).map(([k, ic]) => (
                  <button key={k} onClick={() => setLogoCorner(k)}
                    className={`h-7 w-7 rounded-lg text-sm ${logoCorner === k ? "bg-ink text-white" : "bg-canvas text-muted"}`}>{ic}</button>
                ))}
              </div>
            ) : (
              <p className="text-2xs text-muted">{t("Importez le logo dans le brand kit ci-dessous pour le réutiliser partout.", "Upload the logo in the brand kit below to reuse it everywhere.")}</p>
            )}
          </StudioStep>

          {/* Brand kit persistant (logo + charte + analyse IA, mémorisé par marque) */}
          <BrandKitPanel
            companyId={companyId}
            brandName={company.name}
            textColor={color}
            onPickColor={setColor}
            onLogo={onBrandLogo}
            onPromptHints={setPromptHints}
            onKit={(k) => { setBrandKit(k); if (k.chart && k.chart.palette?.length) setPreviewTab("charte"); }}
          />

          <button onClick={exportPng} className="btn-primary w-full">{t("⬇︎ Télécharger (PNG haute déf)", "⬇︎ Download (high-res PNG)")}</button>
          <button onClick={saveToLibrary} disabled={savingLib || !canEdit} className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 disabled:opacity-50">
            {savingLib && <Spinner size={14} className="text-current" />}
            {savingLib ? t("Enregistrement…", "Saving…") : t("📚 Enregistrer dans la bibliothèque", "📚 Save to library")}
          </button>
          {note && <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">{note}</p>}

          {/* Diffusion (organique / pub) — toujours disponible : l'affiche
              enregistrée est sélectionnée d'office, sinon on peut piocher dans
              la bibliothèque. */}
          {canEdit && (
            <StudioDistribution
              companyId={companyId}
              producedUrl={posterUrl}
              producedKind="image"
              defaultText={[headline, subtitle].filter(Boolean).join(" — ")}
            />
          )}
          {!posterUrl && (
            <p className="text-2xs text-muted">
              {t("Astuce : « Enregistrer dans la bibliothèque » pour diffuser l'affiche en cours, ou choisissez un visuel existant ci-dessus.", "Tip: \"Save to library\" to distribute the current poster, or pick an existing visual above.")}
            </p>
          )}
        </div>

        {/* ── Grand aperçu ── */}
        <div className="lg:sticky lg:top-20">
          {/* Bascule Affiche / Charte (visualisation directe à l'écran) */}
          <div className="mb-3 inline-flex rounded-lg border border-hair bg-canvas p-0.5">
            {(["affiche", "charte"] as const).map((tab) => {
              const on = previewTab === tab;
              const disabled = tab === "charte" && !(brandKit?.chart && brandKit.chart.palette?.length);
              return (
                <button
                  key={tab}
                  onClick={() => !disabled && setPreviewTab(tab)}
                  disabled={disabled}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200" : "text-muted hover:text-ink"} ${disabled ? "opacity-40" : ""}`}
                  title={disabled ? t("Générez d'abord la charte (Brand kit)", "Generate the chart first (Brand kit)") : undefined}
                >
                  {tab === "affiche" ? t("Affiche", "Poster") : t("Charte graphique", "Brand guidelines")}
                </button>
              );
            })}
          </div>

          {previewTab === "charte" && brandKit?.chart ? (
            <SafeBoundary label="BrandChartView/preview">
              <BrandChartView chart={brandKit.chart} logoSrc={brandKit.logoUrl} brandName={company.name} />
            </SafeBoundary>
          ) : (
            <>
              <div className="card flex items-center justify-center bg-[repeating-conic-gradient(#f1f1f4_0%_25%,#fafafb_0%_50%)] bg-[length:24px_24px] p-4 sm:p-6">
                <canvas
                  ref={canvasRef}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg shadow-lg ring-1 ring-hair"
                  style={{ aspectRatio: `${format.w} / ${format.h}` }}
                />
              </div>
              <p className="mt-2 text-center text-2xs text-muted">
                {format.label} · {format.w}×{format.h}px{format.print ? t(" · ~150 dpi (impression)", " · ~150 dpi (print)") : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
