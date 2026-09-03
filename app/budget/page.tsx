"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import {
  activeCategories,
  budgetFor,
  categorySummary,
  extraIncomesOfMonth,
  incomeFor,
  monthTotals,
} from "@/lib/calc";
import {
  addMonths,
  dayInMonth,
  formatDate,
  formatEur,
  formatMonth,
  formatPct,
  monthOf,
  parseAmount,
  todayIso,
} from "@/lib/format";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { CategorySummaryTable } from "@/components/CategorySummaryTable";

/** Mostra un importo in un campo di testo con la virgola decimale italiana. */
function toField(n: number) {
  return n ? String(n).replace(".", ",") : "";
}

export default function BudgetPage() {
  const {
    data,
    setBudget,
    copyBudgetFrom,
    fillBudgetFromFixedExpenses,
    setIncome,
    addExtraIncome,
    removeExtraIncome,
  } = useStore();
  const { month } = useMonth();

  const categories = useMemo(() => activeCategories(data), [data]);
  const rows = useMemo(() => categorySummary(data, month), [data, month]);
  const totals = useMemo(() => monthTotals(data, month), [data, month]);
  const prev = addMonths(month, -1);
  const prevHasBudget = data.budgets.some((b) => b.month === prev);

  // Copia locale dei campi: si scrive liberamente e si salva alla conferma.
  const [fields, setFields] = useState<Record<string, string>>({});
  const [incomeField, setIncomeField] = useState("");

  const extras = useMemo(() => extraIncomesOfMonth(data, month), [data, month]);
  const extrasTotal = extras.reduce((s, e) => s + e.amount, 0);
  const [extraDraft, setExtraDraft] = useState(() => ({
    date: monthOf(todayIso()) === month ? todayIso() : dayInMonth(month, 1),
    description: "",
    amount: "",
    note: "",
  }));
  const [extraError, setExtraError] = useState<string | null>(null);

  // Cambiando mese la data proposta deve seguire il mese mostrato.
  useEffect(() => {
    setExtraDraft((d) => ({
      ...d,
      date: monthOf(todayIso()) === month ? todayIso() : dayInMonth(month, 1),
    }));
  }, [month]);

  const submitExtra = () => {
    const amount = parseAmount(extraDraft.amount);
    if (!extraDraft.description.trim()) return setExtraError("Serve una descrizione.");
    if (!Number.isFinite(amount) || amount <= 0)
      return setExtraError("L'importo deve essere un numero positivo.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extraDraft.date)) return setExtraError("La data non e' valida.");
    addExtraIncome({
      date: extraDraft.date,
      description: extraDraft.description.trim(),
      amount: Math.round(amount * 100) / 100,
      note: extraDraft.note.trim() || undefined,
    });
    setExtraDraft({ ...extraDraft, description: "", amount: "", note: "" });
    setExtraError(null);
  };

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of categories) next[c.id] = toField(budgetFor(data, month, c.id));
    setFields(next);
    setIncomeField(toField(incomeFor(data, month)));
  }, [data, month, categories]);

  const commit = (categoryId: string, raw: string) => {
    const value = raw.trim() === "" ? 0 : parseAmount(raw);
    if (!Number.isFinite(value) || value < 0) {
      setFields((f) => ({ ...f, [categoryId]: toField(budgetFor(data, month, categoryId)) }));
      return;
    }
    setBudget(month, categoryId, Math.round(value * 100) / 100);
  };

  const commitIncome = (raw: string) => {
    const value = parseAmount(raw);
    if (!Number.isFinite(value) || value < 0) {
      setIncomeField(toField(incomeFor(data, month)));
      return;
    }
    setIncome(month, Math.round(value * 100) / 100);
  };

  const plannedLeftover = totals.income - totals.budget;

  return (
    <div className="space-y-5">
      <Card
        title={`Budget di ${formatMonth(month)}`}
        description="Il piano del mese. Lascia vuoto per azzerare una categoria."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!prevHasBudget}
              onClick={() => copyBudgetFrom(prev, month)}
              title={
                prevHasBudget
                  ? `Copia il budget di ${formatMonth(prev)}`
                  : `${formatMonth(prev)} non ha un budget`
              }
            >
              Copia da {formatMonth(prev)}
            </Button>
            <Button size="sm" onClick={() => fillBudgetFromFixedExpenses(month)}>
              Allinea alle spese fisse
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Entrate fisse del mese" hint="Lo stipendio: quello su cui pianifichi.">
            <Input
              inputMode="decimal"
              value={incomeField}
              onChange={(e) => setIncomeField(e.target.value)}
              onBlur={(e) => commitIncome(e.target.value)}
            />
          </Field>
          <div className="rounded-lg border border-hairline bg-sunken px-3 py-2">
            <p className="text-xs text-ink-secondary">Entrate totali del mese</p>
            <p className="tnum mt-0.5 text-lg font-semibold text-ink">{formatEur(totals.income)}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {extrasTotal > 0
                ? `${formatEur(totals.baseIncome)} fisse + ${formatEur(extrasTotal)} extra`
                : "Nessuna entrata extra registrata"}
            </p>
          </div>
          <div className="rounded-lg border border-hairline bg-sunken px-3 py-2">
            <p className="text-xs text-ink-secondary">Budget totale pianificato</p>
            <p className="tnum mt-0.5 text-lg font-semibold text-ink">{formatEur(totals.budget)}</p>
          </div>
          <div className="rounded-lg border border-hairline bg-sunken px-3 py-2">
            <p className="text-xs text-ink-secondary">Non allocato</p>
            <p
              className="tnum mt-0.5 text-lg font-semibold"
              style={{
                color: plannedLeftover < 0 ? "var(--critical-text)" : "var(--good-text)",
              }}
            >
              {formatEur(plannedLeftover)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {totals.income > 0
                ? `${formatPct(plannedLeftover / totals.income)} delle entrate`
                : "Nessuna entrata impostata"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Field key={c.id} label={c.name}>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                className="tnum text-right"
                value={fields[c.id] ?? ""}
                onChange={(e) => setFields((f) => ({ ...f, [c.id]: e.target.value }))}
                onBlur={(e) => commit(c.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card
        title={`Entrate extra — ${formatMonth(month)}`}
        description="Entrate occasionali: un regalo, un aiuto in famiglia, un rimborso. Hanno una data e si sommano all'entrata fissa del mese."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Data">
            <Input
              type="date"
              value={extraDraft.date}
              onChange={(e) => setExtraDraft({ ...extraDraft, date: e.target.value })}
            />
          </Field>
          <Field label="Descrizione">
            <Input
              value={extraDraft.description}
              placeholder="Regalo dei nonni"
              onChange={(e) => setExtraDraft({ ...extraDraft, description: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submitExtra()}
            />
          </Field>
          <Field label="Importo">
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={extraDraft.amount}
              onChange={(e) => setExtraDraft({ ...extraDraft, amount: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submitExtra()}
            />
          </Field>
          <Field label="Note (facoltative)">
            <Input
              value={extraDraft.note}
              onChange={(e) => setExtraDraft({ ...extraDraft, note: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submitExtra()}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={submitExtra}>
            Aggiungi entrata
          </Button>
          {extraError && (
            <span className="text-xs" style={{ color: "var(--critical-text)" }}>
              <span aria-hidden>■</span> {extraError}
            </span>
          )}
          {monthOf(extraDraft.date) !== month && !extraError && (
            <span className="text-xs text-ink-muted">
              Attenzione: la data e&apos; fuori dal mese visualizzato.
            </span>
          )}
        </div>

        <div className="mt-4">
          {extras.length === 0 ? (
            <EmptyState
              title="Nessuna entrata extra in questo mese"
              hint="Quello che arriva fuori dallo stipendio: regali, rimborsi, aiuti."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {extras.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="tnum w-24 shrink-0 text-xs text-ink-secondary">
                    {formatDate(e.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {e.description}
                    {e.note && <span className="ml-2 text-xs text-ink-muted">{e.note}</span>}
                  </span>
                  <span className="tnum shrink-0 text-sm" style={{ color: "var(--good-text)" }}>
                    +{formatEur(e.amount)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeExtraIncome(e.id)}
                    aria-label={`Elimina ${e.description}`}
                  >
                    Elimina
                  </Button>
                </li>
              ))}
              <li className="flex items-center gap-3 border-t-2 border-hairline-strong py-2">
                <span className="flex-1 text-sm font-medium text-ink">Totale extra</span>
                <span className="tnum text-sm font-medium" style={{ color: "var(--good-text)" }}>
                  +{formatEur(extrasTotal)}
                </span>
                <span className="w-[4.5rem]" />
              </li>
            </ul>
          )}
        </div>
      </Card>

      <Card
        title="Effetto sul mese"
        description="Come si posiziona il budget appena impostato rispetto alle spese gia' registrate."
        bodyClassName="px-0 sm:px-0"
      >
        <div className="px-4 sm:px-5">
          <CategorySummaryTable rows={rows} />
        </div>
      </Card>
    </div>
  );
}
