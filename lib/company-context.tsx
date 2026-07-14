"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { COMPANIES, COMPANY_DATA, registerCompany, makeEmptyCompanyData } from "./mock-data";
import type { Company, CompanyData } from "./types";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { MyAccess } from "@/lib/rbac/types";

const COMPANY_LS_KEY = "sh_company_id";

// Accès permissif par défaut (mode démo / pendant le chargement) : on n'enferme
// pas l'UI avant d'avoir la réponse réelle de /api/me/access.
const DEFAULT_ACCESS: MyAccess = { role: "owner", mode: "edit", isAccountAdmin: true, canEdit: true };

interface CompanyContextValue {
  companies: Company[];
  company: Company;
  data: CompanyData;
  setCompanyId: (id: string) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, patch: Partial<Company>) => void;
  /** Droits de l'utilisateur courant sur la société active (édition/lecture). */
  access: MyAccess;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  // En backend RÉEL (Supabase configuré), on NE démarre PAS sur une société de
  // démonstration : la sélection reste vide (→ sentinelle « aucune société »)
  // jusqu'à l'hydratation des vraies sociétés. Sinon l'app activerait par défaut
  // la marque de démo « occ », à laquelle un compte réel n'a pas accès (403 sur
  // les appels par-société, puis plantage au rendu). En mode démo pur (Supabase
  // absent), on garde la première marque de démonstration.
  const [companyId, setCompanyIdState] = useState(
    isSupabaseConfigured ? "" : COMPANIES[0].id
  );
  const [access, setAccess] = useState<MyAccess>(DEFAULT_ACCESS);

  // Sélection de société PERSISTÉE (localStorage) : remplace l'ancien menu
  // déroulant volatil. La société active survit au rechargement.
  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    try { window.localStorage.setItem(COMPANY_LS_KEY, id); } catch { /* ignore */ }
  }, []);

  // Restaure la dernière société choisie au montage.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COMPANY_LS_KEY);
      if (saved) setCompanyIdState(saved);
    } catch { /* ignore */ }
  }, []);
  // Snapshot of the shared COMPANIES list; bumping this triggers re-renders
  // for the switcher and any consumer when companies are added/edited.
  const [companies, setCompanies] = useState<Company[]>(
    isSupabaseConfigured ? [] : [...COMPANIES]
  );
  // Données de la société courante, hydratées depuis la base réelle (sh_*).
  // Démarrage propre : vide tant que le fetch n'a pas répondu (et si absence
  // de données réelles, reste vide — aucune donnée fictive).
  const [companyData, setCompanyData] = useState<CompanyData>(() => makeEmptyCompanyData());

  // Attempt to hydrate companies from the REST API on mount.
  // Quand Supabase est configuré et un user connecté existe, on passe son
  // orgId en query param pour que la RLS filtre correctement.
  // Initialised with mock data, so the app is fully functional before the
  // fetch resolves (and remains functional if it fails or Supabase is absent).
  useEffect(() => {
    let cancelled = false;

    async function resolveApiUrl(): Promise<{ url: string; authed: boolean }> {
      if (!isSupabaseConfigured) return { url: "/api/companies", authed: false };
      const supabase = createClient();
      if (!supabase) return { url: "/api/companies", authed: false };
      const { data } = await supabase.auth.getUser();
      if (!data.user) return { url: "/api/companies", authed: false };
      // Récupère l'orgId depuis les memberships
      const { data: membership } = await supabase
        .from("sh_memberships")
        .select("org_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .single();
      if (membership?.org_id) {
        return { url: `/api/companies?orgId=${encodeURIComponent(membership.org_id as string)}`, authed: true };
      }
      // Utilisateur connecté mais sans org : compte réel, espace (encore) vide.
      return { url: "/api/companies", authed: true };
    }

    resolveApiUrl()
      .then(({ url }) => fetch(url))
      .then((res) => {
        if (!res.ok) throw new Error(`/api/companies returned ${res.status}`);
        return res.json() as Promise<Company[]>;
      })
      .then((fetched) => {
        if (cancelled || !Array.isArray(fetched)) return;

        // ── Backend RÉEL configuré : la liste renvoyée fait AUTORITÉ ───────
        // Elle est filtrée par la session serveur (cookie), donc fiable même si
        // le client n'a pas encore résolu `getUser()`. On affiche EXACTEMENT
        // les sociétés du compte (jamais les marques de démonstration) et on ne
        // reste JAMAIS bloqué sur une société d'une AUTRE organisation mémorisée
        // lors d'une session précédente — cause des 403 puis du plantage au
        // démarrage. Espace vierge → liste VIDE et sélection périmée purgée.
        if (isSupabaseConfigured) {
          for (const c of fetched) {
            if (!COMPANY_DATA[c.id]) COMPANY_DATA[c.id] = makeEmptyCompanyData();
          }
          COMPANIES.splice(0, COMPANIES.length, ...fetched);
          setCompanies([...COMPANIES]);
          setCompanyIdState((prev) => {
            if (COMPANIES.some((c) => c.id === prev)) return prev;
            const fallback = COMPANIES[0]?.id ?? "";
            try {
              if (fallback) window.localStorage.setItem(COMPANY_LS_KEY, fallback);
              else window.localStorage.removeItem(COMPANY_LS_KEY);
            } catch {
              /* ignore */
            }
            return fallback;
          });
          return;
        }

        // ── Mode démo (pas d'auth) : fusion avec les marques de démonstration ──
        if (fetched.length === 0) return;
        for (const c of fetched) {
          const byId = COMPANIES.findIndex((x) => x.id === c.id);
          const byCode = COMPANIES.findIndex((x) => x.code === c.code);
          if (byId >= 0) {
            COMPANIES[byId] = { ...COMPANIES[byId], ...c };
          } else if (byCode >= 0) {
            // Compte réel : on démarre sur des données VIDES (pas de mock fictif).
            if (!COMPANY_DATA[c.id]) COMPANY_DATA[c.id] = makeEmptyCompanyData();
            COMPANIES[byCode] = { ...COMPANIES[byCode], ...c }; // adopte l'UUID réel
          } else {
            registerCompany(c);
            if (!COMPANY_DATA[c.id]) COMPANY_DATA[c.id] = makeEmptyCompanyData();
          }
        }

        setCompanies([...COMPANIES]);
        // If the previously-selected companyId no longer exists in the
        // refreshed list, fall back to the first entry.
        setCompanyIdState((prev) => {
          const stillExists = COMPANIES.some((c) => c.id === prev);
          return stillExists ? prev : (COMPANIES[0]?.id ?? prev);
        });
      })
      .catch((err) => {
        // Non-blocking: the app continues with mock data.
        console.warn("[CompanyProvider] API hydration failed, using mock data:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate les données de la société courante depuis les tables réelles sh_*.
  // Se relance à chaque changement de société. Dégradation gracieuse : en cas
  // d'échec, on garde les données vides (aucune donnée fictive).
  useEffect(() => {
    let cancelled = false;
    setCompanyData(makeEmptyCompanyData());
    // Aucune société active (sentinelle) → pas d'appel par-société (évite un 403
    // inutile sur une société inexistante/étrangère avant l'hydratation).
    if (!companyId) return;
    fetch(`/api/company-data?companyId=${encodeURIComponent(companyId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<CompanyData>) : null))
      .then((fetched) => {
        if (cancelled || !fetched) return;
        setCompanyData(fetched);
      })
      .catch((err) => {
        console.warn("[CompanyProvider] company-data hydration failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Droits effectifs de l'utilisateur sur la société active (édition/lecture).
  useEffect(() => {
    let cancelled = false;
    if (!companyId) { setAccess(DEFAULT_ACCESS); return; }
    fetch(`/api/me/access?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<MyAccess>) : null))
      .then((a) => {
        if (cancelled || !a) return;
        setAccess({
          role: a.role ?? null,
          mode: a.mode ?? null,
          isAccountAdmin: Boolean(a.isAccountAdmin),
          canEdit: Boolean(a.canEdit),
        });
      })
      .catch(() => { /* garde l'accès permissif par défaut */ });
    return () => { cancelled = true; };
  }, [companyId]);

  const addCompany = useCallback((company: Company) => {
    registerCompany(company);
    setCompanies([...COMPANIES]);
  }, []);

  const updateCompany = useCallback((id: string, patch: Partial<Company>) => {
    const idx = COMPANIES.findIndex((c) => c.id === id);
    if (idx >= 0) COMPANIES[idx] = { ...COMPANIES[idx], ...patch };
    setCompanies([...COMPANIES]);
  }, []);

  const value = useMemo<CompanyContextValue>(() => {
    // Sentinelle « aucune société » : évite tout crash quand un compte réel n'a
    // pas encore créé de société (company.id = "" → les routes par-société
    // renvoient 400/empty proprement, et l'UI invite à créer une société).
    const company =
      companies.find((c) => c.id === companyId) ??
      companies[0] ??
      ({ id: "", code: "—", name: "—", brandVoice: "", accent: "#9ca3af", defaultPlatforms: [] } as Company);
    return {
      companies,
      company,
      // Données réelles hydratées depuis la base (sh_*) ; vides au démarrage.
      data: companyData,
      setCompanyId,
      addCompany,
      updateCompany,
      access,
    };
  }, [companyId, companies, companyData, addCompany, updateCompany, setCompanyId, access]);

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

/** Raccourci : l'utilisateur peut-il MODIFIER la société active ? */
export function useCanEdit(): boolean {
  return useCompany().access.canEdit;
}
