"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n";
import { useCanEdit } from "@/lib/company-context";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccessCapability = {
  type: "read" | "write";
  label: string;
};

export type ConnectorStatus = "connected" | "pending" | "disconnected" | "simulated";

export interface ConnectorField {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  help?: string;
}

export interface ConnectorAccessCardProps {
  id: string;
  label: string;
  color: string;
  icon?: string; // SVG path or emoji fallback
  description: string;
  where?: string;
  capabilities: AccessCapability[];
  fields: ConnectorField[];
  status: ConnectorStatus;
  config: Record<string, string>; // sanitized (secrets = "__secret__")
  /** Called when the user submits the config form. Return null if no API needed. */
  onSave?: (
    id: string,
    values: Record<string, string>
  ) => Promise<{ ok: boolean; error?: string }>;
  /** For connectors without a save API (AI, Scraping) — show env-based hint */
  envHint?: string;
  /** Tag shown instead of status when connector is "coming soon" */
  comingSoon?: boolean;
  /** URL OAuth pour une connexion automatique en 1 clic (Facebook/Instagram/LinkedIn). */
  oauthUrl?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: ConnectorStatus, tFn: (fr: string, en: string) => string, loading = false) {
  if (loading)
    return (
      <StatusBadge tone="gray" dot>
        <span className="animate-pulse">{tFn("Chargement…", "Loading…")}</span>
      </StatusBadge>
    );
  if (status === "connected")
    return (
      <StatusBadge tone="green" dot>
        {tFn("Connecté", "Connected")}
      </StatusBadge>
    );
  if (status === "pending")
    return (
      <StatusBadge tone="amber" dot>
        {tFn("En attente", "Pending")}
      </StatusBadge>
    );
  if (status === "simulated")
    return <StatusBadge tone="blue">{tFn("Mode simulé", "Simulated mode")}</StatusBadge>;
  return (
    <StatusBadge tone="gray" dot>
      {tFn("Non configuré", "Not configured")}
    </StatusBadge>
  );
}

