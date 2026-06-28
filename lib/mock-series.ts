// lib/mock-series.ts
//
// Contenu de DÉMONSTRATION pour les séries (quand l'IA n'est pas configurée).
// Objectif : refléter fidèlement ce que produit l'IA une fois branchée — des
// posts/articles VARIÉS et rédigés (pas un gabarit répété). Partagé par
// /api/ai/linkedin-series et /api/ai/social-series.

export interface MockSeriesPost {
  title: string;
  body: string;
  visualPrompt?: string;
}

interface Angle {
  tagFr: string;
  tagEn: string;
  shortFr: (t: string, h: string) => string;
  shortEn: (t: string, h: string) => string;
  articleFr: (t: string, h: string) => string;
  articleEn: (t: string, h: string) => string;
  visual: (t: string) => string;
}

// 5 angles éditoriaux distincts — chacun produit un texte propre.
const ANGLES: Angle[] = [
  {
    tagFr: "retour d'expérience", tagEn: "lesson learned",
    shortFr: (t, h) => `${t} : ce que j'aurais aimé savoir plus tôt.\n\nOn surestime l'effet d'annonce et on sous-estime la régularité. Trois semaines de constance m'ont plus apporté que six mois de bonnes intentions.\n\nEt vous, quelle leçon retenez-vous ? ${h}`,
    shortEn: (t, h) => `${t}: what I wish I'd known sooner.\n\nWe overrate the big announcement and underrate consistency. Three weeks of steady effort did more for me than six months of good intentions.\n\nWhat lesson stuck with you? ${h}`,
    articleFr: (t, h) => `${t} : ce que j'ai appris en passant à l'action.\n\nOn parle beaucoup de ${t}, mais rarement de ce que ça change vraiment au quotidien. Voici un retour honnête, sans langue de bois.\n\nLe premier constat, c'est le temps. Les premiers résultats ne sont pas arrivés en trois jours mais en trois semaines. La plupart des équipes abandonnent juste avant ce cap, persuadées que ça ne marche pas.\n\nCe qui a fait la différence : commencer petit et tenir. Un seul objectif, mesuré chaque semaine, plutôt qu'un grand plan jamais terminé. Nous avons gagné en clarté avant de gagner en performance.\n\nÀ retenir : la régularité bat l'intensité. Avancez par petits pas, mais ne vous arrêtez pas.\n\nEt vous, où en êtes-vous sur ${t} ? ${h}`,
    articleEn: (t, h) => `${t}: what I learned by actually doing it.\n\nEveryone talks about ${t}, but rarely about what it really changes day to day. Here is an honest take, no spin.\n\nThe first realization is time. The first results didn't show up in three days but in three weeks. Most teams quit right before that point, convinced it isn't working.\n\nWhat made the difference: starting small and sticking with it. One goal, measured weekly, instead of a grand plan that never ships. We gained clarity before we gained performance.\n\nKey takeaway: consistency beats intensity. Move in small steps, but don't stop.\n\nWhere are you with ${t}? ${h}`,
    visual: (t) => `Professional editorial visual illustrating "${t}", warm authentic tone, clean modern style, high quality, no text`,
  },
  {
    tagFr: "erreur à éviter", tagEn: "mistake to avoid",
    shortFr: (t, h) => `L'erreur la plus fréquente avec ${t} : vouloir tout faire d'un coup.\n\nRésultat : on s'épuise et on abandonne. Choisissez UN objectif, tenez-le 30 jours, mesurez. Simple, mais ça change tout.\n\nQuelle erreur avez-vous arrêté de faire ? ${h}`,
    shortEn: (t, h) => `The most common mistake with ${t}: trying to do everything at once.\n\nThe result: burnout, then giving up. Pick ONE goal, hold it for 30 days, measure. Simple, but it changes everything.\n\nWhat mistake did you stop making? ${h}`,
    articleFr: (t, h) => `${t} : l'erreur qui coûte le plus cher.\n\nElle est presque toujours la même : vouloir tout faire en même temps. On lance dix chantiers, on en finit zéro, et on conclut que ${t} ne marche pas.\n\nLe vrai problème n'est pas le manque d'outils, c'est la dispersion. Chaque nouveau chantier divise l'attention et retarde le premier résultat visible, celui qui donne envie de continuer.\n\nLa correction est radicale mais efficace : un seul objectif à la fois, une échéance de 30 jours, un indicateur clair. Tout le reste attend. Ce n'est pas frustrant, c'est libérateur.\n\nÀ retenir : la concentration est une stratégie. Faites moins, mais finissez.\n\nQuelle erreur avez-vous arrêté de commettre ? ${h}`,
    articleEn: (t, h) => `${t}: the mistake that costs the most.\n\nIt's almost always the same one: trying to do everything at once. We start ten initiatives, finish none, and conclude that ${t} doesn't work.\n\nThe real problem isn't a lack of tools, it's scattering. Every new initiative splits attention and delays the first visible result, the one that makes you want to keep going.\n\nThe fix is radical but effective: one goal at a time, a 30-day deadline, one clear metric. Everything else waits. It isn't frustrating, it's freeing.\n\nKey takeaway: focus is a strategy. Do less, but finish.\n\nWhat mistake did you stop making? ${h}`,
    visual: (t) => `Minimalist conceptual visual about focus and "${t}", single clear subject, clean corporate style, high quality, no text`,
  },
  {
    tagFr: "conseil actionnable", tagEn: "actionable tip",
    shortFr: (t, h) => `Un conseil concret sur ${t} : remplacez « je devrais » par « cette semaine, je fais ».\n\nUn pas daté vaut dix intentions. La motivation suit l'action, pas l'inverse.\n\nQuel est votre prochain pas, et pour quand ? ${h}`,
    shortEn: (t, h) => `A concrete tip on ${t}: replace "I should" with "this week, I will."\n\nA dated step beats ten intentions. Motivation follows action, not the other way around.\n\nWhat's your next step, and by when? ${h}`,
    articleFr: (t, h) => `${t} : la méthode simple que je recommande.\n\nInutile d'un grand système. Trois règles suffisent pour progresser sur ${t} sans s'épuiser.\n\n1. Datez l'action. « Je devrais » ne se fait jamais ; « jeudi 9h, je fais » se fait. Mettez-le dans l'agenda comme un rendez-vous.\n\n2. Mesurez une seule chose. Un indicateur suivi chaque semaine vaut mieux que dix tableaux de bord consultés une fois.\n\n3. Réduisez la friction. Préparez la veille, supprimez une étape inutile, automatisez ce qui se répète.\n\nÀ retenir : la motivation suit l'action. Commencez petit, mais commencez daté.\n\nQuel pas allez-vous programmer cette semaine ? ${h}`,
    articleEn: (t, h) => `${t}: the simple method I recommend.\n\nNo need for a big system. Three rules are enough to make progress on ${t} without burning out.\n\n1. Date the action. "I should" never happens; "Thursday 9am, I do it" happens. Put it in the calendar like a meeting.\n\n2. Measure one thing. A single metric tracked weekly beats ten dashboards checked once.\n\n3. Reduce friction. Prepare the night before, cut one useless step, automate what repeats.\n\nKey takeaway: motivation follows action. Start small, but start dated.\n\nWhat step will you schedule this week? ${h}`,
    visual: (t) => `Clean instructional visual about a simple method for "${t}", organized layout, modern professional style, high quality, no text`,
  },
  {
    tagFr: "chiffre clé", tagEn: "key figure",
    shortFr: (t, h) => `Un chiffre qui change la perspective sur ${t} : environ 80 % de l'impact vient de 20 % des actions.\n\nIdentifiez ces 20 %, supprimez le reste sans culpabiliser. La clarté bat la quantité.\n\nQuelles sont vos 20 % ? ${h}`,
    shortEn: (t, h) => `A figure that shifts the perspective on ${t}: roughly 80% of the impact comes from 20% of the actions.\n\nFind that 20%, drop the rest without guilt. Clarity beats quantity.\n\nWhat's your 20%? ${h}`,
    articleFr: (t, h) => `${t} : le chiffre dont personne ne parle.\n\nEnviron 80 % des résultats viennent de 20 % des efforts. Sur ${t}, ce principe n'est pas une théorie, c'est un filtre de décision.\n\nConcrètement, la plupart des heures passées le sont sur des tâches à faible impact, faciles mais rassurantes. Pendant ce temps, les quelques actions décisives sont reportées parce qu'elles demandent plus de courage.\n\nLe travail utile consiste donc à isoler ces 20 % et à protéger le temps qu'ils méritent. Cela suppose de dire non, de supprimer, parfois de décevoir à court terme.\n\nÀ retenir : ne demandez pas « comment en faire plus », demandez « qu'est-ce qui compte vraiment ».\n\nQuelles sont vos 20 % sur ${t} ? ${h}`,
    articleEn: (t, h) => `${t}: the figure nobody talks about.\n\nRoughly 80% of results come from 20% of the effort. On ${t}, this isn't a theory, it's a decision filter.\n\nIn practice, most hours go to low-impact tasks, easy but reassuring. Meanwhile, the few decisive actions get postponed because they take more courage.\n\nUseful work means isolating that 20% and protecting the time it deserves. That requires saying no, cutting, sometimes disappointing in the short term.\n\nKey takeaway: don't ask "how do I do more," ask "what truly matters."\n\nWhat's your 20% on ${t}? ${h}`,
    visual: (t) => `Editorial data-driven visual about the 80/20 principle applied to "${t}", clean modern infographic style, high quality, no text`,
  },
  {
    tagFr: "question ouverte", tagEn: "open question",
    shortFr: (t, h) => `Une question franche sur ${t} : qu'est-ce qui vous retient vraiment ?\n\nSouvent ce n'est pas le manque d'outils, mais le manque de décision. La première marche est gratuite.\n\nDites-moi en commentaire ce qui bloque. ${h}`,
    shortEn: (t, h) => `An honest question about ${t}: what's really holding you back?\n\nOften it isn't a lack of tools, it's a lack of decision. The first step is free.\n\nTell me in the comments what's blocking you. ${h}`,
    articleFr: (t, h) => `${t} : et si le vrai frein n'était pas celui qu'on croit ?\n\nOn explique souvent ses blocages sur ${t} par le manque de temps, d'outils ou de budget. C'est rarement la vraie raison.\n\nDans la plupart des cas, le frein est une décision repoussée. Tant qu'aucun choix clair n'est fait, tout reste possible, donc rien n'avance. Décider, c'est renoncer à certaines options, et c'est précisément ce qui fait peur.\n\nLa bonne nouvelle : la première marche ne coûte presque rien. Un test limité, un délai court, un résultat mesurable. On apprend en faisant, pas en réfléchissant indéfiniment.\n\nÀ retenir : ne cherchez pas la certitude, cherchez le premier pas réversible.\n\nQu'est-ce qui vous retient vraiment sur ${t} ? ${h}`,
    articleEn: (t, h) => `${t}: what if the real blocker isn't what you think?\n\nWe often blame our struggles with ${t} on lack of time, tools or budget. That's rarely the real reason.\n\nMost of the time, the blocker is a postponed decision. As long as no clear choice is made, everything stays possible, so nothing moves. Deciding means giving up some options, and that's exactly what's scary.\n\nThe good news: the first step costs almost nothing. A small test, a short deadline, a measurable result. You learn by doing, not by overthinking.\n\nKey takeaway: don't chase certainty, find the first reversible step.\n\nWhat's really holding you back on ${t}? ${h}`,
    visual: (t) => `Thoughtful editorial visual posing a question about "${t}", human-centered, clean modern style, high quality, no text`,
  },
];

/**
 * Construit une série de démonstration variée (un angle distinct par élément).
 * @param theme   thème saisi par l'utilisateur
 * @param count   nombre d'éléments
 * @param fr      true = français, false = anglais
 * @param article true = articles (prose longue), false = posts courts
 * @param max     longueur max (caractères) imposée par le réseau
 */
export function buildMockSeries(
  theme: string,
  count: number,
  fr: boolean,
  article: boolean,
  max: number
): MockSeriesPost[] {
  const t = theme.trim() || (fr ? "votre sujet" : "your topic");
  const tag = `#${t.replace(/[^\p{L}\p{N}]+/gu, "")}`;
  return Array.from({ length: count }, (_, i) => {
    const a = ANGLES[i % ANGLES.length];
    const body = article
      ? (fr ? a.articleFr(t, tag) : a.articleEn(t, tag))
      : (fr ? a.shortFr(t, tag) : a.shortEn(t, tag));
    return {
      title: `${t} — ${fr ? a.tagFr : a.tagEn} (${i + 1}/${count})`,
      body: body.length > max ? body.slice(0, max).trimEnd() : body,
      visualPrompt: a.visual(t),
    };
  });
}
