"use client";

/**
 * Sélecteur de créas existantes (vos pubs / pubs concurrents / veille) utilisées
 * comme INSPIRATION : l'IA en tire PLUSIEURS propositions originales (texte +
 * brief visuel) dans l'identité de la marque, chacune déclinable en IMAGE ou
 * VIDÉO. On ne republie jamais l'asset source.
 */

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { CreativeItem } from "@/app/api/creatives/route";
import type { UploadedMedia } from "@/components/ui/MediaUpload";

interface Proposal {
  angle: string;
  postText: string;
  mediaPrompt: string;
}

interface GenState {
  loading: boolean;
  url: string | null;
  kind: "image" | "video";
  note: string | null;
}

export function CreativeInspiration({
  companyId,
  brandVoice,
  platform,
  onApplyText,
  onApplyMedia,
}: {
  companyId: string;
  brandVoice: string;
  platform: "facebook" | "instagram" | "linkedin";
  onApplyText: (text: string) => void;
  onApplyMedia: (media: UploadedMedia) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatives, setCreatives] = useState<CreativeItem[]>([]);
  const [selected, setSelected] = useState<CreativeItem | null>(null);
  const [inspiring, setInspiring] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [gen, setGen] = useState<Record<number, GenState>>({});
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNote(null);
    try {
      const url = `/api/creatives?companyId=${encodeURIComponent(companyId)}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;
      const res = await fetch(url);
      const data = (await res.json()) as { creatives?: CreativeItem[] };
      setCreatives(data.creatives ?? []);
      if ((data.creatives ?? []).length === 0) {
        setNote(t(
          "Aucune créa. Tapez une marque/concurrent ci-dessus, ou lancez une veille pour récupérer des contenus.",
          "No creatives. Type a brand/competitor above, or run a watch to collect content.",
        ));
      }
    } catch {
      setNote(t("Erreur de chargement.", "Loading error."));
    } finally {
      setLoading(false);
    }
  }, [companyId, q, t]);

  // Premier chargement (veille) à l'ouverture du panneau.
  useEffect(() => {
    if (open && creatives.length === 0 && !loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function inspire(c: CreativeItem) {
    setSelected(c);
    setProposals([]);
    setGen({});
    setNote(null);
    setInspiring(true);
    try {
      const res = await fetch("/api/ai/inspire-from-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          caption: c.caption,
          mediaType: c.mediaType,
          platform,
          origin: c.origin,
          source: c.source,
          brandVoice,
          count: 3,
        }),
      });
      const data = (await res.json()) as { proposals?: Proposal[] };
      setProposals(data.proposals ?? []);
      if ((data.proposals ?? []).length === 0) {
        setNote(t("Aucune proposition générée.", "No proposal generated."));
      }
    } catch {
      setNote(t("Échec de l'inspiration IA.", "AI inspiration failed."));
    } finally {
      setInspiring(false);
    }
  }

  async function generateMedia(index: number, kind: "image" | "video") {
    const p = proposals[index];
    if (!p?.mediaPrompt) return;
    setGen((g) => ({ ...g, [index]: { loading: true, url: null, kind, note: null } }));
    try {
      const endpoint = kind === "video" ? "/api/ai/generate-video" : "/api/ai/generate-image";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p.mediaPrompt, platform }),
      });
      const data = (await res.json()) as {
        images?: Array<string | { url?: string }>;
        video?: { url?: string };
        simulated?: boolean;
        error?: string;
      };
      let url: string | undefined;
      if (kind === "video") {
        url = data.video?.url;
      } else {
        const first = Array.isArray(data.images) ? data.images[0] : undefined;
        url = typeof first === "string" ? first : first?.url;
      }
      if (url) {
        onApplyMedia({
          url,
          name: kind === "video" ? "inspiration.mp4" : "inspiration.png",
          size: 0,
          kind,
        });
        setGen((g) => ({
          ...g,
          [index]: { loading: false, url: url!, kind, note: t("Appliqué à l'aperçu du post.", "Applied to the post preview.") },
        }));
      } else {
        setGen((g) => ({
          ...g,
          [index]: {
            loading: false,
            url: null,
            kind,
            note: data.simulated
              ? t(
                  "Mode démo : génération non activée (clé REPLICATE_API_TOKEN manquante). Le brief est prêt à l'emploi.",
                  "Demo mode: generation off (missing REPLICATE_API_TOKEN). The brief is ready to use.",
                )
              : data.error || t("Aucun média renvoyé.", "No media returned."),
          },
        }));
      }
    } catch {
      setGen((g) => ({
        ...g,
        [index]: { loading: false, url: null, kind, note: t("Échec de génération.", "Generation failed.") },
      }));
    }
  }

  return (
    <div className="rounded-lg border border-hair bg-canvas/60 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-semibold text-ink">
          ✨ {t("S'inspirer d'une créa existante", "Get inspired by an existing creative")}
        </span>
        <span className="text-2xs text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-2xs leading-snug text-muted">
            {t(
              "Vos pubs, celles des concurrents (Ad Library) ou les contenus de veille. L'IA en tire plusieurs posts originaux — l'asset source n'est jamais republié.",
              "Your ads, competitors' ads (Ad Library) or watch content. The AI produces several original posts — the source asset is never reposted.",
            )}
          </p>

          {/* Recherche pubs */}
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder={t("Marque ou concurrent (ex : votre marque, un concurrent)…", "Brand or competitor…")}
              className="input flex-1 text-sm"
            />
            <button type="button" onClick={load} disabled={loading} className="btn-secondary text-xs">
              {loading ? t("Chargement…", "Loading…") : t("Chercher", "Search")}
            </button>
          </div>

          {note && <p className="text-2xs text-muted">{note}</p>}

          {/* Grille de créas */}
          {creatives.length > 0 && (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {creatives.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => inspire(c)}
                  className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
                    selected?.id === c.id ? "border-primary-400 ring-2 ring-primary-500/30" : "border-hair hover:border-primary-200"
                  }`}
                  title={c.caption}
                >
                  <div className="aspect-square bg-canvas">
                    {c.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnailUrl} alt={c.origin} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="absolute left-1 top-1 flex gap-1">
                    <span className="rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white">
                      {c.source === "ad" ? t("Pub", "Ad") : t("Veille", "Watch")}
                    </span>
                    {c.mediaType === "video" && (
                      <span className="rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">▶</span>
                    )}
                  </div>
                  <div className="truncate px-1.5 py-1 text-[10px] text-muted">{c.origin}</div>
                </button>
              ))}
            </div>
          )}

          {/* Propositions */}
          {inspiring && (
            <p className="text-2xs text-ai-text">
              {t("Analyse de la créa et génération de plusieurs propositions…", "Analyzing creative and generating several proposals…")}
            </p>
          )}

          {proposals.length > 0 && (
            <div className="space-y-2">
              <p className="text-2xs font-semibold text-ink">
                {t(`${proposals.length} propositions`, `${proposals.length} proposals`)}
              </p>
              {proposals.map((p, i) => {
                const g = gen[i];
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-primary-200 bg-primary-50/40 p-3">
                    {p.angle && (
                      <p className="text-2xs font-semibold text-primary-700">
                        {t("Proposition", "Proposal")} {i + 1} · {p.angle}
                      </p>
                    )}
                    {p.postText && (
                      <div>
                        <p className="whitespace-pre-wrap text-xs text-ink">{p.postText}</p>
                        <button
                          type="button"
                          onClick={() => onApplyText(p.postText)}
                          className="btn-primary mt-2 text-2xs px-2 py-1"
                        >
                          {t("Utiliser ce texte", "Use this text")}
                        </button>
                      </div>
                    )}
                    {p.mediaPrompt && (
                      <div className="border-t border-primary-200/60 pt-2">
                        <p className="text-2xs text-muted">{t("Brief visuel", "Visual brief")} : {p.mediaPrompt}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => generateMedia(i, "image")}
                            disabled={g?.loading}
                            className="btn-secondary text-2xs px-2 py-1"
                          >
                            {g?.loading && g.kind === "image" ? t("Image…", "Image…") : t("🖼️ Générer image", "🖼️ Generate image")}
                          </button>
                          <button
                            type="button"
                            onClick={() => generateMedia(i, "video")}
                            disabled={g?.loading}
                            className="btn-secondary text-2xs px-2 py-1"
                          >
                            {g?.loading && g.kind === "video" ? t("Vidéo… (≈1 min)", "Video… (≈1 min)") : t("🎬 Générer vidéo", "🎬 Generate video")}
                          </button>
                        </div>
                        {g?.loading && (
                          <div className="mt-2 flex aspect-square w-32 items-center justify-center rounded-lg border border-hair bg-canvas">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-300 border-t-transparent" />
                          </div>
                        )}
                        {g?.url && !g.loading && (
                          g.kind === "video" ? (
                            <video src={g.url} controls className="mt-2 w-32 rounded-lg border border-hair" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={g.url} alt="visuel généré" className="mt-2 w-32 rounded-lg border border-hair" />
                          )
                        )}
                        {g?.note && <p className="mt-1 text-2xs text-muted">{g.note}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
