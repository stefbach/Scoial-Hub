// lib/notifications/failed-publish.ts
//
// Notification d'un ÉCHEC DÉFINITIF de publication programmée (retour client
// Rosiane, BUGS-SocialHub35 point 3) : une publication Facebook a vu son
// visuel supprimé avant l'échéance et a été retentée plus de 300 fois sans
// succès — la demande explicite est qu'une NOTIFICATION parte plutôt que de
// multiplier les tentatives automatiques.
//
// Le réessai est déjà borné dans le temps (RETRY_WINDOW_HOURS /
// isPastRetryWindow, lib/publishing/publish-scheduled.ts) et une alerte
// Telegram existait déjà à l'échec définitif (lib/telegram/notify.ts), mais
// UNIQUEMENT pour les sociétés ayant lié un chat Telegram. Ce module ajoute
// l'e-mail comme second canal — au propriétaire du compte — pour que l'échec
// soit signalé même sans intégration Telegram.
//
// Best-effort sur les deux canaux : une notification manquée ne doit jamais
// faire échouer le cron de publication.

import { notifyCompanyTelegram } from "@/lib/telegram/notify";
import { getCompanyOwnerEmail } from "@/lib/repositories/access";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export interface FailedPublishNotice {
  companyId: string;
  platform: string;
  title: string;
  /** Raison de l'échec, déjà formulée pour un lecteur humain. */
  reason: string;
  /**
   * Intitulé de la notification — distingue un échec de publication (le
   * connecteur a refusé) d'une annulation par dépassement de la fenêtre de
   * réessai (la publication n'a jamais été tentée avec succès ni rejetée
   * définitivement, elle est simplement devenue trop tardive).
   */
  headline?: "failed" | "cancelled";
}

export async function notifyFailedScheduledPublish(notice: FailedPublishNotice): Promise<void> {
  const { companyId, platform, title, reason, headline = "failed" } = notice;
  const emoji = headline === "cancelled" ? "⚠️ Publication automatique annulée" : "⚠️ Échec de la publication automatique";
  const message = `${emoji} (${platform}) : « ${title} »\n${reason}`;

  await notifyCompanyTelegram(companyId, message);

  if (!isEmailConfigured()) return;
  try {
    const email = await getCompanyOwnerEmail(companyId);
    if (!email) return;
    await sendEmail({
      to: email,
      subject: `Échec d'une publication programmée — ${platform} / Scheduled post failed — ${platform}`,
      text: [
        "Une publication programmée n'a pas pu être publiée automatiquement.",
        "",
        `Réseau : ${platform}`,
        `Titre : ${title}`,
        `Raison : ${reason}`,
        "",
        "Elle est désormais visible comme « échec » dans Social Hub : reprogrammez-la ou publiez-la manuellement après correction.",
        "",
        "— — —",
        "",
        "A scheduled post could not be published automatically.",
        "",
        `Platform: ${platform}`,
        `Title: ${title}`,
        `Reason: ${reason}`,
        "",
        "It now shows as “failed” in Social Hub: reschedule it or publish it manually once fixed.",
      ].join("\n"),
    });
  } catch {
    /* non bloquant */
  }
}
