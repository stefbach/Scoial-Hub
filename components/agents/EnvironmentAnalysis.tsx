"use client";

/**
 * EnvironmentAnalysis — affiche l'analyse d'environnement professionnelle et
 * sémantique produite par l'agent Stratège.
 * Design compact et lisible, cohérent avec le design system AXON-AI.
 */

import type { EnvironmentAnalysis as IEnvironmentAnalysis } from "@/lib/agents/types";

interface EnvironmentAnalysisProps {
  analysis: IEnvironmentAnalysis;
}

export function EnvironmentAnalysis({ analysis }: EnvironmentAnalysisProps) {
  return (
    <div className="card overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center gap-2 border-b border-hair px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 border border-primary-200">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-primary-700">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-ink">Analyse d'environnement</span>
        <span className="ml-auto inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700 ring-1 ring-primary-200">
          Pro + Sémantique
        </span>
      </div>

      <div className="divide-y divide-hair">
        {/* Marché & concurrence */}
        <Section
          icon={<MarketIcon />}
          iconBg="bg-primary-50 border-primary-200 text-primary-700"
          title="Marché & concurrence"
        >
          <p className="text-xs leading-relaxed text-ink">{analysis.marketOverview}</p>
        </Section>

        {/* Analyse sémantique */}
        <Section
          icon={<SemanticsIcon />}
          iconBg="bg-ai-textbg border-blue-200 text-ai-text"
          title="Analyse sémantique & intentions"
        >
          <p className="text-xs leading-relaxed text-ink">{analysis.semanticAnalysis}</p>
        </Section>

        {/* Positionnement */}
        <Section
          icon={<TargetIcon />}
          iconBg="bg-success-50 border-success-200 text-success-700"
          title="Positionnement recommandé"
        >
          <p className="text-xs leading-relaxed text-ink">{analysis.positioning}</p>
        </Section>

        {/* Angles d'acquisition */}
        <Section
          icon={<AcquisitionIcon />}
          iconBg="bg-warning-50 border-warning-200 text-warning-700"
          title="Angles d'acquisition"
        >
          <ul className="space-y-1">
            {analysis.acquisitionAngles.map((angle, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-ink">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-400" />
                {angle}
              </li>
            ))}
          </ul>
        </Section>

        {/* Plateformes recommandées */}
        <Section
          icon={<PlatformIcon />}
          iconBg="bg-ai-visualbg border-violet-200 text-ai-visual"
          title="Plateformes recommandées"
        >
          <ul className="space-y-1">
            {analysis.recommendedPlatforms.map((platform, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-ink">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ai-visual" />
                {platform}
              </li>
            ))}
          </ul>
        </Section>

        {/* Risques concurrentiels */}
        <Section
          icon={<RiskIcon />}
          iconBg="bg-danger-50 border-danger-200 text-danger-700"
          title="Risques concurrentiels"
        >
          <p className="text-xs leading-relaxed text-ink">{analysis.competitiveRisks}</p>
        </Section>
      </div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function Section({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${iconBg}`}
        >
          {icon}
        </div>
        <span className="text-xs font-semibold text-ink">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Icônes ─────────────────────────────────────────────────────────────────────

function MarketIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function SemanticsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function AcquisitionIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
    </svg>
  );
}

function PlatformIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 17H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
    </svg>
  );
}

function RiskIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}
