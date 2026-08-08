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
  // Régression constatée en production : le nœud Page répondait « 0, sans
  // erreur » (donc l'appel fonctionne) pendant que le nœud Instagram renvoyait
  // (#3) — erreur ATTENDUE avec un token de Page. Compter cette erreur comme un
  // échec faisait accuser un problème d'accès inexistant.
  check(
    "erreur (#3) non concluante + nœud Page à zéro → PAS graph-error",
    verdictFor({
      igLinked: true,
      permissionGranted: true,
      probes: [
        { node: "page", id: "P", conversations: 0 },
        {
          node: "instagram",
          id: "I",
          conversations: 0,
          error: "(#3) Application does not have the capability to make this API call.",
          inconclusive: true,
        },
      ],
    }) === "access-blocked-or-empty"
  );
  check(
    "une erreur uniquement non concluante ne vaut jamais graph-error",
    verdictFor({
      igLinked: true,
      permissionGranted: true,
      probes: [
        {
          node: "instagram",
          id: "I",
          conversations: 0,
          error: "(#3) Application does not have the capability to make this API call.",
          inconclusive: true,
        },
      ],
    }) === "access-blocked-or-empty"
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
    messengerConversations: null,
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
      return m.includes("Outils connectés") && m.includes("DEPUIS UN AUTRE COMPTE");
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
  check(
    "erreur Graph → ne cite JAMAIS une erreur non concluante",
    !explain({
      ...base,
      verdict: "graph-error",
      probes: [
        { node: "instagram", id: "I", conversations: 0, error: "(#3) capability", inconclusive: true },
        { node: "page", id: "P", conversations: 0, error: "(#200) autorisation manquante" },
      ],
    }).includes("(#3)")
  );
  check(
    "Messenger répond → l'explication établit que le token est hors de cause",
    explain({ ...base, verdict: "access-blocked-or-empty", messengerConversations: 12 }).includes(
      "hors de cause"
    ),
  );
  check(
    "compte non professionnel → l'explication le signale en premier",
    explain({
      ...base,
      verdict: "access-blocked-or-empty",
      igAccountType: "MEDIA_CREATOR",
      igUsername: "ma.marque",
    }).includes("MEDIA_CREATOR")
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
    if (url.includes("IGB?") || url.includes("IGB&")) {
      return json({ username: "ma.marque", account_type: "BUSINESS" });
    }
    // Messenger (sans platform) répond : l'accès fonctionne.
    if (url.includes("/conversations") && !url.includes("platform=instagram")) {
      return json({ data: [{ id: "c1" }, { id: "c2" }] });
    }
    // Instagram : zéro, sans erreur.
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
  check("type de compte remonté", d.igAccountType === "BUSINESS", d.igAccountType ?? "(inconnu)");
  check("permission lue sur le token utilisateur", d.permissionGranted === true);
  check("abonnement webhook « messages » détecté", d.webhookSubscribed === true);
  check("contre-épreuve Messenger effectuée", d.messengerConversations === 2, `${d.messengerConversations}`);
  check(
    "le nœud Page répond → le nœud Instagram n'est PAS sondé inutilement",
    d.probes.length === 1 && d.probes[0].node === "page",
    d.probes.map((p) => p.node).join("+") || "(aucune sonde)"
  );
  check(
    "verdict : accès bloqué ou boîte vide (l'API ne tranche pas)",
    d.verdict === "access-blocked-or-empty",
    d.verdict
  );
  check(
    "l'explication établit d'abord que l'appel FONCTIONNE (preuve Messenger)",
    explain(d).includes("hors de cause")
  );
  check(
    "… puis renvoie au réglage Instagram et au test décisif",
    explain(d).includes("Autoriser l'accès aux messages") && explain(d).includes("DEPUIS UN AUTRE COMPTE")
  );
  check(
    "les conversations Instagram sont demandées avec platform=instagram",
    asked.some((u) => u.includes("/conversations") && u.includes("platform=instagram"))
  );
  check(
    "la contre-épreuve Messenger est demandée SANS platform",
    asked.some((u) => u.includes("/conversations") && !u.includes("platform="))
  );

  // Cas de production (capture TIBOK) : nœud Page en échec, nœud Instagram
  // sondé en repli et répondant (#3) — erreur attendue avec un token de Page.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("me/permissions")) {
      return json({ data: [{ permission: "instagram_manage_messages", status: "granted" }] });
    }
    if (url.includes("PAGEB/conversations") && url.includes("platform=instagram")) {
      return json({ error: { message: "(#100) tuples", code: 100 } });
    }
    if (url.includes("IGB/conversations")) {
      return json({
        error: { message: "(#3) Application does not have the capability to make this API call.", code: 3 },
      });
    }
    return json({ data: [] });
  }) as typeof fetch;

  const d3 = await diagnoseIgDm("diag-co");
  const igProbe = d3.probes.find((p) => p.node === "instagram");
  check("nœud Page en échec → repli sur le nœud Instagram", Boolean(igProbe));
  check("l'erreur (#3) est marquée NON concluante", igProbe?.inconclusive === true);
  check(
    "… et n'est jamais citée comme la cause",
    !explain(d3).includes("does not have the capability"),
    explain(d3).slice(0, 90)
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
