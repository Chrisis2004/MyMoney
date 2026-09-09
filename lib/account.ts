import type { User } from "@supabase/supabase-js";

export type Account = {
  email: string;
  nome: string;
  cognome: string;
};

const testo = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Nome e cognome stanno nei metadati dell'utente Supabase, non in una tabella:
 * sono dati dell'identita', non dell'app, e arrivano gia' dentro la sessione
 * verificata, senza una lettura in piu' a ogni pagina.
 */
export function accountFrom(user: User): Account {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    email: user.email ?? "",
    nome: testo(meta.nome),
    cognome: testo(meta.cognome),
  };
}

/**
 * "Mario Rossi". Chi si e' registrato prima che esistessero questi campi non ha
 * un nome: si ripiega sulla parte davanti alla @, che e' comunque una cosa che
 * l'utente riconosce come sua.
 */
export function nomeCompleto(a: Account): string {
  const nome = [a.nome, a.cognome].filter(Boolean).join(" ");
  return nome || a.email.split("@")[0] || "Account";
}

/** Al massimo due lettere, per il cerchietto in alto a destra. */
export function iniziali(a: Account): string {
  const parti = [a.nome, a.cognome].filter(Boolean);
  const base = parti.length > 0 ? parti : nomeCompleto(a).split(/[.\s_-]+/).filter(Boolean);
  return base
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
