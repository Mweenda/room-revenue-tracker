import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
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
    <div className={mode === "dark" ? "dark h-screen" : "h-screen"} style={{ colorScheme: mode }}>
      {children}
    </div>
  );
}
