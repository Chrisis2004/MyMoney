"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { currentMonth } from "./format";

const MONTH_KEY = "gestione-risparmio:month";

type MonthCtx = { month: string; setMonth: (m: string) => void };

const Ctx = createContext<MonthCtx | null>(null);

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [month, setMonth] = useState(currentMonth);

  // Letto dopo l'idratazione: il server non conosce la scelta dell'utente.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(MONTH_KEY);
      if (saved && /^\d{4}-\d{2}$/.test(saved)) setMonth(saved);
    } catch {
      /* sessionStorage non disponibile: resta il mese corrente */
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(MONTH_KEY, month);
    } catch {
      /* niente da fare: la selezione vale solo per questa pagina */
    }
  }, [month]);

  return <Ctx.Provider value={{ month, setMonth }}>{children}</Ctx.Provider>;
}

export function useMonth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMonth va usato dentro <MonthProvider>");
  return ctx;
}
