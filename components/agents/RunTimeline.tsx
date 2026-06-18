"use client";

/**
 * RunTimeline — affiche la séquence des étapes d'une orchestration IA.
 * Affiche également :
 *  - L'analyse d'environnement (pro + sémantique) via EnvironmentAnalysis
 *  - Le benchmark sectoriel (KPIs cibles vs sectoriels) via BenchmarkCard
 *  - La cadence retenue et la projection de captation d'audience
 *  - La conformité (verdict + détail)
 *  - Le contenu final généré
 *  - Des boutons "Enregistrer comme brouillon" et "Créer la campagne" pour
 *    persister le résultat dans Supabase (visible dans les pages Scheduled/Campaigns).
 */

import { useState, useCallback } from "react";
import type { AgentRunResult, AgentId, AgentStepStatus, Cadence, PublisherResult } from "@/lib/agents/types";
import { AGENTS } from "@/lib/agents/roster";
import { PRO_PROFILES } from "@/lib/agents/profiles";
import { EnvironmentAnalysis } from "./EnvironmentAnalysis";
import { BenchmarkCard } from "./BenchmarkCard";
import { Toast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { generateVideoPolling } from "@/lib/ai/generate-video-client";

// ── Couleurs d'accent par agent ────────────────────────────────────────────

const ICON_BG: Record<AgentId, string> = {
  orchestrator: "bg-primary-50 border-primary-200 text-primary-700",
  strategist:   "bg-primary-50 border-primary-100 text-primary-600",
  copywriter:   "bg-ai-textbg border-blue-200 text-ai-text",
  creative:     "bg-ai-visualbg border-violet-200 text-ai-visual",
  media_buyer:  "bg-warning-50 border-warning-200 text-warning-700",
  analyst:      "bg-success-50 border-success-200 text-success-700",
  compliance:   "bg-danger-50 border-danger-200 text-danger-700",
  publisher:    "bg-indigo-50 border-indigo-200 text-indigo-700",
};

// ── Statuts ────────────────────────────────────────────────────────────────

type StatusStyleBase = { dot: string; labelCls: string };
const STATUS_STYLES_BASE: Record<AgentStepStatus, StatusStyleBase> = {
  done:      { dot: "bg-success-500",           labelCls: "text-success-700" },
  running:   { dot: "bg-ai-text animate-pulse",  labelCls: "text-ai-text" },
  blocked:   { dot: "bg-danger-500",             labelCls: "text-danger-700" },
  simulated: { dot: "bg-warning-500",            labelCls: "text-warning-700" },
};

// ── Icônes SVG par agent ───────────────────────────────────────────────────

const AGENT_ICON: Record<AgentId, React.ReactNode> = {
  orchestrator: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  ),
  strategist: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
  copywriter: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  creative: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  ),
  media_buyer: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM7 13a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
    </svg>
  ),
  analyst: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
    </svg>
  ),
  compliance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  publisher: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
  ),
};

// ── Verdict conformité ─────────────────────────────────────────────────────

function ComplianceBanner({
  verdict,
}: {
  verdict: "pass" | "warn" | "block";
}) {
  const t = useT();
  const config = {
    pass: {
      bg: "bg-success-50 border-success-200",
      icon: "✅",
      title: t("Contenu conforme", "Content compliant"),
      text: t(
        "Le contenu a passé tous les contrôles ANSM et Meta. Il peut être publié.",
        "Content passed all ANSM and Meta checks. It is ready to publish."
      ),
      titleCls: "text-success-700",
    },
    warn: {
      bg: "bg-warning-50 border-warning-200",
      icon: "⚠️",
      title: t("Avertissements de conformité", "Compliance warnings"),
      text: t(
        "Des points d'attention ont été identifiés. Une révision manuelle est recommandée avant publication.",
        "Some issues were flagged. Manual review is recommended before publishing."
      ),
      titleCls: "text-warning-700",
    },
    block: {
      bg: "bg-danger-50 border-danger-200",
      icon: "🚫",
      title: t("Contenu bloqué — Non conforme", "Content blocked — Non-compliant"),
      text: t(
        "Le contenu a été bloqué pour non-conformité réglementaire (ANSM / Meta). Aucune publication ni campagne ne sera créée.",
        "Content was blocked due to regulatory non-compliance (ANSM / Meta). No post or campaign will be created."
      ),
      titleCls: "text-danger-700",
    },
  }[verdict];

  return (
    <div className={`rounded-lg border p-3 ${config.bg}`}>
      <div className={`flex items-center gap-2 font-semibold text-sm ${config.titleCls}`}>
        <span>{config.icon}</span>
        {config.title}
      </div>
      <p className="mt-1 text-xs text-muted">{config.text}</p>
    </div>
  );
}

