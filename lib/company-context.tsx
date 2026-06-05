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

interface CompanyContextValue {
  companies: Company[];
  company: Company;
  data: CompanyData;
  setCompanyId: (id: string) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, patch: Partial<Company>) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  // Snapshot of the shared COMPANIES list; bumping this triggers re-renders
  // for the switcher and any consumer when companies are added/edited.
  const [companies, setCompanies] = useState<Company[]>([...COMPANIES]);
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

    let isAuthed = false;
    resolveApiUrl()
      .then(({ url, authed }) => {
        isAuthed = authed;
        return fetch(url);
      })
      .then((res) => {
        if (!res.ok) throw new Error(`/api/companies returned ${res.status}`);
        return res.json() as Promise<Company[]>;
      })
      .then((fetched) => {
        if (cancelled || !Array.isArray(fetched)) return;

        // ── Compte RÉEL (utilisateur connecté avec organisation) ──────────
        // On affiche EXACTEMENT ses sociétés (jamais les marques de démo).
        // Espace vierge (aucune société) → liste VIDE — surtout PAS les marques
        // de démonstration, sinon toute action par société (connecteurs, etc.)
        // renverrait 403 sur une société qui ne lui appartient pas.
        if (isAuthed) {
          for (const c of fetched) {
            if (!COMPANY_DATA[c.id]) COMPANY_DATA[c.id] = makeEmptyCompanyData();
          }
          COMPANIES.splice(0, COMPANIES.length, ...fetched);
          setCompanies([...COMPANIES]);
          setCompanyId((prev) =>
            COMPANIES.some((c) => c.id === prev) ? prev : (COMPANIES[0]?.id ?? "")
          );
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
        setCompanyId((prev) => {
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
    };
  }, [companyId, companies, companyData, addCompany, updateCompany]);

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
