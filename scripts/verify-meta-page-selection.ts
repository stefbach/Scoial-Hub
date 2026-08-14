// Vérifie la SÉLECTION DE LA PAGE META après l'autorisation OAuth.
//
// Incident du 14/08 (démonstration) : la société « FRCI TEST » autorise bien sa
// Page et son compte Instagram dans la fenêtre Meta, l'application confirme la
// connexion à « socialhubaxon »… et le connecteur reste « En attente », avec
// Instagram et Meta Ads « Non configuré ». Deux causes enchaînées :
//
//   1. pickPageForCompany ne retenait une Page que si son nom ressemblait à
//      celui de la société. « FRCI TEST » ≠ « socialhubaxon » → aucune Page
//      retenue, alors qu'il n'y en avait qu'une seule à choisir.
//   2. Le repli enregistrait le token UTILISATEUR sous la clé `page_access_token`
//      et omettait `user_access_token`. Le sélecteur de Page (/pages-meta) lit
//      `user_access_token` pour lister les Pages : il répondait « reconnexion
//      nécessaire » avec une liste vide. Plus aucune issue.
//
// Usage : npm run test:metapage

import type { MetaPage } from "../lib/connectors/meta-pages";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function page(id: string, name: string): MetaPage {
  return { id, name, accessToken: `tok_${id}` } as MetaPage;
}

async function main() {
  const { pickPageForCompany, storeUnpickedMetaConnection, getMetaContext } = await import(
    "../lib/connectors/meta-pages"
  );

  console.log("\n— 1) Une seule Page : elle est retenue quel que soit son nom —");
  {
    // Le cas exact de l'incident.
    const picked = pickPageForCompany([page("777", "socialhubaxon")], "FRCI TEST");
    check("« FRCI TEST » + Page « socialhubaxon » → Page retenue", picked?.id === "777", picked?.name ?? "aucune");

    const noName = pickPageForCompany([page("777", "socialhubaxon")], "");
    check("nom de société inconnu → la Page unique est quand même retenue", noName?.id === "777");
  }

  console.log("\n— 2) Plusieurs Pages : le nom départage toujours —");
  {
    const pages = [page("1", "Boulangerie Martin"), page("2", "FRCI TEST"), page("3", "Autre chose")];
    check("correspondance exacte prioritaire", pickPageForCompany(pages, "FRCI TEST")?.id === "2");
    check("correspondance partielle reconnue", pickPageForCompany(pages, "Boulangerie")?.id === "1");
    check("casse et espaces ignorés", pickPageForCompany(pages, "frci-test")?.id === "2");
  }

  console.log("\n— 3) Plusieurs Pages sans correspondance : pas de choix aveugle —");
  {
    const pages = [page("1", "Alpha"), page("2", "Beta")];
    check("aucune correspondance → aucune Page imposée", pickPageForCompany(pages, "FRCI TEST") === null);
    check(
      "Page déjà connectée conservée plutôt qu'une bascule",
      pickPageForCompany(pages, "FRCI TEST", "2")?.id === "2"
    );
  }

  console.log("\n— 4) Aucune Page du tout —");
  check("liste vide → null", pickPageForCompany([], "FRCI TEST") === null);

  console.log("\n— 5) Repli : le sélecteur de Page reste utilisable —");
  {
    const COMPANY = "societe-sans-page";
    await storeUnpickedMetaConnection(COMPANY, "USER_TOKEN_ABC", "Rosiane Gebert Pillai");
    const ctx = await getMetaContext(COMPANY);

    check("token utilisateur conservé → /api/meta/pages peut lister les Pages", ctx.userToken === "USER_TOKEN_ABC", ctx.userToken ?? "absent");
    check("aucune Page prétendument sélectionnée", !ctx.pageId, ctx.pageId ?? "—");
    check(
      "le token utilisateur n'est PAS présenté comme un token de Page",
      ctx.pageToken !== "USER_TOKEN_ABC",
      ctx.pageToken ?? "—"
    );
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
