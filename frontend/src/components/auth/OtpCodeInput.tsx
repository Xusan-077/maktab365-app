"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import {
  applyBackspace,
  applyInput,
  codeOf,
  emptyCells,
  isComplete,
  OTP_LENGTH,
  type OtpCells,
} from "@/lib/auth/otp";
import { cn } from "@/lib/utils/cn";

export interface OtpCodeInputProps {
  /** 6 xona to'lganda chaqiriladi. */
  onComplete: (code: string) => void;
  /** Har o'zgarishda joriy kod (to'liq bo'lmasligi mumkin): tugmani yoqish/o'chirish uchun. */
  onCodeChange?: (code: string) => void;
  /** Xato xabarining id'si (`aria-describedby`). */
  describedBy?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Guruh nomi (ekran o'qigich uchun). */
  label: string;
}

/**
 * 6 ta katakli kod kiritish: birinchi katakka avtomatik fokus, raqamdan keyin keyingisiga o'tish,
 * Backspace/o'q tugmalari, qo'yish va SMS/email avtoto'ldirish (`autocomplete="one-time-code"`).
 * Qayta boshlash uchun tashqaridan `key` o'zgartiriladi.
 */
export function OtpCodeInput({
  onComplete,
  onCodeChange,
  describedBy,
  disabled,
  invalid,
  label,
}: OtpCodeInputProps) {
  const t = useTranslations("authForm.otp");
  const [cells, setCells] = useState<OtpCells>(emptyCells);
  // Tez yozishda (avtoto'ldirish, Playwright) keyingi tugma render'dan oldin keladi: holat shu yerda.
  const latest = useRef<OtpCells>(cells);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const store = (next: OtpCells, focus: number) => {
    latest.current = next;
    setCells(next);
    onCodeChange?.(codeOf(next));
    refs.current[focus]?.focus();
  };

  const onChange = (index: number, value: string) => {
    const update = applyInput(latest.current, index, value);
    if (update.cells === latest.current) return;
    store(update.cells, update.focus);
    if (isComplete(update.cells)) onComplete(codeOf(update.cells));
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const update = applyBackspace(latest.current, index);
      store(update.cells, update.focus);
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    onChange(index, event.clipboardData.getData("text"));
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="text-auth-text mb-3 p-0 text-[14px] font-semibold">{label}</legend>
      <div className="grid grid-cols-6 gap-2">
        {cells.map((cell, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            value={cell}
            onChange={(event) => onChange(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => onPaste(index, event)}
            onFocus={(event) => event.target.select()}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            aria-label={t("digit", { n: index + 1 })}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "bg-auth-panel text-auth-text h-[60px] w-full min-w-0 rounded-[14px] border-[1.5px] text-center text-2xl font-bold tabular-nums outline-none",
              "focus-visible:border-brand focus-visible:ring-brand-ring focus-visible:ring-4 disabled:opacity-50",
              invalid ? "border-danger" : "border-auth-field",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
