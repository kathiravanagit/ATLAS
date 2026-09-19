/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#27272a",
        card: "#18181b",
        muted: "#27272a",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        dark: {
          "primary": "#ffffff",
          "primary-content": "#000000",
          "secondary": "#e4e4e7",
          "secondary-content": "#000000",
          "accent": "#52525b",
          "accent-content": "#ffffff",
          "neutral": "#18181b",
          "neutral-content": "#e4e4e7",
          "base-100": "#09090b",
          "base-200": "#18181b",
          "base-300": "#27272a",
          "base-content": "#fafafa",
          "info": "#e4e4e7",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
}
