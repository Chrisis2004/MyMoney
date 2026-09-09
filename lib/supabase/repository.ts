import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "../types";
import { normalizeAppData } from "../normalize";

/**
 * Il ponte fra le tabelle Postgres e la forma `AppData` che l'app tiene in
 * memoria. L'app continua a ragionare su un unico oggetto; qui lo si smonta in
 * righe e lo si rimonta, scrivendo soltanto cio' che e' davvero cambiato.
 */

/** Gli importi stanno in numeric(12,2): arrotondando qui il confronto fra
 * stato in memoria e stato sul database resta stabile, altrimenti un 10,555
 * risulterebbe diverso da un 10,56 a ogni salvataggio. */
const money = (n: number) => Math.round(n * 100) / 100;

const orNull = (s: string | undefined) => (s && s.trim() ? s : null);

// --------------------------------------------------------------- lettura ---

type Row = Record<string, unknown>;

/** Legge tutte le righe dell'utente e le ricompone in un `AppData`. */
export async function loadAppData(supabase: SupabaseClient, userId: string): Promise<AppData> {
  const [settings, categories, fixedExpenses, transactions, budgets, incomes, extraIncomes] =
    await Promise.all([
      supabase.from("settings").select("default_income").eq("user_id", userId).maybeSingle(),
      supabase.from("categories").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("fixed_expenses").select("*").eq("user_id", userId).order("name"),
      supabase.from("transactions").select("*").eq("user_id", userId).order("date"),
      supabase.from("budgets").select("*").eq("user_id", userId),
      supabase.from("incomes").select("*").eq("user_id", userId).order("month"),
      supabase.from("extra_incomes").select("*").eq("user_id", userId).order("date"),
    ]);

  for (const res of [
    settings,
    categories,
    fixedExpenses,
    transactions,
    budgets,
    incomes,
    extraIncomes,
  ]) {
    if (res.error) throw new Error(res.error.message);
  }

  const cats = (categories.data ?? []) as Row[];
  const fixed = (fixedExpenses.data ?? []) as Row[];
  const txs = (transactions.data ?? []) as Row[];
  const buds = (budgets.data ?? []) as Row[];
  const inc = (incomes.data ?? []) as Row[];
  const extra = (extraIncomes.data ?? []) as Row[];

  // normalizeAppData ripulisce e riempie gli opzionali: la forma finale e'
  // esattamente quella che l'app si aspetta, database o file che sia.
  return normalizeAppData({
    version: 1,
    defaultIncome: Number(settings.data?.default_income ?? 0),
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      order: Number(c.sort_order ?? 0),
      kind: c.kind,
      ...(c.archived === true ? { archived: true } : {}),
    })),
    fixedExpenses: fixed.map((f) => ({
      id: f.id,
      name: f.name,
      categoryId: f.category_id,
      amount: Number(f.amount),
      active: f.active !== false,
      ...(f.note ? { note: f.note } : {}),
    })),
    transactions: txs.map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      categoryId: t.category_id,
      amount: Number(t.amount),
      ...(t.note ? { note: t.note } : {}),
      ...(t.fixed_expense_id ? { fixedExpenseId: t.fixed_expense_id } : {}),
      ...(t.excluded === true ? { excluded: true } : {}),
    })),
    budgets: buds.map((b) => ({
      month: b.month,
      categoryId: b.category_id,
      amount: Number(b.amount),
    })),
    incomes: inc.map((i) => ({ month: i.month, amount: Number(i.amount) })),
    extraIncomes: extra.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: Number(e.amount),
      ...(e.note ? { note: e.note } : {}),
    })),
  });
}

// -------------------------------------------------------------- scrittura ---

/**
 * Una tabella vista dal diff: come si costruisce la chiave di una riga e come
 * si passa dal modello dell'app alla riga del database.
 */
type Mapper<T> = {
  key: (item: T) => string;
  row: (item: T) => Row;
};

const asCategory: Mapper<AppData["categories"][number]> = {
  key: (c) => c.id,
  row: (c) => ({
    id: c.id,
    name: c.name,
    sort_order: Math.round(c.order),
    kind: c.kind,
    archived: c.archived === true,
  }),
};

const asFixedExpense: Mapper<AppData["fixedExpenses"][number]> = {
  key: (f) => f.id,
  row: (f) => ({
    id: f.id,
    name: f.name,
    category_id: f.categoryId,
    amount: money(f.amount),
    active: f.active,
    note: orNull(f.note),
  }),
};

const asTransaction: Mapper<AppData["transactions"][number]> = {
  key: (t) => t.id,
  row: (t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    category_id: t.categoryId,
    amount: money(t.amount),
    note: orNull(t.note),
    fixed_expense_id: orNull(t.fixedExpenseId),
    excluded: t.excluded === true,
  }),
};

const asBudget: Mapper<AppData["budgets"][number]> = {
  key: (b) => `${b.month}|${b.categoryId}`,
  row: (b) => ({ month: b.month, category_id: b.categoryId, amount: money(b.amount) }),
};

const asIncome: Mapper<AppData["incomes"][number]> = {
  key: (i) => i.month,
  row: (i) => ({ month: i.month, amount: money(i.amount) }),
};

const asExtraIncome: Mapper<AppData["extraIncomes"][number]> = {
  key: (e) => e.id,
  row: (e) => ({
    id: e.id,
    date: e.date,
    description: e.description,
    amount: money(e.amount),
    note: orNull(e.note),
  }),
};

type Diff = { upserts: Row[]; removedKeys: string[] };

