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
};

/** True quand Supabase est configuré (URL + clé anon présentes). */
export const isSupabaseConfigured =
  Boolean(env.supabaseUrl) && Boolean(env.supabaseAnonKey);

/** True quand la génération de texte IA (Claude) est disponible. */
export const isAiConfigured = Boolean(env.anthropicKey);
