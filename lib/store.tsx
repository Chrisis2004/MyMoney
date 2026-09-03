"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppData, Category, ExtraIncome, FixedExpense, Transaction } from "./types";
import { seedData } from "./seed";
import { normalizeAppData, clone } from "./normalize";
import { makeId } from "./calc";
import { dayInMonth, monthOf } from "./format";

const API = "/api/dati";
/** Chiave della vecchia versione dell'app: si migra al file una volta sola. */
const LEGACY_KEY = "gestione-risparmio:v1";
/** Attesa prima di scrivere: raggruppa le modifiche rapide in un solo salvataggio. */
const SAVE_DELAY = 400;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Store = {
  data: AppData;
  /** false finche' il file non e' stato letto. */
  ready: boolean;
  /** Errore bloccante in lettura: l'app non deve scrivere sopra un file che non ha letto. */
  loadError: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  /** Percorso del file sul disco, mostrato in Impostazioni. */
  filePath: string | null;
  /** Ultimo salvataggio confermato dal server. */
  savedAt: string | null;
  reload: () => void;
  retrySave: () => void;

  addTransaction: (tx: Omit<Transaction, "id">) => void;
  addTransactions: (txs: Omit<Transaction, "id">[]) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  removeTransaction: (id: string) => void;

  setBudget: (month: string, categoryId: string, amount: number) => void;
  copyBudgetFrom: (from: string, to: string) => void;
  fillBudgetFromFixedExpenses: (month: string) => void;

  setIncome: (month: string, amount: number) => void;
  setDefaultIncome: (amount: number) => void;

  addExtraIncome: (entry: Omit<ExtraIncome, "id">) => void;
  updateExtraIncome: (id: string, patch: Partial<Omit<ExtraIncome, "id">>) => void;
  removeExtraIncome: (id: string) => void;

  addCategory: (name: string, kind: Category["kind"]) => void;
  updateCategory: (id: string, patch: Partial<Omit<Category, "id">>) => void;
  removeCategory: (id: string) => void;

  addFixedExpense: (fx: Omit<FixedExpense, "id">) => void;
  updateFixedExpense: (id: string, patch: Partial<Omit<FixedExpense, "id">>) => void;
  removeFixedExpense: (id: string) => void;
  generateFixedExpenses: (month: string, day: number) => number;

  replaceAll: (data: AppData) => void;
  resetToSeed: () => void;
  clearAll: () => void;
};

const StoreContext = createContext<Store | null>(null);

