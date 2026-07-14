// Page « Modèles » (/library) retirée de l'application (demande utilisateur :
// aucun intérêt). Redirection vers la Médiathèque pour que les anciens
// liens/favoris ne cassent pas.

import { redirect } from "next/navigation";

export default function LibraryPage() {
  redirect("/media");
}
