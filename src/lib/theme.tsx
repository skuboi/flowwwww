"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Theme system for flowwwww.
 *
 * The product ships three parallel visual identities; component logic and
 * structure are identical across them — only CSS changes. Switching themes
 * sets `data-theme` on the <html> element, which is read by the per-theme
 * style sheets in globals.css.
 *
 *   "plur" — original deep-violet PLUR rave aesthetic (default).
 *   "holo" — holographic / iridescent trading-card-foil aesthetic.
 *   "mono" — minimalist near-monochrome (black/white + tiny color hints).
 *
 * The choice persists across reloads via localStorage. The default ("plur")
 * is applied during SSR / first paint to avoid a theme flash; the stored
 * preference is then hydrated client-side.
 */

export type ThemeName = "plur" | "holo" | "mono";

const STORAGE_KEY = "flowwwww:theme";
const THEME_ORDER: ThemeName[] = ["plur", "holo", "mono"];

type ThemeCtx = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: "plur",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start as "plur" to match the SSR-rendered HTML, then hydrate from storage.
  const [theme, setThemeState] = useState<ThemeName>("plur");

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? (window.localStorage.getItem(STORAGE_KEY) as ThemeName | null)
      : null);
    if (stored && THEME_ORDER.includes(stored)) {
      setThemeState(stored);
    }
  }, []);

  // Reflect theme onto the <html> element so the CSS layer can react.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function setTheme(next: ThemeName) {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / storage quota — non-fatal; theme just won't persist.
    }
  }

  function toggle() {
    // Cycle plur → holo → mono → plur.
    const idx = THEME_ORDER.indexOf(theme);
    setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
