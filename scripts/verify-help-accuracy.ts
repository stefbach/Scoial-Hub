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

console.log(failed === 0 ? "\n✓ TOUT VERT" : `\n✗ ${failed} ÉCHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
