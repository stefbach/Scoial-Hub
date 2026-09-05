/**
 * lib/publishing/best-time.ts
 *
 * Retour client (réunion Rosiane, point #1) : suggérer un jour/heure de
 * publication, plutôt que de laisser l'utilisateur deviner.
 *
 * Deux régimes :
 *   - historique  — assez de publications MESURÉES (métriques réelles) pour
 *     ce réseau : on retient le créneau (jour de semaine × heure pleine) à la
 *     meilleure MOYENNE d'engagement — pas la somme brute, pour qu'un pic
 *     unique ne domine pas un créneau récurrent plus fiable.
 *   - par défaut  — historique insuffisant (société neuve, réseau tout juste
 *     connecté) : repli sur des repères généraux largement documentés par
 *     réseau, pas une mesure propre à cette société.
 *
 * Module pur — aucun accès réseau/base, testable directement.
 */

import type { HistoryItem, Platform, WeekDay } from "@/lib/types";

const WEEKDAYS: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // aligné sur Date.getDay()

const WEEKDAY_LABEL: Record<WeekDay, [string, string]> = {
  sun: ["dimanche", "Sunday"],
  mon: ["lundi", "Monday"],
  tue: ["mardi", "Tuesday"],
  wed: ["mercredi", "Wednesday"],
  thu: ["jeudi", "Thursday"],
  fri: ["vendredi", "Friday"],
  sat: ["samedi", "Saturday"],
};

/** Repères généraux (pas une mesure propre à la société) — un par réseau. */
const DEFAULT_BEST_TIME: Record<Platform, { day: WeekDay; time: string }> = {
  facebook: { day: "wed", time: "13:00" },
  instagram: { day: "wed", time: "11:00" },
  linkedin: { day: "tue", time: "10:00" },
  tiktok: { day: "fri", time: "18:00" },
};

/** En dessous, l'historique est trop mince pour être significatif. */
const MIN_SAMPLES = 5;

export interface BestTimeSuggestion {
  day: WeekDay;
  time: string; // HH:mm
  source: "historical" | "default";
  /** Nombre de publications mesurées ayant servi au calcul (0 en mode "default"). */
  sampleSize: number;
}

export function suggestBestTime(platform: Platform, history: HistoryItem[]): BestTimeSuggestion {
  const samples = history.filter(
    (h) => h.platform === platform && h.status === "published" && h.publishedAt && h.metrics
  );
  if (samples.length < MIN_SAMPLES) {
    const d = DEFAULT_BEST_TIME[platform] ?? DEFAULT_BEST_TIME.facebook;
    return { ...d, source: "default", sampleSize: samples.length };
  }

  const buckets = new Map<string, { day: WeekDay; hour: number; score: number; count: number }>();
  for (const h of samples) {
    const dt = new Date(h.publishedAt!);
    const day = WEEKDAYS[dt.getDay()];
    const hour = dt.getHours();
    const key = `${day}-${hour}`;
    const m = h.metrics!;
    const engagement = (m.reactions ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.linkClicks ?? 0);
    const bucket = buckets.get(key) ?? { day, hour, score: 0, count: 0 };
    bucket.score += engagement;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  // Un créneau publié UNE SEULE fois garde sa moyenne intacte quel que soit
  // le score — un unique pic isolé aurait donc battu un créneau réellement
  // récurrent. On exige au moins 2 publications dans le créneau pour le
  // considérer fiable ; sans aucun créneau récurrent, mieux vaut le repère
  // par défaut qu'un coup de chance.
  let best: { day: WeekDay; hour: number; score: number; count: number } | null = null;
  for (const b of buckets.values()) {
    if (b.count < 2) continue;
    const avg = b.score / b.count;
    const bestAvg = best ? best.score / best.count : -Infinity;
    if (avg > bestAvg) best = b;
  }
  if (!best) {
    const d = DEFAULT_BEST_TIME[platform] ?? DEFAULT_BEST_TIME.facebook;
    return { ...d, source: "default", sampleSize: samples.length };
  }
  return {
    day: best.day,
    time: `${String(best.hour).padStart(2, "0")}:00`,
    source: "historical",
    sampleSize: samples.length,
  };
}

export function weekdayLabel(day: WeekDay, t: (fr: string, en: string) => string): string {
  const [fr, en] = WEEKDAY_LABEL[day];
  return t(fr, en);
}

/**
 * Prochaine occurrence future (strictement) de ce jour/heure — aujourd'hui
 * compte si l'heure n'est pas encore passée.
 */
export function nextDateForWeekday(day: WeekDay, time: string, from: Date = new Date()): Date {
  const targetIdx = WEEKDAYS.indexOf(day);
  const [hh, mm] = time.split(":").map((v) => Number(v) || 0);
  const d = new Date(from);
  const diff = (targetIdx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hh, mm, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
  return d;
}
