"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useCompany } from "@/lib/company-context";
import { CompanyIndicator } from "./CompanyIndicator";

// Traductions des libellés de navigation (FR par défaut → EN).
const NAV_TR: Record<string, [string, string]> = {
  "Se déconnecter": ["Se déconnecter", "Sign out"],
  "Studio Avatar": ["Studio Avatar", "Avatar Studio"],
  "Aide & tutoriel": ["Aide & tutoriel", "Help & tutorial"],
  "Organisation": ["Organisation", "Organization"],
  "Mes sociétés": ["Mes sociétés", "My companies"],
  "Mon équipe": ["Mon équipe", "My team"],
  "Identité de marque": ["Identité de marque", "Brand identity"],
  "Dashboard": ["Tableau de bord", "Dashboard"],
  "Médiathèque": ["Médiathèque", "Media library"],
  "Modèles": ["Modèles", "Templates"],
  "Get started": ["Démarrage assisté", "Assisted onboarding"],
  "Modules": ["Modules", "Modules"],
  "Mes Pages": ["Mes Pages & données", "My Pages & data"],
  "Mon LinkedIn": ["Espace LinkedIn", "LinkedIn space"],
  "Pilotage IA": ["Veille & Stratégie", "Watch & Strategy"],
  "Centre de pilotage": ["Centre de pilotage", "Command Center"],
  "Agents": ["Agents", "Agents"],
  "Inbox": ["Messagerie", "Inbox"],
  "Veille & Marché": ["Veille & Marché", "Market Watch"],
  "Competitor Ads": ["Pubs concurrentes", "Competitor Ads"],
  "Simulateur": ["Simulateur & Prédiction", "Simulation & Prediction"],
  "Connecteurs": ["Connecteurs", "Connectors"],
  "Organic": ["Organique", "Organic"],
  "Compose": ["Composer", "Compose"],
  "Series": ["Séries", "Post series"],
  "Article LinkedIn": ["Article LinkedIn", "LinkedIn Article"],
  "Video Studio": ["Studio Créatif", "Creative Studio"],
  "Studio Affiches": ["Studio Affiches", "Poster Studio"],
  "Scheduled": ["Programmés", "Scheduled"],
  "Library": ["Bibliothèque", "Library"],
  "Automations": ["Automatisations", "Automations"],
  "History": ["Historique", "History"],
  "Paid Ads": ["Publicité", "Paid Ads"],
  "Campaigns": ["Campagnes", "Campaigns"],
  "Audiences": ["Audiences", "Audiences"],
  "Ad Performance": ["Performance Ads", "Ad Performance"],
  "General": ["Général", "General"],
  "Analytics": ["Analytics", "Analytics"],
  "Accounts": ["Comptes sociaux", "Accounts"],
  "Settings": ["Paramètres", "Settings"],
  "Pilotage & Bots": ["Pilotage & Bots", "Pilot & Bots"],
  "Telegram": ["Telegram", "Telegram"],
  "MCP Claude": ["Connecteur MCP", "MCP Connector"],
  // Sections restructurées (regroupement cohérent par tâche).
  "Création": ["Création", "Create"],
  "Publication": ["Publication", "Publishing"],
  "Analyse & Stratégie": ["Analyse & Stratégie", "Insights & Strategy"],
  "Publicité": ["Publicité", "Paid Ads"],
  "Connexions & réglages": ["Connexions & réglages", "Connections & settings"],
  "Replier le menu": ["Replier le menu", "Collapse menu"],
  "Déplier le menu": ["Déplier le menu", "Expand menu"],
};

