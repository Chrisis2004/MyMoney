"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useMonth } from "@/lib/month";
import { activeCategories, categoryMap, splitByAccounting, transactionsOfMonth } from "@/lib/calc";
import { dayInMonth, formatDate, formatEur, formatMonth, monthOf, parseAmount } from "@/lib/format";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import type { Category, Transaction } from "@/lib/types";

type Draft = {
  date: string;
  description: string;
  categoryId: string;
  amount: string;
  note: string;
  excluded: boolean;
};

function emptyDraft(month: string, categoryId: string): Draft {
  const today = new Date();
  const isCurrent = monthOf(today.toISOString().slice(0, 10)) === month;
  return {
    date: isCurrent ? today.toISOString().slice(0, 10) : dayInMonth(month, 1),
    description: "",
    categoryId,
    amount: "",
    note: "",
    excluded: false,
  };
}

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-hairline text-left text-xs font-medium text-ink-secondary">
        <th scope="col" className="py-2 pr-3 font-medium">Data</th>
        <th scope="col" className="py-2 pr-3 font-medium">Descrizione</th>
        <th scope="col" className="py-2 pr-3 font-medium">Categoria</th>
        <th scope="col" className="py-2 pr-3 text-right font-medium">Importo</th>
        <th scope="col" className="py-2 pr-3 font-medium">Note</th>
        <th scope="col" className="py-2 font-medium" />
      </tr>
    </thead>
  );
}

/** Righe in lettura o in modifica: le stesse per entrambe le tabelle. */
function TransactionRows({
  items,
  categories,
  cats,
  editingId,
  editDraft,
  setEditDraft,
  onEdit,
  onSave,
  onCancel,
  onToggleExcluded,
  onRemove,
}: {
  items: Transaction[];
  categories: Category[];
  cats: Map<string, Category>;
  editingId: string | null;
  editDraft: Draft | null;
  setEditDraft: (d: Draft) => void;
  onEdit: (t: Transaction) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleExcluded: (t: Transaction) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {items.map((t) =>
        editingId === t.id && editDraft ? (
          <tr key={t.id} className="border-b border-hairline bg-sunken">
            <td className="py-2 pr-3">
              <Input
                type="date"
                className="h-8 w-full text-xs"
                value={editDraft.date}
                onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
              />
            </td>
            <td className="py-2 pr-3">
              <Input
                className="h-8 w-full text-xs"
                value={editDraft.description}
                onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
              />
            </td>
            <td className="py-2 pr-3">
              <Select
                className="h-8 w-full text-xs"
                value={editDraft.categoryId}
                onChange={(e) => setEditDraft({ ...editDraft, categoryId: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </td>
            <td className="py-2 pr-3">
              <Input
                className="h-8 w-full text-right text-xs"
                inputMode="decimal"
                value={editDraft.amount}
                onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })}
              />
            </td>
            <td className="py-2 pr-3">
              <Input
                className="h-8 w-full text-xs"
                value={editDraft.note}
                onChange={(e) => setEditDraft({ ...editDraft, note: e.target.value })}
              />
            </td>
            <td className="py-2">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="primary" onClick={onSave}>
                  Salva
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>
                  Annulla
                </Button>
              </div>
            </td>
          </tr>
        ) : (
          <tr key={t.id} className="border-b border-hairline last:border-0">
            <td className="tnum py-2 pr-3 whitespace-nowrap text-ink-secondary">
              {formatDate(t.date)}
            </td>
            <td className="py-2 pr-3 text-ink">
              {t.description}
              {t.fixedExpenseId && (
                <span className="ml-2 rounded border border-hairline-strong px-1 py-px text-[10px] text-ink-muted">
                  fissa
                </span>
              )}
            </td>
            <td className="py-2 pr-3 text-ink-secondary">{cats.get(t.categoryId)?.name ?? "—"}</td>
            <td className="tnum py-2 pr-3 text-right text-ink">{formatEur(t.amount)}</td>
            <td className="max-w-[14rem] truncate py-2 pr-3 text-xs text-ink-muted">
              {t.note ?? ""}
            </td>
            <td className="py-2">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(t)}>
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleExcluded(t)}
                  title={
                    t.excluded
                      ? "Rimetti questo movimento nel budget del mese"
                      : "Togli questo movimento dal budget del mese"
                  }
                >
                  {t.excluded ? "Contabilizza" : "Escludi"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(t.id)}
                  aria-label={`Elimina ${t.description}`}
                >
                  Elimina
                </Button>
              </div>
            </td>
          </tr>
        ),
      )}
    </>
  );
}

