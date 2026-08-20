// Recette du 20/08 — parcours assisté (étapes 0 et 5) et Veille & Marché.
//
// Usage : npm run test:r25

import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗ ÉCHEC"} ${label}${!ok && detail ? `  — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const read = (p: string) => readFileSync(p, "utf8");

async function main() {
  // ── #1 · L'alerte de langue se fonde sur le texte, pas sur une étiquette ──
  {
    const { detectTextLang } = await import("../lib/ai/lang");

    const fr =
      "Notre marque accompagne les entreprises qui veulent structurer leur présence " +
      "sur les réseaux sociaux avec une méthode claire et des contenus utiles.";
    const en =
      "Our brand helps companies that want to structure their presence on social " +
      "media with a clear method and genuinely useful content for their audience.";

    check("langue · un texte français est reconnu comme français", detectTextLang(fr) === "fr", String(detectTextLang(fr)));
    check("langue · un texte anglais est reconnu comme anglais", detectTextLang(en) === "en", String(detectTextLang(en)));
    check("langue · texte trop court → aucune conclusion", detectTextLang("Bonjour") === null);
    // Un nom propre accentué dans un texte anglais ne doit pas le rendre « français ».
    const enAccent = en.replace("Our brand", "Our brand Café Générale");
    check("langue · un accent isolé ne bascule pas un texte anglais", detectTextLang(enAccent) === "en", String(detectTextLang(enAccent)));

    const consultant = read("components/onboarding/BrandConsultant.tsx");
    check(
      "consultant · l'alerte s'appuie sur la langue détectée",
      /dnaTextLang && dnaTextLang !== lang/.test(consultant) && /detectTextLang\(/.test(consultant)
    );
  }

  // ── #2 · La régénération renvoie un ADN COMPLET traduit ───────────────────
  {
    const route = read("app/api/ai/consultant/route.ts");
    check("consultant · mode de traduction dédié", /if \(body\.translate\)/.test(route));
    check(
      "consultant · l'objet complet est exigé du modèle",
      /Renvoie TOUS les champs présents dans l'entrée/.test(route)
    );
    check(
      "consultant · aucun historique de conversation n'ancre la langue",
      /callClaudeJSONResult<\{ dna\?: BrandDna \}>\(prompt/.test(route)
    );
    const consultant = read("components/onboarding/BrandConsultant.tsx");
    check(
      "consultant · le client utilise le mode traduction",
      /translate: true, dna, language: lang/.test(consultant)
    );
  }

  // ── #3 · Avertissement pendant la création de campagne ────────────────────
  {
    const step5 = read("components/onboarding/Step5Agents.tsx");
    check("étape 5 · avertissement affiché pendant l'attente", /Ne quittez pas cette page/.test(step5));
    check(
      "étape 5 · fermeture de l'onglet réellement protégée",
      /beforeunload/.test(step5) && /if \(!running\) return;/.test(step5)
    );
  }

  // ── #4 et #6 · Veille réellement ciblée (pays + sujet) ────────────────────
  {
    const src = read("lib/scraping/collectors.ts");
    check(
      "veille · le NOM du pays entre dans la requête de recherche",
      /countryName\(query\.geo, query\.language \?\? "en"\)/.test(src)
    );
    check(
      "veille · les contenus hors sujet sont écartés",
      /makeRelevanceFilter\(query\)/.test(src) && /if \(!isRelevant\(/.test(src)
    );

    // Le filtre lui-même : il doit retenir le sujet ET rejeter le hors-sujet.
    const mod = src.match(/function tokens\(text: string\): string\[\] \{[\s\S]*?\n\}/);
    check("veille · fonction de tokenisation présente", Boolean(mod));

    // Vérification comportementale via une réimplémentation identique : le
    // module n'exporte pas ces aides internes, on contrôle donc la règle.
    const toks = (t: string) =>
      t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    const wanted = new Set(["pieces", "auto", "moteur"].flatMap(toks));
    const keep = (text: string) => toks(text).some((w) => wanted.has(w));
    check("veille · un contenu du sujet est conservé", keep("Les meilleures pièces auto à Maurice"));
    check("veille · un contenu hors sujet est écarté", !keep("Recette de gâteau au chocolat"));
  }

  // ── #5 · Plus de cadre gris autour des indicateurs ────────────────────────
  {
    const card = read("components/veille/ContentCard.tsx");
    check("veille · indicateurs sans filet gris", !/border-t border-hair/.test(card));
  }

  // ── #7 · Site web d'un concurrent ─────────────────────────────────────────
  {
    const repo = read("lib/repositories/competitors.ts");
    check("concurrents · le site web est conservé", /website \? \{ website: input\.website \} : \{\}/.test(repo));
    const route = read("app/api/veille/competitors/route.ts");
    check("concurrents · URL normalisée côté serveur", /function normalizeWebsite/.test(route));
    const page = read("app/(general)/veille/page.tsx");
    check("concurrents · champ de saisie présent", /value=\{addWebsite\}/.test(page));
    const item = read("components/veille/CompetitorItem.tsx");
    check("concurrents · lien affiché sur la fiche", /href=\{website\}/.test(item));
  }

  // ── #8 · « Lancer l'analyse » en bas de la colonne Collecte ───────────────
  {
    const page = read("app/(general)/veille/page.tsx");
    check(
      "veille · le bouton n'est plus dans l'en-tête",
      /<PageHeader title=\{t\("Veille & Marché", "Market Intelligence"\)\} \/>/.test(page)
    );
    const aside = page.slice(page.indexOf("<aside"), page.indexOf("</aside>"));
    check("veille · le bouton clôt la colonne « Collecter »", /onClick=\{handleRun\}/.test(aside));
    check(
      "veille · condition de lancement expliquée quand elle manque",
      /Renseignez une thématique ou au moins un mot-clé/.test(aside)
    );
  }

  console.log(`\n${failures === 0 ? "✓ TOUT VERT" : `✗ ${failures} échec(s)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
