// Vérifie que l'aide contextuelle (/demarrage, /dashboard, /pilotage) décrit
// le comportement RÉEL de l'app, suite à l'audit BUGSSocialHub28.docx (16
// écarts aide/code : mauvais nom de module, fausses étapes, fausses métriques,
// fonctionnalités inexistantes présentées comme actives…).
// Lancement : npx tsx scripts/verify-help-accuracy.ts

import { getHelp } from "../lib/help/registry";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ ÉCHEC"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
function full(pathname: string, lang: "fr" | "en" = "fr"): string {
  const e = getHelp(pathname, lang);
  return [e.title, e.tagline, e.whatFor, ...e.actions.flatMap((a) => [a.label, a.detail]), ...e.tips, ...e.faq.flatMap((f) => [f.q, f.a]), ...(e.shortcuts ?? [])].join(" \n ");
}

console.log("\n— /demarrage (BUG 1-9) —");
{
  const fr = full("/demarrage", "fr");
  const en = full("/demarrage", "en");
  check("BUG 1 — le module s'appelle « Démarrage assisté », plus « Démarrage guidé »", getHelp("/demarrage", "fr").title === "Démarrage assisté", getHelp("/demarrage", "fr").title);
  check("BUG 1 — aucune trace de « Démarrage guidé » nulle part dans le registre", !/Démarrage guidé|Guided onboarding/.test(full("/dashboard") + full("/pilotage") + full("/agents") + full("/telegram") + full("/mcp") + full("/demarrage")));
  check("BUG 2 — les 6 vraies étapes sont citées", /Mon identité/.test(fr) && /Mes objectifs/.test(fr) && /Concurrence/.test(fr) && /Création des visuels/.test(fr) && /Lancer les agents IA/.test(fr) && /Diffusion/.test(fr));
  check("BUG 2 — Telegram/MCP ne sont plus présentés comme des étapes du parcours", !/activer le bot Telegram|brancher Claude \(MCP\)/.test(fr));
  check("BUG 3 — ne décrit plus des « cartes » ouvrant d'autres pages", !/carte numérotée|ouvre la page correspondante/.test(fr));
  check("BUG 3 — décrit le vrai rail à cercles, une seule page", /cercles numérotés/.test(fr) && /restez sur la même page/.test(fr));
  check("BUG 4 — la barre de progression n'est plus liée à Telegram/réseaux connectés", !/réseaux connectés, Telegram activé/.test(fr));
  check("BUG 5 — aucune mention d'étapes « À explorer »", !/À explorer/.test(fr));
  check("BUG 6 — l'astuce ne parle plus d'une étape « Connecteurs »", !/étape 1 \(Connecteurs\)/.test(fr));
  check("BUG 6 — reformulée autour de l'étape 1 « Mon identité »", /étape 1 \(Mon identité\)/.test(fr));
  check("BUG 7 — l'étape 0 (consultant de marque IA) est mentionnée", /consultant de marque IA/.test(fr) && /étape 0/.test(fr));
  check("BUG 7 — la façon de la passer est mentionnée", /Construire l.identité plus tard/.test(fr));
  check("BUG 8 — la FAQ ne renvoie plus vers « étapes 1 et 3 »/Telegram/MCP comme reste", !/étapes 1 et 3.*Telegram, MCP/.test(fr));
  check("BUG 9 — plus de promesse MCP dans le texte (related reste cohérent)", !/brancher Claude \(MCP\)/.test(fr) && !/MCP/.test(fr));
  check("EN mirror — title", getHelp("/demarrage", "en").title === "Assisted onboarding");
  void en;
}

console.log("\n— /dashboard (BUG 10-14) —");
{
  const fr = full("/dashboard", "fr");
  check("BUG 10 — ne promet plus « portée »/« engagement »", !/portée|engagement/i.test(fr));
  check("BUG 10 — décrit les vraies métriques organiques", /Programmés/.test(fr) && /Publiés/.test(fr) && /Posts en échec/.test(fr));
  check("BUG 10 — décrit les vraies métriques payantes", /Campagnes actives/.test(fr) && /Conversions/.test(fr) && /Budget IA/.test(fr));
  check("BUG 11 — plus de flèche de tendance rouge/verte inexistante", !/flèche (verte|rouge)/i.test(fr) && !/tendance instantanée/.test(fr));
  check("BUG 12 — plus de « cartes d'alerte » à badges orange/rouge", !/carte[s]? d.alerte/i.test(fr) && !/badge orange/i.test(fr));
  check("BUG 13 — le sélecteur de marque est dans la barre latérale, pas « en haut à gauche du tableau »", /barre latérale/.test(fr) && !/sélecteur de marque en haut à gauche/.test(fr));
  check("BUG 14 — le « — » n'est plus présenté comme lié aux connecteurs/tokens", !/métriques affichent[\s\S]*—[\s\S]*connecteur/i.test(fr));
}

