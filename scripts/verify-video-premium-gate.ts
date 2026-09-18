// Vérifie le déverrouillage premium vidéo (lib/plans.ts, appliqué dans
// app/api/ai/generate-video/route.ts) et le catalogue de packs de crédits.
//
// Root cause corrigée : `allowPremiumVideo` venait du CLIENT (Studio Créatif /
// Compose) et n'était jamais vérifié contre le plan réel de la société — un
// client modifié pouvait se débrider lui-même sans jamais acheter de crédit
// (faille notée dans le code depuis l'introduction du verrou, jamais fermée).
//
// Ce qui est vérifié :
//   1. Seules Studio et Agence peuvent débrider (Executive/Présence : jamais,
//      quelle que soit la demande client).
//   2. `resolveAllowPremiumVideo` (le point d'application réel) ne fait
//      confiance à la demande client QUE si le plan l'autorise.
//   3. `getVideoModel` avec l'autorisation résolue se comporte comme
//      test:videolock l'attend déjà (verrou plateforme toujours actif).
//   4. Les packs de crédits utilisent tous le même tarif unique (aucune
//      pondération par modèle, décision documentée dans lib/plans.ts).
//
// Usage : npm run test:videopremium

import {
  PLAN_IDS,
  PLAN_ALLOWS_PREMIUM_VIDEO,
  planAllowsPremiumVideo,
  resolveAllowPremiumVideo,
  CREDIT_PACKS,
  VIDEO_CREDIT_RATE_RS,
  VIDEO_CREDIT_RATE_EUR,
} from "../lib/plans";
import { getVideoModel } from "../lib/ai/model-catalog";

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  console.log("— 1) Éligibilité par formule —");
  check("executive → jamais", PLAN_ALLOWS_PREMIUM_VIDEO.executive === false);
  check("presence → jamais", PLAN_ALLOWS_PREMIUM_VIDEO.presence === false);
  check("studio → autorisé", PLAN_ALLOWS_PREMIUM_VIDEO.studio === true);
  check("agence → autorisé", PLAN_ALLOWS_PREMIUM_VIDEO.agence === true);
  check("toutes les formules couvertes", PLAN_IDS.every((p) => typeof PLAN_ALLOWS_PREMIUM_VIDEO[p] === "boolean"));

  console.log("\n— 2) resolveAllowPremiumVideo — le point d'application réel —");
  for (const plan of ["executive", "presence"] as const) {
    check(`${plan} + demande client true → refusé`, resolveAllowPremiumVideo(true, plan) === false);
    check(`${plan} + demande client false → refusé`, resolveAllowPremiumVideo(false, plan) === false);
  }
  for (const plan of ["studio", "agence"] as const) {
    check(`${plan} + demande client true → autorisé`, resolveAllowPremiumVideo(true, plan) === true);
    check(`${plan} + demande client false → refusé (rien ne force le débridage)`, resolveAllowPremiumVideo(false, plan) === false);
  }
  check("plan inconnu + demande true → refusé (repli sur presence)", resolveAllowPremiumVideo(true, "bogus-plan") === false);
  check("demande undefined (corps de requête sans le champ) → refusé", resolveAllowPremiumVideo(undefined, "agence") === false);
  check("planAllowsPremiumVideo et resolveAllowPremiumVideo cohérents",
    PLAN_IDS.every((p) => resolveAllowPremiumVideo(true, p) === planAllowsPremiumVideo(p)));

  console.log("\n— 3) getVideoModel avec l'autorisation résolue —");
  const PREMIUM_IDS = ["google/veo-3", "kwaivgi/kling-v2.1", "higgsfield/veo3.1"];
  for (const id of PREMIUM_IDS) {
    const resolvedForExecutive = resolveAllowPremiumVideo(true, "executive");
    const gm = getVideoModel(id, "facebook", { allowPremium: resolvedForExecutive });
    check(`${id} demandé par Executive sur Facebook → jamais renvoyé tel quel`, gm.id !== id, `résolu : ${gm.id}`);

    const resolvedForAgence = resolveAllowPremiumVideo(true, "agence");
    const gmAgence = getVideoModel(id, undefined, { allowPremium: resolvedForAgence });
    check(`${id} demandé par Agence (aucun réseau verrouillé) → conservé`, gmAgence.id === id);
  }

  console.log("\n— 4) Packs de crédits — tarif unique —");
  check("au moins 2 packs proposés", CREDIT_PACKS.length >= 2);
  for (const pack of CREDIT_PACKS) {
    check(`pack "${pack.id}" — ${pack.seconds}s au tarif Rs (${pack.rs} Rs)`,
      pack.rs <= pack.seconds * VIDEO_CREDIT_RATE_RS,
      `${pack.rs} Rs pour ${pack.seconds}s (plein tarif : ${pack.seconds * VIDEO_CREDIT_RATE_RS} Rs)`);
    check(`pack "${pack.id}" — ${pack.seconds}s au tarif € (${pack.eur} €)`,
      pack.eur <= pack.seconds * VIDEO_CREDIT_RATE_EUR,
      `${pack.eur} € pour ${pack.seconds}s (plein tarif : ${pack.seconds * VIDEO_CREDIT_RATE_EUR} €)`);
  }
  // Le premier pack (sans remise) doit être exactement au tarif de référence —
  // sinon "1 crédit = 1 seconde au même tarif que le dépassement" (la promesse
  // faite à l'utilisateur) ne serait pas vraie.
  const reference = CREDIT_PACKS[0];
  check("le pack de référence est EXACTEMENT au tarif affiché (pas de remise cachée)",
    reference.rs === reference.seconds * VIDEO_CREDIT_RATE_RS && reference.eur === reference.seconds * VIDEO_CREDIT_RATE_EUR);

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