function CapabilityBadge({ type, label }: AccessCapability) {
  if (type === "read") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200">
        <svg
          className="h-2.5 w-2.5"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 3a5 5 0 100 10A5 5 0 008 3zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" />
          <path d="M8 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
        </svg>
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700 ring-1 ring-success-200">
      <svg
        className="h-2.5 w-2.5"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M11.986 3H8a4 4 0 100 8h3.986a4 4 0 000-8zM8 5a2 2 0 100 4h3.986a2 2 0 000-4H8z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function ConnectorAccessCard({
  id,
  label,
  color,
  icon,
  description,
  where,
  capabilities,
  fields,
  status,
  config,
  onSave,
  envHint,
  comingSoon,
  oauthUrl,
}: ConnectorAccessCardProps) {
  const t = useT();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [showWhere, setShowWhere] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Initialize field values
  const initialValues = () => {
    const vals: Record<string, string> = {};
    for (const field of fields) {
      // Never pre-fill secrets; show placeholder if already saved
      vals[field.key] = field.secret ? "" : (config[field.key] ?? "");
    }
    return vals;
  };

  const [values, setValues] = useState<Record<string, string>>(initialValues);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await onSave(id, values);
      setFeedback({
        ok: result.ok,
        msg: result.ok
          ? t("Configuration enregistrée avec succès.", "Configuration saved successfully.")
          : result.error ?? t("Une erreur est survenue.", "An error occurred."),
      });
      if (result.ok) setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const readCaps = capabilities.filter((c) => c.type === "read");
  const writeCaps = capabilities.filter((c) => c.type === "write");

  return (
    <div className="card overflow-hidden">
      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 p-5">
        {/* Logo / couleur */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: color }}
          aria-hidden="true"
        >
          {icon ? (
            <span className="text-base font-bold leading-none">{icon}</span>
          ) : (
            <span
              className="h-4 w-4 rounded-full bg-white/30"
              style={{ background: `${color}50` }}
            />
          )}
        </div>

        {/* Infos */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-ink">{label}</h3>
            {comingSoon ? (
              <span className="chip">{t("Bientôt", "Coming soon")}</span>
            ) : (
              statusBadge(status, t)
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>

          {/* Capacités */}
          {!comingSoon && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {readCaps.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {readCaps.map((cap) => (
                    <CapabilityBadge key={cap.label} {...cap} />
                  ))}
                </div>
              )}
              {writeCaps.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {writeCaps.map((cap) => (
                    <CapabilityBadge key={cap.label} {...cap} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Boutons : Connexion automatique (OAuth) + Configurer */}
        <div className="flex shrink-0 flex-col gap-1.5">
          {!comingSoon && oauthUrl && (
            canEdit ? (
              <a href={oauthUrl} className="btn-primary whitespace-nowrap text-xs">
                ⚡ {t("Connexion auto", "Auto connect")}
              </a>
            ) : (
              <button type="button" disabled title={t("Lecture seule", "View only")} className="btn-primary whitespace-nowrap text-xs opacity-50">
                ⚡ {t("Connexion auto", "Auto connect")}
              </button>
            )
          )}
          {!comingSoon && (fields.length > 0 || envHint) && (
            <button
              type="button"
              onClick={() => {
                setOpen((v) => !v);
                setFeedback(null);
              }}
              className="btn-secondary text-xs"
            >
              {open ? t("Fermer", "Close") : oauthUrl ? t("Manuel", "Manual") : t("Configurer", "Configure")}
            </button>
          )}
        </div>
      </div>

      {/* ── Panneau de configuration (dépliable) ─────────────────────── */}
      {open && (
        <div className="border-t border-hair bg-canvas/40 px-5 pb-5 pt-4 animate-fade-in">
          {/* Envhint (connecteurs sans champs directs) */}
          {envHint && (
            <div className="mb-4 rounded-lg border border-hair bg-card px-4 py-3 text-xs text-muted leading-relaxed">
              <span className="font-semibold text-ink">{t("Configuration via variables d'environnement :", "Configuration via environment variables:")} </span>
              {envHint}
            </div>
          )}

          {/* Lien "où trouver" */}
          {where && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowWhere((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
              >
                <svg
                  className={`h-3 w-3 transition-transform ${showWhere ? "rotate-90" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {showWhere ? t("Masquer les instructions", "Hide instructions") : t("Où trouver ces informations ?", "Where to find this information?")}
              </button>
              {showWhere && (
                <p className="mt-2 rounded-lg border border-hair bg-card px-3 py-2.5 text-xs text-muted leading-relaxed">
                  {where}
                </p>
              )}
            </div>
          )}

          {/* Formulaire champs */}
          {fields.length > 0 && onSave && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {fields.map((field) => {
                const isSecret = field.secret ?? false;
                const hadValue = isSecret && config[field.key] === "__secret__";
                return (
                  <div key={field.key} className="space-y-1">
                    <label
                      className="block text-xs font-medium text-ink"
                      htmlFor={`${id}-${field.key}`}
                    >
                      {field.label}
                      {isSecret && (
                        <span className="ml-1.5 rounded bg-warning-50 px-1 py-0.5 text-2xs font-semibold text-warning-700">
                          secret
                        </span>
                      )}
                    </label>
                    <input
                      id={`${id}-${field.key}`}
                      type={isSecret ? "password" : "text"}
                      className="input w-full"
                      value={values[field.key]}
                      placeholder={
                        hadValue
                          ? t("••••••••  (déjà enregistré — laisser vide pour conserver)", "••••••••  (already saved — leave blank to keep)")
                          : (field.placeholder ?? "")
                      }
                      autoComplete={isSecret ? "new-password" : "off"}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                    {field.help && (
                      <p className="text-2xs text-muted">{field.help}</p>
                    )}
                  </div>
                );
              })}

              {feedback && (
                <p
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${
                    feedback.ok
                      ? "bg-success-50 text-success-700"
                      : "bg-danger-50 text-danger-700"
                  }`}
                >
                  {feedback.msg}
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving || !canEdit}
                  title={!canEdit ? t("Lecture seule", "View only") : undefined}
                  className="btn-primary disabled:opacity-60 text-xs"
                >
                  {saving ? t("Enregistrement…", "Saving…") : t("Enregistrer", "Save")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