/* ── Icônes SVG inline ─────────────────────────────────────────────── */
const ICONS: Record<string, React.ReactNode> = {
  "/mes-societes": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="5.5" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="8" y="2" width="5" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M9.5 4.5h2M9.5 6.5h2M9.5 8.5h2M4 7.5h1.5M4 9.5h1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  "/mon-equipe": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="10.5" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.7"/>
      <path d="M1.5 12.5c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M10.5 9c1.6.2 3 1.4 3 3.5" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  "/identite": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5l1.4 3.1 3.1 1.4-3.1 1.4-1.4 3.1-1.4-3.1L2.5 6l3.1-1.4L7.5 1.5Z"
            stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none"/>
      <circle cx="11.5" cy="11.5" r="1.6" stroke="currentColor" strokeWidth="1.1" fill="none"/>
    </svg>
  ),
  "/dashboard": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5L1.5 7H3v6h3.5v-4h2v4H12V7h1.5L7.5 1.5Z" fill="currentColor"/>
    </svg>
  ),
  "/pilotage": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="7.5" cy="7.5" r="1.6" fill="currentColor"/>
      <path d="M7.5 2v2M7.5 11v2M2 7.5h2M11 7.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  "/agents": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 2a2.2 2.2 0 0 0-2.2 2.2A2.2 2.2 0 0 0 4 8.3 2 2 0 0 0 6 11a1.7 1.7 0 0 0 1.5-.6A1.7 1.7 0 0 0 9 11a2 2 0 0 0 2-2.7 2.2 2.2 0 0 0-1.3-4.1A2.2 2.2 0 0 0 7.5 2Z"
            stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <path d="M7.5 4v7" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <circle cx="7.5" cy="13" r="1" fill="currentColor"/>
    </svg>
  ),
  "/inbox": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13 4v5a1.5 1.5 0 0 1-1.5 1.5H6l-2.5 2v-2H3.5A1.5 1.5 0 0 1 2 9V4Z"
            stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M5 5.5h5M5 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  "/compose": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M10.5 4.5l2 2-3.5 3.5H7V8.5l3.5-4Z" fill="currentColor" opacity="0.9"/>
    </svg>
  ),
  "/studio-affiche": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="3" y="1.5" width="9" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M5 4.5h5M5 6.5h5M5 8.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),
  "/article-linkedin": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M4.5 5.5h6M4.5 7.5h6M4.5 9.5h3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),
  "/scheduled": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M7.5 4v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  "/library": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2"   y="3" width="3"   height="9" rx="0.75" fill="currentColor" opacity="0.6"/>
      <rect x="6.5" y="3" width="3"   height="9" rx="0.75" fill="currentColor" opacity="0.9"/>
      <rect x="11"  y="3" width="2"   height="9" rx="0.75" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
  "/automations": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M4 7.5A3.5 3.5 0 0 1 7.5 4"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M11 7.5A3.5 3.5 0 0 1 7.5 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
      <path d="M5.5 2.5l-1.5 2h3L5.5 2.5Z"  fill="currentColor" opacity="0.75"/>
      <path d="M9.5 12.5l1.5-2H7.8l1.7 2Z"  fill="currentColor" opacity="0.75"/>
    </svg>
  ),
  "/history": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 7.5A5.5 5.5 0 1 0 7.5 2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M2 2v5.5H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/campaigns": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 10.5L5 5l3 4 2.5-5 2.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/audiences": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5" r="2"   stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="10"  cy="5" r="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.7"/>
      <path d="M1 12.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M11.5 9.5c1.5.3 2.5 1.5 2.5 3"         stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  "/ad-performance": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2"    y="9" width="2.5" height="4"  rx="0.5" fill="currentColor" opacity="0.55"/>
      <rect x="6.25" y="6" width="2.5" height="7"  rx="0.5" fill="currentColor" opacity="0.8"/>
      <rect x="10.5" y="3" width="2.5" height="10" rx="0.5" fill="currentColor"/>
    </svg>
  ),
  "/analytics": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M7.5 7.5L7.5 3.5"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M7.5 7.5L11 9.5"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.65"/>
    </svg>
  ),
  "/accounts": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="7.5" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <path d="M3.5 12c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  "/settings": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M7.5 1.5v1M7.5 12.5v1M1.5 7.5h1M12.5 7.5h1M3.1 3.1l.7.7M11.2 11.2l.7.7M11.2 3.1l-.7.7M3.8 10.5l-.7.7"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  "/connecteurs": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M6 9l3-3M5.5 4.5l1-1a2.1 2.1 0 0 1 3 3l-1 1M9.5 10.5l-1 1a2.1 2.1 0 0 1-3-3l1-1"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/parametres-connecteurs": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M6 9l3-3M5.5 4.5l1-1a2.1 2.1 0 0 1 3 3l-1 1M9.5 10.5l-1 1a2.1 2.1 0 0 1-3-3l1-1"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/pages-meta": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="5.5" cy="6" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <path d="M2.5 11l3-2.5 2 1.5 2.5-2 2.5 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/linkedin": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="4.7" cy="4.7" r="0.9" fill="currentColor"/>
      <path d="M4.7 6.8v4M7 6.8v4M7 8.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v2.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  "/veille": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="9" width="2.5" height="4.5" rx="0.5" fill="currentColor" opacity="0.45"/>
      <rect x="5.5" y="6" width="2.5" height="7.5" rx="0.5" fill="currentColor" opacity="0.7"/>
      <rect x="9.5" y="2.5" width="2.5" height="11" rx="0.5" fill="currentColor"/>
      <path d="M1.5 7 5 4.5 8 6.5 13 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"/>
    </svg>
  ),
  "/demarrage": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6L2 5.3l3.6-.5L7.5 1.5Z"
            stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/telegram": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M13 2.5L1.8 6.9c-.6.2-.6.8 0 1l2.7.85 1.05 3.3c.13.4.35.45.6.2L7.9 10.3l2.6 1.9c.35.25.65.12.74-.32L13.8 3.2c.12-.55-.2-.85-.8-.7Z"
            stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none"/>
      <path d="M4.5 7.9 11 4.2 6.1 8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6"/>
    </svg>
  ),
  "/mcp": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="3" cy="3" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <circle cx="12" cy="3" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <circle cx="3" cy="12" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <circle cx="12" cy="12" r="1.3" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <path d="M4 4l2 2M11 4L9 6M4 11l2-2M11 11L9 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
  "/publicites": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M4 13h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M5.5 5.5l3 1.5-3 1.5v-3Z" fill="currentColor"/>
    </svg>
  ),
  "/simulateur": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M3.5 13h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M5.5 4.8a2.3 2.3 0 0 1 2-1" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  "/benchmark": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 13V2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M2 13h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <rect x="4" y="8" width="2.2" height="3.5" fill="currentColor"/>
      <rect x="7.4" y="5.5" width="2.2" height="6" fill="currentColor"/>
      <rect x="10.8" y="3" width="2.2" height="8.5" fill="currentColor"/>
    </svg>
  ),
  "/studio-video": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M10.5 6.5 13.5 5v5l-3-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M4.5 6.5 7 7.5 4.5 8.5V6.5Z" fill="currentColor"/>
    </svg>
  ),
  "/studio-avatar": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M3 12.5c0-2.2 2-3.6 4.5-3.6s4.5 1.4 4.5 3.6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M12.2 3.2c.8.8.8 2.1 0 2.9M13.6 1.9c1.5 1.5 1.5 3.9 0 5.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
  "/media": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="5.3" cy="5.8" r="1.1" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <path d="M2.5 11l3.2-3 2.3 2 2-1.8 2.5 2.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
};

