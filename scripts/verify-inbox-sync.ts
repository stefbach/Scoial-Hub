// Test autonome (sans réseau ni credentials) de la synchronisation Meta de la
// messagerie et de l'envoi des réponses — parité avec la boîte de réception
// Meta Business Suite.
//
// Vérifie que :
//   - les commentaires FB proviennent de /feed (posts de la Page ET des
//     visiteurs) avec filter(stream) → les réponses en fil sont importées ;
//   - la pagination IMBRIQUÉE (commentaires d'un post, messages d'une
//     conversation) est suivie, pas seulement la première page ;
//   - les DM Messenger et Instagram sont importés, sans les échos de la Page ;
//   - l'authorHandle d'un DM Instagram est l'IGSID (id) — jamais le username —
//     sinon la Send API refuse la réponse ;
//   - les avis de la Page (/ratings) arrivent en kind "review" et sont
//     répondables via leur open_graph_story ;
//   - les erreurs Graph (permission manquante) remontent dans `note` au lieu
//     d'être avalées en silence ;
//   - deliverMetaReply route chaque type vers le bon endpoint Graph.
//
// Lancement : npx tsx scripts/verify-inbox-sync.ts

import { upsertConnection } from "../lib/repositories/channel-connections";
import { listMessages, ingestMessage } from "../lib/repositories/inbox";
import { syncMetaComments, deliverMetaReply, graphTimeToIso } from "../lib/inbox/meta-sync";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// ── Fixtures Graph API ────────────────────────────────────────────────────────

const PAGE = "PAGE1";
const IG = "IG1";

const posted: Array<{ url: string; body: string }> = [];
const fetched: string[] = [];

function json(data: unknown) {
  return { json: async () => data } as Response;
}

