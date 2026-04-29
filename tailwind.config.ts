import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./data/**/*.json"],
  theme: {
    extend: {
      colors: {
        night: "#0A0420",
        violet: "#1A0638",
        pink: "#FF3DCB",
        cyan: "#00FFDC",
        acid: "#FFE600",
        grape: "#B94FFF"
      },
      fontFamily: {
        display: ["var(--font-space)", "ui-sans-serif", "system-ui"],
        body: ["var(--font-inter)", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        glowPink: "0 0 24px rgba(255, 61, 203, 0.55)",
        glowCyan: "0 0 22px rgba(0, 255, 220, 0.35)",
        glowAcid: "0 0 22px rgba(255, 230, 0, 0.35)"
      },
      backgroundImage: {
        "rave-radial":
          "radial-gradient(circle at 20% 0%, rgba(255,61,203,0.28), transparent 34%), radial-gradient(circle at 82% 16%, rgba(0,255,220,0.18), transparent 32%), linear-gradient(145deg, #0A0420 0%, #1A0638 100%)",
        scanlines:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 4px)"
      }
    }
  },
  plugins: []
};

export default config;
