// Test autonome (sans réseau ni credentials) du registre de connecteurs et de
// la fabrique OAuth 2.0 déclarative.
//
// Vérifie la propriété clé du cahier des charges : « ajouter un réseau =
// 1 objet de config, 0 nouvelle route ». On contrôle donc que :
//   - chaque plateforme enregistrée se résout en un connecteur cohérent ;
//   - le registre est dérivé d'une seule source (pas de liste codée en dur) ;
//   - les providers déclaratifs (Twitter/Pinterest/Threads) se dégradent
//     proprement en mode simulé tant que les credentials sont absents ;
//   - une spec déclarative produit un connecteur valide (auth URL, exchange,
//     publish simulé) sans écrire de classe à la main.
//
// Lancement : npx tsx scripts/verify-connectors.ts

import {
  getConnector,
  isSupportedPlatform,
  SUPPORTED_PLATFORMS,
  makeOAuth2Connector,
} from "../lib/connectors/index";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  console.log("\n— 1) Le registre couvre tous les réseaux attendus —");
  const expected = ["facebook", "instagram", "linkedin", "tiktok", "twitter", "pinterest", "threads"];
  for (const p of expected) {
    check(`plateforme « ${p} » enregistrée`, isSupportedPlatform(p), SUPPORTED_PLATFORMS.join(", "));
  }
  check("aucune plateforme inconnue acceptée", !isSupportedPlatform("myspace"));

  console.log("\n— 2) Chaque connecteur expose le contrat unifié —");
  for (const p of SUPPORTED_PLATFORMS) {
    const c = getConnector(p);
    check(`getConnector(${p}).platform === ${p}`, c.platform === p, c.platform);
    check(`${p} : isConfigured() est un booléen`, typeof c.isConfigured() === "boolean");
    check(`${p} : getAuthUrl renvoie une string`, typeof c.getAuthUrl("nonce.x.y") === "string");
  }

  console.log("\n— 3) Providers déclaratifs : dégradation gracieuse (mode simulé) —");
  // Sans credentials d'env, les nouveaux réseaux doivent simuler, jamais throw.
  for (const p of ["twitter", "pinterest", "threads", "tiktok"] as const) {
    const c = getConnector(p);
    check(`${p} non configuré hors env`, c.isConfigured() === false);
    const token = await c.exchangeCode("fake_code", "fake_state");
    check(`${p} : exchangeCode simulé renvoie un token`, token.accessToken.startsWith("simulated_"), token.accessToken);
    const pub = await c.publishPost({ externalAccountId: "x", accessToken: "", text: "hello" });
    check(`${p} : publishPost simulé (simulated=true)`, pub.simulated === true && Boolean(pub.externalId));
    const m = await c.getMetrics("simulated_123");
    check(`${p} : getMetrics renvoie un objet métriques`, typeof m.reactions === "number");
  }

  console.log("\n— 4) La fabrique produit un connecteur valide depuis une simple config —");
  const demo = makeOAuth2Connector({
    platform: "twitter", // réutilise une plateforme connue pour le typage
    label: "Demo Net",
    clientIdEnv: "DEMO_NET_CLIENT_ID_UNSET",
    clientSecretEnv: "DEMO_NET_CLIENT_SECRET_UNSET",
    authorizeUrl: "https://demo.example/oauth/authorize",
    tokenUrl: "https://demo.example/oauth/token",
    scopes: ["read", "write"],
    simPrefix: "demo",
  });
  check("config minimale → connecteur instancié", typeof demo.publishPost === "function");
  check("config minimale → non configuré sans env", demo.isConfigured() === false);
  const url = demo.getAuthUrl("nonce.x.y");
  check("config minimale → getAuthUrl renvoie une URL de repli simulée", url.includes("simulated=true"), url);
  const dpub = await demo.publishPost({ externalAccountId: "", accessToken: "", text: "hi" });
  check("config minimale → publish simulé", dpub.simulated === true);

  console.log("\n— 5) PKCE plain : le verifier dérive du state (Twitter/X) —");
  // En mode configuré on ne peut pas tester sans credentials ; on vérifie au
  // moins que l'URL d'autorisation simulée porte bien le state transmis.
  const tw = getConnector("twitter");
  const authUrl = tw.getAuthUrl("abc123.def.ghi");
  check("twitter : state propagé dans l'URL d'auth", authUrl.includes("abc123"), authUrl);

  console.log(`\n${failed === 0 ? "✓ TOUT VERT" : `✗ ${failed} échec(s)`}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
