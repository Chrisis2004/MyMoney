"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { accountFrom, type Account } from "./account";
import { createClient } from "./supabase/client";

type Sessione = {
  account: Account;
  /** Scrive nome e cognome nei metadati dell'utente. Lancia se non riesce. */
  salvaNome: (nome: string, cognome: string) => Promise<void>;
};

const SessionContext = createContext<Sessione | null>(null);

/**
 * Chi ha fatto l'accesso. Il valore iniziale arriva dal layout del server, che
 * l'utente ce l'ha gia' verificato: cosi' il nome in alto a destra c'e' fin dal
 * primo paint e non compare a meta' caricamento facendo ballare l'intestazione.
 */
export function SessionProvider({
  account: iniziale,
  children,
}: {
  account: Account;
  children: React.ReactNode;
}) {
  const [account, setAccount] = useState(iniziale);

  const salvaNome = useCallback(async (nome: string, cognome: string) => {
    const { data, error } = await createClient().auth.updateUser({
      data: { nome: nome.trim(), cognome: cognome.trim() },
    });
    if (error) throw error;
    // Si riparte da quello che ha risposto il server, non da quello che si e'
    // digitato: mostrato a schermo c'e' cio' che e' stato davvero salvato.
    if (data.user) setAccount(accountFrom(data.user));
  }, []);

  const value = useMemo(() => ({ account, salvaNome }), [account, salvaNome]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useAccount va usato dentro <SessionProvider>");
  return ctx;
}
