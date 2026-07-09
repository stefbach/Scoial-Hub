import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Core tokens (noms inchangés) ──────────────────────────────
        // Thème « Mission Control » — sombre, cinématique, améthyste.
        // Pilotés par variables CSS (RGB) -> support natif des modificateurs
        // d'opacité Tailwind (bg-card/90, text-muted/50, …).
        page:   "rgb(var(--color-page) / <alpha-value>)",   // améthyste — accent principal
        canvas: "rgb(var(--color-canvas) / <alpha-value>)", // fond spatial profond
        card:   "rgb(var(--color-card) / <alpha-value>)",   // surface verre sombre
        ink:    "rgb(var(--color-ink) / <alpha-value>)",    // texte clair haute lisibilité
        muted:  "rgb(var(--color-muted) / <alpha-value>)",  // texte secondaire violet-gris
        hair:   "rgb(var(--color-hair) / <alpha-value>)",   // bordure violette discrète
        // ── AI tokens (noms inchangés) — adaptés au thème sombre ──────
        ai: {
          text:     "#b794f6",   // violet lumineux — IA distinguée sur fond sombre
          textbg:   "#1d1536",   // fond violet profond (callouts IA)
          visual:   "#c084fc",   // violet clair éclatant pour visuels IA
          visualbg: "#221636",   // fond violet ultra-profond
        },
        // ── Platform tokens (noms inchangés) ─────────────────────────
        platform: {
          facebook:  "#1877f2",
          instagram: "#e1306c",
          linkedin:  "#0a66c2",
        },
        // ── Palette primaire — améthyste, calibrée pour fond sombre ───
        // 50/100 = tuiles sombres (callouts) ; 600/700 = texte clair lisible.
        primary: {
          50:  "#1b1330",   // tuile violette profonde (fond de callout)
          100: "#251a40",   // tuile violette un peu plus claire
          200: "#3a2c5e",   // bordures discrètes
          300: "#bb9fff",   // accents clairs (rings)
          400: "#9b6eff",
          500: "#7c3aed",   // accent solide (boutons)
          600: "#a78bfa",   // TEXTE clair sur fond sombre
          700: "#c4b5fd",   // TEXTE très clair
          800: "#4c1d95",
          900: "#3b0764",
        },
        // ── Sémantiques — fonds sombres + textes clairs ───────────────
        success: {
          50:  "#0f2a1c",   // tuile verte profonde
          100: "#15351f",
          500: "#22c55e",   // solide (points, boutons)
          600: "#4ade80",   // TEXTE clair
          700: "#86efac",   // TEXTE très clair
        },
        warning: {
          50:  "#2a2110",   // tuile ambre profonde
          100: "#3a2c12",
          500: "#f59e0b",   // solide
          600: "#fbbf24",   // TEXTE clair
          700: "#fcd34d",   // TEXTE très clair
        },
        danger: {
          50:  "#2c1417",   // tuile rouge profonde
          100: "#3a181e",
          200: "#5a2730",   // bordures discrètes
          300: "#7a3340",   // bordures accentuées (hover)
          500: "#f43f5e",   // solide
          600: "#fb7185",   // TEXTE clair
          700: "#fda4af",   // TEXTE très clair
        },
      },
      borderColor: {
        DEFAULT: "rgb(var(--color-hair))",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderWidth: {
        hair: "0.5px",
      },
      borderRadius: {
        sm:    "0.25rem",
        md:    "0.5rem",
        lg:    "0.75rem",
        xl:    "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        // Ombres douces avec teinte prune pour plus de profondeur
        xs:         "0 1px 2px 0 rgb(91 45 142 / 0.05)",
        sm:         "0 1px 3px 0 rgb(91 45 142 / 0.08), 0 1px 2px -1px rgb(91 45 142 / 0.04)",
        md:         "0 4px 6px -1px rgb(91 45 142 / 0.08), 0 2px 4px -2px rgb(91 45 142 / 0.05)",
        lg:         "0 10px 15px -3px rgb(91 45 142 / 0.10), 0 4px 6px -4px rgb(91 45 142 / 0.05)",
        xl:         "0 20px 25px -5px rgb(91 45 142 / 0.12), 0 8px 10px -6px rgb(91 45 142 / 0.05)",
        "2xl":      "0 25px 50px -12px rgb(91 45 142 / 0.22)",
        // Ombre inset subtile (champs, cards enfoncées)
        "inner-sm": "inset 0 1px 2px 0 rgb(91 45 142 / 0.05)",
        // Ombre d'accent prune pour focus/hover
        "primary":  "0 0 0 3px rgb(124 58 237 / 0.18)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "300ms",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      animation: {
        "fade-in":   "fadeIn 160ms ease-out both",
        "slide-up":  "slideUp 200ms cubic-bezier(0.4, 0, 0.2, 1) both",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
