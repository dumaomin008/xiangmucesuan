"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Mode = "normal" | "pro";

const ModeContext = createContext<{
  mode: Mode;
  professional: boolean;
  setMode: (mode: Mode) => void;
}>({
  mode: "normal",
  professional: false,
  setMode: () => undefined,
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("normal");
  useEffect(() => {
    const saved = localStorage.getItem("calc-mode");
    if (saved === "pro" || saved === "normal") setModeState(saved);
  }, []);
  const setMode = (next: Mode) => {
    setModeState(next);
    localStorage.setItem("calc-mode", next);
  };
  return <ModeContext.Provider value={{ mode, professional: mode === "pro", setMode }}>{children}</ModeContext.Provider>;
}

export function useCalcMode() {
  return useContext(ModeContext);
}
