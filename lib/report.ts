import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  HeightRule,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { AppData, CategorySummaryRow, Transaction } from "./types";
import {
  categoryMap,
  categorySummary,
  dailyFlow,
  extraIncomesOfMonth,
  monthTotals,
  splitByAccounting,
  transactionsOfMonth,
} from "./calc";
import { formatDate, formatEur, formatMonth, formatPct, formatSignedEur } from "./format";

/* ------------------------------------------------------------------ colori */

/*
 * Gli stessi valori del tema chiaro dell'app: il documento si legge su carta
 * bianca, quindi si usa quella variante. I sei slot categorici sono nell'ordine
 * fisso validato per il daltonismo, con il neutro riservato alla voce "Altro".
 */
const INK = "0B0B0B";
const INK_SECONDARY = "52514E";
const MUTED = "898781";
const RULE = "D9D8D2";
const BAND = "F4F3EF";
const HEADER_BAND = "E9E7E0";
const POSITIVE = "006300";
const NEGATIVE = "B02F2F";
const WARNING = "9A6800";

const SERIES_BUDGET = "2A78D6";
const SERIES_ACTUAL = "EB6834";
const SLICE_COLORS = ["2A78D6", "EB6834", "1BAF7A", "EDA100", "E87BA4", "008300"];
const OTHER_COLOR = "898781";
const MAX_SLICES = 6;

/* ---------------------------------------------------------------- primitivi */

/** Larghezza dell'area stampabile: A4 meno i margini laterali, in twip. */
const CONTENT_WIDTH = 9026;
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const noBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const ruleBottom = {
  ...noBorders,
  bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
};

function run(
  value: string,
  o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {},
) {
  return new TextRun({
    text: value,
    bold: o.bold,
    italics: o.italics,
    color: o.color ?? INK,
    size: o.size ?? 19,
  });
}

function para(
  value: string,
  o: {
    bold?: boolean;
    color?: string;
    size?: number;
    right?: boolean;
    center?: boolean;
    before?: number;
    after?: number;
  } = {},
) {
  return new Paragraph({
    alignment: o.right ? AlignmentType.RIGHT : o.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: o.before ?? 0, after: o.after ?? 0 },
    children: [run(value, o)],
  });
}

type CellOpts = {
  bold?: boolean;
  color?: string;
  size?: number;
  right?: boolean;
  fill?: string;
  width?: number;
  borders?: typeof noBorders;
  span?: number;
};

function cell(value: string, o: CellOpts = {}) {
  return new TableCell({
    borders: o.borders ?? ruleBottom,
    columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [para(value, o)],
  });
}

function table(rows: TableRow[], columnWidths: number[]) {
  return new Table({
    rows,
    columnWidths,
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: noBorders,
  });
}

function headerRow(labels: { label: string; right?: boolean; width: number }[]) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l) =>
      cell(l.label, {
        bold: true,
        right: l.right,
        fill: HEADER_BAND,
        width: l.width,
        size: 17,
        color: INK_SECONDARY,
        borders: noBorders,
      }),
    ),
  });
}

/**
 * Una barra orizzontale: una tabella annidata di due celle, la prima colorata
 * e larga in proporzione al valore. Word la ridisegna alla stampa senza
 * sgranare, e resta modificabile — cosa che un'immagine non permette.
 */
function bar(fraction: number, color: string, width: number) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(clamped * width);
  // Sotto una soglia la barra sparirebbe: le si lascia una larghezza minima
  // percepibile, altrimenti un importo piccolo si legge come zero.
  const shown = clamped > 0 ? Math.max(filled, 45) : 0;
  const cells: TableCell[] = [];
  if (shown > 0) {
    cells.push(
      new TableCell({
        borders: noBorders,
        width: { size: shown, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: color, color: "auto" },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [new Paragraph({ children: [] })],
      }),
    );
  }
  if (shown < width) {
    cells.push(
      new TableCell({
        borders: noBorders,
        width: { size: width - shown, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: BAND, color: "auto" },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [new Paragraph({ children: [] })],
      }),
    );
  }
  return new Table({
    rows: [
      new TableRow({ height: { value: 130, rule: HeightRule.EXACT }, children: cells }),
    ],
    columnWidths: cells.map((_, i) => (i === 0 && shown > 0 ? shown : width - shown)),
    layout: TableLayoutType.FIXED,
    width: { size: width, type: WidthType.DXA },
    borders: noBorders,
  });
}

