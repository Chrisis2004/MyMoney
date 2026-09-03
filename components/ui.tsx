"use client";

import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cx("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";

const buttonVariants = {
  primary: "bg-ink text-page hover:opacity-90",
  secondary: "border border-hairline-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink-secondary hover:bg-sunken hover:text-ink",
  danger: "border border-hairline-strong text-critical-text hover:bg-sunken",
} as const;

const buttonSizes = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      type="button"
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

/** Stessa resa di Button, ma per un vero link: serve per i download. */
export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  disabled,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  disabled?: boolean;
}) {
  const classes = cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
  if (disabled) {
    return (
      <span aria-disabled className={cx(classes, "cursor-not-allowed opacity-45")}>
        {props.children}
      </span>
    );
  }
  return <a className={classes} {...props} />;
}

// Nessuna larghezza qui: la impone chi usa il campo. Field allarga i propri
// controlli, altrove si dichiara una larghezza esplicita.
const fieldBase =
  "rounded-lg border border-hairline-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldBase, "h-9", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldBase, "h-9", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block [&>input]:w-full [&>select]:w-full", className)}>
      <span className="mb-1 block text-xs font-medium text-ink-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>}
    </label>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline-strong px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs text-ink-secondary">{hint}</p>}
    </div>
  );
}

/**
 * Stato del budget di una categoria. Il colore non porta mai il significato da
 * solo: e' sempre accompagnato dall'icona e dall'etichetta testuale.
 */
export type BudgetState = "ok" | "near" | "over" | "none";

export function budgetState(consumed: number | null): BudgetState {
  if (consumed === null) return "none";
  if (consumed > 1) return "over";
  if (consumed >= 0.8) return "near";
  return "ok";
}

const STATE_META: Record<BudgetState, { icon: string; label: string; color: string }> = {
  ok: { icon: "●", label: "Nel budget", color: "var(--good)" },
  near: { icon: "▲", label: "Quasi esaurito", color: "var(--warning)" },
  over: { icon: "■", label: "Fuori budget", color: "var(--critical)" },
  none: { icon: "–", label: "Nessun budget", color: "var(--ink-muted)" },
};

export function StatusPill({ state }: { state: BudgetState }) {
  const meta = STATE_META[state];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-secondary">
      <span aria-hidden style={{ color: meta.color }}>
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

export function statusColor(state: BudgetState) {
  return STATE_META[state].color;
}
