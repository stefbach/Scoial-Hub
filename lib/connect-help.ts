/**
 * lib/connect-help.ts
 *
 * Aide à la connexion DÉCLARATIVE, par réseau social.
 *
 * Une seule source de vérité pour l'assistant guidé (`ConnectGuide`) : pour
 * CHAQUE réseau, on décrit en clair « ce qui va se passer » (étapes), une
 * note de réassurance, une astuce, et la route OAuth à lancer. Ajouter un
 * réseau = ajouter une entrée ici (cohérent avec le registre des connecteurs).
 *
 * Textes bilingues `{ fr, en }` rendus selon la locale courante côté composant.
 */

/** Clé d'aide = manière dont la connexion est initiée (Meta regroupe FB+IG). */
export type ConnectHelpKey =
  | "meta"
  | "linkedin"
  | "twitter"
  | "pinterest"
  | "threads"
  | "tiktok";

/** Texte localisable. */
export interface Bilingual {
  fr: string;
  en: string;
}

export interface ConnectHelp {
  /** Titre du modal. */
  title: Bilingual;
  /** Sous-titre de réassurance (sécurité). */
  secure: Bilingual;
  /** Étapes « voici ce qui va se passer », dans l'ordre. */
  steps: Bilingual[];
  /** Astuce facultative (encadré). */
  tip?: Bilingual;
  /**
   * Route OAuth à lancer (sans query). Vide = pas de connexion automatique
   * (le réseau se prépare/programme mais se publie manuellement).
   */
  authPath: string;
  /** Libellé du bouton d'action principal. */
  cta?: Bilingual;
}

const SECURE_DEFAULT: Bilingual = {
  fr: "Connexion sécurisée — aucune clé ni mot de passe à copier.",
  en: "Secure connection — no key or password to copy.",
};

export const CONNECT_HELP: Record<ConnectHelpKey, ConnectHelp> = {
  meta: {
    title: { fr: "Connecter Facebook & Instagram", en: "Connect Facebook & Instagram" },
    secure: SECURE_DEFAULT,
    steps: [
      { fr: "Cliquez « Continuer » : vous êtes redirigé vers Facebook.", en: "Click “Continue”: you'll be redirected to Facebook." },
      { fr: "Choisissez votre Page et acceptez les autorisations demandées.", en: "Choose your Page and accept the requested permissions." },
      { fr: "Vous revenez ici, connecté — Facebook ET Instagram d'un coup.", en: "You come back here, connected — both Facebook AND Instagram." },
    ],
    tip: {
      fr: "Astuce : connectez le compte qui gère la Page de cette société.",
      en: "Tip: connect the account that manages this company's Page.",
    },
    authPath: "/api/connectors/facebook/auth",
  },

  linkedin: {
    title: { fr: "Connecter LinkedIn", en: "Connect LinkedIn" },
    secure: SECURE_DEFAULT,
    steps: [
      { fr: "Cliquez « Continuer » : vous êtes redirigé vers LinkedIn.", en: "Click “Continue”: you'll be redirected to LinkedIn." },
      { fr: "Acceptez l'accès demandé (publication en votre nom).", en: "Accept the requested access (posting on your behalf)." },
      { fr: "Vous revenez ici, connecté. Choisissez ensuite profil ou Page.", en: "You come back here, connected. Then choose profile or Page." },
    ],
    tip: {
      fr: "Pour publier sur une Page entreprise, l'accès « Community Management » LinkedIn est requis.",
      en: "To publish on a company Page, LinkedIn's “Community Management” access is required.",
    },
    authPath: "/api/connectors/linkedin/auth",
  },

  twitter: {
    title: { fr: "Connecter Twitter / X", en: "Connect Twitter / X" },
    secure: SECURE_DEFAULT,
    steps: [
      { fr: "Cliquez « Continuer » : vous êtes redirigé vers X (Twitter).", en: "Click “Continue”: you'll be redirected to X (Twitter)." },
      { fr: "Connectez-vous et autorisez la publication de tweets en votre nom.", en: "Sign in and authorize posting tweets on your behalf." },
      { fr: "Vous revenez ici, connecté — prêt à publier.", en: "You come back here, connected — ready to post." },
    ],
    tip: {
      fr: "Le compte connecté doit avoir les droits d'écriture (publication de tweets).",
      en: "The connected account must have write access (posting tweets).",
    },
    authPath: "/api/connectors/twitter/auth",
  },

  pinterest: {
    title: { fr: "Connecter Pinterest", en: "Connect Pinterest" },
    secure: SECURE_DEFAULT,
    steps: [
      { fr: "Cliquez « Continuer » : vous êtes redirigé vers Pinterest.", en: "Click “Continue”: you'll be redirected to Pinterest." },
      { fr: "Autorisez l'accès à vos tableaux (boards) et la création de Pins.", en: "Authorize access to your boards and Pin creation." },
      { fr: "Vous revenez ici, connecté. Choisissez ensuite le tableau cible.", en: "You come back here, connected. Then pick the target board." },
    ],
    tip: {
      fr: "Un Pin exige une image et un tableau cible : préparez un visuel avant de publier.",
      en: "A Pin requires an image and a target board: prepare a visual before posting.",
    },
    authPath: "/api/connectors/pinterest/auth",
  },

  threads: {
    title: { fr: "Connecter Threads", en: "Connect Threads" },
    secure: SECURE_DEFAULT,
    steps: [
      { fr: "Cliquez « Continuer » : vous êtes redirigé vers Threads (Meta).", en: "Click “Continue”: you'll be redirected to Threads (Meta)." },
      { fr: "Autorisez la publication sur votre compte Threads.", en: "Authorize posting to your Threads account." },
      { fr: "Vous revenez ici, connecté — prêt à publier.", en: "You come back here, connected — ready to post." },
    ],
    tip: {
      fr: "Threads nécessite un compte professionnel lié à votre espace Meta.",
      en: "Threads requires a professional account linked to your Meta workspace.",
    },
    authPath: "/api/connectors/threads/auth",
  },

  tiktok: {
    title: { fr: "Connecter TikTok", en: "Connect TikTok" },
    secure: SECURE_DEFAULT,
    steps: [
      { fr: "Cliquez « Continuer » : vous êtes redirigé vers TikTok.", en: "Click “Continue”: you'll be redirected to TikTok." },
      { fr: "Connectez-vous et autorisez la publication de vidéos en votre nom.", en: "Sign in and authorize posting videos on your behalf." },
      { fr: "Vous revenez ici, connecté — prêt à publier vos vidéos.", en: "You come back here, connected — ready to post your videos." },
    ],
    tip: {
      fr: "TikTok est une plateforme vidéo : une vidéo est requise. La publication PUBLIQUE nécessite une app TikTok auditée (sinon, publication privée).",
      en: "TikTok is a video platform: a video is required. PUBLIC posting requires an audited TikTok app (otherwise, private posting).",
    },
    authPath: "/api/connectors/tiktok/auth",
  },
};

/** Retourne l'aide d'un réseau, ou `undefined` si non décrite. */
export function connectHelp(key: string): ConnectHelp | undefined {
  return (CONNECT_HELP as Record<string, ConnectHelp>)[key];
}
