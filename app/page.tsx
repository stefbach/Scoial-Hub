"use client";

/* Homepage "Mission Control" — sombre, cinématique, 3D partout.
   - Scène hero 3D : logos sociaux en orbite, téléphone 3D, tableau de bord 3D
     incliné, parallax piloté à la souris.
   - Réseaux mis en avant : Facebook, Instagram, LinkedIn, X (Twitter).
   - Thème local sombre (la page publique n'utilise pas les tokens clairs). */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/lib/i18n";

// Scène WebGL (Three.js) — chargée côté client uniquement.
const Hero3D = dynamic(() => import("@/components/landing/Hero3D").then((m) => m.Hero3D), { ssr: false });

/* ───────────────────────── Logos réseaux (SVG inline) ───────────────────── */
function FacebookLogo({ s = 28 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path d="M15.3 12.2h-2.1V20h-3v-7.8H8.6V9.6h1.6V8.2c0-1.9 1.1-3 2.9-3 .8 0 1.6.1 1.6.1v2.4h-1c-.9 0-1.2.5-1.2 1.1v1.4h2.3l-.5 2.5Z" fill="#fff" />
    </svg>
  );
}
function InstagramLogo({ s = 28 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id="ig" cx="30%" cy="107%" r="140%">
          <stop offset="0%" stopColor="#fdf497" /><stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" /><stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig)" />
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.4" cy="7.6" r="1.1" fill="#fff" />
    </svg>
  );
}
function LinkedInLogo({ s = 28 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#0A66C2" />
      <path fill="#fff" d="M7.06 9.5H4.6V19h2.46V9.5ZM5.83 5.5a1.43 1.43 0 1 0 0 2.86 1.43 1.43 0 0 0 0-2.86ZM19.4 19h-2.46v-4.64c0-1.1-.02-2.52-1.54-2.52-1.54 0-1.78 1.2-1.78 2.44V19h-2.46V9.5h2.36v1.3h.03c.33-.62 1.13-1.28 2.33-1.28 2.49 0 2.95 1.64 2.95 3.78V19Z" />
    </svg>
  );
}
function XLogo({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#0a0a0a" />
      <path d="M13.9 10.6 18.4 5.5h-1.6l-3.8 4.3-3-4.3H5.2l4.7 6.7-4.7 5.3h1.6l4.1-4.6 3.3 4.6h4.8l-5.1-7.2Zm-1.4 1.6-.5-.7-3.8-5.3h1.7l3 4.3.5.7 4 5.6h-1.7l-3.2-4.6Z" fill="#fff" />
    </svg>
  );
}
const NETWORKS = [FacebookLogo, InstagramLogo, LinkedInLogo, XLogo];

/* ───────────────────────── Données réelles (README) ─────────────────────── */
const STATS = [
  { v: "8", fr: "agents IA", en: "AI agents" },
  { v: "4+", fr: "réseaux", en: "networks" },
  { v: "100%", fr: "en pause d'abord", en: "paused-first" },
  { v: "∞", fr: "marques", en: "brands" },
];

const CAPABILITIES = [
  { c: "#1877F2", fr: "Créer une pub Meta", en: "Create a Meta ad", dfr: "Image, carrousel, vidéo ou formulaire de prospects — créée EN PAUSE, activée d'un clic.", den: "Image, carousel, video or lead form — created PAUSED, activated in one click.", href: "/campaigns/new", icon: "M4 19V5m5 14V9m5 10v-6m5 6V7" },
  { c: "#a855f7", fr: "Assistant conversationnel", en: "Conversational assistant", dfr: "Décrivez la campagne, l'IA remplit tout : ciblage, budget, visuel, texte — règles Meta incluses.", den: "Describe the campaign, the AI fills everything per Meta rules.", href: "/campaigns/new", icon: "M4 5h16v10H8l-4 4V5Z" },
  { c: "#e1306c", fr: "Studios & Médiathèque", en: "Studios & Media library", dfr: "Affiches, vidéos, visuels IA multi-formats — tout est stocké et réutilisable.", den: "Posters, videos, multi-format AI visuals — all stored and reusable.", href: "/media", icon: "m15 10 5-3v10l-5-3v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2Z" },
  { c: "#0A66C2", fr: "Article LinkedIn", en: "LinkedIn Article", dfr: "Mots-clés → article pro + visuels HD → aperçu prêt à publier.", den: "Keywords → pro article + HD visuals → ready-to-publish preview.", href: "/article-linkedin", icon: "M5 3h14v18l-7-3-7 3V3Z" },
  { c: "#22c55e", fr: "Pilote Pub", en: "Ad Pilot", dfr: "L'IA lit la performance réelle et applique pause / budget / activation, avec garde-fous.", den: "AI reads real performance and applies pause/budget/activation, with guardrails.", href: "/ad-performance", icon: "M3 12h4l3 8 4-16 3 8h4" },
  { c: "#f59e0b", fr: "Centre de pilotage", en: "Command center", dfr: "Vos vraies données : perf pub, abonnés, engagement, veille — et agents lançables partout.", den: "Your real data: ad perf, followers, engagement, watch — agents everywhere.", href: "/pilotage", icon: "M12 3l9 5v8l-9 5-9-5V8l9-5Z" },
];

