export type MonthKey = string; // "YYYY-MM"

export type Category = {
  id: string;
  name: string;
  /** Ordine di visualizzazione (come nel foglio Numbers). */
  order: number;
  /** Le categorie di risparmio non sono spesa: alimentano il patrimonio. */
  kind: "expense" | "saving";
  archived?: boolean;
};

export type Transaction = {
  id: string;
  /** ISO "YYYY-MM-DD" */
  date: string;
  description: string;
  categoryId: string;
  /** Sempre positivo, in euro. La categoria decide se e' spesa o accantonamento. */
  amount: number;
  note?: string;
  /** Id della spesa fissa da cui e' stata generata, se generata. */
  fixedExpenseId?: string;
  /**
   * Movimento straordinario tenuto fuori dal budget del mese (l'acquisto di
   * un'auto, una spesa una tantum). Resta registrato e visibile, ma non entra
   * nell'Effettivo delle categorie ne' nelle uscite del mese.
   */
  excluded?: boolean;
};

/** Budget di una categoria per un mese preciso. */
export type BudgetLine = {
  month: MonthKey;
  categoryId: string;
  amount: number;
};

export type FixedExpense = {
  id: string;
  name: string;
  categoryId: string;
  amount: number;
  active: boolean;
  note?: string;
};

/** Entrata ricorrente del mese: lo stipendio e quello su cui si pianifica. */
export type Income = {
  month: MonthKey;
  amount: number;
};

/**
 * Entrata occasionale con una data: un regalo, un aiuto in famiglia, un
 * rimborso. Si somma all'entrata fissa del mese in cui cade.
 */
export type ExtraIncome = {
  id: string;
  /** ISO "YYYY-MM-DD" */
  date: string;
  description: string;
  amount: number;
  note?: string;
};

export type AppData = {
  version: number;
  categories: Category[];
  transactions: Transaction[];
  budgets: BudgetLine[];
  fixedExpenses: FixedExpense[];
  incomes: Income[];
  extraIncomes: ExtraIncome[];
  /** Entrata mensile usata quando il mese non ha un valore proprio. */
  defaultIncome: number;
};

/** Riga calcolata del "Riepilogo per categoria". */
export type CategorySummaryRow = {
  category: Category;
  budget: number;
  actual: number;
  difference: number;
  /** Frazione 0..n del budget consumato; null se il budget e' 0. */
  consumed: number | null;
  transactionCount: number;
};
