"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DashboardHeaderState = {
  heading?: string;
  description?: string;
};

type DashboardHeaderContextValue = {
  state: DashboardHeaderState;
  setState: (value: DashboardHeaderState) => void;
};

const DashboardHeaderContext = createContext<DashboardHeaderContextValue | undefined>(undefined);

export function DashboardHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardHeaderState>({});
  const value = useMemo(() => ({ state, setState }), [state]);

  return <DashboardHeaderContext.Provider value={value}>{children}</DashboardHeaderContext.Provider>;
}

export function useDashboardHeader() {
  const context = useContext(DashboardHeaderContext);
  if (!context) {
    throw new Error("useDashboardHeader must be used within a DashboardHeaderProvider");
  }
  return context;
}
