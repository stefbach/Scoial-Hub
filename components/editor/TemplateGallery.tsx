"use client";

// Galerie de modèles, avec vignettes.
//
// Les modèles existaient déjà, calibrés sur le kit de marque — mais présentés
// sous forme de simples boutons textuels. L'utilisateur ne pouvait pas savoir à
// quoi ressemblait un modèle avant de l'appliquer, ce qui explique qu'il n'ait
// pas perçu la fonction comme une galerie : un actif développé, mais invisible.
//
// Les vignettes sont ENGENDRÉES à partir du modèle lui-même, pas dessinées à la
// main : elles ne peuvent donc pas se désynchroniser de ce que l'application
// produit réellement.

import { useT } from "@/lib/i18n";
import { FORMAT_SIZE, type EditorFormat } from "@/lib/editor/project";
import { sizePctFor, type BrandStyle, type EditorTemplate } from "@/lib/editor/templates";

export function TemplateGallery({
  templates,
  brand,
  format,
  lang,
  onApply,
}: {
  templates: EditorTemplate[];
  brand: BrandStyle;
  format: EditorFormat;
  lang: "fr" | "en";
  onApply: (key: string) => void;
}) {
  const t = useT();
  const frame = FORMAT_SIZE[format];
  const ratio = frame.width / frame.height;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {templates.map((tpl) => (
          <button
            key={tpl.key}
            type="button"
            onClick={() => onApply(tpl.key)}
            title={lang === "en" ? tpl.hint.en : tpl.hint.fr}
            className="group space-y-1 rounded-lg border border-hair p-1.5 text-left hover:border-page"
          >
            <div
              className="relative w-full overflow-hidden rounded bg-gradient-to-br from-neutral-700 to-neutral-900"
              style={{ aspectRatio: `${ratio}` }}
            >
              {/* Un rectangle par emplacement de texte : position, taille et
                  couleur sont celles que le modèle appliquera. */}
              {tpl.slots.map((slot, i) => {
                const size = sizePctFor(slot.sizeW, format);
                const color = slot.colorRank < 0 ? brand.textColor : brand.palette[slot.colorRank] ?? brand.textColor;
                return (
                  <span
                    key={i}
                    className="absolute rounded-[1px]"
                    style={{
                      left: `${(slot.align === "center" ? slot.x - slot.sizeW * 1.6 : slot.x) * 100}%`,
                      top: `${slot.y * 100}%`,
                      width: `${Math.min(0.9, slot.sizeW * 3.2) * 100}%`,
                      height: `${size * 100}%`,
                      background: color,
                      opacity: slot.role === "title" ? 0.95 : 0.7,
                      boxShadow: slot.bg ? "0 0 0 2px rgba(0,0,0,0.45)" : undefined,
                    }}
                  />
                );
              })}
              {tpl.logo && brand.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt="" className="absolute right-[6%] top-[5%] w-[16%]" />
              )}
            </div>
            <p className="truncate text-[10px] font-medium text-ink group-hover:text-page">
              {lang === "en" ? tpl.label.en : tpl.label.fr}
            </p>
          </button>
        ))}
      </div>

      <p className="text-2xs text-muted">
        {brand.palette.length > 0 || brand.logoUrl
          ? t("Couleurs et logo repris du kit de marque.", "Colours and logo taken from the brand kit.")
          : t("Kit de marque absent — modèles en blanc lisible.", "No brand kit — templates use readable white.")}
      </p>
    </div>
  );
}
