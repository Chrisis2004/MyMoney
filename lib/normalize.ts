import type {
  AppData,
  BudgetLine,
  Category,
  ExtraIncome,
  FixedExpense,
  Income,
  Transaction,
} from "./types";
import { seedData } from "./seed";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number.NaN);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function categories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return clone(seedData.categories);
  const out: Category[] = [];
  raw.forEach((item, i) => {
    if (!isRecord(item)) return;
    const id = str(item.id);
    const name = str(item.name);
    if (!id || !name) return;
    out.push({
      id,
      name,
      order: Number.isFinite(num(item.order)) ? num(item.order) : i + 1,
      kind: item.kind === "saving" ? "saving" : "expense",
      ...(item.archived === true ? { archived: true } : {}),
    });
  });
  // Senza categorie l'app non ha significato: si torna a quelle del foglio.
  return out.length ? out : clone(seedData.categories);
}

function transactions(raw: unknown, validCategory: (id: string) => boolean): Transaction[] {
  if (!Array.isArray(raw)) return [];
  const out: Transaction[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = str(item.id);
    const date = str(item.date);
    const description = str(item.description);
    const categoryId = str(item.categoryId);
    const amount = num(item.amount);
    if (!id || seen.has(id)) continue;
    if (!ISO_DATE.test(date) || !description) continue;
    if (!validCategory(categoryId) || !Number.isFinite(amount)) continue;
    seen.add(id);
    out.push({
      id,
      date,
      description,
      categoryId,
      amount,
      ...(str(item.note) ? { note: str(item.note) } : {}),
      ...(str(item.fixedExpenseId) ? { fixedExpenseId: str(item.fixedExpenseId) } : {}),
      ...(item.excluded === true ? { excluded: true } : {}),
    });
  }
  return out;
}

function budgets(raw: unknown, validCategory: (id: string) => boolean): BudgetLine[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, BudgetLine>();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const month = str(item.month);
    const categoryId = str(item.categoryId);
    const amount = num(item.amount);
    if (!ISO_MONTH.test(month) || !validCategory(categoryId) || !Number.isFinite(amount)) continue;
    // Una sola riga per mese+categoria: l'ultima vince.
    out.set(`${month}|${categoryId}`, { month, categoryId, amount });
  }
  return [...out.values()];
}

function fixedExpenses(raw: unknown, validCategory: (id: string) => boolean): FixedExpense[] {
  if (!Array.isArray(raw)) return [];
  const out: FixedExpense[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = str(item.id);
    const name = str(item.name);
    const categoryId = str(item.categoryId);
    const amount = num(item.amount);
    if (!id || seen.has(id) || !name) continue;
    if (!validCategory(categoryId) || !Number.isFinite(amount)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      categoryId,
      amount,
      active: item.active !== false,
      ...(str(item.note) ? { note: str(item.note) } : {}),
    });
  }
  return out;
}

function incomes(raw: unknown): Income[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, Income>();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const month = str(item.month);
    const amount = num(item.amount);
    if (!ISO_MONTH.test(month) || !Number.isFinite(amount)) continue;
    out.set(month, { month, amount });
  }
  return [...out.values()];
}

function extraIncomes(raw: unknown): ExtraIncome[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtraIncome[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = str(item.id);
    const date = str(item.date);
    const description = str(item.description);
    const amount = num(item.amount);
    if (!id || seen.has(id) || !description) continue;
    if (!ISO_DATE.test(date) || !Number.isFinite(amount)) continue;
    seen.add(id);
    out.push({
      id,
      date,
      description,
      amount,
      ...(str(item.note) ? { note: str(item.note) } : {}),
    });
  }
  return out;
}

/**
 * Ripulisce dati di provenienza ignota (file sul disco, backup importato, corpo
 * di una richiesta) scartando le righe non valide invece di rifiutare tutto.
 * Usata sia dal client sia dalla route che scrive il file, cosi' il file non
 * puo' finire in uno stato che l'app non sa leggere.
 */
export function normalizeAppData(raw: unknown): AppData {
  const source = isRecord(raw) ? raw : {};
  const cats = categories(source.categories);
  const known = new Set(cats.map((c) => c.id));
  const validCategory = (id: string) => known.has(id);
  const income = num(source.defaultIncome);

  return {
    version: 1,
    defaultIncome: Number.isFinite(income) && income >= 0 ? income : seedData.defaultIncome,
    categories: cats,
    transactions: transactions(source.transactions, validCategory),
    budgets: budgets(source.budgets, validCategory),
    fixedExpenses: fixedExpenses(source.fixedExpenses, validCategory),
    incomes: incomes(source.incomes),
    extraIncomes: extraIncomes(source.extraIncomes),
  };
}

export { clone };
