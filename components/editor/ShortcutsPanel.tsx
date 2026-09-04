"use client";

// Panneau de référence des raccourcis clavier — ouvert par la touche `?` et le
// bouton dédié de l'en-tête (itération 3, §6.3). C'est le principal vecteur
// d'apprentissage des raccourcis pour un utilisateur qui ne les connaît pas
// encore : ils sont aussi indiqués dans les infobulles au fil de l'éditeur,
// mais réunis ici par famille pour qui veut les parcourir d'un coup.

import { useT } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";

function Row({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-xs">
      <span className="text-ink">{label}</span>
      <kbd className="shrink-0 rounded-md border border-hair bg-canvas px-1.5 py-0.5 font-mono text-2xs text-muted">
        {keys}
      </kbd>
    </div>
  );
}

export function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const groups: { title: string; rows: { keys: string; label: string }[] }[] = [
    {
      title: t("Lecture", "Playback"),
      rows: [
        { keys: t("Espace", "Space"), label: t("Lecture / pause", "Play / pause") },
        { keys: "←  →", label: t("Reculer / avancer d'une image", "Step back / forward one frame") },
        { keys: t("Maj + ←  →", "Shift + ←  →"), label: t("Par pas d'une seconde", "One-second steps") },
        { keys: t("Origine / Fin", "Home / End"), label: t("Début / fin du montage", "Start / end of the edit") },
      ],
    },
    {
      title: t("Montage", "Editing"),
      rows: [
        { keys: "C", label: t("Scinder à la tête de lecture", "Split at the playhead") },
        { keys: t("Suppr", "Delete"), label: t("Supprimer la sélection", "Delete the selection") },
        { keys: "Ctrl/⌘ + D", label: t("Dupliquer la sélection", "Duplicate the selection") },
        { keys: "Ctrl/⌘ + X", label: t("Couper la sélection", "Cut the selection") },
        { keys: "Ctrl/⌘ + C", label: t("Copier la sélection", "Copy the selection") },
        { keys: "Ctrl/⌘ + V", label: t("Coller à la tête de lecture", "Paste at the playhead") },
        { keys: t("Clic droit", "Right-click"), label: t("Menu contextuel — élément ou piste", "Context menu — element or track") },
        { keys: t("Glisser dans le vide", "Drag on empty space"), label: t("Sélectionner au rectangle", "Rubber-band selection") },
        { keys: t("Maj + glisser", "Shift + drag"), label: t("Ajouter le rectangle à la sélection", "Add the rubber band to the selection") },
        { keys: "⏱", label: t("Animer une propriété par images-clés (panneau de droite)", "Animate a property with keyframes (right-hand panel)") },
        { keys: "M", label: t("Poser un repère à la tête de lecture", "Drop a marker at the playhead") },
        { keys: t("Maj + M", "Shift + M"), label: t("Aller au repère suivant", "Jump to the next marker") },
        { keys: "🧲", label: t("Activer / désactiver l'aimantation (barre de la timeline)", "Toggle snapping (timeline bar)") },
        { keys: "Ctrl/⌘ + Z", label: t("Annuler", "Undo") },
        { keys: t("Ctrl/⌘ + Maj + Z", "Ctrl/⌘ + Shift + Z"), label: t("Rétablir", "Redo") },
        { keys: "Ctrl/⌘ + S", label: t("Enregistrer", "Save") },
      ],
    },
    {
      title: t("Navigation", "Navigation"),
      rows: [
        { keys: t("Échap", "Esc"), label: t("Désélectionner", "Deselect") },
        { keys: "?", label: t("Afficher ce panneau", "Show this panel") },
      ],
    },
  ];

  return (
    <Modal open={open} onClose={onClose} width="max-w-md">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{t("Raccourcis clavier", "Keyboard shortcuts")}</h3>
          <button type="button" onClick={onClose} aria-label={t("Fermer", "Close")} className="text-muted hover:text-ink">✕</button>
        </div>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{g.title}</p>
              <div className="divide-y divide-hair">
                {g.rows.map((r) => <Row key={r.label} {...r} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
