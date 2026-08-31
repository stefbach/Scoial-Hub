// Retour client (réunion Rosiane, point #1) : suggérer un jour/heure de
// publication au lieu de laisser l'utilisateur deviner.
//
// Usage : npm run test:besttime

import { suggestBestTime, nextDateForWeekday } from "../lib/publishing/best-time";
import type { HistoryItem } from "../lib/types";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function published(platform: "facebook", iso: string, engagement: number): HistoryItem {
  return {
    id: `h-${iso}`,
    platform,
    body: "x",
    when: iso,
    source: "manual",
    publishedAt: iso,
    status: "published",
    metrics: { reactions: engagement, comments: 0, shares: 0, linkClicks: 0 },
  };
}

console.log("\n— suggestBestTime —");

// Historique trop mince (< 5 publications mesurées) → repli par défaut.
{
  const thin = [published("facebook", "2026-05-06T13:00:00Z", 10)]; // 1 seule
  const s = suggestBestTime("facebook", thin);
  check("historique insuffisant → source 'default'", s.source === "default", s.source);
}

// Historique suffisant : le créneau à la MEILLEURE MOYENNE gagne, pas celui
// à la plus grosse somme brute (un mercredi 13h publié 1 fois avec un pic de
// 1000 ne doit pas battre un mardi 10h publié 5 fois à ~50 en moyenne).
{
  const history: HistoryItem[] = [
    published("facebook", "2026-05-05T13:00:00Z", 1000), // mardi 13h, un seul pic
    published("facebook", "2026-05-12T10:00:00Z", 40), // mardi 10h, récurrent
    published("facebook", "2026-05-19T10:00:00Z", 60),
    published("facebook", "2026-05-26T10:00:00Z", 50),
    published("facebook", "2026-06-02T10:00:00Z", 55),
    published("facebook", "2026-06-09T10:00:00Z", 45),
  ];
  const s = suggestBestTime("facebook", history);
  check("historique suffisant → source 'historical'", s.source === "historical", s.source);
  check("le créneau récurrent (mardi 10h) l'emporte sur le pic isolé (mardi 13h)",
    s.day === "tue" && s.time === "10:00", `${s.day} ${s.time}`);
  check("sampleSize reflète le nombre de publications mesurées", s.sampleSize === 6, `${s.sampleSize}`);
}

// Un réseau sans aucun historique retombe sur son repère par défaut, distinct
// entre réseaux (pas une valeur générique copiée-collée).
{
  const ig = suggestBestTime("instagram", []);
  const li = suggestBestTime("linkedin", []);
  check("Instagram et LinkedIn ont des repères par défaut différents", ig.time !== li.time || ig.day !== li.day,
    `IG ${ig.day} ${ig.time} / LI ${li.day} ${li.time}`);
}

console.log("\n— nextDateForWeekday —");
{
  // Vendredi 2026-05-29 10:00 UTC, on vise mercredi 11:00 → doit tomber le
  // 2026-06-03 (mercredi suivant), jamais dans le passé.
  const from = new Date("2026-05-29T10:00:00Z");
  const next = nextDateForWeekday("wed", "11:00", from);
  check("tombe bien un mercredi", next.getDay() === 3, String(next.getDay()));
  check("est strictement dans le futur", next.getTime() > from.getTime());
}
{
  // Si on vise LE JOUR MÊME et que l'heure n'est pas encore passée, on reste
  // aujourd'hui plutôt que de sauter une semaine entière.
  const from = new Date("2026-05-27T08:00:00Z"); // mercredi 08:00
  const next = nextDateForWeekday("wed", "11:00", from);
  check("reste le jour même si l'heure n'est pas encore passée",
    next.toISOString().slice(0, 10) === "2026-05-27", next.toISOString());
}

console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
process.exit(failed === 0 ? 0 : 1);
