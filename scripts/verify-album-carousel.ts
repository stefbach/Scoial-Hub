// Retour client (réunion Rosiane, point #7) : publier plusieurs photos dans
// UNE SEULE publication (album Facebook, carrousel Instagram) — jusqu'ici
// chaque post ne portait qu'un seul média.
//
// Vérifie, sans réseau (fetch stubbé), la séquence exacte d'appels Graph :
//   Facebook — chaque photo en `published=false`, puis `/feed` avec
//              `attached_media` regroupant tous les media_fbid, couverture
//              en premier.
//   Instagram — chaque image en conteneur enfant `is_carousel_item=true`,
//              attente `FINISHED`, puis conteneur parent `CAROUSEL` listant
//              tous les enfants, attente, puis `media_publish`.
//
// Usage : npm run test:album

process.env.META_APP_SECRET = "test_app_secret";

import { publishFacebookAlbum, publishInstagramCarousel } from "../lib/connectors/meta-publish";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface Call {
  url: string;
  method: string;
  body?: string;
}

function stubFetch(responder: (call: Call) => Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    const call: Call = { url, method, body };
    calls.push(call);
    const json = responder(call);
    return new Response(JSON.stringify(json), { status: 200 });
  }) as typeof fetch;
  return calls;
}

async function main() {
  // ── Facebook album ──────────────────────────────────────────────────────
  {
    let photoN = 0;
    const calls = stubFetch((call) => {
      if (call.method === "POST" && call.url.endsWith("/photos")) {
        photoN += 1;
        return { id: `photo_${photoN}` };
      }
      if (call.method === "POST" && call.url.endsWith("/feed")) {
        return { id: "fb_post_1" };
      }
      return {};
    });

    const outcome = await publishFacebookAlbum(
      "page123",
      "page_token",
      ["https://cdn.example.com/cover.jpg", "https://cdn.example.com/extra1.jpg"],
      "Légende de l'album"
    );

    check("publishFacebookAlbum réussit", outcome.ok === true, outcome.error);
    check("publishFacebookAlbum renvoie l'id du post au fil", outcome.id === "fb_post_1");

    const photoCalls = calls.filter((c) => c.url.endsWith("/photos"));
    check("2 images téléversées séparément", photoCalls.length === 2, `${photoCalls.length}`);
    check(
      "chaque image est téléversée NON publiée (published=false)",
      photoCalls.every((c) => c.body?.includes("published=false"))
    );

    const feedCall = calls.find((c) => c.url.endsWith("/feed"));
    const attachedMedia = feedCall?.body ? new URLSearchParams(feedCall.body).get("attached_media") : null;
    const parsed = attachedMedia ? (JSON.parse(attachedMedia) as { media_fbid: string }[]) : [];
    check(
      "le post au fil rattache les 2 photos, couverture en premier",
      parsed.length === 2 && parsed[0].media_fbid === "photo_1" && parsed[1].media_fbid === "photo_2",
      JSON.stringify(parsed)
    );
  }

  // ── Facebook album — une image refusée arrête tout, sans publier ────────
  {
    let photoN = 0;
    const calls = stubFetch((call) => {
      if (call.method === "POST" && call.url.endsWith("/photos")) {
        photoN += 1;
        if (photoN === 2) return { error: { message: "Image refusée", code: 100 } };
        return { id: `photo_${photoN}` };
      }
      if (call.method === "POST" && call.url.endsWith("/feed")) return { id: "should_not_happen" };
      return {};
    });
    const outcome = await publishFacebookAlbum(
      "page123",
      "page_token",
      ["https://cdn.example.com/ok.jpg", "https://cdn.example.com/bad.jpg"],
      "x"
    );
    check("une image refusée fait échouer l'album entier", outcome.ok === false);
    check("aucun post au fil n'est créé si une image échoue", !calls.some((c) => c.url.endsWith("/feed")));
  }

  // ── Instagram carrousel ──────────────────────────────────────────────────
  {
    let childN = 0;
    let parentId = "";
    const calls = stubFetch((call) => {
      if (call.method === "GET") return { status_code: "FINISHED" };
      if (call.method === "POST" && call.url.includes("/media_publish")) {
        return { id: "ig_post_1" };
      }
      if (call.method === "POST" && call.url.endsWith("/media")) {
        if (call.body?.includes("is_carousel_item=true")) {
          childN += 1;
          return { id: `child_${childN}` };
        }
        // Conteneur parent (media_type=CAROUSEL).
        parentId = "parent_1";
        return { id: parentId };
      }
      return {};
    });

    const outcome = await publishInstagramCarousel(
      "ig456",
      "ig_token",
      ["https://cdn.example.com/cover.jpg", "https://cdn.example.com/extra1.jpg", "https://cdn.example.com/extra2.jpg"],
      "Légende du carrousel"
    );

    check("publishInstagramCarousel réussit", outcome.ok === true, outcome.error);
    check("publishInstagramCarousel renvoie l'id du post publié", outcome.id === "ig_post_1");

    const childCalls = calls.filter((c) => c.method === "POST" && c.url.endsWith("/media") && c.body?.includes("is_carousel_item=true"));
    check("3 conteneurs enfants créés (un par image)", childCalls.length === 3, `${childCalls.length}`);

    const parentCall = calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/media") && c.body?.includes("media_type=CAROUSEL")
    );
    const childrenParam = parentCall?.body ? new URLSearchParams(parentCall.body).get("children") : null;
    check(
      "le conteneur parent liste les 3 enfants, dans l'ordre (couverture en premier)",
      childrenParam === "child_1,child_2,child_3",
      String(childrenParam)
    );

    const publishCall = calls.find((c) => c.url.includes("/media_publish"));
    const creationId = publishCall?.body ? new URLSearchParams(publishCall.body).get("creation_id") : null;
    check("la publication finale cible le conteneur PARENT, pas un enfant", creationId === parentId, String(creationId));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
