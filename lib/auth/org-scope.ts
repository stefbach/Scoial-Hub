/**
 * Choix de l'organisation dans laquelle créer une société.
 *
 * Règle : le cookie admin n'ouvre un contournement QUE s'il est accompagné d'un
 * orgId explicite (dépannage depuis la console). Dans tous les autres cas —
 * y compris un admin qui crée sa propre société — l'organisation vient de la
 * SESSION, jamais du corps de la requête.
 *
 * Régression corrigée : exiger un orgId dès que le cookie admin existait rendait
 * la création de société impossible (« orgId requis (admin) ») pour quiconque
 * avait ouvert /admin dans le même navigateur, aucun écran de création
 * n'envoyant d'orgId.
 */
export type OrgSource = "body" | "session";

export function chooseOrgSource(isAdmin: boolean, bodyOrgId?: string): OrgSource {
  return isAdmin && Boolean(bodyOrgId && bodyOrgId.trim()) ? "body" : "session";
}