/** Dati lasciati dalla versione che salvava nel browser, se ce ne sono. */
function readLegacyData(): AppData | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = normalizeAppData(JSON.parse(raw));
    const empty =
      !parsed.transactions.length && !parsed.budgets.length && !parsed.fixedExpenses.length;
    return empty ? null : parsed;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => clone(seedData));
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // JSON dell'ultimo stato confermato dal file: serve a non riscrivere invano
  // e a capire cosa e' rimasto in sospeso alla chiusura della pagina.
  const savedJson = useRef<string | null>(null);
  /**
   * Diventa true solo dopo una lettura riuscita. Finche' e' false NIENTE puo'
   * scrivere: prima di leggere il file lo stato in memoria e' ancora quello
   * iniziale, e spedirlo cancellerebbe i dati veri. Serve un ref e non uno
   * stato perche' anche il gestore di `pagehide`, che non passa dal ciclo di
   * render, deve vedere il valore aggiornato all'istante.
   */
  const loadedOk = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const persist = useCallback(async (json: string) => {
    setSaveStatus("saving");
    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: json,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.detail || body?.error || `HTTP ${res.status}`);
      savedJson.current = json;
      setSavedAt(body?.savedAt ?? new Date().toISOString());
      setSaveStatus("saved");
      setSaveError(null);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(API, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.detail || body?.error || `HTTP ${res.status}`);

      const onDisk = normalizeAppData(body.data);
      setFilePath(body.path ?? null);
      savedJson.current = JSON.stringify(onDisk);

      // Prima apertura dopo il passaggio al file: si recupera quello che era
      // rimasto nel browser invece di ripartire dai dati iniziali. Differendo
      // da quanto c'e' sul disco, il salvataggio automatico lo scrive da se'.
      const legacy = body.created ? readLegacyData() : null;

      loadedOk.current = true;
      setData(legacy ?? onDisk);
      setReady(true);
    } catch (err) {
      loadedOk.current = false;
      setLoadError(err instanceof Error ? err.message : String(err));
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Salvataggio automatico, ma solo dopo una lettura riuscita.
  useEffect(() => {
    if (!loadedOk.current || !ready || loadError) return;
    const json = JSON.stringify(data);
    if (json === savedJson.current) {
      // Dopo un errore si puo' tornare allo stato gia' sul file (annullando la
      // modifica): non c'e' piu' niente da salvare, quindi via l'allarme.
      setSaveStatus((s) => (s === "error" ? "saved" : s));
      setSaveError((e) => (e === null ? e : null));
      return;
    }
    const timer = window.setTimeout(() => void persist(json), SAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [data, ready, loadError, persist]);

  // Chiusura o ricarica della pagina: l'ultima modifica parte comunque.
  useEffect(() => {
    const flush = () => {
      // `pagehide` puo' scattare mentre la lettura iniziale e' ancora in volo:
      // senza questo controllo partirebbero i dati iniziali.
      if (!loadedOk.current || savedJson.current === null) return;
      const json = JSON.stringify(dataRef.current);
      if (json === savedJson.current) return;
      navigator.sendBeacon?.(API, new Blob([json], { type: "application/json" }));
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  const store = useMemo<Store>(() => {
    const setBudgetIn = (
      d: AppData,
      month: string,
      categoryId: string,
      amount: number,
    ): AppData => {
      const rest = d.budgets.filter((b) => !(b.month === month && b.categoryId === categoryId));
      return { ...d, budgets: amount > 0 ? [...rest, { month, categoryId, amount }] : rest };
    };

    return {
      data,
      ready,
      loadError,
      saveStatus,
      saveError,
      filePath,
      savedAt,
      reload: () => void load(),
      retrySave: () => {
        if (loadedOk.current) void persist(JSON.stringify(dataRef.current));
      },

      addTransaction: (tx) =>
        update((d) => ({ ...d, transactions: [...d.transactions, { ...tx, id: makeId("tx") }] })),

      addTransactions: (txs) =>
        update((d) => ({
          ...d,
          transactions: [...d.transactions, ...txs.map((t) => ({ ...t, id: makeId("tx") }))],
        })),

      updateTransaction: (id, patch) =>
        update((d) => ({
          ...d,
          transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeTransaction: (id) =>
        update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) })),

      setBudget: (month, categoryId, amount) =>
        update((d) => setBudgetIn(d, month, categoryId, amount)),

      copyBudgetFrom: (from, to) =>
        update((d) => {
          const source = d.budgets.filter((b) => b.month === from);
          const rest = d.budgets.filter((b) => b.month !== to);
          return { ...d, budgets: [...rest, ...source.map((b) => ({ ...b, month: to }))] };
        }),

      fillBudgetFromFixedExpenses: (month) =>
        update((d) => {
          const totals = new Map<string, number>();
          for (const fx of d.fixedExpenses) {
            if (!fx.active) continue;
            totals.set(fx.categoryId, (totals.get(fx.categoryId) ?? 0) + fx.amount);
          }
          let next = d;
          for (const [categoryId, amount] of totals) {
            const existing = next.budgets.find(
              (b) => b.month === month && b.categoryId === categoryId,
            );
            if (!existing || existing.amount < amount) {
              next = setBudgetIn(next, month, categoryId, amount);
            }
          }
          return next;
        }),

      setIncome: (month, amount) =>
        update((d) => ({
          ...d,
          incomes: [...d.incomes.filter((i) => i.month !== month), { month, amount }],
        })),

      setDefaultIncome: (amount) => update((d) => ({ ...d, defaultIncome: amount })),

      addExtraIncome: (entry) =>
        update((d) => ({
          ...d,
          extraIncomes: [...d.extraIncomes, { ...entry, id: makeId("in") }],
        })),

      updateExtraIncome: (id, patch) =>
        update((d) => ({
          ...d,
          extraIncomes: d.extraIncomes.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeExtraIncome: (id) =>
        update((d) => ({ ...d, extraIncomes: d.extraIncomes.filter((e) => e.id !== id) })),

      addCategory: (name, kind) =>
        update((d) => ({
          ...d,
          categories: [
            ...d.categories,
            {
              id: makeId("cat"),
              name,
              kind,
              order: Math.max(0, ...d.categories.map((c) => c.order)) + 1,
            },
          ],
        })),

      updateCategory: (id, patch) =>
        update((d) => ({
          ...d,
          categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      // Una categoria gia' usata viene archiviata, non cancellata: eliminarla
      // renderebbe orfani i movimenti e le spese fisse che la referenziano.
      removeCategory: (id) =>
        update((d) => {
          const used =
            d.transactions.some((t) => t.categoryId === id) ||
            d.fixedExpenses.some((f) => f.categoryId === id);
          if (used) {
            return {
              ...d,
              categories: d.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
            };
          }
          return {
            ...d,
            categories: d.categories.filter((c) => c.id !== id),
            budgets: d.budgets.filter((b) => b.categoryId !== id),
          };
        }),

      addFixedExpense: (fx) =>
        update((d) => ({ ...d, fixedExpenses: [...d.fixedExpenses, { ...fx, id: makeId("fx") }] })),

      updateFixedExpense: (id, patch) =>
        update((d) => ({
          ...d,
          fixedExpenses: d.fixedExpenses.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),

      removeFixedExpense: (id) =>
        update((d) => ({ ...d, fixedExpenses: d.fixedExpenses.filter((f) => f.id !== id) })),

      generateFixedExpenses: (month, day) => {
        const already = new Set(
          data.transactions
            .filter((t) => t.fixedExpenseId && monthOf(t.date) === month)
            .map((t) => t.fixedExpenseId as string),
        );
        const toCreate = data.fixedExpenses.filter((f) => f.active && !already.has(f.id));
        if (toCreate.length) {
          const date = dayInMonth(month, day);
          update((d) => ({
            ...d,
            transactions: [
              ...d.transactions,
              ...toCreate.map((f) => ({
                id: makeId("tx"),
                date,
                description: f.name,
                categoryId: f.categoryId,
                amount: f.amount,
                note: f.note,
                fixedExpenseId: f.id,
              })),
            ],
          }));
        }
        return toCreate.length;
      },

      replaceAll: (next) => setData(normalizeAppData(next)),
      resetToSeed: () => setData(clone(seedData)),
      clearAll: () =>
        setData((d) => ({
          version: 1,
          defaultIncome: d.defaultIncome,
          categories: d.categories,
          transactions: [],
          budgets: [],
          fixedExpenses: [],
          incomes: [],
          extraIncomes: [],
        })),
    };
  }, [data, ready, loadError, saveStatus, saveError, filePath, savedAt, load, persist, update]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore va usato dentro <StoreProvider>");
  return ctx;
}
