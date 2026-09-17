import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sn: {
          page: "#F5F5F7",
          surface: "#FFFFFF",
          subtle: "#FAFAFA",
          hover: "#F0F0F3",
          primary: "#1A1A1E",
          secondary: "#6B6B76",
          muted: "#9E9EA8",
          success: "#34C759",
          error: "#FF6B6B",
          warning: "#FFB347",
          info: "#5B9BF5",
        },
      },
      borderRadius: {
        "sn-sm": "12px",
        "sn-md": "16px",
        "sn-lg": "24px",
        "sn-xl": "32px",
      },
      boxShadow: {
        "sn-card": "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        "sn-float": "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
        "sn-hover": "0 12px 48px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.05)",
      },
      fontFamily: {
        sn: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      transitionTimingFunction: {
        sn: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
