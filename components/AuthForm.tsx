"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "./ui";

type Mode = "accedi" | "registrazione";

/** Supabase risponde in inglese: qui si traduce quel che l'utente vede spesso. */
function inItaliano(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o password non corrette.";
  if (m.includes("email not confirmed"))
    return "Devi prima confermare l'indirizzo email: controlla la posta.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Esiste già un account con questa email. Prova ad accedere.";
  if (m.includes("password should be at least"))
    return "La password è troppo corta: servono almeno 6 caratteri.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "L'indirizzo email non è valido.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Troppi tentativi ravvicinati. Aspetta qualche minuto e riprova.";
  return message;
}

const TESTI = {
  accedi: {
    titolo: "Accedi",
    sottotitolo: "Entra con la tua email e la tua password.",
    azione: "Accedi",
    inCorso: "Accedo…",
    altroLink: "/registrazione",
    altroTesto: "Non hai un account?",
    altroInvito: "Registrati",
  },
  registrazione: {
    titolo: "Crea un account",
    sottotitolo: "Come ti chiami, la tua email e una password.",
    azione: "Registrati",
    inCorso: "Creo l'account…",
    altroLink: "/accedi",
    altroTesto: "Hai già un account?",
    altroInvito: "Accedi",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const t = TESTI[mode];
  const router = useRouter();
  const params = useSearchParams();
  // Dove si voleva andare prima di essere rimbalzati all'accesso.
  const destinazione = params.get("vai") ?? "/";

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attesaEmail, setAttesaEmail] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const credenziali = { email: email.trim(), password };

      if (mode === "accedi") {
        const { error } = await supabase.auth.signInWithPassword(credenziali);
        if (error) throw error;
      } else {
        // Nome e cognome finiscono nei metadati dell'utente: si scrivono una
        // volta sola, alla registrazione, e sono modificabili da Impostazioni.
        const { data, error } = await supabase.auth.signUp({
          ...credenziali,
          options: { data: { nome: nome.trim(), cognome: cognome.trim() } },
        });
        if (error) throw error;
        // Con la conferma via email attiva Supabase non apre la sessione:
        // inutile mandare avanti, l'app rimbalzerebbe qui.
        if (!data.session) {
          setAttesaEmail(true);
          setBusy(false);
          return;
        }
      }

      // refresh() rilegge i Server Component con la sessione appena creata,
      // altrimenti il layout continuerebbe a vedere un utente assente.
      router.replace(destinazione.startsWith("/") ? destinazione : "/");
      router.refresh();
      // Qui busy NON si spegne: le credenziali sono andate a buon fine ma la
      // pagina di destinazione deve ancora arrivare, e sono i secondi piu'
      // lunghi. Spegnendolo il pulsante tornerebbe a dire "Accedi" su una
      // schermata ferma, come se il clic fosse andato perso.
    } catch (err) {
      setError(inItaliano(err instanceof Error ? err.message : String(err)));
      setBusy(false);
    }
  };

  if (attesaEmail) {
    return (
      <div className="rounded-xl border border-hairline bg-surface px-6 py-8 text-center">
        <p className="text-sm font-semibold tracking-tight text-ink">Controlla la posta</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
          Abbiamo inviato un messaggio di conferma a <strong>{email}</strong>. Apri il link
          che trovi dentro, poi torna qui e accedi.
        </p>
        <Link
          href="/accedi"
          className="mt-4 inline-block text-xs font-semibold text-ink underline underline-offset-2"
        >
          Vai all&apos;accesso
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-hairline bg-surface px-6 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <h1 className="text-lg font-bold tracking-[-0.04em] text-ink">{t.titolo}</h1>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{t.sottotitolo}</p>

      <div className="mt-5 space-y-3">
        {mode === "registrazione" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome">
              <Input
                name="nome"
                autoComplete="given-name"
                required
                disabled={busy}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Field>
            <Field label="Cognome">
              <Input
                name="cognome"
                autoComplete="family-name"
                required
                disabled={busy}
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
              />
            </Field>
          </div>
        )}

        <Field label="Email">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            disabled={busy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field
          label="Password"
          hint={mode === "registrazione" ? "Almeno 6 caratteri." : undefined}
        >
          <Input
            type="password"
            name="password"
            autoComplete={mode === "accedi" ? "current-password" : "new-password"}
            required
            minLength={6}
            disabled={busy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-xs leading-relaxed text-ink">
          <span aria-hidden style={{ color: "var(--critical)" }}>
            ■
          </span>{" "}
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className="mt-5 w-full" loading={busy}>
        {busy ? t.inCorso : t.azione}
      </Button>

      <p className="mt-4 text-center text-xs text-ink-secondary">
        {t.altroTesto}{" "}
        <Link href={t.altroLink} className="font-semibold text-ink underline underline-offset-2">
          {t.altroInvito}
        </Link>
      </p>
    </form>
  );
}