function barCell(fraction: number, color: string, width: number) {
  return new TableCell({
    borders: ruleBottom,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: [bar(fraction, color, width - 220)],
  });
}

/** Pastiglia colorata usata come voce di legenda. */
function swatch(color: string) {
  return new Table({
    rows: [
      new TableRow({
        height: { value: 120, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 130, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: color, color: "auto" },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
    columnWidths: [130],
    layout: TableLayoutType.FIXED,
    width: { size: 130, type: WidthType.DXA },
    borders: noBorders,
  });
}

function heading(value: string) {
  return new Paragraph({
    spacing: { before: 400, after: 60 },
    children: [run(value, { bold: true, size: 26 })],
  });
}

function caption(value: string) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [run(value, { color: INK_SECONDARY, size: 17 })],
  });
}

function gap(after = 160) {
  return new Paragraph({ spacing: { after }, children: [] });
}

/* ------------------------------------------------------------------ sezioni */

function statBand(label: string, value: string, hint: string, color: string, width: number) {
  return new TableCell({
    borders: noBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: BAND, color: "auto" },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    children: [
      para(label, { color: INK_SECONDARY, size: 16 }),
      new Paragraph({
        spacing: { before: 40, after: 30 },
        children: [run(value, { bold: true, size: 30, color })],
      }),
      para(hint, { color: MUTED, size: 15 }),
    ],
  });
}

/** Stato del budget: icona piu' etichetta, mai il colore da solo. */
function budgetState(consumed: number | null) {
  if (consumed === null) return { label: "– Nessun budget", color: MUTED };
  if (consumed > 1) return { label: "■ Fuori budget", color: NEGATIVE };
  if (consumed >= 0.8) return { label: "▲ Quasi esaurito", color: WARNING };
  return { label: "● Nel budget", color: POSITIVE };
}

function budgetVsActualChart(rows: CategorySummaryRow[]) {
  const visible = rows.filter((r) => r.budget > 0 || r.actual > 0);
  if (!visible.length) return [caption("Nessun budget e nessuna spesa in questo mese.")];

  const max = Math.max(1, ...visible.map((r) => Math.max(r.budget, r.actual)));
  const widths = [2100, 4826, 1050, 1050];
  const out: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Categoria", { bold: true, fill: HEADER_BAND, width: widths[0], size: 17, color: INK_SECONDARY, borders: noBorders }),
        cell("", { fill: HEADER_BAND, width: widths[1], borders: noBorders }),
        cell("Budget", { bold: true, right: true, fill: HEADER_BAND, width: widths[2], size: 17, color: INK_SECONDARY, borders: noBorders }),
        cell("Effettivo", { bold: true, right: true, fill: HEADER_BAND, width: widths[3], size: 17, color: INK_SECONDARY, borders: noBorders }),
      ],
    }),
  ];

  for (const r of visible) {
    // Due righe per categoria, senza filo di separazione fra le due: si leggono
    // come una coppia, budget sopra ed effettivo sotto.
    out.push(
      new TableRow({
        children: [
          cell(r.category.name, { width: widths[0], borders: noBorders }),
          barCell(r.budget / max, SERIES_BUDGET, widths[1]),
          cell(formatEur(r.budget), { right: true, width: widths[2], size: 17, color: INK_SECONDARY, borders: noBorders }),
          cell("", { width: widths[3], borders: noBorders }),
        ],
      }),
      new TableRow({
        children: [
          cell("", { width: widths[0] }),
          barCell(r.actual / max, SERIES_ACTUAL, widths[1]),
          cell("", { width: widths[2] }),
          cell(formatEur(r.actual), { right: true, width: widths[3], size: 17, color: INK_SECONDARY }),
        ],
      }),
    );
  }

  return [
    new Paragraph({
      spacing: { after: 140 },
      children: [
        run("■ ", { color: SERIES_BUDGET, size: 22 }),
        run("Budget    ", { color: INK_SECONDARY, size: 17 }),
        run("■ ", { color: SERIES_ACTUAL, size: 22 }),
        run("Effettivo", { color: INK_SECONDARY, size: 17 }),
      ],
    }),
    table(out, widths),
  ];
}

