/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Barlow", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["\"Barlow Condensed\"", "Barlow", "Arial Narrow", "system-ui", "sans-serif"],
      },
      colors: {
        marino: {
          DEFAULT: "#071e3d",
          700: "#0e2c52",
          50: "#eef2f7",
        },
        // Escenario de producto (fondo de fotos) y líneas finas
        escenario: { DEFAULT: "#f2f5f9", oscuro: "#0f1b30" },
        linea: { DEFAULT: "#e3e8ef", oscuro: "#1c2a44" },
        acento: {
          DEFAULT: "#c62828",
          600: "#a81f1f",
        },
        whatsapp: {
          DEFAULT: "#25d366",
          600: "#1ebe5a",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(7,30,61,.04), 0 10px 28px rgba(7,30,61,.07)",
        cardHover: "0 1px 2px rgba(7,30,61,.05), 0 16px 36px rgba(7,30,61,.12)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};
