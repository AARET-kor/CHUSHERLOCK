import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#051A24",
        inkdeep: "#0D212C",
        muted: "#51626B",
        mist: "#F4F4F6",
      },
    },
  },
  plugins: [],
};

export default config;
