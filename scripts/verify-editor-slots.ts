// Emplacements de gabarit — mission bibliothèque, Lot B-1.
//
// Un modèle pose un texte d'amorce ("Votre accroche") : ce n'est pas le
// message final, et rien ne le signalait avant cette itération. Ces
// contrôles portent sur le CONTRAT du mécanisme d'emplacement : un modèle
// appliqué déclare ses emplacements non remplis, `fillSlot` remplace le
// contenu de démonstration et enregistre la provenance, et un emplacement
// dont la cible disparaît (calque supprimé) cesse d'être réclamé.
//
// Usage : npm run test:montageslots

import {
  addSlot, addText, emptyProject, fillSlot, removeText, unfilledSlots,
  type EditorProject,
} from "../lib/editor/project";
import { applyTemplate, brandStyleFrom, TEMPLATES } from "../lib/editor/templates";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

let seed = 0;
const idFor = (prefix: string) => `${prefix}-${(seed++).toString(36)}`;

function base(): EditorProject {
  return emptyProject("c1", "p1");
}

const brand = brandStyleFrom({ palette: ["#5b2d8e", "#111111"], recommendedTextColor: "#ffffff" });

async function main() {
  // ── applyTemplate déclare un emplacement requis, non rempli, par texte posé ──
  {
    const tpl = TEMPLATES.find((t) => t.key === "title-card")!;
    const p = applyTemplate(base(), tpl.key, brand, idFor);
    check("le nombre d'emplacements suit le nombre de textes du modèle",
      (p.slots ?? []).length === tpl.slots.length, String(p.slots?.length));
    check("chaque emplacement posé par un modèle est non rempli",
      (p.slots ?? []).every((s) => s.filled === false));
    check("chaque emplacement posé par un modèle est requis",
      (p.slots ?? []).every((s) => s.required === true));
    check("unfilledSlots renvoie tous les emplacements du modèle qui vient d'être posé",
      unfilledSlots(p).length === tpl.slots.length);
    check("l'emplacement pointe vers un texte réellement posé sur le projet",
      (p.slots ?? []).every((s) => s.targetKind === "text" && p.texts.some((t) => t.id === s.targetId)));
  }

  // ── fillSlot remplace le contenu de démonstration et enregistre la provenance ──
  {
    const tpl = TEMPLATES.find((t) => t.key === "hook")!;
    let p = applyTemplate(base(), tpl.key, brand, idFor);
    const slot = unfilledSlots(p)[0];
    check("un emplacement à remplir existe bien avant l'appel", Boolean(slot));

    p = fillSlot(p, slot.id, {
      text: "Le message réel du client",
      provenance: { provider: "internal", providerId: "manuel", license: "n/a", sourceUrl: "n/a" },
    });

    const text = p.texts.find((t) => t.id === slot.targetId)!;
    check("le texte du calque cible porte désormais le vrai contenu",
      text.text === "Le message réel du client", text.text);
    check("l'emplacement est marqué rempli", (p.slots ?? []).find((s) => s.id === slot.id)?.filled === true);
    check("la provenance est enregistrée au moment du remplissage",
      (p.slots ?? []).find((s) => s.id === slot.id)?.provenance?.provider === "internal");
    check("un emplacement rempli ne compte plus parmi les emplacements requis non résolus",
      unfilledSlots(p).every((s) => s.id !== slot.id));
  }

  // ── fillSlot est sans effet sur un identifiant d'emplacement inconnu ──────
  {
    const tpl = TEMPLATES.find((t) => t.key === "cta")!;
    const p = applyTemplate(base(), tpl.key, brand, idFor);
    const after = fillSlot(p, "emplacement-inexistant", { text: "peu importe" });
    check("un identifiant d'emplacement inconnu laisse le projet inchangé", after === p);
  }

  // ── Un emplacement dont la cible disparaît cesse d'être réclamé ──────────
  {
    const tpl = TEMPLATES.find((t) => t.key === "quote")!;
    let p = applyTemplate(base(), tpl.key, brand, idFor);
    const slot = unfilledSlots(p)[0];
    p = removeText(p, slot.targetId);
    check("un emplacement dont le calque cible a été supprimé disparaît du document",
      (p.slots ?? []).every((s) => s.id !== slot.id));
    check("il ne bloque donc plus l'export via unfilledSlots", unfilledSlots(p).length === 0);
  }

  // ── addSlot est la primitive de plus bas niveau : un appelant peut déclarer
  //    un emplacement pour un calque qu'il a posé lui-même, hors modèle ─────
  {
    let p = addText(base(), "libre", "Espace réservé");
    p = addSlot(p, {
      id: "s-libre", role: "caption", label: "Légende", required: false,
      targetKind: "text", targetId: "libre", filled: false,
    });
    check("un emplacement facultatif n'apparaît pas dans les emplacements requis",
      unfilledSlots(p).length === 0);
    check("mais il est bien porté par le document", (p.slots ?? []).length === 1);
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
