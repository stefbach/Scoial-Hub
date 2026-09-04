import type { MetadataRoute } from "next";

// Rend l'app installable (PWA) sur desktop/mobile — icône, écran de démarrage,
// mode "standalone" sans barre d'adresse. Servi automatiquement en
// /manifest.webmanifest par la convention App Router.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AXON-AI · Social Media",
    short_name: "AXON-AI",
    description: "Pilotage intelligent des campagnes social media par agents IA — suite AXON-AI",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0b0614",
    theme_color: "#5b2d8e",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
