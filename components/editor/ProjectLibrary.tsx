"use client";

// Bibliothèque de projets — la contrepartie visible de l'enregistrement.
//
// Le banc de montage enregistre tout seul depuis le lot 1, mais un projet qu'on
// ne peut pas retrouver n'est pas enregistré du point de vue de qui l'a fait.
// Cette liste est la porte d'entrée : reprendre un montage de la semaine
// dernière, ou repartir d'un montage voisin plutôt que de la page blanche.

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { projectDuration, type EditorFormat, type EditorProject } from "@/lib/editor/project";

interface ProjectRow {
  id: string;
  name: string;
  format: EditorFormat;
  doc: EditorProject;
  renderUrl: string | null;
  updatedAt: string;
}

/** Date courte et lisible, sans dépendance de formatage lourde. */
function shortDate(iso: string, lang: "fr" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectLibrary({
  companyId,
  currentId,
  onOpen,
  onClose,
}: {
  companyId: string;
  /** Projet ouvert — signalé pour éviter de le rouvrir par-dessus lui-même. */
  currentId?: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch(`/api/editor/projects?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setRows((d?.projects as ProjectRow[]) ?? []);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/editor/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    setBusyId(null);
    // On recharge plutôt que de retirer la ligne à l'aveugle : si la
    // suppression a échoué côté serveur, la liste doit le montrer.
    await load();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hair px-4 py-2.5">
          <h4 className="text-sm font-semibold text-ink">📁 {t("Mes montages", "My edits")}</h4>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label={t("Fermer", "Close")}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {rows === null && (
            <p className="flex items-center gap-2 p-4 text-xs text-muted">
              <Spinner size={14} className="text-page" /> {t("Chargement…", "Loading…")}
            </p>
          )}
          {rows?.length === 0 && (
            <p className="p-4 text-center text-xs text-muted">
              {t(
                "Aucun montage enregistré pour l'instant. Le projet en cours sera ajouté ici automatiquement.",
                "No saved edits yet. The current project will be added here automatically."
              )}
            </p>
          )}
          <ul className="space-y-1.5">
            {rows?.map((r) => {
              const duration = projectDuration(r.doc);
              const isCurrent = r.id === currentId;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-hair px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {r.name || t("Montage sans titre", "Untitled edit")}
                      {isCurrent && (
                        <span className="ml-2 rounded bg-page px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {t("en cours", "open")}
                        </span>
                      )}
                    </p>
                    <p className="text-2xs text-muted">
                      {r.format} · {duration.toFixed(1)}s · {r.doc.clips.length} {t("plan(s)", "clip(s)")}
                      {r.updatedAt ? ` · ${shortDate(r.updatedAt, t("fr", "en") as "fr" | "en")}` : ""}
                    </p>
                  </div>
                  {r.renderUrl && (
                    <a
                      href={r.renderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-2xs text-page hover:underline"
                    >
                      {t("Voir le rendu", "View render")}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    disabled={isCurrent}
                    className="btn-secondary text-2xs disabled:opacity-40"
                  >
                    {t("Reprendre", "Resume")}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={busyId === r.id}
                    aria-label={t("Supprimer le montage", "Delete edit")}
                    className="text-2xs text-danger-600 hover:underline disabled:opacity-40"
                  >
                    {busyId === r.id ? "…" : "🗑"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
