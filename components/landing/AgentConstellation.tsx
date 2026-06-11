"use client";

// ── AgentConstellation — le système nerveux de la marque, rendu visible ──────
// Le cœur du concept AXON : votre marque émet un signal, le noyau AXON le
// distribue à 6 agents IA spécialisés (les VRAIS agents de l'orchestrateur :
// Stratège, Rédacteur, Créatif, Conformité, Media Buyer, Analyste), puis le
// Publisher transmet aux réseaux. Des impulsions lumineuses circulent le long
// des synapses (SVG animateMotion — natif, zéro dépendance).
//
// Respect utilisateur : les impulsions sont masquées et le flottement coupé
// si `prefers-reduced-motion: reduce` (géré en CSS, classes .ac-*).

import { useT } from "@/lib/i18n";

interface AgentNode {
  x: number; y: number;
  icon: keyof typeof GLYPHS;
  fr: string; en: string;
}

// Icônes vectorielles maison (espace 24×24, trait 1.8) — pas d'emoji :
// rendu identique sur tous les OS, style premium cohérent.
const GLYPHS = {
  heart: ["M12 20.5S4.5 15.6 4.5 10.4C4.5 7.8 6.5 6 8.8 6c1.3 0 2.5.6 3.2 1.6C12.7 6.6 13.9 6 15.2 6c2.3 0 4.3 1.8 4.3 4.4 0 5.2-7.5 10.1-7.5 10.1Z"],
  compass: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M15.2 8.8 13 13l-4.2 2.2L11 11l4.2-2.2Z"],
  pen: ["M16.5 3.9a2.1 2.1 0 0 1 3 3L8 18.4 4 19.5l1.1-4L16.5 3.9Z", "M13.5 6.9l3.6 3.6"],
  palette: ["M12 3.5a8.5 8.5 0 1 0 0 17h1.6a1.9 1.9 0 0 0 1.4-3.2c-.8-.9-.2-2.3 1-2.3h1.5a4 4 0 0 0 4-4c0-4.2-4.3-7.5-9.5-7.5Z", "M8 9.5h.01M12 7.5h.01M16 9.5h.01"],
  shield: ["M12 3.5 18.5 6v5c0 4.3-2.8 7.8-6.5 9-3.7-1.2-6.5-4.7-6.5-9V6L12 3.5Z", "m9 11.5 2.2 2.2 4-4.4"],
  megaphone: ["M4 10.5v3h2.5l8 4v-11l-8 4H4Z", "M17.5 9.5v5", "m7.5 13.7.9 4.3h2.2"],
  bars: ["M7 17v-5M12 17V7.5M17 17v-7", "M5 17h14"],
  plane: ["M21 3 10.8 13.2", "M21 3l-6.2 18-3.9-8.1L3 9.2 21 3Z"],
} as const;

/** Pose une icône vectorielle (espace 24×24) centrée en (x,y) à l'échelle s. */
function Glyph({ name, x, y, s = 1 }: { name: keyof typeof GLYPHS; x: number; y: number; s?: number }) {
  return (
    <g
      transform={`translate(${x - 12 * s}, ${y - 12 * s}) scale(${s})`}
      stroke="#fff" strokeOpacity="0.92" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" fill="none"
    >
      {GLYPHS[name].map((d, i) => <path key={i} d={d} />)}
    </g>
  );
}

const AGENTS: AgentNode[] = [
  { x: 470, y: 60,  icon: "compass",   fr: "Stratège",    en: "Strategist" },
  { x: 470, y: 142, icon: "pen",       fr: "Rédacteur",   en: "Copywriter" },
  { x: 470, y: 224, icon: "palette",   fr: "Créatif",     en: "Creative" },
  { x: 470, y: 306, icon: "shield",    fr: "Conformité",  en: "Compliance" },
  { x: 470, y: 388, icon: "megaphone", fr: "Media Buyer", en: "Media Buyer" },
  { x: 470, y: 470, icon: "bars",      fr: "Analyste",    en: "Analyst" },
];

const NETWORKS = [
  { x: 880, y: 120, c: "#1877F2", label: "Facebook",  glyph: "f" },
  { x: 880, y: 220, c: "#e1306c", label: "Instagram", glyph: "ig" },
  { x: 880, y: 320, c: "#0A66C2", label: "LinkedIn",  glyph: "in" },
  { x: 880, y: 420, c: "#9ca3af", label: "X",         glyph: "x" },
];

const BRAND = { x: 80, y: 265 };
const CORE = { x: 265, y: 265 };
const PUB = { x: 690, y: 265 };

