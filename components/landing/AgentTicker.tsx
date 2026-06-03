"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

type Line = { agent: string; textFr: string; textEn: string; accent: string };

// Flux simulé d'actions d'agents — donne l'impression d'un cerveau au travail.
const STREAM: Line[] = [
  { agent: "Orchestrateur", textFr: "Objectif reçu — découpage en 6 tâches", textEn: "Objective received — broken into 6 tasks", accent: "59,113,243" },
  { agent: "Stratège", textFr: "Analyse sémantique du marché téléconsultation FR…", textEn: "Semantic analysis of the teleconsultation market FR…", accent: "37,99,235" },
  { agent: "Stratège", textFr: "Audience cible identifiée : 38–55 ans, intention santé", textEn: "Target audience identified: 38–55 y.o., health intent", accent: "37,99,235" },
  { agent: "Copywriter", textFr: "Génération de 4 variantes de hook (brand voice Tibok)", textEn: "Generating 4 hook variants (Tibok brand voice)", accent: "59,113,243" },
  { agent: "Creative", textFr: "Brief visuel — format 9:16 Stories + reel 8s", textEn: "Visual brief — 9:16 Stories + 8s reel format", accent: "124,58,237" },
  { agent: "Conformité", textFr: "Contrôle ANSM / politiques Meta santé… ✓ conforme", textEn: "ANSM / Meta health policy check… ✓ compliant", accent: "16,185,129" },
  { agent: "Media Buyer", textFr: "Configuration campagne Meta — 50 €/j, plafond OK", textEn: "Meta campaign setup — €50/day, cap OK", accent: "245,158,11" },
  { agent: "Analyste", textFr: "Benchmark secteur : CTR cible 2,1 % · CPA 14 €", textEn: "Industry benchmark: target CTR 2.1% · CPA €14", accent: "16,185,129" },
  { agent: "Analyste", textFr: "Projection : +1 240 audience captée / 30 j", textEn: "Projection: +1,240 captured audience / 30 days", accent: "16,185,129" },
  { agent: "Orchestrateur", textFr: "Recommandation prête — en attente de validation", textEn: "Recommendation ready — awaiting approval", accent: "59,113,243" },
];

export function AgentTicker() {
  const [lines, setLines] = useState<Line[]>([STREAM[0]]);
  const idx = useRef(1);
  const t = useT();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLines(STREAM);
      return;
    }
    const id = setInterval(() => {
      setLines((prev) => {
        const next = [...prev, STREAM[idx.current % STREAM.length]];
        idx.current += 1;
        return next.slice(-6);
      });
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card overflow-hidden rounded-2xl p-4 font-mono text-xs">
      <div className="mb-3 flex items-center gap-2 text-muted">
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-danger-500/70" />
          <span className="h-2 w-2 rounded-full bg-warning-500/70" />
          <span className="h-2 w-2 rounded-full bg-success-500/70" />
        </span>
        <span className="ml-1">{t("agents · activité en direct", "agents · live activity")}</span>
        <span className="ml-auto flex items-center gap-1.5 text-success-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" /> live
        </span>
      </div>
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div
            key={`${l.agent}-${i}`}
            className="flex animate-[swap_400ms_ease-out] items-start gap-2"
          >
            <span
              className="mt-px shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-semibold"
              style={{ background: `rgba(${l.accent},0.12)`, color: `rgb(${l.accent})` }}
            >
              {l.agent}
            </span>
            <span className="leading-relaxed text-muted">{t(l.textFr, l.textEn)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
