// Catalogue des canaux + champs de connexion à collecter par compte (réceptacles).
// Sert d'UI/contrat pour la page de connexion par entité et le stockage
// dans public.sh_channel_connections (config jsonb).

export type ChannelId =
  | "facebook" | "instagram" | "linkedin" | "tiktok" | "meta_pixel" | "ga4" | "meta_app";

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
  group: "social" | "ads" | "measure";
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
];

export function channelById(id: string): ChannelDef | undefined {
  return CHANNELS.find((c) => c.id === id);
}
