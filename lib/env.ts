// Accès centralisé aux variables d'environnement + flags de configuration.
// L'app applique une "dégradation gracieuse" : tant qu'un service n'est pas
// configuré, la couche correspondante retombe sur les données mock.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // Fuseau horaire de RÉFÉRENCE pour la programmation des publications.
  // Les heures saisies (« 09:00 ») sont interprétées dans cette zone, et le cron
  // (qui tourne en UTC) y compare l'heure courante. Nom IANA (ex. "Indian/Mauritius",
  // "Europe/Paris", "UTC"). Par défaut : Maurice (UTC+4).
  scheduleTimezone: process.env.SCHEDULE_TIMEZONE ?? "Indian/Mauritius",
  // Secret partagé pour authentifier les webhooks providers (Replicate/Shotstack)
  // qui « réveillent » nos jobs de rendu quand le résultat est prêt.
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  // Bot Telegram central AXON-AI : un seul bot pour tous les comptes.
  // Chaque compte est relié par un code de jumelage (pas de bot par client).
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramBotUsername:
    process.env.TELEGRAM_BOT_USERNAME ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "",
  // MiroFish — moteur de simulation multi-agents PREMIUM (self-hosted, Docker).
  // URL de l'instance backend (ex. http://mirofish-host:5001) + clé optionnelle.
  mirofishBaseUrl: process.env.MIROFISH_BASE_URL ?? "",
  mirofishApiKey: process.env.MIROFISH_API_KEY ?? "",
};

/** True quand Supabase est configuré (URL + clé anon présentes). */
export const isSupabaseConfigured =
  Boolean(env.supabaseUrl) && Boolean(env.supabaseAnonKey);

/** True quand la génération de texte IA (Claude) est disponible. */
export const isAiConfigured = Boolean(env.anthropicKey);

/** True quand le bot Telegram central est configuré (token + username). */
export const isTelegramBotConfigured =
  Boolean(env.telegramBotToken) && Boolean(env.telegramBotUsername);

/** True quand les webhooks de rendu sont activables (secret + URL publique). */
export const isWebhookConfigured =
  Boolean(env.webhookSecret) && /^https?:\/\//.test(env.appUrl) && !env.appUrl.includes("localhost");

/** True quand un moteur de rendu vidéo (Creatomate/Shotstack/worker FFmpeg) est branché. */
export const isVideoRenderConfigured =
  Boolean(process.env.SHOTSTACK_API_KEY) || Boolean(process.env.VIDEO_RENDER_API_KEY);

/** True quand le moteur de simulation premium MiroFish est branché (self-hosted). */
export const isMirofishConfigured = /^https?:\/\//.test(env.mirofishBaseUrl);

/** Config Shotstack (rendu vidéo à partir d'un timeline JSON). */
export const shotstack = {
  apiKey: process.env.SHOTSTACK_API_KEY ?? "",
  // "stage" (bac à sable, par défaut) ou "v1" (production).
  env: process.env.SHOTSTACK_ENV === "v1" ? "v1" : "stage",
};
export const isShotstackConfigured = Boolean(shotstack.apiKey);
