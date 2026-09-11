// Un audit (BUGSSocialHub32, bugs 10-11) a remonté deux bugs FONCTIONNELS sur
// /history, pas seulement des écarts de texte d'aide :
//   10. Le bouton « Réessayer » à côté d'un post en échec n'avait AUCUN
//       gestionnaire — cliquer dessus ne faisait rien.
//   11. Le bouton « Supprimer » ne mutait qu'un état local côté navigateur
//       (magasin de démo COMPANY_DATA), sans jamais appeler la base réelle —
//       l'entrée réapparaissait au rechargement malgré le message
//       « action irréversible ».
// Root cause associée trouvée en investiguant le 10 : la duplication (dont
// « Réessayer » réutilise le mécanisme) lisait le même magasin de démo
// déconnecté des données réellement affichées (`data.history`, hydraté
// depuis Supabase) — corrigé au passage dans Compose.
//
// Verrouille les correctifs :
// 1. Les deux boutons « Réessayer » (liste + modale détail) réutilisent la
//    navigation de duplication déjà fonctionnelle (/compose?duplicate=id).
// 2. La suppression appelle une vraie route DELETE /api/history/[id], qui
//    résout la société propriétaire, vérifie l'accès, puis supprime en base
//    (ou dans COMPANY_DATA en mode mock) via lib/repositories/history.ts —
//    même schéma que lib/repositories/scheduled-posts.ts.
// 3. Compose ne lit plus le magasin de démo déconnecté pour dupliquer un item
//    d'historique : il lit `data.history` (contexte, données réelles).
//
// Usage : npx tsx scripts/verify-history-actions.ts

import { readFileSync, existsSync } from "node:fs";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const read = (p: string) => readFileSync(p, "utf8");

console.log("\n— BUG 10 : le bouton « Réessayer » a désormais un vrai gestionnaire —");
{
  const page = read("app/(organic)/history/page.tsx");
  check(
    "liste : le bouton Réessayer navigue vers /compose?duplicate=",
    /onClick=\{\(\) => router\.push\(`\/compose\?duplicate=\$\{item\.id\}`\)\}/.test(page)
  );
  check("liste : router est bien disponible dans le composant List", /function List\(/.test(page) && /const router = useRouter\(\);/.test(page));

  const modal = read("components/organic/HistoryDetailModal.tsx");
  check(
    "modale détail : le bouton Réessayer navigue vers /compose?duplicate=",
    /onClick=\{\(\) => \{ router\.push\(`\/compose\?duplicate=\$\{post\.id\}`\); onClose\(\); \}\}/.test(modal)
  );
}

console.log("\n— BUG 11 : la suppression appelle une vraie route DELETE —");
{
  const page = read("app/(organic)/history/page.tsx");
  check("n'appelle plus le mutateur de démo déconnecté", !/deleteHistoryItem\(company\.id, confirmDelete\.id\)/.test(page));
  check("appelle DELETE /api/history/{id}", /fetch\(`\/api\/history\/\$\{id\}`, \{ method: "DELETE" \}\)/.test(page));

  check("la route API DELETE existe", existsSync("app/api/history/[id]/route.ts"));
  const route = read("app/api/history/[id]/route.ts");
  check("exporte un handler DELETE", /export async function DELETE/.test(route));
  check("résout la société propriétaire avant tout accès", /getHistoryItemCompanyId/.test(route));
  check("vérifie l'accès en édition (pas seulement une session valide)", /requireCompanyAccess\(companyId, \{ mode: "edit" \}\)/.test(route));

  check("le repository existe", existsSync("lib/repositories/history.ts"));
  const repo = read("lib/repositories/history.ts");
  check("supprime réellement de sh_history_items côté Supabase", /\.from\("sh_history_items"\)\s*\n?\s*\.delete\(\)/.test(repo));
  check("repli mock cohérent (COMPANY_DATA) quand Supabase n'est pas configuré", /isSupabaseConfigured/.test(repo) && /COMPANY_DATA/.test(repo));
}

console.log("\n— Root cause : Compose ne duplique plus depuis le magasin de démo déconnecté —");
{
  const compose = read("app/(organic)/compose/page.tsx");
  check("n'importe plus findHistoryItem (magasin de démo déconnecté)", !/findHistoryItem/.test(compose));
  check("lit data.history (contexte, données réelles) pour dupliquer", /data\.history\.find\(\(h\) => h\.id === duplicateId\)/.test(compose));

  const store = read("lib/history-store.ts");
  check("findHistoryItem et l'ancien deleteHistoryItem sont bien retirés de lib/history-store.ts", !/export function findHistoryItem/.test(store) && !/export function deleteHistoryItem/.test(store));
}

console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
