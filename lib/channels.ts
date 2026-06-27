// Catalogue des canaux + champs de connexion à collecter par compte (réceptacles).
// Sert d'UI/contrat pour la page de connexion par entité et le stockage
// dans public.sh_channel_connections (config jsonb).

export type ChannelId =
  | "facebook" | "instagram" | "linkedin" | "tiktok"
  | "twitter" | "pinterest" | "threads"
  | "meta_pixel" | "ga4" | "meta_app" | "telegram";

export interface ChannelField {
  key: string;
  label: string;
  secret?: boolean;       // masqué + jamais ré-affiché en clair
  placeholder?: string;
  help?: string;
}

export interface ChannelDef {
  id: ChannelId;
  label: string;
  group: "social" | "ads" | "measure" | "messaging";
  color: string;
  description: string;
  where: string;          // où récupérer les infos
  fields: ChannelField[];
}

export const CHANNELS: ChannelDef[] = [
  {
    id: "facebook", label: "Facebook", group: "social", color: "#1877F2",
    description: "Page Facebook : publication organique + insights.",
    where: "developers.facebook.com → ton app → Business Manager → Page",
    fields: [
      { key: "page_id", label: "Page ID", placeholder: "1234567890" },
      { key: "business_manager_id", label: "Business Manager ID", placeholder: "BM ID" },
      { key: "page_access_token", label: "Page Access Token", secret: true, help: "Token long ou System User" },
    ],
  },
  {
    id: "instagram", label: "Instagram", group: "social", color: "#E1306C",
    description: "Compte Instagram Business lié à la Page FB.",
    where: "Compte IG Business relié à la Page Facebook (Meta)",
    fields: [
      { key: "ig_business_account_id", label: "IG Business Account ID", placeholder: "1789..." },
    ],
  },
  {
    id: "linkedin", label: "LinkedIn", group: "social", color: "#0A66C2",
    description: "Page entreprise LinkedIn + Marketing API.",
    where: "linkedin.com/developers → app → Marketing Developer Platform",
    fields: [
      { key: "organization_urn", label: "Organization URN", placeholder: "urn:li:organization:123" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    id: "tiktok", label: "TikTok", group: "social", color: "#000000",
    description: "TikTok for Business / Marketing API.",
    where: "business-api.tiktok.com → app → advertiser",
    fields: [
      { key: "advertiser_id", label: "Advertiser ID", placeholder: "70123..." },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    id: "twitter", label: "Twitter / X", group: "social", color: "#000000",
    description: "Publication de tweets via l'API v2 (OAuth 2.0). Connexion sécurisée — aucun token à coller.",
    where: "Connexion automatique : bouton « Connecter » (OAuth). Sinon developer.twitter.com → Project → App (OAuth 2.0).",
    fields: [
      { key: "external_id", label: "User ID (optionnel)", placeholder: "rempli automatiquement après connexion" },
    ],
  },
  {
    id: "pinterest", label: "Pinterest", group: "social", color: "#E60023",
    description: "Création de Pins via l'API v5 (OAuth 2.0). Un board cible est requis pour publier.",
    where: "Connexion automatique : bouton « Connecter » (OAuth). Sinon developers.pinterest.com → App.",
    fields: [
      { key: "external_id", label: "Board ID cible", placeholder: "id du board où publier les Pins" },
    ],
  },
  {
    id: "threads", label: "Threads", group: "social", color: "#000000",
    description: "Publication sur Threads via la Threads Graph API (OAuth 2.0).",
    where: "Connexion automatique : bouton « Connecter » (OAuth). Compte Threads professionnel lié à Meta.",
    fields: [
      { key: "external_id", label: "Threads User ID (optionnel)", placeholder: "rempli automatiquement après connexion" },
    ],
  },
  {
    id: "meta_pixel", label: "Meta Pixel + CAPI", group: "measure", color: "#1877F2",
    description: "Suivi des conversions (Pixel + Conversions API).",
    where: "Meta Events Manager → Pixel → Conversions API",
    fields: [
      { key: "pixel_id", label: "Pixel ID", placeholder: "987654321" },
      { key: "capi_token", label: "CAPI Access Token", secret: true },
    ],
  },
  {
    id: "ga4", label: "Google Analytics 4", group: "measure", color: "#E8710A",
    description: "Mesure web & attribution.",
    where: "analytics.google.com → Admin → Property + Cloud (Data API)",
    fields: [
      { key: "property_id", label: "Property ID", placeholder: "GA4 property" },
      { key: "measurement_id", label: "Measurement ID", placeholder: "G-XXXXXXX" },
      { key: "api_secret", label: "API Secret (Measurement Protocol)", secret: true },
    ],
  },
  {
    id: "telegram",
    label: "Telegram",
    group: "messaging",
    color: "#229ED9",
    description: "Bot Telegram par compte — pilotez agents et campagnes via chat.",
    where: "Ouvrez Telegram → @BotFather → /newbot → copiez le token API fourni. Configurez-le ci-dessous, puis activez le webhook pour connecter le bot à cet espace de travail.",
    fields: [
      {
        key: "bot_token",
        label: "Token du bot",
        secret: true,
        placeholder: "1234567890:ABCdef...",
        help: "Obtenu via @BotFather sur Telegram. Format : <id>:<token>",
      },
      {
        key: "allowed_chat_ids",
        label: "Chat IDs autorisés (optionnel)",
        placeholder: "123456789, -987654321",
        help: "IDs séparés par des virgules. Laissez vide pour tout autoriser. Utilisez @userinfobot pour connaître votre ID.",
      },
    ],
  },
];

export function channelById(id: string): ChannelDef | undefined {
  return CHANNELS.find((c) => c.id === id);
}
