import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF0FF",
          100: "#DEE2FF",
          200: "#BFC7FF",
          300: "#97A5FF",
          400: "#6479FF",
          500: "#2F49F5",
          600: "#1F34CC",
          700: "#1A2AA3",
          800: "#172581",
          900: "#141F67"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
