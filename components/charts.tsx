"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CategorySummaryRow } from "@/lib/types";
import type { DayPoint } from "@/lib/calc";
import {
  formatDateShort,
  formatEur,
  formatEurShort,
  formatMonthShort,
  formatSignedEur,
} from "@/lib/format";
import { budgetState, statusColor, cx } from "./ui";

/** Evita il warning di React su useLayoutEffect durante il render sul server. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* --------------------------------------------------------------- primitivi */

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <span
            aria-hidden
            className="block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

/* --------------------------------------------- Budget vs Effettivo (barre) */

export function BudgetVsActualChart({ rows }: { rows: CategorySummaryRow[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const visible = rows.filter((r) => r.budget > 0 || r.actual > 0);
  const max = Math.max(1, ...visible.map((r) => Math.max(r.budget, r.actual)));

  if (!visible.length) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        Nessun budget e nessuna spesa in questo mese.
      </p>
    );
  }

  return (
    <div>
      <Legend
        items={[
          { label: "Budget", color: "var(--series-1)" },
          { label: "Effettivo", color: "var(--series-2)" },
        ]}
      />
      <ul className="mt-4 space-y-1">
        {visible.map((row) => {
          const isHovered = hovered === row.category.id;
          return (
            <li
              key={row.category.id}
              onMouseEnter={() => setHovered(row.category.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(row.category.id)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              className={cx(
                "grid grid-cols-[minmax(5.5rem,7.5rem)_1fr] items-center gap-3 rounded-md px-1.5 py-1.5 outline-none transition-colors sm:grid-cols-[9rem_1fr]",
                isHovered && "bg-sunken",
              )}
            >
              <span className="truncate text-xs text-ink-secondary" title={row.category.name}>
                {row.category.name}
              </span>
              <div className="min-w-0">
                <div className="flex h-2.5 items-center gap-2">
                  <div className="h-full min-w-0 flex-1 rounded-[3px] bg-grid">
                    <div
                      className="h-full rounded-r-[4px]"
                      style={{
                        width: `${Math.max(row.budget > 0 ? 1.5 : 0, (row.budget / max) * 100)}%`,
                        background: "var(--series-1)",
                      }}
                    />
                  </div>
                  <span className="tnum w-20 shrink-0 text-right text-[11px] leading-none text-ink-secondary">
                    {formatEurShort(row.budget)}
                  </span>
                </div>
                {/* 2px di superficie fra le due barre: non si leggono come una sola */}
                <div className="mt-[2px] flex h-2.5 items-center gap-2">
                  <div className="h-full min-w-0 flex-1 rounded-[3px] bg-grid">
                    <div
                      className="h-full rounded-r-[4px]"
                      style={{
                        width: `${Math.max(row.actual > 0 ? 1.5 : 0, (row.actual / max) * 100)}%`,
                        background: "var(--series-2)",
                      }}
                    />
                  </div>
                  <span className="tnum w-20 shrink-0 text-right text-[11px] leading-none text-ink-secondary">
                    {formatEurShort(row.actual)}
                  </span>
                </div>
                {isHovered && (
                  <p className="tnum mt-1 text-[11px] text-ink-muted">
                    Budget {formatEur(row.budget)} · Effettivo {formatEur(row.actual)} · Differenza{" "}
                    <span
                      style={{
                        color:
                          row.difference < 0 ? "var(--critical-text)" : "var(--good-text)",
                      }}
                    >
                      {formatSignedEur(row.difference)}
                    </span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------- distribuzione del budget */

/*
 * Slot categorici in ordine fisso. Sei nominati piu' "Altro": oltre il sesto
 * servirebbero tinte che nell'anello si toccano e non si distinguono piu' —
 * in tema scuro la settima (violetto) accostata alla prima (blu) e' proprio il
 * caso che fallisce. Le categorie oltre la sesta finiscono in "Altro", e
 * restano tutte leggibili nell'elenco sotto.
 */
const SLICE_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];
const OTHER_COLOR = "var(--series-other)";
const OTHER_KEY = "__altro";
const MAX_SLICES = 6;

type Slice = { key: string; label: string; amount: number; color: string; detail?: string };

function breakdown(rows: CategorySummaryRow[]) {
  const withBudget = rows
    .filter((r) => r.budget > 0)
    .sort((a, b) => b.budget - a.budget || a.category.name.localeCompare(b.category.name));
  const total = withBudget.reduce((s, r) => s + r.budget, 0);
  const named = withBudget.slice(0, MAX_SLICES);
  const rest = withBudget.slice(MAX_SLICES);

  const colorOf = new Map<string, string>();
  const sliceOf = new Map<string, string>();
  named.forEach((r, i) => {
    colorOf.set(r.category.id, SLICE_COLORS[i]);
    sliceOf.set(r.category.id, r.category.id);
  });
  rest.forEach((r) => {
    colorOf.set(r.category.id, OTHER_COLOR);
    sliceOf.set(r.category.id, OTHER_KEY);
  });

  const slices: Slice[] = named.map((r, i) => ({
    key: r.category.id,
    label: r.category.name,
    amount: r.budget,
    color: SLICE_COLORS[i],
  }));
  if (rest.length) {
    slices.push({
      key: OTHER_KEY,
      label: "Altro",
      amount: rest.reduce((s, r) => s + r.budget, 0),
      color: OTHER_COLOR,
      detail: rest.map((r) => r.category.name).join(", "),
    });
  }
  return { rows: withBudget, slices, total, colorOf, sliceOf };
}

const VIEW = 240;
const CENTER = VIEW / 2;
const R_OUT = 108;
const R_IN = 66;

function polar(radius: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(a), CENTER + radius * Math.sin(a)] as const;
}

/** Settore ad anello. Un giro completo va accorciato: 360° degenera in un punto. */
function ringSector(start: number, sweep: number) {
  const span = Math.min(sweep, 359.99);
  const end = start + span;
  const [x1, y1] = polar(R_OUT, start);
  const [x2, y2] = polar(R_OUT, end);
  const [x3, y3] = polar(R_IN, end);
  const [x4, y4] = polar(R_IN, start);
  const large = span > 180 ? 1 : 0;
  return `M${x1} ${y1} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${R_IN} ${R_IN} 0 ${large} 0 ${x4} ${y4} Z`;
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export function BudgetDistribution({ rows }: { rows: CategorySummaryRow[] }) {
  const [active, setActive] = useState<string | null>(null);
  const { rows: ranked, slices, total, colorOf, sliceOf } = breakdown(rows);

  if (!total) {
    return <p className="py-8 text-center text-sm text-ink-muted">Nessun budget impostato.</p>;
  }

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.amount / total) * 360;
    const d = ringSector(cursor, sweep);
    cursor += sweep;
    return { slice, d };
  });

  const hovered = slices.find((s) => s.key === active) ?? null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="mx-auto block h-auto w-full max-w-[17rem]"
        role="img"
        aria-label={`Distribuzione del budget: ${slices
          .map((s) => `${s.label} ${pct(s.amount / total)}`)
          .join(", ")}`}
        onMouseLeave={() => setActive(null)}
      >
        {arcs.map(({ slice, d }) => (
          <path
            key={slice.key}
            d={d}
            fill={slice.color}
            /* 2px di superficie fra le fette: non si leggono come un blocco solo */
            stroke="var(--surface)"
            strokeWidth={2}
            opacity={active === null || active === slice.key ? 1 : 0.4}
            onMouseEnter={() => setActive(slice.key)}
          >
            <title>{`${slice.label}: ${formatEur(slice.amount)} (${pct(slice.amount / total)})`}</title>
          </path>
        ))}

        <text
          x={CENTER}
          y={hovered ? CENTER - 14 : CENTER - 10}
          textAnchor="middle"
          fill="var(--ink-secondary)"
          fontSize={11}
        >
          {hovered ? hovered.label : "Budget totale"}
        </text>
        <text
          x={CENTER}
          y={hovered ? CENTER + 6 : CENTER + 12}
          textAnchor="middle"
          fill="var(--ink)"
          fontSize={19}
          fontWeight={600}
        >
          {formatEurShort(hovered ? hovered.amount : total)}
        </text>
        {hovered && (
          <text
            x={CENTER}
            y={CENTER + 24}
            textAnchor="middle"
            fill="var(--ink-secondary)"
            fontSize={12}
          >
            {pct(hovered.amount / total)}
          </text>
        )}
      </svg>

      {/* Elenco completo: fa da legenda e da vista tabellare, cosi' nessuna
          categoria si perde dentro "Altro" e l'identita' non e' solo colore. */}
      <ul className="mt-4 space-y-1">
        {ranked.map((row) => {
          const key = sliceOf.get(row.category.id) ?? OTHER_KEY;
          const dim = active !== null && active !== key;
          return (
            <li
              key={row.category.id}
              onMouseEnter={() => setActive(key)}
              onMouseLeave={() => setActive(null)}
              className={cx(
                "flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors",
                active === key && "bg-sunken",
              )}
              style={{ opacity: dim ? 0.5 : 1 }}
            >
              <span
                aria-hidden
                className="block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ background: colorOf.get(row.category.id) }}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">
                {row.category.name}
                {key === OTHER_KEY && (
                  <span className="ml-1.5 text-[10px] text-ink-muted">in Altro</span>
                )}
              </span>
              <span className="tnum shrink-0 text-xs text-ink">{formatEurShort(row.budget)}</span>
              <span className="tnum w-14 shrink-0 text-right text-xs text-ink-muted">
                {pct(row.budget / total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------ consumo budget in tabella */

export function ConsumedBar({ consumed }: { consumed: number | null }) {
  if (consumed === null) return <span className="text-xs text-ink-muted">–</span>;
  const state = budgetState(consumed);
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 shrink-0 rounded-[3px] bg-grid" aria-hidden>
        <div
          className="h-full rounded-r-[4px]"
          style={{
            width: `${Math.min(100, Math.max(consumed > 0 ? 3 : 0, consumed * 100))}%`,
            background: statusColor(state),
          }}
        />
      </div>
      <span className="tnum w-14 text-right text-xs text-ink">
        {(consumed * 100).toFixed(1).replace(".", ",")}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------- andamento (linee) */

type Point = { month: string; income: number; spent: number; saving: number };

export function IncomeVsSpendChart({ points }: { points: Point[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = 220;
  const pad = { top: 12, right: 12, bottom: 26, left: 54 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.spent]));
  const niceMax = Math.ceil(max / 500) * 500 || 500;
  const x = (i: number) => (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => innerH - (v / niceMax) * innerH;
  const path = (get: (p: Point) => number) =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * niceMax);
  const hit = active !== null ? points[active] : null;

  return (
    <div>
      <Legend
        items={[
          { label: "Entrate", color: "var(--series-1)" },
          { label: "Uscite", color: "var(--series-2)" },
        ]}
      />
      <div ref={ref} className="relative mt-3">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Entrate e uscite per mese"
            onMouseLeave={() => setActive(null)}
          >
            <g transform={`translate(${pad.left},${pad.top})`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={0}
                    x2={innerW}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="var(--grid)"
                    strokeWidth={1}
                  />
                  <text
                    x={-8}
                    y={y(t)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="var(--ink-muted)"
                    fontSize={10}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatEurShort(t)}
                  </text>
                </g>
              ))}
              <line
                x1={0}
                x2={innerW}
                y1={innerH}
                y2={innerH}
                stroke="var(--baseline)"
                strokeWidth={1}
              />

              <path d={path((p) => p.income)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <path d={path((p) => p.spent)} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

              {active !== null && (
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={0}
                  y2={innerH}
                  stroke="var(--baseline)"
                  strokeWidth={1}
                />
              )}

              {points.map((p, i) => (
                <g key={p.month}>
                  {(points.length <= 14 || i === active) && (
                    <>
                      <circle cx={x(i)} cy={y(p.income)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
                      <circle cx={x(i)} cy={y(p.spent)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
                    </>
                  )}
                  {/* Bersaglio del mouse piu' largo del marcatore */}
                  <rect
                    x={x(i) - innerW / Math.max(points.length, 1) / 2}
                    y={0}
                    width={Math.max(12, innerW / Math.max(points.length, 1))}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setActive(i)}
                  />
                  {(points.length <= 8 || i % Math.ceil(points.length / 8) === 0) && (
                    <text
                      x={x(i)}
                      y={innerH + 16}
                      textAnchor="middle"
                      fill="var(--ink-muted)"
                      fontSize={10}
                    >
                      {formatMonthShort(p.month)}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>
        )}
        {hit && (
          <div className="tnum pointer-events-none mt-1 text-xs text-ink-secondary">
            <strong className="font-medium text-ink">{formatMonthShort(hit.month)}</strong> · Entrate{" "}
            {formatEur(hit.income)} · Uscite {formatEur(hit.spent)} · Risparmio{" "}
            <span style={{ color: hit.saving < 0 ? "var(--critical-text)" : "var(--good-text)" }}>
              {formatSignedEur(hit.saving)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------- andamento del mese, per giorno */

export function DailyFlowChart({
  days,
  income,
  todayDay,
}: {
  days: DayPoint[];
  income: number;
  /** Giorno da segnare come "oggi", se il mese mostrato e' quello corrente. */
  todayDay: number | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = 240;
  const pad = { top: 12, right: 12, bottom: 28, left: 58 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const peak = Math.max(
    income,
    ...days.map((d) => Math.max(d.cumulative, d.cumulativeIncome)),
    1,
  );
  const step = peak > 4000 ? 1000 : peak > 1500 ? 500 : peak > 400 ? 100 : 50;
  const niceMax = Math.ceil(peak / step) * step || step;

  const x = (i: number) => (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => innerH - (v / niceMax) * innerH;

  // Nel mese in corso la linea si ferma a oggi: prolungarla piatta fino a fine
  // mese direbbe "da qui in poi non spendo piu'", che non e' un dato.
  const drawn = todayDay ? days.slice(0, Math.min(todayDay, days.length)) : days;
  const spentPath = drawn
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.cumulative).toFixed(1)}`)
    .join(" ");

  // Le entrate salgono a gradino il giorno in cui arriva un'entrata extra: fra
  // un incasso e l'altro la disponibilita' non cambia, quindi il tratto resta
  // orizzontale invece di interpolare valori mai esistiti.
  const incomePath = days
    .map((d, i) => {
      const yy = y(d.cumulativeIncome).toFixed(1);
      if (i === 0) return `M${x(i).toFixed(1)},${yy}`;
      return `L${x(i).toFixed(1)},${y(days[i - 1].cumulativeIncome).toFixed(1)} L${x(i).toFixed(1)},${yy}`;
    })
    .join(" ");
  const hasExtra = days.some((d) => d.earned > 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * niceMax);
  const hit = active !== null ? days[active] : null;
  const last = days[days.length - 1];

  return (
    <div>
      <Legend
        items={[
          { label: "Entrate disponibili", color: "var(--series-1)" },
          { label: "Uscite cumulate", color: "var(--series-2)" },
        ]}
      />
      <div ref={ref} className="relative mt-3">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Uscite cumulate giorno per giorno: a fine periodo ${formatEur(last?.cumulative ?? 0)} su entrate di ${formatEur(income)}`}
            onMouseLeave={() => setActive(null)}
          >
            <g transform={`translate(${pad.left},${pad.top})`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
                  <text
                    x={-8}
                    y={y(t)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="var(--ink-muted)"
                    fontSize={10}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatEurShort(t)}
                  </text>
                </g>
              ))}
              <line
                x1={0}
                x2={innerW}
                y1={innerH}
                y2={innerH}
                stroke="var(--baseline)"
                strokeWidth={1}
              />

              {/* Tratteggiata finche' e' solo la fissa, che una data non ce l'ha;
                  continua quando ci sono entrate extra, che invece sono datate. */}
              <path
                d={incomePath}
                fill="none"
                stroke="var(--series-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeDasharray={hasExtra ? undefined : "5 4"}
              />
              {days.map((d, i) =>
                d.earned > 0 ? (
                  <circle
                    key={`in-${d.day}`}
                    cx={x(i)}
                    cy={y(d.cumulativeIncome)}
                    r={4}
                    fill="var(--series-1)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ) : null,
              )}

              <path
                d={spentPath}
                fill="none"
                stroke="var(--series-2)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {todayDay !== null && (
                <line
                  x1={x(todayDay - 1)}
                  x2={x(todayDay - 1)}
                  y1={0}
                  y2={innerH}
                  stroke="var(--baseline)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              )}

              {active !== null && (
                <>
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={0}
                    y2={innerH}
                    stroke="var(--baseline)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={x(active)}
                    cy={y(days[active].cumulative)}
                    r={4}
                    fill="var(--series-2)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* Un punto solo nei giorni in cui e' stato speso qualcosa */}
              {drawn.map((d, i) =>
                d.spent > 0 && active !== i ? (
                  <circle
                    key={`p-${d.day}`}
                    cx={x(i)}
                    cy={y(d.cumulative)}
                    r={2.5}
                    fill="var(--series-2)"
                  />
                ) : null,
              )}

              {days.map((d, i) => (
                <g key={d.day}>
                  <rect
                    x={x(i) - innerW / Math.max(days.length, 1) / 2}
                    y={0}
                    width={Math.max(10, innerW / Math.max(days.length, 1))}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setActive(i)}
                  />
                  {(d.day === 1 || d.day % 5 === 0) && (
                    <text
                      x={x(i)}
                      y={innerH + 16}
                      textAnchor="middle"
                      fill="var(--ink-muted)"
                      fontSize={10}
                    >
                      {d.day}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>
        )}
        <p className="tnum mt-1 h-4 text-xs text-ink-secondary">
          {hit ? (
            <>
              <strong className="font-medium text-ink">{formatDateShort(hit.date)}</strong> · Speso
              nel giorno {formatEur(hit.spent)}
              {hit.earned > 0 && (
                <> · Entrata extra {formatEur(hit.earned)}</>
              )}{" "}
              · Cumulato {formatEur(hit.cumulative)} · Resta{" "}
              <span
                style={{
                  color:
                    hit.cumulativeIncome - hit.cumulative < 0
                      ? "var(--critical-text)"
                      : "var(--good-text)",
                }}
              >
                {formatEur(hit.cumulativeIncome - hit.cumulative)}
              </span>
            </>
          ) : (
            <>
              {todayDay ? "Finora" : "A fine mese"} {formatEur(last?.cumulative ?? 0)} su{" "}
              {formatEur(last?.cumulativeIncome ?? income)} di entrate.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
