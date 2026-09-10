// Vérifie la conformité Direct Post de la publication TikTok, après
// l'approbation de l'accès « Direct Post » (Content Posting API).
//
// Le sujet central : jusqu'ici, une publication sans réglages partait en
// SELF_ONLY. C'était sans effet tant que l'app n'était pas auditée (TikTok
// imposait cette visibilité aux clients non audités). Depuis l'approbation,
// ce repli publie en privé une vidéo destinée au public — la publication
// réussit, elle est annoncée comme publiée, et personne ne la voit.
//
//   1. Aucune confidentialité choisie → REFUS explicite, aucune requête de
//      publication émise.
//   2. « Privé » choisi volontairement → accepté (c'est un usage légitime).
//   3. Confidentialité absente des options du compte → refus argumenté.
//   4. Vidéo : endpoint Direct Post + PULL_FROM_URL + interactions transmises.
//   5. Photo : endpoint photo + post_mode DIRECT_POST.
//   6. Divulgation commerciale → bons drapeaux de marque.
//
// Usage : npm run test:tiktokvisibilite

process.env.TIKTOK_CLIENT_KEY = "test_key";
process.env.TIKTOK_CLIENT_SECRET = "test_secret";

import type { TikTokPublishOptions } from "../lib/types";

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface Call {
  url: string;
  body: Record<string, unknown>;
}

/** Remplace fetch : creator_info répond, la publication est capturée. */
function stub(privacyOptions: string[], locks: Partial<Record<"comment" | "duet" | "stitch", boolean>> = {}): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    calls.push({ url, body });
    if (url.includes("creator_info/query")) {
      return new Response(
        JSON.stringify({
          data: {
            privacy_level_options: privacyOptions,
            comment_disabled: locks.comment ?? false,
            duet_disabled: locks.duet ?? false,
            stitch_disabled: locks.stitch ?? false,
            creator_nickname: "testeur",
          },
          error: { code: "ok" },
        }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({ data: { publish_id: "pub_1" }, error: { code: "ok" } }),
      { status: 200 }
    );
  }) as typeof fetch;
  return calls;
}

const OPTIONS_ALL = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"];

const baseOptions = (privacyLevel: string): TikTokPublishOptions => ({
  privacyLevel,
  allowDuet: true,
  allowStitch: false,
  allowComment: true,
  disclosure: "none",
  musicConsent: true,
});

const VIDEO = { url: "https://cdn.example.com/film.mp4", mimeType: "video/mp4" };
const PHOTO = { url: "https://cdn.example.com/visuel.jpg", mimeType: "image/jpeg" };

