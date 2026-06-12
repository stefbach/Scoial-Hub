"use client";

/* Homepage "Mission Control" — sombre, cinématique, 3D partout.
   - Scène hero 3D : logos sociaux en orbite, téléphone 3D, tableau de bord 3D
     incliné, parallax piloté à la souris.
   - Réseaux mis en avant : Facebook, Instagram, LinkedIn, TikTok.
   - Thème local sombre (la page publique n'utilise pas les tokens clairs). */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/lib/i18n";
import { NetworkCanvas } from "@/components/visual/NetworkCanvas";
import { AgentConstellation } from "@/components/landing/AgentConstellation";
import { Tilt3D } from "@/components/visual/Tilt3D";
import { IconLink, IconChat, IconTrendingUp, IconLock, IconShieldCheck, IconMic, IconAward } from "@/components/visual/Icons";

// Scène WebGL (Three.js) — chargée côté client uniquement.
// Globe terrestre interactif : on tourne autour du monde, les réseaux sociaux
// sont les satellites. Villes accessibles en un clic (fly-to façon Google Earth).
const GoogleEarth = dynamic(() => import("@/components/landing/GoogleEarth").then((m) => m.GoogleEarth), { ssr: false });
const Phone3D = dynamic(() => import("@/components/landing/Phone3D").then((m) => m.Phone3D), { ssr: false });

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
function TikTokLogo({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#010101" />
      <path d="M16.5 5.2c.5 1.6 1.7 2.9 3.3 3.3v2.4c-1.2 0-2.4-.4-3.4-1v4.9a4.7 4.7 0 1 1-4.7-4.7c.2 0 .5 0 .7.05v2.5a2.2 2.2 0 1 0 1.5 2.1V5.2h2.3Z" fill="#fff" />
      <path d="M16.9 5.2c.5 1.6 1.7 2.9 3.3 3.3" fill="none" stroke="#25F4EE" strokeWidth="0" />
    </svg>
  );
}
const NETWORKS = [FacebookLogo, InstagramLogo, LinkedInLogo, TikTokLogo];

/* ───────────────────────── Données réelles (README) ─────────────────────── */
const STATS = [
  { v: "8", fr: "assistants à vos côtés", en: "assistants by your side" },
  { v: "4+", fr: "réseaux réunis", en: "networks in one place" },
  { v: "0", fr: "post publié sans vous", en: "posts sent without you" },
  { v: "∞", fr: "marques, sans limite", en: "brands, no limit" },
];

