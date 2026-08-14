// Vérifie la publication de STORIES et de REELS sur Facebook et Instagram.
//
// Contexte : jusqu'ici l'app n'appelait QUE les endpoints de fil
// (/{page}/photos, /{page}/feed, /{ig}/media sans media_type) — publier une
// story était donc structurellement impossible. Chaque emplacement a son propre
// endpoint Graph et ce test verrouille l'appel exact attendu par Meta :
//
//   FB story photo  → /{page}/photos?published=false  puis  /{page}/photo_stories
//   FB story vidéo  → /{page}/video_stories  (start → rupload → finish)
//   FB reel         → /{page}/video_reels    (start → rupload → finish)
//   IG story        → /{ig}/media?media_type=STORIES (sans légende) → media_publish
//   IG reel / vidéo → /{ig}/media?media_type=REELS   (media_type=VIDEO est retiré)
//
// Aucun appel réseau : `fetch` est remplacé par un stub qui rejoue les réponses
// de Meta et enregistre les requêtes.
//
// Usage : npm run test:stories

process.env.META_APP_SECRET = "test_app_secret";
process.env.META_APP_ID = "test_app_id";
process.env.META_API_VERSION = "v21.0";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface Call {
  url: string;
  method: string;
  body: URLSearchParams;
  headers: Record<string, string>;
}

