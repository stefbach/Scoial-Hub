"use client";

// Modale de détail d'une « Recommandation IA » du Centre de pilotage (bug UAT #7).
// Affiche l'intégralité des données réellement portées par la décision — agent,
// réseau, titre, analyse complète, impact estimé, statut — sans rien inventer.
// Accessibilité : role="dialog" + aria-modal, focus-trap, Échap et clic sur
// l'overlay ferment (fournis par components/ui/Modal).

import { Modal } from "@/components/ui/Modal";
import { useT } from "@/lib/i18n";
import type { Decision, Network } from "@/lib/pilotage";

export const NET_LABEL: Record<Network, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E1306C" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
};

export const AGENT_LABEL: Record<string, string> = {
  strategist: "Stratège", copywriter: "Copywriter", creative: "Creative",
  media_buyer: "Media Buyer", analyst: "Analyste", compliance: "Conformité",
};

export function RecommendationModal({
  decision,
  onClose,
  onSetStatus,
}: {
  decision: Decision | null;
  onClose: () => void;
  onSetStatus: (id: string, status: Decision["status"]) => void;
}) {
  const t = useT();
  return (
    <Modal open={!!decision} onClose={onClose} width="max-w-lg">
      {decision && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="section-label mb-1">{t("Recommandation IA", "AI recommendation")}</div>
              <h2 className="break-words text-lg font-bold text-ink">{decision.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Fermer", "Close")}
              className="btn-ghost shrink-0 px-2 py-1 text-sm"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-page/10 px-1.5 py-0.5 text-2xs font-semibold text-page">
              {AGENT_LABEL[decision.agent] ?? decision.agent}
            </span>
            {decision.channel && decision.channel !== "sea" && (
              <span className="text-2xs font-medium" style={{ color: NET_LABEL[decision.channel].color }}>
                {NET_LABEL[decision.channel].label}
              </span>
            )}
            {decision.channel === "sea" && <span className="text-2xs font-medium text-warning-600">SEA</span>}
            <span
              className={`chip ${
                decision.status === "approved" ? "text-success-700" : decision.status === "rejected" ? "text-muted" : ""
              }`}
            >
              {decision.status === "approved"
                ? t("✓ Validée", "✓ Approved")
                : decision.status === "rejected"
                ? t("Ignorée", "Dismissed")
                : t("En attente de validation", "Awaiting review")}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <section>
              <div className="text-2xs font-semibold uppercase tracking-wide text-muted">
                {t("Analyse détaillée", "Detailed analysis")}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{decision.rationale}</p>
            </section>
            <section>
              <div className="text-2xs font-semibold uppercase tracking-wide text-muted">
                {t("Impact estimé", "Estimated impact")}
              </div>
              <p className="mt-1 break-words text-sm font-medium text-success-700">{decision.impact}</p>
            </section>
          </div>

          {decision.status === "pending" && (
            <div className="mt-5 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { onSetStatus(decision.id, "rejected"); onClose(); }}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                {t("Ignorer", "Dismiss")}
              </button>
              <button
                type="button"
                onClick={() => { onSetStatus(decision.id, "approved"); onClose(); }}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                {t("Valider", "Approve")}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
