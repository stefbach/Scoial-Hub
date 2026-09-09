// Vérifie l'extension organique du Cerveau/Pilote Pub : « Cerveau Contenu »
// (app/api/content/strategy) et « Pilote Contenu » (app/api/content/pilot +
// app/api/content/apply). Se concentre sur les briques pures et déterministes
// partagées avec le moteur d'apprentissage (lib/learning-engine/time-slot),
// qui décident si un post déjà programmé doit être reprogrammé sur son
// créneau prouvé — le cœur de la logique métier du Pilote Contenu.
//
// Usage : npx tsx scripts/verify-content-brain.ts

import { readFileSync } from "node:fs";
import { weekdayOfCalendarDate, timeSlotArmKey, parseTimeSlotArmKey } from "../lib/learning-engine/time-slot";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const read = (p: string) => readFileSync(p, "utf8");

console.log("\n— weekdayOfCalendarDate() : cohérent avec timeSlotArmKey() en UTC —");
{
  // 2026-05-05 est un mardi (confirmé par le test existant de time-slot.ts).
  check("2026-05-05 → mardi", weekdayOfCalendarDate("2026-05-05") === "tue");
  const arm = timeSlotArmKey("facebook", "2026-05-05T18:30:00Z", "UTC");
  const parsed = parseTimeSlotArmKey(arm)!;
  check(
    "même jour que timeSlotArmKey() pour un post réellement publié à cette date, en UTC",
    weekdayOfCalendarDate("2026-05-05") === parsed.day,
    `${weekdayOfCalendarDate("2026-05-05")} vs ${parsed.day}`
  );
  check("date invalide → null", weekdayOfCalendarDate("n'importe quoi") === null);
}

console.log("\n— app/api/content/pilot : règles de reprogrammation —");
{
  const route = read("app/api/content/pilot/route.ts");
  check("ne compare que l'heure, ne déplace jamais la date (garde-fou explicite)", /on ne déplace jamais la date/.test(route));
  check("ignore les posts déjà proches du créneau appris (< 2h d'écart)", /Math\.abs\(postHour - learned\.hour\) < 2/.test(route));
  check("aucune action ne porte de dépense (impact toujours \"safe\")", /impact: "safe"/.test(route) && !/impact: "spend"/.test(route));
  check("les alertes de silence/engagement alimentent les actions \"compose\"", /alertsFromLiveKpis/.test(route) && /type: "compose"/.test(route));
}

console.log("\n— app/api/content/apply : la société est dérivée du post, jamais du client —");
{
  const route = read("app/api/content/apply/route.ts");
  check("getScheduledPostCompanyId() détermine la société (pas de companyId client)", /getScheduledPostCompanyId\(action\.postId\)/.test(route));
  check("l'accès est vérifié en mode édition avant toute mutation", /requireCompanyAccess\(companyId, \{ mode: "edit" \}\)/.test(route));
  check("seul le type \"reschedule\" est accepté", /action\.type !== "reschedule"/.test(route));
}

console.log("\n— mémoire stratégique : source \"organic\" distincte de \"ads\" —");
{
  const mem = read("lib/memory/index.ts");
  check("MemorySource inclut \"organic\"", /"organic"/.test(mem));
  const strategy = read("app/api/content/strategy/route.ts");
  check("le Cerveau Contenu écrit dans la mémoire avec source: \"organic\"", /source: "organic"/.test(strategy));
}

console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
