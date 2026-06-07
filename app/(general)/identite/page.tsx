"use client";

// ── Identité de marque — Consultant IA (page dédiée) ─────────────────────────
// Espace où l'on discute avec le consultant IA pour construire et VERROUILLER
// l'ADN de la marque avant (ou en parallèle de) la construction des campagnes.
// Accessible à tout moment depuis le menu, et réutilisé comme étape 0 du
// démarrage guidé. Tout est réversible : on peut remettre à zéro l'identité ET
// la mémoire stratégique (RAG).

import { useEffect, useState } from "react";
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

      <RagMemoryCard companyId={company.id} />
    </div>
  );
}

// ── Mémoire stratégique (RAG) — consultation & remise à zéro ─────────────────
function RagMemoryCard({ companyId }: { companyId: string }) {
  const t = useT();
  const [count, setCount] = useState<number | null>(null);
  const [hasBrief, setHasBrief] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = () => {
    fetch(`/api/memory?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCount(Array.isArray(d.memory) ? d.memory.length : 0);
        setHasBrief(Boolean(d.brief));
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function reset() {
    if (resetting) return;
    if (typeof window !== "undefined" && !window.confirm(
      t("Vider la mémoire stratégique (RAG) ? Les insights de veille, pubs et Page accumulés seront effacés.",
        "Clear the strategic memory (RAG)? Accumulated watch, ads and Page insights will be erased.")
    )) return;
    setResetting(true);
    try {
      await fetch(`/api/memory?companyId=${encodeURIComponent(companyId)}`, { method: "DELETE" });
      setCount(0);
      setHasBrief(false);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="section-label">{t("Mémoire stratégique (RAG)", "Strategic memory (RAG)")}</p>
        <p className="mt-1 text-sm text-muted">
          {count === null
            ? t("Chargement…", "Loading…")
            : count === 0 && !hasBrief
            ? t("Vide — la mémoire se construira au fil de la veille et des analyses.", "Empty — memory builds up from watch and analyses.")
            : t(
                `${count} insight(s) mémorisé(s)${hasBrief ? " · brief synthétisé" : ""}. Injectés (au choix) dans la génération.`,
                `${count} insight(s) stored${hasBrief ? " · synthesized brief" : ""}. Injected (opt-in) into generation.`
              )}
        </p>
      </div>
      <button
        onClick={reset}
        disabled={resetting || (count === 0 && !hasBrief)}
        className="btn-secondary shrink-0 text-xs disabled:opacity-50"
      >
        {resetting ? t("Remise à zéro…", "Resetting…") : t("↺ Remettre la mémoire à zéro", "↺ Reset memory")}
      </button>
    </div>
  );
}
