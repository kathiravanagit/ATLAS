/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#D1D5DB",
        card: "#ffffff",
        muted: "#F3F4F6",
        atlas: {
          navy: "#1D355B",
          blue: "#1D4ED8",
          green: "#15803D",
          amber: "#B45309",
          red: "#B91C1C",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#1D355B",
          "primary-content": "#ffffff",
          "secondary": "#1D4ED8",
          "secondary-content": "#ffffff",
          "accent": "#D1D5DB",
          "accent-content": "#1F2937",
          "neutral": "#1F2937",
          "neutral-content": "#F8F9FA",
          "base-100": "#F8F9FA",
          "base-200": "#ffffff",
          "base-300": "#D1D5DB",
          "base-content": "#1F2937",
          "info": "#1D4ED8",
          "success": "#15803D",
          "warning": "#B45309",
          "error": "#B91C1C",
        },
      },
    ],
  },
}
