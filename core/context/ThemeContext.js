// core/context/ThemeContext.js
// SAFE: Empty stubs to prevent crashes if anything still imports useTheme()

import { getTheme } from "@/themes";

// Always return the Rider theme
export function useTheme() {
  return getTheme({ brand: "rider", accessibility: "normal" });
}

// Optional: a matching stub so imports don't crash
export function useThemeControls() {
  return {
    brand: "rider",
    accessibility: "normal",
    setBrand: () => {},
    setAccessibility: () => {},
  };
}

// We no longer export a ThemeProvider — it is not used anymore.
export const ThemeProvider = ({ children }) => children;
