import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchUserPreferences, upsertUserPreferences } from "./api/preferences";
import { isSupabaseConfigured } from "./supabase";

export type ColorMode = "light" | "dark";

const STORAGE_KEY = "rrt-student-color-mode";

function readStoredMode(): ColorMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type ColorModeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(readStoredMode);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void fetchUserPreferences().then((prefs) => {
      if (prefs?.colorMode) {
        setModeState(prefs.colorMode);
        window.localStorage.setItem(STORAGE_KEY, prefs.colorMode);
      }
    }).catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    if (!isSupabaseConfigured) return;
    void upsertUserPreferences({ colorMode: next }).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) {
    throw new Error("useColorMode must be used within ColorModeProvider");
  }
  return ctx;
}

/** Applies the Tailwind `.dark` ancestor so `dark:` utilities resolve on children. */
export function ColorModeRoot({ children }: { children: ReactNode }) {
  const { mode } = useColorMode();
  return (
    <div className={mode === "dark" ? "dark h-dvh min-h-0" : "h-dvh min-h-0"} style={{ colorScheme: mode }}>
      {children}
    </div>
  );
}