function route(url: string, init?: RequestInit): Response {
  fetched.push(url);
  if (init?.method === "POST") {
    posted.push({ url, body: String(init.body ?? "") });
    return json({ id: "created_1", message_id: "mid_1" });
  }

  // — Pagination imbriquée —
  if (url.includes("nested-fb-comments")) {
    return json({ data: [{ id: "c4", from: { name: "Dana", id: "u4" }, message: "Page 2 du fil" }] });
  }
  if (url.includes("nested-msgs")) {
    return json({ data: [{ id: "m3", message: "Suite de la conversation", from: { name: "Bob", id: "PSID7" } }] });
  }

  // — Permissions accordées au token (diagnostic des contenus masqués) —
  if (url.includes("me/permissions")) {
    const all = [
      "pages_read_engagement",
      "pages_read_user_content",
      "pages_manage_engagement",
      "pages_messaging",
      "instagram_manage_comments",
      "instagram_manage_messages",
    ];
    // "tok-old" simule un token accordé AVANT l'ajout des nouveaux scopes.
    const granted = url.includes("access_token=tok-old")
      ? all.filter((p) => p !== "pages_read_user_content" && p !== "instagram_manage_messages")
      : all;
    return json({ data: granted.map((p) => ({ permission: p, status: "granted" })) });
  }

  // — Page en erreur de permission (2e société) —
  if (url.includes("PAGE_ERR/feed")) {
    return json({ error: { message: "(#10) Permission pages_read_user_content manquante" } });
  }
  if (url.includes("PAGE_ERR/")) return json({ data: [] });

  // — Facebook : feed (post de la Page + post visiteur), commentaires en stream —
  if (url.includes(`${PAGE}/feed`)) {
    return json({
      data: [
        {
          id: "post1",
          permalink_url: "https://fb.com/post1",
          comments: {
            data: [
              { id: "c1", from: { name: "Alice", id: "u1" }, message: "Top !", created_time: "2026-07-10T08:30:00+0000" },
              { id: "c2", from: { name: "Ma Page", id: PAGE }, message: "Merci (notre propre réponse)" },
              { id: "c3", from: { name: "Carl", id: "u3" }, message: "Réponse en fil" },
            ],
            paging: { next: "https://graph.facebook.com/v21.0/nested-fb-comments?after=x" },
          },
        },
        {
          id: "post2-visiteur",
          permalink_url: "https://fb.com/post2",
          comments: { data: [{ id: "c5", from: { name: "Eve", id: "u5" }, message: "Post visiteur : une question" }] },
        },
      ],
    });
  }

  // — Comptage batch ?ids=… : commentaires par post/média pub, noms de pages —
  if (url.includes("/?ids=")) {
    const m = url.match(/[?&]ids=([^&]+)/);
    const ids = decodeURIComponent(m?.[1] ?? "").split(",");
    const out: Record<string, unknown> = {};
    for (const id of ids) {
      if (url.includes("fields=name")) out[id] = { name: "Autre Page" };
      else if (url.includes("comments_count")) out[id] = { owner: { id: IG }, comments_count: 1 };
      else out[id] = { comments: { summary: { total_count: 1 }, data: [] } };
    }
    return json(out);
  }

  // — Marketing API : comptes pub accessibles, pubs → posts réels des créas —
  if (url.includes("me/adaccounts")) {
    if (url.includes("access_token=tok-noaccess")) return json({ data: [] });
    return json({ data: [{ account_id: "AD1" }, { account_id: "AD2" }] });
  }
  // — Pages gérées par l'utilisateur (même Business) : token de chaque page —
  if (url.includes("me/accounts")) {
    if (url.includes("access_token=tok-noaccess")) return json({ data: [] });
    return json({ data: [{ id: "PAGE2", name: "Page Partenaire", access_token: "tok-p2" }] });
  }
  // — Pages du Business Manager (jamais cochées dans l'écran de sélection) —
  if (url.includes("me/businesses")) {
    if (url.includes("access_token=tok-noaccess")) return json({ data: [] });
    return json({ data: [{ id: "BIZ1", name: "Mon Business" }] });
  }
  if (url.includes("BIZ1/owned_pages")) {
    return json({ data: [{ id: "PAGE4", name: "Page Funnel", access_token: "tok-p4" }] });
  }
  if (url.includes("BIZ1/client_pages")) {
    return json({ data: [] });
  }
  if (url.includes("PAGE4_story8/comments")) {
    if (!url.includes("access_token=tok-p4")) {
      return json({ error: { message: "(#10) requires Page Public Content Access" } });
    }
    return json({
      data: [
        { id: "c11", from: { name: "Zoé", id: "u11" }, message: "Commentaire du jour, pub via page du Business", created_time: "2026-07-13T13:15:00+0000" },
      ],
    });
  }
  // — Second compte pub : pub active publiée sous la page gérée PAGE2 —
  if (url.includes("act_AD2/ads")) {
    return json({
      data: [{ id: "ad5", effective_status: "ACTIVE", creative: { effective_object_story_id: "PAGE2_story7" } }],
    });
  }
  if (url.includes("PAGE2_story7/comments")) {
    if (!url.includes("access_token=tok-p2")) {
      return json({ error: { message: "(#10) requires Page Public Content Access" } });
    }
    return json({
      data: [
        { id: "c10", from: { name: "Mia", id: "u10" }, message: "Commentaire du jour, pub d'un autre compte pub", created_time: "2026-07-13T12:05:00+0000" },
      ],
    });
  }
  if (url.includes("act_AD1/ads")) {
    return json({
      data: [
        {
          id: "ad1",
          effective_status: "ACTIVE",
          creative: { effective_object_story_id: "PAGE1_story9", effective_instagram_media_id: "igm9" },
        },
        { id: "ad2", effective_status: "PAUSED", creative: {} },
        // Pub ACTIVE renvoyant vers une page NON gérée : jamais ingérée, mais
        // comptée et nommée pour le diagnostic.
        { id: "ad3", effective_status: "ACTIVE", creative: { effective_object_story_id: "PAGEX_story1" } },
        // Pub ACTIVE du compte de la société publiée sous une AUTRE page GÉRÉE
        // (même Business) : lue avec le token de cette page (tok-p2).
        { id: "ad4", effective_status: "ACTIVE", creative: { effective_object_story_id: "PAGE2_story5" } },
        // Pub ACTIVE publiée sous une page du BUSINESS jamais cochée dans
        // l'écran de sélection (absente de me/accounts) : token via
        // me/businesses → owned_pages.
        { id: "ad6", effective_status: "ACTIVE", creative: { effective_object_story_id: "PAGE4_story8" } },
      ],
    });
  }
  if (url.includes("PAGE2_story5/comments")) {
    // Ce post n'est lisible qu'avec le token de SA page.
    if (!url.includes("access_token=tok-p2")) {
      return json({ error: { message: "(#10) requires Page Public Content Access" } });
    }
    return json({
      data: [
        { id: "c8", from: { name: "Léo", id: "u8" }, message: "Commentaire sous la pub de la page partenaire", created_time: "2026-07-13T11:40:00+0000" },
      ],
    });
  }
  if (url.includes("PAGE1_story9/comments")) {
    return json({
      data: [
        { id: "c7", from: { name: "Ana", id: "u7" }, message: "Commentaire du jour sous la pub active", created_time: "2026-07-13T10:05:00+0000" },
      ],
    });
  }
  if (url.includes("igm9/comments")) {
    return json({
      data: [
        { id: "ic9", text: "Commentaire IG sous la pub", username: "nina", timestamp: "2026-07-13T10:20:00+0000" },
      ],
    });
  }

  // — Posts publicitaires (dark posts, absents du feed) —
  if (url.includes(`${PAGE}/ads_posts`)) {
    return json({
      data: [
        {
          id: "adpost1",
          permalink_url: "https://fb.com/adpost1",
          comments: {
            data: [
              { id: "c6", from: { name: "Gil", id: "u6" }, message: "Commentaire du jour sous la pub", created_time: "2026-07-13T09:15:00+0000" },
            ],
          },
        },
      ],
    });
  }

  // — Instagram DM (via la Page, platform=instagram) — AVANT le cas Messenger —
  if (url.includes(`${PAGE}/conversations`) && url.includes("platform=instagram")) {
    return json({
      data: [
        {
          id: "igconv1",
          messages: {
            data: [
              { id: "ig-dm1", message: "Bonjour, dispo en taille M ?", from: { username: "jane", id: "IGSID9" }, created_time: "2026-07-12T18:45:00+0000" },
              { id: "ig-dm2", message: "Oui bien sûr !", from: { username: "mabrand", id: IG } }, // écho → ignoré
            ],
          },
        },
      ],
    });
  }

  // — Messenger —
  if (url.includes(`${PAGE}/conversations`)) {
    return json({
      data: [
        {
          id: "conv1",
          messages: {
            data: [
              { id: "m1", message: "Bonjour, votre boutique ouvre à quelle heure ?", from: { name: "Bob", id: "PSID7" } },
              { id: "m2", message: "À 9h !", from: { name: "Ma Page", id: PAGE } }, // écho → ignoré
            ],
            paging: { next: "https://graph.facebook.com/v21.0/nested-msgs?after=y" },
          },
        },
      ],
    });
  }

  // — Avis de la Page —
  if (url.includes(`${PAGE}/ratings`)) {
    return json({
      data: [
        {
          review_text: "Service impeccable, je recommande.",
          created_time: "2026-07-01T10:00:00+0000",
          recommendation_type: "positive",
          reviewer: { id: "u9", name: "Fatima" },
          open_graph_story: { id: "STORY1" },
        },
        { created_time: "2026-07-02T10:00:00+0000", recommendation_type: "negative" }, // sans texte → ignoré
      ],
    });
  }

  // — Instagram : médias + commentaires + réponses en fil —
  if (url.includes(`${IG}/media`)) {
    return json({
      data: [
        {
          id: "media1",
          permalink: "https://instagram.com/p/xyz",
          comments: {
            data: [
              {
                id: "ic1",
                text: "Sublime !",
                username: "lea",
                timestamp: "2026-07-11T09:00:00+0000",
                replies: { data: [{ id: "ic2", text: "Je confirme", username: "marc" }] },
              },
            ],
          },
        },
      ],
    });
  }

  return json({ data: [] });
}

