// ── lib/email.ts — Envoi d'e-mails transactionnels (Resend, via fetch) ───────
// Aucune dépendance npm : appel direct de l'API https://api.resend.com/emails.
// Activé par la variable d'environnement RESEND_API_KEY (+ EMAIL_FROM optionnel).
// Si la clé n'est pas configurée, sendEmail() retourne false — aucun succès
// simulé : l'appelant doit conserver son comportement de repli (lien copiable).

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** True quand un service e-mail applicatif est configuré (clé Resend présente). */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Envoie un e-mail via Resend. Retourne true UNIQUEMENT si l'API a accepté
 * l'envoi (2xx). Jamais d'exception : les erreurs sont loguées et renvoient false.
 */
export async function sendEmail({ to, subject, text, html }: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY absente — e-mail non envoyé à", to, "(configurez Resend dans Vercel)");
    return false;
  }
  const from = process.env.EMAIL_FROM ?? "AXON-AI Social Hub <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) }),
    });
    if (!res.ok) {
      console.error("[email] Resend a refusé l'envoi:", res.status, await res.text().catch(() => ""));
    }
    return res.ok;
  } catch (e) {
    console.error("[email] envoi impossible:", e);
    return false;
  }
}

/**
 * Contenu bilingue (FR puis EN) de l'e-mail d'invitation à rejoindre l'espace :
 * qui invite, lien d'inscription, activation des accès à la première connexion.
 */
/**
 * E-mail envoyé au PROPRIÉTAIRE d'un compte à sa création par l'administrateur
 * de la plateforme : lien sécurisé pour définir son mot de passe (si fourni),
 * adresse de connexion, et rappel qu'il peut inviter ses utilisateurs depuis
 * « Mon équipe ». Bilingue FR/EN, texte simple.
 */
export function buildAccountCreatedEmail(params: {
  email: string;
  loginUrl: string;
  setPasswordUrl?: string;
}): { subject: string; text: string } {
  const { email, loginUrl, setPasswordUrl } = params;
  const accessFr = setPasswordUrl
    ? `Définissez votre mot de passe avec ce lien sécurisé : ${setPasswordUrl}`
    : `Connectez-vous avec le mot de passe qui vous a été communiqué.`;
  const accessEn = setPasswordUrl
    ? `Set your password using this secure link: ${setPasswordUrl}`
    : `Sign in with the password you were given.`;
  return {
    subject: "Votre compte AXON-AI Social Hub est prêt / Your AXON-AI Social Hub account is ready",
    text: [
      "Bonjour,",
      "",
      `Votre compte AXON-AI Social Hub vient d'être créé pour l'adresse ${email}.`,
      accessFr,
      `Adresse de connexion : ${loginUrl}`,
      "",
      "Vous êtes propriétaire de ce compte : vous pouvez inviter vos utilisateurs",
      "et régler leurs accès depuis « Mon équipe » une fois connecté.",
      "",
      "— — —",
      "",
      "Hello,",
      "",
      `Your AXON-AI Social Hub account has been created for ${email}.`,
      accessEn,
      `Sign-in address: ${loginUrl}`,
      "",
      "You are the owner of this account: once signed in, you can invite your",
      "users and manage their access from “My team”.",
    ].join("\n"),
  };
}

export function buildInvitationEmail(params: {
  email: string;
  signupUrl: string;
  inviterEmail?: string;
}): { subject: string; text: string } {
  const { email, signupUrl, inviterEmail } = params;
  const inviterFr = inviterEmail ?? "Un administrateur";
  const inviterEn = inviterEmail ?? "An administrator";
  return {
    subject: "Invitation — AXON-AI Social Hub / You're invited to AXON-AI Social Hub",
    text: [
      "Bonjour,",
      "",
      `${inviterFr} vous invite à rejoindre son espace AXON-AI Social Hub.`,
      `Créez votre compte avec cette adresse e-mail (${email}) : ${signupUrl}`,
      "Vos accès s'activeront à votre première connexion.",
      "",
      "— — —",
      "",
      "Hello,",
      "",
      `${inviterEn} has invited you to join their AXON-AI Social Hub workspace.`,
      `Create your account using this email address (${email}): ${signupUrl}`,
      "Your access will be active on your first sign-in.",
    ].join("\n"),
  };
}
