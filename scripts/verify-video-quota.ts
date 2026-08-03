// Vérifie le quota de vidéo générée par IA (lib/plans.ts, lib/quota/video-seconds.ts,
// migration 0011) — le SEUL poste au coût unitaire significatif du produit.
//
// Ce qui est vérifié :
//   1. Les plafonds par formule et la priorité du quota explicite.
//   2. La durée FACTURÉE par modèle : c'est la durée réellement produite, pas
//      celle demandée (Veo 3 sort ~8 s quoi qu'on demande) — sans quoi un quota
//      « en nombre de vidéos » se contournerait avec des vidéos plus longues.
//   3. La période de décompte (mois calendaire UTC).
//   4. Le comportement de la réservation face au plafond, y compris en
//      CONCURRENCE : deux demandes simultanées ne doivent jamais dépasser.
//
// Usage : npm run test:videoquota

import {
  PLAN_VIDEO_SECONDS,
  videoSecondsQuota,
  usagePeriod,
  toPlanId,
  isPlanId,
} from "../lib/plans";
import { getVideoModel, videoSecondsFor, DEFAULT_VIDEO_SECONDS } from "../lib/ai/model-catalog";

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/**
 * Réimplémentation fidèle de la fonction SQL sh_reserve_video_seconds, pour
 * éprouver la LOGIQUE de réservation sans base. Le verrou `for update` de la
 * migration est simulé par une file : c'est précisément ce qu'il garantit —
 * les demandes d'une même société sont traitées l'une après l'autre.
 */
function makeCounter(quota: number) {
  let used = 0;
  let busy: Promise<void> = Promise.resolve();
  return {
    get used() { return used; },
    async reserve(seconds: number): Promise<{ allowed: boolean; used: number }> {
      let release!: () => void;
      const mine = new Promise<void>((r) => (release = r));
      const previous = busy;
      busy = busy.then(() => mine);
      await previous;
      // Section critique (équivalent du `for update` sur la ligne du compteur).
      await new Promise((r) => setTimeout(r, 1));
      const allowed = used + seconds <= quota;
      if (allowed) used += seconds;
      const snapshot = used;
      release();
      return { allowed, used: snapshot };
    },
  };
}

/** Variante SANS verrou — sert à prouver que le verrou est indispensable. */
function makeUnlockedCounter(quota: number) {
  let used = 0;
  return {
    get used() { return used; },
    async reserve(seconds: number): Promise<{ allowed: boolean; used: number }> {
      const seen = used;                                   // lecture
      await new Promise((r) => setTimeout(r, 1));          // latence réseau
      const allowed = seen + seconds <= quota;
      if (allowed) used = seen + seconds;                  // écriture
      return { allowed, used };
    },
  };
}

