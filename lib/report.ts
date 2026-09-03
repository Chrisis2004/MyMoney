import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { AppData } from "./types";
import {
  categorySummary,
  extraIncomesOfMonth,
  monthTotals,
  splitByAccounting,
  transactionsOfMonth,
  categoryMap,
} from "./calc";
import { formatDate, formatEur, formatMonth, formatPct, formatSignedEur } from "./format";

const INK = "0B0B0B";
const MUTED = "52514E";
const HEADER_FILL = "F2F1ED";
const HAIRLINE = "D9D8D2";
const NEGATIVE = "B02F2F";

const hairline = { style: BorderStyle.SINGLE, size: 4, color: HAIRLINE } as const;
const cellBorders = {
  top: hairline,
  bottom: hairline,
  left: hairline,
  right: hairline,
};

function text(value: string, opts: { bold?: boolean; color?: string; size?: number } = {}) {
  return new TextRun({
    text: value,
    bold: opts.bold,
    color: opts.color ?? INK,
    size: opts.size ?? 20, // mezzi punti: 20 = 10pt
  });
}

function cell(
  value: string,
  opts: { bold?: boolean; color?: string; right?: boolean; fill?: string } = {},
) {
  return new TableCell({
    borders: cellBorders,
    shading: opts.fill ? { fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [text(value, { bold: opts.bold, color: opts.color })],
      }),
    ],
  });
}

function headerRow(labels: { label: string; right?: boolean }[]) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l) =>
      cell(l.label, { bold: true, right: l.right, fill: HEADER_FILL }),
    ),
  });
}

function table(rows: TableRow[]) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function heading(value: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 140 },
    children: [text(value, { bold: true, size: 26 })],
  });
}

