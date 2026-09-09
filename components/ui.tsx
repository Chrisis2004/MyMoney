"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

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
}: React.ComponentPropsWithRef<"button"> & {
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

/**
 * Conferma bloccante per le azioni distruttive. Non si chiude da sola: o si
 * conferma o si annulla (Esc e clic fuori equivalgono ad Annulla). Il focus
 * parte da Annulla, cosi' un Invio battuto per inerzia non cancella nulla.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = "Elimina",
  cancelLabel = "Annulla",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  // Il focus non esce dal dialogo: i due pulsanti sono i suoi unici elementi.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    (document.activeElement === cancelRef.current ? confirmRef : cancelRef).current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      onKeyDown={trapTab}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-md rounded-xl border border-hairline-strong bg-surface p-5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]"
      >
        <h2 id={titleId} className="text-sm font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <div id={bodyId} className="mt-2 space-y-1.5">
          <p className="text-sm leading-relaxed text-ink-secondary">{message}</p>
          {detail && <p className="text-xs leading-relaxed text-ink-muted">{detail}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} size="sm" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} size="sm" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
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