// ── Galerie de visuels générés (Creative) ─────────────────────────────────

function GeneratedAssetsCard({
  images,
  video,
}: {
  images?: { url: string }[];
  video?: { url: string };
}) {
  const t = useT();
  if ((!images || images.length === 0) && !video) return null;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-hair px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ai-visualbg">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-ai-visual">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-ink">
          {t("Visuels générés par l'agent Créatif", "Visuals generated by the Creative agent")}
        </span>
        <span className="ml-auto inline-flex items-center rounded-full bg-ai-visualbg px-2 py-0.5 text-2xs font-semibold text-ai-visual ring-1 ring-ai-visual/20">
          Replicate IA
        </span>
      </div>
      <div className="p-4 space-y-3">
        {images && images.length > 0 && (
          <div>
            <div className="section-label mb-2">{t("Images", "Images")}</div>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <a
                  key={i}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block overflow-hidden rounded-lg border border-hair bg-canvas hover:border-ai-visual transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={t(`Visuel généré ${i + 1}`, `Generated visual ${i + 1}`)}
                    className="h-32 w-32 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-full p-1.5 text-center text-2xs text-white font-semibold">
                      {t("Ouvrir", "Open")}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
        {video && (
          <div>
            <div className="section-label mb-2">{t("Vidéo", "Video")}</div>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-ai-visual/30 bg-ai-visualbg px-3 py-2 text-xs font-medium text-ai-visual hover:bg-ai-visualbg/80 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553.106A1 1 0 0014 7v6a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
              {t("Visionner la vidéo générée", "Watch the generated video")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Résultat de publication (Publisher) ───────────────────────────────────

function PublisherResultCard({ publisherResult }: { publisherResult: PublisherResult }) {
  const t = useT();
  const statusConfig: Record<
    PublisherResult["status"],
    { bg: string; icon: string; title: string; labelCls: string }
  > = {
    published: {
      bg: "bg-success-50 border-success-200",
      icon: "✅",
      title: t("Contenu publié", "Content published"),
      labelCls: "text-success-700",
    },
    scheduled: {
      bg: "bg-success-50 border-success-200",
      icon: "📅",
      title: t("Publication programmée", "Scheduled publication"),
      labelCls: "text-success-700",
    },
    pending: {
      bg: "bg-canvas border-hair",
      icon: "⏳",
      title: t("En attente de validation", "Pending validation"),
      labelCls: "text-muted",
    },
    simulated: {
      bg: "bg-warning-50 border-warning-200",
      icon: "⚠️",
      title: t("Publication simulée — connecteurs requis", "Simulated publication — connectors required"),
      labelCls: "text-warning-700",
    },
    blocked: {
      bg: "bg-danger-50 border-danger-200",
      icon: "🚫",
      title: t("Publication bloquée", "Publication blocked"),
      labelCls: "text-danger-700",
    },
  };

  const conf = statusConfig[publisherResult.status];

  return (
    <div className={`rounded-lg border p-3 ${conf.bg}`}>
      <div className={`flex flex-wrap items-center gap-2 font-semibold text-sm ${conf.labelCls}`}>
        <span>{conf.icon}</span>
        <span className="min-w-0 break-words">{conf.title}</span>
        {publisherResult.platforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {publisherResult.platforms.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-full bg-white/60 px-2 py-0.5 text-2xs font-semibold ring-1 ring-current/20"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{publisherResult.message}</p>
      {publisherResult.scheduledAt && (
        <p className="mt-1 text-2xs text-muted">
          {t("Programmé le :", "Scheduled for:")} {new Date(publisherResult.scheduledAt).toLocaleString("fr-FR")}
        </p>
      )}
    </div>
  );
}

// ── Boutons Appliquer (Brouillon + Campagne) ───────────────────────────────

interface ApplyActionsProps {
  result: AgentRunResult;
  companyId: string;
}

type ToastInfo = { message: string; kind: "success" | "error" };

function ApplyActions({ result, companyId }: ApplyActionsProps) {
  const t = useT();
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [campaignSaved, setCampaignSaved] = useState(false);

  const showToast = useCallback((message: string, kind: "success" | "error") => {
    setToast({ message, kind });
  }, []);

  const isDraftDisabled =
    savingDraft || draftSaved || !result.finalOutput || result.complianceVerdict === "block";

  const draftDisabledReason =
    !result.finalOutput
      ? t("Aucun contenu généré à enregistrer.", "No generated content to save.")
      : result.complianceVerdict === "block"
      ? t("Contenu bloqué par la conformité — impossible d'enregistrer.", "Content blocked by compliance — cannot save.")
      : undefined;

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      // Dérive un titre court depuis l'objectif (50 chars max)
      const title = result.objective.length > 50
        ? result.objective.slice(0, 47) + "…"
        : result.objective;

      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          platform: "facebook",
          title,
          body: result.finalOutput,
          status: "draft",
          source: "automation",
          automationName: "Agent IA",
          date: "",
          time: "",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      setDraftSaved(true);
      showToast(t("Brouillon enregistré — visible dans Scheduled.", "Draft saved — visible in Scheduled."), "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("Erreur lors de l'enregistrement.", "Error while saving."),
        "error"
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleCreateCampaign() {
    setSavingCampaign(true);
    try {
      // Nom de la campagne : profil + objectif tronqué
      const profileLabel = result.profileId
        ? PRO_PROFILES.find((p) => p.id === result.profileId)?.label
        : undefined;
      const baseName = profileLabel
        ? `[${profileLabel}] ${result.objective}`
        : result.objective;
      const name = baseName.length > 80 ? baseName.slice(0, 77) + "…" : baseName;

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name,
          objective: result.objective,
          status: "paused",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }

      setCampaignSaved(true);
      showToast(t("Campagne créée — visible dans Campaigns.", "Campaign created — visible in Campaigns."), "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("Erreur lors de la création de la campagne.", "Error while creating the campaign."),
        "error"
      );
    } finally {
      setSavingCampaign(false);
    }
  }

  return (
    <>
      <div className="card p-4">
        <div className="section-label mb-3">{t("Appliquer le résultat", "Apply result")}</div>
        <div className="flex flex-wrap gap-2">
          {/* Bouton Brouillon */}
          <div className="relative group/tip">
            <button
              type="button"
              disabled={isDraftDisabled}
              onClick={handleSaveDraft}
              className={[
                "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-[0.4rem]",
                "text-sm font-medium select-none transition-all duration-[120ms]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
                "disabled:pointer-events-none disabled:opacity-50",
                draftSaved
                  ? "border border-success-200 bg-success-50 text-success-700"
                  : "border border-hair bg-card text-ink shadow-xs hover:bg-canvas hover:border-[#cac4b9] hover:shadow-sm active:scale-[0.975]",
              ].join(" ")}
            >
              {savingDraft ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : draftSaved ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z" />
                </svg>
              )}
              {draftSaved
                ? t("Brouillon enregistré", "Draft saved")
                : t("Enregistrer comme brouillon", "Save as draft")}
            </button>
            {/* Tooltip si désactivé */}
            {draftDisabledReason && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-2xs text-white shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-nowrap">
                {draftDisabledReason}
              </div>
            )}
          </div>

          {/* Bouton Campagne */}
          <button
            type="button"
            disabled={savingCampaign || campaignSaved}
            onClick={handleCreateCampaign}
            className={[
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-[0.4rem]",
              "text-sm font-medium select-none transition-all duration-[120ms]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
              campaignSaved
                ? "border border-success-200 bg-success-50 text-success-700"
                : "bg-page text-white shadow-sm hover:bg-[#1e3e65] active:scale-[0.975]",
            ].join(" ")}
          >
            {savingCampaign ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : campaignSaved ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
            )}
            {campaignSaved
              ? t("Campagne créée", "Campaign created")
              : t("Créer la campagne", "Create campaign")}
          </button>
        </div>
        <p className="mt-2 text-2xs text-muted">
          {t(
            "Les entrées créées apparaîtront immédiatement dans les pages",
            "Created entries will appear immediately in the"
          )}{" "}
          <span className="font-medium text-ink">Scheduled</span>{" "}
          {t("et", "and")}{" "}
          <span className="font-medium text-ink">Campaigns</span>
          {t(" pages.", " pages.")}
        </p>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

// ── Studio visuels (génération à la demande) + export campagne ──────────────

function buildCampaignExport(result: AgentRunResult): string {
  const lines: string[] = [];
  lines.push(`# Campagne — ${result.objective}`);
  lines.push(`Autonomie : ${result.autonomy} · Conformité : ${result.complianceVerdict}`);
  if (result.finalOutput) lines.push(`\n## Contenu final\n${result.finalOutput}`);
  if (result.imagePrompt) lines.push(`\n## Prompt image\n${result.imagePrompt}`);
  if (result.videoPrompt) lines.push(`\n## Prompt vidéo\n${result.videoPrompt}`);
  lines.push(`\n## Étapes des agents`);
  for (const s of result.steps) lines.push(`\n### ${s.title} — [${s.status}]\n${s.output ?? ""}`);
  return lines.join("\n");
}

function CreativeStudioCard({ result }: { result: AgentRunResult }) {
  const t = useT();
  const [img, setImg] = useState<string | null>(null);
  const [imgState, setImgState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [vid, setVid] = useState<string | null>(null);
  const [vidState, setVidState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function genImage() {
    if (!result.imagePrompt) return;
    setImgState("loading"); setMsg(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: result.imagePrompt, format: "square", platform: "instagram" }),
      });
      const d = await r.json();
      const first = Array.isArray(d.images) ? d.images[0] : undefined;
      const url = typeof first === "string" ? first : first?.url;
      if (d.simulated || !url) { setImgState("failed"); setMsg(d.message ?? t("Image indisponible (REPLICATE_API_TOKEN ?).", "Image unavailable (REPLICATE_API_TOKEN?).")); return; }
      setImg(url); setImgState("done");
    } catch { setImgState("failed"); setMsg(t("Erreur réseau.", "Network error.")); }
  }

  async function genVideo() {
    if (!result.videoPrompt) return;
    setVidState("loading"); setMsg(null);
    try {
      const r = await generateVideoPolling({ prompt: result.videoPrompt, platform: "tiktok" });
      if (r.simulated || !r.url) {
        setVidState("failed");
        setMsg(
          r.error === "timeout"
            ? t("La vidéo prend trop de temps. Réessayez.", "Video is taking too long. Try again.")
            : t("Vidéo indisponible (REPLICATE_API_TOKEN ?).", "Video unavailable (REPLICATE_API_TOKEN?).")
        );
        return;
      }
      setVid(r.url); setVidState("done");
    } catch { setVidState("failed"); setMsg(t("Erreur réseau.", "Network error.")); }
  }

  function exportCampaign() {
    const blob = new Blob([buildCampaignExport(result)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "campagne.md";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="section-label">{t("Visuels & export", "Visuals & export")}</span>
        <button className="btn-secondary text-2xs" onClick={exportCampaign}>⬇ {t("Exporter la campagne", "Export campaign")}</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Image */}
        {result.imagePrompt && (
          <div className="rounded-lg border border-hair bg-canvas p-3">
            <p className="mb-2 text-2xs text-muted line-clamp-2">🎨 {result.imagePrompt}</p>
            {imgState !== "done" && (
              <button className="btn-primary w-full justify-center text-2xs" onClick={genImage} disabled={imgState === "loading"}>
                {imgState === "loading" ? t("Génération…", "Generating…") : t("Générer l'image", "Generate image")}
              </button>
            )}
            {img && (
              <div className="space-y-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="visuel" className="w-full rounded-lg border border-hair" />
                <a href={img} download target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center text-2xs">⬇ {t("Télécharger", "Download")}</a>
              </div>
            )}
          </div>
        )}
        {/* Vidéo */}
        {result.videoPrompt && (
          <div className="rounded-lg border border-hair bg-canvas p-3">
            <p className="mb-2 text-2xs text-muted line-clamp-2">🎬 {result.videoPrompt}</p>
            {vidState !== "done" && (
              <button className="btn-primary w-full justify-center text-2xs" onClick={genVideo} disabled={vidState === "loading"}>
                {vidState === "loading" ? t("Génération… (peut prendre ~1 min)", "Generating… (~1 min)") : t("Générer la vidéo", "Generate video")}
              </button>
            )}
            {vid && (
              <div className="space-y-1.5">
                <video src={vid} controls className="w-full rounded-lg border border-hair" />
                <a href={vid} download target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-center text-2xs">⬇ {t("Télécharger", "Download")}</a>
              </div>
            )}
          </div>
        )}
      </div>
      {msg && <p className="text-2xs text-warning-700">{msg}</p>}
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

interface RunTimelineProps {
  result: AgentRunResult;
  /** UUID Supabase de la company active — requis pour POST /api/* */
  companyId: string;
}

export function RunTimeline({ result, companyId }: RunTimelineProps) {
  const t = useT();

  const AUTONOMY_LABEL: Record<number, string> = {
    1: t("Recommandation pure", "Pure recommendation"),
    2: t("Semi-automatique", "Semi-automatic"),
    3: t("Automatique (garde-fous)", "Automatic (guardrails)"),
  };

  const PERIOD_LABELS: Record<Required<Cadence>["reportingPeriod"], string> = {
    day: t("Journalier", "Daily"),
    week: t("Hebdomadaire", "Weekly"),
    month: t("Mensuel", "Monthly"),
    quarter: t("Trimestriel", "Quarterly"),
    year: t("Annuel", "Annual"),
  };

  type DayEntry = { labelFr: string; labelEn: string };
  const DAY_NAMES: DayEntry[] = [
    { labelFr: "Dim", labelEn: "Sun" },
    { labelFr: "Lun", labelEn: "Mon" },
    { labelFr: "Mar", labelEn: "Tue" },
    { labelFr: "Mer", labelEn: "Wed" },
    { labelFr: "Jeu", labelEn: "Thu" },
    { labelFr: "Ven", labelEn: "Fri" },
    { labelFr: "Sam", labelEn: "Sat" },
  ];

  const STATUS_LABELS: Record<AgentStepStatus, string> = {
    done:      t("Terminé", "Done"),
    running:   t("En cours", "Running"),
    blocked:   t("Bloqué", "Blocked"),
    simulated: t("Simulé", "Simulated"),
  };

  const autonomyLabel = AUTONOMY_LABEL[result.autonomy] ?? "";

  // Résolution du profil affiché
  const profile = result.profileId
    ? PRO_PROFILES.find((p) => p.id === result.profileId)
    : undefined;

  // Cadence résolue
  const cadence = result.cadence;
  const cadenceSummary = cadence
    ? [
        t(`${cadence.postingPerDay ?? 1} publ./jour`, `${cadence.postingPerDay ?? 1} posts/day`),
        cadence.postingDays
          ? cadence.postingDays.map((d) => {
              const entry = DAY_NAMES[d];
              return entry ? t(entry.labelFr, entry.labelEn) : String(d);
            }).join(", ")
          : t("Lun–Ven", "Mon–Fri"),
        cadence.postingHours ? cadence.postingHours.join(" / ") : "08:00 / 19:00",
        t(`Reporting ${PERIOD_LABELS[cadence.reportingPeriod] ?? cadence.reportingPeriod}`, `${PERIOD_LABELS[cadence.reportingPeriod] ?? cadence.reportingPeriod} reporting`),
      ].join(" · ")
    : null;

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── En-tête du run ─────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="section-label mb-1">{t("Objectif piloté", "Managed objective")}</div>
            <p className="text-sm font-medium text-ink">&ldquo;{result.objective}&rdquo;</p>

            {/* Profil + cadence */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile && (
                <span className="inline-flex max-w-full items-center whitespace-normal break-words rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200">
                  {profile.label}
                </span>
              )}
              {cadenceSummary && (
                <span className="inline-flex max-w-full items-center whitespace-normal break-words rounded-full bg-canvas px-2 py-0.5 text-2xs font-semibold text-muted ring-1 ring-hair">
                  {cadenceSummary}
                </span>
              )}
              {result.benchmarkTarget && (
                <span className="inline-flex max-w-full items-center whitespace-normal break-words rounded-full bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700 ring-1 ring-success-200">
                  {t("Benchmark :", "Benchmark:")} {result.benchmarkTarget}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {result.mock && (
              <span className="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-2xs font-semibold text-muted ring-1 ring-hair">
                {t("Mode mock", "Mock mode")}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-ai-textbg px-2 py-0.5 text-2xs font-semibold text-ai-text ring-1 ring-ai-text/20">
              {t(`Autonomie N${result.autonomy} · ${autonomyLabel}`, `Autonomy L${result.autonomy} · ${autonomyLabel}`)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions Appliquer (brouillon + campagne) ───────────────── */}
      <ApplyActions result={result} companyId={companyId} />

      {/* ── Verdict conformité ─────────────────────────────────────── */}
      {result.complianceVerdict && (
        <ComplianceBanner verdict={result.complianceVerdict} />
      )}

      {/* ── Analyse d'environnement ─────────────────────────────────── */}
      {result.environmentAnalysis && (
        <EnvironmentAnalysis analysis={result.environmentAnalysis} />
      )}

      {/* ── Benchmark sectoriel ─────────────────────────────────────── */}
      {result.benchmark && (
        <BenchmarkCard benchmark={result.benchmark} cadence={result.cadence} />
      )}

      {/* ── Visuels générés par Creative ────────────────────────────── */}
      {(result.generatedImages || result.generatedVideo) && (
        <GeneratedAssetsCard
          images={result.generatedImages}
          video={result.generatedVideo}
        />
      )}

      {/* ── Studio visuels (à la demande) + export campagne ─────────── */}
      {(result.imagePrompt || result.videoPrompt) && (
        <CreativeStudioCard result={result} />
      )}

      {/* ── Résultat Publisher ──────────────────────────────────────── */}
      {result.publisherResult && (
        <PublisherResultCard publisherResult={result.publisherResult} />
      )}

      {/* ── Timeline des étapes ─────────────────────────────────────── */}
      <div className="card divide-y divide-hair overflow-hidden">
        <div className="px-4 py-3">
          <span className="section-label">{t("Séquence d'exécution", "Execution sequence")}</span>
          <span className="ml-2 text-2xs text-muted">({result.steps.length} {t("étapes", "steps")})</span>
        </div>
        {result.steps.map((step, idx) => {
          const agentDef = AGENTS.find((a) => a.id === step.agent);
          const statusBase = STATUS_STYLES_BASE[step.status];
          const statusLabel = STATUS_LABELS[step.status];
          const iconBg = ICON_BG[step.agent];

          return (
            <div key={idx} className="group px-4 py-3 hover:bg-canvas/50">
              <div className="flex items-start gap-3">
                {/* Icône agent */}
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs ${iconBg}`}
                    title={agentDef ? t(agentDef.name, agentDef.nameEn) : undefined}
                  >
                    {AGENT_ICON[step.agent]}
                  </div>
                  {idx < result.steps.length - 1 && (
                    <div className="h-full w-px bg-hair" />
                  )}
                </div>

                {/* Contenu de l'étape */}
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-2xs font-semibold uppercase text-muted tracking-wide">
                      {agentDef ? t(agentDef.name, agentDef.nameEn) : step.agent}
                    </span>
                    <span className="min-w-0 break-words text-sm font-medium text-ink">{step.title}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${
                      step.status === "done"      ? "bg-success-50 text-success-700 ring-1 ring-success-500/20"
                      : step.status === "running"  ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/20"
                      : step.status === "blocked"  ? "bg-danger-50 text-danger-700 ring-1 ring-danger-500/20"
                      : /* simulated */              "bg-warning-50 text-warning-700 ring-1 ring-warning-500/20"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusBase.dot}`} />
                      {statusLabel}
                    </span>
                  </div>

                  <pre className="mt-1.5 whitespace-pre-wrap rounded-md bg-canvas px-3 py-2 text-xs text-ink leading-relaxed border border-hair">
                    {step.output}
                  </pre>

                  {step.detail && (
                    <p className="mt-1.5 text-2xs text-muted italic border-l-2 border-hair pl-2">
                      {step.detail}
                    </p>
                  )}

                  {step.finishedAt && (
                    <p className="mt-1 text-2xs text-muted/60">
                      {new Date(step.finishedAt).toLocaleTimeString("fr-FR")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Contenu final généré ─────────────────────────────────────── */}
      {result.finalOutput ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-hair px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ai-textbg">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-ai-text">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-ink">{t("Contenu final généré", "Final generated content")}</span>
            </div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${
              result.autonomy === 1
                ? "bg-canvas text-muted ring-1 ring-hair"
                : result.autonomy === 2
                ? "bg-warning-50 text-warning-700 ring-1 ring-warning-500/20"
                : "bg-success-50 text-success-700 ring-1 ring-success-500/20"
            }`}>
              {result.autonomy === 1
                ? t("Recommandation non publiée", "Unpublished recommendation")
                : result.autonomy === 2
                ? t("En attente de validation", "Pending validation")
                : t("Prêt à publier", "Ready to publish")}
            </span>
          </div>
          <div className="p-4">
            <pre className="whitespace-pre-wrap rounded-lg border border-hair bg-canvas p-4 text-sm text-ink leading-relaxed">
              {result.finalOutput}
            </pre>
            <div className="mt-3 text-2xs text-muted">
              {result.autonomy === 1 &&
                t(
                  "Autonomie N1 — Aucune publication ni campagne initiée. Copiez ce contenu pour le publier manuellement.",
                  "Autonomy L1 — No post or campaign initiated. Copy this content to publish it manually."
                )}
              {result.autonomy === 2 &&
                t(
                  "Autonomie N2 — Validez ce contenu puis activez la campagne manuellement dans Meta Business Manager.",
                  "Autonomy L2 — Validate this content then activate the campaign manually in Meta Business Manager."
                )}
              {result.autonomy === 3 &&
                t(
                  "Autonomie N3 — Contenu conforme et budget validé. Connectez Meta Ads API pour activer la publication automatique.",
                  "Autonomy L3 — Content compliant and budget validated. Connect Meta Ads API to enable automatic publishing."
                )}
            </div>
          </div>
        </div>
      ) : (
        result.complianceVerdict === "block" && (
          <div className="card border-danger-200 bg-danger-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-danger-700">
              <span>🚫</span>
              <span>{t("Publication bloquée", "Publication blocked")}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {t(
                "Le contenu n'a pas passé la vérification de conformité. Aucune publication ni campagne n'a été générée. Révisez l'objectif ou le contenu et relancez un pilotage.",
                "Content did not pass the compliance check. No post or campaign was generated. Revise the objective or content and start a new run."
              )}
            </p>
          </div>
        )
      )}
    </div>
  );
}