function note(value: string) {
  return new Paragraph({
    spacing: { after: 140 },
    children: [text(value, { color: MUTED, size: 18 })],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

/** Il riepilogo del mese come lo si vede a schermo, in un documento Word. */
export async function buildMonthReport(data: AppData, month: string): Promise<Buffer> {
  const totals = monthTotals(data, month);
  const rows = categorySummary(data, month);
  const cats = categoryMap(data);
  const extras = extraIncomesOfMonth(data, month);
  const { counted, excluded } = splitByAccounting(transactionsOfMonth(data, month));
  const savingRate = totals.income > 0 ? totals.netSaving / totals.income : 0;

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
      children: [text(`Budget mensile — ${formatMonth(month)}`, { bold: true, size: 36 })],
    }),
    note(`Documento generato il ${formatDate(new Date().toISOString().slice(0, 10))}.`),

    heading("In sintesi"),
    table([
      headerRow([{ label: "Voce" }, { label: "Importo", right: true }]),
      new TableRow({
        children: [
          cell("Entrate fisse"),
          cell(formatEur(totals.baseIncome), { right: true }),
        ],
      }),
      new TableRow({
        children: [cell("Entrate extra"), cell(formatEur(totals.extraIncome), { right: true })],
      }),
      new TableRow({
        children: [
          cell("Entrate totali", { bold: true }),
          cell(formatEur(totals.income), { bold: true, right: true }),
        ],
      }),
      new TableRow({
        children: [cell("Uscite contabilizzate"), cell(formatEur(totals.spent), { right: true })],
      }),
      new TableRow({
        children: [cell("Accantonato"), cell(formatEur(totals.saved), { right: true })],
      }),
      new TableRow({
        children: [
          cell("Movimenti non contabilizzati"),
          cell(formatEur(totals.excluded), { right: true }),
        ],
      }),
      new TableRow({
        children: [
          cell("Resta", { bold: true }),
          cell(formatEur(totals.leftover), {
            bold: true,
            right: true,
            color: totals.leftover < 0 ? NEGATIVE : INK,
          }),
        ],
      }),
      new TableRow({
        children: [cell("Tasso di risparmio"), cell(formatPct(savingRate), { right: true })],
      }),
    ]),
    spacer(),
    note(
      totals.excluded > 0
        ? "«Resta» è una lettura del budget e non sottrae i movimenti non contabilizzati."
        : "Il budget pianificato per il mese è di " + formatEur(totals.budget) + ".",
    ),

    heading("Riepilogo per categoria"),
    table([
      headerRow([
        { label: "Categoria" },
        { label: "Budget", right: true },
        { label: "Effettivo", right: true },
        { label: "Differenza", right: true },
        { label: "Consumato", right: true },
      ]),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [
              cell(r.category.name + (r.category.kind === "saving" ? " (accantonamento)" : "")),
              cell(formatEur(r.budget), { right: true }),
              cell(formatEur(r.actual), { right: true }),
              cell(formatSignedEur(r.difference), {
                right: true,
                color: r.difference < 0 ? NEGATIVE : INK,
              }),
              cell(r.consumed === null ? "–" : formatPct(r.consumed), {
                right: true,
                color: r.consumed !== null && r.consumed > 1 ? NEGATIVE : INK,
              }),
            ],
          }),
      ),
      new TableRow({
        children: [
          cell("Totale", { bold: true, fill: HEADER_FILL }),
          cell(formatEur(totals.budget), { bold: true, right: true, fill: HEADER_FILL }),
          cell(formatEur(totals.spent + totals.saved), {
            bold: true,
            right: true,
            fill: HEADER_FILL,
          }),
          cell(formatSignedEur(totals.budget - totals.spent - totals.saved), {
            bold: true,
            right: true,
            fill: HEADER_FILL,
            color: totals.budget - totals.spent - totals.saved < 0 ? NEGATIVE : INK,
          }),
          cell(
            totals.budget > 0 ? formatPct((totals.spent + totals.saved) / totals.budget) : "–",
            { bold: true, right: true, fill: HEADER_FILL },
          ),
        ],
      }),
    ]),
  ];

  if (extras.length) {
    children.push(
      heading("Entrate extra"),
      table([
        headerRow([
          { label: "Data" },
          { label: "Descrizione" },
          { label: "Importo", right: true },
          { label: "Note" },
        ]),
        ...extras.map(
          (e) =>
            new TableRow({
              children: [
                cell(formatDate(e.date)),
                cell(e.description),
                cell(formatEur(e.amount), { right: true }),
                cell(e.note ?? ""),
              ],
            }),
        ),
        new TableRow({
          children: [
            cell("Totale", { bold: true, fill: HEADER_FILL }),
            cell("", { fill: HEADER_FILL }),
            cell(formatEur(totals.extraIncome), { bold: true, right: true, fill: HEADER_FILL }),
            cell("", { fill: HEADER_FILL }),
          ],
        }),
      ]),
    );
  }

  const movementTable = (items: typeof counted, total: number) =>
    table([
      headerRow([
        { label: "Data" },
        { label: "Descrizione" },
        { label: "Categoria" },
        { label: "Importo", right: true },
        { label: "Note" },
      ]),
      ...[...items]
        .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))
        .map(
          (t) =>
            new TableRow({
              children: [
                cell(formatDate(t.date)),
                cell(t.description),
                cell(cats.get(t.categoryId)?.name ?? "—"),
                cell(formatEur(t.amount), { right: true }),
                cell(t.note ?? ""),
              ],
            }),
        ),
      new TableRow({
        children: [
          cell("Totale", { bold: true, fill: HEADER_FILL }),
          cell("", { fill: HEADER_FILL }),
          cell("", { fill: HEADER_FILL }),
          cell(formatEur(total), { bold: true, right: true, fill: HEADER_FILL }),
          cell("", { fill: HEADER_FILL }),
        ],
      }),
    ]);

  children.push(heading("Movimenti"));
  if (counted.length) {
    children.push(movementTable(counted, totals.spent + totals.saved));
  } else {
    children.push(note("Nessun movimento registrato in questo mese."));
  }

  if (excluded.length) {
    children.push(
      heading("Movimenti non contabilizzati"),
      note("Spese straordinarie tenute fuori dal budget del mese."),
      movementTable(excluded, totals.excluded),
    );
  }

  const doc = new Document({
    creator: "Gestione risparmio",
    title: `Budget mensile — ${formatMonth(month)}`,
    description: "Riepilogo mensile generato dall'app Gestione risparmio.",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20, color: INK } },
      },
    },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

/** Nome file leggibile, per esempio "Budget mensile - Settembre 2026.docx". */
export function reportFileName(month: string) {
  return `Budget mensile - ${formatMonth(month)}.docx`;
}
