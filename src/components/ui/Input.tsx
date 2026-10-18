import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, Field } from "./Field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** `label` berilmasa, `aria-label` majburiy. */
export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, { hint, error })}
        className={cn(controlClasses, className)}
        {...props}
      />
    </Field>
  );
}