// Fetch mocké : aucun appel réseau réel.
(globalThis as { fetch: unknown }).fetch = async (url: string | URL, init?: RequestInit) =>
  route(String(url), init);

async function main() {
  // Connexions en mémoire (Supabase absent → fallback mock du repository).
  await upsertConnection("democo", "facebook", { page_id: PAGE, page_access_token: "tok", user_access_token: "tok" }, "connected");
  await upsertConnection("democo", "instagram", { ig_business_account_id: IG, page_access_token: "tok" }, "connected");
  await upsertConnection("democo", "meta_ads", { ad_account_id: "AD1", access_token: "tok" }, "connected");
  await upsertConnection("democo2", "facebook", { page_id: "PAGE_ERR", page_access_token: "tok" }, "connected");

  console.log("\n— 1) Synchronisation : parité Meta Business Suite —");
  const r = await syncMetaComments("democo");
  check("sync disponible", r.available);
  check(
    "commentaires importés = 12 (4 FB + 1 ads_posts + 5 créas pub FB/IG/partenaires/Business + 2 IG)",
    r.comments === 12,
    `comments=${r.comments}`
  );
  check("DM importés = 3 (2 Messenger paginés + 1 DM Instagram, sans échos)", r.dms === 3, `dms=${r.dms}`);
  check("avis importés = 1 (l'avis sans texte est ignoré)", r.reviews === 1, `reviews=${r.reviews}`);
  check("imported = commentaires + DM + avis", r.imported === r.comments + r.dms + r.reviews, `imported=${r.imported}`);
  check("aucune note d'erreur quand tout est lisible", !r.note, r.note ?? "");

  const msgs = await listMessages("democo", { limit: 500 });
  const igDm = msgs.find((m) => m.channel === "instagram" && m.kind === "dm");
  check("DM Instagram présent", Boolean(igDm));
  check("DM Instagram : authorHandle = IGSID (répondable)", igDm?.authorHandle === "IGSID9", `handle=${igDm?.authorHandle}`);
  check("DM Instagram : le username reste visible dans authorName", igDm?.authorName === "@jane", `name=${igDm?.authorName}`);
  const review = msgs.find((m) => m.kind === "review");
  check("avis : externalId = open_graph_story (répondable)", review?.externalId === "STORY1", `ext=${review?.externalId}`);
  const fbThread = msgs.find((m) => m.externalId === "c3");
  check("réponse en fil FB importée (filter=stream)", Boolean(fbThread));
  const fbNested = msgs.find((m) => m.externalId === "c4");
  check("pagination imbriquée des commentaires suivie", Boolean(fbNested));
  const adComment = msgs.find((m) => m.externalId === "c6");
  check("commentaire sous PUBLICITÉ importé (ads_posts)", adComment?.receivedAt === "2026-07-13T09:15:00.000Z", adComment?.receivedAt);
  const adCreativeFb = msgs.find((m) => m.externalId === "c7");
  check(
    "commentaire FB sur pub ACTIVE importé (Marketing API, dark post)",
    adCreativeFb?.receivedAt === "2026-07-13T10:05:00.000Z" && adCreativeFb?.permalink === "https://www.facebook.com/PAGE1_story9",
    `at=${adCreativeFb?.receivedAt} lien=${adCreativeFb?.permalink}`
  );
  const adCreativeIg = msgs.find((m) => m.externalId === "ic9");
  check(
    "commentaire IG sur pub ACTIVE importé (média pub, hors /media)",
    adCreativeIg?.channel === "instagram" && adCreativeIg?.receivedAt === "2026-07-13T10:20:00.000Z",
    `at=${adCreativeIg?.receivedAt}`
  );
  const partnerComment = msgs.find((m) => m.externalId === "c8");
  check(
    "pub publiée sous une autre page GÉRÉE → lue avec le token de cette page",
    partnerComment?.receivedAt === "2026-07-13T11:40:00.000Z",
    `at=${partnerComment?.receivedAt}`
  );
  check(
    "… et la page propriétaire est mémorisée pour la réponse",
    (partnerComment?.raw as { _sh_owner_page?: string } | undefined)?._sh_owner_page === "PAGE2",
    String((partnerComment?.raw as { _sh_owner_page?: string } | undefined)?._sh_owner_page)
  );
  const otherAcctComment = msgs.find((m) => m.externalId === "c10");
  check(
    "pub d'un AUTRE compte pub, page gérée → importée aussi",
    otherAcctComment?.receivedAt === "2026-07-13T12:05:00.000Z",
    `at=${otherAcctComment?.receivedAt}`
  );
  const bizPageComment = msgs.find((m) => m.externalId === "c11");
  check(
    "pub sous une page du BUSINESS (hors écran de sélection) → token via me/businesses",
    bizPageComment?.receivedAt === "2026-07-13T13:15:00.000Z" &&
      (bizPageComment?.raw as { _sh_owner_page?: string } | undefined)?._sh_owner_page === "PAGE4",
    `at=${bizPageComment?.receivedAt}`
  );
  const dmNested = msgs.find((m) => m.externalId === "m3");
  check("pagination imbriquée des conversations suivie", Boolean(dmNested));
  const ownEcho = msgs.find((m) => m.externalId === "c2" || m.externalId === "m2" || m.externalId === "ig-dm2");
  check("nos propres messages/commentaires ne sont pas réimportés", !ownEcho, ownEcho?.externalId);

  console.log("\n— 1b) Date/heure réelle des messages (pas la date d'import) —");
  const c1 = msgs.find((m) => m.externalId === "c1");
  check("commentaire FB : receivedAt = created_time Meta", c1?.receivedAt === "2026-07-10T08:30:00.000Z", c1?.receivedAt);
  const ic1 = msgs.find((m) => m.externalId === "ic1");
  check("commentaire IG : receivedAt = timestamp Meta", ic1?.receivedAt === "2026-07-11T09:00:00.000Z", ic1?.receivedAt);
  check("DM IG : receivedAt = created_time Meta", igDm?.receivedAt === "2026-07-12T18:45:00.000Z", igDm?.receivedAt);
  check("horodatage webhook en secondes Unix converti", graphTimeToIso(1783777800) === "2026-07-11T13:50:00.000Z", graphTimeToIso(1783777800));
  check("horodatage webhook en millisecondes converti", graphTimeToIso(1783777800000) === "2026-07-11T13:50:00.000Z", graphTimeToIso(1783777800000));
  check("horodatage invalide → undefined (fallback maintenant)", graphTimeToIso("n/a") === undefined);
  check(
    "commentaires FB demandés du plus récent au plus ancien",
    fetched.some((u) => u.includes("order(reverse_chronological)")),
    "order(reverse_chronological) absent des appels /feed"
  );

  // Rétro-correction : une ligne importée AVANT le correctif (date d'import)
  // récupère la vraie date de la plateforme lors de la re-synchronisation.
  await ingestMessage("democo3", { channel: "facebook", externalId: "old1", kind: "comment", text: "ancien import" });
  const before = (await listMessages("democo3")).find((m) => m.externalId === "old1");
  const beforeAt = before?.receivedAt; // copie : le store mémoire mute l'objet partagé
  const dup = await ingestMessage("democo3", {
    channel: "facebook",
    externalId: "old1",
    kind: "comment",
    text: "ancien import",
    receivedAt: "2026-07-01T10:00:00.000Z",
  });
  const after = (await listMessages("democo3")).find((m) => m.externalId === "old1");
  check("re-sync d'un doublon → toujours pas de réimport", dup === null);
  check(
    "re-sync d'un doublon → received_at corrigé avec la vraie date",
    after?.receivedAt === "2026-07-01T10:00:00.000Z" && beforeAt !== after?.receivedAt,
    `avant=${beforeAt} après=${after?.receivedAt}`
  );

  console.log("\n— 2) Erreurs Graph remontées (permission manquante) —");
  const r2 = await syncMetaComments("democo2");
  check("sync disponible malgré l'erreur", r2.available);
  check("note présente et explicite", Boolean(r2.note?.includes("pages_read_user_content")), r2.note ?? "(vide)");

  // Token ANCIEN (accordé avant l'ajout des scopes) : Meta masque les contenus
  // SANS erreur → le diagnostic doit nommer les permissions manquantes.
  await upsertConnection(
    "democo4",
    "facebook",
    { page_id: PAGE, page_access_token: "tok", user_access_token: "tok-old" },
    "connected"
  );
  const r4 = await syncMetaComments("democo4");
  check(
    "token ancien → note liste les permissions manquantes",
    Boolean(r4.note?.includes("pages_read_user_content") && r4.note?.includes("instagram_manage_messages")),
    r4.note ?? "(vide)"
  );
  check("token complet → aucune alerte de permission", !r.note, r.note ?? "");

  // Société dont la page connectée n'a AUCUN commentaire pub, alors que les
  // pubs accessibles renvoient vers d'autres Pages → la note doit le nommer.
  await upsertConnection(
    "democo5",
    "facebook",
    { page_id: "PAGEZ", page_access_token: "tok", user_access_token: "tok" },
    "connected"
  );
  await upsertConnection("democo5", "instagram", { ig_business_account_id: "IGZ", page_access_token: "tok" }, "connected");
  const r5 = await syncMetaComments("democo5");
  check(
    "société sans pubs propres : les pubs des pages GÉRÉES restent importées",
    r5.comments === 3,
    `comments=${r5.comments}`
  );

  // Utilisateur SANS accès aux pages des pubs (ni gérées ni connectées) :
  // la note doit nommer les pages hors de portée.
  await upsertConnection(
    "democo6",
    "facebook",
    { page_id: "PAGEZ", page_access_token: "tok", user_access_token: "tok-noaccess" },
    "connected"
  );
  await upsertConnection("democo6", "meta_ads", { ad_account_id: "AD1", access_token: "tok-noaccess" }, "connected");
  const r6 = await syncMetaComments("democo6");
  check(
    "pubs vers des Pages non accessibles → note nomme les pages et le volume",
    Boolean(r6.note?.includes("Pages non accessibles") && r6.note?.includes("PAGEX")),
    r6.note ?? "(vide)"
  );
  check("… sans ingérer les commentaires de ces Pages", r6.comments === 0, `comments=${r6.comments}`);

  console.log("\n— 3) Envoi des réponses : bons endpoints Graph —");
  posted.length = 0;
  const d1 = await deliverMetaReply("democo", { channel: "facebook", kind: "comment", externalId: "c1" }, "Merci !");
  check("commentaire FB → POST /{comment-id}/comments", d1.delivered && posted[0]?.url.includes("/c1/comments"), posted[0]?.url);

  const d2 = await deliverMetaReply("democo", { channel: "instagram", kind: "comment", externalId: "ic1" }, "Merci !");
  check("commentaire IG → POST /{comment-id}/replies", d2.delivered && posted[1]?.url.includes("/ic1/replies"), posted[1]?.url);

  const d3 = await deliverMetaReply("democo", { channel: "facebook", kind: "dm", authorHandle: "PSID7" }, "Bonjour !");
  check("DM Messenger → POST /{page-id}/messages", d3.delivered && posted[2]?.url.includes(`/${PAGE}/messages`), posted[2]?.url);
  check("DM Messenger : destinataire = PSID", posted[2]?.body.includes(encodeURIComponent('{"id":"PSID7"}')), posted[2]?.body);

  const d4 = await deliverMetaReply("democo", { channel: "instagram", kind: "dm", authorHandle: "IGSID9" }, "Bonjour !");
  check("DM Instagram → POST /{page-id}/messages (nœud de la Page)", d4.delivered && posted[3]?.url.includes(`/${PAGE}/messages`), posted[3]?.url);
  check("DM Instagram : destinataire = IGSID", posted[3]?.body.includes(encodeURIComponent('{"id":"IGSID9"}')), posted[3]?.body);

  const d5 = await deliverMetaReply("democo", { channel: "facebook", kind: "review", externalId: "STORY1" }, "Merci pour votre avis !");
  check("avis FB → POST /{story-id}/comments", d5.delivered && posted[4]?.url.includes("/STORY1/comments"), posted[4]?.url);

  const d6 = await deliverMetaReply("democo", { channel: "linkedin", kind: "comment", externalId: "x" }, "…");
  check("canal non-Meta → refus propre (pas d'appel réseau)", !d6.delivered && posted.length === 5, d6.error);

  const d7 = await deliverMetaReply(
    "democo",
    { channel: "facebook", kind: "comment", externalId: "c10", ownerPageId: "PAGE2" },
    "Merci !"
  );
  check(
    "commentaire d'une pub d'une AUTRE page gérée → réponse avec le token de cette page",
    d7.delivered && posted[5]?.url.includes("/c10/comments") && posted[5]?.body.includes("access_token=tok-p2"),
    `${posted[5]?.url} · ${posted[5]?.body}`
  );

  console.log("\n— 4) Bascule public → privé (Private Replies) —");
  const p1 = await deliverMetaReply("democo", { channel: "facebook", kind: "comment", externalId: "c1", visibility: "private" }, "On vous écrit en privé.");
  check("commentaire FB en privé → POST /{page-id}/messages", p1.delivered && posted[6]?.url.includes(`/${PAGE}/messages`), posted[6]?.url);
  check("commentaire FB en privé : recipient = comment_id", posted[6]?.body.includes(encodeURIComponent('{"comment_id":"c1"}')), posted[6]?.body);

  const p2 = await deliverMetaReply("democo", { channel: "instagram", kind: "comment", externalId: "ic1", visibility: "private" }, "On vous écrit en privé.");
  check("commentaire IG en privé → POST /{page-id}/messages", p2.delivered && posted[7]?.url.includes(`/${PAGE}/messages`), posted[7]?.url);
  check("commentaire IG en privé : recipient = comment_id", posted[7]?.body.includes(encodeURIComponent('{"comment_id":"ic1"}')), posted[7]?.body);

  const p3 = await deliverMetaReply("democo", { channel: "facebook", kind: "dm", authorHandle: "PSID7", visibility: "private" }, "Déjà privé.");
  check("un DM reste un DM (visibility sans effet)", p3.delivered && posted[8]?.body.includes(encodeURIComponent('{"id":"PSID7"}')), posted[8]?.body);

  console.log(failed === 0 ? "\n✅ Tous les tests passent." : `\n❌ ${failed} test(s) en échec.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
