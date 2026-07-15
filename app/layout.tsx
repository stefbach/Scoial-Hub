import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { CompanyProvider } from "@/lib/company-context";
import { ScopeProvider } from "@/lib/scope";
import { LangProvider } from "@/lib/i18n";
import { AppShell } from "@/components/shell/AppShell";
import { AccountGate } from "@/components/shell/AccountGate";

/* ── Typographie premium ─────────────────────────────────────────────
   Fraunces : serif optique variable, éditorial et haut de gamme
              → utilisée pour h1–h3 via --font-display
   Manrope  : humaniste sans-serif moderne, confort de lecture optimal
              → police du corps via --font-sans                        */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Viewport explicite : rendu mobile correct (width=device-width) + zoom autorisé
// (a11y) jusqu'à 5x. `viewportFit: cover` gère les encoches (safe-area iOS).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "AXON-AI · Social Media",
  description: "Pilotage intelligent des campagnes social media par agents IA — suite AXON-AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Applique le thème (jour/nuit) AVANT la première peinture — aucun flash.
            Sombre par défaut ; « light » si l'utilisateur l'a choisi.
            NOTE sécurité : contenu 100% statique (aucune donnée utilisateur). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("axon_theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}',
          }}
        />
      </head>
      <body>
        <LangProvider>
          <CompanyProvider>
            <ScopeProvider>
              <AccountGate>
                <AppShell>{children}</AppShell>
              </AccountGate>
            </ScopeProvider>
          </CompanyProvider>
        </LangProvider>
      </body>
    </html>
  );
}
