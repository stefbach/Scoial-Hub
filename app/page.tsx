import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { BrainCanvas } from "@/components/landing/BrainCanvas";
import { Reveal } from "@/components/landing/Reveal";
import { CountUp } from "@/components/landing/CountUp";
import { RotatingWord } from "@/components/landing/RotatingWord";
import { AgentTicker } from "@/components/landing/AgentTicker";

export const metadata = {
  title: "AXON-AI · Social Media — Le cerveau qui pilote vos campagnes",
  description:
    "Plateforme de pilotage de campagnes social media propulsée par un dispositif multi-agent IA : intelligence, marketing, vidéo, connectivité, puissance.",
};

const STATS = [
  { to: 7, suffix: "", label: "agents IA spécialisés" },
  { to: 5, suffix: "", label: "forces réunies" },
  { to: 8, suffix: "+", label: "connecteurs" },
  { to: 100, suffix: "%", label: "conformité contrôlée" },
];

const LOOP = [
  { n: "01", t: "Analyse", d: "Marché, concurrence et champ sémantique décodés.", a: "59,113,243" },
  { n: "02", t: "Création", d: "Textes, visuels et vidéos générés par marque.", a: "124,58,237" },
  { n: "03", t: "Conformité", d: "Veto santé bloquant avant toute diffusion.", a: "16,185,129" },
  { n: "04", t: "Diffusion", d: "Campagnes lancées sur Meta & LinkedIn.", a: "245,158,11" },
  { n: "05", t: "Mesure", d: "KPIs réels ingérés en continu.", a: "37,99,235" },
  { n: "06", t: "Optimisation", d: "Budgets et enchères ajustés, audience captée.", a: "59,113,243" },
];

const PILLARS = [
  { label: "Intelligence", accent: "59,113,243", title: "Un cerveau multi-agent", desc: "7 agents spécialisés — stratège, copywriter, créatif, media buyer, analyste, conformité — orchestrés pour décider à chaque niveau.", icon: "M12 3a4 4 0 0 0-4 4 4 4 0 0 0-2 7.5A3.5 3.5 0 0 0 9 21a3 3 0 0 0 3-1 3 3 0 0 0 3 1 3.5 3.5 0 0 0 3-6.5A4 4 0 0 0 16 7a4 4 0 0 0-4-4Zm0 0v18" },
  { label: "Marketing", accent: "37,99,235", title: "Campagnes pilotées", desc: "Organique et payant réunis : composition, planification, audiences, budgets et optimisation guidés par la performance réelle.", icon: "M3 11l18-5v12L3 14v-3Zm0 0v6m4-5v7a2 2 0 0 0 2 2h1" },
  { label: "Vidéo", accent: "124,58,237", title: "Créa & vidéo générative", desc: "Visuels et vidéos courtes générés aux formats Feed et Stories, déclinés par marque et prêts à diffuser.", icon: "m15 10 5-3v10l-5-3v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2Z" },
  { label: "Connectivité", accent: "16,185,129", title: "Tout est connecté", desc: "Meta, Instagram, LinkedIn, Supabase, Claude, Replicate, Apollo, Canva — la donnée et l'action circulent.", icon: "M9 12a3 3 0 0 1 3-3h3a3 3 0 0 1 0 6h-1m-2 0a3 3 0 0 1-3 3H6a3 3 0 0 1 0-6h1" },
  { label: "Puissance", accent: "245,158,11", title: "Automatisation à l'échelle", desc: "Automations, cadence jour/heure & mois/année, garde-fous budgétaires et conformité santé : agir vite, dans le cadre.", icon: "m13 2-9 12h7l-2 8 9-12h-7l2-8Z" },
];

const AUTONOMY = [
  { lvl: "Niv. 1", name: "Recommandation", desc: "Les agents proposent, vous validez tout. Idéal pour démarrer en confiance.", a: "59,113,243" },
  { lvl: "Niv. 2", name: "Semi-autonome", desc: "Les actions à faible risque s'exécutent seules (ex : ±10 % de budget), le reste est validé.", a: "37,99,235" },
  { lvl: "Niv. 3", name: "Autonome encadré", desc: "Pilotage autonome sous plafond budgétaire, kill-switch et veto conformité obligatoire.", a: "124,58,237" },
];

