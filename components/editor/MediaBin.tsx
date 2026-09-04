"use client";

// Chutier — les médias DÉJÀ dans le projet.
//
// L'onglet Médias ne savait qu'importer : reposer une vidéo déjà utilisée
// obligeait à la retrouver sur le disque et à la réenvoyer, ce qui créait un
// second fichier hébergé pour le même contenu. `ProjectLibrary`, malgré son
// nom, liste les PROJETS enregistrés — pas les médias d'un projet.
//
// La liste est dérivée du document (`projectMedia`), jamais tenue à part : un
// média disparaît du chutier dès que le dernier élément qui l'utilisait est
// supprimé, sans qu'aucun code ait à s'en souvenir.

import { useT } from "@/lib/i18n";
import type { ProjectMedium } from "@/lib/editor/project";

const ICON: Record<ProjectMedium["kind"], string> = {
  video: "🎬",
  image: "🖼",
  audio: "🎵",
};

export function MediaBin({
  media,
  onAddClip,
  onAddOverlay,
  onAddAudio,
}: {
  media: ProjectMedium[];
  /** Repose le média sur la piste vidéo, comme un plan. */
  onAddClip: (m: ProjectMedium) => void;
  /** Image seulement : la repose comme incrustation par-dessus le montage. */
  onAddOverlay: (m: ProjectMedium) => void;
  /** Son seulement : le repose sur sa piste sonore. */
  onAddAudio: (m: ProjectMedium) => void;
}) {
  const t = useT();

  if (media.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
          {t("Fichiers du projet", "Files in project")}
        </p>
        <p className="text-2xs text-muted">
          {t(
            "Les médias que vous importez apparaîtront ici, prêts à être reposés sans les réimporter.",
            "The media you import will appear here, ready to place again without re-importing."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
        {t("Fichiers du projet", "Files in project")} · {media.length}
      </p>
      <ul className="max-h-56 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
        {media.map((m) => (
          <li
            key={m.src}
            className="flex items-center gap-2 rounded-md border border-hair px-2 py-1.5"
          >
            {/* Vignette pour ce qui se regarde, pastille pour ce qui s'écoute. */}
            {m.kind === "audio" ? (
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded bg-canvas text-sm">
                {ICON.audio}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.src}
                alt=""
                className="h-8 w-8 shrink-0 rounded bg-canvas object-cover"
                // Une vidéo n'a pas de vignette tant qu'elle n'est pas décodée :
                // le navigateur affiche alors l'alternative textuelle, pas une
                // image cassée.
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
              />
            )}

            <span className="min-w-0 flex-1">
              <span className="block truncate text-2xs text-ink" title={m.name}>
                {ICON[m.kind]} {m.name}
              </span>
              <span className="block text-[9px] text-muted">
                {m.duration > 0 && `${m.duration.toFixed(1)}s · `}
                {m.uses > 1
                  ? t(`utilisé ${m.uses} fois`, `used ${m.uses} times`)
                  : t("utilisé 1 fois", "used once")}
                {m.provenance && ` · ${m.provenance.provider}`}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1">
              {m.kind === "audio" ? (
                <BinButton
                  label="♪"
                  title={t("Reposer ce son", "Place this sound again")}
                  onClick={() => onAddAudio(m)}
                />
              ) : (
                <>
                  <BinButton
                    label="＋"
                    title={t("Reposer comme plan", "Place again as a clip")}
                    onClick={() => onAddClip(m)}
                  />
                  {m.kind === "image" && (
                    <BinButton
                      label="🖼"
                      title={t("Reposer comme incrustation", "Place again as an overlay")}
                      onClick={() => onAddOverlay(m)}
                    />
                  )}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BinButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="h-6 w-6 rounded text-2xs text-muted ring-1 ring-hair hover:text-ink"
    >
      {label}
    </button>
  );
}
