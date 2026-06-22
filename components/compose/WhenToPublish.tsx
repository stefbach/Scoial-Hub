"use client";

// Bloc « Quand publier » de Compose : bascule Maintenant / Planifier + sélecteurs
// date & heure. Extrait de app/(organic)/compose pour alléger la page (audit).

import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { useT } from "@/lib/i18n";

export function WhenToPublish({
  when,
  onWhenChange,
  date,
  onDateChange,
  time,
  onTimeChange,
}: {
  when: "now" | "schedule";
  onWhenChange: (w: "now" | "schedule") => void;
  date: Date;
  onDateChange: (d: Date) => void;
  time: string;
  onTimeChange: (t: string) => void;
}) {
  const t = useT();
  return (
    <div>
      <div className="section-label mb-2.5">{t("Quand publier", "When to publish")}</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onWhenChange("now")}
          className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
            when === "now"
              ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
              : "border border-hair bg-card text-ink hover:bg-canvas"
          }`}
        >
          {t("Maintenant", "Now")}
        </button>
        <button
          onClick={() => onWhenChange("schedule")}
          className={`rounded-lg py-2.5 text-sm font-medium transition-all ${
            when === "schedule"
              ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
              : "border border-hair bg-card text-ink hover:bg-canvas"
          }`}
        >
          {t("Planifier", "Schedule")}
        </button>
      </div>
      {when === "schedule" && (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <DatePicker value={date} onChange={onDateChange} />
            <TimePicker value={time} onChange={onTimeChange} />
          </div>
          {/* Lève l'ambiguïté du fuseau : on planifie en heure locale. */}
          <p className="mt-1.5 text-2xs text-muted">
            {t("Heure locale", "Local time")} : {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </>
      )}
    </div>
  );
}
