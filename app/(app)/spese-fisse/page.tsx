"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import {
  activeCategories,
  fixedExpensePaid,
  remainingOf,
  transactionsOfMonth,
} from "@/lib/calc";
import { formatDate, formatDateShort, formatEur, formatMonth, parseAmount } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Select,
} from "@/components/ui";
import type { FixedExpense, Transaction } from "@/lib/types";

/** Azione minuta: l'emoji fa da etichetta, il nome esteso lo legge lo screen reader. */
const ICON_ACTION =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-sm transition-colors hover:bg-sunken";

/** Cosa si modifica di una spesa fissa: l'importo si cambia in riga, sempre. */
type EditDraft = { id: string; name: string; categoryId: string; note: string };

export default function FixedExpensesPage() {
  const {
    data,
    addFixedExpense,
    updateFixedExpense,
    removeFixedExpense,
    generateFixedExpense,
    updateTransaction,
  } = useStore();
  const { month } = useMonth();

  const categories = useMemo(() => activeCategories(data), [data]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FixedExpense | null>(null);
  /** Spesa fissa per cui e' aperto il pannello "Contabilizza". */
  const [booking, setBooking] = useState<string | null>(null);
  /** Bozza della spesa fissa in modifica: l'importo resta quello della riga. */
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const monthTx = useMemo(() => transactionsOfMonth(data, month), [data, month]);

  /**
   * Le transazioni che coprono ogni spesa fissa in questo mese, dalla piu'
   * recente. Possono essere piu' d'una: una spesa pagata in parte si completa
   * con un secondo movimento.
   */
  const linked = useMemo(() => {
    const byFixed = new Map<string, Transaction[]>();
    for (const t of monthTx) {
      if (!t.fixedExpenseId) continue;
      const list = byFixed.get(t.fixedExpenseId) ?? [];
      list.push(t);
      byFixed.set(t.fixedExpenseId, list);
    }
    return byFixed;
  }, [monthTx]);

  /** Quanto e' gia' coperto di ogni spesa fissa, per calcolare cosa manca. */
  const paid = useMemo(() => fixedExpensePaid(data, month), [data, month]);

  /** Le transazioni del mese non ancora attribuite a una spesa fissa. */
  const candidates = useMemo(() => monthTx.filter((t) => !t.fixedExpenseId), [monthTx]);

  const categoryName = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c.name])),
    [data.categories],
  );

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

  const monthlyTotal = data.fixedExpenses.reduce((s, f) => s + f.amount, 0);

  /** Quello che nel mese resta da contabilizzare, residui delle parziali compresi. */
  const unpaid = data.fixedExpenses.filter((f) => remainingOf(f, paid) > 0);
  const unpaidTotal = unpaid.reduce((s, f) => s + remainingOf(f, paid), 0);

  /** Aprire un pannello chiude l'altro: una riga alla volta, niente confusione. */
  const startEdit = (fx: FixedExpense) => {
    setBooking(null);
    setEditError(null);
    setEditing({
      id: fx.id,
      name: fx.name,
      categoryId: fx.categoryId,
      note: fx.note ?? "",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editing.name.trim()) return setEditError("Serve un nome.");
    updateFixedExpense(editing.id, {
      name: editing.name.trim(),
      categoryId: editing.categoryId,
      note: editing.note.trim() || undefined,
    });
    cancelEdit();
  };

  const submit = () => {
    const value = parseAmount(amount);
    if (!name.trim()) return setError("Serve un nome.");
    if (!Number.isFinite(value) || value <= 0)
      return setError("L'importo deve essere un numero positivo.");
    addFixedExpense({
      name: name.trim(),
      categoryId,
      amount: Math.round(value * 100) / 100,
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
        description={
          unpaid.length > 0
            ? `${formatEur(unpaidTotal)} da contabilizzare in ${formatMonth(month)} · ${formatEur(monthlyTotal)} al mese`
            : `${formatEur(monthlyTotal)} al mese · ${formatMonth(month)} e' a posto`
        }
        action={
          unpaid.length === 0 && data.fixedExpenses.length > 0 ? (
            <Badge>tutte registrate in {formatMonth(month)}</Badge>
          ) : null
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
              const total = items.reduce((s, i) => s + i.amount, 0);
              return (
                <div key={category.id}>
                  <div className="flex items-baseline justify-between border-b border-hairline pb-1.5">
                    <h3 className="label text-ink">{category.name}</h3>
                    <span className="tnum text-xs font-semibold text-ink-secondary">
                      {formatEur(total)}
                    </span>
                  </div>
                  <ul className="divide-y divide-hairline">
                    {items.map((fx) => {
                      const txs = linked.get(fx.id) ?? [];
                      const missing = remainingOf(fx, paid);
                      const covered = txs.length > 0 && missing === 0;
                      const partial = txs.length > 0 && missing > 0;
                      const draft = editing?.id === fx.id ? editing : null;
                      const open = booking === fx.id;
                      const unlink = (t: Transaction) => {
                        updateTransaction(t.id, { fixedExpenseId: undefined });
                        setNotice(
                          `${fx.name}: scollegata da "${t.description}". La transazione resta fra quelle del mese.`,
                        );
                      };
                      return (
                        <li key={fx.id} className="flex flex-wrap items-center gap-2 py-2">
                          {/* La barra sopra il nome dice una cosa sola: per questo mese
                              la spesa e' coperta. */}
                          <span
                            className={
                              covered ? "text-sm text-ink-muted line-through" : "text-sm text-ink"
                            }
                          >
                            {fx.name}
                          </span>
                          {covered && (
                            <Badge>
                              {txs.length > 1
                                ? `registrata con ${txs.length} movimenti`
                                : `registrata il ${formatDateShort(txs[0].date)}`}
                            </Badge>
                          )}
                          {partial && (
                            <>
                              <Badge>
                                {formatEur(fx.amount - missing)} di {formatEur(fx.amount)}
                              </Badge>
                              <span
                                className="text-xs font-semibold"
                                style={{ color: "var(--critical-text)" }}
                              >
                                manca {formatEur(missing)}
                              </span>
                            </>
                          )}
                          {fx.note && <span className="text-xs text-ink-muted">{fx.note}</span>}

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
                            {/* Una casella sola di larghezza fissa: le icone restano
                                incolonnate riga dopo riga. Quello che resta da fare e' in
                                nero pieno, quello che e' gia' a posto no. */}
                            <span className="flex w-[7.5rem] justify-end">
                              {covered ? (
                                <Button
                                  size="sm"
                                  className="w-full"
                                  // Con un solo movimento collegato non serve scegliere:
                                  // si scollega quello. Con piu' d'uno decide il pannello.
                                  onClick={() =>
                                    txs.length === 1 ? unlink(txs[0]) : setBooking(open ? null : fx.id)
                                  }
                                  aria-label={`Scollega ${fx.name}`}
                                >
                                  Scollega
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="w-full"
                                  onClick={() => {
                                    setEditing(null);
                                    setBooking(open ? null : fx.id);
                                  }}
                                  aria-expanded={open}
                                  aria-label={`Contabilizza ${fx.name} in ${formatMonth(month)}`}
                                >
                                  {partial ? "Completa" : "Contabilizza"}
                                </Button>
                              )}
                            </span>
                            <button
                              type="button"
                              className={ICON_ACTION}
                              onClick={() => (draft ? cancelEdit() : startEdit(fx))}
                              aria-expanded={draft !== null}
                              title="Modifica"
                              aria-label={`Modifica ${fx.name}`}
                            >
                              <span aria-hidden>✏️</span>
                            </button>
                            <button
                              type="button"
                              className={ICON_ACTION}
                              onClick={() => setPendingDelete(fx)}
                              title="Elimina"
                              aria-label={`Elimina ${fx.name}`}
                            >
                              <span aria-hidden>🗑️</span>
                            </button>
                          </span>

                          {draft && (
                            <div className="w-full rounded-lg border border-hairline-strong bg-sunken p-3">
                              <div className="grid gap-3 sm:grid-cols-3">
                                <Field label="Nome">
                                  <Input
                                    autoFocus
                                    value={draft.name}
                                    onChange={(e) => setEditing({ ...draft, name: e.target.value })}
                                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                                  />
                                </Field>
                                <Field label="Categoria">
                                  <Select
                                    value={draft.categoryId}
                                    onChange={(e) =>
                                      setEditing({ ...draft, categoryId: e.target.value })
                                    }
                                  >
                                    {categories.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field label="Note (facoltative)">
                                  <Input
                                    value={draft.note}
                                    onChange={(e) => setEditing({ ...draft, note: e.target.value })}
                                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                                  />
                                </Field>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button size="sm" variant="primary" onClick={saveEdit}>
                                  Salva
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                  Annulla
                                </Button>
                                <span className="text-xs text-ink-muted">
                                  L&apos;importo si cambia nella riga, senza aprire la modifica.
                                </span>
                                {editError && (
                                  <span
                                    className="text-xs"
                                    style={{ color: "var(--critical-text)" }}
                                  >
                                    <span aria-hidden>■</span> {editError}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {open && (
                            <div className="w-full rounded-lg border border-hairline-strong bg-sunken p-3">
                              {txs.length > 0 && (
                                <div className="mb-3">
                                  <p className="mb-1 text-xs text-ink-secondary">
                                    Gia&apos; contabilizzato in {formatMonth(month)}:
                                  </p>
                                  <ul className="divide-y divide-hairline">
                                    {txs.map((t) => (
                                      <li
                                        key={t.id}
                                        className="flex items-center gap-2 py-1.5 text-xs"
                                      >
                                        <span className="tnum text-ink-muted">
                                          {formatDateShort(t.date)}
                                        </span>
                                        <span className="truncate text-ink">{t.description}</span>
                                        <span className="tnum ml-auto font-semibold text-ink">
                                          {formatEur(t.amount)}
                                        </span>
                                        <button
                                          type="button"
                                          className={`${ICON_ACTION} text-ink-muted`}
                                          onClick={() => unlink(t)}
                                          title="Scollega"
                                          aria-label={`Scollega ${t.description} da ${fx.name}`}
                                        >
                                          <span aria-hidden>✕</span>
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {missing > 0 && (
                                <>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => {
                                        generateFixedExpense(fx.id, month);
                                        setBooking(null);
                                        setNotice(
                                          `${fx.name}: ${formatEur(missing)} in ${formatMonth(month)}.`,
                                        );
                                      }}
                                    >
                                      {partial ? "Genera il restante" : "Genera la transazione"}
                                    </Button>
                                    <span className="text-xs text-ink-secondary">
                                      {formatEur(missing)} in {formatMonth(month)}, con la data di
                                      oggi.
                                    </span>
                                  </div>

                                  <p className="mt-3 mb-1.5 text-xs text-ink-secondary">
                                    Oppure collega una spesa di {formatMonth(month)} che hai
                                    gia&apos; registrato:
                                  </p>
                                  {candidates.length === 0 ? (
                                    <p className="text-xs text-ink-muted">
                                      Nessuna transazione libera in {formatMonth(month)}.
                                    </p>
                                  ) : (
                                    <ul className="max-h-52 divide-y divide-hairline overflow-auto">
                                      {candidates.map((t) => (
                                        <li key={t.id}>
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-xs hover:bg-surface"
                                            onClick={() => {
                                              updateTransaction(t.id, { fixedExpenseId: fx.id });
                                              setBooking(null);
                                              const left =
                                                Math.round((missing - t.amount) * 100) / 100;
                                              setNotice(
                                                left > 0
                                                  ? `${fx.name}: registrata con "${t.description}" del ${formatDate(t.date)}. Mancano ancora ${formatEur(left)}.`
                                                  : `${fx.name}: registrata con "${t.description}" del ${formatDate(t.date)}.`,
                                              );
                                            }}
                                          >
                                            <span className="tnum text-ink-muted">
                                              {formatDateShort(t.date)}
                                            </span>
                                            <span className="truncate text-ink">
                                              {t.description}
                                            </span>
                                            <span className="truncate text-ink-muted">
                                              {categoryName.get(t.categoryId)}
                                            </span>
                                            <span className="tnum ml-auto font-semibold text-ink">
                                              {formatEur(t.amount)}
                                            </span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminare questa spesa fissa?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}", ${formatEur(pendingDelete.amount)} al mese.`
            : ""
        }
        detail="Le transazioni gia' generate da questa spesa restano nei mesi in cui sono state registrate: sparisce solo la voce ricorrente, che non verra' piu' proposta. L'operazione non si puo' annullare."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          removeFixedExpense(pendingDelete!.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