const CAPABILITIES = [
  { c: "#1877F2", fr: "Créer une pub Meta", en: "Create a Meta ad", dfr: "Image, carrousel, vidéo ou formulaire de prospects — créée EN PAUSE, activée d'un clic.", den: "Image, carousel, video or lead form — created PAUSED, activated in one click.", href: "/campaigns/new", icon: "M4 19V5m5 14V9m5 10v-6m5 6V7" },
  { c: "#a855f7", fr: "Assistant conversationnel", en: "Conversational assistant", dfr: "Décrivez la campagne, l'IA remplit tout : objectif, ciblage, budget, visuel, texte — règles Meta incluses.", den: "Describe it, the AI fills everything per Meta rules.", href: "/campaigns/new", icon: "M4 5h16v10H8l-4 4V5Z" },
  { c: "#22c55e", fr: "Pilote Pub", en: "Ad Pilot", dfr: "L'IA lit la performance réelle et applique pause / budget / activation, avec garde-fous.", den: "AI reads real performance and applies pause/budget/activation, with guardrails.", href: "/ad-performance", icon: "M3 12h4l3 8 4-16 3 8h4" },
  { c: "#16a34a", fr: "Performance réelle", en: "Real performance", dfr: "Dépense, CTR, CPC, conversions, portée — vraies données Meta, graphes et tableaux.", den: "Spend, CTR, CPC, conversions, reach — real Meta data, charts and tables.", href: "/ad-performance", icon: "M4 19V5m4 14v-8m4 8V8m4 11v-5m4 5V7" },
  { c: "#e1306c", fr: "Studio Affiches", en: "Poster Studio", dfr: "Affiches A4/A3 et visuels réseaux : fond IA, texte, logo, charte — export & médiathèque.", den: "A4/A3 posters and social visuals: AI background, text, logo, brand kit.", href: "/studio-affiche", icon: "M4 4h16v16H4zM4 14l4-4 4 4 4-5 4 5" },
  { c: "#f43f5e", fr: "Studio Créatif vidéo", en: "Creative video studio", dfr: "Montez et marketez photos & vidéos automatiquement, réseau par réseau.", den: "Assemble and market photos & videos automatically, per network.", href: "/studio-video", icon: "m15 10 5-3v10l-5-3v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2Z" },
  { c: "#8b5cf6", fr: "Médiathèque & déclinaison", en: "Media library & remix", dfr: "Tous vos visuels/vidéos stockés, réutilisables, et déclinables en IA (img-to-img).", den: "All your visuals/videos stored, reusable, AI-remixable (img-to-img).", href: "/media", icon: "M4 5h16v14H4zM8 5v14M4 9h4" },
  { c: "#0A66C2", fr: "Article LinkedIn", en: "LinkedIn Article", dfr: "Mots-clés → article pro + visuels HD → aperçu prêt à publier.", den: "Keywords → pro article + HD visuals → ready-to-publish preview.", href: "/article-linkedin", icon: "M5 3h14v18l-7-3-7 3V3Z" },
  { c: "#3b82f6", fr: "Publier partout", en: "Publish everywhere", dfr: "Posts organiques Facebook, Instagram & LinkedIn — texte IA + visuels, multi-formats.", den: "Organic posts on Facebook, Instagram & LinkedIn — AI copy + visuals.", href: "/compose", icon: "M4 4h16v12H7l-3 3V4Z" },
  { c: "#10b981", fr: "Messagerie & réponses IA", en: "Inbox & AI replies", dfr: "Les agents répondent aux commentaires et DM dans votre voix, avec escalade humaine.", den: "Agents reply to comments and DMs in your voice, with human handoff.", href: "/inbox", icon: "M4 5h16v10H8l-4 4V5Z" },
  { c: "#eab308", fr: "Veille concurrents", en: "Competitor watch", dfr: "Pubs et contenus concurrents analysés en continu → mémoire stratégique (RAG).", den: "Competitor ads and content analysed continuously → strategic memory.", href: "/veille", icon: "M11 4a7 7 0 1 0 4.9 12l4.1 4.1M11 4a7 7 0 0 1 7 7" },
  { c: "#6366f1", fr: "8 agents IA", en: "8 AI agents", dfr: "Stratège, copywriter, créatif, conformité, media buyer… lançables depuis chaque page.", den: "Strategist, copywriter, creative, compliance, media buyer… runnable from any page.", href: "/agents", icon: "M12 3a4 4 0 0 1 4 4 4 4 0 0 1-1 7H9a4 4 0 0 1-1-7 4 4 0 0 1 4-4Z" },
  { c: "#f59e0b", fr: "Centre de pilotage", en: "Command center", dfr: "Toutes vos vraies données en un poste de commande, relié à tous les outils.", den: "All your real data in one command deck, linked to every tool.", href: "/pilotage", icon: "M12 3l9 5v8l-9 5-9-5V8l9-5Z" },
  { c: "#ec4899", fr: "Plusieurs marques", en: "Multiple brands", dfr: "Gérez N sociétés, chacune avec son profil, ses connexions et ses campagnes — isolées.", den: "Manage N companies, each with its own profile, connections and campaigns.", href: "/comptes", icon: "M3 21V8l9-5 9 5v13M9 21v-6h6v6" },
];

const CAP_CATEGORIES = [
  { id: "ads", fr: "Publicité Meta", en: "Meta ads" },
  { id: "create", fr: "Création de contenu", en: "Content creation" },
  { id: "publish", fr: "Publication & relation", en: "Publishing & relations" },
  { id: "pilot", fr: "Pilotage & veille", en: "Steering & watch" },
];
// Catégorie de chaque capacité (même ordre que CAPABILITIES).
const CAP_CAT_OF = ["ads", "ads", "ads", "ads", "create", "create", "create", "create", "publish", "publish", "pilot", "pilot", "pilot", "pilot"];


const TESTIMONIALS = [
  { q: "Avant, je publiais à minuit, épuisée. Aujourd'hui je valide trois posts depuis mon téléphone le matin — et c'est réglé.", a: "Sophie · gérante de clinique", m: "−65 % de temps", net: 0, av: "S", c: "#e1306c" },
  { q: "L'assistant rédige et cible mieux que notre ancienne agence — et je garde la main sur tout.", a: "Thomas · fondateur, SaaS B2B", m: "×2,4 de clics LinkedIn", net: 2, av: "T", c: "#0A66C2" },
  { q: "Je gère 6 marques depuis un seul espace, et les visuels s'adaptent tout seuls à chaque réseau.", a: "Léa · social media manager", m: "6 marques, 1 outil", net: 1, av: "L", c: "#a855f7" },
];


