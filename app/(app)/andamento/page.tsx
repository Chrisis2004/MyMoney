"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import { dailyFlow, knownMonths, monthTotals, totalIncomeFor } from "@/lib/calc";
import { addMonths, currentMonth, formatEur, formatMonth, formatPct, monthRange } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui";
import { DailyFlowChart, IncomeVsSpendChart } from "@/components/charts";

export default function TrendPage() {
  const { data } = useStore();
  const { month } = useMonth();

  const points = useMemo(() => {
    const known = knownMonths(data);
    // Sempre una finestra continua che arriva al mese selezionato: i mesi vuoti
    // devono comparire come zero, non sparire dal grafico.
    const first = known.length ? known[0] : month;
    const last = [...known, month].sort().at(-1) as string;
    const from = first < addMonths(last, -23) ? addMonths(last, -23) : first;
    return monthRange(from, last).map((m) => {
      const t = monthTotals(data, m);
      return { month: m, income: t.income, spent: t.spent, saving: t.netSaving };
    });
  }, [data, month]);

  const days = useMemo(() => dailyFlow(data, month), [data, month]);
  const monthIncome = useMemo(() => totalIncomeFor(data, month), [data, month]);
  const todayDay = month === currentMonth() ? new Date().getDate() : null;

  const cumulative = points.reduce((s, p) => s + p.saving, 0);
  const best = points.reduce((a, b) => (b.saving > a.saving ? b : a), points[0]);
  const worst = points.reduce((a, b) => (b.saving < a.saving ? b : a), points[0]);
  const avgRate =
    points.length && points.some((p) => p.income > 0)
      ? points.reduce((s, p) => s + (p.income > 0 ? p.saving / p.income : 0), 0) / points.length
      : 0;

  if (!points.length) {
    return <EmptyState title="Ancora nessun dato" hint="Registra qualche movimento per vedere l'andamento." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
          <p className="text-xs text-ink-secondary">Risparmio cumulato</p>
          <p
            className="mt-1 text-2xl font-semibold tracking-tight"
            style={{ color: cumulative < 0 ? "var(--critical-text)" : "var(--good-text)" }}
          >
            {formatEur(cumulative)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Su {points.length} mesi</p>
        </div>
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
          <p className="text-xs text-ink-secondary">Tasso medio</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {formatPct(avgRate)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Delle entrate</p>
        </div>
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
          <p className="text-xs text-ink-secondary">Mese migliore</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {formatEur(best.saving)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">{formatMonth(best.month)}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
          <p className="text-xs text-ink-secondary">Mese peggiore</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {formatEur(worst.saving)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-muted">{formatMonth(worst.month)}</p>
        </div>
      </div>

      <Card
        title={`Giorno per giorno — ${formatMonth(month)}`}
        description="Le uscite contabilizzate sommate dall'inizio del mese, contro le entrate disponibili. L'entrata fissa non ha una data e vale da subito; le entrate extra fanno salire la linea a gradino il giorno in cui arrivano."
      >
        <DailyFlowChart days={days} income={monthIncome} todayDay={todayDay} />
      </Card>

      <Card
        title="Mese per mese"
        description="Passa sopra il grafico per leggere i valori di un mese."
      >
        <IncomeVsSpendChart points={points} />
      </Card>

      <Card title="Tabella" bodyClassName="px-0 sm:px-0">
        <div className="scroll-x px-4 sm:px-5">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium text-ink-secondary">
                <th scope="col" className="py-2 pr-3 font-medium">Mese</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Entrate</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Uscite</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Risparmio</th>
                <th scope="col" className="py-2 text-right font-medium">Tasso</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.month} className="border-b border-hairline last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                    {formatMonth(p.month)}
                  </th>
                  <td className="tnum py-2 pr-3 text-right text-ink-secondary">
                    {formatEur(p.income)}
                  </td>
                  <td className="tnum py-2 pr-3 text-right text-ink-secondary">
                    {formatEur(p.spent)}
                  </td>
                  <td
                    className="tnum py-2 pr-3 text-right"
                    style={{ color: p.saving < 0 ? "var(--critical-text)" : "var(--ink)" }}
                  >
                    {formatEur(p.saving)}
                  </td>
                  <td className="tnum py-2 text-right text-ink-secondary">
                    {p.income > 0 ? formatPct(p.saving / p.income) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