async function main() {
  // ── 1) Plafonds par formule ────────────────────────────────────────────────
  console.log("\n— 1) Plafonds par formule —");
  check("Executive : aucune vidéo IA", PLAN_VIDEO_SECONDS.executive === 0);
  check("Présence : aucune vidéo IA", PLAN_VIDEO_SECONDS.presence === 0);
  check("Studio : 60 s/mois", PLAN_VIDEO_SECONDS.studio === 60);
  check("Agence : 180 s/mois", PLAN_VIDEO_SECONDS.agence === 180);

  check("formule inconnue → repli sur Présence", toPlanId("inexistant") === "presence");
  check("formule absente → repli sur Présence", toPlanId(undefined) === "presence");
  check("formule valide reconnue", isPlanId("studio") && !isPlanId("gold"));

  check("quota explicite prioritaire sur la formule", videoSecondsQuota("studio", 300) === 300);
  check("quota explicite à 0 respecté (et non ignoré)", videoSecondsQuota("studio", 0) === 0);
  check("quota explicite absent → plafond de la formule", videoSecondsQuota("studio", null) === 60);
  check("quota explicite négatif ignoré", videoSecondsQuota("studio", -5) === 60);

  // ── 2) Durée facturée par modèle ───────────────────────────────────────────
  console.log("\n— 2) Durée facturée : celle produite, pas celle demandée —");
  const veo = getVideoModel("google/veo-3");
  check("Veo 3 facture 8 s même si on en demande 30",
    videoSecondsFor(veo, { seconds: 30 }) === 8, `${videoSecondsFor(veo, { seconds: 30 })} s`);
  check("Veo 3 Fast facture 8 s", videoSecondsFor(getVideoModel("google/veo-3-fast")) === 8);

  const kling = getVideoModel("kwaivgi/kling-v2.1");
  check("Kling : 5 s par défaut", videoSecondsFor(kling, { seconds: 5 }) === 5);
  check("Kling : 10 s si ≥ 10 demandées", videoSecondsFor(kling, { seconds: 12 }) === 10);

  const hailuo = getVideoModel("minimax/hailuo-02");
  check("Hailuo : 6 s par défaut", videoSecondsFor(hailuo, {}) === 6);
  check("Hailuo : 10 s si ≥ 10 demandées", videoSecondsFor(hailuo, { seconds: 10 }) === 10);

  check("MiniMax Video-01 facture 6 s", videoSecondsFor(getVideoModel("minimax/video-01")) === 6);
  check("Wan 2.2 facture 5 s", videoSecondsFor(getVideoModel("wan-video/wan-2.2-t2v-fast")) === 5);
  check("modèle inconnu → repli sur le modèle par défaut",
    videoSecondsFor(getVideoModel("modele/inexistant")) === 8);
  check("constante de repli exposée", DEFAULT_VIDEO_SECONDS === 8);

  // ── 3) Période de décompte ─────────────────────────────────────────────────
  console.log("\n— 3) Période : mois calendaire UTC —");
  check("format YYYY-MM", usagePeriod(new Date("2026-08-03T10:00:00Z")) === "2026-08");
  check("mois sur deux chiffres", usagePeriod(new Date("2026-01-09T10:00:00Z")) === "2026-01");
  check("dernier instant du mois reste dans le mois",
    usagePeriod(new Date("2026-08-31T23:59:59Z")) === "2026-08");
  check("premier instant du mois suivant bascule",
    usagePeriod(new Date("2026-09-01T00:00:00Z")) === "2026-09");

  // ── 4) Réservation face au plafond ─────────────────────────────────────────
  console.log("\n— 4) Réservation : le plafond ne peut pas être dépassé —");
  {
    const c = makeCounter(60);
    const a = await c.reserve(8);
    check("1re demande acceptée", a.allowed && a.used === 8);
    for (let i = 0; i < 6; i++) await c.reserve(8);        // 56 s au total
    check("56 s consommées sur 60", c.used === 56, `${c.used} s`);
    const over = await c.reserve(8);
    check("demande qui dépasserait le plafond REFUSÉE", !over.allowed);
    check("compteur inchangé après refus", c.used === 56, `${c.used} s`);
    const fits = await c.reserve(4);
    check("demande qui tient exactement acceptée", fits.allowed && c.used === 60);
    check("plafond atteint : toute demande suivante refusée", !(await c.reserve(1)).allowed);
  }
  {
    const c = makeCounter(0);
    check("plafond à 0 (Présence) : refus immédiat", !(await c.reserve(8)).allowed);
  }

  // ── 5) Concurrence : ce que le verrou SQL garantit ─────────────────────────
  console.log("\n— 5) Concurrence : deux demandes simultanées ne dépassent pas —");
  {
    // 60 s de plafond, 10 demandes simultanées de 8 s : 7 doivent passer (56 s),
    // 3 être refusées. Sans verrou, toutes liraient 0 et dépasseraient.
    const locked = makeCounter(60);
    const results = await Promise.all(Array.from({ length: 10 }, () => locked.reserve(8)));
    const accepted = results.filter((r) => r.allowed).length;
    check("7 demandes acceptées sur 10", accepted === 7, `${accepted} acceptées`);
    check("consommation finale ≤ plafond", locked.used <= 60, `${locked.used} s / 60`);

    const unlocked = makeUnlockedCounter(60);
    await Promise.all(Array.from({ length: 10 }, () => unlocked.reserve(8)));
    check("preuve : sans verrou, le plafond serait franchi",
      unlocked.used <= 8, `sans verrou : ${unlocked.used} s enregistrées au lieu de 56`);
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
