"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

type ConnectorStatus = {
  platform: string;
  configured: boolean;
  connectedAccounts: number;
  accounts: { name?: string; status?: string; externalId?: string }[];
};

const PLATFORMS: Record<string, { label: string; color: string; desc: string; icon: string }> = {
  facebook: { label: "Facebook", color: "#1877F2", desc: "Pages, publication & Marketing API", icon: "f" },
  instagram: { label: "Instagram", color: "#E1306C", desc: "Feed, Stories & Reels", icon: "◎" },
  linkedin: { label: "LinkedIn", color: "#0A66C2", desc: "Pages & LinkedIn Ads", icon: "in" },
};

const EXTRA = [
  { label: "Meta Ads", color: "#1877F2", desc: "Campagnes payantes FB/IG", soon: true },
  { label: "Google Analytics 4", color: "#E8710A", desc: "Mesure & attribution", soon: true },
  { label: "TikTok", color: "#000000", desc: "À venir", soon: true },
];

export default function ConnecteursPage() {
  const [statuses, setStatuses] = useState<ConnectorStatus[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((d) => alive && setStatuses(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <PageHeader title="Connecteurs" />
        <p className="-mt-4 text-sm text-muted">
          Reliez vos réseaux sociaux et plateformes publicitaires pour publier et mesurer en réel.
        </p>
      </div>

      <section>
        <div className="section-label mb-3">Réseaux sociaux</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["facebook", "instagram", "linkedin"] as const).map((p) => {
            const meta = PLATFORMS[p];
            const st = statuses?.find((s) => s.platform === p);
            const connected = (st?.connectedAccounts ?? 0) > 0;
            const configured = st?.configured ?? false;
            return (
              <div key={p} className="card overflow-hidden p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
                      style={{ background: meta.color }}
                    >
                      {meta.icon}
                    </span>
                    <div>
                      <div className="font-semibold text-ink">{meta.label}</div>
                      <div className="text-2xs text-muted">{meta.desc}</div>
                    </div>
                  </div>
                  <StatusPill connected={connected} configured={configured} loading={!statuses && !error} />
                </div>

                <div className="mt-4 border-t border-hair pt-4">
                  {connected ? (
                    <div className="space-y-1.5">
                      {st!.accounts.map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-ink">{a.name ?? "Compte"}</span>
                          <span className="text-2xs text-success-600">● actif</span>
                        </div>
                      ))}
                      <a href={`/api/connectors/${p}/auth`} className="btn-secondary mt-2 w-full">
                        Reconnecter
                      </a>
                    </div>
                  ) : (
                    <a href={`/api/connectors/${p}/auth`} className={configured ? "btn-primary w-full" : "btn-secondary w-full"}>
                      {configured ? "Connecter" : "Connecter (mode simulé)"}
                    </a>
                  )}
                  {!configured && (
                    <p className="mt-2 text-2xs text-muted">
                      Clés API requises pour la connexion réelle — voir{" "}
                      <span className="font-medium text-ink">docs/CONNECTORS-NATIVE.md</span>.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-label mb-3">Bientôt disponible</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRA.map((e) => (
            <div key={e.label} className="card flex items-center gap-3 p-4 opacity-70">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: e.color }}>
                ●
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">{e.label}</div>
                <div className="text-2xs text-muted">{e.desc}</div>
              </div>
              <span className="chip">Bientôt</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ connected, configured, loading }: { connected: boolean; configured: boolean; loading: boolean }) {
  if (loading) return <span className="chip animate-pulse">…</span>;
  if (connected)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-0.5 text-2xs font-semibold text-success-700">
        <span className="h-1.5 w-1.5 rounded-full bg-success-500" /> Connecté
      </span>
    );
  if (configured)
    return <span className="inline-flex items-center rounded-full bg-warning-100 px-2.5 py-0.5 text-2xs font-semibold text-warning-700">Non connecté</span>;
  return <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-0.5 text-2xs font-semibold text-muted ring-1 ring-hair">Mode simulé</span>;
}
