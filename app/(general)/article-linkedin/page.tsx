"use client";

// Studio Article LinkedIn : à partir de mots-clés OU d'un texte, génère un
// prompt personnalisé (éditable), puis un article de niveau professionnel, avec
// des visuels haute qualité associés, et la publication LinkedIn.

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

// Modèles visuels de qualité proposés sur cet écran (du plus net au plus rapide).
const VISUAL_MODELS: { id: string; label: string }[] = [
  { id: "black-forest-labs/flux-1.1-pro-ultra", label: "Flux 1.1 Pro Ultra — ultra-net" },
  { id: "google/imagen-4-ultra", label: "Imagen 4 Ultra (Google)" },
  { id: "google/nano-banana", label: "Nano Banana (Gemini)" },
  { id: "black-forest-labs/flux-1.1-pro", label: "Flux 1.1 Pro" },
  { id: "ideogram-ai/ideogram-v3-quality", label: "Ideogram v3 — texte/affiche" },
];

interface Article {
  title: string;
  hook: string;
  body: string;
  keyTakeaways: string[];
  hashtags: string[];
  cta: string;
  visualPrompts: string[];
}

/** Lit une réponse JSON en tolérant les erreurs serveur non-JSON (ex. 504/HTML). */
async function readJson(r: Response): Promise<Record<string, unknown>> {
  const raw = await r.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    // Réponse non-JSON (timeout passerelle, page d'erreur Vercel…)
    if (r.status === 504 || r.status === 502 || r.status === 408) {
      throw new Error(
        "La génération a dépassé le temps imparti. Réessayez, ou choisissez « Article » au lieu d'« Article long » (plus rapide)."
      );
    }
    throw new Error(`Réponse serveur inattendue (${r.status}). Réessayez.`);
  }
}

function extractImageUrls(data: unknown): string[] {
  const d = data as { images?: Array<string | { url?: string }> };
  if (!Array.isArray(d?.images)) return [];
  return d.images.map((i) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean);
}

/** Assemble une version texte plat publiable du post LinkedIn. */
function toPlainText(a: Article): string {
  const body = a.body.replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "");
  return [
    a.hook,
    "",
    body,
    a.keyTakeaways.length ? "\n" + a.keyTakeaways.map((k) => `• ${k}`).join("\n") : "",
    a.cta ? `\n${a.cta}` : "",
    a.hashtags.length ? `\n${a.hashtags.join(" ")}` : "",
  ].filter(Boolean).join("\n").trim();
}

