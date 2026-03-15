import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0B",
        surface: "#141416",
        "surface-hover": "#1A1A1D",
        "surface-active": "#222225",
        border: "#2A2A2E",
        "border-subtle": "#1F1F22",
        "text-primary": "#F5F0E8",
        "text-secondary": "#9A9A9E",
        "text-muted": "#6A6A6E",
        accent: "#D4A843",
        "accent-hover": "#E0B85A",
        "accent-muted": "#D4A84333",
        cta: "#E85D4A",
        "cta-hover": "#F06E5C",
        success: "#34C759",
        error: "#FF453A",
        warning: "#FFD60A",
        info: "#5AC8FA",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        card: "12px",
        modal: "16px",
        pill: "9999px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "waveform": "waveform 1.4s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212, 168, 67, 0)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(212, 168, 67, 0.15)" },
        },
        waveform: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
