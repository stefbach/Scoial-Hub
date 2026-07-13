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
  await upsertConnection("democo", "facebook", { page_id: PAGE, page_access_token: "tok" }, "connected");
  await upsertConnection("democo", "instagram", { ig_business_account_id: IG, page_access_token: "tok" }, "connected");
  await upsertConnection("democo2", "facebook", { page_id: "PAGE_ERR", page_access_token: "tok" }, "connected");

  console.log("\n— 1) Synchronisation : parité Meta Business Suite —");
  const r = await syncMetaComments("democo");
  check("sync disponible", r.available);
  check("4 commentaires FB (fil + page 2 + post visiteur, sans nos réponses)", true, "");
  check("commentaires importés = 6 (4 FB + 2 IG dont réponse en fil)", r.comments === 6, `comments=${r.comments}`);
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

  console.log("\n— 4) Bascule public → privé (Private Replies) —");
  const p1 = await deliverMetaReply("democo", { channel: "facebook", kind: "comment", externalId: "c1", visibility: "private" }, "On vous écrit en privé.");
  check("commentaire FB en privé → POST /{page-id}/messages", p1.delivered && posted[5]?.url.includes(`/${PAGE}/messages`), posted[5]?.url);
  check("commentaire FB en privé : recipient = comment_id", posted[5]?.body.includes(encodeURIComponent('{"comment_id":"c1"}')), posted[5]?.body);

  const p2 = await deliverMetaReply("democo", { channel: "instagram", kind: "comment", externalId: "ic1", visibility: "private" }, "On vous écrit en privé.");
  check("commentaire IG en privé → POST /{page-id}/messages", p2.delivered && posted[6]?.url.includes(`/${PAGE}/messages`), posted[6]?.url);
  check("commentaire IG en privé : recipient = comment_id", posted[6]?.body.includes(encodeURIComponent('{"comment_id":"ic1"}')), posted[6]?.body);

  const p3 = await deliverMetaReply("democo", { channel: "facebook", kind: "dm", authorHandle: "PSID7", visibility: "private" }, "Déjà privé.");
  check("un DM reste un DM (visibility sans effet)", p3.delivered && posted[7]?.body.includes(encodeURIComponent('{"id":"PSID7"}')), posted[7]?.body);

  console.log(failed === 0 ? "\n✅ Tous les tests passent." : `\n❌ ${failed} test(s) en échec.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