/**
 * Confronta due elenchi e restituisce solo le differenze. Il confronto e' sulla
 * riga serializzata: due righe identiche non producono nessuna scrittura, ed e'
 * questo che tiene basso il traffico verso il database a ogni battuta di tasto.
 */
function diff<T>(before: T[], after: T[], m: Mapper<T>): Diff {
  const old = new Map(before.map((item) => [m.key(item), JSON.stringify(m.row(item))]));
  const upserts: Row[] = [];
  const kept = new Set<string>();

  for (const item of after) {
    const key = m.key(item);
    kept.add(key);
    const row = m.row(item);
    if (old.get(key) !== JSON.stringify(row)) upserts.push(row);
  }

  return { upserts, removedKeys: [...old.keys()].filter((k) => !kept.has(k)) };
}

/**
 * Salva `next` per l'utente indicato applicando solo le differenze rispetto a
 * quello che c'e' gia' sul database.
 *
 * L'ordine non e' casuale: le categorie nascono prima di cio' che le
 * referenzia e muoiono per ultime, altrimenti le foreign key si oppongono.
 * Postgres non offre una transazione unica attraverso PostgREST, ma ogni passo
 * e' idempotente: un salvataggio interrotto viene sanato dal successivo.
 */
export async function saveAppData(
  supabase: SupabaseClient,
  userId: string,
  next: AppData,
): Promise<AppData> {
  const clean = normalizeAppData(next);
  const current = await loadAppData(supabase, userId);

  const withUser = (rows: Row[]) => rows.map((r) => ({ ...r, user_id: userId }));

  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  const categories = diff(current.categories, clean.categories, asCategory);
  const fixedExpenses = diff(current.fixedExpenses, clean.fixedExpenses, asFixedExpense);
  const transactions = diff(current.transactions, clean.transactions, asTransaction);
  const budgets = diff(current.budgets, clean.budgets, asBudget);
  const incomes = diff(current.incomes, clean.incomes, asIncome);
  const extraIncomes = diff(current.extraIncomes, clean.extraIncomes, asExtraIncome);

  // 1. Prima le nuove categorie: tutto il resto puo' puntarci.
  if (categories.upserts.length) {
    const { error } = await supabase
      .from("categories")
      .upsert(withUser(categories.upserts), { onConflict: "user_id,id" });
    fail("categorie", error);
  }

  if (fixedExpenses.upserts.length) {
    const { error } = await supabase
      .from("fixed_expenses")
      .upsert(withUser(fixedExpenses.upserts), { onConflict: "user_id,id" });
    fail("spese fisse", error);
  }

  if (transactions.upserts.length) {
    const { error } = await supabase
      .from("transactions")
      .upsert(withUser(transactions.upserts), { onConflict: "user_id,id" });
    fail("transazioni", error);
  }

  if (budgets.upserts.length) {
    const { error } = await supabase
      .from("budgets")
      .upsert(withUser(budgets.upserts), { onConflict: "user_id,month,category_id" });
    fail("budget", error);
  }

  if (incomes.upserts.length) {
    const { error } = await supabase
      .from("incomes")
      .upsert(withUser(incomes.upserts), { onConflict: "user_id,month" });
    fail("entrate", error);
  }

  if (extraIncomes.upserts.length) {
    const { error } = await supabase
      .from("extra_incomes")
      .upsert(withUser(extraIncomes.upserts), { onConflict: "user_id,id" });
    fail("entrate extra", error);
  }

  // 2. Le cancellazioni in ordine inverso: le foglie prima delle categorie.
  if (transactions.removedKeys.length) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", userId)
      .in("id", transactions.removedKeys);
    fail("transazioni rimosse", error);
  }

  if (extraIncomes.removedKeys.length) {
    const { error } = await supabase
      .from("extra_incomes")
      .delete()
      .eq("user_id", userId)
      .in("id", extraIncomes.removedKeys);
    fail("entrate extra rimosse", error);
  }

  if (incomes.removedKeys.length) {
    const { error } = await supabase
      .from("incomes")
      .delete()
      .eq("user_id", userId)
      .in("month", incomes.removedKeys);
    fail("entrate rimosse", error);
  }

  if (budgets.removedKeys.length) {
    // Chiave doppia: si cancella un mese alla volta, e i mesi toccati da un
    // singolo salvataggio sono quasi sempre uno.
    const byMonth = new Map<string, string[]>();
    for (const key of budgets.removedKeys) {
      const [month, categoryId] = key.split("|");
      byMonth.set(month, [...(byMonth.get(month) ?? []), categoryId]);
    }
    for (const [month, categoryIds] of byMonth) {
      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("user_id", userId)
        .eq("month", month)
        .in("category_id", categoryIds);
      fail("budget rimossi", error);
    }
  }

  if (fixedExpenses.removedKeys.length) {
    const { error } = await supabase
      .from("fixed_expenses")
      .delete()
      .eq("user_id", userId)
      .in("id", fixedExpenses.removedKeys);
    fail("spese fisse rimosse", error);
  }

  if (categories.removedKeys.length) {
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("user_id", userId)
      .in("id", categories.removedKeys);
    fail("categorie rimosse", error);
  }

  // 3. Le preferenze: una riga sola, si tocca solo se cambia.
  if (money(current.defaultIncome) !== money(clean.defaultIncome)) {
    const { error } = await supabase.from("settings").upsert(
      {
        user_id: userId,
        default_income: money(clean.defaultIncome),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    fail("preferenze", error);
  }

  return clean;
}
