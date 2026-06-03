"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Company } from "@/lib/types";
import { useT } from "@/lib/i18n";

function AvatarBubble({ code, accent }: { code: string; accent: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase text-white shadow-sm"
      style={{ backgroundColor: accent || "#1e3a5f" }}
      aria-hidden="true"
    >
      {code.slice(0, 2)}
    </span>
  );
}

function EmptyState({ query, t }: { query: string; t: (fr: string, en: string) => string }) {
  if (query) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center animate-fade-in">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl">🔍</span>
        <p className="text-sm text-muted">{t("Aucun compte ne correspond à «", "No account matches «")}&nbsp;<strong className="text-ink">{query}</strong>&nbsp;».</p>
        <p className="text-xs text-muted">{t("Essayez un autre terme ou vérifiez l'orthographe.", "Try a different term or check the spelling.")}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center animate-fade-in">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-page/10 text-3xl">🏢</span>
      <div>
        <p className="text-base font-semibold text-ink">{t("Aucun compte créé", "No accounts yet")}</p>
        <p className="mt-1 text-sm text-muted">
          {t("Créez votre premier compte pour commencer à piloter vos réseaux sociaux.", "Create your first account to start managing your social networks.")}
        </p>
      </div>
      <Link href="/admin/comptes/nouveau" className="btn-primary mt-2">
        + {t("Créer un compte", "Create account")}
      </Link>
    </div>
  );
}

export default function ComptesPage() {
  const t = useT();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/companies")
      .then((r) => {
        if (!r.ok) throw new Error(`${t("Erreur", "Error")} ${r.status}`);
        return r.json();
      })
      .then((data: Company[]) => {
        if (!cancelled) {
          setCompanies(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message ?? t("Impossible de charger les comptes.", "Unable to load accounts."));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.brandVoice ?? "").toLowerCase().includes(q)
    );
  }, [companies, query]);

  return (
    <div className="animate-fade-in">
      {/* En-tête */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">{t("Comptes & entités", "Accounts & entities")}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {t("Gérez vos comptes clients et entités AXON-AI.", "Manage your client accounts and AXON-AI entities.")}
          </p>
        </div>
        <Link href="/admin/comptes/nouveau" className="btn-primary shrink-0">
          + {t("Créer un compte", "Create account")}
        </Link>
      </div>

      {/* Barre de recherche */}
      {!loading && !error && companies.length > 0 && (
        <div className="mb-5">
          <div className="relative max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder={t("Rechercher un compte…", "Search an account…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-8 pr-3 py-2 text-sm max-w-xs"
              aria-label={t("Rechercher un compte", "Search an account")}
            />
          </div>
          {query && (
            <p className="mt-1.5 text-xs text-muted">
              {filtered.length} {t("résultat", "result")}{filtered.length !== 1 ? (t("s", "s")) : ""} {t("pour «", "for «")}&nbsp;{query}&nbsp;»
            </p>
          )}
        </div>
      )}

      {/* État de chargement */}
      {loading && (
        <div className="flex items-center gap-3 py-16 justify-center">
          <svg className="h-5 w-5 animate-spin text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm text-muted">{t("Chargement des comptes…", "Loading accounts…")}</span>
        </div>
      )}

      {/* Erreur */}
      {!loading && error && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-5 py-4 text-sm text-danger-700">
          <strong>{t("Erreur :", "Error:")}</strong> {error}
          <button
            onClick={() => window.location.reload()}
            className="ml-3 underline underline-offset-2 hover:no-underline"
          >
            {t("Réessayer", "Retry")}
          </button>
        </div>
      )}

      {/* Liste */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <EmptyState query={query} t={t} />
          ) : (
            <div className="space-y-2">
              {/* Tableau header */}
              <div className="hidden grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-1.5 sm:grid">
                <span />
                <span className="section-label">{t("Nom / Code", "Name / Code")}</span>
                <span className="section-label text-right">Brand voice</span>
                <span className="section-label text-right">{t("Accent", "Accent")}</span>
                <span className="section-label text-right">{t("Action", "Action")}</span>
              </div>

              {filtered.map((company) => (
                <div
                  key={company.id}
                  className="card grid grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center sm:gap-4 hover:shadow-md transition-shadow"
                >
                  {/* Avatar */}
                  <AvatarBubble code={company.code} accent={company.accent} />

                  {/* Nom + code */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{company.name}</span>
                      <span className="chip">{company.code}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      ID : <code className="font-mono">{company.id}</code>
                    </p>
                  </div>

                  {/* Brand voice */}
                  <div className="max-w-[180px] sm:text-right">
                    {company.brandVoice ? (
                      <p className="line-clamp-2 text-xs text-muted">{company.brandVoice}</p>
                    ) : (
                      <span className="text-xs text-muted/50 italic">{t("Non défini", "Not defined")}</span>
                    )}
                  </div>

                  {/* Couleur accent */}
                  <div className="flex items-center gap-1.5 sm:justify-end">
                    <span
                      className="h-4 w-4 rounded-full border border-hair"
                      style={{ backgroundColor: company.accent || "#1e3a5f" }}
                      aria-label={`${t("Couleur accent :", "Accent colour:")} ${company.accent}`}
                    />
                    <span className="font-mono text-xs text-muted">{company.accent || "—"}</span>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Link
                      href={`/admin/comptes/${company.id}`}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      {t("Gérer →", "Manage →")}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