const AGENTS = [
  { name: "Orchestrateur", role: "Découpe, délègue, garde le cap", a: "59,113,243" },
  { name: "Stratège", role: "Analyse pro & sémantique, ciblage", a: "37,99,235" },
  { name: "Copywriter", role: "Textes & variantes brand voice", a: "59,113,243" },
  { name: "Creative", role: "Visuels & vidéos", a: "124,58,237" },
  { name: "Media Buyer", role: "Budgets, enchères, scaling", a: "245,158,11" },
  { name: "Analyste", role: "KPIs, benchmark, audience captée", a: "16,185,129" },
  { name: "Conformité", role: "Veto santé bloquant", a: "244,63,94" },
];

const CONNECTORS = ["Meta", "Instagram", "LinkedIn", "Claude", "Replicate", "Supabase", "Apollo", "Canva", "GA4"];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a1626] text-white antialiased">
      {/* ── Nav ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a1626]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo size={30} onDark />
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            <a href="#fonctionnement" className="hover:text-white">Fonctionnement</a>
            <a href="#piliers" className="hover:text-white">Fonctionnalités</a>
            <a href="#agents" className="hover:text-white">Agents IA</a>
            <a href="#connecteurs" className="hover:text-white">Connecteurs</a>
          </nav>
          <Link href="/dashboard" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0a1626] shadow-sm transition hover:bg-white/90">
            Ouvrir l'app
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
        <div className="pointer-events-none absolute -left-40 -top-20 h-[520px] w-[520px] animate-blob rounded-full bg-primary-500/25 blur-[130px]" />
        <div className="pointer-events-none absolute right-0 top-32 h-[460px] w-[460px] animate-blob rounded-full bg-[#7c3aed]/25 blur-[130px]" style={{ animationDelay: "3s" }} />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-[360px] w-[360px] animate-blob rounded-full bg-success-500/15 blur-[130px]" style={{ animationDelay: "6s" }} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
              Dispositif multi-agent en activité
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight md:text-[3.25rem]">
              Le cerveau qui réunit<br />
              <RotatingWord /><br />
              pour piloter vos campagnes
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70">
              Des agents IA de niveau international analysent votre marché, créent,
              vérifient la conformité, diffusent et optimisent — pour capter de
              l'audience, sous votre contrôle.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0a1626] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
                Lancer le pilotage
              </Link>
              <Link href="/agents" className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
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

          {/* Brain orb + chips flottants */}
          <div className="relative mx-auto aspect-square w-full max-w-[480px]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-primary-500/10 to-transparent" />
            <div className="absolute inset-6 animate-floaty rounded-[42%] border border-white/5" />
            <BrainCanvas />
            <FloatChip className="left-0 top-10" color="59,113,243" label="Stratège" sub="analyse marché" />
            <FloatChip className="right-0 top-24" color="124,58,237" label="Creative" sub="vidéo 9:16" delay="1.5s" />
            <FloatChip className="bottom-16 left-2" color="16,185,129" label="Conformité" sub="✓ validé" delay="3s" />
            <FloatChip className="bottom-4 right-6" color="245,158,11" label="Media Buyer" sub="50 €/j" delay="4.5s" />
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight md:text-4xl">
                <CountUp to={s.to} suffix={s.suffix} />
              </div>
              <div className="mt-1 text-xs text-white/55">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cerveau au travail (live) ─────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
        <Reveal>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-300">En temps réel</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Le cerveau au travail</h2>
          <p className="mt-4 max-w-md leading-relaxed text-white/65">
            Chaque objectif déclenche une chaîne d'agents : analyse sémantique du marché,
            génération de contenu, contrôle de conformité santé, diffusion et optimisation.
            Vous suivez tout, étape par étape — et gardez la main sur chaque décision.
          </p>
          <Link href="/agents" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-300 hover:text-primary-200">
            Ouvrir le centre de pilotage →
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <AgentTicker />
        </Reveal>
      </section>

      {/* ── Comment ça marche — boucle de pilotage ────────────── */}
      <section id="fonctionnement" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Reveal><SectionHeading eyebrow="La boucle de pilotage" title="De l'objectif à l'audience captée" /></Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOOP.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="group relative h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.06]">
                  <div className="mb-3 text-3xl font-bold tabular-nums" style={{ color: `rgb(${s.a})` }}>{s.n}</div>
                  <h3 className="text-lg font-semibold">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Piliers ───────────────────────────────────────────── */}
      <section id="piliers" className="mx-auto max-w-6xl px-5 py-20">
        <Reveal><SectionHeading eyebrow="Cinq forces, un seul cerveau" title="Tout ce qu'il faut pour piloter, professionnellement" /></Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.label} delay={i * 80}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.05]">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition group-hover:scale-150" style={{ background: `rgba(${p.accent},0.18)` }} />
                <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `rgba(${p.accent},0.14)`, border: `1px solid rgba(${p.accent},0.3)` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={`rgb(${p.accent})`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d={p.icon} /></svg>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: `rgb(${p.accent})` }}>{p.label}</div>
                <h3 className="mt-1 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Autonomie ─────────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Reveal><SectionHeading eyebrow="Vous gardez le contrôle" title="Une autonomie graduée, à votre rythme" /></Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {AUTONOMY.map((a, i) => (
              <Reveal key={a.lvl} delay={i * 100}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: `rgba(${a.a},0.16)`, color: `rgb(${a.a})` }}>{a.lvl}</div>
                  <h3 className="mt-3 text-lg font-semibold">{a.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agents ────────────────────────────────────────────── */}
      <section id="agents" className="mx-auto max-w-6xl px-5 py-20">
        <Reveal><SectionHeading eyebrow="Un cerveau à tous les niveaux" title="7 agents IA spécialisés, orchestrés" /></Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((a, i) => (
            <Reveal key={a.name} delay={i * 60}>
              <div className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold" style={{ background: `rgba(${a.a},0.16)`, color: `rgb(${a.a})` }}>{i + 1}</span>
                  <span className="font-semibold">{a.name}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/55">{a.role}</p>
              </div>
            </Reveal>
          ))}
          <Reveal delay={AGENTS.length * 60}>
            <Link href="/agents" className="flex h-full items-center justify-center rounded-xl border border-primary-400/40 bg-primary-500/10 p-4 text-center text-sm font-semibold text-primary-200 transition hover:bg-primary-500/20">
              Ouvrir le centre de pilotage →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Connecteurs (marquee) ─────────────────────────────── */}
      <section id="connecteurs" className="border-y border-white/10 bg-white/[0.02] py-12">
        <div className="mb-8 text-center">
          <Reveal><SectionHeading eyebrow="Connectivité" title="Branché sur votre stack" /></Reveal>
        </div>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0a1626] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0a1626] to-transparent" />
          <div className="flex w-max animate-marquee gap-3">
            {[...CONNECTORS, ...CONNECTORS].map((c, i) => (
              <span key={i} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-white/75">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-600/30 via-[#0a1626] to-[#7c3aed]/20 px-8 py-16 text-center">
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 animate-blob rounded-full bg-primary-500/30 blur-[100px]" />
            <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">Prêt à mettre le cerveau au travail ?</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-white/70">
              Ouvrez le centre de pilotage et laissez les agents proposer — vous gardez la main sur chaque décision.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0a1626] shadow-lg transition hover:-translate-y-0.5">Ouvrir le tableau de bord</Link>
              <Link href="/agents" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold transition hover:bg-white/10">Piloter les agents</Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-white/40 sm:flex-row">
          <div className="flex items-center gap-2"><Logo size={20} onDark showWordmark={false} /><span>AXON-AI · Social Media</span></div>
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

function FloatChip({ className, color, label, sub, delay = "0s" }: { className?: string; color: string; label: string; sub: string; delay?: string }) {
  return (
    <div
      className={`absolute z-10 animate-floaty rounded-xl border border-white/10 bg-[#0d1b30]/80 px-3 py-2 shadow-lg backdrop-blur ${className ?? ""}`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${color})` }} />
        <span className="text-xs font-semibold text-white">{label}</span>
      </div>
      <div className="mt-0.5 text-[0.625rem] text-white/55">{sub}</div>
    </div>
  );
}

