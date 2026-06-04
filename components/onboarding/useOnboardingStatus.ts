"use client";

// Statut d'onboarding partagé (une seule source) pour le cockpit et le
// tableau de bord. Évite de dupliquer le fetch /api/onboarding/state.

import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";

export interface OnboardingStatus {
  loading: boolean;
  completed: boolean;
  step: number;
  /** true dès qu'une identité de marque a été analysée. */
  hasProfile: boolean;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { company } = useCompany();
  const companyId = company.id;
  const [status, setStatus] = useState<OnboardingStatus>({
    loading: true,
    completed: false,
    step: 1,
    hasProfile: false,
  });

  useEffect(() => {
    let alive = true;
    setStatus((p) => ({ ...p, loading: true }));

    fetch(`/api/onboarding/state?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d) {
          setStatus({
            loading: false,
            completed: d.state?.completed ?? false,
            step: d.state?.step ?? 1,
            hasProfile: Boolean(d.profile?.analyzedAt),
          });
        } else {
          setStatus((p) => ({ ...p, loading: false }));
        }
      })
      .catch(() => {
        if (alive) setStatus((p) => ({ ...p, loading: false }));
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  return status;
}
