// Contrat entre le banc de montage et le serveur, et correspondance entre
// l'aperçu et le fichier exporté.
//
// POURQUOI CE BANC EXISTE
// Trois défauts critiques ont franchi la refonte alors que le modèle de montage
// était, lui, correctement testé :
//
//   • le banc envoyait au rendu serveur un format que PERSONNE n'attendait —
//     tout montage à plusieurs plans échouait en 400 ;
//   • les calques étaient gravés d'après la tête de lecture, donc un texte de
//     fin disparaissait silencieusement du fichier produit ;
//   • les incrustations d'image n'étaient jamais dessinées à l'export.
//
// Le point commun : aucun test ne franchissait la frontière entre deux couches.
// Un test de modèle ne peut pas voir cela ; celui-ci appelle la vraie route et
// compare ce que l'aperçu montre à ce que l'export grave.
//
// Usage : npm run test:montagecontrat

// La garde d'accès retombe en mode démo — on teste le CONTRAT, pas l'auth.
process.env.AUTH_DISABLED = "true";

import { NextRequest } from "next/server";
import { POST } from "../app/api/video/render/route";
import {
  addClip,
  addImageLayer,
  addText,
  emptyProject,
  imagesAt,
  setClipTransition,
  textsAt,
  updateImageLayer,
  updateText,
  type EditorProject,
} from "../lib/editor/project";
import { browserOverlays, toServerEdit } from "../lib/editor/render-plan";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function post(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = new NextRequest("http://localhost/api/video/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

/** Montage à quatre plans : le cas que l'aiguillage envoie au serveur. */
function multiClip(): EditorProject {
  let p = emptyProject("c1", "p1");
  for (const id of ["a", "b", "c", "d"]) {
    p = addClip(p, { id, src: `${id}.mp4`, kind: "video", sourceDuration: 6 });
  }
  return p;
}

async function main() {
  // ── C-01 · Le serveur accepte ce que le banc envoie ──────────────────────
  {
    const r = await post({ companyId: "c1", project: multiClip() });
    // Sans clé Shotstack en local, le moteur refuse — mais on doit être ARRIVÉ
    // jusqu'à lui. Le rejet de contrat, lui, se produisait avant.
    const err = String(r.json.error ?? "");
    check("un document de projet n'est plus rejeté par le contrat",
      !/cut et assets requis/.test(err), `${r.status} ${err}`);
    check("la requête atteint le moteur de rendu",
      /moteur de rendu|Shotstack/i.test(err) || r.status === 200, `${r.status} ${err}`);
  }

  {
    const r = await post({ companyId: "c1", project: emptyProject("c1", "p1") });
    check("un montage vide est refusé avec un motif clair",
      r.status === 400 && /aucun plan/i.test(String(r.json.error ?? "")), String(r.json.error));
  }

  {
    const r = await post({ companyId: "c1" });
    check("une requête sans contenu nomme les DEUX contrats acceptés",
      r.status === 400 && /cut et assets requis, ou project/.test(String(r.json.error ?? "")),
      String(r.json.error));
  }

  {
    // L'appelant historique (Studio Créatif) ne doit pas avoir été cassé.
    const cut = {
      platform: "tiktok", label: "TikTok", aspect: "9:16", assemblyType: "video",
      targetDurationSec: 15, hook: "", hookVariants: [], slides: [], overlays: [],
      musicMood: "", pacing: "", editNotes: [], caption: "", hashtags: [], cta: "",
      thumbnailText: "", renderStatus: "ready",
    };
    const r = await post({ companyId: "c1", cut, assets: [{ url: "a.mp4", kind: "video" }] });
    const err = String(r.json.error ?? "");
    check("l'ancien contrat du Studio Créatif fonctionne toujours",
      !/cut et assets requis/.test(err), `${r.status} ${err}`);
  }

  // ── La projection serveur décrit bien le montage complet ─────────────────
  {
    const edit = toServerEdit(multiClip()) as {
      timeline: { tracks: { clips: { start: number; length: number; transition?: unknown }[] }[] };
    };
    const videoTrack = edit.timeline.tracks[edit.timeline.tracks.length - 1].clips;
    check("les quatre plans sont transmis", videoTrack.length === 4, String(videoTrack.length));
    check("les plans se suivent sans trou",
      videoTrack.every((c, i) => i === 0 || Math.abs(c.start - (videoTrack[i - 1].start + videoTrack[i - 1].length)) < 0.011));
    check("les transitions accompagnent les plans suivants",
      videoTrack.slice(1).every((c) => c.transition !== undefined));
  }

  // ── P0-1a · Un « dissolve » (vocabulaire du projet) n'est jamais transmis
  // tel quel au moteur — celui-ci ne connaît que "fade" et rejetait TOUT
  // export contenant cette valeur avec « Bad Request » (audit Editing Bench).
  {
    const p = setClipTransition(multiClip(), "b", "dissolve");
    const edit = toServerEdit(p) as {
      timeline: { tracks: { clips: { transition?: { in?: string } }[] }[] } };
    const videoTrack = edit.timeline.tracks[edit.timeline.tracks.length - 1].clips;
    check("un « dissolve » de plan est transmis comme « fade » au moteur",
      videoTrack[1].transition?.in === "fade", JSON.stringify(videoTrack[1].transition));
    check("aucune transition transmise ne vaut « dissolve »",
      videoTrack.every((c) => c.transition?.in !== "dissolve"));
  }

  // ── C-02 / C-03 · L'aperçu et l'export montrent la même chose ────────────
  {
    // Un titre au début, un rappel à la fin, un logo au milieu : exactement le
    // scénario où l'ancienne composition perdait deux éléments sur trois.
    let p = addClip(emptyProject("c", "p"), { id: "a", src: "a.mp4", kind: "video", sourceDuration: 20 });
    p = addText(p, "t1", "Titre");
    p = updateText(p, "t1", { start: 0, end: 4 });
    p = addText(p, "t2", "Rappel");
    p = updateText(p, "t2", { start: 15, end: 20 });
    p = addImageLayer(p, "i1", "logo.png");
    p = updateImageLayer(p, "i1", { start: 5, end: 12 });

    const spans = browserOverlays(p);

    // Pour chaque instant échantillonné, ce que l'aperçu affiche doit être
    // exactement ce que l'intervalle qui le couvre grave dans le fichier.
    let divergences = 0;
    let couverts = 0;
    for (let time = 0.25; time < 20; time += 0.25) {
      const visible = [...textsAt(p, time).map((l) => l.id), ...imagesAt(p, time).map((l) => l.id)].sort();
      const span = spans.find((s) => time >= s.start && time <= s.end);
      if (!span) {
        // Aucun intervalle : l'aperçu ne doit rien montrer non plus.
        if (visible.length > 0) divergences += 1;
        continue;
      }
      couverts += 1;
      const mid = (span.start + span.end) / 2;
      const grave = [...textsAt(p, mid).map((l) => l.id), ...imagesAt(p, mid).map((l) => l.id)].sort();
      if (visible.join(",") !== grave.join(",")) divergences += 1;
    }
    check("aperçu et export montrent les mêmes calques à chaque instant",
      divergences === 0, `${divergences} divergence(s)`);
    check("les instants portant un calque sont bien couverts", couverts > 0, String(couverts));

    // Le défaut d'origine, formulé tel quel : la tête de lecture est au début,
    // et pourtant le rappel de fin doit exister dans le fichier.
    const graves = new Set(spans.flatMap((s) => {
      const mid = (s.start + s.end) / 2;
      return [...textsAt(p, mid).map((l) => l.id), ...imagesAt(p, mid).map((l) => l.id)];
    }));
    check("aucun calque n'est perdu à l'export", graves.has("t1") && graves.has("t2") && graves.has("i1"),
      [...graves].join(","));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
