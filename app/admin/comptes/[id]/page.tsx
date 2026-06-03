"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Company } from "@/lib/types";
import { PRO_PROFILES } from "@/lib/agents/profiles";
import { CHANNELS } from "@/lib/channels";
import { StatusBadge } from "@/components/ui/StatusBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

type NetworkId = "facebook" | "instagram" | "linkedin";

interface NetworkConfig {
  enabled: boolean;
  organic: boolean;
  ads: boolean;
}

interface EntityConfig {
  profilId?: string;
  networks?: Record<NetworkId, NetworkConfig>;
  objectifGlobal?: string;
  objectifsReseau?: Record<NetworkId, { objectif: string }>;
  alertes?: {
    budgetSeuil?: string;
    cpaMax?: string;
    engagementChute?: string;
    alertesLibres?: string;
  };
  createdAt?: string;
}

const NETWORK_META: Record<NetworkId, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "#1877f2" },
  instagram: { label: "Instagram", color: "#e1306c" },
  linkedin: { label: "LinkedIn", color: "#0a66c2" },
};

const NETWORKS: NetworkId[] = ["facebook", "instagram", "linkedin"];

const APP_LINKS = [
  { href: "/dashboard", label: "Tableau de bord", icon: "📊" },
  { href: "/agents", label: "Agents IA", icon: "🤖" },
  { href: "/campaigns", label: "Campagnes", icon: "📣" },
  { href: "/connecteurs", label: "Connecteurs", icon: "🔗" },
];

// Liens spécifiques à l'entité (utilise l'id dynamiquement dans le rendu)
const ENTITY_TOOL_LINKS = [
  { href: (id: string) => `/admin/comptes/${id}/telegram`, label: "Chatbot Telegram", icon: "✈️" },
];

