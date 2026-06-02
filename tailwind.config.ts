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
        page:   "#1c1d20",   // presque noir neutre — accents/boutons (style Linear)
        canvas: "#f7f8f9",   // gris très clair froid — fond général épuré
        card:   "#ffffff",
        ink:    "#16181d",   // quasi-noir neutre, lisible
        muted:  "#8a8f98",   // gris doux — textes secondaires (Linear)
        hair:   "#ececee",   // bordure gris clair discrète
        // ── AI tokens (noms inchangés) ────────────────────────────────
        ai: {
          text:     "#2563eb",
          textbg:   "#eef3ff",
          visual:   "#7c3aed",
          visualbg: "#f0ecfd",
        },
        // ── Platform tokens (noms inchangés) ─────────────────────────
        platform: {
          facebook:  "#1877f2",
          instagram: "#e1306c",
          linkedin:  "#0a66c2",
        },
        // ── Palette primaire avec nuances ────────────────────────────
        primary: {
          50:  "#eff4ff",
          100: "#dce8fe",
          200: "#bbd3fd",
          300: "#8eb5fb",
          400: "#5990f7",
          500: "#3b71f3",
          600: "#2352e8",
          700: "#1a3dd6",
          800: "#1c33ad",
          900: "#1a3558",
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
        DEFAULT: "#ececee",
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
        // Ombres douces et modernes
        xs:         "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        sm:         "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        md:         "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
        lg:         "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
        xl:         "0 20px 25px -5px rgb(0 0 0 / 0.09), 0 8px 10px -6px rgb(0 0 0 / 0.04)",
        "2xl":      "0 25px 50px -12px rgb(0 0 0 / 0.18)",
        // Ombre inset subtile (champs, cards enfoncées)
        "inner-sm": "inset 0 1px 2px 0 rgb(0 0 0 / 0.05)",
        // Ombre d'accent bleue pour focus/hover
        "primary":  "0 0 0 3px rgb(59 113 243 / 0.15)",
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
