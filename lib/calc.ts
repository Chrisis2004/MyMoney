import type { AppData, Category, CategorySummaryRow, ExtraIncome, Transaction } from "./types";
import { monthOf } from "./format";

export function activeCategories(data: AppData): Category[] {
  return data.categories.filter((c) => !c.archived).sort((a, b) => a.order - b.order);
}

export function categoryMap(data: AppData) {
  return new Map(data.categories.map((c) => [c.id, c]));
}

export function transactionsOfMonth(data: AppData, month: string): Transaction[] {
  return data.transactions
    .filter((t) => monthOf(t.date) === month)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
}

/** Separa i movimenti che entrano nel budget da quelli tenuti fuori. */
export function splitByAccounting(txs: Transaction[]) {
  const counted: Transaction[] = [];
  const excluded: Transaction[] = [];
  for (const t of txs) (t.excluded ? excluded : counted).push(t);
  return { counted, excluded };
}

export function budgetFor(data: AppData, month: string, categoryId: string): number {
  return data.budgets.find((b) => b.month === month && b.categoryId === categoryId)?.amount ?? 0;
}

/** Entrata fissa del mese, senza le occasionali. */
export function incomeFor(data: AppData, month: string): number {
  return data.incomes.find((i) => i.month === month)?.amount ?? data.defaultIncome;
}

export function extraIncomesOfMonth(data: AppData, month: string): ExtraIncome[] {
  return data.extraIncomes
    .filter((e) => monthOf(e.date) === month)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
}

export function extraIncomeFor(data: AppData, month: string): number {
  return extraIncomesOfMonth(data, month).reduce((s, e) => s + e.amount, 0);
}

/** Quello che e' davvero entrato nel mese: fisso piu' occasionale. */
export function totalIncomeFor(data: AppData, month: string): number {
  return incomeFor(data, month) + extraIncomeFor(data, month);
}

/** Il "Riepilogo per categoria" del foglio, calcolato per un mese. */
export function categorySummary(data: AppData, month: string): CategorySummaryRow[] {
  // I movimenti non contabilizzati restano fuori dall'Effettivo: e' il senso
  // stesso del flag.
  const { counted: txs } = splitByAccounting(transactionsOfMonth(data, month));
  const actualBy = new Map<string, { sum: number; count: number }>();
  for (const t of txs) {
    const cur = actualBy.get(t.categoryId) ?? { sum: 0, count: 0 };
    cur.sum += t.amount;
    cur.count += 1;
    actualBy.set(t.categoryId, cur);
  }

  return activeCategories(data).map((category) => {
    const budget = budgetFor(data, month, category.id);
    const hit = actualBy.get(category.id) ?? { sum: 0, count: 0 };
    return {
      category,
      budget,
      actual: hit.sum,
      difference: budget - hit.sum,
      consumed: budget > 0 ? hit.sum / budget : null,
      transactionCount: hit.count,
    };
  });
}

export type MonthTotals = {
  month: string;
  /** Entrate totali del mese: fisse piu' occasionali. */
  income: number;
  /** Solo la parte fissa. */
  baseIncome: number;
  /** Solo le entrate occasionali registrate nel mese. */
  extraIncome: number;
  budget: number;
  /** Uscite reali, escluse le categorie di tipo "saving". */
  spent: number;
  /** Accantonamenti reali (categorie "saving"). */
  saved: number;
  /** Entrate − uscite − accantonamenti: quanto resta davvero. */
  leftover: number;
  /** Entrate − uscite: quanto e' risparmiato in totale nel mese. */
  netSaving: number;
  transactionCount: number;
  /** Totale dei movimenti straordinari tenuti fuori dal budget. */
  excluded: number;
  excludedCount: number;
};

export function monthTotals(data: AppData, month: string): MonthTotals {
  const rows = categorySummary(data, month);
  const baseIncome = incomeFor(data, month);
  const extraIncome = extraIncomeFor(data, month);
  const income = baseIncome + extraIncome;
  const { excluded } = splitByAccounting(transactionsOfMonth(data, month));
  let budget = 0;
  let spent = 0;
  let saved = 0;
  let transactionCount = 0;

  for (const row of rows) {
    budget += row.budget;
    transactionCount += row.transactionCount;
    if (row.category.kind === "saving") saved += row.actual;
    else spent += row.actual;
  }

  return {
    month,
    income,
    baseIncome,
    extraIncome,
    budget,
    spent,
    saved,
    leftover: income - spent - saved,
    netSaving: income - spent,
    transactionCount,
    excluded: excluded.reduce((s, t) => s + t.amount, 0),
    excludedCount: excluded.length,
  };
}

export type DayPoint = {
  /** Giorno del mese, da 1 in poi. */
  day: number;
  date: string;
  /** Uscite contabilizzate registrate in quel giorno. */
  spent: number;
  /** Uscite contabilizzate dall'inizio del mese fino a quel giorno incluso. */
  cumulative: number;
  /** Entrate occasionali registrate in quel giorno. */
  earned: number;
  /**
   * Entrate disponibili fino a quel giorno: la fissa del mese, che non ha una
   * data e vale da subito, piu' le occasionali gia' incassate.
   */
  cumulativeIncome: number;
};

/**
 * Andamento giorno per giorno del mese. Le entrate sono un valore mensile e non
 * hanno una data: nel grafico fanno da soglia costante, mentre a salire sono le
 * uscite cumulate. Cosi' entrambe le serie dicono qualcosa in ogni giorno.
 */
export function dailyFlow(data: AppData, month: string): DayPoint[] {
  const [year, m] = month.split("-").map(Number);
  const days = new Date(year, m, 0).getDate();
  const { counted } = splitByAccounting(transactionsOfMonth(data, month));
  const saving = new Set(
    data.categories.filter((c) => c.kind === "saving").map((c) => c.id),
  );

  const perDay = new Array<number>(days + 1).fill(0);
  for (const t of counted) {
    if (saving.has(t.categoryId)) continue;
    const day = Number(t.date.slice(8, 10));
    if (day >= 1 && day <= days) perDay[day] += t.amount;
  }

  const inPerDay = new Array<number>(days + 1).fill(0);
  for (const e of extraIncomesOfMonth(data, month)) {
    const day = Number(e.date.slice(8, 10));
    if (day >= 1 && day <= days) inPerDay[day] += e.amount;
  }

  const base = incomeFor(data, month);
  let running = 0;
  let runningIn = base;
  const out: DayPoint[] = [];
  for (let day = 1; day <= days; day++) {
    running += perDay[day];
    runningIn += inPerDay[day];
    out.push({
      day,
      date: `${month}-${String(day).padStart(2, "0")}`,
      spent: perDay[day],
      cumulative: running,
      earned: inPerDay[day],
      cumulativeIncome: runningIn,
    });
  }
  return out;
}

/** Tutti i mesi che contengono qualcosa, dal piu' vecchio al piu' recente. */
export function knownMonths(data: AppData): string[] {
  const set = new Set<string>();
  for (const t of data.transactions) set.add(monthOf(t.date));
  for (const b of data.budgets) set.add(b.month);
  for (const i of data.incomes) set.add(i.month);
  return [...set].sort();
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
