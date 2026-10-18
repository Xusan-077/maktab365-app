import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, Field } from "./Field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Native `<select>` — klaviatura va ekran o'qigichlar bilan to'liq mos. `label` berilmasa, `aria-label` majburiy. */
export function Select({ label, hint, error, id, className, children, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <Field id={selectId} label={label} hint={hint} error={error}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, { hint, error })}
          className={cn(controlClasses, "cursor-pointer appearance-none pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="text-muted pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
          aria-hidden
        />
      </div>
    </Field>
  );
}
