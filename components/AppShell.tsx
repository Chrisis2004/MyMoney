"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { useMonth } from "@/lib/month";
import { addMonths, formatMonth } from "@/lib/format";
import { Button, PageSkeleton, cx } from "./ui";

const NAV = [
  { href: "/", label: "Riepilogo" },
  { href: "/transazioni", label: "Transazioni" },
  { href: "/budget", label: "Budget" },
  { href: "/spese-fisse", label: "Spese fisse" },
  { href: "/andamento", label: "Andamento" },
  { href: "/impostazioni", label: "Impostazioni" },
];

const THEME_KEY = "gestione-risparmio:theme";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "dark" || current === "light" ? current : null);
  }, []);

  const toggle = () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const currentIsDark = theme ? theme === "dark" : prefersDark;
    const next = currentIsDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* il tema resta valido solo per questa sessione */
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label="Cambia tema chiaro/scuro">
      <span aria-hidden>{theme === "dark" ? "☾" : "☀"}</span>
      <span className="hidden sm:inline">Tema</span>
    </Button>
  );
}

/** Stato del salvataggio sul database. Icona piu' testo: mai solo colore. */
function SaveIndicator() {
  const { saveStatus, savedAt } = useStore();
  if (saveStatus === "idle") return null;

  const meta = {
    saving: { icon: "◌", label: "Salvo…", color: "var(--ink-muted)" },
    saved: { icon: "●", label: "Salvato", color: "var(--good)" },
    error: { icon: "■", label: "Non salvato", color: "var(--critical)" },
  }[saveStatus];

  const time = savedAt
    ? new Date(savedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-secondary"
      title={saveStatus === "saved" && time ? `Ultimo salvataggio alle ${time}` : undefined}
    >
      <span aria-hidden style={{ color: meta.color }}>
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const esci = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/accedi");
    // Senza refresh i Server Component resterebbero sull'utente di prima.
    router.refresh();
    // busy resta acceso: la navigazione e' in corso e il pulsante non deve
    // tornare cliccabile per il tempo che ci mette.
  };

  return (
    <Button variant="ghost" size="sm" onClick={esci} loading={busy}>
      {busy ? "Esco…" : "Esci"}
    </Button>
  );
}

/**
 * La barretta che scorre sotto la voce verso cui si sta navigando. Vive dentro
 * il <Link>, perche' useLinkStatus racconta lo stato del link che la contiene.
 * E' in posizione assoluta di proposito: un indicatore che occupasse spazio
 * farebbe allargare la voce e ballare tutto il menu proprio mentre lo si usa.
 */
function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-1.5 bottom-1 h-0.5 overflow-hidden rounded-full"
    >
      <span className="nav-bar block h-full w-2/5 rounded-full bg-current opacity-70" />
    </span>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors",
        active
          ? "bg-ink font-medium text-page"
          : "text-ink-secondary hover:bg-sunken hover:text-ink",
      )}
    >
      {label}
      <NavPending />
    </Link>
  );
}

function MonthNav() {
  const { month, setMonth } = useMonth();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-hairline-strong bg-surface p-0.5">
      <Button
        variant="ghost"
        size="sm"
        className="px-2"
        onClick={() => setMonth(addMonths(month, -1))}
        aria-label="Mese precedente"
      >
        <span aria-hidden>←</span>
      </Button>
      <span className="min-w-[8.5rem] text-center text-sm font-medium text-ink">
        {formatMonth(month)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="px-2"
        onClick={() => setMonth(addMonths(month, 1))}
        aria-label="Mese successivo"
      >
        <span aria-hidden>→</span>
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, loadError, saveStatus, saveError, account, reload, retrySave } = useStore();
  const pathname = usePathname();
  const [ricarico, setRicarico] = useState(false);

  const riprovaLettura = async () => {
    setRicarico(true);
    await reload();
    setRicarico(false);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight text-ink">Gestione risparmio</h1>
          <MonthNav />
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <nav className="scroll-x -mx-1 shrink-0">
        <ul className="flex w-max gap-1 px-1">
          {NAV.map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} label={item.label} active={pathname === item.href} />
            </li>
          ))}
        </ul>
      </nav>

      {saveStatus === "error" && !loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline-strong bg-sunken px-3 py-2.5"
        >
          <p className="text-xs text-ink">
            <span aria-hidden style={{ color: "var(--critical)" }}>
              ■
            </span>{" "}
            Le ultime modifiche non sono arrivate al database
            {saveError ? `: ${saveError}` : "."} Restano in questa pagina finché non la chiudi.
          </p>
          <Button size="sm" onClick={retrySave}>
            Riprova
          </Button>
        </div>
      )}

      <main className="flex-1">
        {!ready ? (
          <PageSkeleton />
        ) : loadError ? (
          <div className="mx-auto max-w-lg rounded-xl border border-hairline bg-surface px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">Non riesco a leggere i dati</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
              {saveError ?? loadError}
            </p>
            <p className="mt-3 text-xs text-ink-secondary">
              Per non sovrascrivere dati validi l&apos;app non salva finché la lettura non
              riesce.
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={riprovaLettura}
              loading={ricarico}
            >
              Riprova
            </Button>
          </div>
        ) : (
          children
        )}
      </main>

      <footer className="border-t border-hairline pt-3 text-[11px] text-ink-muted">
        {account ? (
          <>
            Dati salvati sul tuo account <code className="break-all">{account}</code>
          </>
        ) : (
          "Dati salvati sul tuo account."
        )}
      </footer>
    </div>
  );
}
