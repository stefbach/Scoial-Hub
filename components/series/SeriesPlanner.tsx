"use client";

// ── SeriesPlanner — planificateur de série GÉNÉRIQUE multi-réseaux ────────────
// Même logique que le planificateur LinkedIn (générer une série posts/articles
// + un visuel par publication), mais ADAPTÉ aux contraintes de chaque réseau
// (longueur, média requis, format, mode de diffusion) via lib/social-series.
//
//   - Facebook / Instagram : programmation auto (cron). Instagram impose un visuel.
//   - Twitter / Pinterest / TikTok : « Publier maintenant » via le connecteur.

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { MediaLibraryButton } from "@/components/studio/MediaLibrary";
import { SERIES_CONFIG, type SeriesPlatform } from "@/lib/social-series";

type Cadence = "daily" | "every2" | "weekly";
const CADENCE_STEP: Record<Cadence, number> = { daily: 1, every2: 2, weekly: 7 };

const VISUAL_MODELS = [
  { id: "black-forest-labs/flux-1.1-pro-ultra", label: "Flux 1.1 Pro Ultra" },
  { id: "google/imagen-4-ultra", label: "Imagen 4 Ultra" },
  { id: "black-forest-labs/flux-1.1-pro", label: "Flux 1.1 Pro" },
];

interface DraftItem {
  body: string;
  visualPrompt?: string;
  media?: string | null;
}

function extractImageUrls(data: unknown): string[] {
  const d = data as { images?: Array<string | { url?: string }> };
  if (!Array.isArray(d?.images)) return [];
  return d.images.map((i) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean);
}

function titleFromBody(body: string): string {
  return body.trim().split("\n")[0].slice(0, 80) || "Post";
}

