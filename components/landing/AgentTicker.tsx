"use client";

import { useEffect, useRef, useState } from "react";

type Line = { agent: string; text: string; accent: string };

// Flux simulé d'actions d'agents — donne l'impression d'un cerveau au travail.
const STREAM: Line[] = [
  { agent: "Orchestrateur", text: "Objectif reçu — découpage en 6 tâches", accent: "59,113,243" },
  { agent: "Stratège", text: "Analyse sémantique du marché téléconsultation FR…", accent: "37,99,235" },
  { agent: "Stratège", text: "Audience cible identifiée : 38–55 ans, intention santé", accent: "37,99,235" },
  { agent: "Copywriter", text: "Génération de 4 variantes de hook (brand voice Tibok)", accent: "59,113,243" },
  { agent: "Creative", text: "Brief visuel — format 9:16 Stories + reel 8s", accent: "124,58,237" },
  { agent: "Conformité", text: "Contrôle ANSM / politiques Meta santé… ✓ conforme", accent: "16,185,129" },
  { agent: "Media Buyer", text: "Configuration campagne Meta — 50 €/j, plafond OK", accent: "245,158,11" },
  { agent: "Analyste", text: "Benchmark secteur : CTR cible 2,1 % · CPA 14 €", accent: "16,185,129" },
  { agent: "Analyste", text: "Projection : +1 240 audience captée / 30 j", accent: "16,185,129" },
  { agent: "Orchestrateur", text: "Recommandation prête — en attente de validation", accent: "59,113,243" },
];

export function AgentTicker() {
  const [lines, setLines] = useState<Line[]>([STREAM[0]]);
  const idx = useRef(1);

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
        <span className="ml-1">agents · activité en direct</span>
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
            <span className="leading-relaxed text-muted">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
