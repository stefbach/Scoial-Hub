"use client";

// Studio Article LinkedIn : à partir de mots-clés OU d'un texte, génère un
// prompt personnalisé (éditable), puis un article de niveau professionnel, avec
// des visuels haute qualité associés, et la publication LinkedIn.

import { useState, useEffect } from "react";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { PUBLISH_LANGUAGES } from "@/lib/publish-languages";
import { Spinner, BusyHint } from "@/components/ui/Spinner";
import { LinkedInScheduler } from "@/components/linkedin/LinkedInScheduler";
import { MediaLibraryButton } from "@/components/studio/MediaLibrary";

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

/** Limite de caractères d'un post LinkedIn (API /rest/posts). */
const LINKEDIN_MAX = 3000;
/** Budget cible avec marge sous la limite (on condense jusqu'à passer dessous). */
const LINKEDIN_BUDGET = 2900;

/**
 * Garde-fou de dernier recours : si le texte dépasse la limite LinkedIn, on
 * coupe à une frontière de phrase/paragraphe propre (jamais en plein mot).
 * En pratique la génération vise déjà ~2900 caractères → rarement déclenché.
 */
function clampClean(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastBreak = Math.max(
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("\n"),
  );
  // Coupe à une frontière de phrase, SANS « … » (texte qui se termine proprement).
  const cut = lastBreak > max * 0.7 ? slice.slice(0, lastBreak + 1) : slice;
  return cut.trimEnd();
}

/** Assemble le post LinkedIn COMPLET (titre inclus) — SANS troncature.
 *  Le verrouillage de longueur se fait à la publication (condensation IA),
 *  jamais en coupant le texte. */
