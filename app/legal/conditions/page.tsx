import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions de service — AXON-AI",
  description:
    "Conditions générales d'utilisation de la plateforme AXON-AI · Social Media.",
};

const UPDATED = "4 juin 2026";
const CONTACT = "sbach1964@gmail.com";

export default function ConditionsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
          ← AXON-AI
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-ink">Conditions de service</h1>
      <p className="mt-1 text-sm text-muted">Dernière mise à jour : {UPDATED}</p>

      <div className="prose mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">1. Objet</h2>
          <p>
            AXON-AI · Social Media (« le Service ») est une plateforme logicielle qui aide les
            entreprises à planifier, créer, publier et piloter leurs campagnes sur les réseaux
            sociaux (organiques et payantes) à l'aide d'agents d'intelligence artificielle. Les
            présentes conditions régissent l'accès et l'utilisation du Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">2. Acceptation</h2>
          <p>
            En créant un compte ou en utilisant le Service, vous acceptez les présentes conditions.
            Si vous utilisez le Service au nom d'une organisation, vous déclarez être autorisé à
            l'engager.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">3. Comptes et connecteurs</h2>
          <p>
            Vous pouvez relier des comptes tiers (Facebook, Instagram, LinkedIn, TikTok, etc.) au
            Service. En les connectant, vous autorisez AXON-AI à lire les données nécessaires
            (statistiques, contenus) et, selon les permissions accordées, à publier ou gérer des
            campagnes en votre nom. Vous restez responsable des contenus publiés et du respect des
            conditions d'utilisation de chaque plateforme tierce. Vous pouvez révoquer ces accès à
            tout moment depuis le Service ou depuis la plateforme concernée.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">4. Utilisation acceptable</h2>
          <p>
            Vous vous engagez à ne pas utiliser le Service à des fins illégales, trompeuses ou
            contraires aux règles des réseaux sociaux connectés (spam, contenus interdits,
            usurpation d'identité, etc.). Nous pouvons suspendre un compte en cas d'usage abusif.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">5. Données personnelles</h2>
          <p>
            Le traitement des données est décrit dans notre politique de confidentialité. Pour
            connaître la procédure de suppression de vos données, consultez la page{" "}
            <Link href="/legal/suppression-donnees" className="font-semibold text-primary-600 hover:text-primary-700">
              Instructions de suppression des données
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">6. Propriété intellectuelle</h2>
          <p>
            Vous conservez la propriété de vos contenus et de vos données. Vous nous accordez une
            licence limitée pour les traiter dans le seul but de fournir le Service. Le logiciel et
            la marque AXON-AI restent notre propriété.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">7. Disponibilité et responsabilité</h2>
          <p>
            Le Service est fourni « en l'état ». Nous ne garantissons pas une disponibilité
            ininterrompue ni l'absence d'erreurs. Dans la limite permise par la loi, notre
            responsabilité est limitée aux montants payés pour le Service au cours des douze derniers
            mois.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">8. Modifications</h2>
          <p>
            Nous pouvons faire évoluer ces conditions. En cas de changement important, nous vous en
            informerons. La poursuite de l'utilisation du Service vaut acceptation des conditions
            mises à jour.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">9. Contact</h2>
          <p>
            Pour toute question relative aux présentes conditions :{" "}
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
