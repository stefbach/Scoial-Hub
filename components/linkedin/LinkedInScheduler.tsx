"use client";

// Onglet « Programmation » de l'espace LinkedIn :
//   1. File d'attente des publications LinkedIn programmées (triée par échéance)
//      avec édition, suppression et « Publier maintenant ».
//   2. Planificateur de lot : rédiger ou générer par IA une série de posts,
//      choisir date de départ + cadence + heure, et tout programmer en un clic.
//
// Les publications partent automatiquement via le cron /api/cron/publish-due
// (vérification toutes les 10 minutes).

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useCompany } from "@/lib/company-context";
import { useT, useLang } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { MediaLibraryButton } from "@/components/studio/MediaLibrary";
import type { ScheduledPost } from "@/lib/types";

type Cadence = "daily" | "every2" | "weekly";

const CADENCE_STEP: Record<Cadence, number> = { daily: 1, every2: 2, weekly: 7 };

/** Un élément de la série : texte + prompt visuel (IA) + visuel choisi/généré. */
interface DraftItem {
  body: string;
  /** Prompt d'image renvoyé par l'IA (génération de visuel assorti). */
  visualPrompt?: string;
  /** URL du visuel attaché (généré par IA ou choisi en bibliothèque). */
  media?: string | null;
}

/** Modèles de génération de visuels (du plus net au plus rapide). */
const SERIES_VISUAL_MODELS: { id: string; label: string }[] = [
  { id: "black-forest-labs/flux-1.1-pro-ultra", label: "Flux 1.1 Pro Ultra" },
  { id: "google/imagen-4-ultra", label: "Imagen 4 Ultra" },
  { id: "black-forest-labs/flux-1.1-pro", label: "Flux 1.1 Pro" },
];

function extractImageUrls(data: unknown): string[] {
  const d = data as { images?: Array<string | { url?: string }> };
  if (!Array.isArray(d?.images)) return [];
  return d.images.map((i) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean);
}

/** Titre interne dérivé de la première ligne du texte. */
function titleFromBody(body: string): string {
  return body.trim().split("\n")[0].slice(0, 80) || "Post LinkedIn";
}

function sortKey(p: ScheduledPost): string {
  return `${p.date || "9999-12-31"}T${p.time || "23:59"}`;
}

