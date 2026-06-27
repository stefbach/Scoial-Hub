"use client";

// Assistant de connexion guidé — rassure l'utilisateur non technique : explique
// en quelques étapes « ce qui va se passer », puis lance l'OAuth. Aucune saisie
// de token : tout est géré par la connexion sécurisée.
//
// 100 % piloté par config : les étapes/astuce/route OAuth de CHAQUE réseau sont
// déclarées une seule fois dans `lib/connect-help.ts`. Ajouter un réseau =
// ajouter une entrée d'aide (cohérent avec le registre des connecteurs).

import { Modal } from "@/components/ui/Modal";
import { useT } from "@/lib/i18n";
import { connectHelp, type ConnectHelpKey, type Bilingual } from "@/lib/connect-help";

export function ConnectGuide({
  open,
  onClose,
  platform,
  companyId,
  returnTo = "/accounts",
}: {
  open: boolean;
  onClose: () => void;
  platform: ConnectHelpKey;
  companyId: string;
  returnTo?: string;
}) {
  const t = useT();
  const pick = (b: Bilingual) => t(b.fr, b.en);

  const help = connectHelp(platform);
  if (!help) return null; // réseau sans aide déclarée → on n'affiche rien

  // Garde-fou : ne JAMAIS lancer l'OAuth avec un companyId vide (race
  // d'hydratation sur mobile) — sinon le callback ne peut pas rattacher la
  // connexion à la société. Tant que la société n'est pas prête, on bloque.
  const ready = Boolean(companyId && companyId.trim());
  const hasAuth = Boolean(help.authPath);
  const url = hasAuth
    ? `${help.authPath}?companyId=${encodeURIComponent(companyId)}&return=${encodeURIComponent(returnTo)}`
    : "";

  return (
    <Modal open={open} onClose={onClose} width="max-w-md">
      <div className="border-b border-hair px-5 py-3.5">
        <h2 className="text-base font-semibold text-ink">{pick(help.title)}</h2>
        <p className="mt-0.5 text-2xs text-muted">{pick(help.secure)}</p>
      </div>

      <div className="space-y-3 p-5">
        <ol className="space-y-2.5">
          {help.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                {i + 1}
              </span>
              <span className="text-sm text-ink">{pick(s)}</span>
            </li>
          ))}
        </ol>
        {help.tip && (
          <p className="rounded-lg bg-ai-textbg/40 px-3 py-2 text-2xs text-ai-text">{pick(help.tip)}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
        <button onClick={onClose} className="btn-secondary text-sm">
          {t("Annuler", "Cancel")}
        </button>
        {!hasAuth ? (
          // Réseau sans connexion automatique (ex. TikTok) : on ferme simplement.
          <button type="button" onClick={onClose} className="btn-primary text-sm">
            {help.cta ? pick(help.cta) : t("Compris", "Got it")}
          </button>
        ) : ready ? (
          <a href={url} className="btn-primary text-sm">
            {help.cta ? pick(help.cta) : t("Continuer →", "Continue →")}
          </a>
        ) : (
          <button type="button" disabled className="btn-primary text-sm opacity-50" aria-disabled="true">
            {t("Chargement…", "Loading…")}
          </button>
        )}
      </div>
    </Modal>
  );
}