async function main() {
  const { tiktokConnector } = await import("../lib/connectors/providers/tiktok");

  const publish = (args: { media: typeof VIDEO; tiktok?: TikTokPublishOptions }) =>
    tiktokConnector.publishPost({
      externalAccountId: "acc",
      accessToken: "tok",
      text: "Bonjour",
      media: args.media,
      tiktok: args.tiktok,
    });

  /* 1 — aucune confidentialité choisie → refus, et RIEN n'est publié */
  {
    const calls = stub(OPTIONS_ALL);
    let message = "";
    try {
      await publish({ media: VIDEO });
      message = "(aucune erreur levée)";
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    check(
      "sans confidentialité choisie, la publication est refusée",
      /confidentialité/i.test(message),
      message
    );
    check(
      "et aucune requête de publication n'est émise",
      calls.every((c) => !c.url.includes("/publish/video/init") && !c.url.includes("/publish/content/init")),
      calls.map((c) => c.url).join(", ")
    );
    check(
      "le repli silencieux vers SELF_ONLY a bien disparu",
      !calls.some((c) => JSON.stringify(c.body).includes("SELF_ONLY")),
      JSON.stringify(calls.map((c) => c.body))
    );
  }

  /* 2 — « privé » VOLONTAIRE : toujours possible, c'est un usage légitime */
  {
    const calls = stub(OPTIONS_ALL);
    const res = await publish({ media: VIDEO, tiktok: baseOptions("SELF_ONLY") });
    const post = calls.find((c) => c.url.includes("/publish/video/init"));
    const info = post?.body.post_info as Record<string, unknown> | undefined;
    check("un privé demandé explicitement est accepté", !!res.externalId, JSON.stringify(res));
    check("et transmis tel quel au moteur", info?.privacy_level === "SELF_ONLY", JSON.stringify(info));
  }

  /* 3 — confidentialité que le compte ne propose pas → refus argumenté */
  {
    stub(["SELF_ONLY"]);
    let message = "";
    try {
      await publish({ media: VIDEO, tiktok: baseOptions("PUBLIC_TO_EVERYONE") });
      message = "(aucune erreur levée)";
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    check(
      "une confidentialité non proposée par le compte est refusée, options citées",
      /PUBLIC_TO_EVERYONE/.test(message) && /SELF_ONLY/.test(message),
      message
    );
  }

  /* 4 — vidéo publique : Direct Post, PULL_FROM_URL, interactions transmises */
  {
    const calls = stub(OPTIONS_ALL);
    await publish({ media: VIDEO, tiktok: baseOptions("PUBLIC_TO_EVERYONE") });
    const post = calls.find((c) => c.url.includes("/publish/video/init"));
    const info = post?.body.post_info as Record<string, unknown>;
    const src = post?.body.source_info as Record<string, unknown>;

    check("creator_info est interrogé AVANT la publication", calls[0]?.url.includes("creator_info/query"), calls[0]?.url);
    check(
      "l'endpoint est bien Direct Post, pas la boîte de réception (brouillon)",
      !!post && !post.url.includes("/inbox/"),
      post?.url
    );
    check("la visibilité publique est transmise", info?.privacy_level === "PUBLIC_TO_EVERYONE", JSON.stringify(info));
    check("la vidéo est tirée depuis notre serveur (PULL_FROM_URL)", src?.source === "PULL_FROM_URL", JSON.stringify(src));
    check("l'URL de la vidéo est transmise", src?.video_url === VIDEO.url, JSON.stringify(src));
    // Les cases de l'UI disent ce qui est AUTORISÉ ; l'API attend l'inverse.
    check("Duo autorisé → disable_duet false", info?.disable_duet === false, JSON.stringify(info));
    check("Stitch refusé → disable_stitch true", info?.disable_stitch === true, JSON.stringify(info));
    check("Commentaires autorisés → disable_comment false", info?.disable_comment === false, JSON.stringify(info));
    check(
      "sans divulgation commerciale, aucun drapeau de marque n'est envoyé",
      info?.brand_organic_toggle === undefined && info?.brand_content_toggle === undefined,
      JSON.stringify(info)
    );
  }

  /* 5 — photo : endpoint distinct et post_mode explicite */
  {
    const calls = stub(OPTIONS_ALL);
    await publish({ media: PHOTO, tiktok: baseOptions("PUBLIC_TO_EVERYONE") });
    const post = calls.find((c) => c.url.includes("/publish/content/init"));
    const src = post?.body.source_info as Record<string, unknown>;
    check("une photo passe par l'endpoint photo", !!post, calls.map((c) => c.url).join(", "));
    check("avec post_mode DIRECT_POST", post?.body.post_mode === "DIRECT_POST", JSON.stringify(post?.body));
    check("et media_type PHOTO", post?.body.media_type === "PHOTO", JSON.stringify(post?.body));
    check("l'image est tirée depuis notre serveur", src?.source === "PULL_FROM_URL", JSON.stringify(src));
  }

  /* 6 — divulgation commerciale → drapeaux de marque */
  {
    const calls = stub(OPTIONS_ALL);
    await publish({
      media: VIDEO,
      tiktok: { ...baseOptions("PUBLIC_TO_EVERYONE"), disclosure: "both" },
    });
    const info = calls.find((c) => c.url.includes("/publish/video/init"))?.body.post_info as Record<string, unknown>;
    check(
      "« votre marque » + « contenu de marque » → les deux drapeaux",
      info?.brand_organic_toggle === true && info?.brand_content_toggle === true,
      JSON.stringify(info)
    );

    const calls2 = stub(OPTIONS_ALL);
    await publish({
      media: VIDEO,
      tiktok: { ...baseOptions("PUBLIC_TO_EVERYONE"), disclosure: "branded_content" },
    });
    const info2 = calls2.find((c) => c.url.includes("/publish/video/init"))?.body.post_info as Record<string, unknown>;
    check(
      "« contenu de marque » seul → uniquement brand_content_toggle",
      info2?.brand_content_toggle === true && info2?.brand_organic_toggle === undefined,
      JSON.stringify(info2)
    );
  }

  console.log(failures === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failures} échec(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
