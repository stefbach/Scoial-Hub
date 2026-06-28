"use client";

// /series — Séries multi-réseaux : générer une série (posts/articles) + visuels
// et la diffuser, adaptée aux contraintes de chaque réseau. LinkedIn garde son
// espace dédié (studio article) ; cette page couvre les autres réseaux.

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/lib/i18n";
import { SeriesPlanner } from "@/components/series/SeriesPlanner";
import { SERIES_CONFIG, type SeriesPlatform } from "@/lib/social-series";

const ORDER: SeriesPlatform[] = ["facebook", "instagram", "twitter", "pinterest", "tiktok"];

export default function SeriesPage() {
  const t = useT();
  const [platform, setPlatform] = useState<SeriesPlatform>("facebook");
  const cfg = SERIES_CONFIG[platform];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t("Séries de publications", "Post series")} />

      <p className="text-sm text-muted">
        {t(
          "Générez une série de publications cohérentes (avec visuels) pour un réseau, adaptée à ses contraintes — puis programmez ou publiez.",
          "Generate a coherent series of posts (with visuals) for a network, adapted to its constraints — then schedule or publish."
        )}
      </p>

      {/* Sélecteur de réseau */}
      <div className="flex flex-wrap gap-2">
        {ORDER.map((p) => {
          const c = SERIES_CONFIG[p];
          const on = p === platform;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-primary-400 bg-primary-50 text-primary-700" : "border-hair text-muted hover:bg-canvas"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Bandeau contrainte du réseau choisi */}
      <div className="rounded-xl border border-ai-text/20 bg-ai-textbg px-4 py-2.5 text-xs text-ai-text">
        {t(
          `${cfg.label} · ${cfg.maxChars} caractères max`,
          `${cfg.label} · ${cfg.maxChars} chars max`
        )}
        {cfg.media === "image" && t(" · image obligatoire par publication", " · image required per post")}
        {cfg.media === "video" && t(" · vidéo obligatoire (depuis la bibliothèque)", " · video required (from library)")}
        {cfg.delivery === "schedule"
          ? t(" · programmation automatique", " · automatic scheduling")
          : t(" · publication immédiate (programmation auto à venir)", " · immediate publishing (auto-scheduling coming)")}
      </div>

      {/* Le planificateur générique se reconfigure selon le réseau */}
      <SeriesPlanner key={platform} platform={platform} />
    </div>
  );
}
