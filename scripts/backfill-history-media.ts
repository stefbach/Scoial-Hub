// Reprise — restitue l'URL du média aux publications déjà en historique.
//
// POURQUOI
// L'historique enregistrait le TYPE du média (« image » / « vidéo ») mais pas
// son URL. L'écran affichait donc un cadre portant le mot « Image », jamais le
// visuel. La correction du 24/08 conserve l'URL à la publication — mais elle ne
// vaut que pour les publications à venir : les 5 000 déjà en base restent
// muettes, et l'utilisateur continue de voir un cadre vide.
//
// D'OÙ VIENT L'URL RETROUVÉE
// De la publication PROGRAMMÉE qui a produit l'entrée d'historique : même
// société, même réseau, même horodatage de programmation. C'est la source de
// vérité qui a servi à publier — pas une reconstruction.
//
// PRUDENCE
// Un même créneau peut porter plusieurs médias distincts (reprogrammations,
// variantes) : impossible alors de savoir lequel est parti. Ces cas sont
// COMPTÉS et LAISSÉS EN L'ÉTAT plutôt que réparés au hasard — un mauvais visuel
// attribué à une publication est pire qu'un cadre vide.
//
// USAGE
//   npm run backfill:historique            → rapport seul, aucune écriture
//   npm run backfill:historique -- --apply → applique la reprise

import { createAdminClient } from "../lib/supabase/server";

const APPLY = process.argv.includes("--apply");

/** Créneau de programmation d'une publication : société + réseau + horodatage. */
function slotKey(companyId: string, platform: string, isoLike: string): string {
  return `${companyId}|${platform}|${new Date(isoLike).toISOString()}`;
}

async function main() {
  const sb = createAdminClient();
  if (!sb) {
    console.error("✗ Supabase non configuré (SUPABASE_SERVICE_ROLE_KEY requis).");
    process.exit(1);
  }

  // 1) Médias connus, indexés par créneau de programmation.
  const { data: scheduled, error: schedErr } = await sb
    .from("sh_scheduled_posts")
    .select("company_id, platform, date, time, media");
  if (schedErr) {
    console.error("✗ Lecture des programmées impossible :", schedErr.message);
    process.exit(1);
  }

  const bySlot = new Map<string, Set<string>>();
  const kindBySlot = new Map<string, string>();
  for (const s of scheduled ?? []) {
    const media = s.media as { kind?: string; url?: string } | null;
    if (!media?.url || !s.date || !s.time) continue;
    const key = slotKey(String(s.company_id), String(s.platform), `${s.date}T${s.time}:00`);
    if (!bySlot.has(key)) bySlot.set(key, new Set());
    bySlot.get(key)!.add(media.url);
    if (media.kind) kindBySlot.set(key, media.kind);
  }

  // 2) Entrées d'historique privées d'URL.
  const { data: history, error: histErr } = await sb
    .from("sh_history_items")
    .select("id, company_id, platform, scheduled_at, media")
    .is("media->>url", null);
  if (histErr) {
    console.error("✗ Lecture de l'historique impossible :", histErr.message);
    process.exit(1);
  }

  let repairable = 0;
  let ambiguous = 0;
  let orphan = 0;
  const updates: { id: string; media: Record<string, string> }[] = [];

  for (const h of history ?? []) {
    if (!h.scheduled_at) { orphan += 1; continue; }
    const key = slotKey(String(h.company_id), String(h.platform), String(h.scheduled_at));
    const urls = bySlot.get(key);
    if (!urls || urls.size === 0) { orphan += 1; continue; }
    if (urls.size > 1) { ambiguous += 1; continue; }

    const media = (h.media as { kind?: string } | null) ?? {};
    updates.push({
      id: String(h.id),
      media: {
        kind: media.kind ?? kindBySlot.get(key) ?? "image",
        url: [...urls][0],
        // Trace : cette URL a été retrouvée, elle n'a pas été enregistrée au
        // moment de la publication.
        url_recovered_from: "scheduled_post",
      },
    });
    repairable += 1;
  }

  console.log(`\n── Historique sans visuel (${(history ?? []).length}) ──`);
  console.log(`  réparables sans ambiguïté : ${repairable}`);
  console.log(`  créneaux ambigus (plusieurs médias) : ${ambiguous}  → laissés en l'état`);
  console.log(`  sans programmation correspondante  : ${orphan}      → laissés en l'état`);

  if (!APPLY || updates.length === 0) {
    console.log(`\n${updates.length === 0 ? "✓ Rien à reprendre." : "Rapport seul — relancer avec --apply pour écrire."}\n`);
    return;
  }

  console.log("\n── Application ──");
  let done = 0;
  for (const u of updates) {
    const { error } = await sb.from("sh_history_items").update({ media: u.media }).eq("id", u.id);
    if (error) console.log(`  ✗ ${u.id} : ${error.message}`);
    else done += 1;
  }
  console.log(`  ✓ ${done} publication(s) ont retrouvé leur visuel.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
