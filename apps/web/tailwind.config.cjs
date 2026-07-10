/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        surface: "#f8fafc",
        line: "#d9e2ec",
        signal: "#0f766e",
        accent: "#b45309",
      },
      boxShadow: {
        panel: "0 20px 70px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