const LOOP = [
  { n: "01", fr: "Analyse", en: "Analyse", dfr: "Marché, concurrents et veille décodés en mémoire stratégique.", den: "Market, competitors & watch decoded into strategic memory." },
  { n: "02", fr: "Création", en: "Create", dfr: "Textes, visuels et vidéos générés à votre image, tous formats.", den: "On-brand copy, visuals and videos, every format." },
  { n: "03", fr: "Diffusion", en: "Publish", dfr: "Organique et publicité Meta — en pause d'abord, activation maîtrisée.", den: "Organic & Meta ads — paused first, controlled activation." },
  { n: "04", fr: "Optimisation", en: "Optimise", dfr: "Le Pilote Pub ajuste budgets et campagnes sur la performance réelle.", den: "Ad Pilot adjusts budgets and campaigns on real performance." },
];

const TESTIMONIALS = [
  { q: "On a relancé nos pubs Meta en 10 minutes, sans ouvrir le Business Manager.", a: "Dir. Marketing · clinique", net: 0 },
  { q: "L'assistant rédige et cible mieux que notre ancienne agence — et reste sous contrôle.", a: "Fondateur · SaaS B2B", net: 2 },
  { q: "Les visuels multi-formats partent direct en Reels et en fil. Gain de temps énorme.", a: "Social Media Manager", net: 1 },
];

const PLANS = [
  { name: "Starter", price: "0", fr: "Pour tester", en: "To try", feats: ["1 marque", "Studios IA", "Publication organique", "Médiathèque"], cta: "Commencer", ctaEn: "Start", href: "/demarrage", hot: false },
  { name: "Growth", price: "—", fr: "Le plus choisi", en: "Most chosen", feats: ["Marques illimitées", "Pubs Meta + assistant", "Pilote Pub (optimisation)", "Agents IA", "Veille concurrents"], cta: "Démarrer", ctaEn: "Get started", href: "/demarrage", hot: true },
  { name: "Scale", price: "sur devis", fr: "Multi-équipes", en: "Multi-team", feats: ["Tout Growth", "Rôles & permissions", "Conformité avancée", "Support prioritaire"], cta: "Nous contacter", ctaEn: "Contact us", href: "/demarrage", hot: false },
];

const FAQ = [
  { q: "Les pubs sont-elles publiées automatiquement ?", a: "Non. Tout est créé EN PAUSE sur votre compte Meta. L'activation (dépense réelle) est une action explicite, plafonnée et confirmée." },
  { q: "Mes données et tokens sont-ils protégés ?", a: "Oui : isolation par société (multi-tenant), tokens chiffrés au repos (AES-256-GCM), et garde anti-IDOR sur chaque route." },
  { q: "Quels réseaux sont supportés ?", a: "Facebook, Instagram et LinkedIn (publication réelle). TikTok & X côté formats/visuels. Chaque client connecte ses propres comptes." },
  { q: "C'est scalable pour plusieurs clients ?", a: "Oui — chaque société a son profil, ses connexions OAuth et ses campagnes, totalement isolés." },
];

