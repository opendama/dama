/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        black: {
          DEFAULT: "#000",
          100: "#000319",
          200: "rgba(17, 25, 40, 0.75)",
          300: "rgba(255, 255, 255, 0.125)",
        },
        dama: {
          bg: "var(--dama-bg)",
          card: "var(--dama-card)",
          text: "var(--dama-text)",
          muted: "var(--dama-muted)",
          border: "var(--dama-border)",
          brand: "var(--dama-brand)",
          "brand-mid": "var(--dama-brand-mid)",
          "brand-deep": "var(--dama-brand-deep)",
          gold: "var(--dama-gold)",
          "gold-light": "var(--dama-gold-light)",
          "gold-deep": "var(--dama-gold-deep)",
        },
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
};
