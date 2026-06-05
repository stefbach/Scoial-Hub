import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité — AXON-AI",
  description:
    "Politique de confidentialité de la plateforme AXON-AI · Social Media.",
};

const UPDATED = "5 juin 2026";
const CONTACT = "sbach1964@gmail.com";

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
          ← AXON-AI
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-ink">Politique de confidentialité</h1>
      <p className="mt-1 text-sm text-muted">Dernière mise à jour : {UPDATED}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <p>
          AXON-AI · Social Media (« le Service ») aide les entreprises à piloter leurs réseaux
          sociaux et leurs campagnes publicitaires à l'aide d'agents d'intelligence artificielle.
          Cette politique explique quelles données nous traitons, pourquoi, et comment.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">1. Données que nous traitons</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Informations de compte : nom, e-mail, organisation.</li>
            <li>
              Données des comptes sociaux que vous connectez (Facebook, Instagram, LinkedIn,
              TikTok) : identifiants de Page/compte, jetons d'accès, statistiques (abonnés,
              portée, engagement), contenus publiés et, le cas échéant, données de campagnes
              publicitaires (compte publicitaire, performances).
            </li>
            <li>Contenus que vous créez, programmez ou publiez via le Service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">2. Finalités</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Afficher vos statistiques et analyses dans des tableaux de bord.</li>
            <li>Générer, programmer et publier du contenu en votre nom (sur votre autorisation).</li>
            <li>Créer et gérer des campagnes publicitaires lorsque vous l'activez.</li>
            <li>Produire des recommandations stratégiques par IA à partir de vos données.</li>
          </ul>
          <p>
            Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires
            tierces.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">3. Partage</h2>
          <p>
            Les données sont traitées par nos sous-traitants techniques strictement nécessaires au
            fonctionnement du Service : hébergement (Vercel), base de données et authentification
            (Supabase), et fournisseurs d'IA (Anthropic) pour la génération et l'analyse. Les
            appels aux plateformes (Meta, LinkedIn, TikTok) se font via leurs API officielles.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">4. Conservation</h2>
          <p>
            Nous conservons vos données tant que votre compte est actif. Les jetons d'accès sont
            supprimés dès que vous déconnectez un réseau. Vous pouvez demander la suppression
            complète à tout moment — voir la page{" "}
            <Link href="/legal/suppression-donnees" className="font-semibold text-primary-600 hover:text-primary-700">
              Suppression des données
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">5. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement,
            de limitation et de portabilité de vos données. Pour les exercer :{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-primary-600 hover:text-primary-700">
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">6. Sécurité</h2>
          <p>
            Les jetons et secrets sont stockés côté serveur et ne sont jamais exposés en clair dans
            l'interface. Les accès sont protégés par authentification et isolation par organisation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">7. Contact</h2>
          <p>
            Pour toute question relative à cette politique :{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-primary-600 hover:text-primary-700">
              {CONTACT}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
