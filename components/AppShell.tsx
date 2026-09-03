"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import { addMonths, formatMonth } from "@/lib/format";
import { Button, cx } from "./ui";

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

/** Stato del salvataggio sul file. Icona piu' testo: mai solo colore. */
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
  const { ready, loadError, saveStatus, saveError, filePath, reload, retrySave } = useStore();
  const pathname = usePathname();

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
        </div>
      </header>

      <nav className="scroll-x -mx-1 shrink-0">
        <ul className="flex w-max gap-1 px-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors",
                    active
                      ? "bg-ink font-medium text-page"
                      : "text-ink-secondary hover:bg-sunken hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
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
            Le ultime modifiche non sono state scritte sul file{saveError ? `: ${saveError}` : "."}{" "}
            Restano in questa pagina finché non la chiudi.
          </p>
          <Button size="sm" onClick={retrySave}>
            Riprova
          </Button>
        </div>
      )}

      <main className="flex-1">
        {!ready ? (
          <p className="py-16 text-center text-sm text-ink-muted">Carico i dati…</p>
        ) : loadError ? (
          <div className="mx-auto max-w-lg rounded-xl border border-hairline bg-surface px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">Non riesco a leggere il file dei dati</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
              {saveError ?? loadError}
            </p>
            {filePath && (
              <p className="mt-2 break-all text-[11px] text-ink-muted">{filePath}</p>
            )}
            <p className="mt-3 text-xs text-ink-secondary">
              Per non sovrascrivere dati validi l&apos;app non salva finché la lettura non
              riesce.
            </p>
            <Button variant="primary" className="mt-4" onClick={reload}>
              Riprova
            </Button>
          </div>
        ) : (
          children
        )}
      </main>

      <footer className="border-t border-hairline pt-3 text-[11px] text-ink-muted">
        {filePath ? (
          <>
            Dati salvati in <code className="break-all">{filePath}</code>
          </>
        ) : (
          "Dati salvati in un file sul tuo computer."
        )}
      </footer>
    </div>
  );
}
