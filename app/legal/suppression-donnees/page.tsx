import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Suppression des données — AXON-AI",
  description:
    "Instructions pour demander la suppression de vos données personnelles sur AXON-AI · Social Media.",
};

const UPDATED = "4 juin 2026";
const CONTACT = "sbach1964@gmail.com";

export default function SuppressionDonneesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
          ← AXON-AI
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Instructions de suppression des données
      </h1>
      <p className="mt-1 text-sm text-muted">Dernière mise à jour : {UPDATED}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <p>
          AXON-AI · Social Media respecte votre droit à la suppression de vos données personnelles.
          Cette page explique quelles données nous conservons et comment en demander la suppression,
          y compris les données obtenues via vos connexions Facebook, Instagram, LinkedIn ou TikTok.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">Données concernées</h2>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            <li>Informations de compte (nom, e-mail, organisation).</li>
            <li>
              Identifiants et jetons d'accès des comptes sociaux que vous avez connectés (Facebook,
              Instagram, LinkedIn, TikTok).
            </li>
            <li>Contenus générés, programmés ou publiés via le Service.</li>
            <li>Statistiques et données d'analyse récupérées depuis vos comptes connectés.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">
            Méthode 1 — Déconnecter un réseau depuis l'application
          </h2>
          <p>
            Dans AXON-AI, ouvrez <strong>Démarrage → Connectez vos comptes</strong> (ou{" "}
            <strong>Connecteurs</strong>), puis déconnectez le réseau concerné. Les jetons d'accès et
            identifiants associés à ce réseau sont immédiatement supprimés de nos serveurs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">
            Méthode 2 — Demander la suppression complète de votre compte
          </h2>
          <p>
            Envoyez un e-mail à{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-primary-600 hover:text-primary-700">
              {CONTACT}
            </a>{" "}
            avec pour objet <strong>« Suppression de mes données »</strong>, en précisant l'adresse
            e-mail de votre compte. Nous supprimerons l'ensemble de vos données personnelles et des
            jetons d'accès liés à vos comptes sociaux sous <strong>30 jours</strong>, et vous
            confirmerons la suppression par e-mail.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">
            Méthode 3 — Révoquer l'accès depuis le réseau social
          </h2>
          <p>
            Vous pouvez aussi retirer l'autorisation accordée à AXON-AI directement depuis les
            paramètres du réseau concerné :
          </p>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            <li>
              <strong>Facebook / Instagram</strong> : Paramètres → Applications et sites web → AXON-AI
              → Supprimer.
            </li>
            <li>
              <strong>LinkedIn</strong> : Préférences et confidentialité → Applications autorisées →
              AXON-AI → Supprimer.
            </li>
            <li>
              <strong>TikTok</strong> : Paramètres → Sécurité → Applications autorisées → AXON-AI →
              Révoquer.
            </li>
          </ul>
          <p>
            Une fois l'accès révoqué côté plateforme, les jetons correspondants deviennent invalides
            et sont purgés de nos systèmes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">Contact</h2>
          <p>
            Pour toute demande relative à vos données :{" "}
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
