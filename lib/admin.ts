// Authentification du mode ADMIN (console d'administration).
// Identifiants par défaut fournis, surchargeable par variables d'env.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@socialhub.com";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "12345678";

// Nom + valeur du cookie de session admin (httpOnly).
export const ADMIN_COOKIE = "sh_admin";
// Jeton opaque stocké dans le cookie (surchargeable par env pour la prod).
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "sh-admin-session-v1";

export function isValidAdmin(email: string, password: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
}
