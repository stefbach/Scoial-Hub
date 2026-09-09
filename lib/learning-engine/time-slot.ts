// lib/learning-engine/time-slot.ts
//
// Clé de bras pour la dimension "time_slot" : "<plateforme>-<jour>-<heure>"
// (ex. "facebook-tue-18"), calculée dans un fuseau horaire donné. Préfixée
// par plateforme — le meilleur créneau Instagram n'a aucune raison de
// coïncider avec celui de LinkedIn, un bras partagé mélangerait des
// comportements d'audience distincts.
//
// Partagé entre le cron qui alimente l'apprentissage
// (app/api/cron/learning-sync) et l'endpoint qui expose le meilleur créneau
// appris (app/api/learning/best-slot) : construction et lecture de la clé
// doivent rester identiques aux deux endroits.

import type { Platform, WeekDay } from "@/lib/types";

const WEEKDAY_KEYS: readonly WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Clé de bras pour un post publié à `iso` (ISO 8601), dans le fuseau `timeZone`. */
export function timeSlotArmKey(platform: Platform, iso: string, timeZone: string): string {
  const d = new Date(iso);
  let weekday: WeekDay = "sun";
  let hour = "00";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const w = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3);
    if (w && (WEEKDAY_KEYS as readonly string[]).includes(w)) weekday = w as WeekDay;
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h) hour = (h === "24" ? "00" : h).padStart(2, "0");
  } catch {
    // Fuseau invalide → repli sur le créneau par défaut ci-dessus.
  }
  return `${platform}-${weekday}-${hour}`;
}

/** Préfixe filtrant les bras d'UNE plateforme (cf. lib/learning-engine/store.ts `listArms`). */
export function timeSlotPrefix(platform: Platform): string {
  return `${platform}-`;
}

/** Reconstitue {day, hour} depuis une clé de bras "<plateforme>-<jour>-<heure>", ou null si invalide. */
export function parseTimeSlotArmKey(armKey: string): { day: WeekDay; hour: number } | null {
  const parts = armKey.split("-");
  if (parts.length < 3) return null;
  const hourStr = parts[parts.length - 1];
  const dayStr = parts[parts.length - 2];
  const hour = Number(hourStr);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!(WEEKDAY_KEYS as readonly string[]).includes(dayStr)) return null;
  return { day: dayStr as WeekDay, hour };
}

/**
 * Jour de semaine d'une date calendaire "YYYY-MM-DD", indépendant du fuseau :
 * les posts programmés stockent déjà `date`/`time` en heure murale (cf.
 * lib/publishing/publish-scheduled.ts `wallClockInZone`), donc le jour de la
 * date elle-même n'a pas besoin d'une seconde conversion de fuseau. Utilisé
 * par le Pilote Contenu (app/api/content/pilot) pour comparer un post déjà
 * programmé au créneau appris par le moteur d'apprentissage.
 */
export function weekdayOfCalendarDate(dateStr: string): WeekDay | null {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAY_KEYS[d.getUTCDay()];
}
