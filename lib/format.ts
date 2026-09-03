const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurCompact = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatEur = (n: number) => eur.format(n);
export const formatEurShort = (n: number) => eurCompact.format(n);
export const formatPct = (n: number) => pct.format(n);

export function formatSignedEur(n: number) {
  if (Math.abs(n) < 0.005) return formatEur(0);
  return `${n > 0 ? "+" : "−"}${eur.format(Math.abs(n))}`;
}

/** "2026-09-14" -> "14/09/2026", il formato del foglio. */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const MONTH_NAMES = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** "2026-09" -> "Settembre 2026" */
export function formatMonth(month: string) {
  const [y, m] = month.split("-");
  const name = MONTH_NAMES[Number(m) - 1] ?? m;
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

/** "2026-09" -> "set 26" */
export function formatMonthShort(month: string) {
  const [y, m] = month.split("-");
  return `${(MONTH_NAMES[Number(m) - 1] ?? m).slice(0, 3)} ${y.slice(2)}`;
}

export function monthOf(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function addMonths(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Elenco dei mesi da `from` a `to` inclusi. */
export function monthRange(from: string, to: string) {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 600 && cur <= to; i++) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Ultimo giorno del mese, in ISO. */
export function lastDayOfMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

/** Il giorno `day` del mese, limitato all'ultimo giorno disponibile. */
export function dayInMonth(month: string, day: number) {
  const [y, m] = month.split("-").map(Number);
  const max = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(Math.max(day, 1), max)).padStart(2, "0")}`;
}

/** Accetta "12,50", "12.50", "€ 12,50" e restituisce 12.5. NaN se non e' un numero. */
export function parseAmount(raw: string) {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return Number.NaN;
  return Number(cleaned);
}
