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
    <div className="min-h-screen overflow-x-hidden bg-canvas text-ink antialiased">
      {/* ── Nav ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-hair bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo size={30} onDark={false} />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#fonctionnement" className="hover:text-ink transition-colors">Fonctionnement</a>
            <a href="#piliers" className="hover:text-ink transition-colors">Fonctionnalités</a>
            <a href="#agents" className="hover:text-ink transition-colors">Agents IA</a>
            <a href="#connecteurs" className="hover:text-ink transition-colors">Connecteurs</a>
          </nav>
          <Link href="/dashboard" className="btn-primary rounded-xl px-4 py-2 text-sm">
            Ouvrir l&apos;app
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Grille claire lavande */}
        <div className="pointer-events-none absolute inset-0 grid-bg-light opacity-70" />
        {/* Halos prune/améthyste doux sur fond clair */}
        <div className="pointer-events-none absolute -left-40 -top-20 h-[520px] w-[520px] animate-blob rounded-full bg-primary-400/15 blur-[130px]" />
        <div className="pointer-events-none absolute right-0 top-32 h-[460px] w-[460px] animate-blob rounded-full bg-[#9333ea]/12 blur-[130px]" style={{ animationDelay: "3s" }} />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-[360px] w-[360px] animate-blob rounded-full bg-success-500/8 blur-[130px]" style={{ animationDelay: "6s" }} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-white px-3 py-1 text-xs font-medium text-muted shadow-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
              Dispositif multi-agent en activité
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-ink md:text-[3.25rem]">
              Le cerveau qui réunit<br />
              <RotatingWord /><br />
              pour piloter vos campagnes
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
              Des agents IA de niveau international analysent votre marché, créent,
              vérifient la conformité, diffusent et optimisent — pour capter de
              l&apos;audience, sous votre contrôle.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn-primary rounded-xl px-5 py-3 text-sm shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
                Lancer le pilotage
              </Link>
              <Link href="/agents" className="btn-secondary rounded-xl px-5 py-3 text-sm">
                Voir les agents IA
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted/60">
              <span>Obesity Care Clinic</span>
              <span className="h-1 w-1 rounded-full bg-hair" />
              <span>Tibok</span>
              <span className="h-1 w-1 rounded-full bg-hair" />
              <span>Cabo Verde Medical International</span>
            </div>
          </div>

          {/* Brain orb + chips flottants */}
          <div className="relative mx-auto aspect-square w-full max-w-[480px]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-primary-200/30 to-transparent" />
            <div className="absolute inset-6 animate-floaty rounded-[42%] border border-hair" />
            <BrainCanvas />
            <FloatChip className="left-0 top-10" color="59,113,243" label="Stratège" sub="analyse marché" />
            <FloatChip className="right-0 top-24" color="124,58,237" label="Creative" sub="vidéo 9:16" delay="1.5s" />
            <FloatChip className="bottom-16 left-2" color="16,185,129" label="Conformité" sub="✓ validé" delay="3s" />
            <FloatChip className="bottom-4 right-6" color="245,158,11" label="Media Buyer" sub="50 €/j" delay="4.5s" />
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <section className="border-y border-hair bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
                <CountUp to={s.to} suffix={s.suffix} />
              </div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cerveau au travail (live) ─────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
        <Reveal>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">En temps réel</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">Le cerveau au travail</h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted">
            Chaque objectif déclenche une chaîne d&apos;agents : analyse sémantique du marché,
            génération de contenu, contrôle de conformité santé, diffusion et optimisation.
            Vous suivez tout, étape par étape — et gardez la main sur chaque décision.
          </p>
          <Link href="/agents" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700">
            Ouvrir le centre de pilotage →
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <AgentTicker />
        </Reveal>
      </section>

      {/* ── Comment ça marche — boucle de pilotage ────────────── */}
      <section id="fonctionnement" className="border-y border-hair bg-canvas">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Reveal><SectionHeading eyebrow="La boucle de pilotage" title="De l'objectif à l'audience captée" /></Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOOP.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="card group relative h-full p-6 transition hover:shadow-md">
                  <div className="mb-3 text-3xl font-bold tabular-nums" style={{ color: `rgb(${s.a})` }}>{s.n}</div>
                  <h3 className="text-lg font-semibold text-ink">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p>
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
              <div className="card group relative h-full overflow-hidden p-6 transition hover:shadow-md">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition group-hover:scale-150" style={{ background: `rgba(${p.accent},0.12)` }} />
                <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `rgba(${p.accent},0.10)`, border: `1px solid rgba(${p.accent},0.22)` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={`rgb(${p.accent})`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d={p.icon} /></svg>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: `rgb(${p.accent})` }}>{p.label}</div>
                <h3 className="mt-1 text-lg font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Autonomie ─────────────────────────────────────────── */}
      <section className="border-y border-hair bg-canvas">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Reveal><SectionHeading eyebrow="Vous gardez le contrôle" title="Une autonomie graduée, à votre rythme" /></Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {AUTONOMY.map((a, i) => (
              <Reveal key={a.lvl} delay={i * 100}>
                <div className="card h-full p-6">
                  <div className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: `rgba(${a.a},0.12)`, color: `rgb(${a.a})` }}>{a.lvl}</div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{a.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{a.desc}</p>
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
              <div className="card h-full p-4 transition hover:shadow-md">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold" style={{ background: `rgba(${a.a},0.12)`, color: `rgb(${a.a})` }}>{i + 1}</span>
                  <span className="font-semibold text-ink">{a.name}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{a.role}</p>
              </div>
            </Reveal>
          ))}
          <Reveal delay={AGENTS.length * 60}>
            <Link href="/agents" className="flex h-full items-center justify-center rounded-xl border border-primary-300 bg-primary-50 p-4 text-center text-sm font-semibold text-primary-700 transition hover:bg-primary-100 hover:border-primary-400">
              Ouvrir le centre de pilotage →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Connecteurs (marquee) ─────────────────────────────── */}
      <section id="connecteurs" className="border-y border-hair bg-canvas py-12">
        <div className="mb-8 text-center">
          <Reveal><SectionHeading eyebrow="Connectivité" title="Branché sur votre stack" /></Reveal>
        </div>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-canvas to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-canvas to-transparent" />
          <div className="flex w-max animate-marquee gap-3">
            {[...CONNECTORS, ...CONNECTORS].map((c, i) => (
              <span key={i} className="chip whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-medium">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-[#ede9fe] px-8 py-16 text-center shadow-lg">
            <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 animate-blob rounded-full bg-primary-400/20 blur-[100px]" />
            <h2 className="relative text-3xl font-bold tracking-tight text-ink md:text-4xl">Prêt à mettre le cerveau au travail ?</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-muted">
              Ouvrez le centre de pilotage et laissez les agents proposer — vous gardez la main sur chaque décision.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="btn-primary rounded-xl px-6 py-3 text-sm shadow-lg transition hover:-translate-y-0.5">Ouvrir le tableau de bord</Link>
              <Link href="/agents" className="btn-secondary rounded-xl px-6 py-3 text-sm">Piloter les agents</Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-hair bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-muted sm:flex-row">
          <div className="flex items-center gap-2"><Logo size={20} onDark={false} showWordmark={false} /><span>AXON-AI · Social Media</span></div>
          <span>Intelligence · Marketing · Vidéo · Connectivité · Puissance</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h2>
    </div>
  );
}

function FloatChip({ className, color, label, sub, delay = "0s" }: { className?: string; color: string; label: string; sub: string; delay?: string }) {
  return (
    <div
      className={`absolute z-10 animate-floaty rounded-xl border border-hair bg-white/90 px-3 py-2 shadow-md backdrop-blur ${className ?? ""}`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${color})` }} />
        <span className="text-xs font-semibold text-ink">{label}</span>
      </div>
      <div className="mt-0.5 text-[0.625rem] text-muted">{sub}</div>
    </div>
  );
}
