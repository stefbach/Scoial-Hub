// Moteur d'apprentissage quantitatif (lib/learning-engine) : vérifie le
// bandit bayésien (Thompson Sampling), la normalisation des rewards, et
// l'intégration recommend()/recordOutcome() (magasin en mémoire — aucune
// dépendance Supabase n'est configurée dans cet environnement de test).
//
// Usage : npm run test:learningengine

import { newArm, updateArm, armMean, armSampleSize, selectArm, sampleBeta, type ArmStat } from "../lib/learning-engine/bandit";
import { engagementReward, adReward } from "../lib/learning-engine/reward";
import { recommend, recordOutcome, bestLearnedArm } from "../lib/learning-engine";
import { timeSlotArmKey, timeSlotPrefix, parseTimeSlotArmKey } from "../lib/learning-engine/time-slot";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

/** RNG seedé (mulberry32) — déterminisme total, aucune dépendance externe. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log("\n— bandit.ts : prior & mise à jour bayésienne —");
{
  const a = newArm("x");
  check("prior neutre Beta(1,1)", a.alpha === 1 && a.beta === 1);
  check("espérance du prior = 0.5 (aucune donnée)", armMean(a) === 0.5);
  check("aucun échantillon au départ", armSampleSize(a) === 0);
}
{
  const success = updateArm(newArm("x"), 1);
  check("reward=1 → alpha+1, beta inchangé", success.alpha === 2 && success.beta === 1, `${success.alpha}/${success.beta}`);
  const failure = updateArm(newArm("x"), 0);
  check("reward=0 → beta+1, alpha inchangé", failure.alpha === 1 && failure.beta === 2, `${failure.alpha}/${failure.beta}`);
  const partial = updateArm(newArm("x"), 0.5);
  check("reward=0.5 → alpha et beta +0.5 chacun", partial.alpha === 1.5 && partial.beta === 1.5, `${partial.alpha}/${partial.beta}`);
  const clipped = updateArm(newArm("x"), 5); // reward hors [0,1] doit être clippé
  check("reward hors bornes clippé à 1", clipped.alpha === 2 && clipped.beta === 1, `${clipped.alpha}/${clipped.beta}`);
}
{
  let arm = newArm("x");
  for (let i = 0; i < 7; i++) arm = updateArm(arm, i % 2 === 0 ? 1 : 0);
  check("armSampleSize compte exactement les mises à jour (alpha+beta-2)", armSampleSize(arm) === 7, `${armSampleSize(arm)}`);
}

console.log("\n— bandit.ts : sampleBeta reste dans [0,1] —");
{
  const rng = seededRng(42);
  let outOfRange = 0;
  for (let i = 0; i < 500; i++) {
    const s = sampleBeta(3, 7, rng);
    if (s < 0 || s > 1) outOfRange++;
  }
  check("500 tirages Beta(3,7) tous dans [0,1]", outOfRange === 0, `${outOfRange} hors bornes`);
}

console.log("\n— bandit.ts : selectArm converge vers le meilleur bras (Thompson Sampling) —");
{
  // Bras "bon" mesuré fiable (~90% de succès) vs bras "mauvais" (~10%) : sur de
  // nombreux tirages, Thompson Sampling doit très largement préférer le bon bras.
  const good: ArmStat = { armKey: "good", alpha: 91, beta: 11 }; // ~90 mesures
  const bad: ArmStat = { armKey: "bad", alpha: 11, beta: 91 };
  const rng = seededRng(7);
  let goodPicks = 0;
  const trials = 300;
  for (let i = 0; i < trials; i++) {
    if (selectArm([good, bad], rng).armKey === "good") goodPicks++;
  }
  const ratio = goodPicks / trials;
  check("le bras à forte espérance est choisi dans au moins 85% des tirages",
    ratio >= 0.85, `${(ratio * 100).toFixed(1)}%`);
}
{
  // Deux bras encore incertains (peu de données) : Thompson Sampling doit
  // explorer les deux, pas se figer sur un seul (contraste avec le cas ci-dessus).
  const a: ArmStat = newArm("a");
  const b: ArmStat = newArm("b");
  const rng = seededRng(123);
  let aPicks = 0;
  const trials = 300;
  for (let i = 0; i < trials; i++) {
    if (selectArm([a, b], rng).armKey === "a") aPicks++;
  }
  const ratio = aPicks / trials;
  check("deux bras à prior identique sont explorés de façon comparable (40–60%)",
    ratio > 0.4 && ratio < 0.6, `${(ratio * 100).toFixed(1)}%`);
}

console.log("\n— reward.ts : normalisation organique —");
{
  const r = engagementReward({ reactions: 40, comments: 5, shares: 5, reach: 100 });
  check("engagementReward = interactions / reach quand la portée est connue", Math.abs(r - 0.5) < 1e-9, `${r}`);
  const clipped = engagementReward({ reactions: 1000, reach: 100 });
  check("engagementReward plafonné à 1", clipped === 1, `${clipped}`);
  const noReach = engagementReward({ reactions: 0, comments: 0, shares: 0 });
  check("aucune interaction sans portée connue → reward 0", noReach === 0, `${noReach}`);
  const someNoReach = engagementReward({ reactions: 50 });
  check("repli logarithmique sans portée connue reste dans [0,1]", someNoReach > 0 && someNoReach <= 1, `${someNoReach}`);
}

console.log("\n— reward.ts : normalisation publicitaire —");
{
  const zero = adReward({ impressions: 0, clicks: 10, conversions: 5 });
  check("aucune impression → reward 0 (évite une division par zéro silencieuse)", zero === 0, `${zero}`);
  const excellent = adReward({ impressions: 1000, clicks: 150, conversions: 150 }); // CTR 15%, conv 100%
  check("performance excellente (CTR et conversion au-delà des plafonds) → reward 1", excellent === 1, `${excellent}`);
  const mediocre = adReward({ impressions: 1000, clicks: 10, conversions: 0 }); // CTR 1%, 0 conversion
  check("performance faible → reward proche de 0", mediocre < 0.2, `${mediocre}`);
  const weighted = adReward({ impressions: 1000, clicks: 100, conversions: 100 }, { ctr: 1, convRate: 0 });
  check("poids configurables : conversion ignorée si convRate=0", Math.abs(weighted - 1) < 1e-9, `${weighted}`); // CTR 10% → ctrScore=1
}

console.log("\n— index.ts : recommend()/recordOutcome() (magasin en mémoire) —");
(async () => {
  {
    const r = await recommend("test-co-empty", "ad_campaign", []);
    check("recommend() sans candidat renvoie null", r === null);
  }
  {
    const companyId = `test-co-${Date.now()}-coldstart`;
    const r = await recommend(companyId, "ad_campaign", [{ armKey: "camp-a" }, { armKey: "camp-b" }]);
    check("historique insuffisant → source 'cold_start'", r?.source === "cold_start", r?.source);
    check("cold start retient le premier candidat", r?.armKey === "camp-a", r?.armKey);
  }
  {
    const companyId = `test-co-${Date.now()}-learn`;
    // "camp-a" performe nettement mieux (reward≈1) que "camp-b" (reward≈0),
    // sur suffisamment de mesures pour dépasser le seuil de cold start.
    for (let i = 0; i < 8; i++) await recordOutcome(companyId, "ad_campaign", "camp-a", 1, { i });
    for (let i = 0; i < 8; i++) await recordOutcome(companyId, "ad_campaign", "camp-b", 0, { i });

    const rng = seededRng(99);
    let pickA = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const rec = await recommend(companyId, "ad_campaign", [{ armKey: "camp-a" }, { armKey: "camp-b" }], rng);
      if (rec?.source === "learned" && rec.armKey === "camp-a") pickA++;
    }
    const ratio = pickA / trials;
    check("après apprentissage, la campagne la plus performante est recommandée dans au moins 85% des cas",
      ratio >= 0.85, `${(ratio * 100).toFixed(1)}%`);

    const rec = await recommend(companyId, "ad_campaign", [{ armKey: "camp-a" }, { armKey: "camp-b" }]);
    check("source 'learned' une fois le seuil de mesures dépassé", rec?.source === "learned", rec?.source);
    check("sampleSize reflète les résultats enregistrés pour le bras choisi",
      (rec?.sampleSize ?? 0) >= 8, `${rec?.sampleSize}`);
  }

  console.log("\n— index.ts : bestLearnedArm() (classement, pas un choix bandit) —");
  {
    const r = await bestLearnedArm("test-co-empty-best", "time_slot", "facebook-");
    check("aucun bras connu → null", r === null);
  }
  {
    const companyId = `test-co-${Date.now()}-bestarm`;
    // "facebook-tue-18" nettement meilleur que "facebook-wed-09", au-delà du
    // seuil minimal ; "facebook-fri-20" a un excellent reward mais trop peu
    // de mesures pour être retenu (bruit non significatif).
    for (let i = 0; i < 6; i++) await recordOutcome(companyId, "time_slot", "facebook-tue-18", 0.9, {});
    for (let i = 0; i < 6; i++) await recordOutcome(companyId, "time_slot", "facebook-wed-09", 0.2, {});
    await recordOutcome(companyId, "time_slot", "facebook-fri-20", 1, {});

    const best = await bestLearnedArm(companyId, "time_slot", "facebook-");
    check("retient le bras à la meilleure espérance PARMI les bras suffisamment mesurés",
      best?.armKey === "facebook-tue-18", best?.armKey);
    check("ignore un bras au reward élevé mais sous le seuil de mesures",
      best?.armKey !== "facebook-fri-20");

    const scopedToOtherPlatform = await bestLearnedArm(companyId, "time_slot", "linkedin-");
    check("le préfixe de plateforme isole bien les bras entre réseaux",
      scopedToOtherPlatform === null);
  }

  console.log("\n— time-slot.ts : clé de bras et parsing —");
  {
    // Mardi 2026-05-05 18:30 UTC, fuseau UTC — attendu "facebook-tue-18".
    const key = timeSlotArmKey("facebook", "2026-05-05T18:30:00Z", "UTC");
    check("clé construite : <plateforme>-<jour>-<heure>", key === "facebook-tue-18", key);
    check("timeSlotPrefix() correspond au préfixe de la clé construite",
      key.startsWith(timeSlotPrefix("facebook")));

    const parsed = parseTimeSlotArmKey(key);
    check("parseTimeSlotArmKey() retrouve le jour", parsed?.day === "tue", parsed?.day);
    check("parseTimeSlotArmKey() retrouve l'heure", parsed?.hour === 18, `${parsed?.hour}`);

    check("clé invalide → null", parseTimeSlotArmKey("n'importe quoi") === null);
  }

  console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
