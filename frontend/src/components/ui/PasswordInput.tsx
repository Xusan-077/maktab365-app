"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { controlClasses, describedBy, Field } from "./Field";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Ko'rsatish/yashirish tugmasining nomlari (i18n'dan). */
  showLabel: string;
  hideLabel: string;
}

/** Parol maydoni: ko'rsatish/yashirish tugmasi bilan. */
export function PasswordInput({
  label,
  hint,
  error,
  id,
  className,
  showLabel,
  hideLabel,
  ...props
}: PasswordInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <Field id={inputId} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, { hint, error })}
          className={cn(controlClasses, "pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={inputId}
          className="text-muted hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg"
        >
          <Icon className="size-4" aria-hidden />
        </button>
      </div>
    </Field>
  );
}