console.log("\n— /pilotage (BUG 15-16) —");
{
  const fr = full("/pilotage", "fr");
  check("BUG 15 — « Valider » n'est plus décrit comme exécutant réellement la décision", !/envoie la décision en exécution/.test(fr));
  check("BUG 15 — décrit le vrai comportement (changement d'étiquette local)", /n.exécute.*(l.action réelle|réellement)|marque la décision comme approuvée/.test(fr));
  check("BUG 16 — le benchmark n'est plus présenté comme une fonctionnalité active", !/Une flèche verte indique que vous surpassez la moyenne/.test(fr));
  check("BUG 16 — précise que le tableau reste vide (fonctionnalité non développée)", /reste vide/.test(fr));
}

console.log("\n— /compose (audit large, session apprentissage) —");
{
  const fr = full("/compose", "fr");
  check("mentionne TikTok comme réseau cible (pas seulement FB/IG/LinkedIn)", /TikTok/.test(fr));
  check("ne décrit plus de ciblage d'audience inexistant en Compose", !/Cibler une audience/.test(fr));
  check("mentionne le créneau suggéré/appris à la programmation", /créneau suggéré|Un bandeau propose un créneau/.test(fr));
  check("EN mirror — title", getHelp("/compose", "en").title === "Compose");
}