export default function TransactionsPage() {
  const { data, addTransaction, updateTransaction, removeTransaction, generateFixedExpenses } =
    useStore();
  const { month } = useMonth();

  const categories = useMemo(() => activeCategories(data), [data]);
  const cats = useMemo(() => categoryMap(data), [data]);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(month, categories[0]?.id ?? ""));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const monthTx = useMemo(() => transactionsOfMonth(data, month), [data, month]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTx.filter((t) => {
      if (filterCat && t.categoryId !== filterCat) return false;
      if (!q) return true;
      return t.description.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q);
    });
  }, [monthTx, filterCat, query]);

  const { counted, excluded } = useMemo(() => splitByAccounting(visible), [visible]);
  const monthExcludedCount = monthTx.filter((t) => t.excluded).length;
  const countedTotal = counted.reduce((s, t) => s + t.amount, 0);
  const excludedTotal = excluded.reduce((s, t) => s + t.amount, 0);

  const validate = (d: Draft): string | null => {
    if (!d.description.trim()) return "Serve una descrizione.";
    if (!d.categoryId) return "Scegli una categoria.";
    const amount = parseAmount(d.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "L'importo deve essere un numero positivo.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return "La data non e' valida.";
    return null;
  };

  const toPayload = (d: Draft): Omit<Transaction, "id"> => ({
    date: d.date,
    description: d.description.trim(),
    categoryId: d.categoryId,
    amount: Math.round(parseAmount(d.amount) * 100) / 100,
    note: d.note.trim() || undefined,
    ...(d.excluded ? { excluded: true } : {}),
  });

  const submit = () => {
    const problem = validate(draft);
    setError(problem);
    if (problem) return;
    addTransaction(toPayload(draft));
    // La spunta resta com'era: chi registra piu' spese straordinarie di fila
    // non deve rimetterla ogni volta.
    setDraft({ ...emptyDraft(monthOf(draft.date), draft.categoryId), excluded: draft.excluded });
    setNotice(null);
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditDraft({
      date: t.date,
      description: t.description,
      categoryId: t.categoryId,
      amount: String(t.amount).replace(".", ","),
      note: t.note ?? "",
      excluded: t.excluded === true,
    });
  };

  const saveEdit = () => {
    if (!editingId || !editDraft) return;
    const problem = validate(editDraft);
    setError(problem);
    if (problem) return;
    updateTransaction(editingId, toPayload(editDraft));
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setError(null);
  };

  const toggleExcluded = (t: Transaction) =>
    updateTransaction(t.id, { excluded: t.excluded ? undefined : true });

  const rowProps = {
    categories,
    cats,
    editingId,
    editDraft,
    setEditDraft,
    onEdit: startEdit,
    onSave: saveEdit,
    onCancel: cancelEdit,
    onToggleExcluded: toggleExcluded,
    onRemove: removeTransaction,
  };

  return (
    <div className="space-y-5">
      <Card
        title={`Nuova transazione — ${formatMonth(month)}`}
        description="Gli importi si scrivono come nel foglio: 12,50 oppure 12.50."
        action={
          <Button
            size="sm"
            onClick={() => {
              const created = generateFixedExpenses(month, 1);
              setNotice(
                created
                  ? `Create ${created} transazioni dalle spese fisse.`
                  : "Le spese fisse di questo mese erano gia' tutte registrate.",
              );
            }}
          >
            Genera spese fisse del mese
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Data">
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </Field>
          <Field label="Descrizione">
            <Input
              value={draft.description}
              placeholder="Coop Domodossola"
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
          <Field label="Categoria">
            <Select
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Importo">
            <Input
              inputMode="decimal"
              value={draft.amount}
              placeholder="0,00"
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
          <Field label="Note (facoltative)">
            <Input
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
        </div>

        <label className="mt-3 flex w-fit max-w-2xl items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={draft.excluded}
            onChange={(e) => setDraft({ ...draft, excluded: e.target.checked })}
          />
          <span className="text-xs text-ink">
            Non contabilizzare nel budget
            <span className="ml-2 text-ink-muted">
              Per le spese straordinarie, come l&apos;acquisto di un&apos;auto: il movimento resta
              registrato ma non entra nel budget del mese.
            </span>
          </span>
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={submit}>
            Aggiungi
          </Button>
          {error && (
            <span className="text-xs" style={{ color: "var(--critical-text)" }}>
              <span aria-hidden>■</span> {error}
            </span>
          )}
          {notice && !error && <span className="text-xs text-ink-secondary">{notice}</span>}
          {monthOf(draft.date) !== month && (
            <span className="text-xs text-ink-muted">
              Attenzione: la data e&apos; fuori dal mese visualizzato.
            </span>
          )}
        </div>
      </Card>

      <Card
        title={`Movimenti di ${formatMonth(month)}`}
        description={`${counted.length} su ${monthTx.length - monthExcludedCount} · totale filtrato ${formatEur(countedTotal)}`}
        action={
          <div className="flex flex-wrap gap-2 [&>*]:w-40">
            <Input
              value={query}
              placeholder="Cerca…"
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs"
            />
            <Select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="">Tutte le categorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        }
        bodyClassName="px-0 sm:px-0"
      >
        {counted.length === 0 ? (
          <div className="px-4 sm:px-5">
            <EmptyState
              title="Nessun movimento"
              hint="Aggiungi la prima transazione del mese o genera le spese fisse."
            />
          </div>
        ) : (
          <div className="scroll-x px-4 sm:px-5">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <TableHead />
              <tbody>
                <TransactionRows items={counted} {...rowProps} />
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {monthExcludedCount > 0 && (
        <Card
          title="Movimenti non contabilizzati"
          description={`Spese straordinarie fuori dal budget di ${formatMonth(month)}: non entrano nell'Effettivo delle categorie né nelle uscite del mese.`}
          bodyClassName="px-0 sm:px-0"
        >
          {excluded.length === 0 ? (
            <div className="px-4 sm:px-5">
              <EmptyState
                title="Nessuno con questi filtri"
                hint="Il mese ne contiene, ma la ricerca o la categoria selezionata li lascia fuori."
              />
            </div>
          ) : (
            <div className="scroll-x px-4 sm:px-5">
              <table className="w-full min-w-[48rem] border-collapse text-sm">
                <TableHead />
                <tbody>
                  <TransactionRows items={excluded} {...rowProps} />
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-hairline-strong font-medium">
                    <td className="py-2 pr-3 text-ink" colSpan={3}>
                      Totale
                    </td>
                    <td className="tnum py-2 pr-3 text-right text-ink">
                      {formatEur(excludedTotal)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