// ── Composants ────────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="section-label mb-3">{children}</div>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <span className="text-sm font-medium text-ink">
        {value || <span className="italic text-muted/60">Non défini</span>}
      </span>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function CompteDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [company, setCompany] = useState<Company | null>(null);
  const [config, setConfig] = useState<EntityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    // Lecture de la config localStorage
    try {
      const raw = localStorage.getItem(`sh_entity_config_${id}`);
      if (raw) setConfig(JSON.parse(raw) as EntityConfig);
    } catch {
      // pas de config locale — pas grave
    }

    // Chargement de l'entité via l'API
    fetch("/api/companies")
      .then((r) => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`);
        return r.json();
      })
      .then((data: Company[]) => {
        const found = data.find((c) => c.id === id) ?? null;
        setCompany(found);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message ?? "Impossible de charger l'entité.");
        setLoading(false);
      });

    // Mini-résumé des connexions canaux (silencieux en cas d'erreur)
    fetch(`/api/channel-connections?companyId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: Array<{ status: string }>) => {
        setConnectedCount(rows.filter((r) => r.status === "connected").length);
      })
      .catch(() => {
        setConnectedCount(0);
      });
  }, [id]);

  // ── États ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="h-5 w-5 animate-spin text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="ml-3 text-sm text-muted">Chargement de la fiche entité…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <Link href="/admin/comptes" className="btn-ghost mb-4 inline-block px-2 py-1 text-muted">
          ← Retour aux comptes
        </Link>
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-5 py-4 text-sm text-danger-700">
          <strong>Erreur :</strong> {error}
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="animate-fade-in">
        <Link href="/admin/comptes" className="btn-ghost mb-4 inline-block px-2 py-1 text-muted">
          ← Retour aux comptes
        </Link>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-base font-semibold text-ink">Entité introuvable</p>
          <p className="text-sm text-muted">Aucune entité ne correspond à l'identifiant «&nbsp;{id}&nbsp;».</p>
          <Link href="/admin/comptes" className="btn-primary mt-2">
            Retour aux comptes
          </Link>
        </div>
      </div>
    );
  }

  const profil = config?.profilId
    ? PRO_PROFILES.find((p) => p.id === config.profilId)
    : null;

  const activeNets = NETWORKS.filter((n) => config?.networks?.[n]?.enabled);

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-6">
      {/* Fil d'Ariane & nav */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/admin/comptes" className="hover:text-ink hover:underline underline-offset-2">
          Comptes & entités
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink font-medium">{company.name}</span>
      </div>

      {/* Bandeau Phase 2 */}
      <div className="flex items-center gap-3 rounded-xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="shrink-0">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span>
          <strong>Phase 2 :</strong> Les indicateurs détaillés par réseau (reach, engagement,
          dépenses, ROAS…) seront disponibles prochainement.
        </span>
      </div>

      {/* En-tête entité */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: company.accent || "#1e3a5f" }}
              aria-label={`Avatar de ${company.name}`}
            >
              {company.code}
            </span>
            <div>
              <h1 className="text-xl font-bold text-ink">{company.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="chip">{company.code}</span>
                {profil && (
                  <span className="chip">{profil.label}</span>
                )}
                {activeNets.length > 0 && (
                  <span className="chip">{activeNets.length} réseau{activeNets.length > 1 ? "x" : ""}</span>
                )}
              </div>
            </div>
          </div>
          <Link
            href={`/admin/comptes/nouveau`}
            className="btn-secondary shrink-0 text-xs"
          >
            + Nouveau compte
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Colonne principale */}
        <div className="space-y-5">
          {/* Informations de l'entité */}
          <div className="card p-5">
            <SectionHeader>Informations</SectionHeader>
            <div className="divide-y divide-hair">
              <InfoRow label="Identifiant" value={company.id} />
              <InfoRow label="Nom" value={company.name} />
              <InfoRow label="Code" value={company.code} />
              <InfoRow label="Brand voice" value={company.brandVoice} />
              <div className="flex items-start gap-3 py-1.5">
                <span className="w-28 shrink-0 text-xs text-muted">Couleur accent</span>
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-hair"
                    style={{ backgroundColor: company.accent || "#1e3a5f" }}
                  />
                  <span className="font-mono text-sm font-medium text-ink">
                    {company.accent || "#1e3a5f"}
                  </span>
                </div>
              </div>
              {profil && (
                <div className="flex items-start gap-3 py-1.5">
                  <span className="w-28 shrink-0 text-xs text-muted">Profil</span>
                  <div>
                    <div className="text-sm font-medium text-ink">{profil.label}</div>
                    <div className="mt-0.5 text-xs text-muted">{profil.description}</div>
                  </div>
                </div>
              )}
              {config?.createdAt && (
                <InfoRow
                  label="Configuré le"
                  value={new Date(config.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
              )}
            </div>
          </div>

          {/* Réseaux activés */}
          <div className="card p-5">
            <SectionHeader>Réseaux & canaux activés</SectionHeader>
            {!config?.networks ? (
              <div className="rounded-lg border border-hair bg-canvas px-4 py-5 text-center text-sm text-muted">
                Aucune configuration réseau trouvée.
                <br />
                <Link
                  href={`/admin/comptes/nouveau`}
                  className="mt-2 inline-block text-page underline underline-offset-2 hover:no-underline"
                >
                  Reconfigurer via le tunnel
                </Link>
              </div>
            ) : activeNets.length === 0 ? (
              <p className="text-sm italic text-muted">Aucun réseau activé.</p>
            ) : (
              <div className="space-y-3">
                {activeNets.map((net) => {
                  const cfg = config.networks![net];
                  const meta = NETWORK_META[net];
                  return (
                    <div
                      key={net}
                      className="flex items-center gap-3 rounded-xl border border-hair bg-canvas px-4 py-3"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-sm font-semibold text-ink">{meta.label}</span>
                      <div className="ml-auto flex gap-1.5">
                        {cfg.organic && (
                          <span className="chip bg-success-50 text-success-700">Organique</span>
                        )}
                        {cfg.ads && (
                          <span className="chip bg-primary-50 text-primary-700">Ads / SEA</span>
                        )}
                        {!cfg.organic && !cfg.ads && (
                          <span className="chip">Activé</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {NETWORKS.filter((n) => !config.networks?.[n]?.enabled).map((net) => (
                  <div
                    key={net}
                    className="flex items-center gap-3 rounded-xl border border-hair px-4 py-3 opacity-40"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: NETWORK_META[net].color }}
                    />
                    <span className="text-sm text-muted">{NETWORK_META[net].label}</span>
                    <span className="ml-auto chip">Inactif</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Objectifs */}
          <div className="card p-5">
            <SectionHeader>Objectifs stratégiques</SectionHeader>
            {!config ? (
              <p className="text-sm italic text-muted">
                Aucun objectif configuré. Utilisez le tunnel de création pour définir vos objectifs.
              </p>
            ) : (
              <div className="space-y-4">
                {config.objectifGlobal ? (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      Objectif global
                    </div>
                    <p className="text-sm text-ink">{config.objectifGlobal}</p>
                  </div>
                ) : (
                  <p className="text-sm italic text-muted">Objectif global non défini.</p>
                )}

                {activeNets.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Par réseau
                    </div>
                    <div className="space-y-2">
                      {activeNets.map((net) => {
                        const obj = config.objectifsReseau?.[net]?.objectif;
                        return (
                          <div key={net} className="flex gap-3">
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: NETWORK_META[net].color }}
                            />
                            <div>
                              <div className="text-xs font-medium text-muted">
                                {NETWORK_META[net].label}
                              </div>
                              {obj ? (
                                <p className="mt-0.5 text-sm text-ink">{obj}</p>
                              ) : (
                                <p className="mt-0.5 text-xs italic text-muted/60">Non défini</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alertes */}
          {config?.alertes &&
            (config.alertes.budgetSeuil ||
              config.alertes.cpaMax ||
              config.alertes.engagementChute ||
              config.alertes.alertesLibres) && (
              <div className="card p-5">
                <SectionHeader>Consignes d'alerte</SectionHeader>
                <div className="space-y-2">
                  {config.alertes.budgetSeuil && (
                    <div className="flex items-center gap-3 rounded-lg border border-hair bg-canvas px-3 py-2.5">
                      <span className="text-lg">💰</span>
                      <div>
                        <div className="text-xs text-muted">Seuil budget mensuel</div>
                        <div className="text-sm font-semibold text-ink">
                          {config.alertes.budgetSeuil} €
                        </div>
                      </div>
                    </div>
                  )}
                  {config.alertes.cpaMax && (
                    <div className="flex items-center gap-3 rounded-lg border border-hair bg-canvas px-3 py-2.5">
                      <span className="text-lg">🎯</span>
                      <div>
                        <div className="text-xs text-muted">CPA maximum</div>
                        <div className="text-sm font-semibold text-ink">
                          {config.alertes.cpaMax} €
                        </div>
                      </div>
                    </div>
                  )}
                  {config.alertes.engagementChute && (
                    <div className="flex items-center gap-3 rounded-lg border border-hair bg-canvas px-3 py-2.5">
                      <span className="text-lg">📉</span>
                      <div>
                        <div className="text-xs text-muted">Seuil chute d'engagement</div>
                        <div className="text-sm font-semibold text-ink">
                          −{config.alertes.engagementChute} %
                        </div>
                      </div>
                    </div>
                  )}
                  {config.alertes.alertesLibres && (
                    <div className="mt-3 rounded-lg border border-hair bg-canvas px-3 py-3">
                      <div className="mb-1 text-xs font-medium text-muted">Consignes libres</div>
                      <p className="text-sm italic text-ink">{config.alertes.alertesLibres}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {/* Liens rapides vers l'app */}
          <div className="card p-5">
            <SectionHeader>Accès rapide — App</SectionHeader>
            <div className="space-y-1.5">
              {APP_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-ink transition-all hover:border-hair hover:bg-canvas"
                >
                  <span className="text-base" aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                  <svg
                    className="ml-auto text-muted"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 5l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Outils par entité */}
          <div className="card p-5">
            <SectionHeader>Outils de ce compte</SectionHeader>
            <div className="space-y-1.5">
              {ENTITY_TOOL_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href(id)}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-ink transition-all hover:border-hair hover:bg-canvas"
                >
                  <span className="text-base" aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                  <svg
                    className="ml-auto text-muted"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 5l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Profil pro (si défini) */}
          {profil && (
            <div className="card p-5">
              <SectionHeader>Profil professionnel</SectionHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted">Tone recommandé</div>
                  <p className="mt-0.5 text-ink">{profil.recommendedTone}</p>
                </div>
                <div>
                  <div className="text-xs text-muted">KPIs sectoriels</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-canvas px-2.5 py-2 text-center">
                      <div className="text-xs text-muted">CPM</div>
                      <div className="text-sm font-semibold text-ink">
                        {profil.sectorKPIs.cpm.min}–{profil.sectorKPIs.cpm.max} €
                      </div>
                    </div>
                    <div className="rounded-lg bg-canvas px-2.5 py-2 text-center">
                      <div className="text-xs text-muted">CPA</div>
                      <div className="text-sm font-semibold text-ink">
                        {profil.sectorKPIs.cpa.min}–{profil.sectorKPIs.cpa.max} €
                      </div>
                    </div>
                    <div className="rounded-lg bg-canvas px-2.5 py-2 text-center">
                      <div className="text-xs text-muted">CTR</div>
                      <div className="text-sm font-semibold text-ink">
                        {profil.sectorKPIs.ctr.min}–{profil.sectorKPIs.ctr.max} %
                      </div>
                    </div>
                    <div className="rounded-lg bg-canvas px-2.5 py-2 text-center">
                      <div className="text-xs text-muted">Engagement</div>
                      <div className="text-sm font-semibold text-ink">
                        {profil.sectorKPIs.engagementRate.min}–{profil.sectorKPIs.engagementRate.max} %
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Cible captation 90 j</div>
                  <div className="mt-0.5 text-sm font-semibold text-ink">
                    {profil.audienceCaptureTarget90d} %
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connexions canaux */}
          <div className="card p-5">
            <SectionHeader>Connexions canaux</SectionHeader>
            <div className="mt-2 mb-3 flex items-center gap-2">
              {connectedCount === null ? (
                <span className="text-xs text-muted">Chargement…</span>
              ) : (
                <>
                  <StatusBadge tone={connectedCount > 0 ? "green" : "gray"} dot>
                    {connectedCount} / {CHANNELS.length} connecté{connectedCount > 1 ? "s" : ""}
                  </StatusBadge>
                  {connectedCount < CHANNELS.length && (
                    <span className="text-xs text-muted">
                      {CHANNELS.length - connectedCount} en attente
                    </span>
                  )}
                </>
              )}
            </div>
            <Link
              href={`/admin/comptes/${id}/connexions`}
              className="btn-primary block w-full text-center"
            >
              Gérer les connexions
            </Link>
          </div>

          {/* Actions */}
          <div className="card p-5">
            <SectionHeader>Actions</SectionHeader>
            <div className="space-y-2">
              <Link href="/dashboard" className="btn-primary block w-full text-center">
                Ouvrir l'app
              </Link>
              <Link
                href="/admin/comptes"
                className="btn-secondary block w-full text-center"
              >
                ← Tous les comptes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
