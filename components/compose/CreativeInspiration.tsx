"use client";

/**
 * Sélecteur de créas existantes (vos pubs / pubs concurrents / veille) utilisées
 * comme INSPIRATION : l'IA en tire un NOUVEAU texte + un visuel original dans
 * l'identité de la marque. On ne republie jamais l'asset source.
 */

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { CreativeItem } from "@/app/api/creatives/route";
import type { UploadedMedia } from "@/components/ui/MediaUpload";

interface Inspiration {
  angle: string;
  postText: string;
  mediaPrompt: string;
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
  const [insp, setInsp] = useState<Inspiration | null>(null);
  const [genVisual, setGenVisual] = useState(false);
  const [genUrl, setGenUrl] = useState<string | null>(null);
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
    setInsp(null);
    setGenUrl(null);
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
        }),
      });
      const data = (await res.json()) as Inspiration;
      setInsp(data);
    } catch {
      setNote(t("Échec de l'inspiration IA.", "AI inspiration failed."));
    } finally {
      setInspiring(false);
    }
  }

  async function generateVisual() {
    if (!insp?.mediaPrompt) return;
    setGenVisual(true);
    setGenUrl(null);
    setNote(null);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: insp.mediaPrompt, platform }),
      });
      const data = (await res.json()) as {
        images?: Array<string | { url?: string }>;
        simulated?: boolean;
        error?: string;
      };
      const first = Array.isArray(data.images) ? data.images[0] : undefined;
      const imgUrl = typeof first === "string" ? first : first?.url;
      if (imgUrl) {
        setGenUrl(imgUrl);
        onApplyMedia({ url: imgUrl, name: "inspiration.png", size: 0, kind: "image" });
        setNote(t("Visuel généré et appliqué à l'aperçu du post.", "Visual generated and applied to the post preview."));
      } else if (data.simulated) {
        setNote(t(
          "Mode démo : la génération d'image n'est pas activée (clé REPLICATE_API_TOKEN manquante). Le brief visuel ci-dessus est prêt à l'emploi.",
          "Demo mode: image generation is off (missing REPLICATE_API_TOKEN). The visual brief above is ready to use.",
        ));
      } else {
        setNote(data.error || t("Aucune image renvoyée.", "No image returned."));
      }
    } catch {
      setNote(t("Échec de génération du visuel.", "Visual generation failed."));
    } finally {
      setGenVisual(false);
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
              "Vos pubs, celles des concurrents (Ad Library) ou les contenus de veille. L'IA en tire un nouveau post original — l'asset source n'est jamais republié.",
              "Your ads, competitors' ads (Ad Library) or watch content. The AI produces a new original post — the source asset is never reposted.",
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

          {/* Résultat de l'inspiration */}
          {inspiring && <p className="text-2xs text-ai-text">{t("Analyse de la créa et génération…", "Analyzing creative and generating…")}</p>}
          {insp && (
            <div className="space-y-2 rounded-lg border border-primary-200 bg-primary-50/40 p-3">
              {insp.angle && <p className="text-2xs font-semibold text-primary-700">{t("Angle", "Angle")} : {insp.angle}</p>}
              {insp.postText && (
                <div>
                  <p className="whitespace-pre-wrap text-xs text-ink">{insp.postText}</p>
                  <button type="button" onClick={() => onApplyText(insp.postText)} className="btn-primary mt-2 text-2xs px-2 py-1">
                    {t("Utiliser ce texte", "Use this text")}
                  </button>
                </div>
              )}
              {insp.mediaPrompt && (
                <div className="border-t border-primary-200/60 pt-2">
                  <p className="text-2xs text-muted">{t("Brief visuel", "Visual brief")} : {insp.mediaPrompt}</p>
                  <button type="button" onClick={generateVisual} disabled={genVisual} className="btn-secondary mt-2 text-2xs px-2 py-1">
                    {genVisual ? t("Génération… (≈10–30 s)", "Generating… (≈10–30 s)") : t("Générer le visuel", "Generate visual")}
                  </button>
                  {genVisual && (
                    <div className="mt-2 flex aspect-square w-32 items-center justify-center rounded-lg border border-hair bg-canvas">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-300 border-t-transparent" />
                    </div>
                  )}
                  {genUrl && !genVisual && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={genUrl} alt="visuel généré" className="mt-2 w-32 rounded-lg border border-hair" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