type NavItem = { href: string; label: string; adminOnly?: boolean };
type NavGroup = { id: string; label: string; items: NavItem[] };

/* ── Colonne vertébrale ────────────────────────────────────────────────
   Le cockpit quotidien, toujours visible : on démarre, on pilote depuis le
   tableau de bord et le centre de pilotage. Le reste est rangé dans des
   sections repliables (« fermeture »), regroupées par tâche. */
const SPINE: NavItem[] = [
  { href: "/demarrage", label: "Get started" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pilotage",  label: "Centre de pilotage" },
];

/* ── Sections repliables — regroupement cohérent par tâche ──────────────
   1. Organisation : la marque, les sociétés, l'équipe.
   2. Création : tous les studios qui produisent du contenu.
   3. Publication : programmer, automatiser, publier, échanger.
   4. Analyse & Stratégie : mesurer, surveiller, prédire.
   5. Publicité : campagnes payantes Meta.
   6. Connexions & réglages : comptes, connecteurs, bots, paramètres. */
const GROUPS: NavGroup[] = [
  {
    id: "org",
    label: "Organisation",
    items: [
      { href: "/identite",     label: "Identité de marque" },
      { href: "/mes-societes", label: "Mes sociétés" },
      { href: "/mon-equipe",   label: "Mon équipe", adminOnly: true },
    ],
  },
  {
    id: "create",
    label: "Création",
    items: [
      { href: "/compose",       label: "Compose" },
      { href: "/studio-video",  label: "Video Studio" },
      { href: "/studio-avatar", label: "Studio Avatar" },
      { href: "/studio-affiche", label: "Studio Affiches" },
      { href: "/media",         label: "Médiathèque" },
      { href: "/library",       label: "Modèles" },
    ],
  },
  {
    id: "publish",
    label: "Publication",
    items: [
      { href: "/scheduled",   label: "Scheduled" },
      { href: "/series",      label: "Series" },
      { href: "/automations", label: "Automations" },
      { href: "/history",     label: "History" },
      { href: "/inbox",       label: "Inbox" },
      { href: "/linkedin",    label: "Mon LinkedIn" },
      { href: "/pages-meta",  label: "Mes Pages" },
    ],
  },
  {
    id: "intel",
    label: "Analyse & Stratégie",
    items: [
      { href: "/analytics",  label: "Analytics" },
      { href: "/veille",     label: "Veille & Marché" },
      { href: "/publicites", label: "Competitor Ads" },
      { href: "/benchmark",  label: "Benchmark" },
      { href: "/simulateur", label: "Simulateur" },
      { href: "/agents",     label: "Agents" },
    ],
  },
  {
    id: "paid",
    label: "Publicité",
    items: [
      { href: "/campaigns",      label: "Campaigns" },
      { href: "/audiences",      label: "Audiences" },
      { href: "/ad-performance", label: "Ad Performance" },
    ],
  },
  {
    id: "settings",
    label: "Connexions & réglages",
    items: [
      { href: "/accounts",               label: "Accounts" },
      { href: "/parametres-connecteurs", label: "Connecteurs" },
      { href: "/telegram",               label: "Telegram" },
      { href: "/mcp",                    label: "MCP Claude" },
      { href: "/settings",               label: "Settings" },
    ],
  },
];

const NAV_GROUPS_KEY = "sh_nav_groups";
const NAV_COLLAPSED_KEY = "sh_nav_collapsed";

export function Sidebar({
  onNavigate,
  collapsible = false,
}: {
  onNavigate?: () => void;
  /** Active le mode « rail » repliable (desktop). Désactivé dans le tiroir mobile. */
  collapsible?: boolean;
} = {}) {
  const pathname = usePathname();
  const t = useT();
  const { access } = useCompany();
  const tr = (s: string) => { const e = NAV_TR[s]; return e ? t(e[0], e[1]) : s; };
  // Masque les entrées réservées à l'admin du compte (ex. « Mon équipe »).
  const canSee = (item: NavItem) => !item.adminOnly || access.isAccountAdmin;

  const isActive = (href: string) => pathname.startsWith(href);

  // Section contenant la page courante (toujours ouverte par défaut).
  const activeGroupId = GROUPS.find((g) => g.items.some((it) => isActive(it.href)))?.id;

  // ── Sections repliables (« fermeture ») — état persistant par utilisateur.
  // Défaut (déterministe SSR) : seule la section active est ouverte → barre
  // compacte. Le choix de l'utilisateur (clic) est mémorisé dans localStorage.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_GROUPS_KEY);
      if (raw) setOpenMap(JSON.parse(raw) as Record<string, boolean>);
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(openMap)); } catch { /* ignore */ }
  }, [openMap, ready]);

  // À la navigation, garde la section de la page courante ouverte.
  useEffect(() => {
    if (!ready || !activeGroupId) return;
    setOpenMap((m) => (m[activeGroupId] ? m : { ...m, [activeGroupId]: true }));
  }, [pathname, ready, activeGroupId]);

  // Une section est ouverte si l'utilisateur l'a ouverte, sinon par défaut
  // si elle contient la page courante.
  const isGroupOpen = (g: NavGroup) => openMap[g.id] ?? g.id === activeGroupId;
  const toggleGroup = (id: string) =>
    setOpenMap((m) => ({ ...m, [id]: !(m[id] ?? id === activeGroupId) }));

  // ── Mode « rail » : repli de TOUTE la barre en icônes (desktop), persistant.
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedReady, setCollapsedReady] = useState(false);
  useEffect(() => {
    if (!collapsible) return;
    try {
      const v = window.localStorage.getItem(NAV_COLLAPSED_KEY);
      if (v) setCollapsed(v === "1");
    } catch { /* ignore */ }
    setCollapsedReady(true);
  }, [collapsible]);
  useEffect(() => {
    if (!collapsible || !collapsedReady) return;
    try { window.localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed, collapsible, collapsedReady]);
  const rail = collapsible && collapsed;

  // Rendu d'un lien de navigation. `entry` met en avant la porte d'entrée
  // (Démarrage) avec une teinte d'accent permanente.
  const renderItem = (item: NavItem, opts?: { entry?: boolean }) => {
    const active = isActive(item.href);
    const icon = ICONS[item.href];
    const entry = opts?.entry;

    // Rail (icônes seules) : libellé en infobulle, état actif conservé.
    if (rail) {
      return (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={tr(item.label)}
            className={[
              "group relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg",
              "transition-all duration-[120ms]",
              active
                ? "bg-page/20 text-ink"
                : entry
                ? "bg-page/15 text-ink"
                : "text-muted hover:bg-white/[0.06] hover:text-ink",
            ].join(" ")}
          >
            {active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-page" />}
            <span className={active || entry ? "opacity-100" : "opacity-55 group-hover:opacity-80"}>{icon}</span>
          </Link>
        </li>
      );
    }

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={[
            "group relative flex items-center gap-2.5 rounded-lg px-3 py-[0.4rem] text-sm",
            "transition-all duration-[120ms]",
            active
              ? "bg-page/20 text-ink font-semibold"
              : entry
              ? "bg-page/15 text-ink font-semibold hover:bg-page/25"
              : "text-muted hover:bg-white/[0.06] hover:text-ink",
          ].join(" ")}
        >
          {active && (
            <span
              aria-hidden="true"
              className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-page"
            />
          )}
          <span
            className={[
              "shrink-0 transition-opacity duration-[120ms]",
              active || entry ? "opacity-100" : "opacity-45 group-hover:opacity-65",
            ].join(" ")}
          >
            {icon}
          </span>
          <span className={active || entry ? "font-semibold" : "font-medium"}>
            {tr(item.label)}
          </span>
        </Link>
      </li>
    );
  };

  const logout = (
    <a
      href="/api/auth/logout"
      onClick={() => { try { window.localStorage.removeItem("sh_company_id"); } catch { /* ignore */ } }}
      className={[
        "flex items-center justify-center rounded-lg bg-danger-500 font-semibold text-white shadow-sm transition-all duration-[120ms] hover:bg-[#e11d48] active:scale-[0.98]",
        rail ? "mx-auto h-9 w-9" : "w-full gap-2.5 px-3 py-[0.45rem] text-sm",
      ].join(" ")}
      title={tr("Se déconnecter")}
      aria-label={tr("Se déconnecter")}
    >
      <span className="shrink-0">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10 10l3-3-3-3M13 7H5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      {!rail && <span>{tr("Se déconnecter")}</span>}
    </a>
  );

  return (
    <nav
      aria-label="Navigation principale"
      className={[
        "shrink-0 border-r border-hair py-5 transition-[width] duration-200",
        rail ? "w-[3.75rem] px-2" : "w-[13.5rem] pl-3 pr-2",
      ].join(" ")}
    >
      {/* Bouton de repli de TOUTE la barre (rail) — desktop uniquement. */}
      {collapsible && (
        <div className={rail ? "mb-3 flex justify-center" : "mb-2 flex justify-end pr-1"}>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!rail}
            aria-label={rail ? tr("Déplier le menu") : tr("Replier le menu")}
            title={rail ? tr("Déplier le menu") : tr("Replier le menu")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"
              className={`transition-transform duration-200 ${rail ? "rotate-180" : ""}`}>
              <path d="M9.5 3.5l-4 4 4 4M12 3.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Sélecteur de société — masqué en mode rail (icônes seules). */}
      {!rail && (
        <div className="mb-4 pr-1">
          <CompanyIndicator />
        </div>
      )}

      {/* Colonne vertébrale : le cockpit quotidien, toujours visible */}
      <ul className="space-y-px" role="list">
        {SPINE.map((item) => renderItem(item, { entry: item.href === "/demarrage" }))}
      </ul>

      {/* Séparateur colonne vertébrale / sections */}
      <div className={rail ? "mx-auto my-3 h-px w-6 bg-hair" : "mt-5 mb-4 h-px bg-hair"} />

      {rail
        ? /* Rail : toutes les entrées en icônes, séparées par section. */
          GROUPS.map((group, i) => {
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                {i > 0 && <div className="mx-auto my-2 h-px w-6 bg-hair" />}
                <ul className="space-y-px" role="list" aria-label={tr(group.label)}>
                  {items.map((item) => renderItem(item))}
                </ul>
              </div>
            );
          })
        : /* Déployé : sections repliables (accordéon). */
          GROUPS.map((group, i) => {
            const open = isGroupOpen(group);
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            const hasActive = items.some((it) => isActive(it.href));
            const panelId = `nav-group-${group.id}`;
            return (
              <div key={group.id} className={i > 0 ? "mt-3" : ""}>
                {/* En-tête de section CLIQUABLE : déplie/replie (accordéon). */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="group/sec flex w-full items-center justify-between gap-2 rounded-md px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/60 transition-colors hover:text-muted"
                >
                  <span className="flex items-center gap-1.5 select-none">
                    {tr(group.label)}
                    {/* Pastille discrète si la page active est dans une section repliée. */}
                    {!open && hasActive && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-page" />}
                  </span>
                  <svg
                    width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                    className={`shrink-0 opacity-50 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                  >
                    <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <ul id={panelId} role="list" className={`space-y-px overflow-hidden ${open ? "mt-0.5" : "hidden"}`}>
                  {items.map((item) => renderItem(item))}
                </ul>
              </div>
            );
          })}

      {/* Déconnexion */}
      <div className="mt-5">{logout}</div>
    </nav>
  );
}
