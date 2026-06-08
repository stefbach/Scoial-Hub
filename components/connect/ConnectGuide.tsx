"use client";

// Assistant de connexion guidé (Meta ou LinkedIn) — rassure l'utilisateur non
// technique : explique en 3 étapes ce qui va se passer, puis lance l'OAuth.
// Aucune saisie de token : tout est géré par la connexion sécurisée.

import { Modal } from "@/components/ui/Modal";
import { useT } from "@/lib/i18n";

type Platform = "meta" | "linkedin";

const AUTH_PATH: Record<Platform, string> = {
  meta: "/api/connectors/facebook/auth",
  linkedin: "/api/connectors/linkedin/auth",
};

export function ConnectGuide({
  open,
  onClose,
  platform,
  companyId,
  returnTo = "/pages-meta",
}: {
  open: boolean;
  onClose: () => void;
  platform: Platform;
  companyId: string;
  returnTo?: string;
}) {
  const t = useT();
  const isMeta = platform === "meta";
  // Garde-fou : ne JAMAIS lancer l'OAuth avec un companyId vide (race
  // d'hydratation sur mobile) — sinon le callback ne peut pas rattacher la
  // connexion à la société. Tant que la société n'est pas prête, on bloque.
  const ready = Boolean(companyId && companyId.trim());
  const url = `${AUTH_PATH[platform]}?companyId=${encodeURIComponent(companyId)}&return=${encodeURIComponent(returnTo)}`;

  const steps = isMeta
    ? [
        t("Cliquez « Continuer » : vous êtes redirigé vers Facebook.", "Click “Continue”: you'll be redirected to Facebook."),
        t("Choisissez votre Page et acceptez les autorisations demandées.", "Choose your Page and accept the requested permissions."),
        t("Vous revenez ici, connecté — Facebook ET Instagram d'un coup.", "You come back here, connected — both Facebook AND Instagram."),
      ]
    : [
        t("Cliquez « Continuer » : vous êtes redirigé vers LinkedIn.", "Click “Continue”: you'll be redirected to LinkedIn."),
        t("Acceptez l'accès demandé (publication en votre nom).", "Accept the requested access (posting on your behalf)."),
        t("Vous revenez ici, connecté. Choisissez ensuite profil ou Page.", "You come back here, connected. Then choose profile or Page."),
      ];

  return (
    <Modal open={open} onClose={onClose} width="max-w-md">
      <div className="border-b border-hair px-5 py-3.5">
        <h2 className="text-base font-semibold text-ink">
          {isMeta ? t("Connecter Facebook & Instagram", "Connect Facebook & Instagram") : t("Connecter LinkedIn", "Connect LinkedIn")}
        </h2>
        <p className="mt-0.5 text-2xs text-muted">
          {t("Connexion sécurisée — aucune clé ni mot de passe à copier.", "Secure connection — no key or password to copy.")}
        </p>
      </div>

      <div className="space-y-3 p-5">
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">{i + 1}</span>
              <span className="text-sm text-ink">{s}</span>
            </li>
          ))}
        </ol>
        <p className="rounded-lg bg-ai-textbg/40 px-3 py-2 text-2xs text-ai-text">
          {isMeta
            ? t("Astuce : connectez le compte qui gère la Page de cette société.", "Tip: connect the account that manages this company's Page.")
            : t("Pour publier sur une Page entreprise, l'accès « Community Management » LinkedIn est requis.", "To publish on a company Page, LinkedIn's “Community Management” access is required.")}
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
        <button onClick={onClose} className="btn-secondary text-sm">{t("Annuler", "Cancel")}</button>
        {ready ? (
          <a href={url} className="btn-primary text-sm">{t("Continuer →", "Continue →")}</a>
        ) : (
          <button type="button" disabled className="btn-primary text-sm opacity-50" aria-disabled="true">
            {t("Chargement…", "Loading…")}
          </button>
        )}
      </div>
    </Modal>
  );
}
