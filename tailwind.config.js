/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Mirrors lib/theme.ts. Named utilities rather than arbitrary hex values so
      // the palette stays enforceable — a one-off `#2C3044` in a screen is a bug.
      colors: {
        ink: {
          DEFAULT: "#141620",
          raised: "#1D2030",
          sunken: "#0E1017",
          line: "#2C3044",
          "line-soft": "#222638",
        },
        paper: {
          DEFAULT: "#EDEAE0",
          dim: "#8B8FA6",
          faint: "#5D6178",
        },
        ball: {
          DEFAULT: "#E2483F",
          dim: "#8E2F2A",
        },
        foil: {
          DEFAULT: "#5FD3C4",
          dim: "#2E6B66",
        },
        gold: {
          DEFAULT: "#E9B23C",
          dim: "#8A6A22",
        },
      },
      borderRadius: {
        cell: "14px",
        stamp: "6px",
        chip: "4px",
      },
      fontFamily: {
        // Applied through components/ui/Txt rather than as utility classes.
        outfit: ["Outfit_400Regular"],
        mono: ["MartianMono_400Regular"],
      },
    },
  },
  plugins: [],
};
