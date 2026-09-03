"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import { activeCategories, transactionsOfMonth } from "@/lib/calc";
import { formatEur, formatMonth, parseAmount } from "@/lib/format";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";

export default function FixedExpensesPage() {
  const { data, addFixedExpense, updateFixedExpense, removeFixedExpense, generateFixedExpenses } =
    useStore();
  const { month } = useMonth();

  const categories = useMemo(() => activeCategories(data), [data]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [day, setDay] = useState("1");

  const alreadyGenerated = useMemo(() => {
    const ids = new Set(
      transactionsOfMonth(data, month)
        .filter((t) => t.fixedExpenseId)
        .map((t) => t.fixedExpenseId as string),
    );
    return ids;
  }, [data, month]);

  const grouped = useMemo(() => {
    const byCat = new Map<string, typeof data.fixedExpenses>();
    for (const fx of data.fixedExpenses) {
      const list = byCat.get(fx.categoryId) ?? [];
      list.push(fx);
      byCat.set(fx.categoryId, list);
    }
    return categories
      .map((c) => ({ category: c, items: byCat.get(c.id) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [data.fixedExpenses, categories]);

  const activeTotal = data.fixedExpenses
    .filter((f) => f.active)
    .reduce((s, f) => s + f.amount, 0);

  const pending = data.fixedExpenses.filter((f) => f.active && !alreadyGenerated.has(f.id));

  const submit = () => {
    const value = parseAmount(amount);
    if (!name.trim()) return setError("Serve un nome.");
    if (!Number.isFinite(value) || value <= 0)
      return setError("L'importo deve essere un numero positivo.");
    addFixedExpense({
      name: name.trim(),
      categoryId,
      amount: Math.round(value * 100) / 100,
      active: true,
      note: note.trim() || undefined,
    });
    setName("");
    setAmount("");
    setNote("");
    setError(null);
  };

  return (
    <div className="space-y-5">
      <Card
        title="Spese fisse"
        description={`${data.fixedExpenses.filter((f) => f.active).length} attive · ${formatEur(activeTotal)} al mese`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-secondary">
              Giorno
              <Input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="h-8 w-14 text-center text-xs"
              />
            </label>
            <Button
              size="sm"
              variant="primary"
              disabled={pending.length === 0}
              onClick={() => {
                const created = generateFixedExpenses(month, Number(day) || 1);
                setNotice(
                  created
                    ? `Create ${created} transazioni in ${formatMonth(month)}.`
                    : "Erano gia' tutte registrate.",
                );
              }}
            >
              {pending.length > 0
                ? `Genera ${pending.length} in ${formatMonth(month)}`
                : `Gia' generate in ${formatMonth(month)}`}
            </Button>
          </div>
        }
      >
        {notice && <p className="mb-3 text-xs text-ink-secondary">{notice}</p>}

        {grouped.length === 0 ? (
          <EmptyState
            title="Nessuna spesa fissa"
            hint="Affitto, bollette, abbonamenti: quello che torna ogni mese."
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(({ category, items }) => {
              const total = items.filter((i) => i.active).reduce((s, i) => s + i.amount, 0);
              return (
                <div key={category.id}>
                  <div className="flex items-baseline justify-between border-b border-hairline pb-1.5">
                    <h3 className="text-xs font-semibold tracking-tight text-ink">
                      {category.name}
                    </h3>
                    <span className="tnum text-xs text-ink-secondary">{formatEur(total)}</span>
                  </div>
                  <ul className="divide-y divide-hairline">
                    {items.map((fx) => (
                      <li key={fx.id} className="flex flex-wrap items-center gap-3 py-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={fx.active}
                            onChange={(e) =>
                              updateFixedExpense(fx.id, { active: e.target.checked })
                            }
                            aria-label={`${fx.name} attiva`}
                          />
                          <span
                            className={
                              fx.active ? "text-sm text-ink" : "text-sm text-ink-muted line-through"
                            }
                          >
                            {fx.name}
                          </span>
                        </label>
                        {fx.note && <span className="text-xs text-ink-muted">{fx.note}</span>}
                        {alreadyGenerated.has(fx.id) && (
                          <span className="rounded border border-hairline-strong px-1 py-px text-[10px] text-ink-muted">
                            registrata in {formatMonth(month)}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-2">
                          <Input
                            inputMode="decimal"
                            className="tnum h-8 w-24 text-right text-xs"
                            defaultValue={String(fx.amount).replace(".", ",")}
                            onBlur={(e) => {
                              const v = parseAmount(e.target.value);
                              if (Number.isFinite(v) && v > 0) {
                                updateFixedExpense(fx.id, { amount: Math.round(v * 100) / 100 });
                              } else {
                                e.target.value = String(fx.amount).replace(".", ",");
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFixedExpense(fx.id)}
                            aria-label={`Elimina ${fx.name}`}
                          >
                            Elimina
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Aggiungi una spesa fissa">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome">
            <Input
              value={name}
              placeholder="Netflix"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
          <Field label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Importo mensile">
            <Input
              inputMode="decimal"
              value={amount}
              placeholder="0,00"
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
          <Field label="Note (facoltative)">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={submit}>
            Aggiungi
          </Button>
          {error && (
            <span className="text-xs" style={{ color: "var(--critical-text)" }}>
              <span aria-hidden>■</span> {error}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