const HOW = [
  { n: "1", Ic: IconLink, fr: "Connectez en 2 minutes", en: "Connect in 2 minutes", dfr: "Liez Facebook, Instagram ou LinkedIn. Aucune configuration technique, aucune carte bancaire.", den: "Link Facebook, Instagram or LinkedIn. No technical setup, no credit card." },
  { n: "2", Ic: IconChat, fr: "Décrivez, l'IA crée", en: "Describe it, AI creates", dfr: "« Une pub pour ma clinique, 30 €/j, femmes 35-55 ans. » Texte, visuel et ciblage générés — en pause, prêts à relire.", den: "\"An ad for my clinic, €30/d, women 35-55.\" Copy, visual and targeting generated — paused, ready to review." },
  { n: "3", Ic: IconTrendingUp, fr: "Vous validez, on suit", en: "You approve, we track", dfr: "Rien ne part sans votre accord. Ensuite, le tableau de bord affiche vos vrais résultats, simplement.", den: "Nothing goes live without your approval. Then the dashboard shows your real results, simply." },
];

const REASSURE = [
  { Ic: IconLock, fr: "Vos données restent les vôtres", en: "Your data stays yours", dfr: "Comptes, visuels, chiffres : privés et chiffrés. Connexion via l'API officielle Meta, aucun mot de passe stocké.", den: "Accounts, visuals, numbers: private and encrypted. Official Meta API, no passwords stored." },
  { Ic: IconShieldCheck, fr: "Rien ne se publie sans vous", en: "Nothing posts without you", dfr: "Chaque post et chaque pub attend votre feu vert. Toujours.", den: "Every post and ad waits for your green light. Always." },
  { Ic: IconMic, fr: "Dans votre voix", en: "In your own voice", dfr: "Les assistants apprennent votre ton et écrivent comme vous, pas comme un robot.", den: "Your assistants learn your tone and write like you, not like a robot." },
  { Ic: IconAward, fr: "Sans engagement", en: "No commitment", dfr: "Démarrez gratuitement. Résiliez quand vous voulez. Support humain en français.", den: "Start free. Cancel anytime. Human support included." },
];

const FAQ = [
  { qfr: "Mes pubs partent-elles automatiquement sans que je valide ?", qen: "Do my ads go live automatically?", afr: "Non. Tout est créé EN PAUSE. Vous activez vous-même, quand vous êtes prêt.", aen: "No. Everything is created PAUSED. You activate it yourself, when ready." },
  { qfr: "Je n'y connais rien en publicité Meta. Ça marche quand même ?", qen: "I know nothing about Meta ads. Will it work?", afr: "Oui. L'assistant vous guide pas à pas : ciblage, budget conseillé et visuel générés pour vous.", aen: "Yes. The assistant guides you step by step: targeting, suggested budget and visual generated for you." },
  { qfr: "Je gère plusieurs marques. Comment ça se passe ?", qen: "I manage several brands. How does it work?", afr: "Chaque marque a son espace isolé (connexions, campagnes, médias). On passe de l'une à l'autre en un clic.", aen: "Each brand has its own isolated workspace. Switch between them in one click." },
  { qfr: "Combien ça coûte ?", qen: "How much does it cost?", afr: "Démarrez gratuitement, sans carte bancaire. Les plans payants débloquent l'IA avancée, les pubs et le multi-marques.", aen: "Start free, no credit card. Paid plans unlock advanced AI, ads and multi-brand." },
];

