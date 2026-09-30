// Type partagé entre lib/composer/apply-formatting.ts (logique pure) et
// components/composer/FormattingToolbar.tsx (composant), pour éviter un
// import du composant (client-only) depuis le module pur.
export type FormattingMode = "markdown" | "unicode";
