import { redirect } from "next/navigation";

// L'ancien Studio Article LinkedIn est désormais intégré à l'Espace LinkedIn
// (onglet « Article & visuels »). On redirige pour conserver les anciens liens.
export default function ArticleLinkedInRedirect() {
  redirect("/linkedin?tab=article");
}
