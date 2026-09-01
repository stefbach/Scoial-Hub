// Retour client (réunion Rosiane, point #5) : « le Community Manager crée et
// programme les publications, puis le responsable marketing les vérifie et
// les approuve avant publication. Il peut être activé ou désactivé selon les
// préférences de chaque entreprise. »
//
// Vérifie la décision pure resolveScheduleStatus() : c'est elle qui décide,
// à la fois côté création (POST /api/scheduled-posts) et édition
// (PATCH /api/scheduled-posts/[id]), si une programmation part directement
// ou est mise en attente — le reste (cron, "Publier maintenant", approve/
// reject) en découle mécaniquement (cron ne lit que status="scheduled",
// publishScheduledPostNow refuse "pending_approval").
//
// Usage : npm run test:approval

import { COMPANIES } from "../lib/mock-data";
import { resolveScheduleStatus } from "../lib/publishing/approval";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  const companyId = COMPANIES[0].id;
  const original = COMPANIES[0].approvalWorkflowEnabled;

  console.log("\n— resolveScheduleStatus —");

  // Workflow désactivé : tout le monde programme normalement.
  COMPANIES[0].approvalWorkflowEnabled = false;
  check(
    "workflow désactivé + member → part directement",
    (await resolveScheduleStatus(companyId, "scheduled", "member")) === "scheduled"
  );
  check(
    "workflow désactivé + owner → part directement",
    (await resolveScheduleStatus(companyId, "scheduled", "owner")) === "scheduled"
  );

  // Workflow activé.
  COMPANIES[0].approvalWorkflowEnabled = true;
  check(
    "workflow activé + member → mis en attente",
    (await resolveScheduleStatus(companyId, "scheduled", "member")) === "pending_approval"
  );
  check(
    "workflow activé + owner → part directement (le responsable n'a pas à s'auto-approuver)",
    (await resolveScheduleStatus(companyId, "scheduled", "owner")) === "scheduled"
  );
  check(
    "workflow activé + admin → part directement",
    (await resolveScheduleStatus(companyId, "scheduled", "admin")) === "scheduled"
  );
  check(
    "workflow activé + member, mais statut demandé = draft → inchangé (pas de mise en attente d'un brouillon)",
    (await resolveScheduleStatus(companyId, "draft", "member")) === "draft"
  );
  check(
    "workflow activé + member, statut absent (repli implicite) → inchangé",
    (await resolveScheduleStatus(companyId, undefined, "member")) === undefined
  );

  COMPANIES[0].approvalWorkflowEnabled = original;

  console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
