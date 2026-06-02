import Link from "next/link";
import { BrainCanvas } from "@/components/landing/BrainCanvas";

export const metadata = {
  title: "Social Hub — Le cerveau qui pilote vos campagnes",
  description:
    "Plateforme de pilotage de campagnes social media propulsée par un dispositif multi-agent IA : intelligence, marketing, vidéo, connectivité, puissance.",
};

const PILLARS = [
  {
    key: "intelligence",
    label: "Intelligence",
    accent: "59, 113, 243",
    title: "Un cerveau multi-agent",
    desc: "7 agents IA spécialisés — stratège, copywriter, créatif, media buyer, analyste, conformité — orchestrés pour penser et décider à chaque niveau.",
    icon: (
      <path d="M12 3a4 4 0 0 0-4 4 4 4 0 0 0-2 7.5A3.5 3.5 0 0 0 9 21a3 3 0 0 0 3-1 3 3 0 0 0 3 1 3.5 3.5 0 0 0 3-6.5A4 4 0 0 0 16 7a4 4 0 0 0-4-4Zm0 0v18" />
    ),
  },
  {
    key: "marketing",
    label: "Marketing",
    accent: "37, 99, 235",
    title: "Campagnes pilotées",
    desc: "Organique et payant réunis : composition, planification, audiences, budgets et optimisation guidés par la performance réelle.",
    icon: <path d="M3 11l18-5v12L3 14v-3Zm0 0v6m4-5v7a2 2 0 0 0 2 2h1" />,
  },
  {
    key: "video",
    label: "Vidéo",
    accent: "124, 58, 237",
    title: "Créa & vidéo générative",
    desc: "Visuels et vidéos courtes générés aux formats Feed et Stories, déclinés par marque et prêts à diffuser.",
    icon: <path d="m15 10 5-3v10l-5-3v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2Z" />,
  },
  {
    key: "connectivite",
    label: "Connectivité",
    accent: "16, 185, 129",
    title: "Tout est connecté",
    desc: "Meta, Instagram, LinkedIn, Supabase, Claude, Apollo, Canva — les connecteurs qui font circuler la donnée et l'action.",
    icon: <path d="M9 12a3 3 0 0 1 3-3h3a3 3 0 0 1 0 6h-1m-2 0a3 3 0 0 1-3 3H6a3 3 0 0 1 0-6h1" />,
  },
  {
    key: "puissance",
    label: "Puissance",
    accent: "245, 158, 11",
    title: "Automatisation à l'échelle",
    desc: "Automations, garde-fous budgétaires et conformité santé : la puissance d'agir vite, sans jamais sortir du cadre.",
    icon: <path d="m13 2-9 12h7l-2 8 9-12h-7l2-8Z" />,
  },
];

const AGENTS = [
  { name: "Orchestrateur", role: "Découpe, délègue, garde le cap", accent: "59,113,243" },
  { name: "Stratège", role: "Objectif, audience, budget", accent: "37,99,235" },
  { name: "Copywriter", role: "Textes & variantes brand voice", accent: "59,113,243" },
  { name: "Creative", role: "Visuels & vidéos", accent: "124,58,237" },
  { name: "Media Buyer", role: "Budgets, enchères, scaling", accent: "245,158,11" },
  { name: "Analyste", role: "KPIs, dérives, recommandations", accent: "16,185,129" },
  { name: "Conformité", role: "Veto santé bloquant", accent: "244,63,94" },
];

