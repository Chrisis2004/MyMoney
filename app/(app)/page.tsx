"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import { categorySummary, monthTotals, transactionsOfMonth, categoryMap } from "@/lib/calc";
import { formatEur, formatMonth, formatDate, formatPct } from "@/lib/format";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { BudgetDistribution, BudgetVsActualChart } from "@/components/charts";
import { CategorySummaryTable } from "@/components/CategorySummaryTable";

/** Il nome del file lo decide il server; qui si legge dall'intestazione. */
function nomeDalServer(disposition: string | null): string | null {
  if (!disposition) return null;
  // filename* porta gli accenti, filename e' il ripiego ASCII.
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* percent-encoding malformato: si prova con l'altro */
    }
  }
  const ascii = disposition.match(/filename="([^"]+)"/i);
  return ascii ? ascii[1] : null;
}

function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "critical";
}) {
  const color =
    tone === "good" ? "var(--good-text)" : tone === "critical" ? "var(--critical-text)" : "var(--ink)";
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
      <p className="label text-ink-secondary">{label}</p>
      <p className="tnum mt-1 text-2xl font-bold tracking-[-0.04em]" style={{ color }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, saveStatus } = useStore();
  const { month } = useMonth();

  const rows = useMemo(() => categorySummary(data, month), [data, month]);
  const totals = useMemo(() => monthTotals(data, month), [data, month]);
  const recent = useMemo(() => transactionsOfMonth(data, month).slice(0, 6), [data, month]);
  const cats = useMemo(() => categoryMap(data), [data]);

  const savingRate = totals.income > 0 ? totals.netSaving / totals.income : 0;

  // Il documento lo costruisce il server leggendo il database: con un
  // salvataggio in errore uscirebbe un riepilogo diverso da quello che vedi.
  const staleForExport = saveStatus === "error";

  const [scarico, setScarico] = useState(false);
  const [erroreScarico, setErroreScarico] = useState<string | null>(null);

  /**
   * Il .docx si chiede con fetch invece che con un link diretto: generarlo
   * richiede qualche secondo, e un link nudo non ha modo di dirlo. Cosi' si
   * puo' mostrare l'attesa e, se il server risponde male, mostrare l'errore
   * invece di far scaricare al browser un file JSON con dentro il guasto.
   */
  const scaricaRiepilogo = async () => {
    setScarico(true);
    setErroreScarico(null);
    let url: string | null = null;
    try {
      const res = await fetch(`/api/riepilogo?mese=${month}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download =
        nomeDalServer(res.headers.get("Content-Disposition")) ?? `riepilogo-${month}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setErroreScarico(err instanceof Error ? err.message : String(err));
    } finally {
      // Revocare subito taglierebbe il download a meta' su alcuni browser.
      if (url) window.setTimeout((u: string) => URL.revokeObjectURL(u), 60_000, url);
      setScarico(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">
          Riepilogo di {formatMonth(month)}
        </h2>
        <Button
          size="sm"
          onClick={scaricaRiepilogo}
          loading={scarico}
          disabled={staleForExport}
          title={
            staleForExport
              ? "Le ultime modifiche non sono state salvate: il documento non sarebbe aggiornato."
              : `Scarica il riepilogo di ${formatMonth(month)} in formato Word`
          }
        >
          {!scarico && <span aria-hidden>↓</span>}
          {scarico ? "Preparo il documento…" : "Scarica riepilogo Word"}
        </Button>
      </div>

      {erroreScarico && (
        <p role="alert" className="text-xs text-ink">
          <span aria-hidden style={{ color: "var(--critical)" }}>
            ■
          </span>{" "}
          Non sono riuscito a preparare il riepilogo: {erroreScarico}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Entrate"
          value={formatEur(totals.income)}
          hint={
            totals.extraIncome > 0
              ? `${formatEur(totals.baseIncome)} fisse + ${formatEur(totals.extraIncome)} extra`
              : formatMonth(month)
          }
        />
        <StatTile
          label="Uscite"
          value={formatEur(totals.spent)}
          hint={`${totals.transactionCount} movimenti registrati`}
        />
        <StatTile
          label="Non contabilizzate"
          value={formatEur(totals.excluded)}
          hint={
            totals.excludedCount
              ? `${totals.excludedCount} movimenti fuori budget`
              : "Nessun movimento straordinario"
          }
        />
        <StatTile
          label="Resta"
          value={formatEur(totals.leftover)}
          hint={
            totals.excluded > 0
              ? `Tasso ${formatPct(savingRate)} · non include le non contabilizzate`
              : `Tasso di risparmio ${formatPct(savingRate)}`
          }
          tone={totals.leftover < 0 ? "critical" : "good"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <Card
          title="Budget vs Effettivo"
          description="Quanto avevi previsto e quanto hai davvero speso, categoria per categoria."
        >
          <BudgetVsActualChart rows={rows} />
        </Card>
        <Card
          title="Distribuzione del budget"
          description={`Su ${formatEur(totals.budget)} pianificati questo mese.`}
        >
          <BudgetDistribution rows={rows} />
        </Card>
      </div>

      <Card
        title="Riepilogo per categoria"
        description="La stessa tabella del foglio Numbers, ricalcolata sui movimenti del mese."
        bodyClassName="px-0 sm:px-0"
      >
        <div className="px-4 sm:px-5">
          <CategorySummaryTable rows={rows} />
        </div>
      </Card>

      <Card
        title="Ultimi movimenti"
        action={
          <Link
            href="/transazioni"
            className="text-xs font-semibold text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            Vedi tutti
          </Link>
        }
      >
        {recent.length === 0 ? (
          <EmptyState
            title="Nessun movimento in questo mese"
            hint="Aggiungi una transazione, oppure genera in un colpo solo le spese fisse del mese."
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{t.description}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {formatDate(t.date)} · {cats.get(t.categoryId)?.name ?? "—"}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.excluded && (
                    <Badge>non contabilizzata</Badge>
                  )}
                  <span className="tnum text-sm text-ink">{formatEur(t.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