function toPlainText(a: Article): string {
  const body = a.body.replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "");
  return [
    a.title ? a.title.trim() : "",
    "",
    a.hook,
    "",
    body,
    a.keyTakeaways.length ? "\n" + a.keyTakeaways.map((k) => `• ${k}`).join("\n") : "",
    a.cta ? `\n${a.cta}` : "",
    a.hashtags.length ? `\n${a.hashtags.join(" ")}` : "",
  ].filter((s) => s !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function ArticleStudio({ seed }: { seed?: { nonce: number; text: string } }) {
  const { company, access } = useCompany();
  const canEdit = access.canEdit;
  const companyId = company.id;
  const t = useT();
  const { lang } = useLang();

  // Saisie
  const [source, setSource] = useState<"keywords" | "text">("keywords");
  const [input, setInput] = useState("");
  const [angle, setAngle] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<"post" | "article" | "long">("article");
  // Langue de PUBLICATION de l'article (toute langue du registre, plus FR/EN).
  const [language, setLanguage] = useState<string>("fr");
  // RAG opt-in : écrire librement par défaut ; s'appuyer sur la marque/veille à la demande.
  const [useMemory, setUseMemory] = useState(false);

  // Prompt personnalisé
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);

  // Article
  const [article, setArticle] = useState<Article | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  // « Dispositif final » : le texte EXACT qui sera publié sur LinkedIn.
  // C'est la source de vérité de la publication ; le chatbot écrit dedans et
  // l'utilisateur peut aussi l'éditer à la main.
  const [postText, setPostText] = useState("");
  // Dernière version produite par l'IA, en attente d'être appliquée au post.
  const [pendingText, setPendingText] = useState<string | null>(null);

  // Visuels
  const [images, setImages] = useState<Record<number, string[]>>({});
  const [imgLoading, setImgLoading] = useState<number | null>(null);
  const [imgModel, setImgModel] = useState(VISUAL_MODELS[0].id);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // Type du média choisi (le connecteur LinkedIn publie images ET vidéos).
  const [selectedKind, setSelectedKind] = useState<"image" | "video">("image");

  // Chatbot d'ajustement (révision conversationnelle de l'article)
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [revising, setRevising] = useState(false);

  // Publication
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Programmation (même espace : publier OU programmer, puis continuer à écrire)
  const [schedDate, setSchedDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [schedTime, setSchedTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [queueKey, setQueueKey] = useState(0);

  // Graine venue de la stratégie (« Utiliser » une idée de post) → préremplit
  // la saisie en mode texte, dans le même espace.
  useEffect(() => {
    if (seed?.text) { setSource("text"); setInput(seed.text); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  /** Demande à l'IA d'ajuster l'article courant selon une consigne libre. */
  async function reviseArticle(instruction: string) {
    if (!article || !instruction.trim() || revising) return;
    setRevising(true); setError(null);
    const history = chat.slice(-6);
    setChat((c) => [...c, { role: "user", content: instruction }]);
    setChatInput("");
    try {
      const r = await fetch("/api/ai/linkedin-article", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, mode: "revise", language, article, instruction, history }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error((d.error as string) || t("Échec de l'ajustement.", "Adjustment failed."));
      if (d.changed === false) {
        // L'IA n'a pas pu appliquer la demande : on le dit clairement.
        setChat((c) => [...c, { role: "assistant", content: t("Je n'ai pas réussi à appliquer ce changement. Reformulez (ex. « raccourcis l'intro de 2 phrases »).", "I couldn't apply that change. Try rephrasing (e.g. “shorten the intro by 2 sentences”).") }]);
        return;
      }
      // On applique DIRECTEMENT la nouvelle version au post final (dispositif
      // final) ET on garde l'article structuré à jour. On mémorise aussi la
      // version IA pour le bouton « Appliquer au post ».
      const next = { ...(d.article as Article) };
      const nextText = toPlainText(next);
      setArticle(next);
      setPostText(nextText);
      setPendingText(nextText);
      const newLen = nextText.length;
      setChat((c) => [...c, { role: "assistant", content: t(`Post ajusté ✓ (${newLen} caractères) — appliqué au post à publier.`, `Post adjusted ✓ (${newLen} characters) — applied to the post.`) }]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: t("Désolé, l'ajustement a échoué. Reformulez ?", "Sorry, the adjustment failed. Try rephrasing?") }]);
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally { setRevising(false); }
  }

  /** Condense l'article via l'IA pour qu'il tienne sous la limite (verrouillage). */
  async function condenseToFit(a: Article): Promise<Article> {
    const r = await fetch("/api/ai/linkedin-article", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, mode: "revise", language, article: a, instruction: "Condense l'article pour qu'il tienne complet sous 3000 caractères, sans rien couper, en gardant l'essentiel." }),
    });
    const d = await readJson(r);
    if (r.ok && d.article) return d.article as Article;
    return a;
  }

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
    setError(null); setArticleLoading(true); setAiNote(null); setImages({}); setChat([]);
    try {
      const r = await fetch("/api/ai/linkedin-article", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, mode: "article", source, input, angle, audience, tone, length, language, customPrompt: prompt || undefined, useMemory }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error((d.error as string) || t("Échec.", "Failed."));
      const a = d.article as Article;
      setArticle(a);
      setPostText(toPlainText(a));   // le post final reflète l'article généré
      setPendingText(null);
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
    if (!postText.trim()) return;
    await navigator.clipboard.writeText(postText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function publish() {
    if (!postText.trim()) return;
    setPublishing(true); setPublishMsg(null);
    try {
      // Le post final = `postText` (édité/ajusté). VERROUILLAGE longueur : on
      // CONDENSE (réécriture COMPLÈTE) tant que ça dépasse le budget de 2900
      // (marge sous la limite LinkedIn de 3000), jusqu'à 3 passes — sans jamais
      // tronquer le contenu.
      let finalText = postText;
      let art = article;
      let pass = 0;
      while (finalText.length > LINKEDIN_BUDGET && art && pass < 3) {
        setPublishMsg(t("Ajustement automatique pour tenir dans la limite LinkedIn…", "Auto-adjusting to fit LinkedIn's limit…"));
        const next = await condenseToFit(art);
        const nextText = toPlainText(next);
        // Si la passe ne réduit plus, on arrête (évite une boucle inutile).
        if (nextText.length >= finalText.length) { art = next; finalText = nextText; break; }
        art = next; finalText = nextText; pass++;
      }
      setArticle(art);
      setPostText(finalText);
      // Filet de sécurité ultime (≤ 3000, coupe à une frontière de phrase, sans « … »).
      const text = finalText.length > LINKEDIN_MAX ? clampClean(finalText, LINKEDIN_MAX) : finalText;
      const chosenImg = selectedImage || Object.values(images).flat()[0];
      const chosenIsVideo = Boolean(selectedImage) && selectedKind === "video";
      // Route réelle (par société + cible profil/Page), comme l'Espace LinkedIn.
      const r = await fetch("/api/linkedin/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, text, ...(chosenIsVideo ? { videoUrl: chosenImg } : { imageUrl: chosenImg || undefined }) }),
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

  /** Programme le post LinkedIn (part automatiquement via le cron) — même espace. */
  async function schedule() {
    if (!postText.trim()) return;
    setScheduling(true); setPublishMsg(null);
    try {
      const chosenImg = selectedImage || Object.values(images).flat()[0];
      const chosenIsVideo = Boolean(selectedImage) && selectedKind === "video";
      const body = postText.trim();
      const r = await fetch("/api/scheduled-posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId, platform: "linkedin",
          title: body.slice(0, 48) + (body.length > 48 ? "…" : ""),
          body, date: schedDate, time: schedTime, status: "scheduled", source: "manual",
          media: chosenImg ? { kind: (Boolean(selectedImage) && selectedKind === "video") ? "video" : "image", url: chosenImg } : undefined,
        }),
      });
      if (!r.ok) { setPublishMsg(t("Échec de la programmation.", "Scheduling failed.")); return; }
      setPublishMsg(t(`Programmé le ${schedDate} à ${schedTime} ✓ — dans la file ci-dessous. Vous pouvez continuer à écrire.`, `Scheduled for ${schedDate} at ${schedTime} ✓ — in the queue below. You can keep writing.`));
      setQueueKey((k) => k + 1); // rafraîchit la file d'attente
    } catch {
      setPublishMsg(t("Erreur réseau.", "Network error."));
    } finally { setScheduling(false); }
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
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {t(
          "De mots-clés ou d'un texte → un prompt personnalisé → un article de niveau professionnel, avec visuels haute qualité.",
          "From keywords or text → a custom prompt → a professional-grade article, with high-quality visuals."
        )}
      </p>

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
                    ? "bg-page text-white"
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
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls} aria-label={t("Langue de publication", "Publishing language")}>
              {PUBLISH_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{lang === "en" ? l.en : l.fr}</option>
              ))}
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
          <button onClick={genPrompt} disabled={promptLoading || !canEdit} className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
            {promptLoading && <Spinner size={14} className="text-current" />}
            {promptLoading ? t("Génération…", "Generating…") : t("① Générer le prompt", "① Generate prompt")}
          </button>
          <button onClick={genArticle} disabled={articleLoading || !canEdit} title={!canEdit ? t("Lecture seule", "View only") : undefined} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
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
              <button onClick={publish} disabled={publishing || !canEdit} title={!canEdit ? t("Lecture seule", "View only") : undefined} className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
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

          {/* ── Chatbot d'ajustement : on dialogue pour affiner l'article ── */}
          <div className="rounded-xl border border-hair bg-canvas/60 p-3">
            <p className="section-label mb-2">{t("Ajuster avec l'assistant", "Adjust with the assistant")}</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                { fr: "Raccourcir", en: "Shorten", ins: "Raccourcis l'article tout en gardant l'essentiel." },
                { fr: "Plus percutant", en: "More punchy", ins: "Rends le ton plus percutant et direct." },
                { fr: "Ajouter une statistique", en: "Add a stat", ins: "Ajoute une statistique crédible et vérifiable liée au sujet." },
                { fr: "Plus chaleureux", en: "Warmer", ins: "Adopte un ton plus chaleureux et humain." },
                { fr: "Finir par une question", en: "End with a question", ins: "Termine par une question d'engagement forte." },
                { fr: "Plus d'exemples", en: "More examples", ins: "Ajoute un exemple concret supplémentaire." },
              ].map((q) => (
                <button key={q.fr} type="button" disabled={revising} onClick={() => reviseArticle(q.ins)}
                  className="rounded-full border border-hair bg-card px-2.5 py-1 text-2xs text-ink transition-colors hover:border-page hover:text-page disabled:opacity-50">
                  {t(q.fr, q.en)}
                </button>
              ))}
            </div>
            {chat.length > 0 && (
              <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto">
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <span className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-2xs ${m.role === "user" ? "bg-page text-white" : "bg-card text-ink ring-1 ring-hair"}`}>{m.content}</span>
                  </div>
                ))}
                {revising && (
                  <div className="flex justify-start"><span className="inline-flex items-center gap-1.5 rounded-2xl bg-card px-3 py-1.5 text-2xs text-muted ring-1 ring-hair"><Spinner size={11} className="text-page" /> {t("Ajustement…", "Adjusting…")}</span></div>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); reviseArticle(chatInput); } }}
                rows={1}
                disabled={revising || !canEdit}
                placeholder={t("Ex : « raccourcis l'intro et ajoute un chiffre »", "E.g. “shorten the intro and add a figure”")}
                className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
              />
              <button type="button" onClick={() => reviseArticle(chatInput)} disabled={revising || !chatInput.trim() || !canEdit} className="btn-primary h-[2.25rem] shrink-0 text-xs disabled:opacity-50">
                {t("Ajuster", "Adjust")}
              </button>
            </div>
          </div>

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
                          {on && <span className="absolute right-1 top-1 rounded-full bg-page px-1.5 py-0.5 text-[10px] font-bold text-white">✓</span>}
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

      {/* POST FINAL — le texte EXACT qui sera publié (éditable, source de vérité) */}
      {article && (
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="section-label">{t("Post final à publier", "Final post to publish")}</span>
            <div className="flex flex-wrap gap-2">
              {/* Bouton explicite : applique la dernière version IA au post final */}
              {pendingText !== null && pendingText !== postText && (
                <button onClick={() => setPostText(pendingText)} className="btn-secondary text-xs">
                  {t("⤵ Appliquer la version IA au post", "⤵ Apply AI version to the post")}
                </button>
              )}
              {/* Réutiliser un visuel déjà créé ailleurs (Studios, etc.) */}
              <MediaLibraryButton
                companyId={companyId}
                accept="image"
                label={t("📚 Visuel de la bibliothèque", "📚 Library visual")}
                className="btn-secondary text-xs"
                onPick={(a) => setSelectedImage(a.url)}
              />
              <button onClick={copyArticle} className="btn-secondary text-xs">{copied ? t("Copié ✓", "Copied ✓") : t("Copier le texte", "Copy text")}</button>
              <button onClick={publish} disabled={publishing || !canEdit} title={!canEdit ? t("Lecture seule", "View only") : undefined} className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                {publishing && <Spinner size={14} className="text-white" />}
                {publishing ? t("Publication…", "Publishing…") : t("Publier sur LinkedIn", "Publish to LinkedIn")}
              </button>
            </div>
          </div>

          {/* Zone éditable = ce qui part RÉELLEMENT sur LinkedIn */}
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={12}
            disabled={!canEdit}
            className="w-full resize-y rounded-xl border border-hair bg-canvas p-4 text-sm leading-relaxed text-ink outline-none focus:border-primary-400"
          />
          {/* Compteur + jauge sur le POST FINAL */}
          {(() => {
            const len = postText.length;
            const over = len > LINKEDIN_MAX;
            const pct = Math.min(100, Math.round((len / LINKEDIN_MAX) * 100));
            return (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
                  <div className={`h-full rounded-full transition-all ${over ? "bg-danger-500" : len > LINKEDIN_MAX * 0.92 ? "bg-warning-500" : "bg-success-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`text-2xs ${over ? "font-semibold text-danger-600" : "text-muted"}`}>
                  {t(`${len} / ${LINKEDIN_MAX} caractères`, `${len} / ${LINKEDIN_MAX} characters`)}
                  {over
                    ? t(" — sera condensé automatiquement à la publication (jamais coupé).", " — will be auto-condensed at publish (never truncated).")
                    : t(" — tient dans la limite LinkedIn ✓", " — fits within LinkedIn's limit ✓")}
                </p>
              </div>
            );
          })()}

          {/* Publier maintenant OU programmer — sans quitter l'espace */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hair pt-3">
            <span className="section-label">{t("Programmer", "Schedule")}</span>
            <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="rounded-lg border border-hair bg-canvas px-2 py-1 text-xs text-ink outline-none focus:border-primary-400" />
            <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="rounded-lg border border-hair bg-canvas px-2 py-1 text-xs text-ink outline-none focus:border-primary-400" />
            <button onClick={schedule} disabled={scheduling || publishing || !canEdit} title={!canEdit ? t("Lecture seule", "View only") : undefined} className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
              {scheduling && <Spinner size={14} className="text-current" />}
              {scheduling ? t("Programmation…", "Scheduling…") : t("📅 Programmer", "📅 Schedule")}
            </button>
            <span className="text-2xs text-muted">{t("Part automatiquement (vérif. toutes les 10 min).", "Goes out automatically (checked every 10 min).")}</span>
          </div>

          {/* Aperçu fidèle (rendu LinkedIn) du post final */}
          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-hair bg-canvas p-4">
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

            {/* Corps du post = le texte final exact */}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{postText}</p>

            {/* Visuel choisi */}
            {(selectedImage || Object.values(images).flat()[0]) && (
              selectedImage && selectedKind === "video" ? (
                <video src={selectedImage} controls className="mt-3 w-full rounded-lg border border-hair" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage || Object.values(images).flat()[0]}
                  alt="visuel de la publication"
                  className="mt-3 w-full rounded-lg border border-hair object-cover"
                />
              )
            )}
          </div>
          {publishMsg && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{publishMsg}</p>}
        </section>
      )}

      {/* File d'attente LinkedIn — gérer / éditer / republier dans le MÊME espace */}
      <section className="space-y-2">
        <span className="section-label">{t("File d'attente & publications", "Queue & posts")}</span>
        <LinkedInScheduler key={queueKey} />
      </section>
    </div>
  );
}
