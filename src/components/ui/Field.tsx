import type { ReactNode } from "react";

/** Input va Select uchun umumiy stil. */
export const controlClasses =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted hover:border-primary-300 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger";

interface FieldProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

export function describedBy(id: string, { hint, error }: { hint?: ReactNode; error?: ReactNode }) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-foreground text-sm font-medium">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-danger text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
