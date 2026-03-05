import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3A6DF0",
        accent: "#7B6CFF",
        appbg: "#F6F7FB",
        game: {
          dark: "#0f0c29",
          mid: "#302b63",
          purple: "#24243e",
          neon: "#A78BFA",
          pink: "#EC4899",
          blue: "#6366F1"
        }
      },
      backgroundImage: {
        "game-gradient": "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        "button-gradient": "linear-gradient(90deg, #7C3AED 0%, #EC4899 50%, #6366F1 100%)"
      },
      boxShadow: {
        card: "0 14px 34px rgba(58, 109, 240, 0.12)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        "glow": "0 0 28px rgba(167, 139, 250, 0.35), 0 0 48px rgba(124, 58, 237, 0.2)",
        "glow-hover": "0 0 32px rgba(167, 139, 250, 0.4), 0 0 56px rgba(124, 58, 237, 0.25)",
        "btn-glow": "0 0 24px rgba(124, 58, 237, 0.5), 0 0 40px rgba(236, 72, 153, 0.3)"
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 24px rgba(124, 58, 237, 0.5)" },
          "50%": { opacity: "0.9", boxShadow: "0 0 32px rgba(124, 58, 237, 0.6)" }
        },
        "bar-fill": {
          "0%": { width: "0%" },
          "100%": { width: "var(--bar-width, 0%)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        }
      },
      animation: {
        rise: "rise 0.45s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "bar-fill": "bar-fill 0.8s ease-out forwards",
        shimmer: "shimmer 3s ease-in-out infinite"
      },
      backgroundSize: {
        shimmer: "200% 100%"
      }
    }
  },
  plugins: []
};

export default config;
