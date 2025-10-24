"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "LIGHT" | "DARK";

type DashboardThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const DashboardThemeContext = createContext<DashboardThemeContextValue | undefined>(undefined);

type DashboardThemeProviderProps = {
  initialTheme: ThemePreference;
  children: ReactNode;
};

export function DashboardThemeProvider({ initialTheme, children }: DashboardThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "DARK");
    try {
      window.localStorage.setItem("dashboard-theme", theme);
    } catch {
      // ignore storage errors (e.g. private mode)
    }
    return () => {
      root.classList.remove("dark");
    };
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>;
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext);
  if (!context) {
    throw new Error("useDashboardTheme harus digunakan di dalam DashboardThemeProvider");
  }
  return context;
}
