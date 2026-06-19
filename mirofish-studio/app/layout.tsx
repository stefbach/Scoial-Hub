import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "MiroFish Studio — Simulation de marché",
  description:
    "Simulation multi-agents de la réception marché d'un lancement, cadrée niveau cabinet de conseil (KPMG/McKinsey/BCG).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