const CONNECTORS = ["Meta", "Instagram", "LinkedIn", "Claude", "Supabase", "Apollo", "Canva", "GA4"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0c1a30] text-white antialiased">
      {/* ── Nav ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0c1a30]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-base font-bold tracking-tight">Social Hub</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            <a href="#piliers" className="hover:text-white">Fonctionnalités</a>
            <a href="#agents" className="hover:text-white">Agents IA</a>
            <a href="#connecteurs" className="hover:text-white">Connecteurs</a>
          </nav>
          <Link
            href="/dashboard"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0c1a30] shadow-sm transition hover:bg-white/90"
          >
            Ouvrir l'app
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* halos */}
        <div className="pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-primary-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-40 h-[420px] w-[420px] rounded-full bg-[#7c3aed]/20 blur-[120px]" />

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
              Dispositif multi-agent en activité
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
              Le <span className="bg-gradient-to-r from-primary-300 via-[#a78bfa] to-success-500 bg-clip-text text-transparent">cerveau</span> qui pilote vos campagnes
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70">
              Intelligence, marketing, vidéo, connectivité, puissance — réunis dans une
              plateforme où des agents IA pensent, créent et optimisent vos campagnes,
              sous votre contrôle.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0c1a30] shadow-lg transition hover:translate-y-[-1px] hover:shadow-xl"
              >
                Lancer le pilotage
              </Link>
              <Link
                href="/agents"
                className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Voir les agents IA
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/50">
              <span>Obesity Care Clinic</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>Tibok</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>Cabo Verde Medical International</span>
            </div>
          </div>

          {/* Brain */}
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-primary-500/10 to-transparent" />
            <div className="absolute inset-6 rounded-[40%] border border-white/5" />
            <BrainCanvas />
          </div>
        </div>
      </section>

      {/* ── Piliers ───────────────────────────────────────────── */}
      <section id="piliers" className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading
          eyebrow="Cinq forces, un seul cerveau"
          title="Tout ce qu'il faut pour piloter, professionnellement"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.key}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div
                className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition group-hover:scale-125"
                style={{ background: `rgba(${p.accent}, 0.18)` }}
              />
              <div
                className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `rgba(${p.accent}, 0.14)`, border: `1px solid rgba(${p.accent}, 0.3)` }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke={`rgb(${p.accent})`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  {p.icon}
                </svg>
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: `rgb(${p.accent})` }}>
                {p.label}
              </div>
              <h3 className="mt-1 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Agents ────────────────────────────────────────────── */}
      <section id="agents" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionHeading
            eyebrow="Un cerveau à tous les niveaux"
            title="7 agents IA spécialisés, orchestrés"
          />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.map((a, i) => (
              <div
                key={a.name}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold" style={{ background: `rgba(${a.accent},0.16)`, color: `rgb(${a.accent})` }}>
                    {i + 1}
                  </span>
                  <span className="font-semibold">{a.name}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/55">{a.role}</p>
              </div>
            ))}
            <Link
              href="/agents"
              className="flex items-center justify-center rounded-xl border border-primary-400/40 bg-primary-500/10 p-4 text-sm font-semibold text-primary-200 transition hover:bg-primary-500/20"
            >
              Ouvrir le centre de pilotage →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Connecteurs ───────────────────────────────────────── */}
      <section id="connecteurs" className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading eyebrow="Connectivité" title="Branché sur votre stack" />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {CONNECTORS.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/75"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-600/30 via-[#0c1a30] to-[#7c3aed]/20 px-8 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-500/30 blur-[100px]" />
          </div>
          <h2 className="relative text-3xl font-bold tracking-tight">Prêt à mettre le cerveau au travail ?</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/70">
            Ouvrez le tableau de bord et laissez les agents proposer, vous gardez la main sur chaque décision.
          </p>
          <div className="relative mt-7 flex justify-center gap-3">
            <Link href="/dashboard" className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0c1a30] shadow-lg transition hover:translate-y-[-1px]">
              Ouvrir le tableau de bord
            </Link>
            <Link href="/agents" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold transition hover:bg-white/10">
              Piloter les agents
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-white/40 sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark small />
            <span>Social Hub · DDS Group</span>
          </div>
          <span>Intelligence · Marketing · Vidéo · Connectivité · Puissance</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-300">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
    </div>
  );
}

function BrandMark({ small }: { small?: boolean }) {
  const s = small ? "h-5 w-5" : "h-7 w-7";
  return (
    <span className={`relative flex ${s} items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-[#7c3aed]`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M12 3a4 4 0 0 0-4 4 4 4 0 0 0-2 7.5A3.5 3.5 0 0 0 9 21a3 3 0 0 0 3-1 3 3 0 0 0 3 1 3.5 3.5 0 0 0 3-6.5A4 4 0 0 0 16 7a4 4 0 0 0-4-4Z" />
      </svg>
    </span>
  );
}
