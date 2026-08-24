"use client";

// Rendu du texte produit par les agents — PARTAGÉ par les deux écrans qui
// l'affichent : la page /agents (RunTimeline) et l'étape 5 du parcours assisté
// (Step5Agents).
//
// Ces deux écrans avaient chacun leur propre rendu. Les corrections apportées à
// l'un ne profitaient donc pas à l'autre : le lien de reprise de campagne était
// cliquable dans la timeline mais inerte à l'étape 5, et la mention d'attente
// de validation devenait un bandeau ici et restait noyée dans le texte là-bas
// (recette R26 #4 et #5). Une seule implémentation, deux appelants.

import { useT } from "@/lib/i18n";

/** Chemins internes de l'app : /segment[/segment…][?query] */
const INTERNAL_LINK = /(\/[a-z0-9-]+(?:\/[a-z0-9-]+)*(?:\?[^\s]*)?)/gi;

/**
 * Texte d'étape avec les chemins internes rendus cliquables. Un agent qui
 * écrit « Cliquez le lien » doit produire un lien, pas une adresse à recopier.
 */
export function StepOutput({ text }: { text: string }) {
  const parts = text.split(INTERNAL_LINK);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 && part.startsWith("/") ? (
          <a
            key={i}
            href={part}
            className="font-medium text-page underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** Vrai si le texte contient un chemin interne — donc un lien à préserver. */
export function hasInternalLink(text: string): boolean {
  INTERNAL_LINK.lastIndex = 0;
  return INTERNAL_LINK.test(text);
}

/**
 * Tronque sans faire disparaître le lien de reprise. Le lien est ajouté en fin
 * de sortie par l'orchestrateur : une troncature naïve le coupait toujours, et
 * la consigne « cliquez le lien ci-dessus » ne désignait plus rien.
 */
export function truncateKeepingLink(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit).trimEnd();
  // Les lignes de reprise commencent par 🔗 (cf. orchestrator.ts).
  const linkLines = text
    .split("\n")
    .filter((l) => l.includes("🔗") && hasInternalLink(l))
    .filter((l) => !head.includes(l.trim()));
  return linkLines.length ? `${head}…\n${linkLines.join("\n")}` : `${head}…`;
}

/** Marqueurs d'attente de validation posés par l'orchestrateur. */
const APPROVAL_MARKS = ["[PENDING APPROVAL]", "[EN ATTENTE DE VALIDATION]"];

/**
 * Sépare le marqueur d'attente de validation du corps du contenu.
 * Le marqueur devient un bandeau ; le corps reste publiable tel quel, sans
 * mention à effacer à la main.
 */
export function splitApprovalMark(raw: string): { pending: boolean; body: string } {
  const trimmed = (raw ?? "").trimStart();
  const mark = APPROVAL_MARKS.find((m) => trimmed.startsWith(m));
  return mark
    ? { pending: true, body: trimmed.slice(mark.length).trimStart() }
    : { pending: false, body: raw ?? "" };
}

/** Bandeau « en attente de validation » — visible, pas noyé dans le texte. */
export function PendingApprovalBanner({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <p
      className={`flex items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-2 text-xs font-semibold text-warning-700 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.2" r="1.2" fill="currentColor" stroke="none" />
      </svg>
      {t(
        "En attente de votre validation — rien n'a été publié.",
        "Awaiting your approval — nothing has been published."
      )}
    </p>
  );
}