function distributionChart(rows: CategorySummaryRow[]) {
  const withBudget = rows
    .filter((r) => r.budget > 0)
    .sort((a, b) => b.budget - a.budget || a.category.name.localeCompare(b.category.name));
  const total = withBudget.reduce((s, r) => s + r.budget, 0);
  if (!total) return [caption("Nessun budget impostato per questo mese.")];

  const named = withBudget.slice(0, MAX_SLICES);
  const rest = withBudget.slice(MAX_SLICES);
  const slices = named.map((r, i) => ({
    label: r.category.name,
    amount: r.budget,
    color: SLICE_COLORS[i],
  }));
  if (rest.length) {
    slices.push({
      label: `Altro (${rest.map((r) => r.category.name).join(", ")})`,
      amount: rest.reduce((s, r) => s + r.budget, 0),
      color: OTHER_COLOR,
    });
  }

  // Barra unica al 100%, una fetta per voce: e' la torta srotolata, leggibile
  // anche quando le fette piccole sono molte.
  const widths = slices.map((s) => Math.max(60, Math.round((s.amount / total) * CONTENT_WIDTH)));
  const stacked = new Table({
    rows: [
      new TableRow({
        height: { value: 260, rule: HeightRule.EXACT },
        children: slices.map(
          (s, i) =>
            new TableCell({
              borders: noBorders,
              width: { size: widths[i], type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: s.color, color: "auto" },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [new Paragraph({ children: [] })],
            }),
        ),
      }),
    ],
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: noBorders,
  });

  const legendWidths = [400, 5376, 1600, 1650];
  const legend = table(
    withBudget.map((r, i) => {
      const color = i < MAX_SLICES ? SLICE_COLORS[i] : OTHER_COLOR;
      return new TableRow({
        children: [
          new TableCell({
            borders: ruleBottom,
            width: { size: legendWidths[0], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 70, bottom: 70, left: 0, right: 60 },
            children: [swatch(color)],
          }),
          cell(r.category.name + (i >= MAX_SLICES ? "  (in Altro)" : ""), {
            width: legendWidths[1],
          }),
          cell(formatEur(r.budget), { right: true, width: legendWidths[2] }),
          cell(formatPct(r.budget / total), {
            right: true,
            width: legendWidths[3],
            color: INK_SECONDARY,
          }),
        ],
      });
    }),
    legendWidths,
  );

  return [stacked, gap(180), legend];
}

function dailyChart(data: AppData, month: string) {
  const days = dailyFlow(data, month).filter((d) => d.spent > 0 || d.earned > 0);
  if (!days.length) return [caption("Nessun movimento registrato in questo mese.")];

  const max = Math.max(1, ...days.map((d) => d.spent));
  const w = [1000, 3626, 1400, 1500, 1500];
  return [
    table(
      [
        headerRow([
          { label: "Giorno", width: w[0] },
          { label: "", width: w[1] },
          { label: "Speso", right: true, width: w[2] },
          { label: "Entrate extra", right: true, width: w[3] },
          { label: "Cumulato", right: true, width: w[4] },
        ]),
        ...days.map(
          (d) =>
            new TableRow({
              children: [
                cell(formatDate(d.date).slice(0, 5), { width: w[0], color: INK_SECONDARY }),
                barCell(d.spent / max, SERIES_ACTUAL, w[1]),
                cell(formatEur(d.spent), { right: true, width: w[2] }),
                cell(d.earned > 0 ? formatEur(d.earned) : "—", {
                  right: true,
                  width: w[3],
                  color: d.earned > 0 ? POSITIVE : MUTED,
                  bold: d.earned > 0,
                }),
                cell(formatEur(d.cumulative), { right: true, width: w[4], color: INK_SECONDARY }),
              ],
            }),
        ),
      ],
      w,
    ),
  ];
}

/* ------------------------------------------------------------- il documento */