console.log("\n— /compose (BUGSSocialHub30 4-11) —");
{
  const fr = full("/compose", "fr");
  check("BUG 4 — LinkedIn n'est plus présenté comme ciblable depuis Composer", !/cibler un post pour Facebook, Instagram, LinkedIn ou TikTok/.test(fr));
  check("BUG 4 — précise que LinkedIn a son propre espace dédié", /LinkedIn n.est pas ciblable depuis Composer/.test(fr) && /Espace LinkedIn/.test(fr));
  check("BUG 5 — ne prétend plus qu'un compteur de caractères existe", !/Un compteur de caractères indique/.test(fr));
  check("BUG 5 — précise l'absence de compteur de caractères", /Aucun compteur de caractères/.test(fr));
  check("BUG 6 — ne décrit plus une étoile cliquable ouvrant l'assistant", !/icône étoile ouvre l.assistant IA/.test(fr));
  check("BUG 6 — décrit le bloc agent toujours visible et l'étoile décorative", /visible en permanence/.test(fr) && /icône décorative/.test(fr));
  check("BUG 7 — ne prétend plus générer 3 variantes", !/générer 3 variantes/.test(fr));
  check("BUG 7 — précise un seul texte par réseau", /un seul texte par réseau ciblé/.test(fr));
  check("BUG 8 — ne prétend plus des dimensions dynamiques par réseau", !/dimensions recommandées sont indiquées dynamiquement/.test(fr));
  check("BUG 8 — précise un message fixe identique quel que soit le réseau", /identiques quel que soit le réseau ciblé/.test(fr));
  check("BUG 9 — ne prétend plus un redimensionnement automatique", !/automatiquement redimensionnés/.test(fr));
  check("BUG 9 — précise le rejet d'un fichier trop volumineux", /refusé avec un message d.erreur/.test(fr));
  check("BUG 10 — ne prétend plus qu'un brouillon va dans la Bibliothèque", !/stocke le contenu dans la Bibliothèque/.test(fr));
  check("BUG 10 — distingue Brouillons (Publications programmées) et « Enregistrer dans la bibliothèque »", /onglet « Brouillons » de Publications programmées/.test(fr) && /Enregistrer dans la bibliothèque/.test(fr));
  check("BUG 11 — décrit le sélecteur de langue (10 langues)", /10 \(Français, Kreol Morisien/.test(fr));
  check("BUG 11 — décrit le choix de modèle IA et l'option premium payante", /Autoriser les modèles premium/.test(fr));
  check("BUG 11 — décrit le montage intégré (texte, musique, découpe)", /banc de montage intégré directement dans Compose/.test(fr));
  check("BUG 11 — décrit la sauvegarde automatique après 2,5 s", /2,5 secondes d.inactivité/.test(fr));
  check("BUG 11 — décrit le Brand Kit et l'inspiration créative (veille)", /Brand Kit/.test(fr) && /S.inspirer d.une créa existante/.test(fr));
  check("BUG 11 — décrit la modification d'un post déjà programmé sans doublon", /met à jour ce post existant, sans créer de doublon/.test(fr));
}

console.log("\n— /ad-performance (audit large, session apprentissage) —");
{
  const fr = full("/ad-performance", "fr");
  check("le whatFor ne prétend plus couvrir LinkedIn Ads (seuls Facebook/Instagram sont réels ici)", !/LinkedIn Ads/.test(getHelp("/ad-performance", "fr").whatFor));
  check("aucune mention de ROAS (métrique inexistante sur cet écran)", !/ROAS/.test(fr));
  check("aucun benchmark sectoriel inventé (CPC 2-4€, etc.)", !/benchmark[s]? sectoriel/i.test(fr));
  check("décrit le Cerveau Pub", /Cerveau Pub/.test(fr));
  check("décrit le Pilote Pub", /Pilote Pub/.test(fr));
}

console.log("\n— /scheduled (audit large, session apprentissage) —");
{
  const fr = full("/scheduled", "fr");
  check("ne décrit plus de reprogrammation par glisser-déposer comme fonctionnalité active", !/[Ff]aites glisser un post|glisser-déposer pour le reprogrammer/.test(fr));
  check("« Supprimer » n'est plus présenté comme une mise en brouillon", !/transforme le post en brouillon/.test(fr));
  check("décrit le workflow de validation (onglet À valider)", /À valider/.test(fr) && /workflow de validation/i.test(fr));
}

console.log("\n— /settings (audit large, session apprentissage) —");
{
  const fr = full("/settings", "fr");
  check("ne promet plus de webhooks sortants (fonctionnalité inexistante)", !/webhooks? sortant/i.test(fr));
  check("ne promet plus une facturation fonctionnelle (bouton désactivé dans le vrai code)", !/gérez vos informations de paiement/.test(fr));
  check("mentionne le workflow de validation et où l'activer", /[Ww]orkflow de validation/.test(fr));
}

console.log("\n— /agents (page morte → redirige vers /pilotage) —");
{
  const fr = full("/agents", "fr");
  check("ne décrit plus d'agents « Planificateur »/« Optimiseur » inexistants", !/Planificateur|Optimiseur/.test(fr));
  check("explique la redirection réelle vers /pilotage", /redirige/i.test(fr) && /\/pilotage/.test(fr));
}

console.log("\n— /library (page morte → redirige vers /media) —");
{
  const fr = full("/library", "fr");
  check("explique la redirection réelle vers /media", /redirige/i.test(fr) && /\/media/.test(fr));
}

console.log("\n— /article-linkedin (page morte → fusionnée dans /linkedin) —");
{
  const fr = full("/article-linkedin", "fr");
  check("explique la fusion/redirection vers /linkedin", /\/linkedin/.test(fr));
}

console.log("\n— /history (audit large, session apprentissage) —");
{
  const fr = full("/history", "fr");
  check("ne promet plus impressions/portée inexistantes sur cet écran", !/portée sur 7 jours|taux d.engagement sur 7/i.test(fr));
  check("le bouton réel est « Dupliquer » et non « Réutiliser »", /Dupliquer/.test(fr));
}

console.log("\n— /campaigns (audit large, session apprentissage) —");
{
  const fr = full("/campaigns", "fr");
  check("ne décrit plus de lien entre posts organiques et campagnes (inexistant)", !/[Ll]ier des posts organiques/.test(fr));
  check("précise que les campagnes sont Facebook/Instagram uniquement (pas LinkedIn)", /Facebook.*Instagram|Meta/i.test(getHelp("/campaigns", "fr").whatFor));
}

console.log("\n— /audiences (audit large, session apprentissage) —");
{
  const fr = full("/audiences", "fr");
  check("aucune fourchette de taille d'audience inventée (500k-5M)", !/500\s*000|500k.*5\s*M/i.test(fr));
  check("le hachage CSV est décrit comme local au navigateur, pas serveur", /navigateur|client/i.test(fr));
}

console.log("\n— /analytics (audit large, session apprentissage) —");
{
  const fr = full("/analytics", "fr");
  check("ne décrit plus de « Top Posts » inexistant", !/Top Posts/.test(fr));
  check("ne décrit plus de mode Comparaison inexistant", !/mode Comparaison/i.test(fr));
  check("ne promet plus d'export PDF (seuls CSV/JSON existent)", !/export PDF/i.test(fr));
  check("précise que les données payantes (Dépenses/Conversions) sont bien incluses", /[Dd]épenses.*[Cc]onversions|Ad spend/i.test(full("/analytics", "fr") + full("/analytics", "en")));
}

console.log("\n— /accounts (audit large, session apprentissage) —");
{
  const fr = full("/accounts", "fr");
  check("ne décrit plus de badge « Token expiré » inexistant", !/[Tt]oken expiré/.test(fr));
  check("décrit les 4 cartes fixes réelles (Facebook/Instagram/LinkedIn/TikTok)", /Facebook/.test(fr) && /Instagram/.test(fr) && /LinkedIn/.test(fr) && /TikTok/.test(fr));
}

console.log("\n— /parametres-connecteurs (audit large, session apprentissage) —");
{
  const fr = full("/parametres-connecteurs", "fr");
  check("ne décrit plus de configuration manuelle Anthropic/Replicate/YouTube (fonctionnalités intégrées)", !/clé Anthropic|clé Replicate/i.test(fr));
  check("ne décrit plus de champs manuels pour Meta Ads/Pixel (auto-activés)", !/configurer.{0,20}Meta Ads|configurer.{0,20}Pixel/i.test(fr));
}

console.log("\n— /mon-equipe (audit large, session apprentissage) —");
{
  const fr = full("/mon-equipe", "fr");
  check("mentionne le bouton réel « Envoyer depuis ma messagerie » (mailto)", /Envoyer depuis ma messagerie/.test(fr));
  check("le bouton de copie est « Copier » et non « Copier l'invitation »", /📋 Copier/.test(fr));
}

console.log("\n— /dashboard (bandeau Pilotage actif + Nouveau post) —");
{
  const fr = full("/dashboard", "fr");
  check("décrit le bandeau « Pilotage actif » et ses 3 raccourcis", /Pilotage actif/.test(fr) && /Nouvelle campagne/.test(fr) && /Revoir mon parcours/.test(fr));
  check("décrit le bouton d'en-tête « Nouveau post »", /Nouveau post/.test(fr));
}

console.log("\n— /pilotage (BUGSSocialHub29 1-7) —");
{
  const fr = full("/pilotage", "fr");
  check("BUG 1 — le journal des décisions n'est plus présenté comme conservé", !/sans la supprimer du journal/.test(fr));
  check("BUG 1 — précise l'absence de vrai journal persistant (perte au rafraîchissement)", /rafraîchi/i.test(fr) && /journal persistant/.test(fr));
  check("BUG 2 — ne promet plus une recommandation par agent (pluriel)", !/leurs recommandations apparaissent dans la file/.test(fr));
  check("BUG 2 — précise une seule décision agrégée par cycle", /une seule décision agrégée/.test(fr));
  check("BUG 3 — LinkedIn n'est plus présenté comme affichant de vraies données", /LinkedIn n.expose pas ces statistiques|reste toujours vide/.test(fr));
  check("BUG 4 — le sélecteur de pays n'est plus présenté comme filtrant KPIs/veille/benchmark", !/filtre à la fois les KPIs, le benchmark et les insights de veille/.test(fr));
  check("BUG 5 — « 10-30 secondes » n'est plus donné comme une moyenne garantie", !/10.30 secondes/.test(fr));
  check("BUG 5 — mentionne le vrai plafond de 2 minutes", /jusqu.à 2 minutes/.test(fr));
  check("BUG 6 — la priorité « haute » de la veille n'est plus présentée comme garantie", !/apparaissent en tête de file avec la priorité « haute »/.test(fr));
  check("BUG 7 — décrit la carte « Campagne du parcours »", /Campagne du parcours/.test(fr));
  check("BUG 7 — décrit la section « Alertes »", /section « Alertes »|section "Alertes"/.test(fr) || /Repérer les alertes/.test(fr));
  check("BUG 7 — précise que la rangée de raccourcis n'est pas des onglets internes", /raccourcis de navigation/.test(fr));
  check("EN mirror — title", getHelp("/pilotage", "en").title === "Piloting center");
}

console.log("\n— /identite (BUGSSocialHub29 8-12) —");
{
  const fr = full("/identite", "fr");
  check("BUG 8 — ne promet plus de déverrouillage (n'existe pas)", !/vous pouvez le déverrouiller/.test(fr));
  check("BUG 9 — décrit la mémoire stratégique (RAG)", /mémoire stratégique/.test(fr));
  check("BUG 10 — mentionne la restriction d'accès en édition", /accès en édition/.test(fr));
  check("BUG 11/12 — décrit le test de visuels / moodboard IA", /moodboard/i.test(fr));
  check("BUG 11/12 — décrit la détection de langue de l'ADN", /rédigé dans une autre langue|Régénérer en français/.test(fr));
}

console.log("\n— /mes-societes (BUGSSocialHub29 13-16) —");
{
  const fr = full("/mes-societes", "fr");
  check("BUG 13 — le bouton n'est plus juste « Choisir »", !/« Choisir »/.test(fr));
  check("BUG 13 — décrit « Ouvrir → » et « Choisir & ouvrir »", /Ouvrir →/.test(fr) && /Choisir & ouvrir/.test(fr));
  check("BUG 14 — le bouton Connexions n'est plus présenté comme réservé aux admins", /disponible pour tous les utilisateurs/.test(fr));
  check("BUG 15 — décrit l'état vide « Créer ma première société »", /Créer ma première société/.test(fr));
  check("BUG 16 — distingue la palette fixe (création) du sélecteur libre (modification)", /6 couleurs prédéfinies/.test(fr) && /sélecteur.{0,20}libre|n.importe quelle couleur/.test(fr));
}

console.log("\n— /pilotage (Cerveau Contenu / Pilote Contenu, extension organique) —");
{
  const fr = full("/pilotage", "fr");
  check("décrit le Cerveau Contenu", /Cerveau Contenu/.test(fr));
  check("décrit le Pilote Contenu", /Pilote Contenu/.test(fr));
  check("précise l'absence de dépense pour les actions organiques", /sans aucune dépense/.test(fr));
}

console.log("\n— /studio-video (BUGSSocialHub30 13-18) —");
{
  const fr = full("/studio-video", "fr");
  check("BUG 13 — le bouton s'intitule « Assembler & marketer », plus « Marketer automatiquement »", /Assembler & marketer/.test(fr) && !/Marketer automatiquement/.test(fr));
  check("BUG 14 — les 13 formats de destination sont cités, plus « 5 réseaux »", /13 formats/.test(fr) && /Instagram Reels\/Story\/Feed\/Portrait/.test(fr) && /LinkedIn 16:9\/carré/.test(fr));
  check("BUG 15 — la pub Meta est une redirection vers /campaigns/new, plus « sans quitter le studio »", /campaigns\/new/.test(fr) && !/sans quitter le studio/.test(fr));
  check("BUG 16 — TikTok est exclu de la diffusion directe (app API séparée)", /TikTok en est exclu/.test(fr) && /application approuvée séparément/.test(fr));
  check("BUG 17 — la bibliothèque musicale est signalée comme démo non libre de droits", /DÉMONSTRATION/.test(fr) && /non libre de droits/.test(fr));
  check("BUG 18 — le Brand kit, le glisser-déposer et le bouton Réinitialiser sont décrits", /Brand kit/.test(fr) && /glisser-déposer/.test(fr) && /Réinitialiser/.test(fr));
  check("BUG 18 — le pipeline Cloudinary (formats statiques) est mentionné, distinct du rendu vidéo", /Cloudinary/.test(fr));
}

console.log("\n— /studio-avatar (BUGSSocialHub31 1-5) —");
{
  const fr = full("/studio-avatar", "fr");
  check("BUG 1 — au moins une astuce est présente (tips n'est plus vide)", getHelp("/studio-avatar", "fr").tips.length > 0);
  check("BUG 2 — ne prétend plus un consentement bloquant pour le visage", !/Uploadez le visage \(avec consentement de la personne\)/.test(fr));
  check("BUG 2 — précise l'absence de case de consentement pour le visage", /aucune case de consentement ne bloque cette étape/.test(fr));
  check("BUG 2 — précise que le clonage vocal, lui, est bloqué sans consentement", /bloque l.enregistrement\/l.upload tant qu.elle n.est pas cochée/.test(fr));
  check("BUG 3 — distingue la sauvegarde auto de la vidéo et l'enregistrement manuel de l'avatar", /s.enregistre automatiquement dans la Médiathèque/.test(fr) && /Enregistrer cet avatar/.test(fr));
  check("BUG 4 — précise que Hey Gen Lipsync Precision n'est pas une intégration HeyGen", /HeyGen Lipsync Precision.*n.est pas une intégration de l.API HeyGen/.test(fr));
  check("BUG 5 — décrit la durée réglable (8 à 90 s)", /8 à 90 s/.test(fr));
  check("BUG 5 — décrit les 16 langues et la distinction natif/cloné", /16 langues/.test(fr) && /voix clonée/.test(fr));
  check("BUG 5 — décrit l'aperçu vocal", /Écouter/.test(fr));
  check("BUG 5 — décrit la retouche IA du portrait", /retouchez-le librement par instructions IA/.test(fr));
  check("BUG 5 — décrit la reprise automatique après rechargement", /reprend automatiquement si vous rechargez la page/.test(fr));
  check("BUG 5 — décrit l'ouverture directe dans Composer", /ouvrez le résultat directement dans Composer/.test(fr));
}

console.log("\n— /studio-affiche (BUGSSocialHub31 6-10) —");
{
  const fr = full("/studio-affiche", "fr");
  check("BUG 6 — au moins une astuce est présente (tips n'est plus vide)", getHelp("/studio-affiche", "fr").tips.length > 0);
  check("BUG 7 — ne prétend plus une haute définition inconditionnelle pour le print", !/export PNG haute définition, utilisable hors réseaux également/.test(fr));
  check("BUG 7 — précise les ~150 dpi du print, sous le standard 300 dpi", /~150 dpi/.test(fr) && /300 dpi/.test(fr));
  check("BUG 8 — ne prétend plus que la pub Meta se fait directement depuis le studio", !/transformez-le en publicité Meta directement depuis le studio/.test(fr));
  check("BUG 8 — précise la redirection vers /campaigns/new", /redirige.{0,80}\/campaigns\/new/.test(fr));
  check("BUG 9 — décrit les 17 formats précis par réseau", /17 formats précis/.test(fr) && /3 Instagram/.test(fr) && /3 Facebook/.test(fr) && /3 LinkedIn/.test(fr));
  check("BUG 10 — décrit le copilote créatif et la génération texte + prompt", /copilote créatif/.test(fr) && /Générer texte \+ prompt/.test(fr));
  check("BUG 10 — décrit le zoom/déplacement de l'aperçu", /zoom à la molette, déplacement au glisser/.test(fr));
  check("BUG 10 — décrit le brand kit (palette, couleur de texte recommandée)", /couleur de texte recommandée/.test(fr));
  check("BUG 10 — décrit le bouton de réinitialisation", /Réinitialiser/.test(fr));
  check("BUG 10 — décrit le sélecteur de modèle IA", /modèle de génération d.image.*sélectionnable/.test(fr));
  check("BUG 10 — décrit la nouvelle tentative automatique en cas d'échec partiel", /retente automatiquement/.test(fr));
}

console.log("\n— /media (BUGSSocialHub31 11-14) —");
{
  const fr = full("/media", "fr");
  check("BUG 11 — les 4 étapes réelles sont présentes (import, publier, décliner/pub, supprimer)", /Importer un média/.test(fr) && /Publier directement/.test(fr) && /Supprimer un média/.test(fr));
  check(
    "BUG 12 — les rubriques liées pointent vers Composer, pas la Bibliothèque",
    getHelp("/media", "fr").related?.some((r) => r.href === "/compose") &&
      !getHelp("/media", "fr").related?.some((r) => r.href === "/library")
  );
  check("BUG 13 — précise que le seul filtre est le type de média", /seul filtre disponible est le type de média/.test(fr));
  check("BUG 13 — précise l'absence de filtre par source/campagne/date", /aucun filtre par source, campagne ou date/.test(fr));
  check("BUG 14 — décrit le téléchargement direct et les hébergeurs autorisés", /bouton ⬇ télécharge/.test(fr));
  check("BUG 14 — décrit le sélecteur de format de sortie lors de la déclinaison", /1:1, 4:5, 9:16/.test(fr));
  check("BUG 14 — décrit l'affichage des dimensions réelles en pixels", /dimensions réelles en pixels/.test(fr));
  check("BUG 14 — précise que les visuels du brand kit apparaissent dans la galerie", /kit de marque apparaissent directement dans cette galerie/.test(fr));
  check("BUG 14 — décrit les liens de redirection en cas de galerie vide", /Studio Affiches ou Studio Vidéo/.test(fr));
  check("BUG 14 — précise l'absence de pagination/recherche/tri/actions groupées", /ni pagination, ni recherche, ni tri, ni action groupée/.test(fr));
}

console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
