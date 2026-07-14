// Page « Centre de pilotage IA » (/agents) retirée de l'application (demande
// utilisateur : aucun intérêt — les agents se lancent depuis chaque page via
// AgentLauncher). Redirection vers le Centre de pilotage pour que les anciens
// liens/favoris ne cassent pas.

import { redirect } from "next/navigation";

export default function AgentsPage() {
  redirect("/pilotage");
}
