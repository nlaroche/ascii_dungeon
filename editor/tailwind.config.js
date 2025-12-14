/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // NeonCoral theme from plugin_builder
        background: "#0a0a0a",
        surface: "#181818",
        elevated: "#222222",
        primary: "#e88a9d",
        accent: "#ff9d6b",
        border: "#333333",
        success: "#6bffa0",
        warning: "#ffc86b",
        error: "#ff6b6b",
        info: "#6ba8ff",
        text: "#e0e0e0",
        "text-muted": "#909090",
      },
      fontFamily: {
        heading: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["Inconsolata", "monospace"],
      },
    },
  },
  plugins: [],
};
