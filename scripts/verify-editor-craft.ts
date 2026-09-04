// Ce qui manquait au banc pour être un vrai banc (analyse du 5 septembre).
//
// Repères, écoute isolée, ducking automatique, export SRT : quatre outils
// qu'aucun monteur ne cherche dans un menu parce qu'il s'attend à les trouver.
// Ils sont ici parce qu'ils touchent au MODÈLE, donc au document enregistré —
// et qu'une régression y serait invisible à l'écran jusqu'à l'export.
//
// Usage : npm run test:montageartisan

import {
  addAudio, addClip, addMarker, addText, duckMusicUnderVoice, emptyProject,
  nextMarker, removeMarker, setClipAdjust, setTrackHeight, toggleTrackSolo, toSrt,
  updateAudio, updateMarker, updateText, valueAt, visibleProject, hasImageAdjust,
  cssImageFilter, type EditorProject,
} from "../lib/editor/project";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

function sample(): EditorProject {
  return addClip(emptyProject("c", "p"), { id: "plan", src: "a.mp4", kind: "video", sourceDuration: 20 });
}

function main() {
  // ── Repères ─────────────────────────────────────────────────────────────
  {
    let p = addMarker(sample(), "m1", 4);
    p = addMarker(p, "m2", 2, "Phrase clé");
    check("les repères sont rangés par instant", (p.markers ?? []).map((m) => m.time).join(",") === "2,4");
    check("un repère porte son intitulé", p.markers?.[0].label === "Phrase clé");
    // Deux repères au même instant n'ont aucun sens : le second remplace.
    p = addMarker(p, "m3", 4.01);
    check("un repère posé au même endroit remplace le précédent", (p.markers ?? []).length === 2,
      String((p.markers ?? []).length));

    check("on navigue de repère en repère", nextMarker(p, 0, 1)?.time === 2 && nextMarker(p, 3, 1)?.time === 4.01);
    check("et en arrière", nextMarker(p, 3, -1)?.time === 2);
    check("il n'y a rien après le dernier", nextMarker(p, 99, 1) === null);

    p = updateMarker(p, "m2", { label: "Titre" });
    check("un repère se renomme", p.markers?.find((m) => m.id === "m2")?.label === "Titre");

    p = removeMarker(p, "m2");
    p = removeMarker(p, "m3");
    check("retirer le dernier repère efface le champ, plutôt que d'y laisser un tableau vide",
      p.markers === undefined);
    // Les repères ne sont PAS des éléments : rien du rendu ne les voit.
    check("un repère ne touche à rien du montage", removeMarker(addMarker(sample(), "m", 1), "m").clips.length === 1);
  }

  // ── Écoute isolée ───────────────────────────────────────────────────────
  {
    let p = sample();
    p = { ...p, clips: p.clips.map((c) => ({ ...c, muted: false })) };
    p = addAudio(p, { id: "voix", src: "v.mp3", name: "Voix", role: "voice" });
    p = addAudio(p, { id: "mus", src: "m.mp3", name: "Musique", role: "music" });
    const voiceTrack = p.audios.find((a) => a.id === "voix")!.trackId;

    const solo = toggleTrackSolo(p, voiceTrack);
    check("la piste isolée est marquée", (solo.tracks ?? []).find((tr) => tr.id === voiceTrack)?.solo === true);

    const heard = visibleProject(solo);
    check("elle est la seule à sonner", heard.audios.length === 1 && heard.audios[0].id === "voix",
      heard.audios.map((a) => a.id).join(","));
    // Sans cette règle, « isoler la voix » laisserait passer l'ambiance du plan.
    check("le son embarqué des plans se tait aussi", heard.clips.every((c) => c.muted));
    check("le document, lui, n'est pas modifié", p.audios.length === 2 && !p.clips[0].muted);

    const back = toggleTrackSolo(solo, voiceTrack);
    check("relâcher l'isolement rétablit tout", visibleProject(back).audios.length === 2);

    // Deux pistes « isolées » ne sont plus une isolation.
    const musicTrack = p.audios.find((a) => a.id === "mus")!.trackId;
    const second = toggleTrackSolo(solo, musicTrack);
    check("isoler une autre piste relâche la première",
      (second.tracks ?? []).filter((tr) => tr.solo).length === 1);
  }

  // ── Hauteur de piste ────────────────────────────────────────────────────
  {
    const p = sample();
    const trackId = p.clips[0].trackId;
    check("la hauteur se règle", setTrackHeight(p, trackId, 3).tracks?.find((tr) => tr.id === trackId)?.height === 3);
    check("elle est bornée vers le haut", setTrackHeight(p, trackId, 99).tracks?.find((tr) => tr.id === trackId)?.height === 4);
    check("et vers le bas", setTrackHeight(p, trackId, -5).tracks?.find((tr) => tr.id === trackId)?.height === 1);
    // C'est un réglage d'AFFICHAGE : le rendu n'en sait rien.
    check("elle ne touche à aucun élément",
      JSON.stringify(setTrackHeight(p, trackId, 3).clips) === JSON.stringify(p.clips));
  }

  // ── Ducking ─────────────────────────────────────────────────────────────
  {
    let p = sample();
    p = addAudio(p, { id: "mus", src: "m.mp3", name: "Musique", role: "music" });
    p = addAudio(p, { id: "voix", src: "v.mp3", name: "Voix", role: "voice" });
    p = updateAudio(p, "voix", { start: 5, length: 4 });
    const before = p.audios.find((a) => a.id === "mus")!.volume;

    const ducked = duckMusicUnderVoice(p, (b) => `${b}-x`);
    const music = ducked.audios.find((a) => a.id === "mus")!;
    check("la musique reçoit des images-clés de volume", (music.keyframes?.volume?.length ?? 0) >= 4,
      String(music.keyframes?.volume?.length));
    check("elle est au niveau haut avant la voix", near(valueAt(music, "volume", 2), before),
      String(valueAt(music, "volume", 2)));
    check("elle descend PENDANT la voix", valueAt(music, "volume", 7) < before * 0.5,
      String(valueAt(music, "volume", 7)));
    check("et remonte après", near(valueAt(music, "volume", 12), before), String(valueAt(music, "volume", 12)));
    check("la voix, elle, n'est pas touchée",
      ducked.audios.find((a) => a.id === "voix")?.keyframes === undefined);

    // Deux phrases rapprochées ne doivent pas faire « pomper » la musique.
    let two = p;
    two = addAudio(two, { id: "voix2", src: "v2.mp3", name: "Voix 2", role: "voice" });
    two = updateAudio(two, "voix2", { start: 9.2, length: 3 });
    const tight = duckMusicUnderVoice(two, (b) => `${b}-y`).audios.find((a) => a.id === "mus")!;
    check("la musique ne remonte pas entre deux phrases rapprochées",
      valueAt(tight, "volume", 9.1) < before * 0.6, String(valueAt(tight, "volume", 9.1)));

    // Relancer l'opération ne doit pas empiler deux passages.
    const twice = duckMusicUnderVoice(duckMusicUnderVoice(p, (b) => b), (b) => b);
    const again = twice.audios.find((a) => a.id === "mus")!;
    check("relancer le ducking remplace, il n'empile pas",
      (again.keyframes?.volume?.length ?? 0) === (music.keyframes?.volume?.length ?? 0));

    // Sans voix, ou sans musique, il n'y a rien à faire.
    check("sans voix off, le montage est renvoyé tel quel",
      duckMusicUnderVoice(addAudio(sample(), { id: "m", src: "m.mp3", name: "M", role: "music" }), (b) => b).audios[0].keyframes === undefined);
  }

  // ── Sous-titres SRT ─────────────────────────────────────────────────────
  {
    let p = sample();
    p = addText(p, "t1", "Bonjour", 0);
    p = updateText(p, "t1", { start: 1.5, end: 3.25 });
    p = addText(p, "t2", "Au revoir", 0);
    p = updateText(p, "t2", { start: 5, end: 7 });
    // Un calque décoratif vide n'a rien à faire dans un fichier de sous-titres.
    p = addText(p, "vide", "   ", 0);

    const srt = toSrt(p);
    check("chaque texte devient une entrée numérotée", srt.startsWith("1\n") && srt.includes("\n2\n"), srt.slice(0, 60));
    check("l'horodatage suit le format exigé, à la milliseconde",
      srt.includes("00:00:01,500 --> 00:00:03,250"), srt.split("\n")[1]);
    check("les textes sont dans l'ordre du film", srt.indexOf("Bonjour") < srt.indexOf("Au revoir"));
    check("un texte vide est ignoré", !srt.includes("   \n") && (srt.match(/-->/g) ?? []).length === 2);
    check("un montage sans texte produit un fichier vide", toSrt(sample()) === "");
  }

  // ── Correction d'image ──────────────────────────────────────────────────
  {
    const p = setClipAdjust(sample(), "plan", { brightness: 0.2, saturation: -0.4 });
    const clip = p.clips[0];
    check("les réglages sont retenus", clip.brightness === 0.2 && clip.saturation === -0.4);
    check("ils sont bornés", setClipAdjust(p, "plan", { brightness: 9 }).clips[0].brightness === 0.5);
    check("un plan neuf n'en porte aucun", !hasImageAdjust(sample().clips[0]));
    check("et son filtre CSS est vide — aucun coût pour qui n'y touche pas",
      cssImageFilter(sample().clips[0]) === "");
    // Les mêmes nombres alimentent le filtre du rendu : c'est ce qui garantit
    // que l'image vue est l'image produite.
    check("le filtre d'aperçu reprend exactement les valeurs",
      cssImageFilter(clip) === "brightness(1.200) contrast(1.000) saturate(0.600)", cssImageFilter(clip));
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
