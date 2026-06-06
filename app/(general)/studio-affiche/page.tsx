"use client";

// Studio Affiches & Visuels — un vrai studio piloté par IA, AÉRÉ :
// • formats print (A4/A3) ET réseaux (carré, story, portrait, paysage)
// • fond généré par IA (Replicate) OU image uploadée
// • texte par-dessus (titre + sous-titre, couleur, position)
// • logo de la marque (upload) en surimpression
// • grand aperçu en temps réel + export PNG haute définition (hors réseaux aussi)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL_ID } from "@/lib/ai/model-catalog";
import BrandKitPanel from "@/components/studio/BrandKitPanel";

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

const TEXT_COLORS = ["#ffffff", "#0f172a", "#2563eb", "#5b2d8e", "#be123c", "#f59e0b"];

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
  const { company } = useCompany();
  const companyId = company.id;

  const [formatId, setFormatId] = useState("a4p");
  const format = useMemo(() => FORMATS.find((f) => f.id === formatId)!, [formatId]);

  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_IMAGE_MODEL_ID);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // ── Identité de marque (brand kit persistant, géré par BrandKitPanel) ───────
  const [promptHints, setPromptHints] = useState<string>("");

  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [pos, setPos] = useState<"top" | "center" | "bottom">("bottom");
  const [scrim, setScrim] = useState(true);
  const [logoCorner, setLogoCorner] = useState<"tl" | "tr" | "bl" | "br">("tr");

  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Génération du fond par IA ───────────────────────────────────────────────
  async function generateBackground() {
    setGenerating(true); setNote(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: [prompt || `affiche professionnelle pour ${company.name}`, promptHints].filter(Boolean).join(". "), format: format.ar, n: 1, model: modelId }),
      });
      const d = await r.json();
      if (!r.ok) { setNote(d.error || t("Échec de génération.", "Generation failed.")); return; }
      const urls: string[] = Array.isArray(d.images) ? d.images.map((i: string | { url?: string }) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean) : [];
      if (!urls[0]) { setNote(d.simulated ? t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured.") : t("Aucune image renvoyée.", "No image returned.")); return; }
      // Proxy même-origine → canvas exportable sans taint CORS.
      const img = await loadImage(`/api/proxy-image?url=${encodeURIComponent(urls[0])}`);
      setBgImg(img);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setGenerating(false); }
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
        if (kind === "bg") setBgImg(img);
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
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, W, H);
    if (bgImg) drawCover(ctx, bgImg, W, H);
    else {
      ctx.fillStyle = company.accent ?? "#5b2d8e";
      ctx.fillRect(0, 0, W, H);
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

  useEffect(() => { render(); }, [render]);

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

  const inputCls = "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="section-label text-primary-500">{t("Studio", "Studio")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{t("Studio Affiches & Visuels", "Poster & Visual Studio")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t("Créez des affiches A4/A3 et des visuels réseaux : fond IA ou image, texte, logo — export prêt à imprimer ou à publier.", "Create A4/A3 posters and social visuals: AI or uploaded background, text, logo — export ready to print or publish.")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Panneau de contrôle ── */}
        <div className="space-y-5">
          {/* Format */}
          <section className="card p-4">
            <div className="section-label mb-2">{t("Format", "Format")}</div>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} onClick={() => setFormatId(f.id)}
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs ${formatId === f.id ? "border-primary-400 bg-primary-50 text-primary-700 font-semibold" : "border-hair text-muted hover:bg-canvas"}`}>
                  {f.label}{f.print && <span className="ml-1 text-2xs opacity-70">{t("(impression)", "(print)")}</span>}
                </button>
              ))}
            </div>
          </section>

          {/* Fond */}
          <section className="card p-4 space-y-3">
            <div className="section-label">{t("Fond", "Background")}</div>

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
              <button onClick={suggestPrompt} disabled={suggesting} className="btn-secondary text-xs disabled:opacity-50">
                {suggesting ? <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-primary-600" />{t("Prompt…", "Prompt…")}</span> : t("🧠 Suggérer un prompt (IA)", "🧠 Suggest a prompt (AI)")}
              </button>
              <button onClick={generateBackground} disabled={generating} className="btn-primary text-xs disabled:opacity-50">
                {generating ? <span className="inline-flex items-center gap-1.5"><Spinner size={12} className="text-white" />{t("Génération…", "Generating…")}</span> : t("✨ Générer le fond (IA)", "✨ Generate background (AI)")}
              </button>
              <label className="btn-secondary cursor-pointer text-xs">
                {t("📁 Importer une image", "📁 Upload image")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0], "bg")} />
              </label>
            </div>
            {generating && <BusyHint label={t("Création du visuel…", "Creating the visual…")} eta={t("~15–40 s", "~15–40 s")} />}
          </section>

          {/* Texte */}
          <section className="card p-4 space-y-3">
            <div className="section-label">{t("Texte", "Text")}</div>
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
          </section>

          {/* Logo : placement sur l'affiche (le logo vient du brand kit) */}
          <section className="card p-4 space-y-3">
            <div className="section-label">{t("Logo sur l'affiche", "Logo on the poster")}</div>
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
          </section>

          {/* Brand kit persistant (logo + charte + analyse IA, mémorisé par marque) */}
          <BrandKitPanel
            companyId={companyId}
            textColor={color}
            onPickColor={setColor}
            onLogo={onBrandLogo}
            onPromptHints={setPromptHints}
          />

          <button onClick={exportPng} className="btn-primary w-full">{t("⬇︎ Télécharger (PNG haute déf)", "⬇︎ Download (high-res PNG)")}</button>
          {note && <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">{note}</p>}
        </div>

        {/* ── Grand aperçu ── */}
        <div className="lg:sticky lg:top-20">
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
        </div>
      </div>
    </div>
  );
}
