"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { useT } from "@/lib/i18n";

export function BulkActionBar({
  selectedCount,
  visibleCount,
  onSelectAll,
  onClear,
  onRetag,
  onDelete,
}: {
  selectedCount: number;
  visibleCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onRetag: (tags: string[]) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [retagOpen, setRetagOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-hair border-hair bg-card shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-6 py-3">
        <span className="text-sm font-medium text-ink">{selectedCount} {t("sélectionné(s)", "selected")}</span>
        <Button variant="ghost" onClick={onSelectAll}>{t("Tout sélectionner", "Select all")} ({visibleCount})</Button>
        <button onClick={onClear} className="text-sm text-muted underline hover:text-ink">
          {t("Effacer", "Clear")}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Button
              variant="secondary"
              disabled={selectedCount === 0}
              onClick={() => setRetagOpen((o) => !o)}
            >
              {t("Re-tagger", "Re-tag")}
            </Button>
            {retagOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-64 rounded-md border-hair border-hair bg-card p-3 shadow-lg">
                <div className="mb-2 text-2xs font-medium text-muted">{t("Définir les tags pour la sélection", "Set tags for selected")}</div>
                <TagInput tags={tags} onChange={setTags} />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setRetagOpen(false)}>{t("Annuler", "Cancel")}</Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      onRetag(tags);
                      setRetagOpen(false);
                    }}
                  >
                    {t("Appliquer", "Apply")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Button
              variant="danger"
              disabled={selectedCount === 0}
              onClick={() => setConfirmDelete(true)}
            >
              {t("Supprimer", "Delete")}
            </Button>
            {confirmDelete && (
              <div className="absolute bottom-full right-0 mb-2 w-64 rounded-md border-hair border-hair bg-card p-3 shadow-lg">
                <p className="text-sm text-ink">
                  {t(
                    `Supprimer ${selectedCount} modèle${selectedCount === 1 ? "" : "s"} ? Cette action est irréversible.`,
                    `Delete ${selectedCount} template${selectedCount === 1 ? "" : "s"}? This cannot be undone.`
                  )}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t("Annuler", "Cancel")}</Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      onDelete();
                      setConfirmDelete(false);
                    }}
                  >
                    {t("Supprimer", "Delete")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
