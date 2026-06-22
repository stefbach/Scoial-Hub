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
import { StudioDiffusion } from "@/components/studio/StudioDiffusion";
import { IconFrame } from "@/components/visual/Icons";
import { SafeBoundary } from "@/components/ui/SafeBoundary";
import type { BrandKit } from "@/lib/brand-kit/types";

type FormatGroup = "print" | "universel" | "instagram" | "facebook" | "linkedin";
interface Format { id: string; label: string; w: number; h: number; print?: boolean; ar: string; group: FormatGroup; }

// Libellés des groupes de formats (impression + un set par réseau).
const GROUPS: { id: FormatGroup; fr: string; en: string }[] = [
  { id: "universel", fr: "Universel", en: "Universal" },
  { id: "instagram", fr: "Instagram", en: "Instagram" },
  { id: "facebook", fr: "Facebook", en: "Facebook" },
  { id: "linkedin", fr: "LinkedIn", en: "LinkedIn" },
  { id: "print", fr: "Impression", en: "Print" },
];

// Dimensions print à ~150 dpi (bon compromis qualité/poids) ; réseaux en px standard.
const FORMATS: Format[] = [
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
const SOCIAL_DECLINE_IDS = ["ig-pt", "ig-sq", "ig-story", "fb-feed", "fb-land", "fb-story", "li-land", "li-sq", "li-pt"];

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

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, scale = 1) {
  const ir = img.width / img.height;
  const fr = W / H;
  let dw: number, dh: number;
  if (ir > fr) { dh = H * scale; dw = dh * ir; }
  else { dw = W * scale; dh = dw / ir; }
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Adapte une image à un format SANS la couper (« décliner ») : l'image entière est
// affichée (contain), et le cadre est rempli par une version floutée et zoomée de
// la même image — rendu premium, aucun élément coupé, quel que soit le format.
function drawFitBlur(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  // 1) Fond flouté qui remplit tout le cadre (pas de bandes vides).
  ctx.save();
  ctx.filter = `blur(${Math.max(8, Math.round(Math.min(W, H) * 0.05))}px)`;
  drawCover(ctx, img, W, H, 1.15);
  ctx.restore();
  ctx.fillStyle = "rgba(15,23,42,0.18)"; // léger voile d'homogénéisation
  ctx.fillRect(0, 0, W, H);
  // 2) Image complète, centrée, jamais coupée.
  const ir = img.width / img.height, fr = W / H;
  let dw: number, dh: number;
  if (ir > fr) { dw = W; dh = W / ir; } else { dh = H; dw = H * ir; }
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
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

  const [formatId, setFormatId] = useState("ig-pt");
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
  // `paint` dessine l'affiche sur N'IMPORTE QUEL canvas, pour un format donné —
  // réutilisé par l'aperçu live ET par la déclinaison multi-formats (hors écran).
  const paint = useCallback((canvas: HTMLCanvasElement, fmt: Format, fit: "cover" | "fit" = "cover") => {
    const { w: W, h: H } = fmt;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fond
    if (bgImg) {
      if (fit === "fit") drawFitBlur(ctx, bgImg, W, H);
      else drawCover(ctx, bgImg, W, H);
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
  }, [bgImg, logoImg, headline, subtitle, color, pos, scrim, logoCorner, t]);

  // Aperçu live : dessine le format courant sur le canvas visible.
  const render = useCallback(() => {
    if (canvasRef.current) paint(canvasRef.current, format);
  }, [paint, format]);

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
    setPreviewTab("affiche");
  }

  const [savingLib, setSavingLib] = useState(false);
  // URL publique (https) de l'affiche une fois hébergée — base de la diffusion
  // (publier / programmer / intégrer dans une pub). Invalidée si le design change.
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const [savedToLibrary, setSavedToLibrary] = useState(false);

  // Le design a changé → la version hébergée n'est plus à jour : on réinitialise
  // la diffusion pour ne jamais publier une affiche périmée.
  useEffect(() => { setHostedUrl(null); setSavedToLibrary(false); },
    [bgImg, logoImg, headline, subtitle, color, pos, scrim, logoCorner, formatId]);

  // Héberge un PNG (Supabase) et l'enregistre dans la bibliothèque. Renvoie l'URL
  // publique, ou null en cas d'échec. Réutilisé par l'enregistrement simple ET la
  // déclinaison multi-formats.
  async function hostBlob(blob: Blob, fmtId: string): Promise<string | null> {
    const sb = createClient();
    if (!sb) return null;
    const path = `${companyId}/affiche-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${fmtId}.png`;
    const { error } = await sb.storage.from("sh-videos").upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) return null;
    const { data } = sb.storage.from("sh-videos").getPublicUrl(path);
    const url = data?.publicUrl;
    if (!url) return null;
    await fetch("/api/media", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, url, type: "image", format: fmtId, source: "studio-affiche" }),
    }).catch(() => {});
    return url;
  }

  // Rend un format donné (hors écran) en PNG. Réutilise exactement le même dessin
  // que l'aperçu, mais aux dimensions du format demandé.
  async function renderFormatBlob(fmt: Format): Promise<Blob | null> {
    const off = document.createElement("canvas");
    // « fit » : l'image est adaptée au format sans être coupée (déclinaison).
    paint(off, fmt, "fit");
    return new Promise((res) => off.toBlob((b) => res(b), "image/png"));
  }

  // Enregistre l'affiche (PNG du canvas courant) dans la bibliothèque média ET
  // conserve l'URL publique pour la diffusion.
  async function saveToLibrary() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSavingLib(true); setNote(null);
    try {
      const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
      if (!blob) { setNote(t("Enregistrement impossible (image protégée). Régénérez le fond via l'IA.", "Save failed (protected image). Regenerate the background via AI.")); return; }
      const url = await hostBlob(blob, format.id);
      if (!url) { setNote(t("Échec de l'envoi au stockage.", "Upload to storage failed.")); return; }
      setHostedUrl(url);
      setSavedToLibrary(true);
      setNote(t("✓ Enregistré — vous pouvez maintenant le publier, le programmer ou en faire une pub.", "✓ Saved — you can now publish, schedule or turn it into an ad."));
    } catch {
      setNote(t("Échec de l'enregistrement.", "Save failed."));
    } finally { setSavingLib(false); }
  }

  // ── Déclinaison « tout le jeu de formats » (réseaux) en un clic ──────────────
  // Re-dessine l'affiche courante sur CHAQUE format réseau et enregistre tout dans
  // la bibliothèque, prêt à publier ou à décliner en pub.
  const [declining, setDeclining] = useState(false);
  const [declineDone, setDeclineDone] = useState(0);
  const declineSet = FORMATS.filter((f) => SOCIAL_DECLINE_IDS.includes(f.id));
  async function declineAll() {
    if (declining) return;
    if (!bgImg && !headline && !subtitle) { setNote(t("Composez d'abord l'affiche (fond ou texte).", "Compose the poster first (background or text).")); return; }
    setDeclining(true); setDeclineDone(0); setNote(null);
    let ok = 0;
    try {
      for (const fmt of declineSet) {
        const blob = await renderFormatBlob(fmt);
        if (blob) { const url = await hostBlob(blob, fmt.id); if (url) ok += 1; }
        setDeclineDone((n) => n + 1);
      }
      setNote(ok > 0
        ? t(`✓ ${ok} formats réseaux enregistrés dans la bibliothèque — prêts à publier ou décliner en pub.`, `✓ ${ok} network formats saved to the library — ready to publish or turn into ads.`)
        : t("Échec de la déclinaison (image protégée ?). Régénérez le fond via l'IA.", "Declension failed (protected image?). Regenerate the background via AI."));
    } catch {
      setNote(t("Échec de la déclinaison.", "Declension failed."));
    } finally { setDeclining(false); }
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
          {/* Format — groupé par réseau (Instagram / Facebook / LinkedIn) + impression */}
          <StudioStep n={1} title={t("Format", "Format")}>
            <div className="space-y-3">
              {GROUPS.map((g) => {
                const items = FORMATS.filter((f) => f.group === g.id);
                if (items.length === 0) return null;
                return (
                  <div key={g.id}>
                    <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{t(g.fr, g.en)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((f) => (
                        <button key={f.id} onClick={() => setFormatId(f.id)}
                          className={`rounded-lg border px-2.5 py-2 text-left text-xs ${formatId === f.id ? "border-primary-400 bg-primary-50 text-primary-700 font-semibold" : "border-hair text-muted hover:bg-canvas"}`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Décliner tout le jeu de formats réseaux en un clic */}
            <div className="mt-3 border-t border-hair pt-3">
              <button onClick={declineAll} disabled={declining || !canEdit}
                title={!canEdit ? t("Lecture seule", "View only") : undefined}
                className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50">
                {declining && <Spinner size={14} className="text-current" />}
                {declining
                  ? t(`Déclinaison… ${declineDone}/${declineSet.length}`, `Declining… ${declineDone}/${declineSet.length}`)
                  : t(`⚡ Décliner tout le jeu réseaux (${declineSet.length} formats)`, `⚡ Decline the whole network set (${declineSet.length} formats)`)}
              </button>
              <p className="mt-1 text-2xs text-muted">
                {t("Adapte l'affiche à chaque format Instagram / Facebook / LinkedIn SANS rien couper (l'image entière est conservée), enregistrés dans la bibliothèque — prêts à publier ou à décliner en pub.", "Adapts the poster to every Instagram / Facebook / LinkedIn format WITHOUT cropping (the whole image is kept), saved to the library — ready to publish or turn into ads.")}
              </p>
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

          {/* Diffusion : enregistrer puis publier / programmer / intégrer dans une pub */}
          {hostedUrl ? (
            <StudioDiffusion
              companyId={companyId}
              mediaUrl={hostedUrl}
              mediaKind="image"
              defaultText={[headline, subtitle].filter(Boolean).join(" — ")}
              savedToLibrary={savedToLibrary}
              onSaveToLibrary={saveToLibrary}
              saving={savingLib}
            />
          ) : (
            <>
              <button onClick={saveToLibrary} disabled={savingLib || !canEdit} className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 disabled:opacity-50">
                {savingLib && <Spinner size={14} className="text-current" />}
                {savingLib ? t("Enregistrement…", "Saving…") : t("📚 Enregistrer — puis publier / programmer / pub", "📚 Save — then publish / schedule / ad")}
              </button>
              <p className="text-2xs text-muted">
                {t("Enregistrez l'affiche pour pouvoir la publier, la programmer (Facebook / Instagram / TikTok) ou l'intégrer dans une pub Meta.", "Save the poster to publish it, schedule it (Facebook / Instagram / TikTok) or use it in a Meta ad.")}
              </p>
            </>
          )}
          {note && <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">{note}</p>}
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
