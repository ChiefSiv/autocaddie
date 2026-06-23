"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  /** The user's preference (may be "system"). */
  theme: ThemePreference;
  /** The actual theme in effect right now ("light" | "dark"). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Fired on this tab when the preference changes (the native `storage` event
// only fires in *other* tabs), so useSyncExternalStore re-reads immediately.
const THEME_EVENT = "autocaddie:theme-change";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable (private mode) */
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// One subscription covers all three change sources.
function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(THEME_EVENT, onChange); // this tab
  mq.addEventListener("change", onChange); // OS theme switch
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
    mq.removeEventListener("change", onChange);
  };
}

const getPreferenceSnapshot = (): ThemePreference => readPreference();
const getResolvedSnapshot = (): ResolvedTheme => {
  const p = readPreference();
  return p === "system" ? systemTheme() : p;
};
// SSR snapshots: light/system are the safe defaults; useSyncExternalStore
// reconciles to the real client value after hydration without a flash (the
// inline theme-script has already set the data-theme attribute for CSS).
const serverPreference = (): ThemePreference => "system";
const serverResolved = (): ResolvedTheme => "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    serverPreference,
  );
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    getResolvedSnapshot,
    serverResolved,
  );

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — theme still applies for the session */
    }
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
