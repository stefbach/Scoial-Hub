"use client";

// ── Identité de marque — Consultant IA (page dédiée) ─────────────────────────
// Espace où l'on discute avec le consultant IA pour construire et VERROUILLER
// l'ADN de la marque avant (ou en parallèle de) la construction des campagnes.
// Accessible à tout moment depuis le menu, et réutilisé comme étape 0 du
// démarrage guidé.

import { useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandConsultant } from "@/components/onboarding/BrandConsultant";
import { useT } from "@/lib/i18n";

export default function IdentitePage() {
  const { company } = useCompany();
  const router = useRouter();
  const t = useT();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <PageHeader title={t("Identité de marque", "Brand identity")} scoped={false} />
        <p className="-mt-3 max-w-3xl text-sm text-muted">
          {t(
            "Un entretien avec le consultant IA pour verrouiller la philosophie de votre marque — le socle de tous vos contenus et campagnes.",
            "A conversation with the AI consultant to lock your brand philosophy — the foundation of all your content and campaigns."
          )}
        </p>
      </div>
      <BrandConsultant
        companyId={company.id}
        companyName={company.name}
        onContinue={() => router.push("/demarrage")}
        continueLabel={t("Continuer vers le démarrage guidé", "Continue to guided setup")}
      />
    </div>
  );
}
