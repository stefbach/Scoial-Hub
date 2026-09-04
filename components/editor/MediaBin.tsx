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

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { ProjectMedium } from "@/lib/editor/project";

const ICON: Record<ProjectMedium["kind"], string> = {
  video: "🎬",
  image: "🖼",
  audio: "🎵",
};

type BinView = "list" | "grid";

/** Choix d'affichage retenu d'une session à l'autre — un monteur ne veut pas
    le refaire à chaque ouverture. Silencieux si le stockage est refusé. */
const VIEW_KEY = "axon.mediabin.view";

function readView(): BinView {
  if (typeof window === "undefined") return "grid";
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

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
  const [view, setView] = useState<BinView>("grid");

  // Lu APRÈS le montage : lire `localStorage` pendant le rendu ferait diverger
  // le HTML du serveur de celui du client.
  useEffect(() => setView(readView()), []);
  const choose = (v: BinView) => {
    setView(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* stockage refusé */ }
  };

  const header = (
    <div className="flex items-center justify-between gap-2">
      <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
        {t("Fichiers du projet", "Files in project")}
        {media.length > 0 && ` · ${media.length}`}
      </p>
      {media.length > 0 && (
        <div className="flex shrink-0 items-center gap-0.5">
          <ViewButton icon="▦" label={t("Vignettes", "Thumbnails")} on={view === "grid"} onClick={() => choose("grid")} />
          <ViewButton icon="☰" label={t("Liste", "List")} on={view === "list"} onClick={() => choose("list")} />
        </div>
      )}
    </div>
  );

  if (media.length === 0) {
    return (
      <section className="space-y-1.5 rounded-lg border border-hair p-2">
        {header}
        <p className="text-[10px] text-muted">
          {t(
            "Les médias que vous importez apparaîtront ici, prêts à être reposés sans les réimporter.",
            "The media you import will appear here, ready to place again without re-importing."
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-1.5 rounded-lg border border-hair p-2">
      {header}
      <div className="max-h-64 overflow-y-auto overscroll-contain pr-0.5">
        {view === "grid" ? (
          // Deux colonnes : à la largeur du panneau, trois vignettes seraient
          // trop petites pour reconnaître un plan d'un coup d'œil — ce qui est
          // la seule raison d'avoir des vignettes.
          <ul className="grid grid-cols-2 gap-1.5">
            {media.map((m) => (
              <li key={m.src} className="overflow-hidden rounded-md border border-hair">
                <Thumb m={m} className="h-16 w-full" />
                <div className="space-y-0.5 p-1.5">
                  <p className="truncate text-[10px] text-ink" title={m.name}>{m.name}</p>
                  <p className="truncate text-[9px] text-muted">{meta(m, t)}</p>
                  <div className="flex items-center gap-1">
                    <Actions m={m} onAddClip={onAddClip} onAddOverlay={onAddOverlay} onAddAudio={onAddAudio} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1">
            {media.map((m) => (
              <li key={m.src} className="flex items-center gap-2 rounded-md border border-hair px-2 py-1.5">
                <Thumb m={m} className="h-8 w-8 shrink-0 rounded" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] text-ink" title={m.name}>{m.name}</span>
                  <span className="block truncate text-[9px] text-muted">{meta(m, t)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Actions m={m} onAddClip={onAddClip} onAddOverlay={onAddOverlay} onAddAudio={onAddAudio} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Ligne d'information : durée, nombre d'usages, fournisseur. */
function meta(m: ProjectMedium, t: (fr: string, en: string) => string): string {
  const bits: string[] = [];
  if (m.duration > 0) bits.push(`${m.duration.toFixed(1)}s`);
  bits.push(m.uses > 1 ? t(`${m.uses} usages`, `${m.uses} uses`) : t("1 usage", "1 use"));
  if (m.provenance) bits.push(m.provenance.provider);
  return bits.join(" · ");
}

/**
 * Vignette. Une vidéo n'en produit pas sans être décodée : le navigateur
 * affiche alors l'alternative, jamais une image cassée — on retombe sur la
 * pastille de type, qui reste reconnaissable.
 */
function Thumb({ m, className }: { m: ProjectMedium; className: string }) {
  const [broken, setBroken] = useState(false);
  if (m.kind === "audio" || broken) {
    return (
      <span aria-hidden className={`grid place-items-center bg-canvas text-sm ${className}`}>
        {ICON[m.kind]}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={m.src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className={`bg-canvas object-cover ${className}`}
    />
  );
}

function Actions({
  m, onAddClip, onAddOverlay, onAddAudio,
}: {
  m: ProjectMedium;
  onAddClip: (m: ProjectMedium) => void;
  onAddOverlay: (m: ProjectMedium) => void;
  onAddAudio: (m: ProjectMedium) => void;
}) {
  const t = useT();
  if (m.kind === "audio") {
    return <BinButton label="♪" title={t("Reposer ce son", "Place this sound again")} onClick={() => onAddAudio(m)} />;
  }
  return (
    <>
      <BinButton label="＋" title={t("Reposer comme plan", "Place again as a clip")} onClick={() => onAddClip(m)} />
      {m.kind === "image" && (
        <BinButton label="🖼" title={t("Reposer comme incrustation", "Place again as an overlay")} onClick={() => onAddOverlay(m)} />
      )}
    </>
  );
}

function ViewButton({ icon, label, on, onClick }: { icon: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`h-5 w-5 rounded text-[11px] leading-none ${on ? "bg-page text-white" : "text-muted ring-1 ring-hair hover:text-ink"}`}
    >
      {icon}
    </button>
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