/** Courbe douce entre deux points (quadratique, contrôle au milieu). */
function curve(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} Q ${mx} ${(a.y + b.y) / 2 - (b.y - a.y) * 0.12}, ${b.x} ${b.y}`;
}

export function AgentConstellation() {
  const t = useT();

  // Toutes les synapses, avec un id pour faire circuler les impulsions dessus.
  const paths: { id: string; d: string }[] = [
    { id: "ac-in", d: curve(BRAND, CORE) },
    ...AGENTS.map((a, i) => ({ id: `ac-c${i}`, d: curve(CORE, a) })),
    ...AGENTS.map((a, i) => ({ id: `ac-p${i}`, d: curve(a, PUB) })),
    ...NETWORKS.map((n, i) => ({ id: `ac-n${i}`, d: curve(PUB, n) })),
  ];

  // Impulsions : un sous-ensemble de trajets, départs décalés → flux continu.
  const pulses = [
    { path: "ac-in", dur: 2.4, delay: 0 },
    { path: "ac-c0", dur: 2.2, delay: 0.7 }, { path: "ac-c2", dur: 2.4, delay: 1.4 },
    { path: "ac-c4", dur: 2.3, delay: 2.0 }, { path: "ac-c5", dur: 2.5, delay: 0.3 },
    { path: "ac-p1", dur: 2.2, delay: 1.1 }, { path: "ac-p3", dur: 2.4, delay: 1.8 },
    { path: "ac-p0", dur: 2.3, delay: 2.6 },
    { path: "ac-n0", dur: 1.9, delay: 0.9 }, { path: "ac-n1", dur: 2.0, delay: 1.6 },
    { path: "ac-n2", dur: 2.1, delay: 2.3 }, { path: "ac-n3", dur: 2.0, delay: 0.4 },
  ];

  return (
    <svg className="ac-svg" viewBox="0 0 960 530" fill="none" role="img"
      aria-label={t(
        "Le réseau d'agents IA : votre marque envoie le signal au noyau AXON, qui orchestre stratège, rédacteur, créatif, conformité, media buyer et analyste, puis publie sur vos réseaux.",
        "The AI agent network: your brand sends the signal to the AXON core, which orchestrates strategist, copywriter, creative, compliance, media buyer and analyst, then publishes to your networks."
      )}>
      <defs>
        <radialGradient id="ac-core-g" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#c4a5ff" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </radialGradient>
        <radialGradient id="ac-pulse-g" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#c4a5ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Synapses */}
      {paths.map((p) => (
        <path key={p.id} id={p.id} d={p.d} stroke="#a855f7" strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
      ))}

      {/* Impulsions lumineuses circulant sur les synapses */}
      {pulses.map((p, i) => (
        <circle key={i} className="ac-pulse" r="4" fill="url(#ac-pulse-g)">
          <animateMotion dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" calcMode="linear">
            <mpath href={`#${p.path}`} />
          </animateMotion>
        </circle>
      ))}

      {/* Votre marque (le point de départ humain) */}
      <g className="ac-node" style={{ transformOrigin: `${BRAND.x}px ${BRAND.y}px` }}>
        <circle cx={BRAND.x} cy={BRAND.y} r="34" fill="#171122" stroke="#a855f7" strokeWidth="1.5" />
        <Glyph name="heart" x={BRAND.x} y={BRAND.y} s={1.25} />
        <text x={BRAND.x} y={BRAND.y + 58} textAnchor="middle" className="ac-label">{t("Votre marque", "Your brand")}</text>
      </g>

      {/* Noyau AXON */}
      <g className="ac-node ac-core" style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }}>
        <circle cx={CORE.x} cy={CORE.y} r="46" fill="url(#ac-core-g)" />
        <circle className="ac-halo" cx={CORE.x} cy={CORE.y} r="46" fill="none" stroke="#a855f7" strokeWidth="1.5" />
        <text x={CORE.x} y={CORE.y - 2} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" letterSpacing="0.12em">AXON</text>
        <text x={CORE.x} y={CORE.y + 16} textAnchor="middle" fontSize="9" fill="#e9d5ff" letterSpacing="0.14em">
          {t("ORCHESTRATEUR", "ORCHESTRATOR")}
        </text>
      </g>

      {/* Les 6 agents spécialisés (la vraie équipe du produit) */}
      {AGENTS.map((a, i) => (
        <g key={i} className="ac-node" style={{ transformOrigin: `${a.x}px ${a.y}px`, animationDelay: `${i * 0.35}s` }}>
          <circle cx={a.x} cy={a.y} r="26" fill="#171122" stroke="#7c3aed" strokeWidth="1.4" />
          <Glyph name={a.icon} x={a.x} y={a.y} s={1} />
          <text x={a.x + 38} y={a.y + 4} className="ac-label" textAnchor="start">{t(a.fr, a.en)}</text>
        </g>
      ))}

      {/* Publisher (la sortie) */}
      <g className="ac-node" style={{ transformOrigin: `${PUB.x}px ${PUB.y}px`, animationDelay: "0.5s" }}>
        <circle cx={PUB.x} cy={PUB.y} r="32" fill="#171122" stroke="#d946ef" strokeWidth="1.6" />
        <Glyph name="plane" x={PUB.x} y={PUB.y} s={1.15} />
        <text x={PUB.x} y={PUB.y + 56} textAnchor="middle" className="ac-label">Publisher</text>
      </g>

      {/* Les réseaux (la destination humaine) */}
      {NETWORKS.map((n, i) => (
        <g key={n.label} className="ac-node" style={{ transformOrigin: `${n.x}px ${n.y}px`, animationDelay: `${i * 0.3 + 0.2}s` }}>
          <circle cx={n.x} cy={n.y} r="24" fill={n.c} fillOpacity="0.92" />
          {n.glyph === "f" && (
            <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff" fontFamily="var(--font-sans)">f</text>
          )}
          {n.glyph === "ig" && (
            <g stroke="#fff" strokeWidth="2" fill="none">
              <rect x={n.x - 9} y={n.y - 9} width="18" height="18" rx="5.5" />
              <circle cx={n.x} cy={n.y} r="4.2" />
              <circle cx={n.x + 5.4} cy={n.y - 5.4} r="1.3" fill="#fff" stroke="none" />
            </g>
          )}
          {n.glyph === "in" && (
            <text x={n.x} y={n.y + 6} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="var(--font-sans)">in</text>
          )}
          {n.glyph === "x" && (
            <text x={n.x} y={n.y + 7} textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" fontFamily="var(--font-sans)">𝕏</text>
          )}
          <text x={n.x} y={n.y + 46} textAnchor="middle" className="ac-label">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}
