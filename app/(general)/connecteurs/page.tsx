import { redirect } from "next/navigation";

// L'ancienne page connecteurs (mode simulé) est remplacée par la page
// fonctionnelle « Connecteurs & accès données ».
export default function ConnecteursRedirect() {
  redirect("/parametres-connecteurs");
}
