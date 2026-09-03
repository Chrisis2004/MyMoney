"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import { categorySummary, monthTotals, transactionsOfMonth, categoryMap } from "@/lib/calc";
import { formatEur, formatMonth, formatDate, formatPct } from "@/lib/format";
import { Card, EmptyState, LinkButton } from "@/components/ui";
import { BudgetDistribution, BudgetVsActualChart } from "@/components/charts";
import { CategorySummaryTable } from "@/components/CategorySummaryTable";

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
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p>}
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

  // Il documento lo costruisce il server leggendo il file: con un salvataggio
  // in errore uscirebbe un riepilogo che non corrisponde a quello che vedi.
  const staleForExport = saveStatus === "error";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">
          Riepilogo di {formatMonth(month)}
        </h2>
        <LinkButton
          size="sm"
          href={`/api/riepilogo?mese=${month}`}
          download
          disabled={staleForExport}
          title={
            staleForExport
              ? "Le ultime modifiche non sono state salvate: il documento non sarebbe aggiornato."
              : `Scarica il riepilogo di ${formatMonth(month)} in formato Word`
          }
        >
          <span aria-hidden>↓</span> Scarica riepilogo Word
        </LinkButton>
      </div>

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
            className="text-xs font-medium text-ink-secondary underline underline-offset-2 hover:text-ink"
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
                    <span className="rounded border border-hairline-strong px-1 py-px text-[10px] text-ink-muted">
                      non contabilizzata
                    </span>
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
