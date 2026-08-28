"use client";

// Bibliothèque d'assets — recherche Pexels/Coverr/Pixabay/Unsplash, Lot A-3.
//
// La passerelle serveur (lib/assets/, chapitre 6) existe depuis le Lot A-1,
// mais rien ne la rendait atteignable : ce panneau est le premier écran client
// qui l'utilise. Recherche et acquisition passent TOUJOURS par les deux routes
// serveur — cette vue ne connaît jamais de clé de fournisseur (règle 6).
//
// Écart assumé par rapport à la « copie différée » du chapitre 6.4 : cette
// passe acquiert (rehéberge si le fournisseur l'impose) DÈS l'insertion dans
// le montage, pas au premier export. Reporter l'acquisition à l'export
// suppose de faire porter au document de projet la liste des acquisitions en
// attente — un second mécanisme que cette itération ne construit pas. Insérer
// reste un geste délibéré de l'utilisateur (pas un survol ni un aperçu) : le
// principe que la dégradation différée protège — ne rien acquérir pour un
// résultat simplement parcouru — reste respecté.

import { useCallback, useState } from "react";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import type { Provenance } from "@/lib/editor/project";
import type { AssetKind, AssetResult } from "@/lib/assets/types";

export interface AcquiredAsset {
  url: string;
  bytes?: number;
  durationSec?: number;
  provenance: Provenance;
}

const KINDS: { id: AssetKind; fr: string; en: string }[] = [
  { id: "image", fr: "Images", en: "Images" },
  { id: "video", fr: "Vidéos", en: "Videos" },
  { id: "audio", fr: "Musique", en: "Music" },
];

const PROVIDER_LABEL: Record<string, string> = {
  pexels: "Pexels", coverr: "Coverr", pixabay: "Pixabay", unsplash: "Unsplash",
};

export function AssetLibrary({
  companyId,
  lang,
  onInsert,
}: {
  companyId: string;
  lang: "fr" | "en";
  onInsert: (kind: AssetKind, asset: AcquiredAsset) => void;
}) {
  const t = useT();
  const [kind, setKind] = useState<AssetKind>("image");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<AssetResult[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState<string | null>(null);

  const search = useCallback(async (q: string, k: AssetKind, p: number, append: boolean) => {
    if (!q.trim()) return;
    setError(null);
    if (!append) setResults(null);
    try {
      const res = await fetch("/api/assets/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, query: q, kinds: [k], page: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("Recherche impossible.", "Search failed."));
        if (!append) setResults([]);
        return;
      }
      const found: AssetResult[] = Array.isArray(data.results) ? data.results : [];
      setResults((prev) => (append ? [...(prev ?? []), ...found] : found));
      setSearched(true);
    } catch {
      setError(t("Erreur réseau.", "Network error."));
      if (!append) setResults([]);
    }
  }, [companyId, t]);

  const submit = useCallback(() => {
    setPage(1);
    search(query, kind, 1, false);
  }, [query, kind, search]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    search(query, kind, next, true);
  }, [query, kind, page, search]);

  const insert = useCallback(async (asset: AssetResult) => {
    const key = `${asset.provider}:${asset.providerId}`;
    setInserting(key);
    setError(null);
    try {
      const res = await fetch("/api/assets/acquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, asset }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("Acquisition impossible.", "Couldn't acquire this asset."));
        return;
      }
      onInsert(asset.kind, {
        url: data.url,
        bytes: data.bytes ?? asset.bytes,
        durationSec: asset.durationSec,
        provenance: data.provenance,
      });
    } catch {
      setError(t("Erreur réseau.", "Network error."));
    } finally {
      setInserting(null);
    }
  }, [companyId, onInsert, t]);

  return (
    <div className="space-y-2">
      <div className="studio-seg">
        {KINDS.map((k) => (
          <button
            key={k.id} type="button" data-active={kind === k.id}
            onClick={() => { setKind(k.id); if (query.trim()) { setPage(1); search(query, k.id, 1, false); } }}
            className="studio-seg-btn"
          >{lang === "en" ? k.en : k.fr}</button>
        ))}
      </div>

      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={t("Rechercher (ex. « plage », « bureau »)…", "Search (e.g. “beach”, “office”)…")}
          aria-label={t("Rechercher un média", "Search for media")}
          className="input min-w-0 flex-1 text-xs"
        />
        <button type="button" onClick={submit} disabled={!query.trim()} className="btn-secondary shrink-0 text-xs disabled:opacity-50">
          🔍
        </button>
      </div>

      {!searched && !error && (
        <p className="px-1 text-2xs text-muted">
          {t(
            "Photos et vidéos libres de droits, musiques et effets. Un fournisseur non configuré reste simplement absent des résultats.",
            "Royalty-free photos, videos, music and effects. An unconfigured provider is simply absent from results."
          )}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-warning-50 px-2.5 py-1.5 text-2xs text-warning-700 ring-1 ring-warning-200">{error}</p>
      )}

      {results === null && searched && (
        <div className="flex h-24 items-center justify-center gap-2 text-2xs text-muted">
          <Spinner size={14} className="text-page" /> {t("Recherche…", "Searching…")}
        </div>
      )}

      {results !== null && results.length === 0 && !error && (
        <p className="px-1 text-2xs text-muted">
          {t("Aucun résultat pour cette recherche.", "No results for this search.")}
        </p>
      )}

      {results !== null && results.length > 0 && (
        <>
          <div className={kind === "audio" ? "space-y-1.5" : "grid grid-cols-2 gap-1.5"}>
            {results.map((r) => {
              const key = `${r.provider}:${r.providerId}`;
              const busy = inserting === key;
              return kind === "audio" ? (
                <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-hair p-2">
                  <div className="min-w-0">
                    <p className="truncate text-2xs font-medium text-ink">🎵 {PROVIDER_LABEL[r.provider] ?? r.provider}</p>
                    {r.author && <p className="truncate text-[10px] text-muted">{r.author}</p>}
                  </div>
                  <button
                    type="button" onClick={() => insert(r)} disabled={busy}
                    className="btn-secondary shrink-0 text-2xs disabled:opacity-50"
                  >{busy ? <Spinner size={12} /> : t("Insérer", "Insert")}</button>
                </div>
              ) : (
                <div key={key} className="group relative overflow-hidden rounded-lg border border-hair bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.previewUrl} alt="" className="h-20 w-full object-cover" loading="lazy" />
                  <span className="absolute left-1 top-1 rounded bg-ink/70 px-1 py-0.5 text-[9px] font-semibold text-white">
                    {PROVIDER_LABEL[r.provider] ?? r.provider}
                  </span>
                  <button
                    type="button" onClick={() => insert(r)} disabled={busy}
                    className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition-all group-hover:bg-ink/45 group-hover:opacity-100 disabled:opacity-100"
                  >
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-2xs font-semibold text-ink shadow-sm">
                      {busy ? <Spinner size={12} /> : t("Insérer", "Insert")}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={loadMore} className="w-full text-2xs text-muted hover:text-ink hover:underline">
            {t("Voir plus →", "See more →")}
          </button>
          {results.some((r) => r.attributionRequired) && (
            <p className="px-1 text-[10px] text-muted">
              {t(
                "Certains résultats exigent une attribution — auteur et licence sont conservés à l'insertion.",
                "Some results require attribution — author and licence are kept at insertion."
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