export async function buildMonthReport(data: AppData, month: string): Promise<Buffer> {
  const totals = monthTotals(data, month);
  const rows = categorySummary(data, month);
  const cats = categoryMap(data);
  const extras = extraIncomesOfMonth(data, month);
  const { counted, excluded } = splitByAccounting(transactionsOfMonth(data, month));
  const savingRate = totals.income > 0 ? totals.netSaving / totals.income : 0;
  const actualTotal = totals.spent + totals.saved;

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 20 },
      children: [run(`Budget mensile — ${formatMonth(month)}`, { bold: true, size: 40 })],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        run(`Documento generato il ${formatDate(new Date().toISOString().slice(0, 10))}`, {
          color: MUTED,
          size: 17,
        }),
      ],
    }),

    table(
      [
        new TableRow({
          children: [
            statBand(
              "Entrate",
              formatEur(totals.income),
              totals.extraIncome > 0
                ? `${formatEur(totals.baseIncome)} fisse + ${formatEur(totals.extraIncome)} extra`
                : "Solo entrate fisse",
              INK,
              2256,
            ),
            new TableCell({ borders: noBorders, width: { size: 60, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
            statBand(
              "Uscite",
              formatEur(totals.spent),
              `${totals.transactionCount} movimenti registrati`,
              INK,
              2256,
            ),
            new TableCell({ borders: noBorders, width: { size: 60, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
            statBand(
              "Non contabilizzate",
              formatEur(totals.excluded),
              totals.excludedCount
                ? `${totals.excludedCount} movimenti fuori budget`
                : "Nessun movimento straordinario",
              INK,
              2167,
            ),
            new TableCell({ borders: noBorders, width: { size: 60, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
            statBand(
              "Resta",
              formatEur(totals.leftover),
              `Tasso di risparmio ${formatPct(savingRate)}`,
              totals.leftover < 0 ? NEGATIVE : POSITIVE,
              2167,
            ),
          ],
        }),
      ],
      [2256, 60, 2256, 60, 2167, 60, 2167],
    ),
  ];

  if (totals.excluded > 0) {
    children.push(
      gap(80),
      caption(
        "«Resta» è una lettura del budget e non sottrae i movimenti non contabilizzati.",
      ),
    );
  }

  children.push(
    heading("Budget contro effettivo"),
    caption("Quanto era previsto e quanto è stato speso, categoria per categoria."),
    ...budgetVsActualChart(rows),

    heading("Distribuzione del budget"),
    caption(`Come sono ripartiti i ${formatEur(totals.budget)} pianificati per il mese.`),
    ...distributionChart(rows),

    heading("Andamento del mese"),
    caption("Solo i giorni con movimenti. «Cumulato» è la spesa dall'inizio del mese."),
    ...dailyChart(data, month),
  );

  /* Riepilogo per categoria */
  const sumWidths = [2000, 1300, 1300, 1400, 1200, 1826];
  children.push(
    heading("Riepilogo per categoria"),
    table(
      [
        headerRow([
          { label: "Categoria", width: sumWidths[0] },
          { label: "Budget", right: true, width: sumWidths[1] },
          { label: "Effettivo", right: true, width: sumWidths[2] },
          { label: "Differenza", right: true, width: sumWidths[3] },
          { label: "Consumato", right: true, width: sumWidths[4] },
          { label: "Stato", width: sumWidths[5] },
        ]),
        ...rows.map((r, i) => {
          const state = budgetState(r.consumed);
          const band = i % 2 === 1 ? BAND : undefined;
          return new TableRow({
            children: [
              cell(r.category.name + (r.category.kind === "saving" ? " (accant.)" : ""), {
                width: sumWidths[0],
                fill: band,
              }),
              cell(formatEur(r.budget), { right: true, width: sumWidths[1], fill: band, color: INK_SECONDARY }),
              cell(formatEur(r.actual), { right: true, width: sumWidths[2], fill: band }),
              cell(formatSignedEur(r.difference), {
                right: true,
                width: sumWidths[3],
                fill: band,
                color: r.difference < 0 ? NEGATIVE : INK_SECONDARY,
              }),
              cell(r.consumed === null ? "–" : formatPct(r.consumed), {
                right: true,
                width: sumWidths[4],
                fill: band,
              }),
              cell(state.label, { width: sumWidths[5], fill: band, color: state.color, size: 17 }),
            ],
          });
        }),
        new TableRow({
          children: [
            cell("Totale", { bold: true, width: sumWidths[0], fill: HEADER_BAND, borders: noBorders }),
            cell(formatEur(totals.budget), { bold: true, right: true, width: sumWidths[1], fill: HEADER_BAND, borders: noBorders }),
            cell(formatEur(actualTotal), { bold: true, right: true, width: sumWidths[2], fill: HEADER_BAND, borders: noBorders }),
            cell(formatSignedEur(totals.budget - actualTotal), {
              bold: true,
              right: true,
              width: sumWidths[3],
              fill: HEADER_BAND,
              borders: noBorders,
              color: totals.budget - actualTotal < 0 ? NEGATIVE : INK,
            }),
            cell(totals.budget > 0 ? formatPct(actualTotal / totals.budget) : "–", {
              bold: true,
              right: true,
              width: sumWidths[4],
              fill: HEADER_BAND,
              borders: noBorders,
            }),
            cell("", { width: sumWidths[5], fill: HEADER_BAND, borders: noBorders }),
          ],
        }),
      ],
      sumWidths,
    ),
  );

  /* Entrate extra */
  if (extras.length) {
    const w = [1400, 3626, 1600, 2400];
    children.push(
      heading("Entrate extra"),
      caption("Entrate occasionali con una data: regali, aiuti, rimborsi."),
      table(
        [
          headerRow([
            { label: "Data", width: w[0] },
            { label: "Descrizione", width: w[1] },
            { label: "Importo", right: true, width: w[2] },
            { label: "Note", width: w[3] },
          ]),
          ...extras.map(
            (e, i) =>
              new TableRow({
                children: [
                  cell(formatDate(e.date), { width: w[0], fill: i % 2 ? BAND : undefined, color: INK_SECONDARY }),
                  cell(e.description, { width: w[1], fill: i % 2 ? BAND : undefined }),
                  cell(formatEur(e.amount), { right: true, width: w[2], fill: i % 2 ? BAND : undefined, color: POSITIVE, bold: true }),
                  cell(e.note ?? "", { width: w[3], fill: i % 2 ? BAND : undefined, color: MUTED, size: 17 }),
                ],
              }),
          ),
          new TableRow({
            children: [
              cell("Totale", { bold: true, width: w[0], fill: HEADER_BAND, borders: noBorders }),
              cell("", { width: w[1], fill: HEADER_BAND, borders: noBorders }),
              cell(formatEur(totals.extraIncome), { bold: true, right: true, width: w[2], fill: HEADER_BAND, borders: noBorders, color: POSITIVE }),
              cell("", { width: w[3], fill: HEADER_BAND, borders: noBorders }),
            ],
          }),
        ],
        w,
      ),
    );
  }

  /* Movimenti */
  const mw = [1200, 2600, 1500, 1400, 2326];
  const movements = (items: Transaction[], total: number) =>
    table(
      [
        headerRow([
          { label: "Data", width: mw[0] },
          { label: "Descrizione", width: mw[1] },
          { label: "Categoria", width: mw[2] },
          { label: "Importo", right: true, width: mw[3] },
          { label: "Note", width: mw[4] },
        ]),
        ...[...items]
          .sort((a, b) =>
            a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
          )
          .map((t, i) => {
            const band = i % 2 === 1 ? BAND : undefined;
            return new TableRow({
              children: [
                cell(formatDate(t.date), { width: mw[0], fill: band, color: INK_SECONDARY }),
                cell(t.description, { width: mw[1], fill: band }),
                cell(cats.get(t.categoryId)?.name ?? "—", { width: mw[2], fill: band, color: INK_SECONDARY }),
                cell(formatEur(t.amount), { right: true, width: mw[3], fill: band }),
                cell(t.note ?? "", { width: mw[4], fill: band, color: MUTED, size: 17 }),
              ],
            });
          }),
        new TableRow({
          children: [
            cell("Totale", { bold: true, width: mw[0], fill: HEADER_BAND, borders: noBorders }),
            cell("", { width: mw[1], fill: HEADER_BAND, borders: noBorders }),
            cell("", { width: mw[2], fill: HEADER_BAND, borders: noBorders }),
            cell(formatEur(total), { bold: true, right: true, width: mw[3], fill: HEADER_BAND, borders: noBorders }),
            cell("", { width: mw[4], fill: HEADER_BAND, borders: noBorders }),
          ],
        }),
      ],
      mw,
    );

  children.push(heading("Movimenti"));
  if (counted.length) {
    children.push(movements(counted, actualTotal));
  } else {
    children.push(caption("Nessun movimento registrato in questo mese."));
  }

  if (excluded.length) {
    children.push(
      heading("Movimenti non contabilizzati"),
      caption("Spese straordinarie tenute fuori dal budget del mese."),
      movements(excluded, totals.excluded),
    );
  }

  const doc = new Document({
    creator: "Gestione risparmio",
    title: `Budget mensile — ${formatMonth(month)}`,
    description: "Riepilogo mensile generato dall'app Gestione risparmio.",
    styles: { default: { document: { run: { font: "Calibri", size: 19, color: INK } } } },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.7),
              bottom: convertInchesToTwip(0.7),
              left: convertInchesToTwip(0.7),
              right: convertInchesToTwip(0.7),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  run(`Budget mensile — ${formatMonth(month)}    `, {
                    color: MUTED,
                    size: 15,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
                    color: MUTED,
                    size: 15,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/** Nome file leggibile, per esempio "Budget mensile - Settembre 2026.docx". */
export function reportFileName(month: string) {
  return `Budget mensile - ${formatMonth(month)}.docx`;
}
