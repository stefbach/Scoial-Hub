"use client";

// components/composer/BestTimeSuggestion.tsx
//
// Boîte « meilleur créneau de publication » (retour client Rosiane #1),
// extraite de app/(organic)/compose/page.tsx pour être réutilisée dans les
// espaces réseaux (SeriesPlanner : Facebook/Instagram/TikTok) et l'espace
// LinkedIn (LinkedInScheduler) — ces écrans n'affichaient la suggestion nulle
// part avant, alors que Compose seul en bénéficiait.
//
// Deux régimes, LEARNED prioritaire :
//   - appris par le moteur d'apprentissage (Thompson Sampling, lib/learning-engine)
//   - repli local sur l'historique mesuré / un repère par défaut (lib/publishing/best-time.ts)

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { suggestBestTime, weekdayLabel, nextDateForWeekday } from "@/lib/publishing/best-time";
import type { HistoryItem, Platform, WeekDay } from "@/lib/types";

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

interface LearnedSlot {
  day: WeekDay;
  hour: number;
  confidence: number;
  sampleSize: number;
}

export interface BestTimeSuggestionProps {
  platform: Platform;
  companyId: string;
  history: HistoryItem[];
  /** Applique le créneau choisi (date déduite de day/time + l'heure elle-même). */
  onApply: (date: Date, time: string) => void;
  className?: string;
}

export function BestTimeSuggestion({ platform, companyId, history, onApply, className }: BestTimeSuggestionProps) {
  const t = useT();
  const label = PLATFORM_LABEL[platform] ?? platform;

  const [learnedSlot, setLearnedSlot] = useState<LearnedSlot | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLearnedSlot(null);
    fetch("/api/learning/best-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, platform }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { slot?: LearnedSlot } | null) => {
        if (!cancelled) setLearnedSlot(d?.slot ?? null);
      })
      .catch(() => {
        if (!cancelled) setLearnedSlot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [platform, companyId]);

  if (learnedSlot) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-2xs text-success-700 ${className ?? ""}`}
      >
        <span>
          🧠{" "}
          {t(
            `Appris par le moteur d'apprentissage pour ${label} : ${weekdayLabel(learnedSlot.day, t)} ${String(learnedSlot.hour).padStart(2, "0")}:00 (confiance ${Math.round(learnedSlot.confidence * 100)}%, ${learnedSlot.sampleSize} mesures).`,
            `Learned by the learning engine for ${label}: ${weekdayLabel(learnedSlot.day, t)} ${String(learnedSlot.hour).padStart(2, "0")}:00 (confidence ${Math.round(learnedSlot.confidence * 100)}%, ${learnedSlot.sampleSize} samples).`
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            const time = `${String(learnedSlot.hour).padStart(2, "0")}:00`;
            onApply(nextDateForWeekday(learnedSlot.day, time), time);
          }}
          className="btn-secondary shrink-0 px-2 py-1 text-2xs"
        >
          {t("Appliquer ce créneau", "Apply this slot")}
        </button>
      </div>
    );
  }

  const suggestion = suggestBestTime(platform, history);
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border-hair bg-canvas/60 px-3 py-2 text-2xs text-muted ${className ?? ""}`}>
      <span>
        💡{" "}
        {suggestion.source === "historical"
          ? t(
              `Meilleur moment d'après vos ${suggestion.sampleSize} dernières publications ${label} : ${weekdayLabel(suggestion.day, t)} ${suggestion.time}.`,
              `Best time based on your last ${suggestion.sampleSize} ${label} posts: ${weekdayLabel(suggestion.day, t)} ${suggestion.time}.`
            )
          : t(
              `Créneau généralement recommandé pour ${label} : ${weekdayLabel(suggestion.day, t)} ${suggestion.time} (pas encore assez d'historique mesuré pour l'affiner).`,
              `Generally recommended slot for ${label}: ${weekdayLabel(suggestion.day, t)} ${suggestion.time} (not enough measured history yet to refine it).`
            )}
      </span>
      <button
        type="button"
        onClick={() => onApply(nextDateForWeekday(suggestion.day, suggestion.time), suggestion.time)}
        className="btn-secondary shrink-0 px-2 py-1 text-2xs"
      >
        {t("Utiliser ce créneau", "Use this slot")}
      </button>
    </div>
  );
}
