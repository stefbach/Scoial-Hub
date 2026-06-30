// Test autonome de la conversion de fuseau pour la programmation des posts.
// Vérifie qu'un post saisi « 09:00 » dans la zone de référence devient « dû »
// quand l'heure murale de cette zone atteint 09:00 — quel que soit le fuseau
// du serveur (UTC sur Vercel). Lancement : npx tsx scripts/verify-schedule-timezone.ts

import { wallClockInZone } from "../lib/publishing/publish-scheduled";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// Reproduit la logique isDue du cron : un post est dû si "date T time" <= clé murale.
const isDue = (postDate: string, postTime: string, now: Date, tz: string) =>
  `${postDate}T${postTime}` <= wallClockInZone(now, tz).key;

console.log("\n— 1) Conversion d'instant en heure murale —");
const t0530 = new Date("2026-06-30T05:30:00Z");
check("UTC : 05:30", wallClockInZone(t0530, "UTC").key === "2026-06-30T05:30", wallClockInZone(t0530, "UTC").key);
check("Maurice (UTC+4) : 09:30", wallClockInZone(t0530, "Indian/Mauritius").key === "2026-06-30T09:30", wallClockInZone(t0530, "Indian/Mauritius").key);
check("Paris (UTC+2 été) : 07:30", wallClockInZone(t0530, "Europe/Paris").key === "2026-06-30T07:30", wallClockInZone(t0530, "Europe/Paris").key);

console.log("\n— 2) Post « 09:00 Maurice » : dû au bon moment (et pas avant) —");
const tz = "Indian/Mauritius";
// 04:00 UTC = 08:00 Maurice → PAS encore dû.
check("à 08:00 Maurice (04:00 UTC) → pas dû", isDue("2026-06-30", "09:00", new Date("2026-06-30T04:00:00Z"), tz) === false);
// 05:00 UTC = 09:00 Maurice → dû.
check("à 09:00 Maurice (05:00 UTC) → dû", isDue("2026-06-30", "09:00", new Date("2026-06-30T05:00:00Z"), tz) === true);
// 06:00 UTC = 10:00 Maurice → toujours dû.
check("à 10:00 Maurice (06:00 UTC) → dû", isDue("2026-06-30", "09:00", new Date("2026-06-30T06:00:00Z"), tz) === true);

console.log("\n— 3) Régression évitée : sans fuseau (UTC), le post partait en retard —");
// En UTC, le post « 09:00 » n'était dû qu'à 09:00 UTC = 13:00 Maurice (4h de retard).
check("UTC : pas dû à 05:00 UTC (l'ancien bug)", isDue("2026-06-30", "09:00", new Date("2026-06-30T05:00:00Z"), "UTC") === false);
check("UTC : dû seulement à 09:00 UTC", isDue("2026-06-30", "09:00", new Date("2026-06-30T09:00:00Z"), "UTC") === true);

console.log("\n— 4) Fuseau invalide → repli UTC, pas de crash —");
check("fuseau bidon → repli UTC", wallClockInZone(t0530, "Pas/UnFuseau").key === "2026-06-30T05:30");

console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
process.exit(failed === 0 ? 0 : 1);
