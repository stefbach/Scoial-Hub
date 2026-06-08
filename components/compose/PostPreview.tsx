"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";

/**
 * Aperçu d'une publication par réseau (mockup léger, autonome).
 *
 * Composant 100 % autonome : ne dépend d'aucun contexte applicatif au-delà de
 * l'i18n inline `t("FR","EN")`. Les données viennent toutes des props, de sorte
 * qu'il peut être réutilisé hors du Composer.
 *
 * Reproduit l'entête, la mise en page et la troncature « …voir plus » propres à
 * Facebook, Instagram et LinkedIn pour donner une idée fidèle du rendu final.
 */
export type PreviewPlatform = "facebook" | "instagram" | "linkedin";

interface PostPreviewProps {
  platform: PreviewPlatform;
  brandName: string;
  /** Couleur d'accent de la marque (hex), pour l'avatar. */
  brandAccent: string;
  /** Texte saisi par l'utilisateur (les retours à la ligne sont préservés). */
  text: string;
  /** Visuel attaché, le cas échéant. */
  imageUrl?: string;
  /** Précise s'il s'agit d'une vidéo (affichage <video> au lieu de <img>). */
  imageKind?: "image" | "video";
}

/** Seuil réaliste de troncature « voir plus » par réseau (en caractères). */
const TRUNCATE_AT: Record<PreviewPlatform, number> = {
  facebook: 280,
  instagram: 125,
  linkedin: 210,
};

/** Initiales de la marque pour l'avatar (max 3 caractères). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Avatar({
  brandName,
  brandAccent,
  ring,
  size = "h-9 w-9",
}: {
  brandName: string;
  brandAccent: string;
  ring?: string;
  size?: string;
}) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-2xs font-bold text-white shadow-sm ${ring ?? ""}`}
      style={{ backgroundColor: brandAccent }}
      aria-hidden="true"
    >
      {initials(brandName)}
    </span>
  );
}

/** Corps de texte avec retours à la ligne préservés et troncature « voir plus ». */
function PostBody({
  text,
  limit,
  className,
  moreClassName,
}: {
  text: string;
  limit: number;
  className: string;
  moreClassName: string;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const isLong = text.length > limit;
  const shown = useMemo(
    () => (expanded || !isLong ? text : `${text.slice(0, limit).trimEnd()}…`),
    [expanded, isLong, limit, text]
  );

  if (!text.trim()) {
    return (
      <p className={`${className} italic text-muted`}>
        {t("Votre texte apparaîtra ici…", "Your text will appear here…")}
      </p>
    );
  }

  return (
    <p className={`${className} whitespace-pre-wrap break-words`}>
      {shown}
      {isLong && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`ml-1 font-semibold ${moreClassName}`}
        >
          {t("…voir plus", "…see more")}
        </button>
      )}
    </p>
  );
}

function MediaSlot({
  imageUrl,
  imageKind,
  aspect,
  rounded,
}: {
  imageUrl?: string;
  imageKind?: "image" | "video";
  aspect: string;
  rounded: string;
}) {
  if (!imageUrl) return null;
  return (
    <div className={`overflow-hidden border border-hair bg-canvas ${aspect} ${rounded}`}>
      {imageKind === "video" ? (
        <video src={imageUrl} className="h-full w-full object-cover" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

export function PostPreview({
  platform,
  brandName,
  brandAccent,
  text,
  imageUrl,
  imageKind = "image",
}: PostPreviewProps) {
  const t = useT();
  const limit = TRUNCATE_AT[platform];

  // ── Instagram : carré, marque au-dessus, légende sous le visuel ───────────
  if (platform === "instagram") {
    return (
      <div className="overflow-hidden rounded-xl border border-hair bg-card shadow-xs">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar
            brandName={brandName}
            brandAccent={brandAccent}
            size="h-8 w-8"
            ring="ring-2 ring-platform-instagram/40"
          />
          <div className="text-xs font-semibold text-ink">{brandName}</div>
        </div>
        <MediaSlot imageUrl={imageUrl} imageKind={imageKind} aspect="aspect-square" rounded="" />
        <div className="px-3 py-2.5">
          <PostBody
            text={text}
            limit={limit}
            className="text-xs leading-relaxed text-ink"
            moreClassName="text-muted"
          />
        </div>
      </div>
    );
  }

  // ── LinkedIn : entête pro (nom + sous-titre), texte, puis visuel large ────
  if (platform === "linkedin") {
    return (
      <div className="overflow-hidden rounded-xl border border-hair bg-card p-3 shadow-xs">
        <div className="mb-2.5 flex items-center gap-2">
          <Avatar brandName={brandName} brandAccent={brandAccent} />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-ink">{brandName}</div>
            <div className="text-2xs text-muted">
              {t("Entreprise · Planifié", "Company · Scheduled")}
            </div>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-platform-linkedin/10 px-2 py-0.5 text-2xs font-semibold text-platform-linkedin">
            {t("Suivre", "Follow")}
          </span>
        </div>
        <PostBody
          text={text}
          limit={limit}
          className="mb-2 text-xs leading-relaxed text-ink"
          moreClassName="text-platform-linkedin"
        />
        <MediaSlot imageUrl={imageUrl} imageKind={imageKind} aspect="aspect-video" rounded="rounded-lg" />
      </div>
    );
  }

  // ── Facebook (par défaut) : entête, texte, visuel large ───────────────────
  return (
    <div className="card overflow-hidden p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Avatar brandName={brandName} brandAccent={brandAccent} size="h-8 w-8" />
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-ink">{brandName}</div>
          <div className="text-2xs text-muted">
            {t("Planifié · Mer à 09:00", "Scheduled · Wed at 09:00")}
          </div>
        </div>
      </div>
      <PostBody
        text={text}
        limit={limit}
        className="mb-2 text-xs leading-relaxed text-ink"
        moreClassName="text-platform-facebook"
      />
      <MediaSlot imageUrl={imageUrl} imageKind={imageKind} aspect="aspect-video" rounded="rounded-lg" />
    </div>
  );
}