export function LinkedInScheduler() {
  const t = useT();
  const { lang } = useLang();
  const { company, access } = useCompany();
  const canEdit = access.canEdit;
  const companyId = company.id;

  const inputCls =
    "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";

  /* ── File d'attente ─────────────────────────────────────────────────── */

  const [queue, setQueue] = useState<ScheduledPost[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const r = await fetch(`/api/scheduled-posts?companyId=${encodeURIComponent(companyId)}`);
      const data = r.ok ? ((await r.json()) as ScheduledPost[]) : [];
      const items = (Array.isArray(data) ? data : [])
        .filter((p) => p.platform === "linkedin" && (p.status ?? "scheduled") === "scheduled")
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      setQueue(items);
    } catch {
      setQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Édition inline d'un élément de la file
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editTime, setEditTime] = useState("09:00");
  const [editMedia, setEditMedia] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(p: ScheduledPost) {
    setEditId(p.id);
    setEditBody(p.body || p.title || "");
    setEditDate(p.date ? new Date(`${p.date}T12:00:00`) : new Date());
    setEditTime(p.time || "09:00");
    setEditMedia(p.media?.url ?? null);
    setQueueMsg(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/scheduled-posts/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleFromBody(editBody),
          body: editBody,
          date: format(editDate, "yyyy-MM-dd"),
          time: editTime,
          // `null` retire le visuel ; un objet l'attache/le remplace.
          media: editMedia ? { kind: "image", url: editMedia } : null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setQueueMsg(d.error ?? t("Échec de la mise à jour.", "Update failed."));
        return;
      }
      setEditId(null);
      await loadQueue();
    } finally {
      setSavingEdit(false);
    }
  }

  async function deletePost(id: string) {
    setBusyId(id);
    setQueueMsg(null);
    try {
      const r = await fetch(`/api/scheduled-posts/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) {
        setQueueMsg(t("Échec de la suppression.", "Delete failed."));
        return;
      }
      await loadQueue();
    } finally {
      setBusyId(null);
    }
  }

  async function publishNow(id: string) {
    setBusyId(id);
    setQueueMsg(null);
    try {
      const r = await fetch(`/api/scheduled-posts/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setQueueMsg(d.error ?? t("Échec de la publication.", "Publish failed."));
        return;
      }
      setQueueMsg(
        d.simulated
          ? t("Publié en simulation (LinkedIn non configuré).", "Simulated (LinkedIn not configured).")
          : t("Publié sur LinkedIn ✓", "Published on LinkedIn ✓")
      );
      await loadQueue();
    } finally {
      setBusyId(null);
    }
  }

  /* ── Planificateur de lot ───────────────────────────────────────────── */

  const [drafts, setDrafts] = useState<DraftItem[]>([{ body: "" }, { body: "" }, { body: "" }]);
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(5);
  const [seriesFormat, setSeriesFormat] = useState<"post" | "article">("post");
  const [useMemory, setUseMemory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imgModel, setImgModel] = useState(SERIES_VISUAL_MODELS[0].id);
  const [genImgIdx, setGenImgIdx] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => addDays(new Date(), 1));
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [batchTime, setBatchTime] = useState("09:00");
  const [seriesImage, setSeriesImage] = useState<string | null>(null);
  const [schedulingAll, setSchedulingAll] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  const filledDrafts = useMemo(
    () => drafts.map((d, i) => ({ ...d, index: i })).filter((d) => d.body.trim()),
    [drafts]
  );

  function draftDate(position: number): Date {
    return addDays(startDate, position * CADENCE_STEP[cadence]);
  }

  /** Patch d'un brouillon par index (immutable). */
  function patchDraft(i: number, patch: Partial<DraftItem>) {
    setDrafts((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function generateSeries() {
    if (!theme.trim()) {
      setBatchMsg(t("Indiquez un thème pour la série.", "Enter a theme for the series."));
      return;
    }
    setGenerating(true);
    setBatchMsg(null);
    try {
      const r = await fetch("/api/ai/linkedin-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          theme,
          count,
          language: lang,
          brandVoice: company.brandVoice ?? "",
          useMemory,
          format: seriesFormat,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBatchMsg(d.error ?? t("Échec de la génération.", "Generation failed."));
        return;
      }
      const posts = (d.posts ?? []) as { title: string; body: string; visualPrompt?: string }[];
      if (posts.length === 0) {
        setBatchMsg(t("Aucun contenu généré. Réessayez.", "Nothing generated. Try again."));
        return;
      }
      setDrafts(posts.map((p) => ({ body: p.body, visualPrompt: p.visualPrompt })));
      const kind = seriesFormat === "article" ? t("articles", "articles") : t("posts", "posts");
      setBatchMsg(
        d.mock
          ? t("Démo — IA non configurée : série d'exemple générée.", "Demo — AI not configured: sample series generated.")
          : t(`${posts.length} ${kind} générés — relisez, ajoutez des visuels, puis programmez.`, `${posts.length} ${kind} generated — review, add visuals, then schedule.`)
      );
    } finally {
      setGenerating(false);
    }
  }

  /** Génère un visuel IA pour un brouillon (à partir de son prompt visuel). */
  async function genVisual(i: number) {
    const item = drafts[i];
    const vp = (item?.visualPrompt || item?.body || theme || "").trim();
    if (!vp) {
      setBatchMsg(t("Aucun contenu pour générer un visuel.", "No content to generate a visual."));
      return;
    }
    setGenImgIdx(i);
    setBatchMsg(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: vp.slice(0, 400), platform: "linkedin", n: 1, model: imgModel, companyId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBatchMsg((d.error as string) ?? t("Échec de génération d'image.", "Image generation failed."));
        return;
      }
      const urls = extractImageUrls(d);
      if (urls.length > 0) {
        patchDraft(i, { media: urls[0] });
      } else if (d.simulated) {
        setBatchMsg(t("Génération d'images non configurée (REPLICATE_API_TOKEN).", "Image generation not configured (REPLICATE_API_TOKEN)."));
      } else {
        setBatchMsg(t("Aucune image renvoyée. Réessayez.", "No image returned. Try again."));
      }
    } catch (e) {
      setBatchMsg(e instanceof Error ? e.message : t("Échec de génération d'image.", "Image generation failed."));
    } finally {
      setGenImgIdx(null);
    }
  }

  async function scheduleAll() {
    if (filledDrafts.length === 0) {
      setBatchMsg(t("Rédigez ou générez au moins un post.", "Write or generate at least one post."));
      return;
    }
    setSchedulingAll(true);
    setBatchMsg(null);
    let ok = 0;
    let failed = 0;
    try {
      for (let i = 0; i < filledDrafts.length; i++) {
        const item = filledDrafts[i];
        const body = item.body.trim();
        // Visuel : celui propre au post (généré/choisi), sinon le visuel commun.
        const imgUrl = item.media || seriesImage || null;
        const r = await fetch("/api/scheduled-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            platform: "linkedin",
            title: titleFromBody(body),
            body,
            date: format(draftDate(i), "yyyy-MM-dd"),
            time: batchTime,
            status: "scheduled",
            source: "manual",
            media: imgUrl ? { kind: "image", url: imgUrl } : undefined,
          }),
        });
        if (r.ok) ok++;
        else failed++;
      }
      if (ok > 0) setDrafts([{ body: "" }, { body: "" }, { body: "" }]);
      setBatchMsg(
        failed === 0
          ? t(`${ok} publications programmées ✓`, `${ok} posts scheduled ✓`)
          : t(`${ok} programmées, ${failed} en échec.`, `${ok} scheduled, ${failed} failed.`)
      );
      await loadQueue();
    } finally {
      setSchedulingAll(false);
    }
  }

  /* ── Rendu ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* File d'attente */}
      <section className="card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="section-label">{t("File d'attente LinkedIn", "LinkedIn queue")}</span>
            <p className="mt-0.5 text-xs text-muted">
              {t(
                "Les publications programmées partent automatiquement (vérification toutes les 10 min).",
                "Scheduled posts go out automatically (checked every 10 min)."
              )}
            </p>
          </div>
          <button onClick={loadQueue} disabled={loadingQueue} className="btn-secondary text-xs disabled:opacity-50">
            {t("Actualiser", "Refresh")}
          </button>
        </div>

        {loadingQueue ? (
          <p className="text-sm text-muted">{t("Chargement…", "Loading…")}</p>
        ) : queue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-hair bg-canvas px-4 py-3 text-center text-sm text-muted">
            {t(
              "Aucune publication programmée. Planifiez un post depuis l'onglet Publication, ou programmez une série ci-dessous.",
              "No scheduled posts. Schedule one from the Publishing tab, or plan a series below."
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((p) => (
              <li key={p.id} className="rounded-xl border border-hair bg-canvas p-3">
                {editId === p.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={5}
                      className={inputCls}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-44">
                        <DatePicker value={editDate} onChange={setEditDate} />
                      </div>
                      <div className="w-24">
                        <TimePicker value={editTime} onChange={setEditTime} />
                      </div>
                      <button
                        onClick={saveEdit}
                        disabled={savingEdit || !editBody.trim()}
                        className="btn-primary ml-auto inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                      >
                        {savingEdit && <Spinner size={14} className="text-white" />}
                        {t("Enregistrer", "Save")}
                      </button>
                      <button onClick={() => setEditId(null)} className="btn-secondary text-xs">
                        {t("Annuler", "Cancel")}
                      </button>
                    </div>
                    {/* Visuel de la publication (bibliothèque) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {editMedia ? (
                        <span className="relative inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editMedia} alt="" className="h-14 w-14 rounded-lg border border-hair object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditMedia(null)}
                            title={t("Retirer le visuel", "Remove visual")}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-2xs text-white"
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span className="text-2xs text-muted">{t("Aucun visuel", "No visual")}</span>
                      )}
                      <MediaLibraryButton
                        companyId={companyId}
                        accept="image"
                        label={editMedia ? t("📚 Changer le visuel", "📚 Change visual") : t("📚 Ajouter un visuel", "📚 Add a visual")}
                        className="btn-secondary text-2xs"
                        onPick={(a) => setEditMedia(a.url)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    {p.media?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.media.url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg border border-hair object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-semibold text-primary-700">
                        📅 {p.date || t("Sans date", "No date")} · {p.time || "—"}
                        {p.media?.url && <span className="ml-1.5 text-muted">· 🖼️ {t("visuel", "visual")}</span>}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-ink">{p.title}</p>
                      {p.body && (
                        <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted">{p.body}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => publishNow(p.id)}
                        disabled={!canEdit || busyId === p.id}
                        title={!canEdit ? t("Lecture seule", "View only") : undefined}
                        className="btn-primary inline-flex items-center gap-1 text-2xs disabled:opacity-50"
                      >
                        {busyId === p.id && <Spinner size={12} className="text-white" />}
                        {t("Publier maintenant", "Publish now")}
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        disabled={!canEdit || busyId === p.id}
                        className="btn-secondary text-2xs disabled:opacity-50"
                      >
                        {t("Modifier", "Edit")}
                      </button>
                      <button
                        onClick={() => deletePost(p.id)}
                        disabled={!canEdit || busyId === p.id}
                        className="btn-secondary text-2xs text-danger-700 disabled:opacity-50"
                      >
                        {t("Supprimer", "Delete")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {queueMsg && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{queueMsg}</p>}
      </section>

      {/* Planificateur de lot */}
      <section className="card p-5 space-y-4">
        <div>
          <span className="section-label">{t("Programmer une série de publications", "Schedule a series of posts")}</span>
          <p className="mt-0.5 text-xs text-muted">
            {t(
              "Rédigez ou générez plusieurs posts, choisissez la date de départ et la cadence : ils seront espacés et programmés automatiquement.",
              "Write or generate several posts, pick a start date and cadence: they will be spaced out and scheduled automatically."
            )}
          </p>
        </div>

        {/* Génération IA */}
        <div className="rounded-xl border border-hair bg-canvas p-3 space-y-2">
          <p className="section-label text-ai-text">{t("✨ Générer la série avec l'IA", "✨ Generate the series with AI")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder={t("Thème de la série (ex : recrutement tech, IA en PME…)", "Series theme (e.g. tech hiring, AI for SMBs…)")}
              className={`${inputCls} min-w-[220px] flex-1`}
            />
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="rounded-lg border border-hair bg-canvas px-2 py-2 text-sm text-ink outline-none focus:border-primary-400"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} {seriesFormat === "article" ? t("articles", "articles") : t("posts", "posts")}
                </option>
              ))}
            </select>
            <button
              onClick={generateSeries}
              disabled={generating || !canEdit}
              className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
            >
              {generating && <Spinner size={14} className="text-current" />}
              {generating ? t("Génération…", "Generating…") : t("Générer", "Generate")}
            </button>
          </div>

          {/* Type de contenu (posts courts ou articles) + modèle de visuel */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1">
              <span className="text-2xs text-muted">{t("Type :", "Type:")}</span>
              {(["post", "article"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSeriesFormat(f)}
                  className={`rounded-full px-2.5 py-1 text-2xs font-medium ${seriesFormat === f ? "bg-ink text-white" : "bg-card text-muted ring-1 ring-hair hover:text-ink"}`}
                >
                  {f === "post" ? t("Posts courts", "Short posts") : t("Articles", "Articles")}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-2xs text-muted">
              {t("Modèle visuel :", "Visual model:")}
              <select
                value={imgModel}
                onChange={(e) => setImgModel(e.target.value)}
                className="rounded-lg border border-hair bg-card px-2 py-1 text-2xs text-ink outline-none focus:border-primary-400"
              >
                {SERIES_VISUAL_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-2xs text-muted">
            <input
              type="checkbox"
              checked={useMemory}
              onChange={(e) => setUseMemory(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary-600"
            />
            {t("S'appuyer sur la marque (RAG)", "Ground in brand (RAG)")}
          </label>
        </div>

        {/* Posts / articles de la série (texte + visuel par élément) */}
        <div className="space-y-2.5">
          {drafts.map((d, i) => (
            <div key={i} className="rounded-xl border border-hair bg-canvas p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xs font-bold text-primary-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <textarea
                    value={d.body}
                    onChange={(e) => patchDraft(i, { body: e.target.value })}
                    rows={seriesFormat === "article" ? 6 : 3}
                    placeholder={seriesFormat === "article" ? t(`Article ${i + 1} de la série…`, `Article ${i + 1} of the series…`) : t(`Post ${i + 1} de la série…`, `Post ${i + 1} of the series…`)}
                    className={inputCls}
                  />
                  {d.body.trim() && (
                    <p className="mt-0.5 text-2xs text-muted">
                      📅{" "}
                      {format(
                        draftDate(filledDrafts.findIndex((f) => f.index === i)),
                        "yyyy-MM-dd"
                      )}{" "}
                      · {batchTime} · {d.body.trim().length} {t("caractères", "characters")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDrafts((arr) => arr.filter((_, j) => j !== i))}
                  disabled={drafts.length <= 1}
                  title={t("Retirer cet élément", "Remove this item")}
                  className="btn-secondary mt-1 shrink-0 px-2 text-2xs disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              {/* Visuel de cet élément : généré par IA ou choisi en bibliothèque */}
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                {d.media ? (
                  <span className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.media} alt="" className="h-12 w-12 rounded-lg border border-hair object-cover" />
                    <button
                      type="button"
                      onClick={() => patchDraft(i, { media: null })}
                      title={t("Retirer le visuel", "Remove visual")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-2xs text-white"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="text-2xs text-muted">{t("Pas de visuel", "No visual")}</span>
                )}
                <button
                  onClick={() => genVisual(i)}
                  disabled={genImgIdx === i || !canEdit || !d.body.trim()}
                  className="btn-secondary inline-flex items-center gap-1 text-2xs disabled:opacity-50"
                >
                  {genImgIdx === i && <Spinner size={12} className="text-current" />}
                  {genImgIdx === i ? t("Génération…", "Generating…") : t("✨ Générer le visuel", "✨ Generate visual")}
                </button>
                <MediaLibraryButton
                  companyId={companyId}
                  accept="image"
                  label={t("📚 Bibliothèque", "📚 Library")}
                  className="btn-secondary text-2xs"
                  onPick={(a) => patchDraft(i, { media: a.url })}
                />
              </div>
            </div>
          ))}
          <button onClick={() => setDrafts((arr) => [...arr, { body: "" }])} className="btn-secondary text-2xs">
            {t("+ Ajouter un élément", "+ Add an item")}
          </button>
        </div>

        {/* Visuel commun à la série (optionnel) */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hair bg-canvas p-3">
          <span className="section-label">{t("Visuel de la série", "Series visual")}</span>
          {seriesImage ? (
            <span className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={seriesImage} alt="" className="h-14 w-14 rounded-lg border border-hair object-cover" />
              <button
                type="button"
                onClick={() => setSeriesImage(null)}
                title={t("Retirer le visuel", "Remove visual")}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-2xs text-white"
              >
                ✕
              </button>
            </span>
          ) : (
            <span className="text-2xs text-muted">{t("Aucun — posts en texte seul", "None — text-only posts")}</span>
          )}
          <MediaLibraryButton
            companyId={companyId}
            accept="image"
            label={seriesImage ? t("📚 Changer le visuel", "📚 Change visual") : t("📚 Choisir un visuel", "📚 Pick a visual")}
            className="btn-secondary text-2xs"
            onPick={(a) => setSeriesImage(a.url)}
          />
          <span className="text-2xs text-muted">{t("Visuel par défaut — utilisé pour les éléments sans visuel propre.", "Default visual — used for items without their own.")}</span>
        </div>

        {/* Cadence + programmation */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-hair bg-canvas p-3">
          <div className="w-44">
            <p className="section-label">{t("Date de départ", "Start date")}</p>
            <div className="mt-1">
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
          </div>
          <div>
            <p className="section-label">{t("Cadence", "Cadence")}</p>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="mt-1 rounded-md border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
            >
              <option value="daily">{t("Tous les jours", "Daily")}</option>
              <option value="every2">{t("Tous les 2 jours", "Every 2 days")}</option>
              <option value="weekly">{t("Toutes les semaines", "Weekly")}</option>
            </select>
          </div>
          <div className="w-24">
            <p className="section-label">{t("Heure", "Time")}</p>
            <div className="mt-1">
              <TimePicker value={batchTime} onChange={setBatchTime} />
            </div>
          </div>
          <button
            onClick={scheduleAll}
            disabled={schedulingAll || !canEdit || filledDrafts.length === 0}
            title={!canEdit ? t("Lecture seule", "View only") : undefined}
            className="btn-primary ml-auto inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {schedulingAll && <Spinner size={16} className="text-white" />}
            {schedulingAll
              ? t("Programmation…", "Scheduling…")
              : t(`Tout programmer (${filledDrafts.length})`, `Schedule all (${filledDrafts.length})`)}
          </button>
        </div>

        {batchMsg && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{batchMsg}</p>}
      </section>
    </div>
  );
}
