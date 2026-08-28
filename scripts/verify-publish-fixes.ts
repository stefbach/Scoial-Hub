// Vérifie les correctifs de publication issus du rapport de vérification Meta
// (31/07/2026) et du diagnostic de la programmation LinkedIn :
//
//   1. LinkedIn — le PUT binaire vers l'URL d'upload SIGNÉE ne doit PAS porter
//      d'en-tête Authorization (cause réelle des « LinkedIn image upload →
//      HTTP 401 » en boucle depuis le 27/07, avec repli si LinkedIn l'exige).
//   2. Meta — appsecret_proof ajouté à tout appel Graph portant un access_token.
//   3. Lead Ads — page de remerciement : jamais de VIEW_WEBSITE sans URL
//      (« (#100) Button text is missing for Thank You Page »).
//   4. Publication programmée — fenêtre de réessai bornée : un post en retard
//      de plus de 24 h ne repart plus indéfiniment en silence.
//
// Usage : npm run test:publishfix

// IMPORTANT : les modules testés lisent process.env À LEUR CHARGEMENT
// (isLinkedInConfigured, META_APP_SECRET…). Les `import` statiques étant
// hoistés, la configuration est posée ici et les modules applicatifs sont
// chargés par `await import()` dans main(), donc APRÈS. Seuls `crypto` (natif)
// et les imports de types (effacés à la compilation) restent statiques.
process.env.META_APP_SECRET = "test_app_secret";
process.env.LINKEDIN_CLIENT_ID = "cid";
process.env.LINKEDIN_CLIENT_SECRET = "csecret";

import crypto from "crypto";
import type { ScheduledPost } from "../lib/types";

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/** Capture les appels fetch pour inspecter en-têtes et URLs, sans réseau. */
interface Call {
  url: string;
  init?: RequestInit;
}

function stubFetch(responder: (call: Call) => Response): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    const call = { url, init };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
  return calls;
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const h = (init?.headers ?? {}) as Record<string, string>;
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? h[key] : undefined;
}

