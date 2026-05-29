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
        page: "#1e3a5f",
        canvas: "#f4f1ea",
        card: "#ffffff",
        ink: "#1f2933",
        muted: "#6b7280",
        hair: "#e7e2d6",
        ai: {
          text: "#2563eb",
          textbg: "#eff4ff",
          visual: "#7c3aed",
          visualbg: "#f3effc",
        },
        platform: {
          facebook: "#1877f2",
          instagram: "#d62976",
          linkedin: "#0a66c2",
        },
      },
      borderColor: {
        DEFAULT: "#e7e2d6",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.95rem" }],
      },
      borderWidth: {
        hair: "0.5px",
      },
    },
  },
  plugins: [],
};

export default config;