export default function ArticleLinkedInPage() {
  const { company } = useCompany();
  const companyId = company.id;
  const t = useT();

  // Saisie
  const [source, setSource] = useState<"keywords" | "text">("keywords");
  const [input, setInput] = useState("");
  const [angle, setAngle] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<"post" | "article" | "long">("article");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  // RAG opt-in : écrire librement par défaut ; s'appuyer sur la marque/veille à la demande.
  const [useMemory, setUseMemory] = useState(false);

  // Prompt personnalisé
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);

  // Article
  const [article, setArticle] = useState<Article | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  // Visuels
  const [images, setImages] = useState<Record<number, string[]>>({});
  const [imgLoading, setImgLoading] = useState<number | null>(null);
  const [imgModel, setImgModel] = useState(VISUAL_MODELS[0].id);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Publication
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function genPrompt() {
    if (!input.trim()) { setError(t("Saisissez des mots-clés ou un texte.", "Enter keywords or text.")); return; }
    setError(null); setPromptLoading(true);
    try {
      const r = await fetch("/api/ai/linkedin-article", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, mode: "prompt", source, input, angle, audience, tone, length, language, useMemory }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error((d.error as string) || t("Échec.", "Failed."));
      setPrompt(d.prompt as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setPromptLoading(false); }
  }

  async function genArticle() {
    if (!input.trim()) { setError(t("Saisissez des mots-clés ou un texte.", "Enter keywords or text.")); return; }
    setError(null); setArticleLoading(true); setAiNote(null); setImages({});
    try {
      const r = await fetch("/api/ai/linkedin-article", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, mode: "article", source, input, angle, audience, tone, length, language, customPrompt: prompt || undefined, useMemory }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error((d.error as string) || t("Échec.", "Failed."));
      setArticle(d.article as Article);
      if (!d.aiGenerated) setAiNote(t("Démo — IA non configurée (ANTHROPIC_API_KEY).", "Demo — AI not configured (ANTHROPIC_API_KEY)."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setArticleLoading(false); }
  }

  async function genVisual(idx: number, vp: string) {
    setImgLoading(idx); setAiNote(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: vp, platform: "linkedin", n: 1, model: imgModel, companyId }),
      });
      const d = await readJson(r);
      if (!r.ok) { setAiNote((d.error as string) || t("Échec de génération d'image.", "Image generation failed.")); return; }
      const urls = extractImageUrls(d);
      if (urls.length > 0) {
        setImages((prev) => ({ ...prev, [idx]: urls }));
        setSelectedImage((cur) => cur ?? urls[0]); // sélectionne le 1er visuel par défaut
        if (d.fallbackUsed) { const fb = String(d.fallbackUsed); setAiNote(t(`Image générée via un modèle de repli (${fb}).`, `Image generated with a fallback model (${fb}).`)); }
        return;
      }
      if (d.simulated) setAiNote(t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured (REPLICATE_API_TOKEN)."));
      else setAiNote(t("Aucune image renvoyée par le modèle. Réessayez.", "No image returned by the model. Try again."));
    } catch (e) {
      setAiNote(e instanceof Error ? e.message : t("Échec de génération d'image.", "Image generation failed."));
    } finally { setImgLoading(null); }
  }

  async function copyArticle() {
    if (!article) return;
    await navigator.clipboard.writeText(toPlainText(article));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function publish() {
    if (!article) return;
    setPublishing(true); setPublishMsg(null);
    try {
      const chosenImg = selectedImage || Object.values(images).flat()[0];
      // Route réelle (par société + cible profil/Page), comme l'Espace LinkedIn.
      const r = await fetch("/api/linkedin/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, text: toPlainText(article), imageUrl: chosenImg || undefined }),
      });
      const d = await readJson(r);
      if (d.connected === false) {
        setPublishMsg(t("LinkedIn non connecté — ouvrez « Espace LinkedIn » et connectez-le.", "LinkedIn not connected — open “LinkedIn space” and connect it."));
        return;
      }
      if (!r.ok) { setPublishMsg((d.error as string) || t("Échec de la publication.", "Publish failed.")); return; }
      if (d.simulated) {
        setPublishMsg(t("Publié en simulation (LinkedIn non configuré côté serveur).", "Simulated (LinkedIn not configured server-side)."));
      } else {
        const url = (d.url as string) ?? "";
        setPublishMsg(t(`Publié sur LinkedIn ✓ ${url}`, `Published on LinkedIn ✓ ${url}`));
      }
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : t("Échec de la publication.", "Publish failed."));
    } finally { setPublishing(false); }
  }

  const inputCls = "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";

  // STEPPER : déduit l'étape courante de l'état de l'écran.
  const hasImages = Object.values(images).some((u) => u.length > 0);
  const currentStep = hasImages ? 5 : article ? 4 : prompt ? 3 : input.trim() ? 2 : 1;
  const steps: { n: number; fr: string; en: string }[] = [
    { n: 1, fr: "Saisie", en: "Input" },
    { n: 2, fr: "Prompt", en: "Prompt" },
    { n: 3, fr: "Article", en: "Article" },
    { n: 4, fr: "Visuels", en: "Visuals" },
    { n: 5, fr: "Publier", en: "Publish" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">{t("Studio Article LinkedIn", "LinkedIn Article Studio")}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {t(
            "De mots-clés ou d'un texte → un prompt personnalisé → un article de niveau professionnel, avec visuels haute qualité.",
            "From keywords or text → a custom prompt → a professional-grade article, with high-quality visuals."
          )}
        </p>
      </header>

      {/* Stepper horizontal léger : où en suis-je ? */}
      <nav aria-label={t("Progression", "Progress")} className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => {
          const done = s.n < currentStep;
          const active = s.n === currentStep;
          return (
            <div key={s.n} className="flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium ${
                  active
                    ? "bg-primary-600 text-white"
                    : done
                    ? "bg-primary-50 text-primary-700"
                    : "bg-canvas text-muted ring-1 ring-hair"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    active ? "bg-white/20 text-white" : done ? "bg-primary-100 text-primary-700" : "bg-hair text-muted"
                  }`}
                >
                  {done ? "✓" : s.n}
                </span>
                {t(s.fr, s.en)}
              </span>
              {i < steps.length - 1 && <span className="text-2xs text-muted">→</span>}
            </div>
          );
        })}
      </nav>

      {/* 1. Saisie */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-1.5">
          {(["keywords", "text"] as const).map((s) => (
            <button key={s} onClick={() => setSource(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${source === s ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink"}`}>
              {s === "keywords" ? t("Mots-clés", "Keywords") : t("Texte source", "Source text")}
            </button>
          ))}
        </div>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={source === "text" ? 5 : 2}
          placeholder={source === "keywords" ? t("ex. télémédecine, accès aux soins, IA, prévention", "e.g. telemedicine, access to care, AI, prevention") : t("Collez un texte à transformer en article professionnel…", "Paste text to turn into a professional article…")}
          className={inputCls} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder={t("Angle (optionnel)", "Angle (optional)")} className={inputCls} />
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={t("Cible (optionnel)", "Audience (optional)")} className={inputCls} />
          <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder={t("Ton (optionnel)", "Tone (optional)")} className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <select value={length} onChange={(e) => setLength(e.target.value as typeof length)} className={inputCls}>
              <option value="post">{t("Post court", "Short post")}</option>
              <option value="article">{t("Article", "Article")}</option>
              <option value="long">{t("Article long", "Long article")}</option>
            </select>
            <select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} className={inputCls}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* RAG opt-in : par défaut, l'article suit librement le sujet saisi. */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-hair bg-canvas px-3 py-2.5">
          <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600" />
          <span className="text-xs leading-relaxed text-ink">
            <span className="font-semibold">{t("S'appuyer sur la marque & la veille (RAG)", "Ground in brand & insights (RAG)")}</span>
            <span className="ml-1 text-muted">
              {t(
                "— ancre l'article dans votre marque (voix, positionnement, thèmes) et votre mémoire stratégique. Décoché : écriture 100 % libre sur le sujet saisi, aucune info client imposée.",
                "— anchors the article in your brand (voice, positioning, themes) and strategic memory. Unchecked: write 100% freely on your topic, no client info imposed."
              )}
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button onClick={genPrompt} disabled={promptLoading} className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
            {promptLoading && <Spinner size={14} className="text-current" />}
            {promptLoading ? t("Génération…", "Generating…") : t("① Générer le prompt", "① Generate prompt")}
          </button>
          <button onClick={genArticle} disabled={articleLoading} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
            {articleLoading && <Spinner size={16} className="text-white" />}
            {articleLoading ? t("Rédaction…", "Writing…") : t("② Générer l'article", "② Generate article")}
          </button>
        </div>
        {promptLoading && <BusyHint label={t("L'IA prépare votre prompt…", "The AI is preparing your prompt…")} eta="~10 s" />}
        {articleLoading && <BusyHint label={t("L'IA rédige votre article…", "The AI is writing your article…")} eta={length === "long" ? t("~40–90 s", "~40–90 s") : t("~20–40 s", "~20–40 s")} />}
        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
      </section>

      {/* Prompt personnalisé éditable */}
      {prompt && (
        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="section-label">{t("Prompt personnalisé (éditable)", "Custom prompt (editable)")}</span>
            <span className="text-2xs text-muted">{t("Modifiez-le puis « Générer l'article ».", "Edit it then “Generate article”.")}</span>
          </div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} className={inputCls} />
        </section>
      )}

      {aiNote && <div className="rounded-xl bg-warning-50 px-4 py-2.5 text-sm text-warning-700">{aiNote}</div>}

      {/* Article */}
      {article && (
        <section className="card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">{article.title}</h2>
            <div className="flex gap-2">
              <button onClick={copyArticle} className="btn-secondary text-xs">{copied ? t("Copié ✓", "Copied ✓") : t("Copier", "Copy")}</button>
              <button onClick={publish} disabled={publishing} className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                {publishing && <Spinner size={14} className="text-white" />}
                {publishing ? t("Publication…", "Publishing…") : t("Publier sur LinkedIn", "Publish to LinkedIn")}
              </button>
            </div>
          </div>

          {article.hook && <p className="text-sm font-medium text-ink">{article.hook}</p>}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{article.body}</div>

          {article.keyTakeaways.length > 0 && (
            <div className="rounded-xl bg-canvas p-3">
              <p className="section-label">{t("À retenir", "Key takeaways")}</p>
              <ul className="mt-1.5 space-y-1">
                {article.keyTakeaways.map((k, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-400" />{k}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {article.cta && <p className="text-sm italic text-muted">{article.cta}</p>}
          {article.hashtags.length > 0 && (
            <p className="text-sm font-medium text-primary-700">{article.hashtags.join("  ")}</p>
          )}
          {publishMsg && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{publishMsg}</p>}
        </section>
      )}

      {/* Visuels */}
      {article && article.visualPrompts.length > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="section-label">{t("Visuels associés (haute qualité)", "Associated visuals (high quality)")}</span>
            <label className="flex items-center gap-1.5 text-2xs text-muted">
              {t("Modèle :", "Model:")}
              <select value={imgModel} onChange={(e) => setImgModel(e.target.value)} className="rounded-lg border border-hair bg-canvas px-2 py-1 text-2xs text-ink outline-none focus:border-primary-400">
                {VISUAL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-1 text-2xs text-muted">{t("Cliquez une image pour la choisir comme visuel de la publication.", "Click an image to set it as the post visual.")}</p>
          <div className="mt-3 space-y-4">
            {article.visualPrompts.map((vp, idx) => (
              <div key={idx} className="rounded-xl border border-hair p-3">
                <p className="text-xs text-muted">{vp}</p>
                <button onClick={() => genVisual(idx, vp)} disabled={imgLoading === idx} className="btn-secondary mt-2 inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                  {imgLoading === idx && <Spinner size={14} className="text-current" />}
                  {imgLoading === idx ? t("Génération…", "Generating…") : t("Générer ce visuel", "Generate this visual")}
                </button>
                {imgLoading === idx && (
                  <BusyHint className="mt-2" label={t("Génération des visuels haute qualité…", "Generating high-quality visuals…")} eta={t("~20–60 s", "~20–60 s")} />
                )}
                {images[idx]?.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {images[idx].map((u, i) => {
                      const on = selectedImage === u;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedImage(on ? null : u)}
                          className={`relative block overflow-hidden rounded-lg border-2 ${on ? "border-primary-500 ring-2 ring-primary-200" : "border-hair hover:border-primary-300"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`visuel ${idx}-${i}`} className="h-full w-full object-cover" />
                          {on && <span className="absolute right-1 top-1 rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Aperçu prêt à publier — rendu fidèle au post LinkedIn (texte + visuel) */}
      {article && (
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="section-label">{t("Aperçu prêt à publier", "Ready-to-publish preview")}</span>
            <div className="flex gap-2">
              <button onClick={copyArticle} className="btn-secondary text-xs">{copied ? t("Copié ✓", "Copied ✓") : t("Copier le texte", "Copy text")}</button>
              <button onClick={publish} disabled={publishing} className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                {publishing && <Spinner size={14} className="text-white" />}
                {publishing ? t("Publication…", "Publishing…") : t("Publier sur LinkedIn", "Publish to LinkedIn")}
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-xl rounded-xl border border-hair bg-canvas p-4">
            {/* En-tête type LinkedIn */}
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A66C2] text-sm font-bold text-white">
                {(company.name || "in").slice(0, 2).toUpperCase()}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-ink">{company.name || t("Votre marque", "Your brand")}</p>
                <p className="text-2xs text-muted">{t("Maintenant · 🌐", "Now · 🌐")}</p>
              </div>
            </div>

            {/* Corps du post */}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{toPlainText(article)}</p>

            {/* Visuel choisi */}
            {(selectedImage || Object.values(images).flat()[0]) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedImage || Object.values(images).flat()[0]}
                alt="visuel de la publication"
                className="mt-3 w-full rounded-lg border border-hair object-cover"
              />
            )}
          </div>
          {publishMsg && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{publishMsg}</p>}
        </section>
      )}
    </div>
  );
}
