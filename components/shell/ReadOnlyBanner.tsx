"use client";

// Bannière globale « lecture seule » : visible sur toutes les pages quand
// l'utilisateur n'a qu'un accès consultation sur la société active. Les actions
// d'écriture sont par ailleurs désactivées dans l'UI et refusées côté serveur.

import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";

export function ReadOnlyBanner() {
  const { company, access } = useCompany();
  const t = useT();

  // Rien à afficher si pas de société, si admin du compte, ou si édition permise.
  if (!company?.id || access.isAccountAdmin || access.canEdit) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2.5 rounded-xl border border-warning-500/40 bg-warning-50 px-4 py-2.5 text-sm text-warning-700"
    >
      <span aria-hidden="true">👁</span>
      <p className="min-w-0">
        <span className="font-semibold">{t("Lecture seule", "View only")}</span>
        {" — "}
        {t(
          `vous pouvez consulter « ${company.name} » mais pas la modifier. Contactez l'administrateur du compte pour obtenir un accès en édition.`,
          `you can view "${company.name}" but not edit it. Ask the account administrator for edit access.`
        )}
      </p>
    </div>
  );
}