/* ───────────────────────── Réseau humain (SVG animé) ────────────────────── */
function HumanNetwork() {
  // Noeuds = personnes ; arêtes = liens. Couleurs réseaux pour les anneaux.
  const nodes = [
    { x: 90, y: 80, r: 30, c: "#1877F2" }, { x: 250, y: 50, r: 24, c: "#e1306c" },
    { x: 420, y: 95, r: 32, c: "#0A66C2" }, { x: 560, y: 60, r: 22, c: "#111" },
    { x: 160, y: 200, r: 26, c: "#e1306c" }, { x: 330, y: 220, r: 34, c: "#a855f7" },
    { x: 500, y: 210, r: 26, c: "#1877F2" }, { x: 250, y: 330, r: 24, c: "#0A66C2" },
    { x: 430, y: 340, r: 28, c: "#e1306c" }, { x: 600, y: 300, r: 22, c: "#a855f7" },
  ];
  const edges = [[0, 4], [0, 1], [1, 5], [2, 5], [2, 3], [3, 6], [4, 5], [5, 6], [4, 7], [5, 8], [7, 8], [6, 9], [8, 9], [1, 2]];
  const person = "M0,7 a5,5 0 1,0 0.001,0 M-9,22 a9,9 0 0,1 18,0 Z";
  return (
    <svg className="mc-net" viewBox="0 0 680 400" fill="none" aria-hidden>
      <defs>
        {nodes.map((n, i) => (
          <radialGradient key={i} id={`hn${i}`} cx="35%" cy="30%">
            <stop offset="0%" stopColor={n.c} stopOpacity="0.95" /><stop offset="100%" stopColor={n.c} stopOpacity="0.55" />
          </radialGradient>
        ))}
      </defs>
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="#a855f7" strokeOpacity="0.35" strokeWidth="1.5" className="mc-net-edge" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
      {nodes.map((n, i) => (
        <g key={i} className="mc-net-node" style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${n.x}px ${n.y}px` }}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={`url(#hn${i})`} stroke={n.c} strokeWidth="1.5" />
          <g transform={`translate(${n.x},${n.y - n.r * 0.18}) scale(${n.r / 26})`} fill="#fff" fillOpacity="0.92">
            <path d={person} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/* ───────────────────────── Tableau de bord 3D (CSS) ─────────────────────── */
function Dashboard3D() {
  const bars = [42, 70, 35, 88, 60, 95, 52];
  return (
    <div className="dash3d glass">
      <div className="dash3d-head">
        <span className="dash3d-dot" /><span className="dash3d-title">Performance · Meta</span>
        <span className="dash3d-live">LIVE</span>
      </div>
      <div className="dash3d-kpis">
        {[["Dépense", "1 266 €"], ["CTR", "2.1%"], ["Conv.", "394k"]].map(([k, v]) => (
          <div key={k} className="dash3d-kpi"><b>{v}</b><span>{k}</span></div>
        ))}
      </div>
      <div className="dash3d-chart">
        {bars.map((h, i) => <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />)}
      </div>
    </div>
  );
}

export default function Home() {
  const t = useT();

  // Révélations au scroll (IntersectionObserver).
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }),
      { threshold: 0.16 }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mc-root">
      {/* Décor : mesh gradient + grain */}
      <div className="mc-mesh" aria-hidden />
      <div className="mc-grain" aria-hidden />

      {/* ── Nav ── */}
      <header className="mc-nav">
        <Link href="/" className="mc-brand"><span className="mc-brand-dot" /> AXON<span>·AI</span></Link>
        <nav className="mc-navlinks">
          <a href="#capabilities">{t("Capacités", "Capabilities")}</a>
          <a href="#showcase">{t("Aperçu", "Preview")}</a>
          <a href="#pricing">{t("Tarifs", "Pricing")}</a>
          <Link href="/agents">{t("Agents", "Agents")}</Link>
        </nav>
        <div className="mc-navcta">
          <LanguageSwitcher />
          <Link href="/dashboard" className="mc-btn mc-btn-ghost">{t("Entrer", "Enter")}</Link>
          <Link href="/demarrage" className="mc-btn mc-btn-glow">{t("Commencer", "Start")}</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mc-hero">
        <div className="mc-hero-copy">
          <span className="mc-eyebrow">{t("SaaS social media · piloté par agents IA", "AI-agent social media SaaS")}</span>
          <h1 className="mc-h1">
            {t("Tout votre", "Your entire")}<br />
            <span className="mc-grad">{t("social media", "social media")}</span><br />
            {t("piloté par l'IA.", "run by AI.")}
          </h1>
          <p className="mc-sub">
            {t(
              "Créez, publiez et optimisez sur Facebook, Instagram, LinkedIn et X. Des agents analysent, créent les visuels, vérifient la conformité et lancent vos pubs Meta — sous votre contrôle.",
              "Create, publish and optimise on Facebook, Instagram, LinkedIn and X. Agents analyse, build visuals, check compliance and launch your Meta ads — under your control."
            )}
          </p>
          <div className="mc-cta-row">
            <Link href="/demarrage" className="mc-btn mc-btn-glow mc-btn-lg">{t("Démarrage assisté →", "Get started →")}</Link>
            <Link href="/campaigns/new" className="mc-btn mc-btn-outline mc-btn-lg">{t("Créer une pub Meta", "Create a Meta ad")}</Link>
          </div>
          <div className="mc-stats">
            {STATS.map((s) => (
              <div key={s.v} className="mc-stat"><b>{s.v}</b><span>{t(s.fr, s.en)}</span></div>
            ))}
          </div>
        </div>

        {/* Scène WebGL (Three.js) — téléphone + dashboard verre + logos en orbite */}
        <div className="mc-scene"><Hero3D /></div>
      </section>

      {/* ── Bandeau réseaux ── */}
      <section className="mc-marquee">
        <div className="mc-marquee-track">
          {Array.from({ length: 3 }).flatMap((_, k) =>
            NETWORKS.map((L, i) => (
              <span key={`${k}-${i}`} className="mc-chip"><L s={22} /> {["Facebook", "Instagram", "LinkedIn", "X"][i]}</span>
            ))
          )}
        </div>
      </section>

      {/* ── Humains connectés ── */}
      <section className="mc-section mc-human">
        <div className="mc-human-grid">
          <div className="reveal">
            <span className="mc-kicker">{t("Des humains, reliés", "Humans, connected")}</span>
            <h2 className="mc-h2">{t("Vos communautés, au même endroit.", "Your communities, in one place.")}</h2>
            <p className="mc-human-p">
              {t(
                "Facebook, Instagram, LinkedIn, X — vos audiences ne sont plus des silos. L'IA relie les conversations, les contenus et les campagnes autour de vraies personnes.",
                "Facebook, Instagram, LinkedIn, X — your audiences are no longer silos. AI links conversations, content and campaigns around real people."
              )}
            </p>
            <Link href="/pilotage" className="mc-btn mc-btn-glow mc-btn-lg">{t("Voir le pilotage", "See the command center")}</Link>
          </div>
          <div className="mc-human-viz reveal">
            <HumanNetwork />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero/network.webp" alt={t("Humains connectés", "Connected humans")} className="mc-human-photo"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          </div>
        </div>
      </section>

      {/* ── Capacités ── */}
      <section id="capabilities" className="mc-section">
        <header className="mc-sec-head">
          <span className="mc-kicker">{t("Ce que vous faites, vraiment", "What you actually do")}</span>
          <h2 className="mc-h2">{t("Une chaîne complète, sous contrôle.", "A complete chain, under control.")}</h2>
        </header>
        <div className="mc-grid">
          {CAPABILITIES.map((c) => (
            <Link key={c.fr} href={c.href} className="mc-card tilt" style={{ ["--c" as string]: c.c }}>
              <span className="mc-card-ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
              </span>
              <h3>{t(c.fr, c.en)}</h3>
              <p>{t(c.dfr, c.den)}</p>
              <span className="mc-card-go">{t("Ouvrir", "Open")} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Méthode (boucle) ── */}
      <section id="loop" className="mc-section mc-loop">
        <header className="mc-sec-head">
          <span className="mc-kicker">{t("La boucle d'apprentissage", "The learning loop")}</span>
          <h2 className="mc-h2">{t("Analyser · Créer · Diffuser · Optimiser", "Analyse · Create · Publish · Optimise")}</h2>
        </header>
        <div className="mc-loop-row">
          {LOOP.map((l) => (
            <div key={l.n} className="mc-step tilt">
              <span className="mc-step-n">{l.n}</span>
              <h3>{t(l.fr, l.en)}</h3>
              <p>{t(l.dfr, l.den)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Showcase 3D produit ── */}
      <section id="showcase" className="mc-section mc-showcase">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">{t("Vu de l'intérieur", "Inside the product")}</span>
          <h2 className="mc-h2">{t("Un poste de pilotage, pas un tableur.", "A command deck, not a spreadsheet.")}</h2>
        </header>
        <div className="mc-window-wrap reveal">
          <div className="mc-window">
            <div className="mc-window-bar"><i /><i /><i /><span>app · /campaigns/new</span></div>
            <div className="mc-window-body">
              <div className="mc-w-side">
                {["Pilotage", "Campagnes", "Médiathèque", "Agents", "Veille"].map((x, i) => (
                  <span key={x} className={i === 1 ? "on" : ""}>{x}</span>
                ))}
              </div>
              <div className="mc-w-main">
                <div className="mc-w-row"><b>{t("Assistant — décrivez, l'IA remplit", "Assistant — describe, AI fills")}</b></div>
                <div className="mc-w-bubble">{t("« Prospects chirurgie obésité, UK, 25€/j, formulaire »", "“Leads obesity surgery, UK, €25/d, form”")}</div>
                <div className="mc-w-cards">
                  <Dashboard3D />
                  <div className="mc-w-mini">
                    <div className="mc-w-mini-h"><InstagramLogo s={16} /> Reel 9:16</div>
                    <div className="mc-w-mini-media" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* cartes de posts flottantes en 3D */}
          <div className="mc-float mc-float-a"><div className="mc-post"><FacebookLogo s={18} /><span /><span className="sh" /></div></div>
          <div className="mc-float mc-float-b"><div className="mc-post"><LinkedInLogo s={18} /><span /><span className="sh" /></div></div>
        </div>
      </section>

      {/* ── Témoignages ── */}
      <section className="mc-section">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">{t("Ils pilotent avec AXON", "They steer with AXON")}</span>
          <h2 className="mc-h2">{t("Moins d'outils. Plus de résultats.", "Fewer tools. More results.")}</h2>
        </header>
        <div className="mc-grid">
          {TESTIMONIALS.map((tm, i) => {
            const L = NETWORKS[tm.net];
            return (
              <figure key={i} className="mc-quote reveal" style={{ transitionDelay: `${i * 90}ms` }}>
                <L s={26} />
                <blockquote>“{tm.q}”</blockquote>
                <figcaption>{tm.a}</figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="pricing" className="mc-section">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">{t("Tarifs", "Pricing")}</span>
          <h2 className="mc-h2">{t("Simple, comme l'outil.", "Simple, like the tool.")}</h2>
        </header>
        <div className="mc-plans">
          {PLANS.map((p, i) => (
            <div key={p.name} className={`mc-plan reveal${p.hot ? " hot" : ""}`} style={{ transitionDelay: `${i * 90}ms` }}>
              {p.hot && <span className="mc-plan-badge">{t("Populaire", "Popular")}</span>}
              <h3>{p.name}</h3>
              <div className="mc-plan-price">{p.price}<span>{p.price === "0" ? "€" : ""}</span></div>
              <p className="mc-plan-sub">{t(p.fr, p.en)}</p>
              <ul>{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
              <Link href={p.href} className={`mc-btn ${p.hot ? "mc-btn-glow" : "mc-btn-outline"} mc-btn-lg`} style={{ width: "100%" }}>{t(p.cta, p.ctaEn)}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mc-section mc-faq">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">FAQ</span>
          <h2 className="mc-h2">{t("Les bonnes questions.", "The right questions.")}</h2>
        </header>
        <div className="mc-faq-list reveal">
          {FAQ.map((f, i) => (
            <details key={i} className="mc-faq-item">
              <summary>{f.q}<span>+</span></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="mc-final">
        <div className="mc-final-glow" aria-hidden />
        <h2 className="mc-h2">{t("Prêt à reprendre la main ?", "Ready to take control?")}</h2>
        <p>{t("Connectez vos réseaux et laissez les agents travailler — en pause d'abord, toujours.", "Connect your networks and let the agents work — paused first, always.")}</p>
        <div className="mc-cta-row mc-center">
          <Link href="/demarrage" className="mc-btn mc-btn-glow mc-btn-lg">{t("Commencer maintenant", "Start now")}</Link>
          <Link href="/dashboard" className="mc-btn mc-btn-outline mc-btn-lg">{t("Voir le tableau de bord", "See the dashboard")}</Link>
        </div>
      </section>

      <footer className="mc-foot">
        <span>© {new Date().getFullYear()} AXON·AI</span>
        <span className="mc-foot-net">{NETWORKS.map((L, i) => <L key={i} s={18} />)}</span>
      </footer>
    </div>
  );
}
