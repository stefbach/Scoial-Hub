// ============================================================
// Exemple autonome — SDK officiel Higgsfield (@higgsfield/client v2).
// Modèle : bytedance/seedance-2.5/text-to-video.
//
// Lit HF_CREDENTIALS="<key-id>:<key-secret>" (voir console.higgsfield.ai)
// depuis .env.local — fichier ignoré par git ("*.env.local" dans
// .gitignore), jamais lu, affiché ni committé par ce script ou par Claude.
// Sans clé configurée, le SDK lève CredentialsMissedError AVANT tout appel
// réseau : aucune requête n'est envoyée.
//
// ATTENTION : appel RÉEL et FACTURABLE dès que les identifiants sont
// configurés (une génération vidéo Seedance consomme des crédits Higgsfield).
//
// Usage : npm run higgsfield:seedance-example
// ============================================================

try {
  // Charge .env.local si présent (Node ≥ 20.6, aucune dépendance ajoutée).
  // Les variables déjà exportées dans le shell/CI restent prioritaires.
  process.loadEnvFile(".env.local");
} catch {
  // Fichier absent : les identifiants peuvent venir d'une autre source
  // (variables d'environnement Vercel/CI, export shell).
}

import { higgsfield } from "@higgsfield/client/v2";
import {
  CredentialsMissedError,
  AuthenticationError,
  NotEnoughCreditsError,
  ValidationError,
  BadInputError,
  APIError,
  TimeoutError,
} from "@higgsfield/client";

const MODEL = "bytedance/seedance-2.5/text-to-video";

async function main(): Promise<void> {
  const result = await higgsfield.subscribe(MODEL, {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
    },
    withPolling: true,
  });

  switch (result.status) {
    case "completed": {
      const url = result.video?.url;
      if (!url) {
        console.error("✗ Statut « completed » mais aucune URL vidéo dans la réponse :", result);
        process.exitCode = 1;
        return;
      }
      console.log("✓ Vidéo générée :", url);
      return;
    }
    case "nsfw":
      console.error("✗ Requête modérée (contenu refusé par Higgsfield) — crédits remboursés.");
      process.exitCode = 1;
      return;
    case "failed":
      console.error("✗ Génération échouée côté Higgsfield.", result);
      process.exitCode = 1;
      return;
    default:
      // "queued"/"in_progress" ne devraient pas ressortir d'un subscribe()
      // avec withPolling:true — remonté tel quel si le SDK renvoie autre
      // chose qu'un état terminal documenté (ex. "canceled").
      console.error(`✗ Statut inattendu après polling : ${result.status}`, result);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  if (err instanceof CredentialsMissedError) {
    console.error(
      '✗ Higgsfield non configuré — définissez HF_CREDENTIALS="<key-id>:<key-secret>" dans .env.local (identifiants sur console.higgsfield.ai).'
    );
  } else if (err instanceof AuthenticationError) {
    console.error("✗ Identifiants Higgsfield invalides.");
  } else if (err instanceof NotEnoughCreditsError) {
    console.error("✗ Crédits Higgsfield insuffisants.");
  } else if (err instanceof ValidationError || err instanceof BadInputError) {
    console.error("✗ Entrée invalide :", err.message, err.details ?? "");
  } else if (err instanceof TimeoutError) {
    console.error("✗ Délai de polling dépassé :", err.message);
  } else if (err instanceof APIError) {
    console.error(`✗ Erreur API Higgsfield (${err.statusCode}) :`, err.message);
  } else {
    console.error("✗ Erreur inattendue :", err);
  }
  process.exitCode = 1;
});