/** Remplace fetch : enregistre chaque appel et répond selon l'URL. */
function stubFetch(respond: (call: Call) => unknown): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    const raw = typeof init?.body === "string" ? init.body : "";
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      body: new URLSearchParams(raw),
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    return new Response(JSON.stringify(respond(call) ?? {}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

/** Chemin Graph appelé, sans l'hôte ni la version (ex. "123/photo_stories"). */
function pathOf(url: string): string {
  return url.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "").split("?")[0];
}
function paths(calls: Call[]): string[] {
  return calls.map((c) => pathOf(c.url));
}

async function main() {
  const realFetch = globalThis.fetch;
  const { publishToFacebookPage, publishToInstagram, inferMediaKind, normalizePostType } = await import(
    "../lib/connectors/meta-publish"
  );

  // ── 1) Story PHOTO Facebook : photo non publiée → photo_stories ─────────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "42/photos") return { id: "PHOTO_1" };
      if (p === "42/photo_stories") return { success: true, post_id: "STORY_1" };
      return {};
    });
    const r = await publishToFacebookPage("42", "PAGE_TOKEN", {
      mediaUrl: "https://cdn.test/visuel.jpg",
      postType: "story",
    });
    check("FB story photo → publiée", r.ok, r.error ?? r.id);
    check("FB story photo → /photos puis /photo_stories", paths(calls).join(" → ") === "42/photos → 42/photo_stories", paths(calls).join(" → "));
    check("FB story photo → photo téléversée NON publiée", calls[0]?.body.get("published") === "false");
    check("FB story photo → photo_id transmis à la story", calls[1]?.body.get("photo_id") === "PHOTO_1");
    check("FB story photo → appsecret_proof signé", Boolean(calls[0]?.body.get("appsecret_proof")));
  }

  // ── 2) Story VIDÉO Facebook : start → rupload → finish ─────────────────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "42/video_stories" && c.body.get("upload_phase") === "start") {
        return { video_id: "VID_9", upload_url: "https://rupload.facebook.com/video-upload/v21.0/VID_9" };
      }
      if (c.url.startsWith("https://rupload.facebook.com")) return { success: true };
      if (p === "VID_9") return { status: { video_status: "ready" } };
      if (p === "42/video_stories") return { success: true, post_id: "STORY_VID_1" };
      return {};
    });
    const r = await publishToFacebookPage("42", "PAGE_TOKEN", {
      mediaUrl: "https://cdn.test/montage.mp4",
      postType: "story",
    });
    check("FB story vidéo → publiée", r.ok, r.error ?? r.id);
    const phases = calls.filter((c) => pathOf(c.url) === "42/video_stories").map((c) => c.body.get("upload_phase"));
    check("FB story vidéo → phases start puis finish", phases.join(",") === "start,finish", phases.join(","));
    const upload = calls.find((c) => c.url.startsWith("https://rupload.facebook.com"));
    check("FB story vidéo → fichier passé par en-tête file_url", upload?.headers.file_url === "https://cdn.test/montage.mp4");
    check("FB story vidéo → en-tête Authorization OAuth", upload?.headers.Authorization === "OAuth PAGE_TOKEN");
    check("FB story vidéo → attente du transcodage avant finish", paths(calls).includes("VID_9"));
    check("FB story vidéo → id de post renvoyé", r.id === "STORY_VID_1", r.id);
  }

  // ── 3) Reel Facebook → video_reels (et pas video_stories) ──────────────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "42/video_reels" && c.body.get("upload_phase") === "start") {
        return { video_id: "VID_R", upload_url: "https://rupload.facebook.com/video-upload/v21.0/VID_R" };
      }
      if (c.url.startsWith("https://rupload.facebook.com")) return { success: true };
      if (p === "VID_R") return { status: { video_status: "ready" } };
      if (p === "42/video_reels") return { success: true, post_id: "REEL_1" };
      return {};
    });
    const r = await publishToFacebookPage("42", "PAGE_TOKEN", {
      mediaUrl: "https://cdn.test/reel.mp4",
      text: "Ma légende",
      postType: "reel",
    });
    check("FB reel → publié via /video_reels", r.ok && paths(calls).includes("42/video_reels"), r.error);
    const finish = calls.filter((c) => pathOf(c.url) === "42/video_reels")[1];
    check("FB reel → légende transmise à la phase finish", finish?.body.get("description") === "Ma légende");
  }

  // ── 4) Un reel sans vidéo est refusé AVANT tout appel réseau ───────────────
  {
    const calls = stubFetch(() => ({}));
    const r = await publishToFacebookPage("42", "PAGE_TOKEN", { mediaUrl: "https://cdn.test/x.jpg", postType: "reel" });
    check("FB reel avec une image → refusé", !r.ok && Boolean(r.error));
    check("FB reel avec une image → aucun appel Meta gaspillé", calls.length === 0, `${calls.length} appel(s)`);
  }

  // ── 5) Story Instagram : media_type=STORIES, sans légende ──────────────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "IG1/media") return { id: "CONT_1" };
      if (p === "CONT_1") return { status_code: "FINISHED" };
      if (p === "IG1/media_publish") return { id: "IG_STORY_1" };
      return {};
    });
    const r = await publishToInstagram("IG1", "PAGE_TOKEN", {
      mediaUrl: "https://cdn.test/story.jpg",
      text: "légende ignorée par les stories",
      postType: "story",
    });
    check("IG story → publiée", r.ok, r.error ?? r.id);
    const container = calls[0];
    check("IG story → media_type=STORIES", container?.body.get("media_type") === "STORIES", container?.body.get("media_type") ?? "—");
    check("IG story → image_url transmise", container?.body.get("image_url") === "https://cdn.test/story.jpg");
    check("IG story → aucune légende envoyée", container?.body.get("caption") === null);
    check("IG story → attente du conteneur avant publication", paths(calls).join(" → ") === "IG1/media → CONT_1 → IG1/media_publish", paths(calls).join(" → "));
  }

  // ── 6) Story VIDÉO Instagram → video_url ───────────────────────────────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "IG1/media") return { id: "CONT_2" };
      if (p === "CONT_2") return { status_code: "FINISHED" };
      if (p === "IG1/media_publish") return { id: "IG_STORY_2" };
      return {};
    });
    const r = await publishToInstagram("IG1", "PAGE_TOKEN", {
      mediaUrl: "https://cdn.test/montage.mp4",
      postType: "story",
    });
    check("IG story vidéo → publiée", r.ok, r.error);
    check("IG story vidéo → video_url + STORIES", calls[0]?.body.get("video_url") === "https://cdn.test/montage.mp4" && calls[0]?.body.get("media_type") === "STORIES");
  }

  // ── 7) Vidéo au fil Instagram → REELS (media_type=VIDEO est retiré) ────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "IG1/media") return { id: "CONT_3" };
      if (p === "CONT_3") return { status_code: "FINISHED" };
      if (p === "IG1/media_publish") return { id: "IG_REEL_1" };
      return {};
    });
    const r = await publishToInstagram("IG1", "PAGE_TOKEN", {
      mediaUrl: "https://cdn.test/clip.mp4",
      text: "Ma légende",
      postType: "feed",
    });
    check("IG vidéo au fil → publiée", r.ok, r.error);
    check("IG vidéo au fil → media_type=REELS", calls[0]?.body.get("media_type") === "REELS", calls[0]?.body.get("media_type") ?? "—");
    check("IG vidéo au fil → légende conservée", calls[0]?.body.get("caption") === "Ma légende");
  }

  // ── 8) Erreur Meta remontée telle quelle (message actionnable) ─────────────
  {
    stubFetch((c) => {
      if (pathOf(c.url) === "IG1/media") return { error: { message: "Le format de l'image n'est pas supporté." } };
      return {};
    });
    const r = await publishToInstagram("IG1", "PAGE_TOKEN", { mediaUrl: "https://cdn.test/x.jpg", postType: "story" });
    check("IG erreur Meta → message d'origine conservé", !r.ok && r.error === "Le format de l'image n'est pas supporté.", r.error);
  }

  // ── 9) Token expiré (code 190) : erreur TYPÉE, pas un échec transitoire ────
  // Le cron doit couper la connexion plutôt que de réessayer toutes les 10 min.
  {
    const { facebookConnector } = await import("../lib/connectors/meta");
    const { isConnectorAuthError } = await import("../lib/connectors/types");
    stubFetch(() => ({ error: { message: "Error validating access token.", code: 190 } }));

    const outcome = await publishToFacebookPage("42", "PAGE_TOKEN", {
      mediaUrl: "https://cdn.test/x.jpg",
      postType: "story",
    });
    check("code d'erreur Meta remonté par la primitive", outcome.code === 190, String(outcome.code));

    let caught: unknown;
    try {
      await facebookConnector.publishPost({
        externalAccountId: "42",
        accessToken: "PAGE_TOKEN",
        text: "",
        media: { url: "https://cdn.test/x.jpg", mimeType: "image/jpeg" },
        postType: "story",
      });
    } catch (e) {
      caught = e;
    }
    check("token invalide → ConnectorAuthError (reconnexion exigée)", isConnectorAuthError(caught), String(caught));
  }

  // ── 10) Helpers ────────────────────────────────────────────────────────────
  check("inferMediaKind : .mp4 → vidéo", inferMediaKind("https://x/a.mp4") === "video");
  check("inferMediaKind : .jpg → image", inferMediaKind("https://x/a.jpg") === "image");
  check("inferMediaKind : mime prioritaire sur l'extension", inferMediaKind("https://x/a", "video/mp4") === "video");
  check("normalizePostType : valeur inconnue → feed", normalizePostType("n'importe quoi") === "feed");
  check("normalizePostType : story conservé", normalizePostType("story") === "story");

  globalThis.fetch = realFetch;
  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Module (et non script global) : isole les déclarations de ce fichier.
export {};
