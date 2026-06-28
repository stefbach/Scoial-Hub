"use client";

// ── NetworkSpace — espace dédié par réseau (façon « Espace LinkedIn ») ─────────
// Regroupe, pour UN réseau : l'état de connexion (+ assistant de connexion) et
// le planificateur de série (génération posts/articles + visuels, adapté aux
// contraintes du réseau). Réutilisable pour Facebook, Instagram, Twitter/X,
// Pinterest, TikTok via une seule route dynamique.

import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectGuide } from "@/components/connect/ConnectGuide";
import { SeriesPlanner } from "@/components/series/SeriesPlanner";
import { SERIES_CONFIG, type SeriesPlatform } from "@/lib/social-series";
import type { ConnectHelpKey } from "@/lib/connect-help";
import type { ConnectorStatus } from "@/lib/connectors/types";

// Facebook + Instagram passent par l'assistant Meta ; les autres par le leur.
const CONNECT_VIA: Record<SeriesPlatform, ConnectHelpKey> = {
  facebook: "meta",
  instagram: "meta",
  twitter: "twitter",
  pinterest: "pinterest",
  tiktok: "tiktok",
};

export function NetworkSpace({ platform }: { platform: SeriesPlatform }) {
  const cfg = SERIES_CONFIG[platform];
  const t = useT();
  const { company } = useCompany();
  const companyId = company.id;

  const [statuses, setStatuses] = useState<ConnectorStatus[] | null>(null);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/connectors?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s) => { if (!cancelled) setStatuses(Array.isArray(s) ? s : []); })
      .catch(() => { if (!cancelled) setStatuses([]); });
    return () => { cancelled = true; };
  }, [companyId]);

  const status = statuses?.find((s) => s.platform === platform);
  const connected = (status?.connectedAccounts ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t(`Espace ${cfg.label}`, `${cfg.label} space`)} />

      {/* Connexion du réseau */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: cfg.color }}>
          {cfg.label.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{cfg.label}</p>
          <p className="text-2xs text-muted">
            {statuses === null
              ? t("Vérification…", "Checking…")
              : connected
              ? `${t("Connecté", "Connected")} ✓`
              : t("Non connecté", "Not connected")}
          </p>
        </div>
        <button onClick={() => setGuide(true)} className="btn-secondary ml-auto text-xs">
          {connected ? t("Reconnecter", "Reconnect") : t("Connecter", "Connect")}
        </button>
      </div>

      {/* Planificateur de série dédié au réseau */}
      <section className="card p-5 space-y-3">
        <div>
          <span className="section-label">{t("Programmer une série de publications", "Schedule a series of posts")}</span>
          <p className="mt-0.5 text-xs text-muted">
            {t(
              "Générez une série (posts ou articles) avec visuels, adaptée aux contraintes du réseau, puis diffusez.",
              "Generate a series (posts or articles) with visuals, adapted to the network's constraints, then publish."
            )}
          </p>
        </div>
        <SeriesPlanner platform={platform} />
      </section>

      <ConnectGuide
        open={guide}
        onClose={() => setGuide(false)}
        platform={CONNECT_VIA[platform]}
        companyId={companyId}
        returnTo={`/reseau/${platform}`}
      />
    </div>
  );
}
