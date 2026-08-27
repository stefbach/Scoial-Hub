import { ImageResponse } from "next/og";

// Icône iOS/Safari (Ajouter à l'écran d'accueil) — même tracé "Axon Core",
// avec le fond rendu carré plein (iOS applique lui-même l'arrondi).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="axon-apple" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a684ff" />
            <stop offset="1" stopColor="#5b2d8e" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" fill="url(#axon-apple)" />
        <g stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.9">
          <line x1="16" y1="16" x2="8.5" y2="9.5" />
          <line x1="16" y1="16" x2="23.5" y2="9.5" />
          <line x1="16" y1="16" x2="9.5" y2="23.5" />
          <line x1="16" y1="16" x2="22.5" y2="22.5" />
        </g>
        <g fill="#ffffff">
          <circle cx="8.5" cy="9.5" r="2" />
          <circle cx="23.5" cy="9.5" r="2" />
          <circle cx="9.5" cy="23.5" r="1.7" />
          <circle cx="22.5" cy="22.5" r="1.7" />
        </g>
        <circle cx="16" cy="16" r="3.5" fill="#ffffff" />
        <circle cx="16" cy="16" r="1.6" fill="#4c2a80" />
      </svg>
    ),
    { ...size }
  );
}
