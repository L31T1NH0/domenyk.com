/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d0d0d",
        surface: "#161616",
        "surface-muted": "#1f1f1f",
        foreground: "#f4f4f5",
        muted: "#a1a1aa",
        accent: "#ff4b8b",
        "accent-soft": "rgba(255, 75, 139, 0.2)",
        border: "rgba(255, 255, 255, 0.08)",
      },
      fontFamily: {
        body: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        heading: ["PolySans", "Inter", "sans-serif"],
      },
    },
  },
};
