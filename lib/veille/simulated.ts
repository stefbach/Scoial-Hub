/**
 * Contenu de veille SIMULÉ, déterministe et bilingue.
 *
 * Sert de repli quand aucun run réel n'existe encore. Extrait de la route pour
 * être testable sans serveur : c'est ici que se joue le respect de la langue
 * d'interface — régression signalée en recette (interface en anglais, contenu
 * de veille en français).
 */

import type { VeilleInsight, VeilleReco, VeilleLatestResult } from "@/lib/veille/types";

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  return h;
}

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Langue d'affichage. Le contenu simulé doit suivre l'interface. */
export type Lang = "fr" | "en";

/** Variante bilingue d'une même phrase. */
type Bi = readonly [fr: string, en: string];

export function buildSimulatedResult(companyId: string, lang: Lang = "fr"): VeilleLatestResult {
  const r = rng(hashSeed(`${companyId}|veille-latest`));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
  // Le tirage porte sur la PAIRE, pas sur la langue : la même graine produit
  // donc la même phrase en français et en anglais — un changement de langue ne
  // doit pas changer le contenu de la veille.
  const say = (arr: readonly Bi[]): string => pick(arr)[lang === "en" ? 1 : 0];

  const insights: VeilleInsight[] = [
    {
      id: "vi-1",
      type: "format",
      label: say([
        ["Les Reels < 60 s dominent l'engagement concurrent", "Reels under 60s dominate competitor engagement"],
        ["Les carrousels éducatifs génèrent 2× plus de sauvegardes", "Educational carousels drive 2× more saves"],
        ["Les vidéos coulisses surperforment sur Instagram", "Behind-the-scenes videos outperform on Instagram"],
      ]),
      detail: say([
        ["Taux d'engagement moyen 8,3 % sur ce format chez vos concurrents directs.", "Average engagement rate of 8.3% on this format among your direct competitors."],
        ["Portée organique +42 % vs posts statiques sur les 30 derniers jours.", "Organic reach +42% vs static posts over the last 30 days."],
        ["Format privilégié par 3 concurrents sur 4 dans la zone marché.", "Favoured format for 3 out of 4 competitors in the market area."],
      ]),
      reseau: pick(["instagram", "tiktok", "linkedin"]),
    },
    {
      id: "vi-2",
      type: "angle",
      label: say([
        ["Angle 'témoignage client' très porteur sur ce marché", "'Customer testimonial' angle performs strongly in this market"],
        ["Angle 'coulisses & transparence' en forte croissance", "'Behind the scenes & transparency' angle growing fast"],
        ["Angle 'chiffres & preuves' génère le plus de partages", "'Data & proof' angle drives the most shares"],
      ]),
      detail: say([
        ["3 concurrents ont publié des témoignages vidéo cette semaine avec un ER moyen de 6,1 %.", "3 competitors published video testimonials this week with an average ER of 6.1%."],
        ["Les posts authenticité cumulent 2 400 vues supplémentaires en moyenne.", "Authenticity posts gather 2,400 extra views on average."],
        ["Les infographies data génèrent 3× plus de partages organiques.", "Data infographics drive 3× more organic shares."],
      ]),
      reseau: pick(["facebook", "instagram", "linkedin"]),
    },
    {
      id: "vi-3",
      type: "benchmark",
      label: say([
        ["Concurrent en forte accélération détecté", "Sharply accelerating competitor detected"],
        ["Un concurrent a lancé une série hebdomadaire", "A competitor launched a weekly series"],
        ["Fréquence de publication concurrente en hausse", "Competitor posting frequency on the rise"],
      ]),
      detail: say([
        ["Publication quotidienne depuis 2 semaines — +18 % de followers en 30 jours.", "Daily posting for 2 weeks — +18% followers in 30 days."],
        ["Série thématique le mardi + vendredi, ER 5,4 % en moyenne.", "Themed series on Tuesdays and Fridays, 5.4% average ER."],
        ["Cadence passée de 2 à 5 posts/semaine — algorithme plus favorable.", "Cadence up from 2 to 5 posts/week — more favourable algorithm."],
      ]),
      reseau: "instagram",
    },
  ];

  const recommandations: VeilleReco[] = [
    {
      id: "vr-1",
      priorite: "haute",
      titre: say([
        ["Lancer une série Reels hebdomadaire", "Launch a weekly Reels series"],
        ["Produire 3 carrousels éducatifs ce mois-ci", "Produce 3 educational carousels this month"],
        ["Activer le format Stories quotidiennes", "Turn on the daily Stories format"],
      ]),
      detail: lang === "en"
        ? "Insight from competitive intelligence — dominant format identified in your market."
        : "Insight issu de la veille concurrentielle — format dominant identifié sur votre marché.",
      action: say([
        ["Planifier 2 Reels/semaine sur les 4 prochaines semaines.", "Schedule 2 Reels/week for the next 4 weeks."],
        ["Décliner les 3 angles thématiques détectés en carrousels.", "Turn the 3 detected themes into carousels."],
        ["Mettre en place un story-telling quotidien avec sondage intégré.", "Set up daily storytelling with an embedded poll."],
      ]),
    },
    {
      id: "vr-2",
      priorite: "moyenne",
      titre: say([
        ["Augmenter la fréquence de publication sur LinkedIn", "Increase posting frequency on LinkedIn"],
        ["Tester l'angle témoignage client sur Facebook", "Test the customer testimonial angle on Facebook"],
        ["Répliquer l'angle 'coulisses' d'un concurrent performant", "Replicate a strong competitor's 'behind the scenes' angle"],
      ]),
      detail: lang === "en"
        ? "Intelligence shows a cadence gap vs competitors — an opportunity to catch up."
        : "La veille détecte un écart de cadence vs la concurrence — opportunité de rattrapage.",
      action: say([
        ["Passer de 2 à 4 posts/semaine sur LinkedIn pendant 30 jours.", "Go from 2 to 4 posts/week on LinkedIn for 30 days."],
        ["Créer 2 posts témoignages avec avis clients réels d'ici 10 jours.", "Create 2 testimonial posts with real customer reviews within 10 days."],
        ["Produire une vidéo coulisses / processus interne cette semaine.", "Produce a behind-the-scenes / internal process video this week."],
      ]),
    },
  ];

  return {
    runId: null,
    companyId,
    finishedAt: new Date().toISOString(),
    simulated: true,
    // Le résumé ne cite plus l'identifiant technique de la société : un UUID
    // affiché en clair dans un résumé exécutif n'apprend rien au lecteur.
    resume: lang === "en"
      ? "Simulated competitive intelligence identifies 3 key insights: short-form video dominates engagement, the authenticity angle is growing fast, and at least one competitor has stepped up its posting cadence. An opportunity to move quickly."
      : "La veille concurrentielle simulée identifie 3 insights clés : les formats courts vidéo dominent l'engagement, l'angle authenticité est en forte croissance, et au moins un concurrent a accéléré sa cadence de publication. Opportunité d'agir rapidement.",
    insights,
    recommandations,
  };
}

