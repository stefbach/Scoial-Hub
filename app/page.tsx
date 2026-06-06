"use client";

/* Homepage "Mission Control" — sombre, cinématique, 3D partout.
   - Scène hero 3D : logos sociaux en orbite, téléphone 3D, tableau de bord 3D
     incliné, parallax piloté à la souris.
   - Réseaux mis en avant : Facebook, Instagram, LinkedIn, X (Twitter).
   - Thème local sombre (la page publique n'utilise pas les tokens clairs). */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/lib/i18n";

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

/* ───────────────────────── Téléphone 3D (CSS) ───────────────────────────── */
function Phone3D() {
  return (
    <div className="phone3d">
      <div className="phone3d-body">
        <div className="phone3d-notch" />
        <div className="phone3d-screen">
          <div className="ps-top">
            <span className="ps-av" />
            <div className="ps-meta"><span className="ps-name" /><span className="ps-sub" /></div>
            <FacebookLogo s={16} />
          </div>
          <div className="ps-media" />
          <div className="ps-actions"><span /><span /><span /></div>
          <div className="ps-line" /><div className="ps-line short" />
        </div>
      </div>
    </div>
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
  const sceneRef = useRef<HTMLDivElement>(null);

  // Parallax 3D piloté à la souris (désactivé si reduced-motion).
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${px * 18}deg`);
      el.style.setProperty("--rx", `${-py * 14}deg`);
    };
    const reset = () => { el.style.setProperty("--ry", "0deg"); el.style.setProperty("--rx", "0deg"); };
    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    return () => { window.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", reset); };
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
          <a href="#loop">{t("Méthode", "Method")}</a>
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

        {/* Scène 3D */}
        <div className="mc-scene" ref={sceneRef}>
          <div className="mc-deck">
            <div className="mc-glow mc-glow-a" />
            <div className="mc-glow mc-glow-b" />

            {/* Orbites de logos sociaux */}
            <div className="mc-orbit mc-orbit-1">
              <span className="mc-sat" style={{ ["--a" as string]: "0deg" }}><FacebookLogo /></span>
              <span className="mc-sat" style={{ ["--a" as string]: "180deg" }}><LinkedInLogo /></span>
            </div>
            <div className="mc-orbit mc-orbit-2">
              <span className="mc-sat" style={{ ["--a" as string]: "90deg" }}><InstagramLogo /></span>
              <span className="mc-sat" style={{ ["--a" as string]: "270deg" }}><XLogo /></span>
            </div>

            {/* Tableau de bord 3D */}
            <div className="mc-layer mc-layer-dash"><Dashboard3D /></div>
            {/* Téléphone 3D */}
            <div className="mc-layer mc-layer-phone"><Phone3D /></div>

            {/* Noyau IA */}
            <div className="mc-core"><span /></div>
          </div>
        </div>
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

      <style jsx global>{`
        .mc-root{position:relative;min-height:100vh;background:#0a0710;color:#ece7f5;
          font-family:var(--font-sans),system-ui,sans-serif;overflow-x:hidden;}
        .mc-root a{color:inherit;text-decoration:none;}
        .mc-mesh{position:fixed;inset:-20% -10% auto;height:130vh;z-index:0;pointer-events:none;
          background:
            radial-gradient(40% 50% at 75% 18%, rgba(168,85,247,.30), transparent 60%),
            radial-gradient(35% 45% at 18% 30%, rgba(24,119,242,.22), transparent 60%),
            radial-gradient(40% 40% at 60% 80%, rgba(225,48,108,.16), transparent 60%);
          filter:saturate(1.1);animation:mcfloat 18s ease-in-out infinite alternate;}
        @keyframes mcfloat{to{transform:translate3d(0,-4%,0) scale(1.05)}}
        .mc-grain{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.05;mix-blend-mode:overlay;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
        .mc-root>*{position:relative;z-index:2;}

        /* Nav */
        .mc-nav{display:flex;align-items:center;justify-content:space-between;gap:1rem;
          padding:1.1rem clamp(1rem,4vw,3rem);position:sticky;top:0;z-index:40;
          backdrop-filter:blur(12px);background:rgba(10,7,16,.55);border-bottom:1px solid rgba(168,85,247,.14);}
        .mc-brand{font-family:var(--font-display);font-weight:700;font-size:1.25rem;letter-spacing:-.02em;display:flex;align-items:center;gap:.5rem;}
        .mc-brand span{color:#a855f7;}
        .mc-brand-dot{width:9px;height:9px;border-radius:50%;background:#a855f7;box-shadow:0 0 14px 3px #a855f7;}
        .mc-navlinks{display:none;gap:1.8rem;font-size:.9rem;color:#b6a9d2;}
        .mc-navlinks a:hover{color:#fff;}
        @media(min-width:880px){.mc-navlinks{display:flex;}}
        .mc-navcta{display:flex;align-items:center;gap:.6rem;}

        .mc-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:.7rem;
          padding:.55rem 1rem;font-size:.86rem;font-weight:600;transition:.25s;white-space:nowrap;}
        .mc-btn-lg{padding:.85rem 1.4rem;font-size:.95rem;border-radius:.85rem;}
        .mc-btn-glow{background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;
          box-shadow:0 8px 30px -8px rgba(168,85,247,.7);}
        .mc-btn-glow:hover{transform:translateY(-2px);box-shadow:0 14px 40px -8px rgba(168,85,247,.9);}
        .mc-btn-ghost{color:#cbbfe6;}.mc-btn-ghost:hover{color:#fff;}
        .mc-btn-outline{border:1px solid rgba(168,85,247,.4);color:#e9e2f7;background:rgba(168,85,247,.06);}
        .mc-btn-outline:hover{border-color:#a855f7;background:rgba(168,85,247,.14);}

        /* Hero */
        .mc-hero{display:grid;gap:2rem;align-items:center;padding:clamp(2rem,6vw,5rem) clamp(1rem,4vw,3rem) 2rem;max-width:1280px;margin:0 auto;}
        @media(min-width:980px){.mc-hero{grid-template-columns:1.05fr .95fr;gap:1rem;min-height:78vh;}}
        .mc-eyebrow{display:inline-block;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:#b98bff;
          border:1px solid rgba(168,85,247,.3);border-radius:999px;padding:.35rem .8rem;background:rgba(168,85,247,.07);}
        .mc-h1{font-family:var(--font-display);font-weight:600;line-height:.98;letter-spacing:-.03em;
          font-size:clamp(2.6rem,7vw,5.2rem);margin:1.1rem 0 0;}
        .mc-grad{background:linear-gradient(110deg,#a855f7 10%,#e1306c 50%,#1877F2 90%);
          -webkit-background-clip:text;background-clip:text;color:transparent;}
        .mc-sub{color:#b9add0;font-size:clamp(1rem,1.4vw,1.18rem);line-height:1.6;max-width:34rem;margin:1.3rem 0 0;}
        .mc-cta-row{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:1.8rem;}
        .mc-center{justify-content:center;}
        .mc-stats{display:flex;flex-wrap:wrap;gap:1.8rem;margin-top:2.4rem;}
        .mc-stat b{display:block;font-family:var(--font-display);font-size:1.8rem;color:#fff;}
        .mc-stat span{font-size:.8rem;color:#9b8fb5;}

        /* Scène 3D */
        .mc-scene{perspective:1300px;height:clamp(360px,52vw,560px);position:relative;}
        .mc-deck{position:absolute;inset:0;transform-style:preserve-3d;
          transform:rotateX(var(--rx,8deg)) rotateY(var(--ry,-14deg));transition:transform .25s ease-out;}
        .mc-glow{position:absolute;border-radius:50%;filter:blur(50px);opacity:.6;}
        .mc-glow-a{width:300px;height:300px;background:#7c3aed;top:10%;left:20%;}
        .mc-glow-b{width:240px;height:240px;background:#1877F2;bottom:6%;right:14%;opacity:.4;}

        .mc-layer{position:absolute;transform-style:preserve-3d;}
        .mc-layer-dash{top:8%;left:4%;transform:translateZ(40px) rotateY(6deg);width:min(62%,360px);animation:mcbob 7s ease-in-out infinite;}
        .mc-layer-phone{bottom:2%;right:2%;transform:translateZ(120px) rotateY(-10deg) rotateX(4deg);animation:mcbob 6s ease-in-out infinite reverse;}
        @keyframes mcbob{50%{transform:translateY(-14px) translateZ(var(--tz,60px))}}

        /* Glass */
        .glass{background:linear-gradient(160deg,rgba(40,28,62,.85),rgba(18,12,30,.78));
          border:1px solid rgba(168,85,247,.25);border-radius:16px;backdrop-filter:blur(8px);
          box-shadow:0 30px 70px -20px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06);}

        /* Dashboard 3D */
        .dash3d{padding:14px;}
        .dash3d-head{display:flex;align-items:center;gap:.5rem;font-size:.74rem;color:#cdbff0;}
        .dash3d-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;}
        .dash3d-title{flex:1;font-weight:600;}
        .dash3d-live{font-size:.6rem;letter-spacing:.12em;color:#22c55e;border:1px solid rgba(34,197,94,.4);border-radius:6px;padding:.1rem .35rem;}
        .dash3d-kpis{display:flex;gap:.6rem;margin:.7rem 0;}
        .dash3d-kpi{flex:1;background:rgba(168,85,247,.1);border-radius:10px;padding:.5rem;}
        .dash3d-kpi b{display:block;font-family:var(--font-display);font-size:1.05rem;color:#fff;}
        .dash3d-kpi span{font-size:.62rem;color:#a395c0;}
        .dash3d-chart{display:flex;align-items:flex-end;gap:5px;height:74px;padding-top:6px;}
        .dash3d-chart span{flex:1;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#c084fc,#7c3aed);
          transform-origin:bottom;animation:mcbar 1.2s cubic-bezier(.2,.8,.2,1) backwards;}
        @keyframes mcbar{from{transform:scaleY(0)}}

        /* Phone 3D */
        .phone3d{filter:drop-shadow(0 40px 50px rgba(0,0,0,.6));}
        .phone3d-body{width:170px;height:340px;border-radius:30px;padding:8px;
          background:linear-gradient(160deg,#2a1f3e,#15101f);border:1px solid rgba(168,85,247,.3);position:relative;}
        .phone3d-notch{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:54px;height:14px;background:#0a0710;border-radius:0 0 12px 12px;z-index:3;}
        .phone3d-screen{height:100%;border-radius:22px;background:#100b1c;overflow:hidden;padding:14px 11px;display:flex;flex-direction:column;gap:8px;}
        .ps-top{display:flex;align-items:center;gap:7px;}
        .ps-av{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#e1306c,#a855f7);}
        .ps-meta{flex:1;display:flex;flex-direction:column;gap:4px;}
        .ps-name{height:7px;width:62%;background:#c7b8e6;border-radius:4px;}
        .ps-sub{height:5px;width:38%;background:#5a4d75;border-radius:4px;}
        .ps-media{height:120px;border-radius:12px;background:linear-gradient(135deg,#1877F2,#a855f7,#e1306c);position:relative;overflow:hidden;}
        .ps-media:after{content:"";position:absolute;inset:0;background:radial-gradient(60% 60% at 70% 20%,rgba(255,255,255,.35),transparent 60%);}
        .ps-actions{display:flex;gap:14px;padding:2px;}
        .ps-actions span{width:16px;height:16px;border-radius:5px;background:#3a2f54;}
        .ps-line{height:7px;width:90%;background:#2c2440;border-radius:4px;}
        .ps-line.short{width:55%;}

        /* Noyau IA */
        .mc-core{position:absolute;top:50%;left:50%;width:64px;height:64px;transform:translate(-50%,-50%) translateZ(70px);}
        .mc-core span{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,#fff,#a855f7 55%,transparent 72%);
          box-shadow:0 0 50px 12px rgba(168,85,247,.7);animation:mcpulse 3s ease-in-out infinite;}
        @keyframes mcpulse{50%{transform:scale(1.15);opacity:.85}}

        /* Orbites */
        .mc-orbit{position:absolute;top:50%;left:50%;border:1px dashed rgba(168,85,247,.28);border-radius:50%;transform-style:preserve-3d;}
        .mc-orbit-1{width:420px;height:420px;margin:-210px 0 0 -210px;transform:rotateX(74deg);animation:mcspin 16s linear infinite;}
        .mc-orbit-2{width:300px;height:300px;margin:-150px 0 0 -150px;transform:rotateX(74deg) rotateZ(40deg);animation:mcspin 11s linear infinite reverse;}
        @keyframes mcspin{to{transform:rotateX(74deg) rotateZ(360deg)}}
        .mc-orbit-2{animation-name:mcspin2;}@keyframes mcspin2{from{transform:rotateX(74deg) rotateZ(40deg)}to{transform:rotateX(74deg) rotateZ(400deg)}}
        .mc-sat{position:absolute;top:50%;left:50%;width:44px;height:44px;margin:-22px;border-radius:12px;
          display:grid;place-items:center;background:rgba(16,11,28,.9);border:1px solid rgba(168,85,247,.3);
          transform:rotate(var(--a)) translateX(210px) rotate(calc(-1*var(--a))) rotateX(-74deg);box-shadow:0 8px 20px rgba(0,0,0,.5);}
        .mc-orbit-2 .mc-sat{transform:rotate(var(--a)) translateX(150px) rotate(calc(-1*var(--a))) rotateX(-74deg);}

        /* Marquee */
        .mc-marquee{border-block:1px solid rgba(168,85,247,.14);background:rgba(255,255,255,.02);overflow:hidden;margin-top:1rem;}
        .mc-marquee-track{display:flex;gap:1rem;padding:1rem;width:max-content;animation:mcscroll 26s linear infinite;}
        @keyframes mcscroll{to{transform:translateX(-33.33%)}}
        .mc-chip{display:inline-flex;align-items:center;gap:.5rem;font-size:.85rem;color:#cdbff0;
          border:1px solid rgba(168,85,247,.2);border-radius:999px;padding:.4rem .9rem;background:rgba(168,85,247,.05);white-space:nowrap;}

        /* Sections */
        .mc-section{max-width:1200px;margin:0 auto;padding:clamp(3rem,7vw,6rem) clamp(1rem,4vw,3rem);}
        .mc-sec-head{margin-bottom:2.4rem;}
        .mc-kicker{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:#b98bff;}
        .mc-h2{font-family:var(--font-display);font-weight:600;letter-spacing:-.025em;font-size:clamp(1.8rem,4vw,3rem);margin:.5rem 0 0;line-height:1.05;}
        .mc-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));}
        .mc-card{display:flex;flex-direction:column;gap:.5rem;padding:1.4rem;border-radius:16px;
          background:linear-gradient(160deg,rgba(255,255,255,.04),rgba(255,255,255,.015));
          border:1px solid rgba(255,255,255,.08);transition:.3s;position:relative;overflow:hidden;}
        .mc-card:before{content:"";position:absolute;inset:0 0 auto;height:3px;background:var(--c);opacity:.9;}
        .mc-card:hover{transform:translateY(-6px);border-color:color-mix(in srgb,var(--c) 60%,transparent);
          box-shadow:0 24px 50px -20px var(--c);}
        .mc-card-ic{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;color:#fff;
          background:color-mix(in srgb,var(--c) 26%,#1a1230);border:1px solid color-mix(in srgb,var(--c) 50%,transparent);}
        .mc-card h3{font-family:var(--font-display);font-size:1.15rem;color:#fff;}
        .mc-card p{color:#a99dc4;font-size:.9rem;line-height:1.5;flex:1;}
        .mc-card-go{font-size:.8rem;font-weight:600;color:var(--c);}

        /* Méthode */
        .mc-loop-row{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));}
        .mc-step{padding:1.6rem 1.4rem;border-radius:16px;background:linear-gradient(160deg,rgba(168,85,247,.1),rgba(255,255,255,.015));
          border:1px solid rgba(168,85,247,.18);transition:.3s;}
        .mc-step:hover{transform:translateY(-6px) rotateX(4deg);border-color:rgba(168,85,247,.5);}
        .mc-step-n{font-family:var(--font-display);font-size:2.4rem;color:#7c3aed;opacity:.55;}
        .mc-step h3{font-family:var(--font-display);font-size:1.2rem;color:#fff;margin:.3rem 0;}
        .mc-step p{color:#a99dc4;font-size:.88rem;line-height:1.5;}
        .tilt{transform-style:preserve-3d;}

        /* CTA final */
        .mc-final{text-align:center;max-width:760px;margin:0 auto;padding:clamp(3rem,8vw,7rem) 1.5rem;position:relative;}
        .mc-final-glow{position:absolute;inset:auto 0 0;height:80%;background:radial-gradient(50% 80% at 50% 100%,rgba(168,85,247,.3),transparent 70%);z-index:-1;}
        .mc-final p{color:#b9add0;margin:1rem auto 0;max-width:30rem;line-height:1.6;}

        /* Footer */
        .mc-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;
          padding:2rem clamp(1rem,4vw,3rem);border-top:1px solid rgba(168,85,247,.14);color:#8b7fa8;font-size:.85rem;}
        .mc-foot-net{display:flex;gap:.6rem;}

        @media(prefers-reduced-motion:reduce){
          .mc-mesh,.mc-layer-dash,.mc-layer-phone,.mc-orbit,.mc-core span,.mc-marquee-track,.dash3d-chart span{animation:none!important;}
        }
      `}</style>
    </div>
  );
}
