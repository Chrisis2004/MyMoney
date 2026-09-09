"use client";

import type { CategorySummaryRow } from "@/lib/types";
import { formatEur, formatSignedEur } from "@/lib/format";
import { ConsumedBar } from "./charts";
import { Badge, StatusPill, budgetState } from "./ui";

export function CategorySummaryTable({ rows }: { rows: CategorySummaryRow[] }) {
  const totals = rows.reduce(
    (acc, r) => ({ budget: acc.budget + r.budget, actual: acc.actual + r.actual }),
    { budget: 0, actual: 0 },
  );
  const totalConsumed = totals.budget > 0 ? totals.actual / totals.budget : null;

  return (
    <div className="scroll-x">
      <table className="w-full min-w-[54rem] border-collapse text-sm">
        <caption className="sr-only">Riepilogo per categoria del mese selezionato</caption>
        <thead>
          <tr className="label border-b border-hairline text-left text-ink-secondary">
            <th scope="col" className="py-2 pr-3">
              Categoria
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              Budget
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              Effettivo
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              Differenza
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              Consumato
            </th>
            <th scope="col" className="py-2">
              Stato
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category.id} className="border-b border-hairline last:border-0">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                {row.category.name}
                {row.category.kind === "saving" && (
                  <span className="ml-2">
                    <Badge>accantonamento</Badge>
                  </span>
                )}
              </th>
              <td className="tnum py-2 pr-3 text-right text-ink-secondary">
                {formatEur(row.budget)}
              </td>
              <td className="tnum py-2 pr-3 text-right text-ink">{formatEur(row.actual)}</td>
              <td
                className="tnum py-2 pr-3 text-right"
                style={{
                  color: row.difference < 0 ? "var(--critical-text)" : "var(--ink-secondary)",
                }}
              >
                {formatSignedEur(row.difference)}
              </td>
              <td className="py-2 pr-3 text-right">
                <ConsumedBar consumed={row.consumed} />
              </td>
              <td className="py-2">
                <StatusPill state={budgetState(row.consumed)} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-hairline-strong font-semibold">
            <th scope="row" className="py-2 pr-3 text-left text-ink">
              Totale
            </th>
            <td className="tnum py-2 pr-3 text-right text-ink">{formatEur(totals.budget)}</td>
            <td className="tnum py-2 pr-3 text-right text-ink">{formatEur(totals.actual)}</td>
            <td
              className="tnum py-2 pr-3 text-right"
              style={{
                color:
                  totals.budget - totals.actual < 0 ? "var(--critical-text)" : "var(--ink)",
              }}
            >
              {formatSignedEur(totals.budget - totals.actual)}
            </td>
            <td className="py-2 pr-3 text-right">
              <ConsumedBar consumed={totalConsumed} />
            </td>
            <td className="py-2">
              <StatusPill state={budgetState(totalConsumed)} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
