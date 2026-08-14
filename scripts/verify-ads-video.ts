// Vérifie la création d'une PUBLICITÉ MÉTA À PARTIR DE SA PROPRE VIDÉO.
//
// Contexte : promouvoir une vidéo (montage du Studio, vidéo IA, import) échouait
// systématiquement pour deux raisons enchaînées côté Marketing API :
//   1. `/act_X/advideos` renvoie un id AVANT la fin du transcodage — créer la
//      créative dans la foulée est refusé (« video is still being processed ») ;
//   2. une créative vidéo EXIGE une image de couverture : sans image associée à
//      la pub, `video_data` partait sans `image_url` et Meta refusait la pub.
// Et l'ordre des appels laissait une campagne + un ad set orphelins EN PAUSE
// quand la vidéo finissait par échouer.
//
// Aucun appel réseau : `fetch` est remplacé par un stub qui rejoue Meta.
//
// Usage : npm run test:adsvideo

process.env.META_APP_SECRET = "test_app_secret";
process.env.META_ADS_API_VERSION = "v23.0";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface Call {
  url: string;
  method: string;
  body: URLSearchParams;
}

function stubFetch(respond: (call: Call) => unknown): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    const raw = typeof init?.body === "string" ? init.body : "";
    const call: Call = { url, method: init?.method ?? "GET", body: new URLSearchParams(raw) };
    calls.push(call);
    return new Response(JSON.stringify(respond(call) ?? {}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

function pathOf(url: string): string {
  return url.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "").split("?")[0];
}

const COMPANY = "test-ads-co";

async function main() {
  const realFetch = globalThis.fetch;
  const { upsertConnection } = await import("../lib/repositories/channel-connections");
  const { publishAd } = await import("../lib/connectors/meta-ads");

  // Société connectée à Meta (mode mock : stockage mémoire, pas de Supabase).
  await upsertConnection(COMPANY, "facebook", { page_id: "PAGE1", page_access_token: "PAGE_TOKEN", user_access_token: "USER_TOKEN" }, "connected");
  await upsertConnection(COMPANY, "meta_ads", { ad_account_id: "999" }, "connected");

  const baseInput = {
    companyId: COMPANY,
    name: "Test vidéo",
    objective: "trafic",
    dailyBudgetCents: 1000,
    countries: ["FR"],
    primaryText: "Regardez notre montage",
    headline: "Notre histoire",
    link: "https://exemple.test",
  };

  // ── 1) Pub vidéo SANS image : la vignette Meta comble le manque ────────────
  {
    let statusPolls = 0;
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "act_999/advideos") return { id: "VID_1" };
      if (p === "VID_1") {
        statusPolls += 1;
        // Encore en cours au 1er sondage → prêt ensuite.
        return { status: { video_status: statusPolls === 1 ? "processing" : "ready" } };
      }
      if (p === "VID_1/thumbnails") return { data: [{ uri: "https://cdn.meta/thumb.jpg", is_preferred: true }] };
      if (p === "act_999/campaigns") return { id: "CAMP_1" };
      if (p === "act_999/adsets") return { id: "ADSET_1" };
      if (p === "act_999/adcreatives") return { id: "CREA_1" };
      if (p === "act_999/ads") return { id: "AD_1" };
      return {};
    });

    const res = await publishAd({ ...baseInput, videoUrl: "https://cdn.test/montage.mp4" });
    check("pub vidéo sans image → créée", res.adId === "AD_1" && res.status === "PAUSED", res.adId);
    check("vidéo téléversée sur le compte pub", calls.some((c) => pathOf(c.url) === "act_999/advideos"));
    check("attente du transcodage (sondages du statut)", statusPolls >= 2, `${statusPolls} sondage(s)`);

    const creative = calls.find((c) => pathOf(c.url) === "act_999/adcreatives");
    const spec = JSON.parse(creative?.body.get("object_story_spec") ?? "{}") as {
      video_data?: { video_id?: string; image_url?: string; message?: string };
    };
    check("créative de type vidéo", spec.video_data?.video_id === "VID_1", JSON.stringify(spec).slice(0, 90));
    check("couverture reprise de la vignette Meta", spec.video_data?.image_url === "https://cdn.meta/thumb.jpg", spec.video_data?.image_url ?? "aucune");
    check("message conservé", spec.video_data?.message === "Regardez notre montage");

    // Ordre : la vidéo doit être prête AVANT campagne/ad set/créative.
    const order = calls.map((c) => pathOf(c.url));
    check(
      "vidéo traitée avant la création de la campagne",
      order.indexOf("act_999/advideos") < order.indexOf("act_999/campaigns"),
      order.join(" → ").slice(0, 120)
    );
  }

  // ── 2) Vignette explicite prioritaire sur celle de Meta ────────────────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "act_999/advideos") return { id: "VID_2" };
      if (p === "VID_2") return { status: { video_status: "ready" } };
      if (p === "VID_2/thumbnails") return { data: [{ uri: "https://cdn.meta/auto.jpg" }] };
      if (p === "act_999/campaigns") return { id: "CAMP_2" };
      if (p === "act_999/adsets") return { id: "ADSET_2" };
      if (p === "act_999/adcreatives") return { id: "CREA_2" };
      if (p === "act_999/ads") return { id: "AD_2" };
      return {};
    });
    await publishAd({ ...baseInput, videoUrl: "https://cdn.test/m.mp4", videoThumbUrl: "https://cdn.test/ma-vignette.jpg" });
    const creative = calls.find((c) => pathOf(c.url) === "act_999/adcreatives");
    const spec = JSON.parse(creative?.body.get("object_story_spec") ?? "{}") as { video_data?: { image_url?: string } };
    check("vignette choisie par l'utilisateur prioritaire", spec.video_data?.image_url === "https://cdn.test/ma-vignette.jpg", spec.video_data?.image_url ?? "aucune");
  }

  // ── 3) Vidéo refusée par Meta → aucune campagne orpheline ─────────────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "act_999/advideos") return { id: "VID_3" };
      if (p === "VID_3") return { status: { video_status: "error" } };
      return { id: "NE_DEVRAIT_PAS_ARRIVER" };
    });
    let message = "";
    try {
      await publishAd({ ...baseInput, videoUrl: "https://cdn.test/casse.mp4" });
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    check("vidéo invalide → erreur explicite", message.includes("traiter la vidéo"), message);
    check("aucune campagne créée", !calls.some((c) => pathOf(c.url) === "act_999/campaigns"));
    check("aucun ad set créé", !calls.some((c) => pathOf(c.url) === "act_999/adsets"));
  }

  // ── 4) Non-régression : la pub IMAGE reste une créative link_data ──────────
  {
    const calls = stubFetch((c) => {
      const p = pathOf(c.url);
      if (p === "act_999/campaigns") return { id: "CAMP_4" };
      if (p === "act_999/adsets") return { id: "ADSET_4" };
      if (p === "act_999/adcreatives") return { id: "CREA_4" };
      if (p === "act_999/ads") return { id: "AD_4" };
      return {};
    });
    const res = await publishAd({ ...baseInput, imageUrl: "https://cdn.test/visuel.jpg" });
    check("pub image → créée", res.adId === "AD_4");
    check("pub image → aucune vidéo téléversée", !calls.some((c) => pathOf(c.url) === "act_999/advideos"));
    const creative = calls.find((c) => pathOf(c.url) === "act_999/adcreatives");
    const spec = JSON.parse(creative?.body.get("object_story_spec") ?? "{}") as { link_data?: { picture?: string } };
    check("pub image → link_data avec le visuel", spec.link_data?.picture === "https://cdn.test/visuel.jpg", spec.link_data?.picture ?? "aucune");
  }

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