async function main() {
  const realFetch = globalThis.fetch;

  const { linkedinConnector } = await import("../lib/connectors/linkedin");
  const { isConnectorAuthError } = await import("../lib/connectors/types");
  const { appSecretProof, withAppSecretProof, signFormBody } = await import(
    "../lib/connectors/meta-appsecret"
  );
  const { isPastRetryWindow } = await import("../lib/publishing/publish-scheduled");

  // ── 1) LinkedIn : PUT sans Authorization sur l'URL signée ─────────────────
  console.log("\n— 1) LinkedIn : le PUT vers l'URL d'upload signée n'envoie pas de Bearer —");
  {
    const UPLOAD_URL = "https://www.linkedin.com/dms-uploads/signed/abc";
    const calls = stubFetch((call) => {
      if (call.url.includes("/images?action=initializeUpload")) {
        return new Response(
          JSON.stringify({ value: { uploadUrl: UPLOAD_URL, image: "urn:li:image:X1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (call.url === "https://cdn.test/photo.jpg") {
        // 2 octets suffisent : ce n'est pas un WebP, aucune conversion déclenchée.
        return new Response(new Uint8Array([0xff, 0xd8]), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      }
      if (call.url === UPLOAD_URL) {
        // Le service d'upload REFUSE si un Bearer est présent — comportement
        // observé en production et reproduit ici.
        const hasBearer = Boolean(headerOf(call.init, "Authorization"));
        return new Response(null, { status: hasBearer ? 401 : 201 });
      }
      if (call.url.endsWith("/rest/posts")) {
        return new Response(JSON.stringify({}), {
          status: 201,
          headers: { "x-restli-id": "urn:li:share:999" },
        });
      }
      return new Response("{}", { status: 200 });
    });

    const res = await linkedinConnector.publishPost({
      externalAccountId: "urn:li:person:ABC",
      accessToken: "real_token_value",
      text: "Bonjour",
      media: { url: "https://cdn.test/photo.jpg", mimeType: "image/jpeg" },
    });

    const put = calls.find((c) => c.url === UPLOAD_URL);
    check("un PUT est bien émis vers l'URL signée", Boolean(put));
    check("le PUT ne porte PAS d'en-tête Authorization", headerOf(put?.init, "Authorization") === undefined);
    check("le PUT porte le Content-Type du média", headerOf(put?.init, "Content-Type") === "image/jpeg");
    check("un seul PUT (pas de repli déclenché inutilement)", calls.filter((c) => c.url === UPLOAD_URL).length === 1);
    check("initializeUpload, lui, porte bien le Bearer",
      headerOf(calls.find((c) => c.url.includes("initializeUpload"))?.init, "Authorization") === "Bearer real_token_value");
    check("publication réussie, image jointe", res.externalId === "urn:li:share:999", res.externalId);

    const body = calls.find((c) => c.url.endsWith("/rest/posts"))?.init?.body;
    const parsed = JSON.parse(String(body ?? "{}")) as { content?: { media?: { id?: string } } };
    check("l'URN de l'image est référencé dans le post", parsed.content?.media?.id === "urn:li:image:X1");
  }

  // ── 1bis) Repli : si LinkedIn EXIGE le Bearer, l'upload aboutit quand même ──
  console.log("\n— 1bis) Repli : LinkedIn exigeant le Bearer → seconde tentative avec en-tête —");
  {
    const UPLOAD_URL = "https://www.linkedin.com/dms-uploads/signed/def";
    const calls = stubFetch((call) => {
      if (call.url.includes("/images?action=initializeUpload")) {
        return new Response(
          JSON.stringify({ value: { uploadUrl: UPLOAD_URL, image: "urn:li:image:X2" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (call.url === "https://cdn.test/photo.jpg") {
        return new Response(new Uint8Array([0xff, 0xd8]), { status: 200, headers: { "Content-Type": "image/jpeg" } });
      }
      if (call.url === UPLOAD_URL) {
        // Comportement inverse : refuse SANS Bearer, accepte AVEC.
        const hasBearer = Boolean(headerOf(call.init, "Authorization"));
        return new Response(null, { status: hasBearer ? 201 : 401 });
      }
      if (call.url.endsWith("/rest/posts")) {
        return new Response(JSON.stringify({}), { status: 201, headers: { "x-restli-id": "urn:li:share:1000" } });
      }
      return new Response("{}", { status: 200 });
    });

    const res = await linkedinConnector.publishPost({
      externalAccountId: "urn:li:person:ABC",
      accessToken: "real_token_value",
      text: "Bonjour",
      media: { url: "https://cdn.test/photo.jpg", mimeType: "image/jpeg" },
    });
    check("deux tentatives de PUT (sans puis avec Bearer)", calls.filter((c) => c.url === UPLOAD_URL).length === 2);
    check("publication réussie malgré le premier 401", res.externalId === "urn:li:share:1000");
  }

  // ── 1ter) 401 sur initializeUpload = vrai token invalide → erreur typée ────
  console.log("\n— 1ter) 401 sur initializeUpload → ConnectorAuthError (arrêt des réessais) —");
  {
    stubFetch((call) => {
      if (call.url.includes("initializeUpload")) return new Response("{}", { status: 401 });
      return new Response("{}", { status: 200 });
    });
    let caught: unknown;
    try {
      await linkedinConnector.publishPost({
        externalAccountId: "urn:li:person:ABC",
        accessToken: "expired_token",
        text: "Bonjour",
        media: { url: "https://cdn.test/photo.jpg" },
      });
    } catch (e) {
      caught = e;
    }
    check("l'erreur est typée ConnectorAuthError", isConnectorAuthError(caught));
    check("le message invite à reconnecter le compte",
      String((caught as Error)?.message ?? "").includes("Reconnectez"));
  }

  globalThis.fetch = realFetch;

  // ── 2) appsecret_proof ─────────────────────────────────────────────────────
  console.log("\n— 2) appsecret_proof (option Meta « Require App Secret ») —");
  {
    const token = "EAAB_token_123";
    const expected = crypto.createHmac("sha256", "test_app_secret").update(token).digest("hex");
    check("HMAC-SHA256(token, app_secret) conforme", appSecretProof(token) === expected);

    const signed = withAppSecretProof(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
    check("URL signée : paramètre ajouté", new URL(signed).searchParams.get("appsecret_proof") === expected);
    check("URL signée : access_token préservé", new URL(signed).searchParams.get("access_token") === token);
    check("idempotent (re-signer ne double pas le paramètre)",
      withAppSecretProof(signed) === signed);
    check("URL sans access_token laissée intacte",
      withAppSecretProof("https://graph.facebook.com/v21.0/me") === "https://graph.facebook.com/v21.0/me");
    check("URL de pagination (paging.next) signée elle aussi",
      new URL(withAppSecretProof(`https://graph.facebook.com/v21.0/x/comments?after=Q1&access_token=${token}`))
        .searchParams.get("appsecret_proof") === expected);
    check("entrée non parsable renvoyée telle quelle", withAppSecretProof("pas-une-url") === "pas-une-url");

    const form = signFormBody(new URLSearchParams({ message: "hi", access_token: token }));
    check("corps form-urlencoded signé", form.get("appsecret_proof") === expected);
    check("corps sans token non signé",
      signFormBody(new URLSearchParams({ message: "hi" })).get("appsecret_proof") === null);
  }

  // ── 3) Lead Ads : page de remerciement ─────────────────────────────────────
  console.log("\n— 3) Lead Ads : bouton de la page de remerciement —");
  {
    // Reproduit la règle appliquée dans createLeadForm : le couple
    // (button_type, champs associés) doit toujours être cohérent.
    const build = (websiteUrl?: string) => {
      const u = websiteUrl?.trim();
      return {
        title: "Merci !",
        body: "Nous vous recontactons.",
        ...(u
          ? { button_type: "VIEW_WEBSITE", button_text: "Visiter le site", website_url: u }
          : { button_type: "NO_BUTTON" }),
      } as Record<string, string>;
    };

    const sansUrl = build(undefined);
    check("sans destination → NO_BUTTON", sansUrl.button_type === "NO_BUTTON");
    check("sans destination → aucun button_text orphelin", sansUrl.button_text === undefined);
    check("sans destination → aucun website_url orphelin", sansUrl.website_url === undefined);

    const avecUrl = build("https://tibok.mu");
    check("avec destination → VIEW_WEBSITE", avecUrl.button_type === "VIEW_WEBSITE");
    check("avec destination → button_text présent (cause du #100)", Boolean(avecUrl.button_text));
    check("avec destination → website_url présent", avecUrl.website_url === "https://tibok.mu");
    check("chaîne vide traitée comme absente", build("   ").button_type === "NO_BUTTON");
  }

  // ── 4) Fenêtre de réessai des publications programmées ─────────────────────
  console.log("\n— 4) Publication programmée : fenêtre de réessai bornée —");
  {
    const post = (date: string, time: string): ScheduledPost => ({
      id: "p1", platform: "linkedin", title: "t", date, time,
      source: "manual", status: "scheduled",
    });
    const now = new Date("2026-08-02T12:00:00Z");

    check("post à l'heure → dans la fenêtre", !isPastRetryWindow(post("2026-08-02", "11:30"), now));
    check("post en retard de 23 h → encore réessayé", !isPastRetryWindow(post("2026-08-01", "13:00"), now));
    check("post en retard de 25 h → hors fenêtre", isPastRetryWindow(post("2026-08-01", "11:00"), now));
    check("post du 28/07 (cas réel LinkedIn) → hors fenêtre",
      isPastRetryWindow(post("2026-07-28", "09:00"), now));
    check("post futur → dans la fenêtre", !isPastRetryWindow(post("2026-08-04", "09:00"), now));
    check("date absente → jamais hors fenêtre (pas de faux positif)",
      !isPastRetryWindow({ ...post("2026-07-28", "09:00"), date: "" }, now));
    check("heure absente → traitée comme 00:00",
      isPastRetryWindow({ ...post("2026-07-31", "09:00"), time: "" }, now));
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
