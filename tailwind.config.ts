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
        // Nouvelle palette : Prune-Améthyste — accent unique, fort, mémorable
        page:   "#5b2d8e",   // prune-violet profond — accent principal premium
        canvas: "#f6f4f9",   // lavande très claire — fond général raffiné
        card:   "#ffffff",   // blanc pur — surfaces élevées
        ink:    "#1c1625",   // quasi-noir violet-chaud — lisibilité absolue
        muted:  "#7a6f8a",   // violet-gris doux — textes secondaires
        hair:   "#e8e4f0",   // bordure lavande discrète et élégante
        // ── AI tokens (noms inchangés) ────────────────────────────────
        ai: {
          text:     "#7c3aed",   // violet vif — IA distinguée
          textbg:   "#f3eeff",   // fond violet très clair
          visual:   "#9333ea",   // violet riche pour visuels IA
          visualbg: "#faf0ff",   // fond violet ultra-clair
        },
        // ── Platform tokens (noms inchangés) ─────────────────────────
        platform: {
          facebook:  "#1877f2",
          instagram: "#e1306c",
          linkedin:  "#0a66c2",
        },
        // ── Palette primaire — accord avec le prune-améthyste ────────
        primary: {
          50:  "#f5f0ff",
          100: "#ece3ff",
          200: "#d8c8ff",
          300: "#bb9fff",
          400: "#9b6eff",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
          900: "#3b0764",
        },
        // ── Sémantiques ───────────────────────────────────────────────
        success: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        warning: {
          50:  "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50:  "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
        },
      },
      borderColor: {
        DEFAULT: "#e8e4f0",
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
