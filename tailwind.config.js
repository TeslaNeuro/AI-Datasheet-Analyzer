/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        ink: {
          50: "#f5f7fa",
          100: "#e6ebf2",
          200: "#c9d3e0",
          300: "#9eb0c4",
          400: "#6e85a0",
          500: "#4a627e",
          600: "#384d66",
          700: "#293a50",
          800: "#1b283a",
          900: "#0f1826",
          950: "#070d18",
        },
        accent: {
          400: "#5eead4",
          500: "#14b8a6",
          600: "#0d9488",
        },
        warn: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(0,0,0,0.05), 0 8px 24px -12px rgba(15,24,38,0.25)",
      },
      typography: () => ({}),
    },
  },
  plugins: [],
};
