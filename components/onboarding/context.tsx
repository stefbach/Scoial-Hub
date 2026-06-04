"use client";

// Contexte du parcours de démarrage assisté.
// Gère le chargement, la persistance (auto-save débrouncé) et la navigation
// entre les 6 étapes. Toutes les étapes consomment ce contexte via
// useOnboardingCtx() — elles n'ont donc PAS à se passer de props entre elles.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCompany } from "@/lib/company-context";
import {
  type BrandHandles,
  type BrandProfile,
  type OnboardingState,
  type OnboardingStateResponse,
  type AnalyzeResponse,
  makeEmptyBrandProfile,
  makeEmptyOnboardingState,
  TOTAL_STEPS,
} from "@/lib/onboarding/types";

export interface OnboardingCtx {
  companyId: string;
  companyName: string;
  loading: boolean;
  saving: boolean;
  analyzing: boolean;
  error: string | null;
  state: OnboardingState;
  /** Toujours défini : profil vide tant que l'analyse n'a pas eu lieu. */
  profile: BrandProfile;
  /** true dès que l'IA a produit un profil (analyzedAt non nul). */
  hasProfile: boolean;
  /** Patch optimiste de l'état + persistance auto (débrouncée). */
  patchState: (patch: Partial<OnboardingState>) => void;
  /** Lance l'analyse IA de l'identité (étape 1). Retourne le profil ou null. */
  analyzeIdentity: (
    website: string,
    handles: BrandHandles,
    description?: string
  ) => Promise<BrandProfile | null>;
  goTo: (step: number) => void;
  next: () => void;
  back: () => void;
  /** Saute l'étape courante (parcours guidé mais non bloquant). */
  skip: () => void;
  /** Marque la campagne courante activée et persiste (n'empêche pas d'en relancer une). */
  complete: () => Promise<void>;
  /**
   * Démarre une NOUVELLE campagne : l'identité de marque (étape 1) est conservée,
   * on repart à l'étape 2 avec des choix de campagne vierges. Permet de lancer
   * plusieurs campagnes à des moments différents.
   */
  startNewCampaign: () => void;
  totalSteps: number;
}

const Ctx = createContext<OnboardingCtx | null>(null);

export function useOnboardingCtx(): OnboardingCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOnboardingCtx must be used within OnboardingProvider");
  return c;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { company } = useCompany();
  const companyId = company.id;
  const companyName = company.name;

  const [state, setState] = useState<OnboardingState>(() =>
    makeEmptyOnboardingState(companyId)
  );
  const [profile, setProfile] = useState<BrandProfile>(() =>
    makeEmptyBrandProfile(companyId)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Chargement initial (état + profil) ────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setState(makeEmptyOnboardingState(companyId));
    setProfile(makeEmptyBrandProfile(companyId));

    fetch(`/api/onboarding/state?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<OnboardingStateResponse>) : null))
      .then((data) => {
        if (!alive || !data) return;
        if (data.state) setState(data.state);
        if (data.profile) setProfile(data.profile);
      })
      .catch(() => {
        /* dégradation : on garde l'état vide local */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  // ── Persistance auto (débrouncée) ─────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(
    (next: OnboardingState) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch("/api/onboarding/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId,
              step: next.step,
              objectives: next.objectives,
              networks: next.networks,
              campaignCount: next.campaignCount,
              geo: next.geo,
              creativeMode: next.creativeMode,
              campaignType: next.campaignType,
              schedule: next.schedule,
              completed: next.completed,
            }),
          });
        } catch {
          /* non bloquant : l'état local reste à jour */
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [companyId]
  );

  const patchState = useCallback(
    (patch: Partial<OnboardingState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch, companyId, updatedAt: new Date().toISOString() };
        persist(next);
        return next;
      });
    },
    [companyId, persist]
  );

  const goTo = useCallback(
    (step: number) => {
      const clamped = Math.min(Math.max(step, 1), TOTAL_STEPS);
      patchState({ step: clamped });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [patchState]
  );

  const next = useCallback(() => goTo(state.step + 1), [goTo, state.step]);
  const back = useCallback(() => goTo(state.step - 1), [goTo, state.step]);
  const skip = useCallback(() => goTo(state.step + 1), [goTo, state.step]);

  const analyzeIdentity = useCallback(
    async (website: string, handles: BrandHandles, description?: string): Promise<BrandProfile | null> => {
      setAnalyzing(true);
      setError(null);
      try {
        const res = await fetch("/api/onboarding/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, website, handles, companyName, description }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || `Erreur ${res.status}`);
        }
        const data = (await res.json()) as AnalyzeResponse;
        setProfile(data.profile);
        return data.profile;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analyse impossible.");
        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    [companyId, companyName]
  );

  const complete = useCallback(async () => {
    patchState({ completed: true, step: TOTAL_STEPS });
  }, [patchState]);

  const startNewCampaign = useCallback(() => {
    // On garde l'identité (profil) + les réseaux/zone comme valeurs de départ ;
    // on remet à zéro les choix propres à une campagne et on repart à l'étape 2.
    patchState({
      step: 2,
      objectives: [],
      campaignCount: 1,
      creativeMode: null,
      campaignType: null,
      schedule: {},
      completed: false,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [patchState]);

  // Entrée « nouvelle campagne » via ?new=1 (depuis le cockpit du dashboard) :
  // une fois l'état chargé et l'identité connue, on relance un parcours vierge.
  const handledNewParam = useRef(false);
  useEffect(() => {
    if (loading || handledNewParam.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      handledNewParam.current = true;
      if (profile.analyzedAt) startNewCampaign();
      params.delete("new");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [loading, profile.analyzedAt, startNewCampaign]);

  const value: OnboardingCtx = {
    companyId,
    companyName,
    loading,
    saving,
    analyzing,
    error,
    state,
    profile,
    hasProfile: Boolean(profile.analyzedAt),
    patchState,
    analyzeIdentity,
    goTo,
    next,
    back,
    skip,
    complete,
    startNewCampaign,
    totalSteps: TOTAL_STEPS,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
