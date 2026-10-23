import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, Field } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Ko'p qatorli matn maydoni; `label` berilmasa, `aria-label` majburiy. */
export function Textarea({ label, hint, error, id, className, rows = 4, ...props }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  return (
    <Field id={textareaId} label={label} hint={hint} error={error}>
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(textareaId, { hint, error })}
        className={cn(controlClasses, "h-auto min-h-24 resize-y py-2 leading-relaxed", className)}
        {...props}
      />
    </Field>
  );
}
