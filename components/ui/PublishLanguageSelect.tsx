"use client";

// Sélecteur de LANGUE DE PUBLICATION réutilisable (≠ langue de l'interface).
// Stocke un code (cf. lib/publish-languages) ; libellés bilingues selon l'UI.

import { PUBLISH_LANGUAGES } from "@/lib/publish-languages";
import { useLang } from "@/lib/i18n";

export function PublishLanguageSelect({
  value,
  onChange,
  className,
  showLabel = true,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  /** Affiche le libellé « 🌐 Langue de publication : » devant le menu. */
  showLabel?: boolean;
}) {
  const { lang, t } = useLang();
  const label = t("Langue de publication", "Publishing language");
  return (
    <label className="inline-flex items-center gap-1.5 text-2xs text-muted">
      {showLabel && <span>🌐 {label} :</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        title={label}
        className={
          className ??
          "rounded-lg border border-hair bg-card px-2 py-1 text-2xs text-ink outline-none focus:border-primary-400"
        }
      >
        {PUBLISH_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {lang === "en" ? l.en : l.fr}
          </option>
        ))}
      </select>
    </label>
  );
}
