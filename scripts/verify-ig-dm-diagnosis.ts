// Test autonome (sans réseau ni credentials) du diagnostic des messages privés
// Instagram.
//
// Vérifie que chaque cause possible d'une messagerie IG muette reçoit le BON
// verdict — et surtout que le cas « Meta répond vide sans erreur » n'est jamais
// présenté comme une certitude : c'est le seul que l'API ne permet pas de
// distinguer d'une boîte réellement vide.
//
// Lancement : npx tsx scripts/verify-ig-dm-diagnosis.ts

import { upsertConnection } from "../lib/repositories/channel-connections";
import { diagnoseIgDm, explain, verdictFor, type IgDmDiagnosis } from "../lib/inbox/ig-dm-diagnosis";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  // ── 1) Table de vérité du verdict ─────────────────────────────────────────
  console.log("\n— 1) Verdict : une cause, un diagnostic —");

  check(
    "aucun compte Instagram lié → no-ig",
    verdictFor({ igLinked: false, permissionGranted: true, probes: [] }) === "no-ig"
  );
  check(
    "permission refusée → permission-missing",
    verdictFor({ igLinked: true, permissionGranted: false, probes: [] }) === "permission-missing"
  );
  check(
    "des conversations reviennent → ok",
    verdictFor({
      igLinked: true,
      permissionGranted: true,
      probes: [{ node: "page", id: "P", conversations: 3 }],
    }) === "ok"
  );
  check(
    "tous les nœuds refusent → graph-error",
    verdictFor({
      igLinked: true,
      permissionGranted: true,
      probes: [
        { node: "page", id: "P", conversations: 0, error: "(#10) permission" },
        { node: "instagram", id: "I", conversations: 0, error: "(#10) permission" },
      ],
    }) === "graph-error"
  );
  check(
    "réponse vide SANS erreur → access-blocked-or-empty (jamais une certitude)",
    verdictFor({
      igLinked: true,
      permissionGranted: true,
      probes: [
        { node: "page", id: "P", conversations: 0 },
        { node: "instagram", id: "I", conversations: 0 },
      ],
    }) === "access-blocked-or-empty"
  );
  check(
    "un nœud muet mais l'autre répond → ok (pas de faux négatif)",
    verdictFor({
      igLinked: true,
      permissionGranted: true,
      probes: [
        { node: "page", id: "P", conversations: 0 },
        { node: "instagram", id: "I", conversations: 2 },
      ],
    }) === "ok"
  );
  check(
    "permission indéterminable ne vaut PAS permission refusée",
    verdictFor({
      igLinked: true,
      permissionGranted: null,
      probes: [{ node: "page", id: "P", conversations: 1 }],
    }) === "ok"
  );

  // ── 2) Messages actionnables ──────────────────────────────────────────────
  console.log("\n— 2) Chaque verdict nomme l'action à mener —");
  const base: IgDmDiagnosis = {
    igLinked: true,
    permissionGranted: true,
    webhookSubscribed: true,
    probes: [],
    verdict: "ok",
  };
  check(
    "permission manquante → renvoie vers la reconnexion Facebook",
    explain({ ...base, verdict: "permission-missing" }).includes("instagram_manage_messages")
  );
  check(
    "réponse vide → nomme « Outils connectés » ET le test par un message réel",
    (() => {
      const m = explain({ ...base, verdict: "access-blocked-or-empty" });
      return m.includes("Outils connectés") && m.includes("envoyez-vous un message");
    })()
  );
  check(
    "erreur Graph → reprend le message de Meta",
    explain({
      ...base,
      verdict: "graph-error",
      probes: [{ node: "page", id: "P", conversations: 0, error: "(#200) autorisation manquante" }],
    }).includes("(#200) autorisation manquante")
  );

  // ── 3) Sondes réelles contre un Graph mocké ───────────────────────────────
  console.log("\n— 3) Sondes Graph —");

  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  function json(data: unknown) {
    return { json: async () => data } as Response;
  }

  // Compte dont l'accès aux messages est bloqué côté Instagram : Meta répond
  // « data: [] » sur les DEUX nœuds, sans la moindre erreur.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    if (url.includes("me/permissions")) {
      return json({
        data: [
          { permission: "instagram_basic", status: "granted" },
          { permission: "instagram_manage_messages", status: "granted" },
        ],
      });
    }
    if (url.includes("/subscribed_apps")) return json({ data: [{ subscribed_fields: ["feed", "messages"] }] });
    if (url.includes("IGB?") || url.includes("IGB&")) return json({ username: "ma.marque" });
    if (url.includes("/conversations")) return json({ data: [] });
    return json({ data: [] });
  }) as typeof fetch;

  await upsertConnection("diag-co", "facebook", {
    page_id: "PAGEB",
    page_access_token: "tok",
    user_access_token: "utok",
    account_name: "Ma Page",
  });
  await upsertConnection("diag-co", "instagram", { ig_business_account_id: "IGB" });

  const d = await diagnoseIgDm("diag-co");
  check("compte Instagram détecté", d.igLinked && d.igUsername === "ma.marque", d.igUsername ?? "(aucun)");
  check("permission lue sur le token utilisateur", d.permissionGranted === true);
  check("abonnement webhook « messages » détecté", d.webhookSubscribed === true);
  check("les DEUX nœuds sont sondés", d.probes.length === 2, d.probes.map((p) => p.node).join("+"));
  check(
    "verdict : accès bloqué ou boîte vide (l'API ne tranche pas)",
    d.verdict === "access-blocked-or-empty",
    d.verdict
  );
  check(
    "l'explication renvoie au réglage Instagram",
    explain(d).includes("Autoriser l'accès aux messages")
  );
  check(
    "les conversations sont demandées avec platform=instagram",
    asked.filter((u) => u.includes("/conversations")).every((u) => u.includes("platform=instagram"))
  );

  // Même compte, mais la permission n'est PAS accordée : le verdict doit
  // changer de cause plutôt que d'accuser le réglage Instagram.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("me/permissions")) {
      return json({ data: [{ permission: "instagram_basic", status: "granted" }] });
    }
    if (url.includes("/conversations")) return json({ data: [] });
    return json({ data: [] });
  }) as typeof fetch;

  const d2 = await diagnoseIgDm("diag-co");
  check("permission absente → verdict permission-missing", d2.verdict === "permission-missing", d2.verdict);
  check("… et l'explication ne blâme PAS le réglage Instagram", !explain(d2).includes("Outils connectés"));

  globalThis.fetch = realFetch;

  console.log(failed === 0 ? "\n✅ Tous les tests passent." : `\n❌ ${failed} test(s) en échec.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
