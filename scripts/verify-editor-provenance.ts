// Traçabilité des médias acquis — mission bibliothèque, Lot A-3.
//
// L'insertion depuis la bibliothèque externe écrit la provenance (fournisseur,
// licence, auteur) DANS LE DOCUMENT au moment de l'insertion — jamais après,
// cette information n'étant pas récupérable plus tard (règle 4). Ces contrôles
// portent sur le CONTRAT : la provenance traverse addClip/addImageLayer/
// addAudio et survit à normalize(), sans jamais s'imposer aux médias importés
// par l'utilisateur (qui n'en portent aucune).
//
// Usage : npm run test:montageprovenance

import {
  addAudio, addClip, addImageLayer, emptyProject, type Provenance,
} from "../lib/editor/project";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const provenance: Provenance = {
  provider: "pexels", providerId: "42", author: "Ada Lovelace",
  authorUrl: "https://pexels.com/@ada", license: "pexels", sourceUrl: "https://images.pexels.com/42.jpg",
};

async function main() {
  const base = emptyProject("c1", "p1");

  // ── La provenance traverse chaque primitive d'ajout ───────────────────────
  {
    const p = addClip(base, { id: "c1", src: "x.jpg", kind: "image", provenance });
    check("addClip porte la provenance sur le plan créé", p.clips[0]?.provenance?.provider === "pexels");
  }
  {
    const p = addImageLayer(base, "i1", "x.png", provenance);
    check("addImageLayer porte la provenance sur l'incrustation créée", p.images[0]?.provenance?.author === "Ada Lovelace");
  }
  {
    const p = addAudio(base, { id: "a1", src: "x.mp3", name: "Musique", role: "music", provenance });
    check("addAudio porte la provenance sur la piste créée", p.audios[0]?.provenance?.license === "pexels");
  }

  // ── Un média importé par l'utilisateur n'en porte aucune ──────────────────
  {
    const p = addClip(base, { id: "c2", src: "perso.jpg", kind: "image" });
    check("un plan importé sans provenance n'en porte pas", p.clips[0]?.provenance === undefined);
  }

  // ── La provenance survit à normalize() (ripple, reformatage, etc.) ────────
  {
    let p = addClip(base, { id: "c1", src: "a.mp4", kind: "video", sourceDuration: 10, provenance });
    p = addClip(p, { id: "c2", src: "b.mp4", kind: "video", sourceDuration: 8 });
    check("la provenance du premier plan résiste à l'ajout d'un second",
      p.clips.find((c) => c.id === "c1")?.provenance?.provider === "pexels");
    check("le second plan, sans provenance, n'en acquiert pas une par effet de bord",
      p.clips.find((c) => c.id === "c2")?.provenance === undefined);
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
