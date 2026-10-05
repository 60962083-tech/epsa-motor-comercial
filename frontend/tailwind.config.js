/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        marino: {
          DEFAULT: "#071e3d",
          700: "#0e2c52",
          50: "#eef2f7",
        },
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
