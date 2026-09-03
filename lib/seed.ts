import type { AppData } from "./types";

/**
 * Dati iniziali ricavati dal foglio Numbers "Budget mensile - Settembre 2026".
 * Categorie, budget e spese fisse sono quelli del foglio; le transazioni sono
 * poche perche' il mese era appena iniziato.
 */
export const SEED_MONTH = "2026-09";

export const seedData: AppData = {
  version: 1,
  defaultIncome: 5026.6,
  categories: [
    { id: "entertainment", name: "Entertainment", order: 1, kind: "expense" },
    { id: "groceries", name: "Groceries", order: 2, kind: "expense" },
    { id: "healt", name: "Healt", order: 3, kind: "expense" },
    { id: "insurance", name: "Insurance", order: 4, kind: "expense" },
    { id: "restaurants", name: "Restaurants", order: 5, kind: "expense" },
    { id: "savings", name: "Savings", order: 6, kind: "saving" },
    { id: "services", name: "Services", order: 7, kind: "expense" },
    { id: "shopping", name: "Shopping", order: 8, kind: "expense" },
    { id: "transport", name: "Transport", order: 9, kind: "expense" },
    { id: "utilities", name: "Utilities", order: 10, kind: "expense" },
    { id: "university", name: "University", order: 11, kind: "expense" },
  ],
  budgets: [
    { month: SEED_MONTH, categoryId: "entertainment", amount: 13 },
    { month: SEED_MONTH, categoryId: "groceries", amount: 375 },
    { month: SEED_MONTH, categoryId: "healt", amount: 50 },
    { month: SEED_MONTH, categoryId: "insurance", amount: 45 },
    { month: SEED_MONTH, categoryId: "restaurants", amount: 50 },
    { month: SEED_MONTH, categoryId: "savings", amount: 5 },
    { month: SEED_MONTH, categoryId: "services", amount: 37 },
    { month: SEED_MONTH, categoryId: "shopping", amount: 50 },
    { month: SEED_MONTH, categoryId: "transport", amount: 80 },
    { month: SEED_MONTH, categoryId: "utilities", amount: 1120 },
    { month: SEED_MONTH, categoryId: "university", amount: 250 },
  ],
  fixedExpenses: [
    { id: "fx-affitto", name: "Affitto", categoryId: "utilities", amount: 845, active: true },
    { id: "fx-condominio", name: "Spese condominiali", categoryId: "utilities", amount: 190, active: true },
    { id: "fx-luce", name: "Luce", categoryId: "utilities", amount: 60, active: true },
    { id: "fx-wifi", name: "Wifi", categoryId: "utilities", amount: 22.99, active: true },
    { id: "fx-icloud", name: "ICloud", categoryId: "services", amount: 2.99, active: true, note: "200 GB" },
    { id: "fx-applemusic", name: "Apple Music", categoryId: "services", amount: 5.99, active: true },
    { id: "fx-lte", name: "Mobile LTE", categoryId: "services", amount: 9.99, active: true },
    { id: "fx-claude", name: "Claude", categoryId: "services", amount: 18, active: true },
    { id: "fx-benzina", name: "Benzina", categoryId: "transport", amount: 50, active: true },
    { id: "fx-atm", name: "ATM", categoryId: "transport", amount: 22, active: true, note: "Abbonamento mensile" },
    { id: "fx-palestra", name: "Palestra", categoryId: "healt", amount: 50, active: true, note: "McFit" },
    { id: "fx-assauto", name: "Insurance AUTO", categoryId: "insurance", amount: 45, active: true },
    { id: "fx-uni-tasse", name: "Tasse universitarie", categoryId: "university", amount: 225, active: true },
    { id: "fx-uni-extra", name: "Materiale universitario", categoryId: "university", amount: 25, active: true },
  ],
  incomes: [{ month: SEED_MONTH, amount: 5026.6 }],
  extraIncomes: [],
  transactions: [
    {
      id: "tx-seed-1",
      date: "2026-09-01",
      description: "ATM",
      categoryId: "transport",
      amount: 22,
      note: "Abbonamento mensile — importato dal foglio, verifica",
    },
    {
      id: "tx-seed-2",
      date: "2026-09-02",
      description: "Orasesta",
      categoryId: "restaurants",
      amount: 5,
      note: "Ricarica macchinette lavoro — importato dal foglio, verifica",
    },
    {
      id: "tx-seed-3",
      date: "2026-09-03",
      description: "Apple",
      categoryId: "services",
      amount: 11,
      note: "Importato dal foglio, verifica",
    },
  ],
};