export default function Home() {
  const t = useT();
  const [capCat, setCapCat] = useState("ads");

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
      {/* Décor : mesh gradient + grain + réseau neuronal vivant pleine page */}
      <div className="mc-mesh" aria-hidden />
      <div className="mc-grain" aria-hidden />
      <div className="mc-livenet" aria-hidden>
        {/* Signature AXON : la constellation réagit au curseur sur TOUTE la page */}
        <NetworkCanvas density={1} intensity={1.8} pointerTarget="window" />
      </div>

      {/* ── Nav ── */}
      <header className="mc-nav">
        <Link href="/" className="mc-brand"><span className="mc-brand-dot" /> AXON<span>·AI</span></Link>
        <nav className="mc-navlinks">
          <a href="#reseau">{t("Le réseau", "The network")}</a>
          <a href="#capabilities">{t("Fonctionnalités", "Features")}</a>
          <a href="#showcase">{t("Aperçu", "Preview")}</a>
          <Link href="/agents">{t("Agents", "Agents")}</Link>
        </nav>
        <div className="mc-navcta">
          <LanguageSwitcher />
          <Link href="/dashboard" className="mc-btn mc-btn-ghost">{t("Entrer", "Enter")}</Link>
          <Link href="/demarrage" className="mc-btn mc-btn-glow">{t("Commencer", "Start")}</Link>
        </div>
      </header>

      {/* ── Héros plein écran : la Terre — le monde à portée ── */}
      <section className="mc-hero2">
        <div className="mc-hero2-globe"><GoogleEarth /></div>
        <div className="mc-hero2-scrim" aria-hidden />
        <div className="mc-hero2-copy">
          <span className="mc-eyebrow">{t("Le hub social des PME — le monde à portée", "The social hub for small teams — the world within reach")}</span>
          <h1 className="mc-h1 mc-h1-xl">
            {t("Le monde entier", "The whole world")}<br />
            <span className="mc-grad">{t("écoute votre marque.", "is listening to your brand.")}</span>
          </h1>
          <p className="mc-sub">
            {t(
              "Une équipe d'assistants IA publie vos posts, vos visuels et vos pubs sur Facebook, Instagram, LinkedIn et TikTok — de Paris à Port-Louis. Vous gardez la main : rien ne part sans votre feu vert.",
              "A team of AI assistants publishes your posts, visuals and ads on Facebook, Instagram, LinkedIn and TikTok — from Paris to Port-Louis. You stay in charge: nothing goes live without your green light."
            )}
          </p>
          <div className="mc-cta-row">
            <Link href="/demarrage" className="mc-btn mc-btn-glow mc-btn-lg">{t("Essayer gratuitement →", "Try it free →")}</Link>
            <Link href="/campaigns/new" className="mc-btn mc-btn-outline mc-btn-lg">{t("Voir une démo", "See a quick demo")}</Link>
          </div>
          <div className="mc-stats">
            {STATS.map((st) => (
              <div key={st.v} className="mc-stat"><b>{st.v}</b><span>{t(st.fr, st.en)}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Le concept : le système nerveux de la marque ── */}
      <section id="reseau" className="mc-section reveal">
        <header className="mc-sec-head" style={{ textAlign: "center" }}>
          <span className="mc-kicker">{t("Le concept", "The concept")}</span>
          <h2 className="mc-h2">{t("Votre marque a désormais un système nerveux.", "Your brand now has a nervous system.")}</h2>
          <p className="mc-sec-sub" style={{ margin: "0.8rem auto 0" }}>
            {t(
              "Votre voix entre d'un côté. Le noyau AXON l'orchestre entre six agents spécialisés — stratège, rédacteur, créatif, conformité, media buyer, analyste — et le publisher la transmet à vos communautés. Chaque impulsion que vous voyez circuler, c'est une décision qui se prend.",
              "Your voice comes in on one side. The AXON core orchestrates it across six specialist agents — strategist, copywriter, creative, compliance, media buyer, analyst — and the publisher carries it to your communities. Every pulse you see travelling is a decision being made."
            )}
          </p>
        </header>
        <Tilt3D max={9} className="mc-constellation-3d animate-float"><AgentConstellation /></Tilt3D>
      </section>




      {/* ── Fonctionnalités (toutes) ── */}
      <section id="capabilities" className="mc-section">
        <div className="mc-cap-head reveal">
          <header className="mc-sec-head mc-sec-head--left">
            <span className="mc-kicker">{t("Ce qu'on fait pour vous", "What we handle for you")}</span>
            <h2 className="mc-h2">{t("Tout votre social, au même endroit.", "Your whole social presence, in one place.")}</h2>
            <p className="mc-sec-sub">{t("De l'idée au message publié — vos assistants s'occupent de la création, la publication, les réponses et la veille. Cliquez sur une carte pour voir.", "From idea to published post — your assistants handle creation, publishing, replies and watch. Click a card to take a look.")}</p>
          </header>
          <Phone3D />
        </div>

        {/* Onglets dynamiques par catégorie — allège l'affichage (3-4 cartes) */}
        <div className="mc-tabs reveal" role="tablist">
          {CAP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={capCat === cat.id}
              onClick={() => setCapCat(cat.id)}
              className={`mc-tab ${capCat === cat.id ? "on" : ""}`}
            >
              {t(cat.fr, cat.en)}
            </button>
          ))}
        </div>

        <div key={capCat} className="mc-grid mc-grid-anim">
          {CAPABILITIES.map((c, i) => ({ c, i }))
            .filter(({ i }) => CAP_CAT_OF[i] === capCat)
            .map(({ c }, j) => (
              <Link key={c.fr} href={c.href} className="mc-card tilt reveal is-in" style={{ ["--c" as string]: c.c, transitionDelay: `${j * 70}ms` }}>
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




      {/* ── Trois étapes ── */}
      <section className="mc-section mc-section--warm">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">{t("Comment ça marche", "How it works")}</span>
          <h2 className="mc-h2">{t("Trois étapes. Cinq minutes. Vous gardez la main.", "Three steps. Five minutes. You stay in control.")}</h2>
        </header>
        <div className="mc-grid mc-grid-3">
          {HOW.map((h, i) => (
            <div key={h.n} className="mc-how reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="mc-how-n">{h.n}</span>
              <span className="mc-how-e"><h.Ic size={24} /></span>
              <h3>{t(h.fr, h.en)}</h3>
              <p>{t(h.dfr, h.den)}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ── Témoignages ── */}
      <section className="mc-section">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">{t("Ils nous font confiance", "Trusted by teams like yours")}</span>
          <h2 className="mc-h2">{t("Moins d'outils. Plus de résultats.", "Fewer tools. More results.")}</h2>
        </header>
        <div className="mc-grid">
          {TESTIMONIALS.map((tm, i) => {
            const L = NETWORKS[tm.net];
            return (
              <figure key={i} className="mc-quote reveal" style={{ transitionDelay: `${i * 90}ms` }}>
                <div className="mc-quote-top">
                  <span className="mc-avatar" style={{ background: tm.c }} aria-hidden>{tm.av}</span>
                  <L s={22} />
                </div>
                <blockquote>“{tm.q}”</blockquote>
                <figcaption>
                  {tm.a}
                  {tm.m && <span className="mc-quote-metric">{tm.m}</span>}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {/* ── Réassurance ── */}
      <section className="mc-section">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">{t("Vous pouvez nous faire confiance", "You can trust us")}</span>
          <h2 className="mc-h2">{t("L'IA fait le travail. Vous gardez la dernière décision.", "The AI does the work. You keep the final say.")}</h2>
        </header>
        <div className="mc-grid mc-grid-4">
          {REASSURE.map((r, i) => (
            <div key={r.fr} className="mc-trust reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="mc-trust-e"><r.Ic size={23} /></span>
              <h3>{t(r.fr, r.en)}</h3>
              <p>{t(r.dfr, r.den)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mc-section">
        <header className="mc-sec-head reveal">
          <span className="mc-kicker">{t("Questions fréquentes", "Frequently asked")}</span>
          <h2 className="mc-h2">{t("Tout ce que vous vous demandez sûrement.", "Everything you're probably wondering.")}</h2>
        </header>
        <div className="mc-faq">
          {FAQ.map((f, i) => (
            <details key={i} className="mc-faq-item reveal" style={{ transitionDelay: `${i * 60}ms` }}>
              <summary>{t(f.qfr, f.qen)}</summary>
              <p>{t(f.afr, f.aen)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="mc-final">
        <div className="mc-final-glow" aria-hidden />
        <h2 className="mc-h2">{t("Votre équipe marketing vient de s'agrandir — sans recruter.", "Your marketing team just grew — without hiring.")}</h2>
        <p>{t("Connectez vos comptes en 5 minutes. Vos assistants s'occupent du reste — et rien ne se publie sans votre accord.", "Connect your accounts in 5 minutes. Your assistants do the rest — and nothing posts without your say-so.")}</p>
        <div className="mc-cta-row mc-center">
          <Link href="/demarrage" className="mc-btn mc-btn-glow mc-btn-lg">{t("Essayer gratuitement", "Try it free")}</Link>
          <Link href="/dashboard" className="mc-btn mc-btn-outline mc-btn-lg">{t("Réserver une démo", "Book a demo")}</Link>
        </div>
        <p className="mc-reassure">{t("✓ Sans carte bancaire   ✓ Sans engagement   ✓ Support humain en français", "✓ No credit card   ✓ No commitment   ✓ Human support")}</p>
      </section>

      <footer className="mc-foot">
        <span>© {new Date().getFullYear()} AXON·AI</span>
        <span className="mc-foot-net">{NETWORKS.map((L, i) => <L key={i} s={18} />)}</span>
      </footer>
    </div>
  );
}