export function SeriesPlanner({ platform }: { platform: SeriesPlatform }) {
  const cfg = SERIES_CONFIG[platform];
  const t = useT();
  const { lang } = useLang();
  const { company, access } = useCompany();
  const canEdit = access.canEdit;
  const companyId = company.id;

  const inputCls =
    "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";

  const isVideo = cfg.media === "video";
  const mediaRequired = cfg.media === "image" || cfg.media === "video";

  const [drafts, setDrafts] = useState<DraftItem[]>([{ body: "" }, { body: "" }, { body: "" }]);
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(5);
  const [seriesFormat, setSeriesFormat] = useState<"post" | "article">("post");
  const [useMemory, setUseMemory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imgModel, setImgModel] = useState(VISUAL_MODELS[0].id);
  const [genImgIdx, setGenImgIdx] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => addDays(new Date(), 1));
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [batchTime, setBatchTime] = useState("09:00");
  const [boardId, setBoardId] = useState("");
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const filledDrafts = useMemo(
    () => drafts.map((d, i) => ({ ...d, index: i })).filter((d) => d.body.trim()),
    [drafts]
  );

  function draftDate(position: number): Date {
    return addDays(startDate, position * CADENCE_STEP[cadence]);
  }
  function patchDraft(i: number, patch: Partial<DraftItem>) {
    setDrafts((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function generateSeries() {
    if (!theme.trim()) { setMsg(t("Indiquez un thème pour la série.", "Enter a theme for the series.")); return; }
    setGenerating(true); setMsg(null);
    try {
      const r = await fetch("/api/ai/social-series", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, platform, theme, count, language: lang, brandVoice: company.brandVoice ?? "", useMemory, format: seriesFormat }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.error ?? t("Échec de la génération.", "Generation failed.")); return; }
      const posts = (d.posts ?? []) as { title: string; body: string; visualPrompt?: string }[];
      if (posts.length === 0) { setMsg(t("Aucun contenu généré. Réessayez.", "Nothing generated. Try again.")); return; }
      setDrafts(posts.map((p) => ({ body: p.body, visualPrompt: p.visualPrompt })));
      setMsg(d.mock
        ? t("Démo — IA non configurée : série d'exemple générée.", "Demo — AI not configured: sample series generated.")
        : t(`${posts.length} éléments générés — relisez, ajoutez les visuels, puis diffusez.`, `${posts.length} items generated — review, add visuals, then publish.`));
    } finally { setGenerating(false); }
  }

  const [genAll, setGenAll] = useState(false);

  /** Génère le visuel de TOUS les éléments sans visuel (séquentiel). */
  async function genAllVisuals() {
    if (isVideo) return; // pas de génération IA de vidéo
    setGenAll(true); setMsg(null);
    const targets = drafts.map((d, i) => ({ d, i })).filter(({ d }) => d.body.trim() && !d.media);
    if (targets.length === 0) { setMsg(t("Tous les éléments ont déjà un visuel.", "Every item already has a visual.")); setGenAll(false); return; }
    let done = 0;
    for (const { i } of targets) {
      setMsg(t(`Génération des visuels… (${done + 1}/${targets.length})`, `Generating visuals… (${done + 1}/${targets.length})`));
      await genVisual(i);
      done++;
    }
    setMsg(t(`Visuels générés ✓ (${done})`, `Visuals generated ✓ (${done})`));
    setGenAll(false);
  }

  async function genVisual(i: number) {
    const item = drafts[i];
    const vp = (item?.visualPrompt || item?.body || theme || "").trim();
    if (!vp) { setMsg(t("Aucun contenu pour générer un visuel.", "No content to generate a visual.")); return; }
    setGenImgIdx(i); setMsg(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: vp.slice(0, 400), platform, n: 1, model: imgModel, companyId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg((d.error as string) ?? t("Échec de génération d'image.", "Image generation failed.")); return; }
      const urls = extractImageUrls(d);
      if (urls.length > 0) patchDraft(i, { media: urls[0] });
      else if (d.simulated) setMsg(t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured (REPLICATE_API_TOKEN)."));
      else setMsg(t("Aucune image renvoyée. Réessayez.", "No image returned. Try again."));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("Échec de génération d'image.", "Image generation failed."));
    } finally { setGenImgIdx(null); }
  }

  /** Vérifie le média requis ; renvoie le nb d'éléments sans média (bloquant). */
  function missingMediaCount(): number {
    if (!mediaRequired) return 0;
    return filledDrafts.filter((d) => !d.media).length;
  }

  async function run() {
    if (filledDrafts.length === 0) { setMsg(t("Rédigez ou générez au moins un élément.", "Write or generate at least one item.")); return; }
    const missing = missingMediaCount();
    if (missing > 0) {
      setMsg(isVideo
        ? t(`${missing} élément(s) sans vidéo. ${cfg.label} exige une vidéo par publication.`, `${missing} item(s) without a video. ${cfg.label} requires a video per post.`)
        : t(`${missing} élément(s) sans visuel. ${cfg.label} exige une image par publication.`, `${missing} item(s) without a visual. ${cfg.label} requires an image per post.`));
      return;
    }
    if (cfg.needsBoard && !boardId.trim()) { setMsg(t("Indiquez l'ID du board Pinterest cible.", "Enter the target Pinterest board ID.")); return; }

    setWorking(true); setMsg(null);
    let ok = 0, failed = 0;
    try {
      for (let i = 0; i < filledDrafts.length; i++) {
        const item = filledDrafts[i];
        const bodyText = item.body.trim();
        const imgUrl = item.media || null;

        if (cfg.delivery === "schedule") {
          const r = await fetch("/api/scheduled-posts", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId, platform, title: titleFromBody(bodyText), body: bodyText,
              date: format(draftDate(i), "yyyy-MM-dd"), time: batchTime,
              status: "scheduled", source: "manual",
              media: imgUrl ? { kind: "image", url: imgUrl } : undefined,
            }),
          });
          r.ok ? ok++ : failed++;
        } else {
          const r = await fetch("/api/social/publish", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId, platform, text: bodyText,
              ...(isVideo ? { videoUrl: imgUrl } : { imageUrl: imgUrl }),
              ...(cfg.needsBoard ? { boardId: boardId.trim() } : {}),
            }),
          });
          const d = await r.json().catch(() => ({}));
          r.ok && d.connected !== false ? ok++ : failed++;
        }
      }
      if (ok > 0) setDrafts([{ body: "" }, { body: "" }, { body: "" }]);
      const verb = cfg.delivery === "schedule" ? t("programmées", "scheduled") : t("publiées", "published");
      setMsg(failed === 0
        ? t(`${ok} publications ${verb} ✓`, `${ok} posts ${verb} ✓`)
        : t(`${ok} ${verb}, ${failed} en échec.`, `${ok} ${verb}, ${failed} failed.`));
    } finally { setWorking(false); }
  }

  const overChars = (n: number) => n > cfg.maxChars;

  return (
    <div className="space-y-4">
      {/* Génération IA */}
      <div className="rounded-xl border border-hair bg-canvas p-3 space-y-2">
        <p className="section-label text-ai-text">{t("✨ Générer la série avec l'IA", "✨ Generate the series with AI")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={theme} onChange={(e) => setTheme(e.target.value)}
            placeholder={t("Thème de la série", "Series theme")} className={`${inputCls} min-w-[200px] flex-1`} />
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-lg border border-hair bg-canvas px-2 py-2 text-sm text-ink outline-none focus:border-primary-400">
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={generateSeries} disabled={generating || !canEdit}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
            {generating && <Spinner size={14} className="text-current" />}
            {generating ? t("Génération…", "Generating…") : t("Générer", "Generate")}
          </button>
          {!isVideo && (
            <button onClick={genAllVisuals} disabled={genAll || generating || !canEdit || filledDrafts.length === 0}
              title={t("Génère un visuel pour chaque élément sans image", "Generate a visual for each item without an image")}
              className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
              {genAll && <Spinner size={14} className="text-current" />}
              {genAll ? t("Visuels…", "Visuals…") : t("✨ Générer tous les visuels", "✨ Generate all visuals")}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {cfg.formats.includes("article") && (
            <div className="inline-flex items-center gap-1">
              <span className="text-2xs text-muted">{t("Type :", "Type:")}</span>
              {(["post", "article"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setSeriesFormat(f)}
                  className={`rounded-full px-2.5 py-1 text-2xs font-medium ${seriesFormat === f ? "bg-ink text-white" : "bg-card text-muted ring-1 ring-hair hover:text-ink"}`}>
                  {f === "post" ? t("Posts courts", "Short posts") : t("Articles", "Articles")}
                </button>
              ))}
            </div>
          )}
          {!isVideo && (
            <label className="flex items-center gap-1.5 text-2xs text-muted">
              {t("Modèle visuel :", "Visual model:")}
              <select value={imgModel} onChange={(e) => setImgModel(e.target.value)}
                className="rounded-lg border border-hair bg-card px-2 py-1 text-2xs text-ink outline-none focus:border-primary-400">
                {VISUAL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-2xs text-muted">
            <input type="checkbox" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} className="h-3.5 w-3.5 accent-primary-600" />
            {t("S'appuyer sur la marque (RAG)", "Ground in brand (RAG)")}
          </label>
        </div>
        <p className="text-2xs text-muted">
          {t(`Contraintes ${cfg.label} : ${cfg.maxChars} caractères max`, `${cfg.label} constraints: ${cfg.maxChars} chars max`)}
          {cfg.media === "image" && t(" · image obligatoire", " · image required")}
          {cfg.media === "video" && t(" · vidéo obligatoire", " · video required")}
          {cfg.delivery === "publish" && t(" · publication immédiate", " · immediate publishing")}
        </p>
      </div>

      {/* Éléments de la série */}
      <div className="space-y-2.5">
        {drafts.map((d, i) => {
          const len = d.body.trim().length;
          return (
            <div key={i} className="rounded-xl border border-hair bg-canvas p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xs font-bold text-primary-700">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <textarea value={d.body} onChange={(e) => patchDraft(i, { body: e.target.value })}
                    rows={seriesFormat === "article" ? 6 : 3}
                    placeholder={t(`Élément ${i + 1}…`, `Item ${i + 1}…`)} className={inputCls} />
                  {len > 0 && (
                    <p className={`mt-0.5 text-2xs ${overChars(len) ? "font-semibold text-danger-600" : "text-muted"}`}>
                      {cfg.delivery === "schedule" && <>📅 {format(draftDate(filledDrafts.findIndex((f) => f.index === i)), "yyyy-MM-dd")} · {batchTime} · </>}
                      {len}/{cfg.maxChars} {t("caractères", "chars")}
                      {overChars(len) && t(" — trop long", " — too long")}
                    </p>
                  )}
                </div>
                <button onClick={() => setDrafts((arr) => arr.filter((_, j) => j !== i))} disabled={drafts.length <= 1}
                  title={t("Retirer", "Remove")} className="btn-secondary mt-1 shrink-0 px-2 text-2xs disabled:opacity-40">✕</button>
              </div>

              {/* Média de cet élément */}
              {cfg.media !== "none" && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                  {d.media ? (
                    <span className="relative inline-block">
                      {isVideo ? (
                        <video src={d.media} className="h-12 w-12 rounded-lg border border-hair object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.media} alt="" className="h-12 w-12 rounded-lg border border-hair object-cover" />
                      )}
                      <button type="button" onClick={() => patchDraft(i, { media: null })} title={t("Retirer le visuel", "Remove visual")}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-2xs text-white">✕</button>
                    </span>
                  ) : (
                    <span className={`text-2xs ${mediaRequired ? "font-semibold text-warning-700" : "text-muted"}`}>
                      {mediaRequired ? (isVideo ? t("Vidéo requise", "Video required") : t("Image requise", "Image required")) : t("Pas de visuel", "No visual")}
                    </span>
                  )}
                  {!isVideo && (
                    <button onClick={() => genVisual(i)} disabled={genImgIdx === i || !canEdit || !d.body.trim()}
                      className="btn-secondary inline-flex items-center gap-1 text-2xs disabled:opacity-50">
                      {genImgIdx === i && <Spinner size={12} className="text-current" />}
                      {genImgIdx === i ? t("Génération…", "Generating…") : t("✨ Générer le visuel", "✨ Generate visual")}
                    </button>
                  )}
                  <MediaLibraryButton companyId={companyId} accept={isVideo ? "video" : "image"}
                    label={isVideo ? t("📚 Vidéo bibliothèque", "📚 Library video") : t("📚 Bibliothèque", "📚 Library")}
                    className="btn-secondary text-2xs" onPick={(a) => patchDraft(i, { media: a.url })} />
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => setDrafts((arr) => [...arr, { body: "" }])} className="btn-secondary text-2xs">
          {t("+ Ajouter un élément", "+ Add an item")}
        </button>
      </div>

      {/* Pinterest : board cible */}
      {cfg.needsBoard && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hair bg-canvas p-3">
          <span className="section-label">{t("Board Pinterest", "Pinterest board")}</span>
          <input value={boardId} onChange={(e) => setBoardId(e.target.value)} placeholder={t("ID du board cible", "Target board ID")}
            className={`${inputCls} max-w-[260px]`} />
        </div>
      )}

      {/* Diffusion : programmer (FB/IG) OU publier maintenant (autres) */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-hair bg-canvas p-3">
        {cfg.delivery === "schedule" && (
          <>
            <div className="w-44">
              <p className="section-label">{t("Date de départ", "Start date")}</p>
              <div className="mt-1"><DatePicker value={startDate} onChange={setStartDate} /></div>
            </div>
            <div>
              <p className="section-label">{t("Cadence", "Cadence")}</p>
              <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}
                className="mt-1 rounded-md border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400">
                <option value="daily">{t("Tous les jours", "Daily")}</option>
                <option value="every2">{t("Tous les 2 jours", "Every 2 days")}</option>
                <option value="weekly">{t("Toutes les semaines", "Weekly")}</option>
              </select>
            </div>
            <div className="w-24">
              <p className="section-label">{t("Heure", "Time")}</p>
              <div className="mt-1"><TimePicker value={batchTime} onChange={setBatchTime} /></div>
            </div>
          </>
        )}
        <button onClick={run} disabled={working || !canEdit || filledDrafts.length === 0}
          title={!canEdit ? t("Lecture seule", "View only") : undefined}
          className="btn-primary ml-auto inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
          {working && <Spinner size={16} className="text-white" />}
          {working
            ? (cfg.delivery === "schedule" ? t("Programmation…", "Scheduling…") : t("Publication…", "Publishing…"))
            : (cfg.delivery === "schedule"
                ? t(`Tout programmer (${filledDrafts.length})`, `Schedule all (${filledDrafts.length})`)
                : t(`Publier la série (${filledDrafts.length})`, `Publish series (${filledDrafts.length})`))}
        </button>
      </div>

      {msg && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{msg}</p>}
    </div>
  );
}
