// Audit — et réparation — des rattachements « société → compte publicitaire ».
//
// POURQUOI
// Jusqu'à la correction du 24/08, quand aucun compte publicitaire ne portait le
// nom de la société, l'application retenait « le compte actif qui a le plus
// dépensé » du portefeuille Meta connecté. Une société nouvellement créée était
// donc branchée sur le compte d'une AUTRE société, dont la dépense et les
// performances s'affichaient ensuite dans son centre de pilotage.
//
// Le correctif empêche que cela se reproduise, mais ne réécrit pas les
// rattachements déjà en base : ce script s'en charge.
//
// CE QU'IL FAIT
// Il croise DEUX signaux, parce que le nom seul ne suffit pas à distinguer un
// rattachement subi d'un choix délibéré :
//   1. la preuve de nom, jugée avec EXACTEMENT la règle du rattachement
//      automatique (adAccountNameEvidence) — pas une seconde implémentation ;
//   2. la PROVENANCE : un rattachement écrit dans les secondes qui suivent la
//      connexion Facebook vient du repli automatique ; écrit des heures ou des
//      jours plus tard, il vient d'une sélection humaine dans l'écran Campagnes.
//
// Seuls sont déliés les rattachements sans aucun lien de nom ET issus du repli
// automatique. Rien n'est détruit : l'ancien compte est archivé dans la config
// (previous_ad_account_id, previous_account_name, unbound_at, unbound_reason)
// et le statut passe à « pending » — la société choisit son compte au prochain
// passage dans Campagnes, et le rattachement reste reconstituable.
//
// CE QU'IL NE FAIT PAS
// Il ne DEVINE jamais le bon compte. Deux cas lui sont explicitement retirés :
// la preuve de nom partielle (initiales, nom de personne…) et le choix humain
// explicite. Ils sont signalés, pas corrigés — c'est à un humain de trancher.
//
// USAGE
//   npm run audit:adaccounts            → rapport seul, aucune écriture
//   npm run audit:adaccounts -- --apply → applique le déliement

import { createAdminClient } from "../lib/supabase/server";
import { adAccountNameEvidence } from "../lib/connectors/meta-pages";

const APPLY = process.argv.includes("--apply");

interface Row {
  id: string;
  company_id: string;
  channel: string;
  status: string;
  connected_at: string | null;
  config: Record<string, string>;
}

function ts(): string {
  return new Date().toISOString();
}

/**
 * Au-delà de ce délai entre la connexion Facebook et l'écriture du compte
 * publicitaire, le rattachement ne peut plus venir du repli automatique : les
 * deux écritures de l'OAuth se suivent immédiatement. Une minute laisse une
 * marge confortable sans jamais recouvrir une action humaine, qui suppose de
 * revenir dans l'écran Campagnes.
 */
const AUTO_BIND_WINDOW_MS = 60_000;

async function main() {
  const sb = createAdminClient();
  if (!sb) {
    console.error("✗ Supabase non configuré (SUPABASE_SERVICE_ROLE_KEY requis).");
    process.exit(1);
  }

  const { data: rows, error } = await sb
    .from("sh_channel_connections")
    .select("id, company_id, channel, status, connected_at, config")
    .in("channel", ["meta_ads", "facebook"]);
  if (error) {
    console.error("✗ Lecture impossible :", error.message);
    process.exit(1);
  }

  const all = (rows ?? []) as Row[];
  const adsRows = all.filter((r) => r.channel === "meta_ads");
  const fbAt = new Map(
    all.filter((r) => r.channel === "facebook").map((r) => [String(r.company_id), r.connected_at])
  );

  const { data: companies } = await sb.from("sh_companies").select("id, name, code, org_id");
  const byId = new Map((companies ?? []).map((c) => [String(c.id), c]));

  const keep: string[] = [];
  const review: string[] = [];
  const unbind: { row: Row; company: string; account: string }[] = [];

  for (const r of adsRows) {
    const company = byId.get(String(r.company_id));
    const companyName = String(company?.name ?? "");
    const accountId = String(r.config?.ad_account_id ?? "");
    const accountName = String(r.config?.account_name ?? "");
    if (!accountId) continue;

    const label = `${companyName.padEnd(26)} → ${accountName || `act_${accountId}`}`;
    // Le CODE de la société est une preuve recevable au même titre que son nom
    // (« TIB » pour TIBOK) : on l'ajoute aux candidats.
    const evidence = adAccountNameEvidence(accountName, [companyName, String(company?.code ?? "")]);

    // Provenance : écriture simultanée à l'OAuth Facebook = repli automatique.
    const fb = fbAt.get(String(r.company_id));
    const gap = fb && r.connected_at ? +new Date(r.connected_at) - +new Date(fb) : null;
    const automatic = gap !== null && gap >= 0 && gap <= AUTO_BIND_WINDOW_MS;
    const origin = automatic ? "rattachement automatique" : "sélection humaine";

    if (evidence !== "none") {
      keep.push(`✓ ${label}   [nom ${evidence === "exact" ? "identique" : "concordant"}]`);
    } else if (!automatic) {
      review.push(`≈ ${label}   [aucun lien de nom, mais ${origin} — à confirmer]`);
    } else {
      unbind.push({ row: r, company: companyName, account: accountName || `act_${accountId}` });
    }
  }

  console.log(`\n── Rattachements cohérents (${keep.length}) ──`);
  keep.forEach((l) => console.log("  " + l));

  console.log(`\n── À confirmer par un humain (${review.length}) ──`);
  if (review.length === 0) console.log("  (aucun)");
  review.forEach((l) => console.log("  " + l));
  if (review.length) {
    console.log("  → Choix posé explicitement : le script ne revient pas dessus.");
  }

  console.log(`\n── Rattachements subis, sans lien de nom (${unbind.length}) ──`);
  if (unbind.length === 0) console.log("  (aucun)");
  unbind.forEach((u) => console.log(`  ✗ ${u.company.padEnd(26)} → ${u.account}`));

  if (unbind.length === 0) {
    console.log("\n✓ Rien à corriger.\n");
    return;
  }

  if (!APPLY) {
    console.log("\nRapport seul — aucune écriture. Relancer avec --apply pour délier.\n");
    return;
  }

  console.log("\n── Application ──");
  for (const u of unbind) {
    const cfg = { ...u.row.config };
    const previousId = cfg.ad_account_id;
    const previousName = cfg.account_name ?? "";
    // Archivage AVANT retrait : le rattachement reste reconstituable.
    delete cfg.ad_account_id;
    delete cfg.account_name;
    delete cfg.currency;
    cfg.previous_ad_account_id = previousId;
    cfg.previous_account_name = previousName;
    cfg.unbound_at = ts();
    cfg.unbound_reason = "Rattachement automatique sans preuve (repli « compte le plus dépensier »)";

    const { error: upErr } = await sb
      .from("sh_channel_connections")
      .update({ config: cfg, status: "pending", updated_at: ts() })
      .eq("id", u.row.id);

    console.log(upErr ? `  ✗ ${u.company} : ${upErr.message}` : `  ✓ ${u.company} délié de « ${u.account} »`);
  }
  console.log("\nCes sociétés choisiront leur compte à leur prochain passage dans Campagnes.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
